"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const temporaryOutput = fs.mkdtempSync(
  path.join(os.tmpdir(), "aihub-local-package-")
);
const artifactOutput = path.join(root, "release-local-server-client");

function run(command, args) {
  const result = spawnSync(command, args, {
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
          entry.name.endsWith(".blockmap") ||
          entry.name.endsWith(".yml"))
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
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
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
