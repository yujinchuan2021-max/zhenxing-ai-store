"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertCandidateImageInspection,
  assertLocalServiceRuntimeContracts,
  assertPreviousRuntimeContracts,
  createLocalServiceReleaseManifest,
  validateLocalServiceReleaseManifest
} = require("../shared/local-service-release-policy.cjs");
const {
  inspectGitReleaseSource
} = require("../shared/release-provenance.cjs");

const root = path.resolve(__dirname, "..");

function parseOptions(args) {
  if (!args.length) throw new Error("Local service release policy command is required");
  const command = args[0];
  const options = {};
  for (let index = 1; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!/^--[a-z-]+$/.test(name || "") || value === undefined || options[name]) {
      throw new Error("Local service release policy arguments are invalid");
    }
    options[name] = value;
  }
  return { command, options };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: options.encoding === null ? null : "utf8",
    windowsHide: true,
    shell: false,
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} failed: ${String(result.stderr || result.stdout || "unknown error").trim()}`
    );
  }
  return result.stdout;
}

function expectedSource(options) {
  const revision = String(options["--expected-revision"] || "").toLowerCase();
  const version = String(options["--expected-version"] || "");
  const packageVersion = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ).version;
  if (version !== packageVersion) {
    throw new Error("Local service release version differs from package.json");
  }
  const source = inspectGitReleaseSource({
    root,
    version,
    requireClean: true,
    requireVersionTag: true
  });
  if (source.revision !== revision) {
    throw new Error("Local service release revision changed after packaging");
  }
  return { revision, version, source };
}

function repositoryLayout() {
  const repositoryRoot = String(
    run("git", ["rev-parse", "--show-toplevel"])
  ).trim();
  const prefix = path
    .relative(repositoryRoot, root)
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!prefix || prefix.split("/").some((segment) => segment === "..")) {
    throw new Error("Local service release repository layout is invalid");
  }
  return { repositoryRoot, prefix };
}

function revisionFileReader({ repositoryRoot, prefix, revision }) {
  const pathspecs = [
    `${prefix}/admin`,
    `${prefix}/shared`,
    `${prefix}/identity`,
    `${prefix}/community/flarum`,
    `${prefix}/scripts/discover-official-products.mjs`
  ];
  const listed = String(
    run("git", ["ls-tree", "-r", "--name-only", revision, "--", ...pathspecs], {
      cwd: repositoryRoot
    })
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const prefixWithSlash = `${prefix}/`;
  if (listed.some((entry) => !entry.startsWith(prefixWithSlash))) {
    throw new Error("Git source listing escaped the PC client");
  }
  const revisionFiles = listed.map((entry) => entry.slice(prefixWithSlash.length));
  return {
    revisionFiles,
    readRevisionFile(relativePath) {
      const repositoryPath = `${prefixWithSlash}${relativePath}`;
      return run("git", ["show", `${revision}:${repositoryPath}`], {
        cwd: repositoryRoot,
        encoding: null
      });
    }
  };
}

function resolvedCompose() {
  const composePath = path.join(root, "deployment", "local", "compose.yaml");
  return JSON.parse(
    String(
      run("docker", ["compose", "-f", composePath, "config", "--format", "json"])
    )
  );
}

function createManifest(options) {
  const { revision, version } = expectedSource(options);
  const layout = repositoryLayout();
  const reader = revisionFileReader({ ...layout, revision });
  assertLocalServiceRuntimeContracts(resolvedCompose());
  return createLocalServiceReleaseManifest({
    revision,
    version,
    revisionFiles: reader.revisionFiles,
    readRevisionFile: reader.readRevisionFile
  });
}

function trustedJsonFile(filePath) {
  if (!path.isAbsolute(filePath || "")) {
    throw new Error("Local service release JSON path must be absolute");
  }
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 4 * 1024 * 1024) {
    throw new Error("Local service release JSON file is not trusted");
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonExclusive(filePath, value) {
  if (!path.isAbsolute(filePath || "") || fs.existsSync(filePath)) {
    throw new Error("Local service release output path is invalid");
  }
  const parent = path.dirname(filePath);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("Local service release output parent is not trusted");
  }
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
}

const { command, options } = parseOptions(process.argv.slice(2));
if (command === "preflight") {
  const manifest = createManifest(options);
  process.stdout.write(
    `${JSON.stringify({ ok: true, revision: manifest.revision, version: manifest.version })}\n`
  );
} else if (command === "manifest") {
  const output = path.resolve(String(options["--output"] || ""));
  const manifest = createManifest(options);
  writeJsonExclusive(output, manifest);
  process.stdout.write(
    `${JSON.stringify({ ok: true, output, services: manifest.services.map((entry) => entry.service) })}\n`
  );
} else if (command === "verify-candidate") {
  const manifest = validateLocalServiceReleaseManifest(
    trustedJsonFile(path.resolve(String(options["--manifest"] || "")))
  );
  const inspection = trustedJsonFile(
    path.resolve(String(options["--inspection"] || ""))
  );
  const verified = assertCandidateImageInspection({ manifest, inspection });
  process.stdout.write(`${JSON.stringify({ ok: true, ...verified })}\n`);
} else if (command === "verify-previous-contracts") {
  const entries = trustedJsonFile(
    path.resolve(String(options["--input"] || ""))
  );
  const verified = assertPreviousRuntimeContracts(entries);
  process.stdout.write(`${JSON.stringify({ ok: true, contracts: verified })}\n`);
} else {
  throw new Error("Unknown local service release policy command");
}
