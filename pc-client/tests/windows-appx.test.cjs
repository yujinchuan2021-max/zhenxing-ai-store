"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createAppxUninstallAction,
  trustedAppxPackage
} = require("../shared/windows-appx.cjs");

const openAiPolicy = {
  identityName: "OpenAI.Codex",
  publisher: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i
};

function packageEntry(overrides = {}) {
  return {
    Name: "OpenAI.Codex",
    PackageFullName:
      "OpenAI.Codex_26.721.11231.0_x64__2p2nqsd0c76g0",
    Publisher: "CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B",
    Version: "26.721.11231.0",
    InstallLocation: "C:\\Program Files\\WindowsApps\\OpenAI.Codex",
    ...overrides
  };
}

test("accepts one exact x64 package identity from the local product whitelist", () => {
  assert.deepEqual(trustedAppxPackage([packageEntry()], openAiPolicy), packageEntry());
});

test("rejects a lookalike package, unexpected publisher, and ambiguity", () => {
  assert.equal(
    trustedAppxPackage(
      [packageEntry({ Name: "OpenAI.Codex.Lookalike" })],
      openAiPolicy
    ),
    null
  );
  assert.equal(
    trustedAppxPackage(
      [packageEntry({ Publisher: "CN=Unknown Vendor" })],
      openAiPolicy
    ),
    null
  );
  assert.equal(
    trustedAppxPackage(
      [
        packageEntry(),
        packageEntry({
          PackageFullName:
            "OpenAI.Codex_26.800.100.0_x64__2p2nqsd0c76g0"
        })
      ],
      openAiPolicy
    ),
    null
  );
});

test("creates only a fixed PowerShell removal action for the trusted package", () => {
  const action = createAppxUninstallAction(packageEntry(), openAiPolicy);
  assert.equal(
    action.executable.toLowerCase(),
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe".toLowerCase()
  );
  assert.deepEqual(action.args.slice(0, 3), [
    "-NoProfile",
    "-NonInteractive",
    "-Command"
  ]);
  assert.match(action.args[3], /^[$]ErrorActionPreference='Stop';Remove-AppxPackage -Package '/);
  assert.match(action.args[3], /OpenAI[.]Codex_26[.]721[.]11231[.]0_x64__/);
  assert.equal(
    createAppxUninstallAction(
      packageEntry({ PackageFullName: "OpenAI.Codex';calc.exe;'" }),
      openAiPolicy
    ),
    null
  );
});
