const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");

const {
  createManagedCliBeforeUninstallAction,
  createManagedCliReceipt,
  createManagedCliInstallAction,
  createManagedCliPostInstallAction,
  createManagedCliUninstallAction,
  inspectManagedCli
} = require("../shared/managed-cli.cjs");

const productId = "codex-cli";
const plan = { packageName: "@openai/codex" };
const prefix = "C:\\Users\\Tester\\AI Hub\\CLI";
const otherPrefix = "D:\\Developer\\CLI";
const nodeExecutable = "C:\\Program Files\\nodejs\\node.exe";
const npmCli =
  "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
const npmExecutionDirectory = "C:\\Users\\Tester\\AppData\\Local\\Temp\\aihub-npm";
const npmUserConfigPath = path.win32.join(npmExecutionDirectory, "user.npmrc");
const npmGlobalConfigPath = path.win32.join(
  npmExecutionDirectory,
  "global.npmrc"
);
const executionContext = {
  directory: npmExecutionDirectory,
  userConfigPath: npmUserConfigPath,
  globalConfigPath: npmGlobalConfigPath
};
const managementId = "ab".repeat(24);
const runtime = {
  nodeExecutable,
  npmCli,
  nodeSha256: "1".repeat(64),
  npmCliSha256: "2".repeat(64),
  npmTreeSha256: "4".repeat(64),
  npmVersion: "11.6.2",
  nodeVersion: "24.9.0"
};
const recordedRuntime = {
  nodeExecutable,
  npmCli,
  nodeSha256: runtime.nodeSha256,
  npmCliSha256: runtime.npmCliSha256,
  npmTreeSha256: runtime.npmTreeSha256,
  npmVersion: runtime.npmVersion
};

function errorWithCode(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fakeFileSystem({
  packagePrefix = prefix,
  packageName = plan.packageName,
  packagePathName = plan.packageName,
  version = "1.2.3",
  packageDirectory,
  readError,
  includePackage = true,
  includeMarker = true,
  markerManagementId = managementId,
  manifestScripts = null,
  manifestBin = null,
  extraRealpaths = []
} = {}) {
  const normalizedPrefix = path.win32.normalize(packagePrefix);
  const expectedPackageDirectory = path.win32.join(
    normalizedPrefix,
    "node_modules",
    ...packagePathName.split("/")
  );
  const actualPackageDirectory = path.win32.normalize(
    packageDirectory || expectedPackageDirectory
  );
  const manifest = path.win32.join(actualPackageDirectory, "package.json");
  const marker = path.win32.join(actualPackageDirectory, ".aihub-managed.json");
  const manifestText = JSON.stringify({
    name: packageName,
    version,
    ...(manifestScripts ? { scripts: manifestScripts } : {}),
    ...(manifestBin ? { bin: manifestBin } : {})
  });
  const manifestSha256 = crypto
    .createHash("sha256")
    .update(manifestText)
    .digest("hex");
  const files = new Map();
  if (includePackage) files.set(manifest.toLowerCase(), manifestText);
  if (includePackage && includeMarker) {
    files.set(
      marker.toLowerCase(),
      JSON.stringify({
        managementId: markerManagementId,
        productId,
        packageName: plan.packageName,
        version: "1.2.3",
        manifestSha256:
          version === "1.2.3"
            ? manifestSha256
            : crypto
                .createHash("sha256")
                .update(JSON.stringify({ name: plan.packageName, version: "1.2.3" }))
                .digest("hex")
      })
    );
  }
  const realpaths = new Map(
    [
      [normalizedPrefix, normalizedPrefix],
      [expectedPackageDirectory, actualPackageDirectory],
      [nodeExecutable, nodeExecutable],
      [npmCli, npmCli],
      [npmExecutionDirectory, npmExecutionDirectory],
      [npmUserConfigPath, npmUserConfigPath],
      [npmGlobalConfigPath, npmGlobalConfigPath],
      ...extraRealpaths
    ].map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    realpath(value) {
      const normalized = path.win32.normalize(value);
      const resolved = realpaths.get(normalized.toLowerCase());
      if (!resolved) throw errorWithCode("ENOENT");
      return resolved;
    },
    readFile(value) {
      if (readError) throw errorWithCode(readError);
      const normalized = path.win32.normalize(value);
      const result = files.get(normalized.toLowerCase());
      if (result === undefined) throw errorWithCode("ENOENT");
      return result;
    },
    writeFile(value, data, options) {
      const normalized = path.win32.normalize(value).toLowerCase();
      if (options?.flag === "wx" && files.has(normalized)) {
        throw errorWithCode("EEXIST");
      }
      files.set(normalized, String(data));
    },
    randomBytes() {
      return Buffer.from(managementId, "hex");
    }
  };
}

function receiptFor(overrides = {}) {
  const manifestText = JSON.stringify({ name: plan.packageName, version: "1.2.3" });
  return {
    productId,
    packageName: plan.packageName,
    prefix,
    version: "1.2.3",
    managementId,
    manifestSha256: crypto.createHash("sha256").update(manifestText).digest("hex"),
    runtime: recordedRuntime,
    installedAt: "2026-07-29T12:00:00.000Z",
    ...overrides
  };
}

test("creates a receipt only from an installed package at a canonical local prefix", () => {
  const fileSystem = fakeFileSystem({ includeMarker: false });
  const receipt = createManagedCliReceipt({
    productId,
    plan,
    prefix,
    runtime,
    now: () => "2026-07-29T12:00:00.000Z",
    ...fileSystem
  });
  assert.deepEqual(receipt, receiptFor());
});

test("does not claim a manually installed package without a receipt", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: null,
    configuredPrefix: prefix,
    ...fakeFileSystem()
  });
  assert.deepEqual(status, {
    installed: true,
    version: "1.2.3",
    directory: prefix,
    detection: "installed",
    managed: false,
    canUninstall: false,
    ownership: "external"
  });
});

