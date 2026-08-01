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
  activatePreparedLocalReleaseDelivery,
  activatePreparedLocalReleaseDeliveryTransaction,
  localReleaseDeliveryNames,
  prepareLocalReleaseDeliveryTransaction
} = require("../shared/local-release-delivery.cjs");
const {
  localReleaseCommandResult
} = require("../shared/local-release-command-result.cjs");
const {
  createArtifactBuildMetadata,
  inspectGitReleaseSource,
  sha256File
} = require("../shared/release-provenance.cjs");
const {
  validateLocalReleaseTrust
} = require("../shared/local-release-trust.cjs");

const root = path.resolve(__dirname, "..");
function parseOptions(args) {
  if (args.length === 0) return { transactionReceiptPath: null };
  if (
    args.length !== 2 ||
    args[0] !== "--transaction-receipt" ||
    !path.isAbsolute(args[1])
  ) {
    throw new Error(
      "Usage: package-local-release.cjs [--transaction-receipt <absolute-path>]"
    );
  }
  return { transactionReceiptPath: path.resolve(args[1]) };
}

const options = parseOptions(process.argv.slice(2));
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
).version;
const temporaryOutput = fs.mkdtempSync(
  path.join(os.tmpdir(), "aihub-local-package-")
);
const artifactOutput = path.join(root, "release-local-server-client");
let candidateOutput = null;
let transactionReceiptCreated = false;
let deliveryRecoveryPending = false;

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

const releaseSource = inspectGitReleaseSource({
  root,
  version: packageVersion,
  requireClean: true,
  requireVersionTag: true
});

function assertReleaseSourceUnchanged() {
  const current = inspectGitReleaseSource({
    root,
    version: packageVersion,
    requireClean: true,
    requireVersionTag: true
  });
  if (JSON.stringify(current) !== JSON.stringify(releaseSource)) {
    throw new Error("Local release source changed while artifacts were being built");
  }
}

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
  assertReleaseSourceUnchanged();
  run("npm.cmd", ["run", "build"]);
  assertReleaseSourceUnchanged();
  run("npx.cmd", [
    "electron-builder",
    "--config",
    "electron-builder.local-release.cjs",
    "--win",
    "portable",
    "nsis",
    `--config.directories.output=${temporaryOutput}`
  ]);
  assertReleaseSourceUnchanged();

  const artifacts = fs
    .readdirSync(temporaryOutput, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".exe") ||
          entry.name.endsWith(".blockmap"))
    );
  const deliveryNames = localReleaseDeliveryNames(packageVersion);
  const artifactNames = artifacts.map((entry) => entry.name).sort();
  if (
    artifactNames.length !== deliveryNames.artifacts.length ||
    !deliveryNames.artifacts.every((name) => artifactNames.includes(name))
  ) {
    throw new Error(
      "Local acceptance packaging did not generate the exact Setup, Portable and Setup blockmap set"
    );
  }
  candidateOutput = fs.mkdtempSync(
    path.join(root, "release-local-server-client-candidate-")
  );
  for (const artifact of artifacts) {
    fs.copyFileSync(
      path.join(temporaryOutput, artifact.name),
      path.join(candidateOutput, artifact.name)
    );
  }
  const packagedArtifactPaths = deliveryNames.artifacts.map((name) =>
    path.join(candidateOutput, name)
  );
  const buildMetadata = createArtifactBuildMetadata({
    version: packageVersion,
    source: releaseSource,
    artifactPaths: packagedArtifactPaths
  });
  const buildMetadataName = `AI-Hub-Local-${packageVersion}-BUILD.json`;
  fs.writeFileSync(
    path.join(candidateOutput, buildMetadataName),
    `${JSON.stringify(buildMetadata, null, 2)}\n`,
    "utf8"
  );
  const checksumNames = [...deliveryNames.artifacts, buildMetadataName];
  const checksumEntries = checksumNames.map((name) => {
    const filePath = path.join(candidateOutput, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local release checksum input is missing: ${name}`);
    }
    return {
      name,
      sha256: sha256File(filePath)
    };
  });
  const checksumName = `AI-Hub-Local-${packageVersion}-SHA256.txt`;
  fs.writeFileSync(
    path.join(candidateOutput, checksumName),
    formatLocalReleaseChecksums(checksumEntries),
    "utf8"
  );
  if (fs.existsSync(artifactOutput)) {
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(root, "scripts", "stop-local-release-acceptance-clients.ps1"),
      "-DeliveryDirectory",
      artifactOutput
    ]);
  }
  let activation;
  if (options.transactionReceiptPath) {
    prepareLocalReleaseDeliveryTransaction({
      candidateDirectory: candidateOutput,
      deliveryDirectory: artifactOutput,
      receiptPath: options.transactionReceiptPath,
      version: packageVersion
    });
    transactionReceiptCreated = true;
    activation = activatePreparedLocalReleaseDeliveryTransaction({
      candidateDirectory: candidateOutput,
      deliveryDirectory: artifactOutput,
      receiptPath: options.transactionReceiptPath
    });
  } else {
    activation = activatePreparedLocalReleaseDelivery({
      candidateDirectory: candidateOutput,
      deliveryDirectory: artifactOutput,
      version: packageVersion
    });
  }
  const commandResult = localReleaseCommandResult({
    activated: activation.activated,
    artifactOutput,
    artifacts: [
      ...deliveryNames.artifacts,
      buildMetadataName,
      checksumName
    ].sort(),
    transactionPending: Boolean(options.transactionReceiptPath),
    transactionReceiptPath: options.transactionReceiptPath,
    removedPreviousDeliveryFiles: activation.replacedFiles || [],
    cleanupPending: activation.cleanupPending,
    cleanupErrorCode: activation.cleanupErrorCode,
    retiredDirectory: activation.retiredDirectory
  });
  process.stdout.write(
    `${JSON.stringify(commandResult, null, 2)}\n`
  );
  if (!commandResult.ok) process.exitCode = 2;
} catch (error) {
  deliveryRecoveryPending = error?.deliveryRecoveryPending === true;
  throw error;
} finally {
  fs.rmSync(temporaryOutput, { recursive: true, force: true });
  if (
    candidateOutput &&
    fs.existsSync(candidateOutput) &&
    !transactionReceiptCreated &&
    !deliveryRecoveryPending
  ) {
    fs.rmSync(candidateOutput, { recursive: true, force: true });
  }
}
