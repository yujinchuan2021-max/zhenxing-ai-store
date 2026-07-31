import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "deployment",
      "local",
      "runtime",
      "current",
      "public",
      "release-manifest.json"
    ),
    "utf8"
  )
);
const baseVersion =
  process.env.AIHUB_LOCAL_RELEASE_BASE_VERSION || "0.1.5";
const portablePath = path.resolve(
  process.env.AIHUB_LOCAL_RELEASE_CLIENT ||
    path.join(
      root,
      "release-local-server-client",
      `AI-Hub-${baseVersion}-Windows-x64-Portable.exe`
    )
);

if (process.platform !== "win32") {
  throw new Error("本地发布客户端验收当前仅支持 Windows");
}
if (!fs.existsSync(portablePath)) {
  throw new Error(`本地发布验收客户端不存在：${portablePath}`);
}

async function availablePort() {
  if (process.env.AIHUB_CDP_PORT) return Number(process.env.AIHUB_CDP_PORT);
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (!port) throw new Error("无法分配本地发布验收端口");
  return port;
}

function stopAcceptanceProcesses(userData) {
  const command = [
    "$target=[Environment]::GetEnvironmentVariable('AIHUB_TEST_USER_DATA')",
    "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
  ].join("; ");
  return spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      env: { ...process.env, AIHUB_TEST_USER_DATA: userData },
      stdio: "ignore",
      windowsHide: true
    }
  );
}

async function removeAcceptanceDirectory(userData) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const resolvedUserData = path.resolve(userData);
  if (
    !resolvedUserData.startsWith(
      `${temporaryRoot}${path.sep}`,
      process.platform === "win32" ? 0 : undefined
    )
  ) {
    throw new Error("本地发布验收目录超出系统临时目录");
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(resolvedUserData, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

const cdpPort = await availablePort();
const userData = fs.mkdtempSync(
  path.join(os.tmpdir(), "aihub-local-release-client-")
);
let socket;

try {
  const launcher = spawn(
    portablePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userData}`
    ],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    }
  );
  launcher.unref();

  const deadline = Date.now() + 30_000;
  let target;
  while (Date.now() < deadline) {
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${cdpPort}/json`)
      ).json();
      target = targets.find((item) => item.type === "page");
      if (target) break;
    } catch {
      // The isolated packaged client is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!target) throw new Error("本地发布验收客户端没有开放 CDP 页面");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callbacks = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message));
    else callbacks.resolve(message.result);
  });

  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description || "客户端页面执行失败"
      );
    }
    return result.result.value;
  }

  await send("Runtime.enable");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate("Boolean(window.aihubPC && document.body.innerText)")) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const catalog = await evaluate("window.aihubPC.getCatalog()");
  if (
    catalog?.source !== "remote" ||
    catalog.catalogVersion !== manifest.catalog.catalogVersion ||
    !Array.isArray(catalog.catalog?.vendors)
  ) {
    throw new Error(
      `客户端没有接受远程签名目录：${JSON.stringify(catalog)}`
    );
  }

  const update = await evaluate("window.aihubPC.checkForUpdate()");
  if (
    update?.status !== "available" ||
    update.version !== manifest.update.version ||
    update.fileSize !== manifest.update.fileSize ||
    update.sha256 !== manifest.update.sha256
  ) {
    throw new Error(`客户端没有接受签名更新：${JSON.stringify(update)}`);
  }

  const bodyText = await evaluate("document.body.innerText");
  if (!bodyText.includes("AI")) {
    throw new Error("客户端主界面没有完成渲染");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        clientVersion: baseVersion,
        page: target.url,
        catalog: {
          source: catalog.source,
          catalogVersion: catalog.catalogVersion,
          vendors: catalog.catalog.vendors.length
        },
        update
      },
      null,
      2
    )}\n`
  );
} finally {
  socket?.close();
  stopAcceptanceProcesses(userData);
  await removeAcceptanceDirectory(userData);
}
