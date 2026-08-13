"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const baselineState = path.join(
  root,
  "output",
  "admin-only-deploy-54f084a49b745882146ced2def8f70c3eb44dd47e03d6a308e9ab5daef879616",
  "stage",
  "runtime",
  "admin",
  "published",
  "catalog-store",
  "state.json"
);
const targetState = path.join(root, "admin", "published", "catalog-store", "state.json");
const active6 = path.join(root, "admin", "published", "catalog-store", "releases", "catalog-v00000006-567e671621f1-3dcee587.json");
const active7 = path.join(root, "admin", "published", "catalog-store", "releases", "catalog-v00000007-8c49e1972186-0cec5335.json");
const manifestPath = path.join(root, "deployment", "community-production", "catalog-active7-state-activation-manifest.json");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-active7-state-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const published = path.join(temporary, "published", "catalog-store");
  const artifacts = path.join(temporary, "artifacts");
  fs.mkdirSync(path.join(published, "releases"), { recursive: true });
  fs.mkdirSync(artifacts);
  fs.copyFileSync(baselineState, path.join(published, "state.json"));
  fs.copyFileSync(active6, path.join(published, "releases", path.basename(active6)));
  fs.copyFileSync(targetState, path.join(artifacts, "catalog-active7-state.json"));
  fs.copyFileSync(active7, path.join(artifacts, "catalog-active7-release.json"));
  return { temporary, published, artifacts };
}

test("fixed active6 state activates exact active7 and retains the verified baseline backup", async (t) => {
  const { published, artifacts, temporary } = fixture(t);
  const { activateCatalogState } = require("../deployment/community-production/catalog-active7-state-activation.cjs");

  const result = await activateCatalogState({
    publishedDirectory: published,
    artifactDirectory: artifacts,
    backupDirectory: path.join(temporary, "backup"),
    evidenceDirectory: path.join(temporary, "evidence"),
    manifestPath
  });

  assert.equal(result.activeReleaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(sha256(path.join(published, "state.json")), "cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012");
  assert.equal(sha256(path.join(temporary, "backup", "state.json")), "abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9");
  assert.equal(sha256(path.join(published, "releases", path.basename(active6))), "c1ea9b76d1e134be1e565cf5018a77013a2387fe59452f3ebdc1f0e96f49e139");
  assert.equal(sha256(path.join(published, "releases", path.basename(active7))), "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4");
});

test("a later activation failure restores exact active6 and verifies its signed release", async (t) => {
  const { published, artifacts, temporary } = fixture(t);
  const { activateCatalogState, readActiveRelease } = require("../deployment/community-production/catalog-active7-state-activation.cjs");

  await assert.rejects(
    activateCatalogState({
      publishedDirectory: published,
      artifactDirectory: artifacts,
      backupDirectory: path.join(temporary, "backup"),
      evidenceDirectory: path.join(temporary, "evidence"),
      manifestPath,
      afterActivation: () => { throw new Error("simulated later cutover failure"); }
    }),
    /simulated later cutover failure/
  );
  assert.equal(sha256(path.join(published, "state.json")), "abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9");
  assert.equal((await readActiveRelease(published, "v2")).release.releaseId, "catalog-v00000006-567e671621f1-3dcee587");
});

test("a target state with changes outside draft and v2 history is rejected before activation", async (t) => {
  const { published, artifacts, temporary } = fixture(t);
  const { activateCatalogState } = require("../deployment/community-production/catalog-active7-state-activation.cjs");
  const targetPath = path.join(artifacts, "catalog-active7-state.json");
  const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  target.activeCatalogVersion = 73;
  fs.writeFileSync(targetPath, `${JSON.stringify(target, null, 2)}\n`, "utf8");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.target.stateSha256 = sha256(targetPath);
  const alteredManifestPath = path.join(temporary, "activation-manifest.json");
  fs.writeFileSync(alteredManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await assert.rejects(
    activateCatalogState({
      publishedDirectory: published,
      artifactDirectory: artifacts,
      backupDirectory: path.join(temporary, "backup"),
      evidenceDirectory: path.join(temporary, "evidence"),
      manifestPath: alteredManifestPath
    }),
    /deep-equal/
  );
  assert.equal(sha256(path.join(published, "state.json")), "abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9");
});
