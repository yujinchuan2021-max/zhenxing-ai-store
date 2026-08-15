"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  CATALOG_URL,
  OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL,
  verifiedCatalog
} = require("../identity/workflow-official-bootstrap-production.cjs");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, "community", "workflow-official-bootstrap-candidate.json"),
  "utf8"
));
const state = JSON.parse(fs.readFileSync(
  path.join(root, "admin", "published", "catalog-store", "state.json"),
  "utf8"
));
const envelope = JSON.parse(fs.readFileSync(
  path.join(root, "admin", "published", "catalog-store", "releases", `${state.channels.v2.activeReleaseId}.json`),
  "utf8"
));

function response(body = envelope) {
  return { ok: true, status: 200, json: async () => body };
}

test("official bootstrap accepts only literal v2 and always requests the fixed Admin v2 endpoint", async () => {
  assert.equal(OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL, "v2");
  assert.equal(CATALOG_URL, "http://admin:4173/channels/v2/catalog-release.json");
  assert.equal(manifest.catalog.catalogVersion, 7);
  for (const channel of [undefined, "v1", "V2", "v2 ", "https://admin:4173/channels/v2/catalog-release.json"]) {
    let calls = 0;
    await assert.rejects(
      () => verifiedCatalog(manifest, { catalogChannel: channel, fetchImpl: async () => { calls += 1; return response(); } }),
      (error) => error?.code === "OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL_DENIED" && error?.status === 503
    );
    assert.equal(calls, 0);
  }

  let request;
  const verified = await verifiedCatalog(manifest, {
    catalogChannel: "v2",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response();
    }
  });
  assert.equal(verified.releaseId, manifest.catalog.releaseId);
  assert.equal(request.url, CATALOG_URL);
  assert.deepEqual(request.options, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "error"
  });
});

test("official bootstrap catalog maps transport and signature failures to retryable 503, then exact signed mismatch to 400", async () => {
  let attempts = 0;
  const fetchThenRecover = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("private network diagnostic");
    return response();
  };
  await assert.rejects(
    () => verifiedCatalog(manifest, { catalogChannel: "v2", fetchImpl: fetchThenRecover }),
    (error) => error?.code === "OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE" && error?.status === 503
  );
  assert.equal((await verifiedCatalog(manifest, { catalogChannel: "v2", fetchImpl: fetchThenRecover })).releaseId, manifest.catalog.releaseId);
  assert.equal(attempts, 2);

  await assert.rejects(
    () => verifiedCatalog(manifest, { catalogChannel: "v2", fetchImpl: async () => response({ malformed: true }) }),
    (error) => error?.code === "OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE" && error?.status === 503
  );

  const mismatched = structuredClone(manifest);
  mismatched.catalog.catalogSha256 = "0".repeat(64);
  await assert.rejects(
    () => verifiedCatalog(mismatched, { catalogChannel: "v2", fetchImpl: async () => response() }),
    (error) => error?.code === "OFFICIAL_BOOTSTRAP_CATALOG_TUPLE_MISSING" && error?.status === 400
  );
});

