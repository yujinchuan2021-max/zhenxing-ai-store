"use strict";

const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  SERVICE_NAMES,
  assertRequiredSourceFiles,
  containerPathForSource,
  sourcePathsForService
} = require("../shared/local-service-release-policy.cjs");

const root = path.resolve(__dirname, "..");
const composePath = path.join(root, "deployment", "local", "compose.yaml");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function walk(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeRoot.replace(/\\/g, "/"), entry.name);
    if (entry.isDirectory()) {
      if (relativePath === "identity/node_modules") continue;
      files.push(...walk(relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function currentSourceFiles() {
  return [
    ...walk("admin"),
    ...walk("shared"),
    ...walk("identity"),
    ...walk("community/flarum"),
    "scripts/discover-official-products.mjs"
  ];
}

function requestedServices(args) {
  if (!args.length) return [...SERVICE_NAMES];
  if (args.length !== 2 || args[0] !== "--service" || !SERVICE_NAMES.includes(args[1])) {
    throw new Error("Usage: verify-live-local-service-source.cjs [--service <name>]");
  }
  return [args[1]];
}

function runningContainer(service) {
  const output = String(
    execFileSync(
      "docker",
      [
        "compose",
        "-f",
        composePath,
        "ps",
        "--status",
        "running",
        "-q",
        service
      ],
      { cwd: root, encoding: "utf8", windowsHide: true }
    )
  ).trim();
  if (!/^[a-f0-9]{64}$/.test(output)) {
    throw new Error(`Local service is not running: ${service}`);
  }
  return output;
}

function containerHashes(containerId, entries) {
  const hashes = new Map();
  for (let offset = 0; offset < entries.length; offset += 32) {
    const chunk = entries.slice(offset, offset + 32);
    const output = String(
      execFileSync(
        "docker",
        ["exec", containerId, "sha256sum", ...chunk.map((entry) => entry.containerPath)],
        { cwd: root, encoding: "utf8", windowsHide: true }
      )
    );
    for (const line of output.split(/\r?\n/).filter(Boolean)) {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
      if (!match || hashes.has(match[2])) {
        throw new Error("Local service returned an invalid source hash set");
      }
      hashes.set(match[2], match[1]);
    }
  }
  return hashes;
}

function verifyService(service, availableFiles) {
  const sourcePaths = sourcePathsForService(service, availableFiles);
  assertRequiredSourceFiles(service, sourcePaths);
  const expected = sourcePaths.map((sourcePath) => ({
    sourcePath,
    containerPath: containerPathForSource(service, sourcePath),
    sha256: sha256(fs.readFileSync(path.join(root, sourcePath)))
  }));
  const containerId = runningContainer(service);
  let actual;
  try {
    actual = containerHashes(containerId, expected);
  } catch (error) {
    const detail = String(error?.stderr || error?.message || "").trim().split(/\r?\n/)[0];
    throw new Error(
      `Running local service source drift detected: ${service}` +
        (detail ? ` (${detail})` : "")
    );
  }
  const mismatches = expected.filter(
    (entry) => actual.get(entry.containerPath) !== entry.sha256
  );
  if (actual.size !== expected.length || mismatches.length) {
    const examples = mismatches
      .slice(0, 6)
      .map((entry) => entry.sourcePath)
      .join(", ");
    throw new Error(
      `Running local service source drift detected: ${service}` +
        (examples ? ` (${examples})` : "")
    );
  }
  return { service, containerId, files: expected.length };
}

const availableFiles = currentSourceFiles();
const services = requestedServices(process.argv.slice(2)).map((service) =>
  verifyService(service, availableFiles)
);
process.stdout.write(`${JSON.stringify({ ok: true, services })}\n`);
