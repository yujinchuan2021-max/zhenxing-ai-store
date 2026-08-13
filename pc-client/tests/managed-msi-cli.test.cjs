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
  inspectManagedMsiCli,
  matchesManagedMsiReceipt
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

test("the MSI lifecycle module accepts another fixed vendor contract", () => {
  const other = {
    ...plan,
    name: "Example Agent",
    version: "1.2.3",
    commandName: "example-agent",
    productCode: "{12345678-1234-1234-1234-123456789ABC}",
    installDirectory: "%LOCALAPPDATA%\\ExampleAgent",
    executableFile: "bin\\example-agent.exe",
    postInstallArgs: [],
    artifact: {
      url: "https://downloads.example.com/example-agent-1.2.3-x64.msi",
      fileName: "example-agent-1.2.3-x64.msi",
      sha256: "a".repeat(64),
      maximumBytes: 64 * 1024 * 1024,
      allowedHosts: ["downloads.example.com"],
      expectedSigner: "Example Agent, Inc."
    }
  };
  const layout = createManagedMsiCliLayout({
    productId: "example-agent-cli",
    plan: other,
    localAppData: "C:\\Users\\Demo\\AppData\\Local"
  });
  assert.equal(
    layout?.executable,
    "C:\\Users\\Demo\\AppData\\Local\\ExampleAgent\\bin\\example-agent.exe"
  );
  assert.equal(
    createManagedMsiCliLayout({
      productId: "example-agent-cli",
      plan: { ...other, executableFile: "..\\outside.exe" },
      localAppData: "C:\\Users\\Demo\\AppData\\Local"
    }),
    null
  );
});

test("the MSI lifecycle module accepts a pinned unsigned Program Files contract", () => {
  const unsigned = {
    ...plan,
    name: "Example Rust Agent",
    version: "1.0.0",
    commandName: "example-rust-agent",
    productCode: "{ABCDEF12-1234-5678-90AB-ABCDEF123456}",
    installDirectory: "%PROGRAMFILES%\\ExampleRustAgent",
    executableFile: "bin\\example-rust-agent.exe",
    artifact: {
      url: "https://github.com/example/example/releases/download/v1.0.0/example.msi",
      fileName: "example-1.0.0-x64.msi",
      sha256: "b".repeat(64),
      maximumBytes: 64 * 1024 * 1024,
      allowedHosts: ["github.com"],
      signaturePolicy: "pinned-unsigned"
    }
  };
  const layout = createManagedMsiCliLayout({
    productId: "example-rust-agent-cli",
    plan: unsigned,
    programFiles: "C:\\Program Files"
  });
  assert.equal(
    layout?.executable,
    "C:\\Program Files\\ExampleRustAgent\\bin\\example-rust-agent.exe"
  );
  assert.equal(
    createManagedMsiCliLayout({
      productId: "example-rust-agent-cli",
      plan: { ...unsigned, artifact: { ...unsigned.artifact, expectedSigner: "Fake" } },
      programFiles: "C:\\Program Files"
    }),
    null
  );
});

test("Kiro MSI receipt controls launch and product-code uninstall", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-kiro-"));
  const layout = createManagedMsiCliLayout({ productId: "amazon-kiro-cli", plan, localAppData: root });
  fs.mkdirSync(layout.directory, { recursive: true });
  fs.writeFileSync(layout.executable, "kiro");
  const receipt = createManagedMsiCliReceipt({ productId: "amazon-kiro-cli", plan, localAppData: root, hashFile: sha256, now: () => "2026-07-31T00:00:00.000Z", randomBytes: () => Buffer.alloc(24, 3) });
  assert.ok(receipt);
  assert.equal(matchesManagedMsiReceipt({ productId: "amazon-kiro-cli", plan, receipt, localAppData: root }), true);
  assert.equal(matchesManagedMsiReceipt({ productId: "amazon-kiro-cli", plan, receipt: { ...receipt, productCode: "{00000000-0000-0000-0000-000000000000}" }, localAppData: root }), false);
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
