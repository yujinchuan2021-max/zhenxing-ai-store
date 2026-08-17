"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const packageJson = require("../package.json");
const serverConnectedReviewConfig = require("../electron-builder.server-connected-review.cjs");
const assertElectronBuilderPackageChannels = require(
  "../scripts/electron-builder-before-pack.cjs"
);
const { assertReleasePackageReady } = require(
  "../shared/release-package-policy.cjs"
);

const root = path.resolve(__dirname, "..");
const packageScript = fs.readFileSync(
  path.join(root, "scripts", "package-server-connected-review.cjs"),
  "utf8"
);

function resource(config, destination) {
  const entry = config.extraResources.find((item) => item.to === destination);
  assert.ok(entry, `missing ${destination}`);
  return JSON.parse(fs.readFileSync(path.resolve(root, entry.from), "utf8"));
}

function context(config) {
  return { packager: { config, projectDir: root } };
}

test("server-connected review embeds fixed online services and v2 catalog without an update endpoint", async () => {
  const catalog = resource(serverConnectedReviewConfig, "catalog/channel.json");
  const update = resource(serverConnectedReviewConfig, "updates/channel.json");

  assert.equal(serverConnectedReviewConfig.extraMetadata.serverConnectedReview, true);
  assert.deepEqual(serverConnectedReviewConfig.extraMetadata.clientServices, {
    schemaVersion: 1,
    identityOrigin: "https://zhenxingai.com",
    communityOrigin: "https://community.zhenxingai.com"
  });
  assert.deepEqual(catalog, {
    schemaVersion: 2,
    kind: "catalog",
    catalogChannel: "v2",
    releaseUrl: "https://zhenxingai.com/channels/v2/catalog-release.json",
    allowedReleaseOrigins: ["https://zhenxingai.com"],
    trustedKeys: JSON.parse(
      fs.readFileSync(path.join(root, "catalog", "channel.json"), "utf8")
    ).trustedKeys
  });
  assert.deepEqual(update, {
    schemaVersion: 2,
    kind: "update",
    releaseUrl: "",
    allowedReleaseOrigins: [],
    trustedKeys: []
  });
  assert.match(
    serverConnectedReviewConfig.portable.artifactName,
    /Server-Connected-Review/
  );
  await assert.doesNotReject(
    assertElectronBuilderPackageChannels(context(serverConnectedReviewConfig))
  );
  assert.throws(
    () =>
      assertReleasePackageReady({
        variant: "server-connected-review",
        catalogChannel: catalog,
        updateChannel: {
          ...update,
          releaseUrl: "https://zhenxingai.com/updates/release.json",
          allowedReleaseOrigins: ["https://zhenxingai.com"],
          trustedKeys: catalog.trustedKeys
        },
        clientServices: serverConnectedReviewConfig.extraMetadata.clientServices,
        catalogReleaseStoreDirectory: path.join(
          root,
          "admin",
          "published",
          "catalog-store"
        )
      }),
    /server-connected review must keep the update channel disabled/
  );
  assert.throws(
    () =>
      assertReleasePackageReady({
        variant: "production",
        catalogChannel: catalog,
        updateChannel: update,
        clientServices: serverConnectedReviewConfig.extraMetadata.clientServices,
        catalogReleaseStoreDirectory: path.join(
          root,
          "admin",
          "published",
          "catalog-store"
        )
      }),
    /更新通道/
  );
  assert.notDeepEqual(
    packageJson.build.extraMetadata.clientServices,
    serverConnectedReviewConfig.extraMetadata.clientServices
  );
});

test("server-connected review carries the repository license notices", () => {
  const destinations = ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES.md"];
  assert.deepEqual(
    serverConnectedReviewConfig.extraResources
      .filter((entry) => destinations.includes(entry.to))
      .map((entry) => entry.to),
    destinations
  );
  for (const destination of destinations) {
    const entry = serverConnectedReviewConfig.extraResources.find((item) => item.to === destination);
    assert.deepEqual(entry, packageJson.build.extraResources.find((item) => item.to === destination));
    assert.equal(fs.statSync(path.resolve(root, entry.from)).isFile(), true);
  }
});

