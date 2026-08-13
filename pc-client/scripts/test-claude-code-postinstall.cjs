const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  computeNpmTreeSha256,
  createManagedCliInstallAction,
  createManagedCliPostInstallAction
} = require("../shared/managed-cli.cjs");

const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";
const TEMP_PREFIX = "aihub-claude-postinstall-";
const productId = "claude-code";
const plan = Object.freeze({
  packageName: "@anthropic-ai/claude-code",
  postInstall: Object.freeze({
    manifestCommand: "node install.cjs",
    scriptFile: "install.cjs",
    executableFile: "bin\\claude.exe",
    verificationArgs: Object.freeze(["--version"])
  })
});

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
  assert.ok(
    npmCli,
    `找不到与当前 Node 配套的 npm-cli.js；已检查：${candidates.join(", ")}`
  );
  return fs.realpathSync.native(npmCli);
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function describeRuntime() {
  const nodeExecutable = fs.realpathSync.native(process.execPath);
  const npmCli = findNpmCli();
  const npmRoot = fs.realpathSync.native(
    path.join(path.dirname(npmCli), "..")
  );
  const npmManifest = JSON.parse(
    fs.readFileSync(path.join(npmRoot, "package.json"), "utf8")
  );
  assert.equal(npmManifest.name, "npm", "npm-cli.js 必须属于 npm 软件包");
  assert.match(
    npmManifest.version,
    /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/,
    "npm 版本号无效"
  );
  const npmTreeSha256 = computeNpmTreeSha256(npmRoot);
  assert.match(npmTreeSha256, /^[a-f0-9]{64}$/, "npm 安装树无法安全校验");
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
  assert.equal(
    result.signal,
    null,
    `命令被信号 ${result.signal} 终止：${command} ${args.join(" ")}`
  );
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

function safelyRemoveTempRoot(tempRoot) {
  const resolvedTempDirectory = fs.realpathSync.native(os.tmpdir());
  const resolvedRoot = fs.realpathSync.native(tempRoot);
  assert.equal(
    path.dirname(resolvedRoot).toLowerCase(),
    resolvedTempDirectory.toLowerCase(),
    "拒绝清理：临时根不是系统临时目录的直属子目录"
  );
  assert.ok(
    path.basename(resolvedRoot).startsWith(TEMP_PREFIX),
    "拒绝清理：临时根名称不属于本验证脚本"
  );
  assert.notEqual(
    resolvedRoot.toLowerCase(),
    resolvedTempDirectory.toLowerCase(),
    "拒绝清理系统临时目录本身"
  );
  assert.notEqual(
    resolvedRoot.toLowerCase(),
    path.parse(resolvedRoot).root.toLowerCase(),
    "拒绝清理磁盘根目录"
  );
  fs.rmSync(resolvedRoot, { recursive: true, force: true });
}

function main() {
  assert.equal(
    process.platform,
    "win32",
    "Claude Code 原生 Windows postinstall 验证必须在 Windows 运行"
  );

  const runtime = describeRuntime();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  try {
    const prefix = path.join(tempRoot, "managed-prefix");
    const executionDirectory = path.join(tempRoot, "npm-execution");
    const userNpmConfigPath = path.join(executionDirectory, "user.npmrc");
    const globalNpmConfigPath = path.join(
      executionDirectory,
      "global.npmrc"
    );
    const npmCache = path.join(tempRoot, "npm-cache");
    fs.mkdirSync(prefix, { recursive: true });
    fs.mkdirSync(executionDirectory, { recursive: true });
    fs.mkdirSync(npmCache, { recursive: true });
    fs.writeFileSync(userNpmConfigPath, "", "utf8");
    fs.writeFileSync(globalNpmConfigPath, "", "utf8");
    assert.equal(fs.readFileSync(userNpmConfigPath, "utf8"), "");
    assert.equal(fs.readFileSync(globalNpmConfigPath, "utf8"), "");

    const environment = isolatedEnvironment(npmCache);
    const installAction = createManagedCliInstallAction({
      productId,
      plan,
      prefix,
      runtime,
      executionContext: {
        directory: executionDirectory,
        userConfigPath: userNpmConfigPath,
        globalConfigPath: globalNpmConfigPath
      }
    });
    assert.ok(installAction, "必须生成隔离的官方 npm 安装动作");
    assert.equal(
      installAction.args[installAction.args.indexOf("--registry") + 1],
      OFFICIAL_NPM_REGISTRY
    );
    assert.equal(
      installAction.args[installAction.args.indexOf("--userconfig") + 1],
      userNpmConfigPath
    );
    assert.equal(
      installAction.args[installAction.args.indexOf("--globalconfig") + 1],
      globalNpmConfigPath
    );
    assert.ok(installAction.args.includes("--ignore-scripts"));
    assert.equal(installAction.options.shell, false);

    run(installAction.executable, installAction.args, {
      ...installAction.options,
      env: environment,
      timeout: 300000,
      maxBuffer: 16 * 1024 * 1024
    });

    const postInstallAction = createManagedCliPostInstallAction({
      productId,
      plan,
      prefix,
      runtime
    });
    assert.ok(
      postInstallAction,
      "Claude Code 官方包的 postinstall 契约必须与审核策略完全一致"
    );
    assert.deepEqual(postInstallAction.args.length, 1);
    assert.equal(postInstallAction.options.shell, false);

    run(postInstallAction.executable, postInstallAction.args, {
      ...postInstallAction.options,
      env: {
        ...environment,
        npm_lifecycle_event: "postinstall",
        npm_package_name: postInstallAction.packageName,
        npm_package_version: postInstallAction.version
      },
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024
    });

    const expectedExecutable = postInstallAction.expectedExecutable;
    const executable = fs.realpathSync.native(expectedExecutable);
    const executableStat = fs.lstatSync(expectedExecutable);
    assert.equal(
      executable.toLowerCase(),
      expectedExecutable.toLowerCase(),
      "claude.exe 真实路径不得跳转到审核目录之外"
    );
    assert.equal(executableStat.isFile(), true, "claude.exe 必须是普通文件");
    assert.equal(
      executableStat.isSymbolicLink(),
      false,
      "claude.exe 不得是符号链接"
    );

    const verification = run(
      executable,
      postInstallAction.verificationArgs,
      {
        cwd: path.dirname(executable),
        env: environment,
        timeout: 30000,
        maxBuffer: 1024 * 1024
      }
    );
    const versionOutput = `${verification.stdout || ""}\n${verification.stderr || ""}`.trim();
    assert.ok(versionOutput, "claude.exe --version 必须返回版本信息");

    process.stdout.write(
      [
        "PASS Claude Code reviewed postinstall integration",
        `  package: ${postInstallAction.packageName}@${postInstallAction.version}`,
        `  executable: ${executable}`,
        `  version: ${versionOutput.slice(0, 500)}`
      ].join("\n") + "\n"
    );
  } finally {
    safelyRemoveTempRoot(tempRoot);
  }
}

main();
