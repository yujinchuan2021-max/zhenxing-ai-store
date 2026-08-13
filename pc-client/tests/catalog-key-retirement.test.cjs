"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

const RETIRED_SHA256 = "da5aad41bd9a2f0fe1db2045b2bf93064af7a7b171ddf9c8ca54e17e8889cb3e";

function retiredPublicEvidence() {
  const publicDirectory = path.join(root, "output/catalog-key-rotation-20260812-candidate/public");
  return {
    retiredBytes: fs.readFileSync(path.join(publicDirectory, "RETIRED.json")),
    denylistBytes: fs.readFileSync(path.join(publicDirectory, "KEY-DENYLIST.json")),
    protectedContentReadCount: 0
  };
}

test("tainted catalog key is denied before private material can be read", () => {
  const {
    CATALOG_KEY_OPERATIONS,
    RETIRED_CATALOG_KEY_ID,
    assertCatalogSigningKeyAllowed
  } = require("../shared/catalog-key-retirement.cjs");
  let privateReads = 0;
  const candidate = {
    keyId: RETIRED_CATALOG_KEY_ID,
    get privateKey() {
      privateReads += 1;
      return "must-not-be-read";
    }
  };
  assert.throws(
    () => assertCatalogSigningKeyAllowed(candidate.keyId, "sign"),
    /CATALOG_KEY_RETIRED/
  );
  assert.equal(privateReads, 0);
  assert.doesNotThrow(() => assertCatalogSigningKeyAllowed("catalog-future-safe", "sign"));
  assert.deepEqual(CATALOG_KEY_OPERATIONS, ["trust", "sign", "package", "publish", "upload", "deploy", "state-write"]);
  for (const operation of CATALOG_KEY_OPERATIONS) {
    assert.throws(() => assertCatalogSigningKeyAllowed(RETIRED_CATALOG_KEY_ID, operation), /CATALOG_KEY_RETIRED/);
  }
});

test("runtime channel and verifier reject retired trust while active7 old trust remains valid", () => {
  const { readCatalogClientChannel } = require("../shared/catalog-client-channel.cjs");
  const { verifySignedEnvelope } = require("../shared/signed-release.cjs");
  const retiredChannel = JSON.parse(fs.readFileSync(path.join(root, "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-0.1.82-transition.json"), "utf8"));
  assert.throws(() => readCatalogClientChannel(retiredChannel, { kind: "catalog" }), /CATALOG_KEY_RETIRED/);

  const current = JSON.parse(fs.readFileSync(path.join(root, "catalog/channel.server-connected-review.json"), "utf8"));
  const state = JSON.parse(fs.readFileSync(path.join(root, "admin/published/catalog-store/state.json"), "utf8"));
  const active = state.channels.v2.history.find((entry) => entry.releaseId === state.channels.v2.activeReleaseId);
  const envelope = JSON.parse(fs.readFileSync(path.join(root, "admin/published/catalog-store/releases", active.fileName), "utf8"));
  assert.equal(readCatalogClientChannel(current, { kind: "catalog" }).trustedKeys[0].keyId, active.keyId);
  assert.equal(verifySignedEnvelope(envelope, { kind: "catalog", trustedKeys: current.trustedKeys }).catalogVersion, 7);
  assert.throws(() => verifySignedEnvelope(envelope, { kind: "catalog", trustedKeys: retiredChannel.trustedKeys }), /CATALOG_KEY_RETIRED/);
});

test("admin signing loader rejects retired public metadata before any private operation", () => {
  const { loadSigningKey } = require("../admin/signing-key.cjs");
  const { RETIRED_CATALOG_KEY_ID } = require("../shared/catalog-key-retirement.cjs");
  const transition = JSON.parse(fs.readFileSync(path.join(root, "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-0.1.82-transition.json"), "utf8"));
  const retiredMetadata = transition.trustedKeys.find((entry) => entry.keyId === RETIRED_CATALOG_KEY_ID);
  const counts = { open: 0, read: 0, hash: 0, parse: 0, getter: 0 };
  const env = {};
  Object.defineProperty(env, "AIHUB_CATALOG_SIGNING_PRIVATE_KEY", {
    get() {
      counts.getter += 1;
      return "must-not-be-observed";
    }
  });
  assert.throws(() => loadSigningKey({
    dataDirectory: path.join(root, "admin/data"),
    env,
    keyMetadata: retiredMetadata,
    openPrivateKey() {
      counts.open += 1;
      return "private";
    },
    readPrivateKey() {
      counts.read += 1;
      return "private";
    },
    hashPrivateKey() {
      counts.hash += 1;
      return "private";
    },
    parsePrivateKey() {
      counts.parse += 1;
      return "private";
    }
  }), /CATALOG_KEY_RETIRED/);
  assert.deepEqual(counts, { open: 0, read: 0, hash: 0, parse: 0, getter: 0 });
});

