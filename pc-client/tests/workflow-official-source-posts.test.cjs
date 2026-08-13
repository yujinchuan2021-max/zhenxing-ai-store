"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createLocalFlarumAdminRequest,
  ensureOfficialSourcePosts,
  POST_MARKERS,
  readExistingOfficialSourcePosts,
  rollbackOfficialSourcePosts,
  validateOfficialSourcePostManifest
} = require("../community/workflow-official-source-posts.cjs");

function manifest() {
  return structuredClone(require("../community/workflow-official-source-posts-candidate.json"));
}

test("official source post manifest fixes three readable, non-executable community posts", () => {
  const value = validateOfficialSourcePostManifest(manifest());
  assert.equal(value.posts.length, 3);
  assert.deepEqual(value.posts.map((post) => post.key), [
    "chatgpt-desktop-research",
    "codex-cli-code-review",
    "claude-desktop-content"
  ]);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.posts[0]), true);
});

function fakeFlarum() {
  const discussions = new Map();
  const posts = new Map();
  let nextDiscussionId = 10;
  let nextPostId = 20;
  const calls = [];

  function discussionData(record) {
    return {
      type: record.discussionType || "discussions",
      id: record.discussionId,
      attributes: { title: record.title },
      relationships: { firstPost: { data: { type: record.firstPostType || "posts", id: record.postId } } }
    };
  }

  async function request(input) {
    calls.push(structuredClone(input));
    if (input.method === "GET" && input.path.startsWith("/api/discussions?")) {
      const marker = new URL(`http://local${input.path}`).searchParams.get("filter[q]");
      const matches = [...discussions.values()].filter((item) => item.title.includes(marker));
      return { status: 200, value: { data: matches.map(discussionData) } };
    }
    const discussionMatch = input.path.match(/^\/api\/discussions\/([1-9][0-9]*)$/);
    if (input.method === "GET" && discussionMatch) {
      const record = discussions.get(discussionMatch[1]);
      return record ? { status: 200, value: { data: discussionData(record) } } : { status: 404, value: {} };
    }
    const postMatch = input.path.match(/^\/api\/posts\/([1-9][0-9]*)$/);
    if (input.method === "GET" && postMatch) {
      const record = posts.get(postMatch[1]);
      return record ? {
        status: 200,
        value: {
          data: {
            type: record.postType || "posts",
            id: record.postId,
            attributes: { content: record.content },
            relationships: { discussion: { data: { type: record.discussionRelationshipType || "discussions", id: record.discussionId } } }
          }
        }
      } : { status: 404, value: {} };
    }
    if (input.method === "POST" && input.path === "/api/discussions") {
      const discussionId = String(nextDiscussionId++);
      const postId = String(nextPostId++);
      const record = {
        discussionId,
        postId,
        title: input.body.data.attributes.title,
        content: input.body.data.attributes.content
      };
      discussions.set(discussionId, record);
      posts.set(postId, record);
      return { status: 201, value: { data: discussionData(record) } };
    }
    if (input.method === "DELETE" && discussionMatch) {
      const record = discussions.get(discussionMatch[1]);
      if (!record) return { status: 404, value: {} };
      discussions.delete(record.discussionId);
      posts.delete(record.postId);
      return { status: 204, value: null };
    }
    throw new Error(`unexpected request ${input.method} ${input.path}`);
  }

  return { calls, discussions, posts, request };
}

test("official source posts use the real Flarum interface once and retry without adding discussions", async () => {
  const flarum = fakeFlarum();
  const first = await ensureOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request });
  const second = await ensureOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request });

  assert.equal(flarum.discussions.size, 3);
  assert.equal(first.created.length, 3);
  assert.equal(second.created.length, 0);
  assert.deepEqual(second.items, first.items);
  assert.equal(flarum.calls.filter((call) => call.method === "POST").length, 3);
  assert.equal(flarum.calls.filter((call) => /^\/api\/posts\//.test(call.path)).length, 6);

  const rolledBack = await rollbackOfficialSourcePosts({
    manifest: manifest(),
    receipt: first.receipt,
    requestFlarum: flarum.request
  });
  assert.equal(rolledBack.removed, 3);
  assert.equal(flarum.discussions.size, 0);
});

test("official source post retry fails closed when an existing Flarum post drifted", async () => {
  const flarum = fakeFlarum();
  await ensureOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request });
  const record = [...flarum.posts.values()][0];
  record.content = `${record.content}\n已被篡改`;

  await assert.rejects(
    ensureOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request }),
    { code: "OFFICIAL_SOURCE_POST_CONFLICT" }
  );
  assert.equal(flarum.discussions.size, 3);
});

