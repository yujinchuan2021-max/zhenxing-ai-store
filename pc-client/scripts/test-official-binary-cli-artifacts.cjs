"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { cliInstallPlans } = require("../shared/install-registry.cjs");
const {
  artifactFor,
  createManagedBinaryLayout,
  createManagedBinaryReceipt,
  createManagedBinaryUninstallAction,
  inspectManagedBinaryCli
} = require("../shared/managed-binary-cli.cjs");
const {
  inspectExtractedTree,
  validateZipEntries
} = require("../shared/safe-zip-extraction.cjs");

const TEMP_PREFIX = "aihub-official-binary-cli-";
const PRODUCTS = Object.freeze([
  Object.freeze({
    productId: "amp-cli",
    versionArgs: Object.freeze(["--version"])
  }),
  Object.freeze({
    productId: "daytona-cli",
    versionArgs: Object.freeze(["version"])
  }),
  Object.freeze({
    productId: "openfang-cli",
    versionArgs: Object.freeze(["--version"])
  }),
  Object.freeze({
    productId: "zeroclaw-cli",
    versionArgs: Object.freeze(["--version"])
  }),
  Object.freeze({
    productId: "open-interpreter-cli",
    versionArgs: Object.freeze(["--version"])
  })
]);

function fileHash(filePath, algorithm = "sha256") {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest("hex");
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 60_000,
    windowsHide: true,
    shell: false,
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.error, undefined, result.error?.message || "launch failed");
  assert.equal(result.signal, null, `command was terminated by ${result.signal}`);
  assert.equal(
    result.status,
    0,
    `${executable} ${args.join(" ")} failed: ${result.stderr || result.stdout}`
  );
  return `${result.stdout || ""}\n${result.stderr || ""}`.trim();
}

