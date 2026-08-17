"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const config = require("../electron-builder.server-connected-review.cjs");
const { assertReleasePackageReady } = require("../shared/release-package-policy.cjs");
const { createArtifactBuildMetadata, inspectGitReleaseSource, sha256File } = require("../shared/release-provenance.cjs");
const { formatLocalReleaseChecksums } = require("../shared/local-release-artifacts.cjs");
const { compileInnoSetup } = require("./lib/inno-setup.cjs");
const {
  assertRendererDistAsar,
  assertRendererDistDirectory,
  clearRendererDistBundles
} = require("./lib/renderer-dist-closure.cjs");

const root = path.resolve(__dirname, "..");
const version = process.env.AIHUB_SERVER_CONNECTED_REVIEW_VERSION || "0.1.100";
if (!/^(?:0|[1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("AIHUB_SERVER_CONNECTED_REVIEW_VERSION must be semantic");
}
const output = path.join(root, `release-review-server-connected-${version}-candidate`);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-server-review-"));

function resource(destination) {
  const entry = config.extraResources.find((item) => item.to === destination);
  if (!entry) throw new Error(`Review package resource is missing: ${destination}`);
  return JSON.parse(fs.readFileSync(path.resolve(root, entry.from), "utf8"));
}

function run(cliName, args) {
  const npmEntry = process.env.npm_execpath;
  if (!npmEntry || !path.isAbsolute(npmEntry)) throw new Error("Review packaging must be started through npm.");
  const cliEntry = path.join(path.dirname(npmEntry), cliName === "npx" ? "npx-cli.js" : "npm-cli.js");
  const result = spawnSync(process.execPath, [cliEntry, ...args], { cwd: root, env: process.env, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cliName} exited with ${result.status}`);
}

function runAcceptanceHelperTests() {
  const result = spawnSync(process.execPath, ["--test", path.join(root, "tests", "packaged-client-acceptance.test.cjs")], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Packaged acceptance helper tests exited with ${result.status}`);
}

function runNodeScript(relativePath) {
  const result = spawnSync(process.execPath, [path.join(root, relativePath)], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${relativePath} exited with ${result.status}`);
}

async function main() {
  if (fs.existsSync(output)) throw new Error(`Review output already exists: ${output}`);
  assertReleasePackageReady({
    variant: "server-connected-review",
    catalogChannel: resource("catalog/channel.json"),
    updateChannel: resource("updates/channel.json"),
    clientServices: config.extraMetadata.clientServices,
    catalogReleaseStoreDirectory: path.join(root, "admin", "published", "catalog-store")
  });
  runAcceptanceHelperTests();
  const { claimServerConnectedReviewInvocation } = await import("./lib/server-connected-review-receipt.mjs");
  fs.mkdirSync(output);
  const packageControlName = "PACKAGE-CONTROL.json";
  claimServerConnectedReviewInvocation({
    directory: output,
    kind: "package",
    version,
    artifactSha256: null
  });
  clearRendererDistBundles(path.join(root, "dist"));
  run("npm", ["run", "build"]);
  assertRendererDistDirectory(path.join(root, "dist"));
  runNodeScript("scripts/generate-inno-brand-assets.cjs");
  run("npx", ["electron-builder", "--config", "electron-builder.server-connected-review.cjs", "--win", "portable", `--config.extraMetadata.version=${version}`, `--config.directories.output=${temporary}`]);
  const setupBaseName = `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Setup`;
  compileInnoSetup({
    root,
    appVersion: version,
    sourceDir: path.join(temporary, "win-unpacked"),
    outputDir: temporary,
    outputBaseFilename: setupBaseName
  });
  const artifacts = fs.readdirSync(temporary).filter((name) => /Windows-x64-(?:Portable|Setup)\.exe$/i.test(name));
  if (artifacts.length !== 2 || !artifacts.some((name) => /-Portable\.exe$/i.test(name)) || !artifacts.some((name) => /-Setup\.exe$/i.test(name))) throw new Error("Server-connected review requires the exact Inno Setup and Portable artifact pair");
  const portable = artifacts.find((name) => /-Portable\.exe$/i.test(name));
  const appAsar = path.join(temporary, "win-unpacked", "resources", "app.asar");
  const catalogChannel = path.join(temporary, "win-unpacked", "resources", "catalog", "channel.json");
  const updateChannel = path.join(temporary, "win-unpacked", "resources", "updates", "channel.json");
  if (!fs.existsSync(appAsar) || !fs.statSync(appAsar).isFile()) throw new Error("Server-connected review app.asar closure is missing");
  if (![catalogChannel, updateChannel].every((file) => fs.existsSync(file) && fs.statSync(file).isFile())) throw new Error("Server-connected review channel closure is missing");
  assertRendererDistAsar(appAsar);
  const packageAsarSha256 = sha256File(appAsar);
  const packageCatalogChannelSha256 = sha256File(catalogChannel);
  const packageUpdateChannelSha256 = sha256File(updateChannel);
  const gate = spawnSync(process.execPath, [path.join(__dirname, "check-packaged-catalog.mjs"), path.join(temporary, portable), packageAsarSha256, packageCatalogChannelSha256, packageUpdateChannelSha256], { cwd: root, env: process.env, stdio: "inherit", shell: false });
  if (gate.error) throw gate.error;
  if (gate.status !== 0) throw new Error(`Packaged catalog gate exited with ${gate.status}`);
  for (const name of artifacts) fs.copyFileSync(path.join(temporary, name), path.join(output, name));
  const metadataName = `ZhenXing-AI-Server-Connected-Review-${version}-BUILD.json`;
  const metadata = {
    ...createArtifactBuildMetadata({ version, source: inspectGitReleaseSource({ root, version }), artifactPaths: artifacts.map((name) => path.join(output, name)) }),
    packageInvocationCount: 1,
    packageAsarSha256,
    packageCatalogChannelSha256,
    packageUpdateChannelSha256
  };
  fs.writeFileSync(path.join(output, metadataName), `${JSON.stringify(metadata, null, 2)}\n`);
  const checksumName = `ZhenXing-AI-Server-Connected-Review-${version}-SHA256.txt`;
  const checksumFiles = [...artifacts, packageControlName, metadataName];
  fs.writeFileSync(path.join(output, checksumName), formatLocalReleaseChecksums(checksumFiles.map((name) => ({ name, sha256: sha256File(path.join(output, name)) }))));
  console.log(JSON.stringify({ ok: true, reviewOnly: true, serverConnected: true, updatesDisabled: true, output, artifacts: [...checksumFiles, checksumName] }, null, 2));
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Server-connected review packaging failed"}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
  });
