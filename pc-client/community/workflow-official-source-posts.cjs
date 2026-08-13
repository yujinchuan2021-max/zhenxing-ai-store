"use strict";

const POST_KEYS = Object.freeze([
  "chatgpt-desktop-research",
  "codex-cli-code-review",
  "claude-desktop-content"
]);
const POST_MARKERS = Object.freeze({
  "chatgpt-desktop-research": "AIHUBWFOSCHATGPTDESKTOPV1",
  "codex-cli-code-review": "AIHUBWFOSCODEXCLIREVIEWV1",
  "claude-desktop-content": "AIHUBWFOSCLAUDEDESKTOPV1"
});
const issuedRollbackReceipts = new WeakSet();
const RESPONSE_LIMIT_BYTES = 1024 * 1024;

class WorkflowOfficialSourcePostError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkflowOfficialSourcePostError";
    this.code = code;
  }
}

function fail(message) {
  throw new WorkflowOfficialSourcePostError("OFFICIAL_SOURCE_POST_INVALID", message);
}

function conflict(message) {
  throw new WorkflowOfficialSourcePostError("OFFICIAL_SOURCE_POST_CONFLICT", message);
}

function transportDenied(message) {
  throw new WorkflowOfficialSourcePostError("OFFICIAL_SOURCE_POST_TRANSPORT_DENIED", message);
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exact(value, fields) {
  if (!plainObject(value) || Object.keys(value).length !== fields.length ||
      fields.some((field) => !Object.hasOwn(value, field))) fail("manifest fields are invalid");
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validateOfficialSourcePostManifest(manifest) {
  exact(manifest, ["schemaVersion", "candidateOnly", "manifestId", "posts"]);
  if (manifest.schemaVersion !== 1 || manifest.candidateOnly !== true ||
      manifest.manifestId !== "zhenxing-workflow-official-source-posts-v1" ||
      !Array.isArray(manifest.posts) || manifest.posts.length !== POST_KEYS.length) {
    fail("manifest identity is invalid");
  }
  manifest.posts.forEach((post, index) => {
    exact(post, ["key", "title", "content"]);
    const marker = `来源标识：workflow-official-source/${POST_KEYS[index]}-v1`;
    if (post.key !== POST_KEYS[index] || typeof post.title !== "string" ||
        post.title.length < 10 || post.title.length > 160 ||
        typeof post.content !== "string" || post.content.length < marker.length + 2 ||
        post.content.length > 4_000 || post.content.split(marker).length !== 2 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(`${post.title}${post.content}`) ||
        /<\/?(?:script|iframe|object|embed)\b|https?:\/\//iu.test(`${post.title}${post.content}`)) {
      fail("official source post content is invalid");
    }
  });
  return deepFreeze(structuredClone(manifest));
}

function canonicalId(value) {
  const id = String(value || "");
  if (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 4294967295) {
    conflict("Flarum returned an invalid identifier");
  }
  return id;
}

function firstPostId(discussion) {
  if (discussion?.type !== "discussions") conflict("Flarum discussion response is invalid");
  canonicalId(discussion.id);
  const firstPost = discussion.relationships?.firstPost?.data;
  if (firstPost?.type !== "posts") conflict("Flarum discussion response is invalid");
  return canonicalId(firstPost.id);
}

async function call(requestFlarum, request) {
  if (typeof requestFlarum !== "function") throw new TypeError("requestFlarum is required");
  const response = await requestFlarum(deepFreeze(structuredClone(request)));
  if (!plainObject(response) || !Number.isInteger(response.status)) {
    conflict("Flarum transport response is invalid");
  }
  return response;
}

async function verifyPost(requestFlarum, expected, discussion) {
  const discussionId = canonicalId(discussion.id);
  const postId = firstPostId(discussion);
  const postResponse = await call(requestFlarum, { method: "GET", path: `/api/posts/${postId}` });
  const mismatch = [
    ["status", postResponse.status !== 200],
    ["post-type", postResponse.value?.data?.type !== "posts"],
    ["post-id", postResponse.value?.data?.id !== postId],
    ["content", postResponse.value?.data?.attributes?.content !== expected.content],
    ["discussion-type", postResponse.value?.data?.relationships?.discussion?.data?.type !== "discussions"],
    ["discussion-id", postResponse.value?.data?.relationships?.discussion?.data?.id !== discussionId],
    ["title", discussion.attributes?.title !== `${expected.title} [${POST_MARKERS[expected.key]}]`]
  ].find(([, failed]) => failed)?.[0];
  if (mismatch) conflict(`existing Flarum source post does not match the frozen manifest (${expected.key}:${mismatch})`);
  return deepFreeze({ key: expected.key, discussionId, postId });
}

async function findExistingOfficialSourcePost(requestFlarum, post) {
  const marker = POST_MARKERS[post.key];
  const query = `/api/discussions?filter%5Bq%5D=${encodeURIComponent(marker)}&page%5Blimit%5D=20`;
  const search = await call(requestFlarum, { method: "GET", path: query });
  if (search.status !== 200 || !Array.isArray(search.value?.data)) {
    conflict("Flarum source post search failed");
  }
  if (search.value.data.length > 1) conflict("Flarum source post marker is duplicated");
  return search.value.data.length === 0 ? null : verifyPost(requestFlarum, post, search.value.data[0]);
}

async function readExistingOfficialSourcePosts({ manifest, requestFlarum } = {}) {
  const normalized = validateOfficialSourcePostManifest(manifest);
  const items = [];
  for (const post of normalized.posts) {
    const item = await findExistingOfficialSourcePost(requestFlarum, post);
    if (!item) conflict("Flarum source post is missing");
    items.push(item);
  }
  return deepFreeze(items);
}

async function ensureOne(requestFlarum, post) {
  const existing = await findExistingOfficialSourcePost(requestFlarum, post);
  if (existing) return { item: existing, created: false };
  const created = await call(requestFlarum, {
    method: "POST",
    path: "/api/discussions",
    body: {
      data: {
        type: "discussions",
        attributes: { title: `${post.title} [${POST_MARKERS[post.key]}]`, content: post.content }
      }
    }
  });
  if (![200, 201].includes(created.status)) conflict("Flarum source post creation failed");
  return { item: await verifyPost(requestFlarum, post, created.value?.data), created: true };
}

async function ensureOfficialSourcePosts({ manifest, requestFlarum } = {}) {
  const normalized = validateOfficialSourcePostManifest(manifest);
  const items = [];
  const created = [];
  for (const post of normalized.posts) {
    const result = await ensureOne(requestFlarum, post);
    items.push(result.item);
    if (result.created) created.push(result.item);
  }
  const receipt = deepFreeze({
    manifestId: normalized.manifestId,
    created: structuredClone(created)
  });
  issuedRollbackReceipts.add(receipt);
  return deepFreeze({ items, created, receipt });
}

async function rollbackOfficialSourcePosts({ manifest, receipt, requestFlarum } = {}) {
  const normalized = validateOfficialSourcePostManifest(manifest);
  if (!issuedRollbackReceipts.has(receipt) || receipt.manifestId !== normalized.manifestId ||
      !Array.isArray(receipt.created)) {
    throw new WorkflowOfficialSourcePostError(
      "OFFICIAL_SOURCE_POST_ROLLBACK_DENIED",
      "rollback requires the current same-process receipt"
    );
  }
  let removed = 0;
  for (const item of [...receipt.created].reverse()) {
    const post = normalized.posts.find((candidate) => candidate.key === item.key);
    if (!post || canonicalId(item.discussionId) !== item.discussionId || canonicalId(item.postId) !== item.postId) {
      conflict("rollback receipt does not match the manifest");
    }
    const discussion = await call(requestFlarum, {
      method: "GET",
      path: `/api/discussions/${item.discussionId}`
    });
    if (discussion.status === 404) continue;
    if (discussion.status !== 200) conflict("Flarum rollback verification failed");
    const verified = await verifyPost(requestFlarum, post, discussion.value?.data);
    if (verified.postId !== item.postId) conflict("rollback receipt post does not match");
    const deleted = await call(requestFlarum, {
      method: "DELETE",
      path: `/api/discussions/${item.discussionId}`
    });
    if (![204, 404].includes(deleted.status)) conflict("Flarum rollback failed");
    removed += deleted.status === 204 ? 1 : 0;
  }
  issuedRollbackReceipts.delete(receipt);
  return deepFreeze({ removed });
}

function allowedRequest(method, path, body) {
  const idPath = /^\/api\/(?:discussions|posts)\/[1-9][0-9]{0,9}$/;
  const searchPath = /^\/api\/discussions\?filter%5Bq%5D=AIHUBWFOS(?:CHATGPTDESKTOP|CODEXCLIREVIEW|CLAUDEDESKTOP)V1&page%5Blimit%5D=20$/;
  if (method === "GET" && body === undefined && (idPath.test(path) || searchPath.test(path))) return true;
  if (method === "DELETE" && body === undefined && /^\/api\/discussions\/[1-9][0-9]{0,9}$/.test(path)) return true;
  return method === "POST" && path === "/api/discussions" && plainObject(body);
}

function createLocalFlarumAdminRequest({
  apiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000
} = {}) {
  if (typeof apiKey !== "string" || apiKey.length < 32 || apiKey.length > 512 ||
      /[;\r\n\u0000-\u001f\u007f]/u.test(apiKey) || typeof fetchImpl !== "function" ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    transportDenied("Flarum admin transport configuration is invalid");
  }
  return async function requestFlarum(request) {
    if (!plainObject(request) || !allowedRequest(request.method, request.path, request.body)) {
      transportDenied("Flarum admin transport path is not allowed");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`http://127.0.0.1${request.path}`, {
        method: request.method,
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Token ${apiKey}; userId=1`,
          ...(request.body === undefined ? {} : { "Content-Type": "application/vnd.api+json" })
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        redirect: "error",
        signal: controller.signal
      });
      const length = response.headers?.get?.("content-length");
      if (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) > RESPONSE_LIMIT_BYTES)) {
        conflict("Flarum response is too large");
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > RESPONSE_LIMIT_BYTES) conflict("Flarum response is too large");
      let value = null;
      if (bytes.length > 0) {
        try {
          value = JSON.parse(bytes.toString("utf8"));
        } catch {
          conflict("Flarum response is not JSON");
        }
      }
      return { status: response.status, value };
    } catch (error) {
      if (error instanceof WorkflowOfficialSourcePostError) throw error;
      throw new WorkflowOfficialSourcePostError(
        "OFFICIAL_SOURCE_POST_UNAVAILABLE",
        "Flarum official source post transport is unavailable"
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}

module.exports = {
  POST_KEYS,
  POST_MARKERS,
  WorkflowOfficialSourcePostError,
  createLocalFlarumAdminRequest,
  ensureOfficialSourcePosts,
  readExistingOfficialSourcePosts,
  rollbackOfficialSourcePosts,
  validateOfficialSourcePostManifest
};
