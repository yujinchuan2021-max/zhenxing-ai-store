"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createManagedPythonLayout,
  createManagedPythonReceipt,
  createManagedPythonUninstallAction,
  createPythonPipInstallAction,
  createPythonVenvAction,
  inspectManagedPythonCli
} = require("../shared/managed-python-cli.cjs");
const { WINDOWS_CLI_PRODUCTS } = require("../shared/windows-cli-catalog.cjs");

const PRODUCT_IDS = Object.freeze([
  "deepgram-cli",
  "hkuds-nanobot-cli",
  "praisonai-cli",
  "aider-cli"
]);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function run(executable, args, options = {}) {
  const result = childProcess.spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: options.timeout || 15 * 60 * 1000,
    windowsHide: true,
    ...options
  });
  if (result.error || result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").slice(-4000);
    throw new Error(
      `${path.basename(executable)} ${args.join(" ")} failed: ${result.error?.message || result.status}\n${details}`
    );
  }
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function findPython(pythonMinor) {
  const installFolder = `Python3${pythonMinor}`;
  const candidates = [
    path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "Python",
      installFolder,
      "python.exe"
    ),
    process.env[`ZHENXING_PYTHON3${pythonMinor}`] || ""
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const identity = run(candidate, [
      "-I",
      "-c",
      "import platform,sys;print(f'{sys.version_info.major}.{sys.version_info.minor}|{platform.machine()}')"
    ]);
    if (identity === `3.${pythonMinor}|AMD64`) return path.resolve(candidate);
  }
  throw new Error(
    `Python 3.${pythonMinor} x64 is required for official Python CLI acceptance.`
  );
}

function ensureSafeCleanup(root) {
  const resolved = path.resolve(root);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (
    !path.basename(resolved).startsWith("zhenxing-official-python-cli-") ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Refusing to clean unexpected path: ${resolved}`);
  }
}

const requested = new Set(process.argv.slice(2));
const selectedProductIds = requested.size
  ? PRODUCT_IDS.filter((productId) => requested.has(productId))
  : PRODUCT_IDS;
assert.equal(
  selectedProductIds.length,
  requested.size || PRODUCT_IDS.length,
  "requested product is missing from the official Python acceptance matrix"
);
const results = [];

for (const productId of selectedProductIds) {
  const product = WINDOWS_CLI_PRODUCTS[productId];
  assert.equal(product?.cli?.driver, "python-venv");
  const plan = product.cli;
  assert.equal(plan.minimumPythonMinor, plan.maximumPythonMinor);
  const pythonMinor = plan.minimumPythonMinor;
  const pythonExecutable = findPython(pythonMinor);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-official-python-cli-"));
  ensureSafeCleanup(root);
  const prefix = path.join(root, "managed");
  const userHome = path.join(root, "user");
  const sentinel = path.join(root, "unrelated.txt");
  fs.mkdirSync(prefix, { recursive: true });
  fs.mkdirSync(userHome, { recursive: true });
  fs.writeFileSync(sentinel, "preserve");

  try {
    const venv = createPythonVenvAction({
      productId,
      plan,
      prefix,
      pythonExecutable,
      pythonMinor
    });
    assert.ok(venv);
    fs.mkdirSync(venv.layout.productRoot, { recursive: true });
    run(venv.executable, venv.args, { cwd: venv.options.cwd });

    const install = createPythonPipInstallAction({ productId, plan, prefix });
    assert.ok(install);
    fs.writeFileSync(install.layout.requirementsLock, install.requirementsText, "utf8");
    const isolatedEnvironment = {
      ...process.env,
      HOME: userHome,
      USERPROFILE: userHome,
      PYTHONNOUSERSITE: "1",
      PIP_DISABLE_PIP_VERSION_CHECK: "1"
    };
    run(install.executable, install.args, {
      cwd: install.options.cwd,
      env: isolatedEnvironment
    });

    const installedVersion = run(install.layout.pythonExecutable, [
      "-I",
      "-c",
      `import importlib.metadata;print(importlib.metadata.version(${JSON.stringify(plan.distributionName)}))`
    ]);
    assert.equal(installedVersion, plan.version);
    run(install.layout.commandExecutable, ["--help"], {
      cwd: install.layout.directory,
      env: isolatedEnvironment,
      timeout: 2 * 60 * 1000
    });

    const receipt = createManagedPythonReceipt({
      productId,
      plan,
      prefix,
      hashFile: sha256
    });
    assert.ok(receipt);
    const status = inspectManagedPythonCli({
      productId,
      plan,
      receipt,
      configuredPrefix: prefix,
      hashFile: sha256
    });
    assert.equal(status.installed, true);
    const uninstall = createManagedPythonUninstallAction({
      productId,
      plan,
      receipt,
      configuredPrefix: prefix,
      hashFile: sha256
    });
    assert.equal(uninstall.directory, install.layout.directory);
    fs.rmSync(uninstall.directory, { recursive: true, force: true });
    assert.equal(fs.existsSync(sentinel), true);
    assert.equal(fs.existsSync(uninstall.directory), false);
    results.push({
      productId,
      version: installedVersion,
      artifacts: plan.lockedRequirements.length,
      receiptOwnedUninstall: true
    });
  } finally {
    ensureSafeCleanup(root);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log(JSON.stringify(results, null, 2));
