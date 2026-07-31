"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const localReleaseConfig = require("../electron-builder.local-release.cjs");
const {
  assertReleasePackageReady
} = require("../shared/release-package-policy.cjs");
const {
  formatLocalReleaseChecksums,
  supersededLocalReleaseArtifacts
} = require("../shared/local-release-artifacts.cjs");
const {
  createArtifactBuildMetadata,
  inspectGitReleaseSource
} = require("../shared/release-provenance.cjs");
const {
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");

const root = path.resolve(__dirname, "..");
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
).version;
const temporaryOutput = fs.mkdtempSync(
  path.join(os.tmpdir(), "aihub-local-package-")
);
const artifactOutput = path.join(root, "release-local-server-client");

function channelFromResources(destination) {
  const resource = localReleaseConfig.extraResources.find(
    (entry) => entry.to === destination
  );
  if (!resource) throw new Error(`Missing ${destination} package resource`);
  return JSON.parse(fs.readFileSync(path.resolve(resource.from), "utf8"));
}

assertReleasePackageReady({
  variant: "local",
  catalogChannel: channelFromResources("catalog/channel.json"),
  updateChannel: channelFromResources("updates/channel.json")
});
validateLocalReleaseTrust(channelFromResources("local-release-trust.json"));

function resolveCommand(command, args) {
  if (process.platform !== "win32" || !/^(npm|npx)\.cmd$/i.test(command)) {
    return { executable: command, args };
  }

  const npmEntry = process.env.npm_execpath;
  if (!npmEntry || !path.isAbsolute(npmEntry)) {
    throw new Error("Windows packaging requires an absolute npm CLI entry");
  }
  const cliName = /^npx/i.test(command) ? "npx-cli.js" : "npm-cli.js";
  const cliEntry = path.join(path.dirname(npmEntry), cliName);
  if (!fs.existsSync(cliEntry)) {
    throw new Error(`Node package CLI entry not found: ${cliEntry}`);
  }
  return {
    executable: process.execPath,
    args: [cliEntry, ...args]
  };
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.executable, resolved.args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}`);
  }
}

try {
  run("npm.cmd", ["run", "build"]);
  run("npx.cmd", [
    "electron-builder",
    "--config",
    "electron-builder.local-release.cjs",
    "--win",
    "portable",
    "nsis",
    `--config.directories.output=${temporaryOutput}`
  ]);

  fs.mkdirSync(artifactOutput, { recursive: true });
  const artifacts = fs
    .readdirSync(temporaryOutput, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".exe") ||
          entry.name.endsWith(".blockmap"))
    );
  if (!artifacts.some((entry) => /-Setup\.exe$/i.test(entry.name))) {
    throw new Error("本地验收安装包未生成");
  }
  if (!artifacts.some((entry) => /-Portable\.exe$/i.test(entry.name))) {
    throw new Error("本地验收便携包未生成");
  }
  for (const artifact of artifacts) {
    fs.copyFileSync(
      path.join(temporaryOutput, artifact.name),
      path.join(artifactOutput, artifact.name)
    );
  }
  const packagedArtifactPaths = artifacts.map((entry) =>
    path.join(artifactOutput, entry.name)
  );
  const buildMetadata = createArtifactBuildMetadata({
    version: packageVersion,
    source: inspectGitReleaseSource({
      root,
      version: packageVersion
    }),
    artifactPaths: packagedArtifactPaths
  });
  const buildMetadataName = `AI-Hub-Local-${packageVersion}-BUILD.json`;
  fs.writeFileSync(
    path.join(artifactOutput, buildMetadataName),
    `${JSON.stringify(buildMetadata, null, 2)}\n`,
    "utf8"
  );
  const checksumNames = [
    `AI-Hub-Local-${packageVersion}-Windows-x64-Setup.exe`,
    `AI-Hub-Local-${packageVersion}-Windows-x64-Portable.exe`,
    buildMetadataName
  ];
  const checksumEntries = checksumNames.map((name) => {
    const filePath = path.join(artifactOutput, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local release checksum input is missing: ${name}`);
    }
    return {
      name,
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex")
    };
  });
  const checksumName = `AI-Hub-Local-${packageVersion}-SHA256.txt`;
  fs.writeFileSync(
    path.join(artifactOutput, checksumName),
    formatLocalReleaseChecksums(checksumEntries),
    "utf8"
  );
  const superseded = supersededLocalReleaseArtifacts(
    fs.readdirSync(artifactOutput),
    packageVersion
  );
  for (const name of superseded) {
    fs.rmSync(path.join(artifactOutput, name), { force: true });
  }
  for (const name of ["builder-debug.yml", "builder-effective-config.yaml"]) {
    fs.rmSync(path.join(artifactOutput, name), { force: true });
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        artifactOutput,
        artifacts: [
          ...artifacts.map((entry) => entry.name),
          buildMetadataName,
          checksumName
        ],
        removedSupersededArtifacts: superseded
      },
      null,
      2
    )}\n`
  );
} finally {
  fs.rmSync(temporaryOutput, { recursive: true, force: true });
}
