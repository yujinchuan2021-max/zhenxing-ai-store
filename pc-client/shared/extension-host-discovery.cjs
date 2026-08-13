"use strict";

const path = require("node:path");
const {
  inferNpmPrefixFromCommandPath
} = require("./cli-system-discovery.cjs");

const LOCAL_WINDOWS_PATH = /^[A-Za-z]:\\/;

const EXTENSION_CLI_HOST_POLICIES = Object.freeze({
  "codex-cli": Object.freeze({
    commandName: "codex",
    expectedSigner: /^CN="?OpenAI OpCo, LLC"?(?:,|$)/i
  }),
  "claude-code": Object.freeze({
    commandName: "claude",
    expectedSigner: /^CN="?Anthropic, PBC"?(?:,|$)/i
  })
});

function architectureMetadata(architecture) {
  if (architecture === "x64") {
    return { packageArchitecture: "x64", targetTriple: "x86_64-pc-windows-msvc" };
  }
  if (architecture === "arm64") {
    return { packageArchitecture: "arm64", targetTriple: "aarch64-pc-windows-msvc" };
  }
  return null;
}

function localExecutablePath(value, executableName) {
  if (typeof value !== "string" || /[\0\r\n]/.test(value)) return "";
  const normalized = path.win32.normalize(value.trim());
  if (
    !LOCAL_WINDOWS_PATH.test(normalized) ||
    normalized.startsWith("\\\\") ||
    path.win32.basename(normalized).toLowerCase() !==
      executableName.toLowerCase()
  ) {
    return "";
  }
  return normalized;
}

function relativeExecutables(productId, metadata) {
  const arch = metadata.packageArchitecture;
  const triple = metadata.targetTriple;
  if (productId === "codex-cli") {
    const suffix = ["vendor", triple, "bin", "codex.exe"];
    return [
      ["node_modules", "@openai", "codex", "node_modules", "@openai", `codex-win32-${arch}`, ...suffix],
      ["node_modules", "@openai", `codex-win32-${arch}`, ...suffix],
      ["node_modules", "@openai", "codex", ...suffix]
    ];
  }
  if (productId === "claude-code") {
    return [
      ["node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"],
      ["node_modules", "@anthropic-ai", "claude-code", "node_modules", "@anthropic-ai", `claude-code-win32-${arch}`, "claude.exe"],
      ["node_modules", "@anthropic-ai", `claude-code-win32-${arch}`, "claude.exe"]
    ];
  }
  return [];
}

function pathInside(candidate, root) {
  const relative = path.win32.relative(root, candidate);
  return Boolean(
    relative &&
      relative !== ".." &&
      !relative.startsWith(`..${path.win32.sep}`) &&
      !path.win32.isAbsolute(relative)
  );
}

async function findTrustedExternalExtensionCliHost(
  productId,
  {
    architecture = process.arch,
    locateAll,
    exists,
    realpath,
    verifySignature
  } = {}
) {
  const policy = EXTENSION_CLI_HOST_POLICIES[productId];
  const metadata = architectureMetadata(architecture);
  if (
    !policy ||
    !metadata ||
    typeof locateAll !== "function" ||
    typeof exists !== "function" ||
    typeof realpath !== "function" ||
    typeof verifySignature !== "function"
  ) {
    return { installed: false, detection: "unknown", executable: "" };
  }

  let executableProbe;
  let shimProbe;
  try {
    [executableProbe, shimProbe] = await Promise.all([
      locateAll(`${policy.commandName}.exe`),
      locateAll(`${policy.commandName}.cmd`)
    ]);
  } catch {
    return { installed: false, detection: "unknown", executable: "" };
  }

  let inconclusive = executableProbe?.ok !== true || shimProbe?.ok !== true;
  const candidates = [];
  for (const raw of executableProbe?.locations || []) {
    const filePath = localExecutablePath(raw, `${policy.commandName}.exe`);
    if (filePath) candidates.push({ filePath, root: "" });
    else inconclusive = true;
  }
  for (const raw of shimProbe?.locations || []) {
    const shim = localExecutablePath(raw, `${policy.commandName}.cmd`);
    const prefix = shim
      ? inferNpmPrefixFromCommandPath(shim, policy.commandName)
      : "";
    if (!prefix) {
      inconclusive = true;
      continue;
    }
    for (const segments of relativeExecutables(productId, metadata)) {
      candidates.push({ filePath: path.win32.join(prefix, ...segments), root: prefix });
    }
  }

  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.filePath.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let canonical;
    let canonicalRoot = "";
    try {
      if (!exists(candidate.filePath)) continue;
      canonical = localExecutablePath(
        realpath(candidate.filePath),
        `${policy.commandName}.exe`
      );
      if (candidate.root) {
        canonicalRoot = path.win32.normalize(realpath(candidate.root));
      }
    } catch {
      inconclusive = true;
      continue;
    }
    if (
      !canonical ||
      (candidate.root &&
        (!LOCAL_WINDOWS_PATH.test(canonicalRoot) ||
          canonicalRoot.startsWith("\\\\") ||
          !pathInside(canonical, canonicalRoot)))
    ) {
      inconclusive = true;
      continue;
    }
    const signature = await verifySignature(canonical, policy.expectedSigner);
    if (signature?.ok === true) {
      return { installed: true, detection: "installed", executable: canonical };
    }
    inconclusive = true;
  }

  return {
    installed: false,
    detection: inconclusive ? "unknown" : "absent",
    executable: ""
  };
}

module.exports = {
  EXTENSION_CLI_HOST_POLICIES,
  findTrustedExternalExtensionCliHost
};

