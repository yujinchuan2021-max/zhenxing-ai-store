import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertWithinTemporaryRoot(target, label) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const resolved = path.resolve(target);
  const relative = path.relative(temporaryRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child of the system temporary directory`);
  }
  return resolved;
}

export async function availableLoopbackPort() {
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
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("No loopback CDP port was available");
  }
  return port;
}

export function assertNoExistingAIHubProcesses() {
  if (process.platform !== "win32") return;
  const command = [
    "$items=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'AI Hub.exe' -or $_.Name -like 'AI-Hub-Local-*-Portable.exe' })",
    "[Console]::Out.Write($items.Count)"
  ].join("; ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { encoding: "utf8", windowsHide: true, shell: false }
  );
  if (result.error) throw result.error;
  const count = Number.parseInt(String(result.stdout || "").trim(), 10);
  if (result.status !== 0 || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("Unable to inspect existing AI Hub processes safely");
  }
  if (count > 0) {
    throw new Error(
      "Close the running AI Hub client before packaged acceptance; the gate refuses to reuse or terminate a live user session"
    );
  }
}

export function createIsolatedAcceptanceProfile(prefix) {
  if (typeof prefix !== "string" || !/^aihub-[a-z0-9-]+-$/.test(prefix)) {
    throw new Error("Acceptance profile prefix is invalid");
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const appData = path.join(root, "Roaming");
  const localAppData = path.join(root, "Local");
  const userData = path.join(appData, "aihub-pc-client");
  const downloadDirectory = path.join(root, "downloads");
  const codexHome = path.join(root, "codex-home");
  for (const directory of [appData, localAppData, userData, downloadDirectory]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(
    path.join(userData, "pc-settings.json"),
    `${JSON.stringify(
      { downloadDirectory, cliInstallDirectory: "", language: "zh" },
      null,
      2
    )}\n`,
    "utf8"
  );
  return { root, appData, localAppData, userData, downloadDirectory, codexHome };
}

function stopAcceptanceProcesses(userData) {
  if (process.platform !== "win32") return;
  assertWithinTemporaryRoot(userData, "Acceptance user data");
  const command = [
    "$target=[Environment]::GetEnvironmentVariable('AIHUB_TEST_USER_DATA')",
    "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
  ].join("; ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      env: { ...process.env, AIHUB_TEST_USER_DATA: userData },
      stdio: "ignore",
      windowsHide: true,
      shell: false
    }
  );
  if (result.error) throw result.error;
}

export async function removeIsolatedAcceptanceProfile(profile) {
  const root = assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 29) throw error;
      await delay(500);
    }
  }
}

function createCdpConnection(socket) {
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("CDP connection closed before the command completed"));
    }
    pending.clear();
  });
  function send(method, params = {}, timeoutMs = 15_000) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
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
        result.exceptionDetails.exception?.description || "CDP evaluation failed"
      );
    }
    return result.result.value;
  }
  return { send, evaluate };
}

export async function launchPackagedClientCdp({
  executable,
  profile,
  appArguments = [],
  extraEnvironment = {},
  assertNoExistingClient = true,
  startupTimeoutMs = 30_000
}) {
  if (!path.isAbsolute(executable) || !fs.statSync(executable).isFile()) {
    throw new Error(`Packaged acceptance client is missing: ${executable}`);
  }
  assertWithinTemporaryRoot(profile?.root || "", "Acceptance profile");
  assertWithinTemporaryRoot(profile?.userData || "", "Acceptance user data");
  if (assertNoExistingClient) assertNoExistingAIHubProcesses();
  const port = await availableLoopbackPort();
  const launcher = spawn(
    executable,
    [
      ...appArguments,
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile.userData}`
    ],
    {
      detached: true,
      env: {
        ...process.env,
        ...extraEnvironment,
        APPDATA: profile.appData,
        LOCALAPPDATA: profile.localAppData,
        CODEX_HOME: profile.codexHome
      },
      stdio: "ignore",
      windowsHide: true,
      shell: false
    }
  );
  launcher.unref();

  let target;
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      target = targets.find((item) => item.type === "page");
      if (target) break;
    } catch {
      // The isolated packaged client is still starting.
    }
    await delay(250);
  }
  if (!target) {
    stopAcceptanceProcesses(profile.userData);
    throw new Error("Packaged acceptance client did not expose a CDP page");
  }
  const debuggerUrl = new URL(target.webSocketDebuggerUrl);
  if (
    debuggerUrl.protocol !== "ws:" ||
    !["127.0.0.1", "localhost"].includes(debuggerUrl.hostname) ||
    Number(debuggerUrl.port) !== port
  ) {
    stopAcceptanceProcesses(profile.userData);
    throw new Error("Packaged acceptance exposed a non-loopback CDP target");
  }
  let socket;
  let connection;
  try {
    socket = new WebSocket(debuggerUrl.href);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    connection = createCdpConnection(socket);
    await connection.send("Runtime.enable");
  } catch (error) {
    socket?.close();
    stopAcceptanceProcesses(profile.userData);
    throw error;
  }
  return {
    target,
    evaluate: connection.evaluate,
    async close() {
      socket?.close();
      stopAcceptanceProcesses(profile.userData);
      await delay(250);
    }
  };
}

export async function verifyManagedDownloadPause({
  evaluate,
  productId,
  minimumBytes = 1024 * 1024,
  timeoutMs = 120_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    !productId ||
    !Number.isSafeInteger(minimumBytes) ||
    minimumBytes < 1
  ) {
    throw new Error("Managed download gate input is invalid");
  }
  const readyDeadline = Date.now() + 20_000;
  while (Date.now() < readyDeadline) {
    if (await evaluate("Boolean(window.aihubPC?.startDownload)")) break;
    await delay(250);
  }
  if (!(await evaluate("Boolean(window.aihubPC?.startDownload)"))) {
    throw new Error("Managed download API was not available in the packaged client");
  }
  const encodedProductId = JSON.stringify(productId);
  const started = await evaluate(`window.aihubPC.startDownload(${encodedProductId})`);
  if (!started?.ok) {
    throw new Error(`Managed download did not start: ${JSON.stringify(started)}`);
  }
  const deadline = Date.now() + timeoutMs;
  let task = started.task;
  while (Date.now() < deadline) {
    task = await evaluate(`window.aihubPC.getDownloadTask(${encodedProductId})`);
    if (task?.phase === "failed") {
      throw new Error(
        `Managed download failed before pause: ${JSON.stringify({
          code: task.errorCode,
          message: task.errorMessage
        })}`
      );
    }
    if (task?.phase === "completed") {
      throw new Error("Managed download completed before the pause gate could run");
    }
    if ((task?.progress?.receivedBytes || 0) >= minimumBytes) {
      const paused = await evaluate(`window.aihubPC.pauseDownload(${encodedProductId})`);
      if (paused?.task?.phase !== "paused") {
        throw new Error(`Managed download did not pause: ${JSON.stringify(paused)}`);
      }
      return {
        productId,
        phase: paused.task.phase,
        receivedBytes: paused.task.progress?.receivedBytes || 0,
        sourceUrl: paused.task.sourceUrl || ""
      };
    }
    await delay(250);
  }
  throw new Error(`Managed download did not reach the pause threshold: ${JSON.stringify(task)}`);
}