test("release bundle rejects retired catalog metadata before touching private material", () => {
  const { prepareReleaseBundle } = require("../admin/release-bundle.cjs");
  const { RETIRED_CATALOG_KEY_ID } = require("../shared/catalog-key-retirement.cjs");
  let privateReads = 0;
  const catalog = { keyId: RETIRED_CATALOG_KEY_ID, source: "environment" };
  Object.defineProperty(catalog, "privateKey", {
    get() {
      privateReads += 1;
      return "must-not-be-read";
    }
  });
  assert.throws(() => prepareReleaseBundle({
    outputDirectory: "invalid",
    installerPath: "invalid",
    signingKeys: { catalog, update: { source: "environment" } }
  }), /CATALOG_KEY_RETIRED/);
  assert.equal(privateReads, 0);
});

test("package and publish validators reject the retired key", async (t) => {
  const { createReleaseStore } = require("../admin/release-store.cjs");
  const { assertReleasePackageReady } = require("../shared/release-package-policy.cjs");
  const { RETIRED_CATALOG_KEY_ID } = require("../shared/catalog-key-retirement.cjs");
  const channel = JSON.parse(fs.readFileSync(path.join(root, "output/catalog-key-rotation-20260812-candidate/public/catalog-channel-0.1.82-transition.json"), "utf8"));
  assert.throws(
    () => assertReleasePackageReady({
      variant: "server-connected-review",
      catalogChannel: channel,
      updateChannel: JSON.parse(fs.readFileSync(path.join(root, "updates/channel.server-connected-review.json"), "utf8")),
      clientServices: { schemaVersion: 1, identityOrigin: "https://identity.zhenxingai.com", communityOrigin: "https://community.zhenxingai.com" },
      catalogReleaseStoreDirectory: path.join(root, "admin/published/catalog-store")
    }),
    /CATALOG_KEY_RETIRED/
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-retired-publish-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let privateReads = 0;
  const store = createReleaseStore({
    rootDirectory: directory,
    signingKeyProvider: async () => ({
      keyId: RETIRED_CATALOG_KEY_ID,
      get privateKey() {
        privateReads += 1;
        return "must-not-be-read";
      }
    })
  });
  await store.saveDraft({ catalog: JSON.parse(fs.readFileSync(path.join(root, "admin/data/catalog-v1.json"), "utf8")), expectedRevision: 0 });
  await assert.rejects(
    store.publish({ channel: "v2", expectedDraftRevision: 1, expectedActiveCatalogVersion: 0, notes: "denied" }),
    /CATALOG_KEY_RETIRED/
  );
  assert.equal(privateReads, 0);
  assert.equal(fs.existsSync(path.join(directory, "releases")), false);
});

test("public evidence collector rejects protected and unknown inputs before reading", (t) => {
  const { createPublicEvidenceCollector } = require("../scripts/lib/catalog-public-evidence.cjs");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-public-evidence-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "public"));
  fs.mkdirSync(path.join(directory, "PrIvAtE", "nested"), { recursive: true });
  fs.mkdirSync(path.join(directory, "secret"));
  fs.mkdirSync(path.join(directory, "secrets"));
  fs.mkdirSync(path.join(directory, "protected"));
  fs.writeFileSync(path.join(directory, "public", "report.json"), "public\n");
  fs.writeFileSync(path.join(directory, "PrIvAtE", "nested", "sentinel.JSON"), "secret\n");
  for (const extension of ["pem", "KEY", "p12", "PfX", "jwk", "ENV"]) {
    fs.writeFileSync(path.join(directory, "public", `secret.${extension}`), "secret\n");
  }
  fs.writeFileSync(path.join(directory, "public", "unknown.json"), "unknown\n");
  fs.mkdirSync(path.join(directory, "linked-real"));
  fs.writeFileSync(path.join(directory, "linked-real", "report.json"), "linked\n");
  fs.symlinkSync(path.join(directory, "linked-real"), path.join(directory, "linked"), "junction");
  let readCount = 0;
  const collector = createPublicEvidenceCollector({
    rootDirectory: directory,
    allowedPaths: ["public/report.json", "public", "linked/report.json"],
    readFile(file) {
      readCount += 1;
      return fs.readFileSync(file);
    }
  });
  assert.equal(collector.read("public/report.json").toString(), "public\n");
  assert.equal(readCount, 1);
  for (const candidate of [".", path.join(directory, "public/report.json"), "PrIvAtE/nested/sentinel.JSON", "secret/value.json", "secrets/value.json", "protected/value.json", "public/secret.pem", "public/secret.KEY", "public/secret.p12", "public/secret.PfX", "public/secret.jwk", "public/secret.ENV", "public/unknown.json", "public", "linked/report.json", "public/../PrIvAtE/nested/sentinel.JSON", "../outside.json"]) {
    assert.throws(() => collector.read(candidate), /EVIDENCE_(?:PATH|ALLOWLIST|FILE)_/);
  }
  assert.equal(readCount, 1);
});

