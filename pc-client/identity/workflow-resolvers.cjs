"use strict";

const {
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
  resolveWorkflowOfficialPublisherPublicIdentity
} = require("./workflow-official-publisher-service-identity.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLARUM_POST_ID_PATTERN = /^[1-9][0-9]{0,18}$/;
const FLARUM_INTERNAL_ORIGIN = "http://community";
const FLARUM_RESPONSE_LIMIT_BYTES = 64 * 1024;
const FLARUM_REQUEST_TIMEOUT_MS = 2_000;

const CANONICAL_WORKFLOW_LICENSE_IDS = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "ISC",
  "MIT",
  "MPL-2.0"
]);

function createWorkflowDependencyResolver({ activeCatalogSource } = {}) {
  if (typeof activeCatalogSource?.hasCanonicalDependency !== "function") {
    throw new TypeError("workflow dependency catalog source is invalid");
  }
  return async function hasCanonicalDependency(tuple) {
    try {
      return (await activeCatalogSource.hasCanonicalDependency(tuple)) === true;
    } catch (cause) {
      const error = new Error("workflow dependency catalog is temporarily unavailable");
      error.code = "TEMPORARILY_UNAVAILABLE";
      error.status = 503;
      error.cause = cause;
      throw error;
    }
  };
}

async function hasCanonicalWorkflowLicense(licenseId) {
  return CANONICAL_WORKFLOW_LICENSE_IDS.has(licenseId) === true;
}

async function responseText(response) {
  const length = response.headers?.get?.("content-length");
  if (length !== null && length !== undefined) {
    if (!/^\d+$/.test(length) || Number(length) > FLARUM_RESPONSE_LIMIT_BYTES) {
      throw new Error("Flarum post response is too large");
    }
  }
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        bytes += chunk.length;
        if (bytes > FLARUM_RESPONSE_LIMIT_BYTES) {
          await reader.cancel();
          throw new Error("Flarum post response is too large");
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks, bytes).toString("utf8");
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > FLARUM_RESPONSE_LIMIT_BYTES) {
    throw new Error("Flarum post response is too large");
  }
  return body.toString("utf8");
}

function createFlarumPostResolver({
  fetchPost = globalThis.fetch,
  requestTimeoutMs = FLARUM_REQUEST_TIMEOUT_MS
} = {}) {
  if (
    typeof fetchPost !== "function" ||
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 30_000
  ) {
    throw new TypeError("Flarum post resolver configuration is invalid");
  }
  return async function hasCommunityPost(postId) {
    const canonicalId = String(postId || "");
    if (!FLARUM_POST_ID_PATTERN.test(canonicalId)) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchPost(
        `${FLARUM_INTERNAL_ORIGIN}/api/posts/${canonicalId}`,
        {
          method: "GET",
          headers: { Accept: "application/vnd.api+json" },
          redirect: "error",
          signal: controller.signal
        }
      );
      if (!response || response.ok !== true || response.status !== 200) return false;
      const payload = JSON.parse(await responseText(response));
      return payload?.data?.type === "posts" && payload.data.id === canonicalId;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function createPublicIdentityResolver({ pool } = {}) {
  if (typeof pool?.query !== "function") {
    throw new TypeError("public identity resolver database is invalid");
  }
  return async function resolvePublicIdentity(identityId) {
    const canonicalId = String(identityId || "").toLowerCase();
    if (!UUID_PATTERN.test(canonicalId)) return null;
    try {
      if (canonicalId === WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID) {
        return resolveWorkflowOfficialPublisherPublicIdentity(pool);
      }
      const result = await pool.query(
        `SELECT u.id, p.nickname
           FROM users u
           JOIN community_profiles p ON p.user_id = u.id
          WHERE u.id = $1 AND u.status = 'active'`,
        [canonicalId]
      );
      if (result.rowCount !== 1) return null;
      return {
        identityId: result.rows[0].id,
        displayName: result.rows[0].nickname
      };
    } catch {
      return null;
    }
  };
}

module.exports = {
  CANONICAL_WORKFLOW_LICENSE_IDS,
  FLARUM_INTERNAL_ORIGIN,
  FLARUM_REQUEST_TIMEOUT_MS,
  FLARUM_RESPONSE_LIMIT_BYTES,
  createFlarumPostResolver,
  createPublicIdentityResolver,
  createWorkflowDependencyResolver,
  hasCanonicalWorkflowLicense
};
