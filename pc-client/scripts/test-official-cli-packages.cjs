"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { cliInstallPlans } = require("../shared/install-registry.cjs");
const {
  computeNpmTreeSha256,
  createManagedCliInstallAction,
  createManagedCliReceipt,
  createManagedCliUninstallAction,
  inspectManagedCli
} = require("../shared/managed-cli.cjs");

const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";
const TEMP_PREFIX = "aihub-official-cli-";
const PRODUCTS = Object.freeze([
  Object.freeze({
    productId: "codex-cli",
    commandName: "codex",
    versionArgs: Object.freeze(["--version"])
  }),
  Object.freeze({
    productId: "gemini-cli",
    commandName: "gemini",
    versionArgs: Object.freeze(["--version"])
  })
]);

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(
      path.dirname(process.execPath),
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js"
    )
  ].filter(Boolean);
  const npmCli = candidates.find(
    (candidate) =>
      path.basename(candidate).toLowerCase() === "npm-cli.js" &&
      fs.existsSync(candidate)
  );
  assert.ok(npmCli, `找不到 npm-cli.js；已检查：${candidates.join(", ")}`);
  return fs.realpathSync.native(npmCli);
}

function describeRuntime() {
  const nodeExecutable = fs.realpathSync.native(process.execPath);
  const npmCli = findNpmCli();
  const npmRoot = fs.realpathSync.native(path.join(path.dirname(npmCli), ".."));
  const npmManifest = JSON.parse(
    fs.readFileSync(path.join(npmRoot, "package.json"), "utf8")
  );
  assert.equal(npmManifest.name, "npm");
  const npmTreeSha256 = computeNpmTreeSha256(npmRoot);
  assert.match(npmTreeSha256, /^[a-f0-9]{64}$/);
  return {
    nodeExecutable,
    npmCli,
    nodeSha256: fileSha256(nodeExecutable),
    npmCliSha256: fileSha256(npmCli),
    npmTreeSha256,
    npmVersion: npmManifest.version
  };
}

function isolatedEnvironment(cacheDirectory) {
  const blocked = new Set([
    "node_options",
    "node_path",
    "npm_node_execpath",
    "npm_execpath",
    "npm_config_prefix",
    "npm_config_userconfig",
    "npm_config_globalconfig",
    "npm_config_registry",
    "npm_config_ignore_scripts"
  ]);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !blocked.has(key.toLowerCase()))
  );
  environment.npm_config_cache = cacheDirectory;
  environment.npm_config_update_notifier = "false";
  return environment;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    ...options
  });
  assert.equal(
    result.error,
    undefined,
    `无法启动命令：${result.error?.message || "unknown error"}`
  );
  assert.equal(result.signal, null, `命令被信号 ${result.signal} 终止`);
  assert.equal(
    result.status,
    0,
    [
      `命令失败（exit ${result.status}）：${command} ${args.join(" ")}`,
      result.stdout?.trim(),
      result.stderr?.trim()
    ]
      .filter(Boolean)
      .join("\n")
  );
  return result;
}

function packageDirectory(prefix, packageName) {
  return path.join(prefix, "node_modules", ...packageName.split("/"));
}

function resolvePackageBin(packageRoot, manifest, commandName) {
  const bin =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[commandName];
  assert.equal(typeof bin, "string", `${manifest.name} 缺少 ${commandName} 入口`);
  const candidate = path.resolve(packageRoot, bin);
  const relative = path.relative(packageRoot, candidate);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    `${commandName} 入口逃逸软件包目录`
  );
  const resolved = fs.realpathSync.native(candidate);
  const resolvedRelative = path.relative(
    fs.realpathSync.native(packageRoot),
    resolved
  );
  assert.ok(
    resolvedRelative &&
      !resolvedRelative.startsWith("..") &&
      !path.isAbsolute(resolvedRelative),
    `${commandName} 真实入口逃逸软件包目录`
  );
  assert.equal(fs.lstatSync(resolved).isFile(), true);
  return resolved;
}

function safelyRemoveTempRoot(tempRoot) {
  const tempDirectory = fs.realpathSync.native(os.tmpdir());
  const resolvedRoot = fs.realpathSync.native(tempRoot);
  assert.equal(
    path.dirname(resolvedRoot).toLowerCase(),
    tempDirectory.toLowerCase(),
    "拒绝清理：验收目录不是系统临时目录的直接子目录"
  );
  assert.ok(
    path.basename(resolvedRoot).startsWith(TEMP_PREFIX),
    "拒绝清理：验收目录名称不匹配"
  );
  assert.notEqual(resolvedRoot.toLowerCase(), tempDirectory.toLowerCase());
  assert.notEqual(
    resolvedRoot.toLowerCase(),
    path.parse(resolvedRoot).root.toLowerCase()
  );
  fs.rmSync(resolvedRoot, { recursive: true, force: true });
}

