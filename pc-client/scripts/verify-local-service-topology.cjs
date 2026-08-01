"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  assertLocalServiceTopology
} = require("../shared/local-service-topology.cjs");

const root = path.resolve(__dirname, "..");
const composePath = path.join(root, "deployment", "local", "compose.yaml");
const result = spawnSync(
  "docker",
  ["compose", "-f", composePath, "config", "--format", "json"],
  {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  }
);
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    `Unable to resolve local Docker service topology: ${String(
      result.stderr || result.stdout || "unknown error"
    ).trim()}`
  );
}

const verified = assertLocalServiceTopology(JSON.parse(result.stdout));
process.stdout.write(`${JSON.stringify({ ok: true, ...verified })}\n`);
