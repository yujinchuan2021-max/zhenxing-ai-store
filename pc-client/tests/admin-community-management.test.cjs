"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  createCommunityManagement,
  normalizedAction
} = require("../admin/community-management.cjs");

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-community-management-"));
  const cms = path.join(directory, "cms");
  const upstream = path.join(directory, "upstream");
  fs.writeFileSync(cms, "c".repeat(48));
  fs.writeFileSync(upstream, "u".repeat(48));
  return {
    directory,
    env: {
      AIHUB_COMMUNITY_MANAGEMENT_ENABLED: "1",
      AIHUB_COMMUNITY_CMS_ORIGIN: "http://127.0.0.1:4174",
      AIHUB_COMMUNITY_CMS_SECRET_FILE: cms,
      AIHUB_COMMUNITY_MANAGEMENT_ORIGIN: "http://community",
      AIHUB_COMMUNITY_MANAGEMENT_SECRET_FILE: upstream
    }
  };
}

test("community management has a fixed upstream and structured actions", async (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.directory, { recursive: true, force: true }));
  const calls = [];
  const manager = createCommunityManagement({
    env: value.env,
    request: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        action: "set-discussion-hidden",
        target: { type: "discussion", id: "42" },
        hidden: true
      };
    }
  });
  await manager.execute({ action: "set-discussion-hidden", discussionId: "42", hidden: true });
  assert.equal(calls[0].url, "http://community/aihub-community-management.php");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    action: "set-discussion-hidden",
    discussionId: "42",
    hidden: true
  });
  assert.equal(calls[0].options.headers["X-AIHub-Community-Management-Secret"], "u".repeat(48));
});

test("community summary preserves unavailable moderation semantics without inventing zero", async (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.directory, { recursive: true, force: true }));
  const manager = createCommunityManagement({
    env: value.env,
    request: async () => ({
      status: "ready",
      health: "ready",
      users: { status: "ready", total: 12 },
      posts: { status: "ready", total: 34 },
      pending: { status: "unavailable", total: null, reason: "moderation-extension-not-configured" },
      reports: { status: "unavailable", total: null, reason: "moderation-extension-not-configured" },
      targets: {
        discussions: [{ id: "1", title: "hello", hidden: false }],
        posts: [{ id: "2", discussionId: "1", number: 1, preview: "world", hidden: false }]
      },
      capabilities: { setDiscussionHidden: true, setPostHidden: true, nativeAdmin: false }
    })
  });
  const summary = await manager.list();
  assert.equal(summary.status, "ready");
  assert.equal(summary.pending.total, null);
  assert.equal(summary.pending.reason, "moderation-extension-not-configured");
  assert.equal(summary.capabilities.nativeAdmin, false);
});

test("community summary fails closed to unavailable on invalid or failed upstream", async (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.directory, { recursive: true, force: true }));
  for (const request of [async () => ({ status: "ready" }), async () => { throw new Error("offline"); }]) {
    const summary = await createCommunityManagement({ env: value.env, request }).list();
    assert.equal(summary.status, "unavailable");
    assert.equal(summary.users.total, null);
    assert.deepEqual(summary.targets, { discussions: [], posts: [] });
  }
});

test("community management rejects SSRF, extra fields, and arbitrary actions", (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.directory, { recursive: true, force: true }));
  assert.throws(() => createCommunityManagement({
    env: { ...value.env, AIHUB_COMMUNITY_MANAGEMENT_ORIGIN: "http://169.254.169.254" }
  }), /not an approved internal host/);
  assert.throws(() => createCommunityManagement({
    env: { ...value.env, AIHUB_COMMUNITY_MANAGEMENT_ORIGIN: "http://community:8080" }
  }), /not an approved internal origin/);
  assert.throws(
    () => normalizedAction({ action: "set-discussion-hidden", discussionId: "1", hidden: true, url: "https://evil.example" }),
    /extra fields|fields are invalid/
  );
  assert.throws(() => normalizedAction({ action: "proxy", url: "https://evil.example" }), /not approved/);
});

test("community write access requires injected secret, exact origin, JSON, and CSRF marker", (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.directory, { recursive: true, force: true }));
  const manager = createCommunityManagement({ env: value.env, request: async () => ({ ok: true }) });
  const valid = {
    headers: {
      "x-aihub-cms-secret": "c".repeat(48),
      origin: "http://127.0.0.1:4174",
      "x-aihub-csrf": "1",
      "content-type": "application/json"
    }
  };
  assert.doesNotThrow(() => manager.authorize(valid, { write: true }));
  for (const headers of [
    { ...valid.headers, "x-aihub-cms-secret": "wrong" },
    { ...valid.headers, origin: "https://evil.example" },
    { ...valid.headers, "x-aihub-csrf": "0" },
    { ...valid.headers, "content-type": "text/plain" }
  ]) {
    assert.throws(() => manager.authorize({ headers }, { write: true }), /denied|CSRF/);
  }
});

test("disabled community management does not load secrets", () => {
  const manager = createCommunityManagement({ env: {} });
  assert.equal(manager.enabled, false);
  assert.throws(() => manager.authorize({ headers: {} }), /unavailable/);
});