test("retirement evidence validator binds exact public records without private-derived fields", () => {
  const { validateCatalogKeyRetirementEvidence } = require("../shared/catalog-key-retirement.cjs");
  const evidence = validateCatalogKeyRetirementEvidence(retiredPublicEvidence());
  assert.equal(evidence.retiredSha256, RETIRED_SHA256);
  assert.equal(evidence.protectedContentReadCount, 0);
  assert.equal(evidence.retired.keyId, evidence.denylist.keyId);
  assert.throws(() => validateCatalogKeyRetirementEvidence({
    ...retiredPublicEvidence(),
    denylistBytes: Buffer.from(`${JSON.stringify({ ...JSON.parse(retiredPublicEvidence().denylistBytes), unknown: true })}\n`)
  }), /CATALOG_KEY_RETIREMENT_EVIDENCE_INVALID/);
  assert.throws(() => validateCatalogKeyRetirementEvidence({
    ...retiredPublicEvidence(),
    retiredBytes: Buffer.from(`${JSON.stringify({ ...JSON.parse(retiredPublicEvidence().retiredBytes), privateKeyDigest: "a".repeat(64) })}\n`)
  }), /CATALOG_KEY_RETIREMENT_EVIDENCE_INVALID/);
  assert.throws(() => validateCatalogKeyRetirementEvidence({
    ...retiredPublicEvidence(),
    protectedContentReadCount: 1
  }), /CATALOG_KEY_RETIREMENT_EVIDENCE_INVALID/);
});

test("retirement public evidence is exact and excludes private digest or path", () => {
  const publicDirectory = path.join(root, "output/catalog-key-rotation-20260812-candidate/public");
  const retired = JSON.parse(fs.readFileSync(path.join(publicDirectory, "RETIRED.json"), "utf8"));
  const denylist = JSON.parse(fs.readFileSync(path.join(publicDirectory, "KEY-DENYLIST.json"), "utf8"));
  assert.equal(retired.status, "permanently-denied");
  assert.equal(retired.retirementClass, "RETIRED_BEFORE_USE");
  assert.equal(retired.reasonClass, "PRIVATE_READ_BOUNDARY_VIOLATION");
  assert.deepEqual(denylist.deniedOperations, ["trust", "sign", "package", "publish", "upload", "deploy", "state-write"]);
  assert.equal(denylist.obsoletePublicCandidates.length, 2);
  const publicText = `${JSON.stringify(retired)}${JSON.stringify(denylist)}`;
  assert.doesNotMatch(publicText, /private(?:Key)?(?:Path|Sha|Digest)|catalog-signing-private|\\private\\|\/private\//i);
  assert.equal(fs.existsSync(path.join(root, "output/catalog-key-rotation-20260812-candidate/private")), false);
});
