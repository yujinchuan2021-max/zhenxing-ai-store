"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createManagedPythonLayout,
  createManagedPythonReceipt,
  createManagedPythonTerminalAction,
  createManagedPythonUninstallAction,
  createPythonPipInstallAction,
  createPythonVenvAction,
  inspectManagedPythonCli
} = require("../shared/managed-python-cli.cjs");

const plan = Object.freeze({
  name: "Example CLI",
  driver: "python-venv",
  distributionName: "example-cli",
  version: "1.2.3",
  commandName: "example",
  minimumPythonMinor: 10,
  maximumPythonMinor: 13,
  architecture: "x64",
  wheel: Object.freeze({
    url: "https://files.pythonhosted.org/packages/example/example_cli-1.2.3-py3-none-any.whl",
    sha256: "a".repeat(64)
  }),
  lockedRequirements: Object.freeze([
    Object.freeze({
      name: "example-cli",
      version: "1.2.3",
      url: "https://files.pythonhosted.org/packages/example/example_cli-1.2.3-py3-none-any.whl",
      sha256: "a".repeat(64)
    })
  ])
});

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("builds an isolated fixed-wheel Python install plan", () => {
  const prefix = "C:\\AIHub\\CLI";
  const layout = createManagedPythonLayout({ productId: "example-cli", plan, prefix });
  assert.equal(layout.directory, "C:\\AIHub\\CLI\\.aihub-python\\example-cli\\1.2.3");
  const venv = createPythonVenvAction({
    productId: "example-cli", plan, prefix,
    pythonExecutable: "C:\\Python313\\python.exe", pythonMinor: 13
  });
  assert.deepEqual(venv.args, ["-I", "-m", "venv", layout.directory]);
  assert.equal(createPythonVenvAction({ productId: "example-cli", plan, prefix, pythonExecutable: "C:\\Python39\\python.exe", pythonMinor: 9 }), null);
  const install = createPythonPipInstallAction({ productId: "example-cli", plan, prefix });
  assert.equal(install.executable, layout.pythonExecutable);
  assert.ok(install.args.includes("--isolated"));
  assert.ok(install.args.includes("--only-binary=:all:"));
  assert.ok(install.args.includes("--require-hashes"));
  assert.ok(install.args.includes("--no-index"));
  assert.match(install.requirementsText, /example-cli @ https:\/\/files\.pythonhosted\.org/);
  assert.equal(createManagedPythonLayout({ productId: "example-cli", plan: { ...plan, wheel: { ...plan.wheel, url: "https://evil.example/x.whl" } }, prefix }), null);
});

test("receipts own one venv and enable terminal launch and scoped uninstall", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-python-cli-"));
  const layout = createManagedPythonLayout({ productId: "example-cli", plan, prefix: root });
  fs.mkdirSync(path.dirname(layout.pythonExecutable), { recursive: true });
  fs.writeFileSync(layout.pythonExecutable, "python");
  fs.writeFileSync(layout.commandExecutable, "command");
  fs.writeFileSync(layout.requirementsLock, "locked");
  const receipt = createManagedPythonReceipt({
    productId: "example-cli", plan, prefix: root, hashFile: sha256,
    now: () => "2026-07-31T00:00:00.000Z",
    randomBytes: () => Buffer.alloc(24, 7)
  });
  assert.ok(receipt);
  const status = inspectManagedPythonCli({ productId: "example-cli", plan, receipt, configuredPrefix: root, hashFile: sha256 });
  assert.equal(status.installed, true);
  assert.equal(status.canUninstall, true);

  const cmd = path.join(root, "cmd.exe");
  fs.writeFileSync(cmd, "cmd");
  const terminal = createManagedPythonTerminalAction({ plan, status, commandExecutable: cmd });
  assert.equal(terminal.args[3], layout.commandExecutable);
  assert.equal(createManagedPythonUninstallAction({ productId: "example-cli", plan, receipt, configuredPrefix: root, hashFile: sha256 }).directory, layout.directory);

  fs.writeFileSync(layout.commandExecutable, "tampered");
  const tampered = inspectManagedPythonCli({ productId: "example-cli", plan, receipt, configuredPrefix: root, hashFile: sha256 });
  assert.equal(tampered.detection, "unknown");
  assert.equal(createManagedPythonUninstallAction({ productId: "example-cli", plan, receipt, configuredPrefix: root, hashFile: sha256 }), null);
  fs.rmSync(root, { recursive: true, force: true });
});
