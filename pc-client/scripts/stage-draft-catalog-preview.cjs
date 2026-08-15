"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { loadSigningKey } = require("../admin/signing-key.cjs");
const { canonicalize, createSignedEnvelope } = require("../shared/signed-release.cjs");
const { readCatalogClientChannel } = require("../shared/catalog-client-channel.cjs");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "deployment", "local", "runtime", "staging", "draft84-preview", "catalog-release.json");
const keyMetadata = readCatalogClientChannel(
  JSON.parse(fs.readFileSync(path.join(root, "catalog", "channel.json"), "utf8")),
  { kind: "catalog", allowLocalhost: true }
).trustedKeys[0];

(async () => {
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin", "published", "catalog-store"),
    signingKeyProvider: async () =>
      loadSigningKey({ dataDirectory: path.join(root, "admin", "data"), keyMetadata })
  });
  const state = await store.readState();
  if (!state.draft || state.draft.revision !== 84 || !state.activeRelease) {
    throw new Error("Expected draft84 preview state is unavailable");
  }
  const signingKey = loadSigningKey({ dataDirectory: path.join(root, "admin", "data"), keyMetadata });
  const catalog = state.draft.catalog;
  const catalogSha256 = crypto.createHash("sha256").update(canonicalize(catalog)).digest("hex");
  const payload = {
    schemaVersion: 1,
    releaseId: `catalog-v00000084-${catalogSha256.slice(0, 12)}-d84a0001`,
    catalogVersion: 84,
    publishedAt: state.draft.updatedAt,
    draftRevision: 84,
    parentReleaseId: state.activeRelease.releaseId,
    sourceReleaseId: null,
    notes: "local draft preview only",
    rollout: { percentage: 100, salt: "draft-preview-84" },
    catalogSha256,
    catalog
  };
  const envelope = createSignedEnvelope({
    kind: "catalog",
    keyId: signingKey.keyId,
    payload,
    privateKey: signingKey.privateKey
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(envelope)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  process.stdout.write(JSON.stringify({ ok: true, output, revision: 84 }) + "\n");
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
