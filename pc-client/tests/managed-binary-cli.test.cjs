"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createManagedBinaryLayout,
  createManagedBinaryReceipt,
  createManagedBinaryTerminalAction,
  createManagedBinaryUninstallAction,
  inspectManagedBinaryCli
} = require("../shared/managed-binary-cli.cjs");

function hashFile(filePath, algorithm = "sha512") {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest("hex");
}

function fixture(t) {
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-binary-cli-"));
  t.after(() => fs.rmSync(prefix, { recursive: true, force: true }));
  const binary = Buffer.from("reviewed binary fixture");
  const sha512 = crypto.createHash("sha512").update(binary).digest("hex");
  const plan = {
    driver: "portable-binary",
    version: "1.1.9",
    commandName: "agy",
    managedEnvironment: { AGY_CLI_DISABLE_AUTO_UPDATE: "true" },
    artifacts: {
      x64: {
        url: "https://storage.googleapis.com/example/agy.exe",
        fileName: "agy.exe",
        sha512,
        maximumBytes: 1024 * 1024,
        allowedHosts: ["storage.googleapis.com"]
      }
    }
  };
  const layout = createManagedBinaryLayout({
    productId: "google-antigravity-cli",
    plan,
    prefix,
    architecture: "x64"
  });
  fs.mkdirSync(layout.directory, { recursive: true });
  fs.writeFileSync(layout.executable, binary);
  return { prefix, plan, layout };
}

test("creates one owned receipt and exposes managed status", (t) => {
  const { prefix, plan, layout } = fixture(t);
  const receipt = createManagedBinaryReceipt({
    productId: "google-antigravity-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile,
    now: () => "2026-07-31T12:00:00.000Z",
    randomBytes: () => Buffer.from("ab".repeat(24), "hex")
  });
  assert.equal(receipt?.executable, layout.executable);
  const status = inspectManagedBinaryCli({
    productId: "google-antigravity-cli",
    plan,
    receipt,
    architecture: "x64",
    verifyIntegrity: true,
    hashFile
  });
  assert.equal(status.installed, true);
  assert.equal(status.managed, true);
  assert.equal(status.canUninstall, true);
});

test("refuses launch and uninstall after binary tampering", (t) => {
  const { prefix, plan, layout } = fixture(t);
  const receipt = createManagedBinaryReceipt({
    productId: "google-antigravity-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  });
  fs.appendFileSync(layout.executable, "tampered");
  const status = inspectManagedBinaryCli({
    productId: "google-antigravity-cli",
    plan,
    receipt,
    architecture: "x64",
    verifyIntegrity: true,
    hashFile
  });
  assert.equal(status.managed, false);
  assert.equal(status.ownership, "mismatch");
  assert.equal(
    createManagedBinaryUninstallAction({
      productId: "google-antigravity-cli",
      plan,
      receipt,
      architecture: "x64",
      hashFile
    }),
    null
  );
});

test("opens only the reviewed executable with auto-update disabled", (t) => {
  const { prefix, plan } = fixture(t);
  const receipt = createManagedBinaryReceipt({
    productId: "google-antigravity-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  });
  const status = inspectManagedBinaryCli({
    productId: "google-antigravity-cli",
    plan,
    receipt,
    architecture: "x64",
    verifyIntegrity: true,
    hashFile
  });
  const commandExecutable = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "cmd.exe"
  );
  const action = createManagedBinaryTerminalAction({
    productId: "google-antigravity-cli",
    plan,
    status,
    commandExecutable
  });
  assert.deepEqual(action?.args, ["/d", "/k", "call", status.executable]);
  assert.deepEqual(action?.environment, {
    AGY_CLI_DISABLE_AUTO_UPDATE: "true"
  });
});

test("creates an uninstall action only for exact owned files", (t) => {
  const { prefix, plan, layout } = fixture(t);
  const receipt = createManagedBinaryReceipt({
    productId: "google-antigravity-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  });
  assert.deepEqual(
    createManagedBinaryUninstallAction({
      productId: "google-antigravity-cli",
      plan,
      receipt,
      architecture: "x64",
      hashFile
    }),
    {
      productId: "google-antigravity-cli",
      version: "1.1.9",
      managementId: receipt.managementId,
      directory: layout.directory,
      executable: layout.executable,
      marker: layout.marker
    }
  );
});

test("supports a reviewed SHA-256 Windows binary through the same module", (t) => {
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-kimi-cli-"));
  t.after(() => fs.rmSync(prefix, { recursive: true, force: true }));
  const binary = Buffer.from("reviewed kimi binary fixture");
  const sha256 = crypto.createHash("sha256").update(binary).digest("hex");
  const plan = {
    driver: "portable-binary",
    version: "0.31.1",
    commandName: "kimi",
    managedEnvironment: { KIMI_CODE_NO_AUTO_UPDATE: "1" },
    artifacts: {
      x64: {
        url: "https://cdn.kimi.com/kimi-code/binaries/0.31.1/kimi-code-win32-x64.exe",
        fileName: "kimi.exe",
        sha256,
        maximumBytes: 192 * 1024 * 1024,
        allowedHosts: ["cdn.kimi.com"]
      }
    }
  };
  const layout = createManagedBinaryLayout({
    productId: "moonshot-kimi-code-cli",
    plan,
    prefix,
    architecture: "x64"
  });
  fs.mkdirSync(layout.directory, { recursive: true });
  fs.writeFileSync(layout.executable, binary);
  const receipt = createManagedBinaryReceipt({
    productId: "moonshot-kimi-code-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  });
  assert.equal(receipt?.integrityAlgorithm, "sha256");
  assert.equal(receipt?.integrity, sha256);
  const status = inspectManagedBinaryCli({
    productId: "moonshot-kimi-code-cli",
    plan,
    receipt,
    architecture: "x64",
    verifyIntegrity: true,
    hashFile
  });
  assert.equal(status.managed, true);
  const action = createManagedBinaryTerminalAction({
    productId: "moonshot-kimi-code-cli",
    plan,
    status,
    commandExecutable: path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "cmd.exe"
    )
  });
  assert.deepEqual(action?.environment, { KIMI_CODE_NO_AUTO_UPDATE: "1" });
});

test("keeps existing SHA-512 receipts valid after generic integrity support", (t) => {
  const { prefix, plan, layout } = fixture(t);
  const current = createManagedBinaryReceipt({
    productId: "google-antigravity-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  });
  const legacyReceipt = {
    ...current,
    sha512: current.integrity
  };
  delete legacyReceipt.integrityAlgorithm;
  delete legacyReceipt.integrity;
  const marker = JSON.parse(fs.readFileSync(layout.marker, "utf8"));
  marker.sha512 = marker.integrity;
  delete marker.integrityAlgorithm;
  delete marker.integrity;
  fs.writeFileSync(layout.marker, JSON.stringify(marker), "utf8");
  const status = inspectManagedBinaryCli({
    productId: "google-antigravity-cli",
    plan,
    receipt: legacyReceipt,
    architecture: "x64",
    verifyIntegrity: true,
    hashFile
  });
  assert.equal(status.managed, true);
});
