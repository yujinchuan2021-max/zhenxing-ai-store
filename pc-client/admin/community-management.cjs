"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const MAX_RESPONSE_BYTES = 1024 * 1024;
const ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const SUMMARY_KEYS = ["status", "health", "users", "posts", "pending", "reports", "targets", "capabilities"];

class CommunityManagementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requiredSecret(file, label) {
  const path = String(file || "").trim();
  if (!path) throw new Error(`${label} secret file is required`);
  const stat = fs.statSync(path);
  if (!stat.isFile() || stat.size < 32 || stat.size > 4096) {
    throw new Error(`${label} secret file is invalid`);
  }
  const value = fs.readFileSync(path, "utf8").trim();
  if (value.length < 32 || value.length > 512 || /[\r\n]/.test(value)) {
    throw new Error(`${label} secret is invalid`);
  }
  return value;
}

function exactOrigin(value, { label, allowedInternalHosts = null } = {}) {
  const text = String(value || "").trim();
  const parsed = new URL(text);
  if (
    parsed.origin !== text ||
    parsed.username ||
    parsed.password ||
    !["http:", "https:"].includes(parsed.protocol)
  ) {
    throw new Error(`${label} origin is invalid`);
  }
  if (allowedInternalHosts) {
    if (!allowedInternalHosts.has(parsed.hostname) || parsed.protocol !== "http:") {
      throw new Error(`${label} origin is not an approved internal host`);
    }
    if (parsed.port) {
      throw new Error(`${label} origin is not an approved internal origin`);
    }
  } else if (
    parsed.protocol !== "https:" &&
    !["127.0.0.1", "localhost"].includes(parsed.hostname)
  ) {
    throw new Error(`${label} origin must use HTTPS or loopback HTTP`);
  }
  return parsed.origin;
}

function sameSecret(expected, received) {
  const left = Buffer.from(expected);
  const right = Buffer.from(String(received || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function defaultRequest(url, options) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(5000)
  });
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_RESPONSE_BYTES) {
    throw new CommunityManagementError("community management response is too large", 502);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_RESPONSE_BYTES) {
    throw new CommunityManagementError("community management response is too large", 502);
  }
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new CommunityManagementError("community management returned invalid JSON", 502);
  }
  if (!response.ok) {
    throw new CommunityManagementError(
      String(value?.error || "community management request failed"),
      response.status >= 400 && response.status < 600 ? response.status : 502
    );
  }
  return value;
}

function normalizedAction(input) {
  if (!input || Array.isArray(input) || typeof input !== "object") {
    throw new CommunityManagementError("community management action is invalid");
  }
  const action = String(input.action || "");
  if (action === "list") {
    if (Object.keys(input).some((key) => key !== "action")) {
      throw new CommunityManagementError("community management action has extra fields");
    }
    return { action };
  }
  if (!["set-discussion-hidden", "set-post-hidden"].includes(action)) {
    throw new CommunityManagementError("community management action is not approved");
  }
  const expectedId = action === "set-discussion-hidden" ? "discussionId" : "postId";
  if (
    Object.keys(input).some((key) => !["action", expectedId, "hidden"].includes(key)) ||
    !ID_PATTERN.test(String(input[expectedId] || "")) ||
    typeof input.hidden !== "boolean"
  ) {
    throw new CommunityManagementError("community management action fields are invalid");
  }
  return { action, [expectedId]: String(input[expectedId]), hidden: input.hidden };
}

function unavailableSummary() {
  const metric = { status: "unavailable", total: null };
  return {
    status: "unavailable",
    health: "unavailable",
    users: { ...metric },
    posts: { ...metric },
    pending: { ...metric },
    reports: { ...metric },
    targets: { discussions: [], posts: [] },
    capabilities: {
      setDiscussionHidden: false,
      setPostHidden: false,
      nativeAdmin: false
    }
  };
}