function verifyProduct(definition, runtime, plans) {
  const plan = plans[definition.productId];
  assert.ok(plan, `缺少 ${definition.productId} 固定安装计划`);
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), `${TEMP_PREFIX}${definition.commandName}-`)
  );
  try {
    const prefix = path.join(tempRoot, "managed-prefix");
    const executionDirectory = path.join(tempRoot, "npm-execution");
    const userConfigPath = path.join(executionDirectory, "user.npmrc");
    const globalConfigPath = path.join(executionDirectory, "global.npmrc");
    const cacheDirectory = path.join(tempRoot, "npm-cache");
    fs.mkdirSync(prefix, { recursive: true });
    fs.mkdirSync(executionDirectory, { recursive: true });
    fs.mkdirSync(cacheDirectory, { recursive: true });
    fs.writeFileSync(userConfigPath, "", "utf8");
    fs.writeFileSync(globalConfigPath, "", "utf8");

    const executionContext = {
      directory: executionDirectory,
      userConfigPath,
      globalConfigPath
    };
    const environment = isolatedEnvironment(cacheDirectory);
    const install = createManagedCliInstallAction({
      productId: definition.productId,
      plan,
      prefix,
      runtime,
      executionContext
    });
    assert.ok(install, `${definition.productId} 未生成固定安装动作`);
    assert.equal(install.options.shell, false);
    assert.ok(install.args.includes("--ignore-scripts"));
    assert.equal(
      install.args[install.args.indexOf("--registry") + 1],
      OFFICIAL_NPM_REGISTRY
    );
    assert.equal(install.args.at(-1), plan.packageName);
    run(install.executable, install.args, {
      ...install.options,
      env: environment,
      timeout: 300000,
      maxBuffer: 32 * 1024 * 1024
    });

    const unmanaged = inspectManagedCli({
      productId: definition.productId,
      plan,
      receipt: null,
      configuredPrefix: prefix
    });
    assert.equal(unmanaged.detection, "installed");
    assert.equal(unmanaged.canUninstall, false);

    const receipt = createManagedCliReceipt({
      productId: definition.productId,
      plan,
      prefix,
      runtime
    });
    assert.ok(receipt, `${definition.productId} 未生成安装所有权收据`);
    const managed = inspectManagedCli({
      productId: definition.productId,
      plan,
      receipt,
      configuredPrefix: prefix
    });
    assert.equal(managed.detection, "installed");
    assert.equal(managed.canUninstall, true);

    const installedPackage = packageDirectory(prefix, plan.packageName);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(installedPackage, "package.json"), "utf8")
    );
    assert.equal(manifest.name, plan.packageName);
    assert.equal(manifest.version, receipt.version);
    const executable = resolvePackageBin(
      installedPackage,
      manifest,
      definition.commandName
    );
    const versionResult = run(
      runtime.nodeExecutable,
      [executable, ...definition.versionArgs],
      {
        cwd: installedPackage,
        env: environment,
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024
      }
    );
    const versionOutput =
      `${versionResult.stdout || ""}\n${versionResult.stderr || ""}`.trim();
    assert.ok(versionOutput, `${definition.commandName} 没有返回版本`);

    const sentinel = path.join(
      prefix,
      "node_modules",
      "aihub-unrelated-sentinel",
      "keep.txt"
    );
    fs.mkdirSync(path.dirname(sentinel), { recursive: true });
    fs.writeFileSync(sentinel, "keep\n", "utf8");

    const uninstall = createManagedCliUninstallAction({
      productId: definition.productId,
      plan,
      receipt,
      configuredPrefix: prefix,
      runtime,
      executionContext
    });
    assert.ok(uninstall, `${definition.productId} 未生成固定卸载动作`);
    assert.equal(uninstall.options.shell, false);
    assert.ok(uninstall.args.includes("--ignore-scripts"));
    assert.equal(uninstall.args.at(-1), plan.packageName);
    run(uninstall.executable, uninstall.args, {
      ...uninstall.options,
      env: environment,
      timeout: 180000,
      maxBuffer: 16 * 1024 * 1024
    });
    assert.equal(fs.existsSync(installedPackage), false);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "keep\n");

    const removed = inspectManagedCli({
      productId: definition.productId,
      plan,
      receipt,
      configuredPrefix: prefix
    });
    assert.equal(removed.detection, "absent");
    assert.equal(removed.canUninstall, false);

    return {
      productId: definition.productId,
      package: `${manifest.name}@${manifest.version}`,
      command: definition.commandName,
      version: versionOutput.slice(0, 500),
      officialRegistry: true,
      scriptsDisabled: true,
      receiptOwnedUninstall: true,
      unrelatedSentinelPreserved: true
    };
  } finally {
    safelyRemoveTempRoot(tempRoot);
  }
}

function main() {
  assert.equal(process.platform, "win32", "官方 CLI 验收必须在 Windows 运行");
  const runtime = describeRuntime();
  const plans = cliInstallPlans();
  const results = PRODUCTS.map((product) =>
    verifyProduct(product, runtime, plans)
  );
  process.stdout.write(
    `${JSON.stringify({ ok: true, registry: OFFICIAL_NPM_REGISTRY, results }, null, 2)}\n`
  );
}

main();
