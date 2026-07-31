import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  removeIsolatedAcceptanceProfile,
  verifyManagedDownloadPause
} from "./lib/packaged-client-cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const productId = process.argv[2] || "openclaw-windows-hub";
const useDevelopmentClient = process.argv.includes("--development");
const useInstalledClient = process.argv.includes("--installed");
const completeDownload = process.argv.includes("--complete");
if (process.argv.includes("--live-profile")) {
  throw new Error(
    "Live-profile CDP acceptance is disabled; use the isolated profile and complete manual acceptance separately"
  );
}
const portablePath = path.join(
  root,
  "release-local-server-client",
  `AI-Hub-Local-${packageJson.version}-Windows-x64-Portable.exe`
);
const installedPath =
  process.env.AIHUB_INSTALLED_CLIENT || "C:\\Program Files\\AI Hub\\AI Hub.exe";
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
    const deadline = Date.now() + 180_000;
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
    process.stdout.write(`${JSON.stringify({ ok: true, productId, task }, null, 2)}\n`);
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