function exactKeys(value, expected) {
  return value && !Array.isArray(value) && typeof value === "object" &&
    Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

function metric(value, { optional = false } = {}) {
  if (!exactKeys(value, value?.reason === undefined ? ["status", "total"] : ["status", "total", "reason"])) {
    throw new CommunityManagementError("community management summary is invalid", 502);
  }
  if (value.status === "ready" && Number.isSafeInteger(value.total) && value.total >= 0) {
    return { status: "ready", total: value.total };
  }
  if (optional && value.status === "unavailable" && value.total === null && value.reason === "moderation-extension-not-configured") {
    return { status: "unavailable", total: null, reason: value.reason };
  }
  throw new CommunityManagementError("community management summary is invalid", 502);
}

function normalizeSummary(value) {
  if (!exactKeys(value, SUMMARY_KEYS) || value.status !== "ready" || value.health !== "ready") {
    throw new CommunityManagementError("community management summary is invalid", 502);
  }
  if (!exactKeys(value.targets, ["discussions", "posts"]) || !Array.isArray(value.targets.discussions) || !Array.isArray(value.targets.posts) || value.targets.discussions.length > 50 || value.targets.posts.length > 50) {
    throw new CommunityManagementError("community management targets are invalid", 502);
  }
  const discussions = value.targets.discussions.map((item) => {
    if (!exactKeys(item, ["id", "title", "hidden"]) || !ID_PATTERN.test(String(item.id || "")) || typeof item.hidden !== "boolean") {
      throw new CommunityManagementError("community discussion target is invalid", 502);
    }
    const title = String(item.title || "").trim();
    if (!title || title.length > 160 || /[<>]/.test(title)) {
      throw new CommunityManagementError("community discussion title is invalid", 502);
    }
    return { id: String(item.id), title, hidden: item.hidden };
  });
  const posts = value.targets.posts.map((item) => {
    if (!exactKeys(item, ["id", "discussionId", "number", "preview", "hidden"]) || !ID_PATTERN.test(String(item.id || "")) || !ID_PATTERN.test(String(item.discussionId || "")) || !Number.isSafeInteger(item.number) || item.number < 1 || typeof item.hidden !== "boolean") {
      throw new CommunityManagementError("community post target is invalid", 502);
    }
    const preview = String(item.preview || "").trim();
    if (preview.length > 240 || /[<>]/.test(preview)) {
      throw new CommunityManagementError("community post preview is invalid", 502);
    }
    return { id: String(item.id), discussionId: String(item.discussionId), number: item.number, preview, hidden: item.hidden };
  });
  if (!exactKeys(value.capabilities, ["setDiscussionHidden", "setPostHidden", "nativeAdmin"]) || typeof value.capabilities.setDiscussionHidden !== "boolean" || typeof value.capabilities.setPostHidden !== "boolean" || value.capabilities.nativeAdmin !== false) {
    throw new CommunityManagementError("community management capabilities are invalid", 502);
  }
  return {
    status: "ready",
    health: "ready",
    users: metric(value.users),
    posts: metric(value.posts),
    pending: metric(value.pending, { optional: true }),
    reports: metric(value.reports, { optional: true }),
    targets: { discussions, posts },
    capabilities: { ...value.capabilities }
  };
}

function normalizeActionResult(value, input) {
  const targetType = input.action === "set-discussion-hidden" ? "discussion" : "post";
  const targetId = input.discussionId || input.postId;
  if (!exactKeys(value, ["ok", "action", "target", "hidden"]) || value.ok !== true || value.action !== input.action || value.hidden !== input.hidden || !exactKeys(value.target, ["type", "id"]) || value.target.type !== targetType || value.target.id !== targetId) {
    throw new CommunityManagementError("community management action response is invalid", 502);
  }
  return { ok: true, action: input.action, target: { type: targetType, id: targetId }, hidden: input.hidden };
}

function createCommunityManagement({ env = process.env, request = defaultRequest } = {}) {
  const enabled = env.AIHUB_COMMUNITY_MANAGEMENT_ENABLED === "1";
  if (!enabled) {
    return {
      enabled: false,
      authorize() {
        throw new CommunityManagementError("community management is unavailable", 404);
      }
    };
  }

  const cmsOrigin = exactOrigin(env.AIHUB_COMMUNITY_CMS_ORIGIN, { label: "CMS" });
  const upstreamOrigin = exactOrigin(env.AIHUB_COMMUNITY_MANAGEMENT_ORIGIN, {
    label: "community management",
    allowedInternalHosts: new Set(["community", "127.0.0.1", "localhost"])
  });
  const cmsSecret = requiredSecret(env.AIHUB_COMMUNITY_CMS_SECRET_FILE, "CMS gateway");
  const upstreamSecret = requiredSecret(
    env.AIHUB_COMMUNITY_MANAGEMENT_SECRET_FILE,
    "community management"
  );

  function authorize(httpRequest, { write = false } = {}) {
    if (!sameSecret(cmsSecret, httpRequest.headers["x-aihub-cms-secret"])) {
      throw new CommunityManagementError("community management access denied", 403);
    }
    if (write) {
      if (
        httpRequest.headers.origin !== cmsOrigin ||
        httpRequest.headers["x-aihub-csrf"] !== "1" ||
        !String(httpRequest.headers["content-type"] || "")
          .toLowerCase()
          .startsWith("application/json")
      ) {
        throw new CommunityManagementError("community management CSRF check failed", 403);
      }
    }
  }

  async function call(input) {
    return request(
      new URL("/aihub-community-management.php", `${upstreamOrigin}/`).href,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AIHub-Community-Management-Secret": upstreamSecret
        },
        body: JSON.stringify(normalizedAction(input))
      }
    );
  }

  return {
    enabled: true,
    authorize,
    async list() {
      try {
        return normalizeSummary(await call({ action: "list" }));
      } catch {
        return unavailableSummary();
      }
    },
    async execute(input) {
      const normalized = normalizedAction(input);
      return normalizeActionResult(await call(normalized), normalized);
    }
  };
}

module.exports = {
  CommunityManagementError,
  createCommunityManagement,
  normalizedAction,
  normalizeSummary,
  unavailableSummary
};
