import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  removeIsolatedAcceptanceProfile,
  verifyManagedDownloadPause
} from "./lib/packaged-client-cdp.mjs";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const {
  parsePeMachineArchitecture
} = require("../shared/windows-installer-identity.cjs");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const productId = process.argv[2] || "openclaw-windows-hub";
const useDevelopmentClient = process.argv.includes("--development");
const useInstalledClient = process.argv.includes("--installed");
const completeDownload = process.argv.includes("--complete");
const reportIdentity = process.argv.includes("--report-identity");
const completeTimeoutMs = Math.max(
  180_000,
  Number(process.env.AIHUB_DOWNLOAD_REPRO_TIMEOUT_MS) || 20 * 60_000
);
if (process.argv.includes("--live-profile")) {
  throw new Error(
    "Live-profile CDP acceptance is disabled; use the isolated profile and complete manual acceptance separately"
  );
}
const portablePath = process.env.AIHUB_LOCAL_RELEASE_CLIENT
  ? path.resolve(process.env.AIHUB_LOCAL_RELEASE_CLIENT)
  : path.join(
      root,
      "release-local-server-client",
      `ZhenXing-AI-Local-${packageJson.version}-Windows-x64-Portable.exe`
    );
const installedPath =
  process.env.AIHUB_INSTALLED_CLIENT || "C:\\Program Files\\枕星 AI\\枕星 AI.exe";
const clientExecutable = useDevelopmentClient
  ? path.join(root, "node_modules", "electron", "dist", "electron.exe")
  : useInstalledClient
    ? installedPath
    : portablePath;
if (!fs.existsSync(clientExecutable)) {
  throw new Error(`Download reproduction client is missing: ${clientExecutable}`);
}

const profile = createIsolatedAcceptanceProfile(
  "aihub-packaged-download-repro-"
);

async function inspectDownloadedInstaller(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  let buffer;
  try {
    const size = fs.fstatSync(descriptor).size;
    buffer = Buffer.alloc(Math.min(size, 1024 * 1024));
    buffer = buffer.subarray(
      0,
      fs.readSync(descriptor, buffer, 0, buffer.length, 0)
    );
  } finally {
    fs.closeSync(descriptor);
  }
  const script = [
    "$f=Get-Item -LiteralPath $env:AIHUB_INSPECT_PATH",
    "$s=Get-AuthenticodeSignature -LiteralPath $env:AIHUB_INSPECT_PATH",
    "$v=$f.VersionInfo",
    "$o=[pscustomobject]@{SignatureStatus=[string]$s.Status;Signer=if($s.SignerCertificate){$s.SignerCertificate.Subject}else{''};ProductName=[string]$v.ProductName;FileDescription=[string]$v.FileDescription;OriginalFilename=[string]$v.OriginalFilename;CompanyName=[string]$v.CompanyName;ProductVersion=[string]$v.ProductVersion;FileVersion=[string]$v.FileVersion}",
    "$o|ConvertTo-Json -Compress"
  ].join(";");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true,
      env: { ...process.env, AIHUB_INSPECT_PATH: filePath }
    }
  );
  return {
    pe: parsePeMachineArchitecture(buffer),
    ...JSON.parse(stdout.trim())
  };
}

let client;
try {
  client = await launchPackagedClientCdp({
    executable: clientExecutable,
    profile,
    appArguments: useDevelopmentClient ? [root] : []
  });
  const { evaluate } = client;
  if (completeDownload) {
    const readyDeadline = Date.now() + 20_000;
    let ready = false;
    while (Date.now() < readyDeadline) {
      if (await evaluate("Boolean(window.aihubPC?.startDownload)")) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error("Managed download API was not available");
    const encodedProductId = JSON.stringify(productId);
    const started = await evaluate(
      `window.aihubPC.startDownload(${encodedProductId})`
    );
    if (!started?.ok) {
      throw new Error(`Packaged download did not start: ${JSON.stringify(started)}`);
    }
    const deadline = Date.now() + completeTimeoutMs;
    let task;
    while (Date.now() < deadline) {
      task = await evaluate(`window.aihubPC.getDownloadTask(${encodedProductId})`);
      if (task?.phase === "failed") {
        throw new Error(`Packaged download failed: ${JSON.stringify(task)}`);
      }
      if (task?.phase === "completed") break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (task?.phase !== "completed") {
      throw new Error(`Packaged download did not complete: ${JSON.stringify(task)}`);
    }
    const identity = reportIdentity
      ? await inspectDownloadedInstaller(task.filePath)
      : undefined;
    process.stdout.write(
      `${JSON.stringify({ ok: true, productId, task, ...(identity ? { identity } : {}) }, null, 2)}\n`
    );
  } else {
    const task = await verifyManagedDownloadPause({
      evaluate,
      productId,
      minimumBytes: 1024 * 1024,
      timeoutMs: 120_000
    });
    process.stdout.write(`${JSON.stringify({ ok: true, productId, task }, null, 2)}\n`);
  }
} finally {
  try {
    await client?.close();
  } finally {
    try {
      await removeIsolatedAcceptanceProfile(profile);
    } catch (error) {
      process.stderr.write(
        `Acceptance cleanup deferred for ${profile.root}: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  }
}
