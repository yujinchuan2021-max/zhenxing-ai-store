"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const electronMainSource = fs.readFileSync(
  path.resolve(__dirname, "../electron/main.cjs"),
  "utf8"
);

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

test("supports one reviewed executable inside a fixed ZIP", (t) => {
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-archive-cli-"));
  t.after(() => fs.rmSync(prefix, { recursive: true, force: true }));
  const binary = Buffer.from("reviewed archive binary fixture");
  const executableSha256 = crypto.createHash("sha256").update(binary).digest("hex");
  const plan = {
    driver: "portable-binary",
    version: "0.6.9",
    commandName: "openfang",
    launchArgs: ["init"],
    artifacts: {
      x64: {
        url: "https://github.com/example/openfang/releases/download/v0.6.9/openfang.zip",
        fileName: "openfang-x64.zip",
        archiveEntry: "openfang.exe",
        sha256: "a".repeat(64),
        expectedExecutableSha256: executableSha256,
        maximumBytes: 64 * 1024 * 1024,
        maximumExtractedBytes: 128 * 1024 * 1024,
        allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
      }
    }
  };
  const layout = createManagedBinaryLayout({
    productId: "openfang-cli",
    plan,
    prefix,
    architecture: "x64"
  });
  assert.equal(layout?.artifact.kind, "zip-single-executable");
  assert.equal(path.basename(layout?.executable || ""), "openfang.exe");
  fs.mkdirSync(layout.directory, { recursive: true });
  fs.writeFileSync(layout.executable, binary);
  const receipt = createManagedBinaryReceipt({
    productId: "openfang-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  });
  assert.equal(receipt?.integrity, executableSha256);
  const action = createManagedBinaryTerminalAction({
    productId: "openfang-cli",
    plan,
    status: inspectManagedBinaryCli({
      productId: "openfang-cli",
      plan,
      receipt,
      architecture: "x64",
      verifyIntegrity: true,
      hashFile
    }),
    commandExecutable: path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe")
  });
  assert.deepEqual(action?.args.slice(-1), ["init"]);
  assert.equal(
    createManagedBinaryLayout({
      productId: "openfang-cli",
      plan: {
        ...plan,
        artifacts: { x64: { ...plan.artifacts.x64, archiveEntry: "..\\evil.exe" } }
      },
      prefix,
      architecture: "x64"
    }),
    null
  );
});

test("keeps a reviewed ZIP directory beside its CLI executable", (t) => {
  const prefix = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-directory-cli-"));
  t.after(() => fs.rmSync(prefix, { recursive: true, force: true }));
  const binary = Buffer.from("reviewed directory binary fixture");
  const executableSha256 = crypto.createHash("sha256").update(binary).digest("hex");
  const plan = {
    driver: "portable-binary",
    version: "0.8.4",
    commandName: "zeroclaw",
    launchArgs: ["quickstart"],
    artifacts: {
      x64: {
        url: "https://github.com/example/zeroclaw/releases/download/v0.8.4/zeroclaw.zip",
        fileName: "zeroclaw-x64.zip",
        archiveKind: "directory",
        executableRelativePath: "bin\\zeroclaw.exe",
        sha256: "c".repeat(64),
        expectedExecutableSha256: executableSha256,
        maximumBytes: 64 * 1024 * 1024,
        maximumArchiveEntries: 100,
        maximumExtractedBytes: 256 * 1024 * 1024,
        allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
      }
    }
  };
  const layout = createManagedBinaryLayout({ productId: "zeroclaw-cli", plan, prefix, architecture: "x64" });
  assert.equal(layout?.artifact.kind, "zip-directory");
  assert.equal(path.relative(layout.directory, layout.executable), path.join("bin", "zeroclaw.exe"));
  fs.mkdirSync(path.dirname(layout.executable), { recursive: true });
  fs.writeFileSync(layout.executable, binary);
  assert.ok(createManagedBinaryReceipt({
    productId: "zeroclaw-cli",
    plan,
    prefix,
    architecture: "x64",
    hashFile
  }));
});

test("accepts a reviewed tar.gz directory through the same archive path", () => {
  const plan = {
    driver: "portable-binary",
    version: "0.0.34",
    commandName: "interpreter",
    artifacts: {
      x64: {
        url: "https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter.tar.gz",
        fileName: "open-interpreter-x86_64-pc-windows-msvc.tar.gz",
        archiveKind: "directory",
        executableRelativePath: "bin\\interpreter.exe",
        sha256: "d".repeat(64),
        expectedExecutableSha256: "e".repeat(64),
        maximumBytes: 128 * 1024 * 1024,
        maximumArchiveEntries: 200,
        maximumExtractedBytes: 896 * 1024 * 1024,
        allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
      }
    }
  };
  const layout = createManagedBinaryLayout({
    productId: "open-interpreter-cli",
    plan,
    prefix: "C:\\AIHub\\CLI",
    architecture: "x64"
  });
  assert.equal(layout?.artifact.kind, "zip-directory");
  assert.equal(
    path.relative(layout?.directory || "", layout?.executable || ""),
    path.join("bin", "interpreter.exe")
  );
});

test("rejects directory archives larger than the reviewed one GiB ceiling", () => {
  const plan = {
    driver: "portable-binary",
    version: "0.0.34",
    commandName: "interpreter",
    artifacts: {
      x64: {
        url: "https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter.tar.gz",
        fileName: "open-interpreter.tar.gz",
        archiveKind: "directory",
        executableRelativePath: "bin\\interpreter.exe",
        sha256: "d".repeat(64),
        expectedExecutableSha256: "e".repeat(64),
        maximumBytes: 320 * 1024 * 1024,
        maximumArchiveEntries: 16,
        maximumExtractedBytes: 1024 * 1024 * 1024 + 1,
        allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
      }
    }
  };
  assert.equal(
    createManagedBinaryLayout({
      productId: "open-interpreter-cli",
      plan,
      prefix: "C:\\AIHub\\CLI",
      architecture: "x64"
    }),
    null
  );
});

test("extracts every reviewed archive kind in the Electron install path", () => {
  assert.match(
    electronMainSource,
    /if \(artifact\.kind !== "standalone-executable"\) \{/
  );
  assert.doesNotMatch(
    electronMainSource,
    /if \(artifact\.kind === "zip-single-executable"\) \{/
  );
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
