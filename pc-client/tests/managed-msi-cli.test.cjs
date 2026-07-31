"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createManagedMsiCliLayout,
  createManagedMsiCliReceipt,
  createManagedMsiTerminalAction,
  createManagedMsiUninstallAction,
  inspectManagedMsiCli
} = require("../shared/managed-msi-cli.cjs");

const plan = Object.freeze({
  name: "Kiro CLI", driver: "managed-msi", version: "2.16.0", commandName: "kiro-cli", architecture: "x64",
  productCode: "{836D0F5A-6C4F-455C-8181-8C225DF6C1F7}", installDirectory: "%LOCALAPPDATA%\\Kiro-Cli", executableFile: "kiro-cli.exe",
  artifact: Object.freeze({
    url: "https://prod.download.cli.kiro.dev/stable/2.16.0/kiro-cli-x86_64-pc-windows-msvc.msi",
    fileName: "kiro-cli-2.16.0-x64.msi", sha256: "923ae05cf3ca93abc26b27d35e10f272c5aad57aa895ab18855865b1fec874d5",
    maximumBytes: 300 * 1024 * 1024, allowedHosts: ["prod.download.cli.kiro.dev"], expectedSigner: "Amazon Web Services, Inc."
  }),
  postInstallArgs: Object.freeze(["settings", "app.disableAutoupdates", "true"])
});

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("Kiro MSI plan pins artifact, install location, signer and product code", () => {
  const layout = createManagedMsiCliLayout({ productId: "amazon-kiro-cli", plan, localAppData: "C:\\Users\\Demo\\AppData\\Local" });
  assert.equal(layout.directory, "C:\\Users\\Demo\\AppData\\Local\\Kiro-Cli");
  assert.equal(layout.executable, "C:\\Users\\Demo\\AppData\\Local\\Kiro-Cli\\kiro-cli.exe");
  assert.equal(layout.productCode, plan.productCode);
  assert.equal(createManagedMsiCliLayout({ productId: "amazon-kiro-cli", plan: { ...plan, artifact: { ...plan.artifact, url: "https://evil.example/kiro.msi" } }, localAppData: "C:\\Temp" }), null);
});

test("Kiro MSI receipt controls launch and product-code uninstall", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-kiro-"));
  const layout = createManagedMsiCliLayout({ productId: "amazon-kiro-cli", plan, localAppData: root });
  fs.mkdirSync(layout.directory, { recursive: true });
  fs.writeFileSync(layout.executable, "kiro");
  const receipt = createManagedMsiCliReceipt({ productId: "amazon-kiro-cli", plan, localAppData: root, hashFile: sha256, now: () => "2026-07-31T00:00:00.000Z", randomBytes: () => Buffer.alloc(24, 3) });
  assert.ok(receipt);
  const status = inspectManagedMsiCli({ productId: "amazon-kiro-cli", plan, receipt, localAppData: root, hashFile: sha256 });
  assert.equal(status.canUninstall, true);
  const cmd = path.join(root, "cmd.exe");
  const msiexec = path.join(root, "msiexec.exe");
  fs.writeFileSync(cmd, "cmd");
  fs.writeFileSync(msiexec, "msi");
  assert.equal(createManagedMsiTerminalAction({ plan, status, commandExecutable: cmd }).args[3], layout.executable);
  const uninstall = createManagedMsiUninstallAction({ productId: "amazon-kiro-cli", plan, receipt, localAppData: root, msiexecExecutable: msiexec, hashFile: sha256 });
  assert.deepEqual(uninstall.args, ["/x", plan.productCode, "/quiet", "/norestart"]);
  fs.writeFileSync(layout.executable, "tampered");
  assert.equal(createManagedMsiUninstallAction({ productId: "amazon-kiro-cli", plan, receipt, localAppData: root, msiexecExecutable: msiexec, hashFile: sha256 }), null);
  fs.rmSync(root, { recursive: true, force: true });
});