test("existing official source post readback uses only exact GETs and returns frozen items", async () => {
  const flarum = fakeFlarum();
  await ensureOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request });
  flarum.calls.length = 0;

  const items = await readExistingOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request });

  assert.deepEqual(items.map((item) => item.key), manifest().posts.map((post) => post.key));
  assert.equal(Object.isFrozen(items), true);
  assert.equal(Object.isFrozen(items[0]), true);
  assert.equal(flarum.calls.length, 6);
  assert.equal(flarum.calls.every((call) => call.method === "GET"), true);
  assert.equal(flarum.calls.filter((call) => call.method === "POST" || call.method === "DELETE").length, 0);
});

test("existing official source post readback fails closed without creating or deleting posts", async () => {
  const flarum = fakeFlarum();

  await assert.rejects(
    readExistingOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request }),
    { code: "OFFICIAL_SOURCE_POST_CONFLICT" }
  );
  assert.equal(flarum.calls.every((call) => call.method === "GET"), true);
  assert.equal(flarum.calls.filter((call) => call.method === "POST" || call.method === "DELETE").length, 0);
  assert.equal(flarum.discussions.size, 0);
  assert.equal(flarum.posts.size, 0);
});

test("existing official source post readback rejects every marker or post drift", async (t) => {
  const cases = [
    ["duplicate marker", ({ discussions }) => {
      const record = structuredClone([...discussions.values()][0]);
      record.discussionId = "99";
      discussions.set(record.discussionId, record);
    }],
    ["wrong title", ({ discussions }) => { [...discussions.values()][0].title = "wrong"; }],
    ["wrong content", ({ posts }) => { [...posts.values()][0].content = "wrong"; }],
    ["wrong discussion reference", ({ discussions, posts }) => {
      const discussion = [...discussions.values()][0];
      const record = structuredClone(posts.get(discussion.postId));
      record.discussionId = "99";
      posts.set(discussion.postId, record);
    }],
    ["wrong first post relationship type", ({ discussions }) => {
      [...discussions.values()][0].firstPostType = "users";
    }],
    ["wrong post discussion relationship type", ({ discussions, posts }) => {
      const discussion = [...discussions.values()][0];
      const record = structuredClone(posts.get(discussion.postId));
      record.discussionRelationshipType = "users";
      posts.set(discussion.postId, record);
    }],
    ["wrong post id", ({ discussions, posts }) => {
      const discussion = [...discussions.values()][0];
      const record = structuredClone(posts.get(discussion.postId));
      record.postId = "98";
      posts.set(discussion.postId, record);
    }],
    ["wrong discussion type", ({ discussions }) => { [...discussions.values()][0].discussionType = "posts"; }],
    ["wrong post type", ({ posts }) => { [...posts.values()][0].postType = "discussions"; }]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const flarum = fakeFlarum();
      await ensureOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request });
      mutate(flarum);
      flarum.calls.length = 0;

      await assert.rejects(
        readExistingOfficialSourcePosts({ manifest: manifest(), requestFlarum: flarum.request }),
        { code: "OFFICIAL_SOURCE_POST_CONFLICT" }
      );
      assert.equal(flarum.calls.every((call) => call.method === "GET"), true);
      assert.equal(flarum.calls.filter((call) => call.method === "POST" || call.method === "DELETE").length, 0);
    });
  }
});

test("local Flarum admin transport keeps credentials off URLs and rejects arbitrary paths", async () => {
  const calls = [];
  const request = createLocalFlarumAdminRequest({
    apiKey: "a".repeat(64),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/vnd.api+json" }
      });
    }
  });
  const response = await request({
    method: "GET",
    path: `/api/discussions?filter%5Bq%5D=${POST_MARKERS["chatgpt-desktop-research"]}&page%5Blimit%5D=20`
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.value, { data: [] });
  assert.equal(calls[0].url, `http://127.0.0.1/api/discussions?filter%5Bq%5D=${POST_MARKERS["chatgpt-desktop-research"]}&page%5Blimit%5D=20`);
  assert.equal(calls[0].options.headers.Authorization, `Token ${"a".repeat(64)}; userId=1`);
  assert.equal(calls[0].url.includes("a".repeat(16)), false);
  await assert.rejects(
    request({ method: "GET", path: "/api/users/1" }),
    { code: "OFFICIAL_SOURCE_POST_TRANSPORT_DENIED" }
  );
  assert.throws(
    () => createLocalFlarumAdminRequest({ apiKey: `x\n${"a".repeat(40)}` }),
    { code: "OFFICIAL_SOURCE_POST_TRANSPORT_DENIED" }
  );
});