test("takes over an exact allowlisted package found in the configured AI Hub prefix", () => {
  const fixedPlan = {
    ...plan,
    expectedVersion: "1.2.3",
    installSpec: `${plan.packageName}@1.2.3`
  };
  const fileSystem = fakeFileSystem({ includeMarker: false });
  const status = inspectManagedCli({
    productId,
    plan: fixedPlan,
    receipt: null,
    configuredPrefix: prefix,
    ...fileSystem
  });

  assert.deepEqual(status, {
    installed: true,
    version: "1.2.3",
    directory: prefix,
    detection: "installed",
    managed: true,
    canUninstall: true,
    ownership: "adopted"
  });

  const action = createManagedCliUninstallAction({
    productId,
    plan: fixedPlan,
    receipt: null,
    configuredPrefix: prefix,
    runtime,
    executionContext,
    ...fileSystem
  });
  assert.equal(action.packageName, plan.packageName);
  assert.equal(action.prefix, prefix);
  assert.equal(action.version, "1.2.3");
  assert.equal(action.ownership, "adopted");
  assert.equal(action.manifestSha256.length, 64);
});

test("allows uninstall only when receipt, package, prefix and version match", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    ...fakeFileSystem()
  });
  assert.equal(status.installed, true);
  assert.equal(status.managed, true);
  assert.equal(status.canUninstall, true);
  assert.equal(status.ownership, "managed");
});

test("uses the receipt prefix after the configured install directory changes", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: otherPrefix,
    ...fakeFileSystem()
  });
  assert.equal(status.directory, prefix);
  assert.equal(status.canUninstall, true);
});

test("refuses ownership when the installed version differs from the receipt", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    ...fakeFileSystem({ version: "1.3.0" })
  });
  assert.equal(status.installed, true);
  assert.equal(status.version, "1.3.0");
  assert.equal(status.managed, false);
  assert.equal(status.canUninstall, false);
  assert.equal(status.ownership, "mismatch");
});

test("does not revive a stale receipt after a same-version manual reinstall", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    ...fakeFileSystem({ markerManagementId: "cd".repeat(24) })
  });
  assert.equal(status.installed, true);
  assert.equal(status.managed, false);
  assert.equal(status.canUninstall, false);
  assert.equal(status.ownership, "mismatch");
});

test("requires the per-install ownership marker", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    ...fakeFileSystem({ includeMarker: false })
  });
  assert.equal(status.installed, true);
  assert.equal(status.canUninstall, false);
  assert.equal(status.ownership, "mismatch");
});

test("rejects relative, root and UNC receipt prefixes", () => {
  for (const invalidPrefix of [
    "CLI",
    "C:\\",
    "\\\\server\\share\\CLI"
  ]) {
    const status = inspectManagedCli({
      productId,
      plan,
      receipt: receiptFor({ prefix: invalidPrefix }),
      configuredPrefix: "",
      ...fakeFileSystem()
    });
    assert.equal(status.canUninstall, false, invalidPrefix);
    assert.equal(status.detection, "unknown", invalidPrefix);
  }
});

test("rejects a receipt for a different package", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor({ packageName: "@attacker/lookalike" }),
    configuredPrefix: "",
    ...fakeFileSystem()
  });
  assert.equal(status.detection, "unknown");
  assert.equal(status.canUninstall, false);
});

test("rejects a package directory junction that escapes the recorded prefix", () => {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    ...fakeFileSystem({ packageDirectory: "D:\\Outside\\codex" })
  });
  assert.equal(status.detection, "unknown");
  assert.equal(status.canUninstall, false);
});

