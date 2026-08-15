"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  EXTENSION_CLI_HOST_POLICIES,
  findTrustedExternalExtensionCliHost
} = require("../shared/extension-host-discovery.cjs");

function locator(rows) {
  return async (command) => ({ ok: true, locations: rows[command] || [] });
}

test("finds a signed Codex native executable behind an absolute npm shim", async () => {
  const prefix = "D:\\Tools";
  const expected = path.win32.join(
    prefix,
    "node_modules",
    "@openai",
    "codex",
    "node_modules",
    "@openai",
    "codex-win32-x64",
    "vendor",
    "x86_64-pc-windows-msvc",
    "bin",
    "codex.exe"
  );
  const result = await findTrustedExternalExtensionCliHost("codex-cli", {
    architecture: "x64",
    locateAll: locator({ "codex.cmd": [`${prefix}\\codex.cmd`] }),
    exists: (candidate) => candidate === expected,
    realpath: (candidate) => candidate,
    verifySignature: async (candidate, expectedSigner) => {
      assert.equal(candidate, expected);
      assert.equal(
        expectedSigner.test('CN="OpenAI OpCo, LLC", O="OpenAI OpCo, LLC"'),
        true
      );
      return { ok: true, status: "Valid" };
    }
  });
  assert.deepEqual(result, {
    installed: true,
    detection: "installed",
    executable: expected
  });
});

test("finds a directly installed signed Claude Code executable", async () => {
  const executable = "C:\\Users\\tester\\.local\\bin\\claude.exe";
  const result = await findTrustedExternalExtensionCliHost("claude-code", {
    locateAll: locator({ "claude.exe": [executable] }),
    exists: () => true,
    realpath: (candidate) => candidate,
    verifySignature: async (_candidate, expectedSigner) => ({
      ok: expectedSigner.test('CN="Anthropic, PBC", O="Anthropic, PBC"'),
      status: "Valid"
    })
  });
  assert.equal(result.installed, true);
  assert.equal(result.executable, executable);
});

test("rejects relative, UNC, lookalike and unknown-signature executables", async () => {
  const result = await findTrustedExternalExtensionCliHost("claude-code", {
    locateAll: locator({
      "claude.exe": [
        "claude.exe",
        "\\\\server\\tools\\claude.exe",
        "C:\\Tools\\claude-helper.exe",
        "C:\\Tools\\claude.exe"
      ],
      "claude.cmd": ["relative\\claude.cmd"]
    }),
    exists: () => true,
    realpath: (candidate) => candidate,
    verifySignature: async () => ({ ok: false, status: "Unknown" })
  });
  assert.deepEqual(result, {
    installed: false,
    detection: "unknown",
    executable: ""
  });
});

test("reports absence only after conclusive fixed-command probes", async () => {
  assert.deepEqual(
    await findTrustedExternalExtensionCliHost("codex-cli", {
      locateAll: locator({}),
      exists: () => false,
      realpath: (candidate) => candidate,
      verifySignature: async () => ({ ok: false, status: "NotFound" })
    }),
    { installed: false, detection: "absent", executable: "" }
  );
  assert.equal(EXTENSION_CLI_HOST_POLICIES["cursor-desktop"], undefined);
});

test("Electron prefers managed hosts and falls back to fixed trusted discovery", () => {
  const main = fs.readFileSync(
    path.join(__dirname, "..", "electron", "main.cjs"),
    "utf8"
  );
  assert.match(main, /findTrustedExternalExtensionCliHost/);
  assert.match(main, /productId === "cursor-desktop"[\s\S]*?detectDesktopProduct\(productId\)/);
  assert.match(
    main,
    /status\.installed === true && status\.managed === true[\s\S]*?findTrustedExternalExtensionCliHost/
  );
  assert.match(
    main,
    /resolveExtensionHostExecutable[\s\S]*?resolveManagedExtensionHostExecutable[\s\S]*?external\.executable/
  );
});
