const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  computeNpmTreeSha256,
  createManagedCliReceipt,
  createManagedCliUninstallAction,
  inspectManagedCli
} = require("../shared/managed-cli.cjs");

const TEMP_PREFIX = "aihub-managed-cli-uninstall-";
const LIFECYCLE_MARKER_ENV = "AIHUB_MANAGED_CLI_LIFECYCLE_MARKER";
const productId = "managed-cli-fixture";
const plan = { packageName: "@aihub-test/managed-cli-fixture" };

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

function describeRuntime(nodeExecutable, npmCli) {
  const npmRoot = path.join(path.dirname(npmCli), "..");
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
  assert.match(npmTreeSha256, /^[a-f0-9]{64}$/, "npm tree digest 无效");
  return {
    nodeExecutable,
    npmCli,
    nodeSha256: fileSha256(nodeExecutable),
    npmCliSha256: fileSha256(npmCli),
    npmTreeSha256,
    npmVersion: npmManifest.version
  };
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeSentinel(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  return { filePath, contents };
}

function assertSentinelUnchanged(sentinel) {
  assert.equal(
    fs.readFileSync(sentinel.filePath, "utf8"),
    sentinel.contents,
    `卸载不应修改 ${sentinel.filePath}`
  );
}

function safelyRemoveTempRoot(tempRoot) {
  const resolvedTempDirectory = fs.realpathSync.native(os.tmpdir());
  const resolvedRoot = fs.realpathSync.native(tempRoot);
  assert.equal(
    path.dirname(resolvedRoot).toLowerCase(),
    resolvedTempDirectory.toLowerCase(),
    "拒绝清理：临时根不在系统临时目录的直接子级"
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
    "受管 CLI 模块只接受 Windows 本地路径，本验证必须在 Windows 运行"
  );

  const nodeExecutable = fs.realpathSync.native(process.execPath);
  const npmCli = findNpmCli();
  const runtime = describeRuntime(nodeExecutable, npmCli);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));

  try {
    const fixtureDirectory = path.join(tempRoot, "fixture-package");
    const packedDirectory = path.join(tempRoot, "packed");
    const prefix = path.join(tempRoot, "managed-prefix");
    const marker = path.join(tempRoot, "lifecycle-script-ran.marker");
    const isolatedNpmDirectory = path.join(tempRoot, "isolated-npm-execution");
    fs.mkdirSync(fixtureDirectory, { recursive: true });
    fs.mkdirSync(packedDirectory, { recursive: true });
    fs.mkdirSync(prefix, { recursive: true });
    fs.mkdirSync(isolatedNpmDirectory, { recursive: true });
    const isolatedNpmUserConfig = path.join(isolatedNpmDirectory, "user.npmrc");
    const isolatedNpmGlobalConfig = path.join(isolatedNpmDirectory, "global.npmrc");
    fs.writeFileSync(
      isolatedNpmUserConfig,
      "# isolated fixture user npm config\n",
      "utf8"
    );
    fs.writeFileSync(
      isolatedNpmGlobalConfig,
      "# isolated fixture global npm config\n",
      "utf8"
    );

    writeJson(path.join(fixtureDirectory, "package.json"), {
      name: plan.packageName,
      version: "1.2.3",
      bin: { "aihub-managed-cli-fixture": "cli.cjs" },
      scripts: {
        preuninstall: "node lifecycle.cjs preuninstall",
        uninstall: "node lifecycle.cjs uninstall",
        postuninstall: "node lifecycle.cjs postuninstall"
      }
    });
    fs.writeFileSync(
      path.join(fixtureDirectory, "cli.cjs"),
      "#!/usr/bin/env node\nprocess.stdout.write('fixture');\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(fixtureDirectory, "lifecycle.cjs"),
      [
        "const fs = require('node:fs');",
        `const marker = process.env.${LIFECYCLE_MARKER_ENV};`,
        "if (!marker) throw new Error('missing lifecycle marker path');",
        "fs.appendFileSync(marker, `${process.argv[2]}\\n`, 'utf8');",
        ""
      ].join("\n"),
      "utf8"
    );

    run(
      nodeExecutable,
      [
        npmCli,
        "pack",
        fixtureDirectory,
        "--pack-destination",
        packedDirectory,
        "--ignore-scripts",
        "--offline"
      ],
      { cwd: tempRoot }
    );
    const archives = fs
      .readdirSync(packedDirectory)
      .filter((entry) => entry.endsWith(".tgz"));
    assert.deepEqual(archives.length, 1, "fixture 应只生成一个 npm tarball");
    const archive = path.join(packedDirectory, archives[0]);

    run(
      nodeExecutable,
      [
        npmCli,
        "install",
        "--global",
        "--prefix",
        prefix,
        "--ignore-scripts",
        "--offline",
        "--no-audit",
        "--no-fund",
        archive
      ],
      {
        cwd: tempRoot,
        env: { ...process.env, [LIFECYCLE_MARKER_ENV]: marker }
      }
    );

    const targetPackage = path.join(
      prefix,
      "node_modules",
      "@aihub-test",
      "managed-cli-fixture"
    );
    assert.ok(fs.existsSync(targetPackage), "fixture 必须真实安装到临时 prefix");
    assert.equal(fs.existsSync(marker), false, "安装阶段不应执行生命周期脚本");

    const receipt = createManagedCliReceipt({
      productId,
      plan,
      prefix,
      runtime,
      now: () => "2026-07-29T12:00:00.000Z"
    });
    const receiptProbe = inspectManagedCli({
      productId,
      plan,
      receipt: null,
      configuredPrefix: prefix
    });
    assert.ok(
      receipt,
      `真实安装结果应能生成受管收据；探测结果：${JSON.stringify(receiptProbe)}`
    );

    const before = inspectManagedCli({
      productId,
      plan,
      receipt,
      configuredPrefix: prefix
    });
    assert.equal(before.detection, "installed");
    assert.equal(before.canUninstall, true);

    const sentinels = [
      writeSentinel(
        path.join(
          prefix,
          "node_modules",
          "@aihub-test",
          "unrelated-sentinel",
          "keep.txt"
        ),
        "unrelated package data\n"
      ),
      writeSentinel(
        path.join(tempRoot, "user-profile", ".codex", "config.toml"),
        "model = 'keep-user-config'\n"
      ),
      writeSentinel(
        path.join(tempRoot, "user-profile", "AI Models", "model.keep"),
        "keep-model-data\n"
      ),
      writeSentinel(
        path.join(tempRoot, "user-profile", "Projects", "project.keep"),
        "keep-project-data\n"
      )
    ];

    const action = createManagedCliUninstallAction({
      productId,
      plan,
      receipt,
      configuredPrefix: prefix,
      runtime,
      executionContext: {
        directory: isolatedNpmDirectory,
        userConfigPath: isolatedNpmUserConfig,
        globalConfigPath: isolatedNpmGlobalConfig
      }
    });
    assert.ok(action, "受管安装必须生成固定卸载 action");
    assert.equal(action.options.shell, false);
    assert.ok(action.args.includes("--ignore-scripts"));
    assert.equal(action.args.at(-1), plan.packageName);

    run(action.executable, action.args, {
      ...action.options,
      env: { ...process.env, [LIFECYCLE_MARKER_ENV]: marker }
    });

    assert.equal(fs.existsSync(targetPackage), false, "目标 CLI 包应被卸载");
    assert.equal(
      fs.existsSync(marker),
      false,
      "--ignore-scripts 必须阻止 preuninstall/uninstall/postuninstall"
    );
    for (const sentinel of sentinels) assertSentinelUnchanged(sentinel);

    const after = inspectManagedCli({
      productId,
      plan,
      receipt,
      configuredPrefix: prefix
    });
    assert.equal(after.installed, false);
    assert.equal(after.detection, "absent");
    assert.equal(after.canUninstall, false);

    process.stdout.write(
      [
        "PASS managed npm CLI uninstall integration",
        `  target removed: ${plan.packageName}@${receipt.version}`,
        "  lifecycle scripts blocked: preuninstall/uninstall/postuninstall",
        `  preserved sentinels: ${sentinels.length}`,
        "  final detection: absent"
      ].join("\n") + "\n"
    );
  } finally {
    safelyRemoveTempRoot(tempRoot);
  }
}

main();