test("keeps absent and unreadable package states distinct", () => {
  const absent = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: "",
    ...fakeFileSystem({ includePackage: false })
  });
  const unknown = inspectManagedCli({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: "",
    ...fakeFileSystem({ readError: "EACCES" })
  });
  assert.equal(absent.detection, "absent");
  assert.equal(unknown.detection, "unknown");
  assert.equal(absent.canUninstall, false);
  assert.equal(unknown.canUninstall, false);
});

test("builds one fixed npm action with lifecycle scripts disabled", () => {
  const action = createManagedCliUninstallAction({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: otherPrefix,
    runtime,
    executionContext,
    ...fakeFileSystem()
  });
  assert.deepEqual(action, {
    executable: nodeExecutable,
    args: [
      npmCli,
      "uninstall",
      "--global",
      "--prefix",
      prefix,
      "--registry",
      "https://registry.npmjs.org/",
      "--userconfig",
      npmUserConfigPath,
      "--globalconfig",
      npmGlobalConfigPath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      plan.packageName
    ],
    options: {
      cwd: npmExecutionDirectory,
      windowsHide: true,
      shell: false
    },
    productId,
    packageName: plan.packageName,
    prefix,
    version: "1.2.3",
    managementId
  });
});

test("builds one isolated official-registry install action", () => {
  const action = createManagedCliInstallAction({
    productId,
    plan,
    prefix,
    runtime,
    executionContext,
    ...fakeFileSystem()
  });
  assert.deepEqual(action, {
    executable: nodeExecutable,
    args: [
      npmCli,
      "install",
      "--global",
      "--prefix",
      prefix,
      "--registry",
      "https://registry.npmjs.org/",
      "--userconfig",
      npmUserConfigPath,
      "--globalconfig",
      npmGlobalConfigPath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      plan.packageName
    ],
    options: {
      cwd: npmExecutionDirectory,
      windowsHide: true,
      shell: false
    },
    productId,
    packageName: plan.packageName,
    prefix
  });
});

test("enforces the reviewed minimum Node.js major before installation", () => {
  const qoderPlan = {
    packageName: "@qoder-ai/qodercli",
    expectedVersion: "1.1.9",
    installSpec: "@qoder-ai/qodercli@1.1.9",
    minimumNodeMajor: 20
  };
  const accepted = createManagedCliInstallAction({
    productId: "alibaba-qoder-cn-cli",
    plan: qoderPlan,
    prefix,
    runtime,
    executionContext,
    ...fakeFileSystem()
  });
  assert.equal(accepted?.args.at(-1), "@qoder-ai/qodercli@1.1.9");

  const rejected = createManagedCliInstallAction({
    productId: "alibaba-qoder-cn-cli",
    plan: qoderPlan,
    prefix,
    runtime: { ...runtime, nodeVersion: "18.20.8" },
    executionContext,
    ...fakeFileSystem()
  });
  assert.equal(rejected, null);
});

test("allows only the reviewed package-local Claude postinstall action", () => {
  const claudePlan = {
    packageName: "@anthropic-ai/claude-code",
    postInstall: {
      manifestCommand: "node install.cjs",
      scriptFile: "install.cjs",
      executableFile: "bin\\claude.exe",
      verificationArgs: ["--version"]
    }
  };
  const claudePackage = path.win32.join(
    prefix,
    "node_modules",
    "@anthropic-ai",
    "claude-code"
  );
  const scriptFile = path.win32.join(claudePackage, "install.cjs");
  const action = createManagedCliPostInstallAction({
    productId: "claude-code",
    plan: claudePlan,
    prefix,
    runtime,
    ...fakeFileSystem({
      packageName: claudePlan.packageName,
      packagePathName: claudePlan.packageName,
      manifestScripts: { postinstall: "node install.cjs" },
      extraRealpaths: [[scriptFile, scriptFile]]
    })
  });
  assert.deepEqual(action, {
    executable: nodeExecutable,
    args: [scriptFile],
    options: {
      cwd: claudePackage,
      windowsHide: true,
      shell: false
    },
    productId: "claude-code",
    packageName: claudePlan.packageName,
    version: "1.2.3",
    expectedExecutable: path.win32.join(claudePackage, "bin", "claude.exe"),
    verificationWithNode: false,
    verificationArgs: ["--version"]
  });

  const changedManifest = createManagedCliPostInstallAction({
    productId: "claude-code",
    plan: claudePlan,
    prefix,
    runtime,
    ...fakeFileSystem({
      packageName: claudePlan.packageName,
      packagePathName: claudePlan.packageName,
      manifestScripts: { postinstall: "node unexpected.cjs" },
      extraRealpaths: [[scriptFile, scriptFile]]
    })
  });
  assert.equal(changedManifest, null);
});

