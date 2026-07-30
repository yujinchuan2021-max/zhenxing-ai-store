"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const upgradeFixture = process.argv.slice(2).includes("--upgrade-fixture");
if (
  process.argv
    .slice(2)
    .some((argument) => argument !== "--upgrade-fixture")
) {
  throw new Error("Unknown Windows packaging option");
}
const temporaryOutput = fs.mkdtempSync(
  path.join(os.tmpdir(), "aihub-windows-package-")
);
const artifactOutput = path.join(
  root,
  upgradeFixture ? "release-upgrade-0.1.1" : "release"
);

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
  const builderArgs = [
    "electron-builder",
    "--win",
    ...(upgradeFixture ? ["nsis"] : ["portable", "nsis"]),
    ...(upgradeFixture
      ? ["--config.extraMetadata.version=0.1.1"]
      : []),
    `--config.directories.output=${temporaryOutput}`
  ];
  run("npx.cmd", builderArgs);

  fs.mkdirSync(artifactOutput, { recursive: true });
  const artifacts = fs
    .readdirSync(temporaryOutput, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".exe") ||
          entry.name.endsWith(".blockmap") ||
          entry.name.endsWith(".yml"))
    );
  if (!artifacts.some((entry) => /-Setup\.exe$/i.test(entry.name))) {
    throw new Error("Windows Setup package was not generated");
  }
  if (
    !upgradeFixture &&
    !artifacts.some((entry) => /-Portable\.exe$/i.test(entry.name))
  ) {
    throw new Error("Windows Portable package was not generated");
  }
  for (const artifact of artifacts) {
    fs.copyFileSync(
      path.join(temporaryOutput, artifact.name),
      path.join(artifactOutput, artifact.name)
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        upgradeFixture,
        artifactOutput,
        artifacts: artifacts.map((entry) => entry.name)
      },
      null,
      2
    )}\n`
  );
} finally {
  fs.rmSync(temporaryOutput, { recursive: true, force: true });
}