async function downloadArtifact(artifact, target) {
  const proxyEnabled = spawnSync("reg.exe", [
    "query",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
    "/v",
    "ProxyEnable"
  ], { encoding: "utf8", windowsHide: true, shell: false });
  let proxy = "";
  if (/REG_DWORD\s+0x1\b/i.test(proxyEnabled.stdout || "")) {
    const proxyServer = spawnSync("reg.exe", [
      "query",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
      "/v",
      "ProxyServer"
    ], { encoding: "utf8", windowsHide: true, shell: false });
    const raw = (proxyServer.stdout || "").match(/REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim() || "";
    const entries = raw.split(";").map((value) => value.trim()).filter(Boolean);
    const selected = entries.find((value) => /^https=/i.test(value)) ||
      entries.find((value) => /^http=/i.test(value)) || entries[0] || "";
    proxy = selected.replace(/^[^=]+=/, "");
    if (proxy && !/^[a-z]+:\/\//i.test(proxy)) proxy = `http://${proxy}`;
  }
  const args = [
    "--location",
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "600",
    "--max-filesize",
    String(artifact.maximumBytes),
    "--output",
    target,
    "--write-out",
    "%{url_effective}",
    ...(proxy ? ["--proxy", proxy] : []),
    artifact.url
  ];
  const result = spawnSync("curl.exe", args, {
    encoding: "utf8",
    timeout: 10 * 60_000,
    windowsHide: true,
    shell: false,
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.error, undefined, result.error?.message || "download failed");
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const finalUrl = new URL(result.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(finalUrl.protocol, "https:");
  assert.ok(
    artifact.allowedHosts.includes(finalUrl.hostname.toLowerCase()),
    `download redirected to unreviewed host ${finalUrl.hostname}`
  );
  const bytes = fs.statSync(target).size;
  assert.ok(bytes > 0, "downloaded artifact is empty");
  assert.ok(bytes <= artifact.maximumBytes, "download exceeded reviewed size limit");
  return bytes;
}

function safelyRemoveTempRoot(tempRoot) {
  const tempDirectory = fs.realpathSync.native(os.tmpdir());
  const resolvedRoot = fs.realpathSync.native(tempRoot);
  assert.equal(path.dirname(resolvedRoot).toLowerCase(), tempDirectory.toLowerCase());
  assert.ok(path.basename(resolvedRoot).startsWith(TEMP_PREFIX));
  assert.notEqual(resolvedRoot.toLowerCase(), tempDirectory.toLowerCase());
  assert.notEqual(resolvedRoot.toLowerCase(), path.parse(resolvedRoot).root.toLowerCase());
  fs.rmSync(resolvedRoot, { recursive: true, force: true });
}

async function verifyProduct(definition, plans) {
  const plan = plans[definition.productId];
  assert.equal(plan?.driver, "portable-binary", definition.productId);
  const architecture = process.arch;
  const artifact = artifactFor(plan, architecture);
  assert.ok(artifact, `${definition.productId} does not support ${architecture}`);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  try {
    const prefix = path.join(tempRoot, "managed-prefix");
    fs.mkdirSync(prefix);
    const layout = createManagedBinaryLayout({
      productId: definition.productId,
      plan,
      prefix,
      architecture
    });
    assert.ok(layout);
    fs.mkdirSync(layout.directory, { recursive: true });
    const downloadPath = artifact.kind === "standalone-executable"
      ? layout.executable
      : path.join(tempRoot, artifact.fileName);
    const bytes = await downloadArtifact(artifact, downloadPath);
    assert.equal(
      fileHash(downloadPath, artifact.downloadIntegrityAlgorithm),
      artifact.downloadIntegrity
    );
    if (artifact.kind !== "standalone-executable") {
      const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
      const listing = run(tar, ["-tf", downloadPath]).split(/\r?\n/).filter(Boolean);
      const maximumEntries = artifact.kind === "zip-directory" ? artifact.maximumArchiveEntries : 1;
      const entries = validateZipEntries(listing, maximumEntries);
      assert.ok(entries);
      assert.ok(entries.includes(artifact.executableFileName.replace(/\\/g, "/")));
      run(tar, ["-xf", downloadPath, "-C", layout.directory, ...(artifact.kind === "zip-single-executable" ? [artifact.executableFileName] : [])]);
      assert.ok(inspectExtractedTree(layout.directory, {
        maximumEntries,
        maximumBytes: artifact.maximumExtractedBytes
      }));
    }
    assert.equal(fileHash(layout.executable, artifact.integrityAlgorithm), artifact.integrity);

    const versionOutput = run(layout.executable, definition.versionArgs);
    assert.ok(versionOutput.includes(plan.version), versionOutput);
    const receipt = createManagedBinaryReceipt({
      productId: definition.productId,
      plan,
      prefix,
      architecture,
      hashFile: fileHash
    });
    assert.ok(receipt);
    const installed = inspectManagedBinaryCli({
      productId: definition.productId,
      plan,
      receipt,
      architecture,
      verifyIntegrity: true,
      hashFile: fileHash
    });
    assert.equal(installed.detection, "installed");
    assert.equal(installed.canUninstall, true);

    const sentinel = path.join(prefix, "unrelated", "keep.txt");
    fs.mkdirSync(path.dirname(sentinel), { recursive: true });
    fs.writeFileSync(sentinel, "keep\n", "utf8");
    const uninstall = createManagedBinaryUninstallAction({
      productId: definition.productId,
      plan,
      receipt,
      architecture,
      hashFile: fileHash
    });
    assert.equal(uninstall?.directory, layout.directory);
    fs.rmSync(uninstall.directory, { recursive: true, force: false });
    assert.equal(fs.readFileSync(sentinel, "utf8"), "keep\n");
    assert.equal(
      inspectManagedBinaryCli({
        productId: definition.productId,
        plan,
        receipt,
        architecture,
        hashFile: fileHash
      }).detection,
      "absent"
    );
    return {
      productId: definition.productId,
      version: plan.version,
      architecture,
      bytes,
      downloadIntegrity: `${artifact.downloadIntegrityAlgorithm}:${artifact.downloadIntegrity}`,
      executableIntegrity: `${artifact.integrityAlgorithm}:${artifact.integrity}`,
      commandOutput: versionOutput.slice(0, 500),
      receiptOwnedUninstall: true,
      unrelatedSentinelPreserved: true
    };
  } finally {
    safelyRemoveTempRoot(tempRoot);
  }
}

async function main() {
  assert.equal(process.platform, "win32");
  assert.ok(["x64", "arm64"].includes(process.arch));
  const plans = cliInstallPlans();
  const requested = new Set(process.argv.slice(2));
  const products = requested.size
    ? PRODUCTS.filter((product) => requested.has(product.productId))
    : PRODUCTS;
  assert.equal(
    products.length,
    requested.size || PRODUCTS.length,
    "requested product is missing from the official binary acceptance matrix"
  );
  const results = [];
  for (const product of products) results.push(await verifyProduct(product, plans));
  process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