test("Portable launches use installer-owned unique plugin roots instead of one shared unpack directory", () => {
  const nsisTargetSource = fs.readFileSync(
    require.resolve("app-builder-lib/out/targets/nsis/NsisTarget.js"),
    "utf8"
  );
  assert.match(nsisTargetSource, /if \(typeof unpackDirName === "string" \|\| !unpackDirName\) \{\s*defines\.UNPACK_DIR_NAME = unpackDirName \|\| .*generateKsuid/);
  assert.equal(serverConnectedReviewConfig.portable.unpackDirName, true);
});

test("server-connected packaging runs the formal helper gate and claims one receipt before electron-builder", () => {
  assert.equal(
    packageJson.scripts["accept:win:server-connected-review"],
    "node scripts/accept-server-connected-review.mjs"
  );
  const helperGate = packageScript.indexOf("runAcceptanceHelperTests();");
  const receipt = packageScript.indexOf("claimServerConnectedReviewInvocation({");
  const builder = packageScript.indexOf('run("npx", ["electron-builder"');
  assert.ok(helperGate >= 0 && helperGate < receipt && receipt < builder);
  assert.match(packageScript, /PACKAGE-CONTROL\.json/);
  assert.match(packageScript, /packageInvocationCount:\s*1/);
  assert.match(packageScript, /server-connected-review-receipt\.mjs/);
  assert.match(
    packageScript,
    /AIHUB_SERVER_CONNECTED_REVIEW_VERSION \|\| "0\.1\.100"/,
    "the default review build must not silently regress from the current 0.1.100 line"
  );
});

test("package and acceptance callers bind the exact packaged runtime closure to extraction cleanup", () => {
  const catalogGate = fs.readFileSync(path.join(root, "scripts", "check-packaged-catalog.mjs"), "utf8");
  const acceptanceCli = fs.readFileSync(path.join(root, "scripts", "accept-server-connected-review.mjs"), "utf8");
  const acceptanceRunner = fs.readFileSync(path.join(root, "scripts", "lib", "packaged-client-acceptance.mjs"), "utf8");
  assert.match(packageScript, /packageAsarSha256\s*=\s*sha256File/);
  assert.match(packageScript, /packageCatalogChannelSha256\s*=\s*sha256File/);
  assert.match(packageScript, /packageUpdateChannelSha256\s*=\s*sha256File/);
  assert.match(packageScript, /check-packaged-catalog\.mjs"\),\s*path\.join\(temporary, portable\),\s*packageAsarSha256,\s*packageCatalogChannelSha256,\s*packageUpdateChannelSha256/);
  assert.match(catalogGate, /expectedPackageAsarSha256/);
  assert.match(catalogGate, /launchPackagedClientCdp\(\{\s*executable,\s*profile,\s*expectedPackageAsarSha256,\s*expectedCatalogChannelSha256,\s*expectedUpdateChannelSha256\s*\}\)/);
  assert.match(catalogGate, /document\.querySelector\("\.brandMark img"\)/);
  assert.match(catalogGate, /naturalWidth/);
  assert.match(catalogGate, /\.\/brand-icon\.png/);
  assert.match(acceptanceCli, /expectedCatalogChannelSha256/);
  assert.match(acceptanceCli, /expectedUpdateChannelSha256/);
  assert.match(acceptanceRunner, /launchPackagedClientCdp\(\{[\s\S]*expectedCatalogChannelSha256[\s\S]*expectedUpdateChannelSha256/);
});

test("server-connected packaging rejects stale renderer bundles before and after ASAR creation", () => {
  const cleanup = packageScript.indexOf("clearRendererDistBundles(");
  const build = packageScript.indexOf('run("npm", ["run", "build"]);');
  const distGate = packageScript.indexOf("assertRendererDistDirectory(");
  const builder = packageScript.indexOf('run("npx", ["electron-builder"');
  const asarGate = packageScript.indexOf("assertRendererDistAsar(appAsar);");
  assert.ok(cleanup >= 0 && cleanup < build && build < distGate && distGate < builder && builder < asarGate);
});