test("pins OpenClaw and verifies its reviewed package-local entry with Node", () => {
  const openClawPlan = {
    packageName: "openclaw",
    expectedVersion: "2026.7.1-2",
    installSpec: "openclaw@2026.7.1-2",
    postInstall: {
      manifestCommand: "node scripts/postinstall-bundled-plugins.mjs",
      scriptFile: "scripts\\postinstall-bundled-plugins.mjs",
      executableFile: "openclaw.mjs",
      verificationWithNode: true,
      verificationArgs: ["--version"]
    }
  };
  const packageDirectory = path.win32.join(prefix, "node_modules", "openclaw");
  const scriptFile = path.win32.join(
    packageDirectory,
    "scripts",
    "postinstall-bundled-plugins.mjs"
  );
  const action = createManagedCliPostInstallAction({
    productId: "openclaw-agent",
    plan: openClawPlan,
    prefix,
    runtime,
    ...fakeFileSystem({
      packageName: "openclaw",
      packagePathName: "openclaw",
      version: "2026.7.1-2",
      manifestScripts: {
        postinstall: "node scripts/postinstall-bundled-plugins.mjs"
      },
      extraRealpaths: [[scriptFile, scriptFile]]
    })
  });
  assert.equal(action?.verificationWithNode, true);
  assert.equal(action?.expectedExecutable, path.win32.join(packageDirectory, "openclaw.mjs"));

  const installAction = createManagedCliInstallAction({
    productId: "openclaw-agent",
    plan: openClawPlan,
    prefix,
    runtime,
    executionContext,
    ...fakeFileSystem()
  });
  assert.equal(installAction?.args.at(-1), "openclaw@2026.7.1-2");
});

test("builds only the reviewed OpenClaw service cleanup before package removal", () => {
  const openClawPlan = {
    packageName: "openclaw",
    expectedVersion: "2026.7.1-2",
    installSpec: "openclaw@2026.7.1-2",
    commandName: "openclaw",
    beforeUninstall: {
      executableFile: "openclaw.mjs",
      args: ["uninstall", "--service", "--yes", "--non-interactive"]
    }
  };
  const packageDirectory = path.win32.join(prefix, "node_modules", "openclaw");
  const entryFile = path.win32.join(packageDirectory, "openclaw.mjs");
  const openClawReceipt = {
    ...receiptFor(),
    productId: "openclaw-agent",
    packageName: "openclaw",
    version: "2026.7.1-2"
  };
  const fileSystem = fakeFileSystem({
    packageName: "openclaw",
    packagePathName: "openclaw",
    version: "2026.7.1-2",
    manifestBin: { openclaw: "openclaw.mjs" },
    includeMarker: false,
    extraRealpaths: [[entryFile, entryFile]]
  });
  const manifestText = fileSystem.readFile(
    path.win32.join(packageDirectory, "package.json")
  );
  const receipt = {
    ...openClawReceipt,
    manifestSha256: crypto.createHash("sha256").update(manifestText).digest("hex")
  };
  const markerPath = path.win32.join(packageDirectory, ".aihub-managed.json");
  const markerText = JSON.stringify({
    managementId,
    productId: "openclaw-agent",
    packageName: "openclaw",
    version: "2026.7.1-2",
    manifestSha256: receipt.manifestSha256
  });
  const readFile = fileSystem.readFile;
  fileSystem.readFile = (value) =>
    path.win32.normalize(value).toLowerCase() === markerPath.toLowerCase()
      ? markerText
      : readFile(value);

  const action = createManagedCliBeforeUninstallAction({
    productId: "openclaw-agent",
    plan: openClawPlan,
    receipt,
    configuredPrefix: prefix,
    runtime,
    ...fileSystem
  });
  assert.deepEqual(action?.args, [
    entryFile,
    "uninstall",
    "--service",
    "--yes",
    "--non-interactive"
  ]);
});

test("refuses an uninstall action when the npm runtime fingerprint changed", () => {
  const action = createManagedCliUninstallAction({
    productId,
    plan,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    runtime: { ...runtime, npmCliSha256: "3".repeat(64) },
    executionContext,
    ...fakeFileSystem()
  });
  assert.equal(action, null);
});

test("never creates an uninstall action for an unreviewed product", () => {
  const action = createManagedCliUninstallAction({
    productId: "renderer-supplied-package",
    plan: null,
    receipt: receiptFor(),
    configuredPrefix: prefix,
    runtime,
    executionContext,
    ...fakeFileSystem()
  });
  assert.equal(action, null);
});
