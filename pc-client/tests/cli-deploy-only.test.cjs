"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const electronMainSource = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
const { createManagedBinaryLayout } = require("../shared/managed-binary-cli.cjs");
const {
  CAPABILITIES,
  MODULE_ID,
  OPERATIONS,
  cliDeployOnlyPlans,
  createCliDeployOnlyReceipt,
  createCliDeployOnlyTerminalAction,
  getCliDeployOnlyProfile,
  inspectCliDeployOnly,
  publicCliDeployOnlyProfiles,
  validateCliDeployOnlyBinding
} = require("../shared/cli-deploy-only.cjs");
const { validateProductPolicy } = require("../shared/product-policy.cjs");

test("deploy-only profile is a fixed portable CLI with no lifecycle overclaim", () => {
  const profile = getCliDeployOnlyProfile("anytype-cli");
  assert.equal(profile.vendorId, "anytype");
  assert.equal(profile.adapter, "portable-binary");
  assert.deepEqual(profile.operations, OPERATIONS);
  assert.deepEqual(profile.capabilities, CAPABILITIES);
  assert.equal(profile.capabilities.includes("update"), false);
  assert.equal(profile.capabilities.includes("repair"), false);
  assert.equal(profile.capabilities.includes("uninstall"), false);
  assert.equal(cliDeployOnlyPlans()["anytype-cli"].deployOnlyProfileId, profile.profileId);
  assert.deepEqual(publicCliDeployOnlyProfiles()[0].capabilities, CAPABILITIES);
  assert.match(electronMainSource, /cliDeployOnlyPlans\(\)/);
  assert.match(electronMainSource, /createPortableBinaryReceipt\(/);
});

test("deploy-only binary receipt gates recheck and its independent terminal", (t) => {
  const profile = getCliDeployOnlyProfile("anytype-cli");
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-deploy-only-"));
  t.after(() => fs.rmSync(prefix, { recursive: true, force: true }));
  const layout = createManagedBinaryLayout({
    productId: profile.productId,
    plan: cliDeployOnlyPlans()[profile.productId],
    prefix,
    architecture: "x64"
  });
  fs.mkdirSync(layout.directory, { recursive: true });
  fs.writeFileSync(layout.executable, "reviewed fixture");
  const hashFile = () => profile.cli.artifacts.x64.expectedExecutableSha256;
  const receipt = createCliDeployOnlyReceipt({
    productId: profile.productId,
    prefix,
    architecture: "x64",
    hashFile,
    now: () => "2026-08-05T00:00:00.000Z",
    randomBytes: () => Buffer.alloc(24, 9)
  });
  assert.equal(receipt.moduleId, MODULE_ID);
  assert.equal(receipt.installProfileId, profile.profileId);
  const status = inspectCliDeployOnly({ productId: profile.productId, receipt, architecture: "x64", hashFile });
  assert.equal(status.managed, true);
  const commandExecutable = path.join(prefix, "cmd.exe");
  fs.writeFileSync(commandExecutable, "cmd");
  const terminal = createCliDeployOnlyTerminalAction({
    productId: profile.productId, receipt, architecture: "x64", hashFile, commandExecutable
  });
  assert.deepEqual(terminal.args, ["/d", "/k", "call", status.executable]);
  assert.equal(inspectCliDeployOnly({ productId: profile.productId, receipt: { ...receipt, installProfileId: "other" }, architecture: "x64", hashFile }), null);
});

test("backend binding can select only the local profile and cannot supply execution fields", () => {
  const accepted = {
    productId: "anytype-cli",
    moduleId: MODULE_ID,
    installProfileId: "cli-deploy-only.anytype",
    capabilities: CAPABILITIES
  };
  assert.deepEqual(validateCliDeployOnlyBinding(accepted), accepted);
  for (const forbidden of ["command", "args", "env", "headers", "url", "script"]) {
    assert.equal(validateCliDeployOnlyBinding({ ...accepted, [forbidden]: "x" }), null, forbidden);
  }
});

test("future catalog binding retains CLI identity and deploy-only capabilities", () => {
  assert.equal(validateProductPolicy({
    id: "anytype-cli",
    kind: "CLI",
    category: "文档与知识库",
    description: "Fixed CLI deployment candidate.",
    website: "https://developers.anytype.io/docs/examples/featured/cli/",
    tutorial: "https://developers.anytype.io/docs/examples/overview/",
    productType: "cli-deploy-only",
    moduleId: MODULE_ID,
    installProfileId: "cli-deploy-only.anytype",
    requirements: [],
    installPolicy: "client-managed-cli-deploy-only",
    downloadPolicy: "none",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "not-managed",
    capabilities: CAPABILITIES
  }, "anytype"), "");
});
