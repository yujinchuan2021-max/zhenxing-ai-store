"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const localReleaseConfig = require("../electron-builder.local-release.cjs");
const {
  assertReleasePackageReady
} = require("../shared/release-package-policy.cjs");
const {
  formatLocalReleaseChecksums
} = require("../shared/local-release-artifacts.cjs");
const {
  localReleaseDeliveryNames
} = require("../shared/local-release-delivery.cjs");
const {
  createArtifactBuildMetadata,
  inspectGitReleaseSource,
  sha256File
} = require("../shared/release-provenance.cjs");
const {
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");

const root = path.resolve(__dirname, "..");
const version = process.env.AIHUB_LOCAL_RELEASE_BASE_VERSION || require("../package.json").version;
const portableOnly = process.argv.slice(2).every((argument) => argument === "--portable-only") &&
  process.argv.slice(2).includes("--portable-only");
if (process.argv.slice(2).length && !portableOnly) {
  throw new Error("Usage: package-review-release.cjs [--portable-only]");
}
const output = path.join(root, `release-review-${version}-${portableOnly ? "candidate" : "complete"}`);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-review-package-"));

function resource(destination) {
  const entry = localReleaseConfig.extraResources.find(
    (candidate) => candidate.to === destination
  );
  if (!entry || !fs.existsSync(path.resolve(entry.from))) {
    throw new Error(`Review package resource is missing: ${destination}`);
  }
  return JSON.parse(fs.readFileSync(path.resolve(entry.from), "utf8"));
}

function runNpm(cliName, args) {
  const npmEntry = process.env.npm_execpath;
  if (!npmEntry || !path.isAbsolute(npmEntry)) {
    throw new Error("Review packaging must be started through npm.");
  }
  const cliEntry = path.join(
    path.dirname(npmEntry),
    cliName === "npx" ? "npx-cli.js" : "npm-cli.js"
  );
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cliName} exited with ${result.status}`);
}

try {
  if (fs.existsSync(output)) {
    throw new Error(`Review output already exists: ${output}`);
  }
  assertReleasePackageReady({
    variant: "local",
    catalogChannel: resource("catalog/channel.json"),
    updateChannel: resource("updates/channel.json"),
    clientServices: localReleaseConfig.extraMetadata.clientServices,
    catalogReleaseStoreDirectory: path.join(root, "admin", "published", "catalog-store")
  });
  validateLocalReleaseTrust(resource("local-release-trust.json"));
  runNpm("npm", ["run", "build"]);
  runNpm("npx", [
    "electron-builder",
    "--config",
    "electron-builder.local-release.cjs",
    "--win",
    ...(portableOnly ? ["portable"] : ["portable", "nsis"]),
    `--config.directories.output=${temporary}`
  ]);

  const names = localReleaseDeliveryNames(version);
  const artifactNames = portableOnly
    ? names.artifacts.filter((name) => name.endsWith("-Portable.exe"))
    : names.artifacts;
  for (const name of artifactNames) {
    if (!fs.existsSync(path.join(temporary, name))) {
      throw new Error(`Review artifact is missing: ${name}`);
    }
  }
  const portableArtifact = path.join(
    temporary,
    artifactNames.find((name) => name.endsWith("-Portable.exe"))
  );
  const gate = spawnSync(process.execPath, [
    path.join(__dirname, "check-packaged-catalog.mjs"),
    portableArtifact
  ], { cwd: root, env: process.env, stdio: "inherit", shell: false });
  if (gate.error) throw gate.error;
  if (gate.status !== 0) throw new Error(`Packaged catalog gate exited with ${gate.status}`);
  fs.mkdirSync(output);
  for (const name of artifactNames) {
    fs.copyFileSync(path.join(temporary, name), path.join(output, name));
  }

  const artifactPaths = artifactNames.map((name) => path.join(output, name));
  const metadataName = `ZhenXing-AI-Local-${version}-BUILD.json`;
  fs.writeFileSync(
    path.join(output, metadataName),
    `${JSON.stringify(
      createArtifactBuildMetadata({
        version,
        source: inspectGitReleaseSource({ root, version }),
        artifactPaths
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  const checksumName = `ZhenXing-AI-Local-${version}-SHA256.txt`;
  const checksumFiles = [...artifactNames, metadataName];
  fs.writeFileSync(
    path.join(output, checksumName),
    formatLocalReleaseChecksums(
      checksumFiles.map((name) => ({
        name,
        sha256: sha256File(path.join(output, name))
      }))
    ),
    "utf8"
  );
  console.log(
    JSON.stringify({
      ok: true,
      reviewOnly: true,
      signed: false,
      output,
      artifacts: [...checksumFiles, checksumName]
    }, null, 2)
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
