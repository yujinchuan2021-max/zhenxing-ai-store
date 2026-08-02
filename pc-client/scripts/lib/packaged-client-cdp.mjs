import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const PACKAGED_DOM_ACTIONS = new Set([
  "install-product",
  "refresh-product",
  "pause-download",
  "install-extension",
  "uninstall-extension"
]);

export function assertPackagedRemoteCatalog({
  catalog,
  minimumCatalogVersion
}) {
  if (
    !Number.isSafeInteger(minimumCatalogVersion) ||
    minimumCatalogVersion < 0 ||
    catalog?.source !== "remote" ||
    !Number.isSafeInteger(catalog.catalogVersion) ||
    catalog.catalogVersion < minimumCatalogVersion ||
    !Array.isArray(catalog.catalog?.vendors)
  ) {
    throw new Error(
      `Packaged client did not accept the minimum remote signed catalog: ${JSON.stringify(
        catalog
      )}`
    );
  }
  return catalog;
}

function assertPackagedDomActionInput({
  evaluate,
  productId,
  action,
  extensionProfileId = "",
  timeoutMs
}) {
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    !productId ||
    !PACKAGED_DOM_ACTIONS.has(action) ||
    typeof extensionProfileId !== "string" ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    ((action === "install-extension" || action === "uninstall-extension") &&
      !extensionProfileId)
  ) {
    throw new Error("Packaged DOM action input is invalid");
  }
}

function packagedDomActionSnapshotExpression({
  productId,
  action,
  extensionProfileId = ""
}) {
  return `(() => {
    const productId = ${JSON.stringify(productId)};
    const action = ${JSON.stringify(action)};
    const extensionProfileId = ${JSON.stringify(extensionProfileId)};
    const byAttribute = (root, attribute, value) =>
      Array.from(root.querySelectorAll(\`[\${attribute}]\`)).find(
        (element) => element.getAttribute(attribute) === value
      );
    const product = byAttribute(document, "data-aihub-product-id", productId);
    const actionRoot = extensionProfileId
      ? product && byAttribute(
          product,
          "data-aihub-extension-profile-id",
          extensionProfileId
        )
      : product;
    const button = actionRoot && byAttribute(
      actionRoot,
      "data-aihub-action",
      action
    );
    return {
      found: button instanceof HTMLButtonElement,
      disabled: button instanceof HTMLButtonElement ? button.disabled : null,
      label: button instanceof HTMLButtonElement ? button.innerText.trim() : ""
    };
  })()`;
}

export async function waitForPackagedDomAction({
  evaluate,
  productId,
  action,
  extensionProfileId = "",
  requireEnabled = true,
  timeoutMs = 10_000
}) {
  assertPackagedDomActionInput({
    evaluate,
    productId,
    action,
    extensionProfileId,
    timeoutMs
  });
  if (typeof requireEnabled !== "boolean") {
    throw new Error("Packaged DOM action readiness input is invalid");
  }
  const deadline = Date.now() + timeoutMs;
  let snapshot = null;
  while (Date.now() < deadline) {
    snapshot = await evaluate(
      packagedDomActionSnapshotExpression({
        productId,
        action,
        extensionProfileId
      })
    );
    if (
      snapshot?.found === true &&
      (!requireEnabled || snapshot.disabled === false)
    ) {
      return snapshot;
    }
    await delay(100);
  }
  throw new Error(
    `Packaged DOM action was not ready: ${JSON.stringify({
      productId,
      action,
      extensionProfileId,
      snapshot
    })}`
  );
}

export async function clickPackagedDomAction({
  evaluate,
  productId,
  action,
  extensionProfileId = "",
  timeoutMs = 8_000
}) {
  assertPackagedDomActionInput({
    evaluate,
    productId,
    action,
    extensionProfileId,
    timeoutMs
  });
  const result = await evaluate(`(() => {
    const productId = ${JSON.stringify(productId)};
    const action = ${JSON.stringify(action)};
    const extensionProfileId = ${JSON.stringify(extensionProfileId)};
    const timeoutMs = ${timeoutMs};
    const byAttribute = (root, attribute, value) =>
      Array.from(root.querySelectorAll(\`[\${attribute}]\`)).find(
        (element) => element.getAttribute(attribute) === value
      );
    const product = byAttribute(document, "data-aihub-product-id", productId);
    const actionRoot = extensionProfileId
      ? product && byAttribute(
          product,
          "data-aihub-extension-profile-id",
          extensionProfileId
        )
      : product;
    const actionButton = actionRoot && byAttribute(
      actionRoot,
      "data-aihub-action",
      action
    );
    if (!(actionButton instanceof HTMLButtonElement) || actionButton.disabled) {
      return {
        clicked: false,
        busyObserved: false,
        label: actionButton instanceof HTMLButtonElement
          ? actionButton.innerText.trim()
          : ""
      };
    }
    return new Promise((resolve) => {
      let clicked = false;
      let settled = false;
      const finish = (busyObserved, label) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        observer.disconnect();
        resolve({ clicked, busyObserved, label });
      };
      const inspect = () => {
        const currentProduct = byAttribute(
          document,
          "data-aihub-product-id",
          productId
        );
        const currentRoot = extensionProfileId
          ? currentProduct && byAttribute(
              currentProduct,
              "data-aihub-extension-profile-id",
              extensionProfileId
            )
          : currentProduct;
        const busyAction = ["install-product", "refresh-product"].includes(action)
          ? "product-busy"
          : action;
        const busyButton = currentRoot && byAttribute(
          currentRoot,
          "data-aihub-action",
          busyAction
        );
        if (busyButton instanceof HTMLButtonElement && busyButton.disabled) {
          finish(true, busyButton.innerText.trim());
        }
      };
      const observer = new MutationObserver(inspect);
      observer.observe(product, {
        attributes: true,
        attributeFilter: ["disabled", "data-aihub-action"],
        childList: true,
        subtree: true
      });
      const timeout = setTimeout(() => finish(false, ""), timeoutMs);
      actionButton.click();
      clicked = true;
      inspect();
    });
  })()`);
  if (result?.clicked !== true || result?.busyObserved !== true) {
    throw new Error(
      `Packaged DOM action did not expose disabled busy feedback: ${JSON.stringify({
        productId,
        action,
        extensionProfileId,
        result
      })}`
    );
  }
  return result;
}

export function packagedManagedDownloadAction(status) {
  return status?.installed === true ? "refresh-product" : "install-product";
}

export async function openPackagedCatalogProduct({
  evaluate,
  vendorId,
  productId,
  searchText,
  timeoutMs = 10_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof vendorId !== "string" ||
    !vendorId ||
    typeof productId !== "string" ||
    !productId ||
    typeof searchText !== "string" ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Packaged catalog navigation input is invalid");
  }
  const submitted = await evaluate(`(() => {
    const form = Array.from(document.querySelectorAll("form")).find(
      (element) => element.getAttribute("data-aihub-action") === "catalog-search"
    );
    const input = form && form.querySelector("input");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
      return false;
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    if (!setter) return false;
    setter.call(input, ${JSON.stringify(searchText)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  if (submitted !== true) {
    throw new Error("Packaged catalog search form was not available");
  }

  const deadline = Date.now() + timeoutMs;
  let vendorClicked = false;
  while (Date.now() < deadline) {
    vendorClicked = await evaluate(`(() => {
      const vendorId = ${JSON.stringify(vendorId)};
      const button = Array.from(
        document.querySelectorAll("button[data-aihub-vendor-id]")
      ).find((element) => element.getAttribute("data-aihub-vendor-id") === vendorId);
      if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
      button.click();
      return true;
    })()`);
    if (vendorClicked === true) break;
    await delay(100);
  }
  if (!vendorClicked) {
    throw new Error(`Packaged vendor card was not available: ${vendorId}`);
  }

  while (Date.now() < deadline) {
    const productReady = await evaluate(`(() => {
      const productId = ${JSON.stringify(productId)};
      return Array.from(document.querySelectorAll("[data-aihub-product-id]")).some(
        (element) => element.getAttribute("data-aihub-product-id") === productId
      );
    })()`);
    if (productReady === true) {
      return { vendorId, productId, searchText };
    }
    await delay(100);
  }
  throw new Error(`Packaged product row was not available: ${productId}`);
}

export async function openPackagedProductExtensions({
  evaluate,
  productId,
  timeoutMs = 10_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    !productId ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Packaged extension directory input is invalid");
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const opened = await evaluate(`(() => {
      const productId = ${JSON.stringify(productId)};
      const product = Array.from(
        document.querySelectorAll("[data-aihub-product-id]")
      ).find((element) => element.getAttribute("data-aihub-product-id") === productId);
      const details = product && product.querySelector("details.productExtensions");
      const summary = details && details.querySelector("summary");
      if (!(details instanceof HTMLDetailsElement) || !(summary instanceof HTMLElement)) {
        return false;
      }
      if (!details.open) summary.click();
      return details.open;
    })()`);
    if (opened === true) return { productId, opened: true };
    await delay(100);
  }
  throw new Error(`Packaged extension directory was not available: ${productId}`);
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

export async function openCdpWebSocket({
  debuggerUrl,
  timeoutMs,
  createSocket = (url) => new WebSocket(url),
  onFailure = () => {}
}) {
  if (
    typeof debuggerUrl !== "string" ||
    !debuggerUrl ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    typeof createSocket !== "function" ||
    typeof onFailure !== "function"
  ) {
    throw new Error("CDP WebSocket handshake input is invalid");
  }
  let socket;
  try {
    socket = createSocket(debuggerUrl);
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        callback(value);
      };
      const onOpen = () => finish(resolve);
      const onError = (event) =>
        finish(
          reject,
          event instanceof Error ? event : new Error("CDP WebSocket handshake failed")
        );
      const timeout = setTimeout(
        () => finish(reject, new Error("CDP WebSocket handshake timed out")),
        timeoutMs
      );
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
    });
    return socket;
  } catch (error) {
    try {
      socket?.close();
    } catch {
      // Preserve the handshake failure.
    }
    try {
      onFailure();
    } catch {
      // Preserve the handshake failure.
    }
    throw error;
  }
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
  let connectionFailureHandled = false;
  const cleanupFailedConnection = () => {
    if (connectionFailureHandled) return;
    connectionFailureHandled = true;
    stopAcceptanceProcesses(profile.userData);
  };
  try {
    socket = await openCdpWebSocket({
      debuggerUrl: debuggerUrl.href,
      timeoutMs: Math.max(1, deadline - Date.now()),
      onFailure: cleanupFailedConnection
    });
    connection = createCdpConnection(socket);
    await connection.send("Runtime.enable");
  } catch (error) {
    socket?.close();
    cleanupFailedConnection();
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
  downloadDirectory,
  startDownload = null,
  pauseDownload = null,
  minimumBytes = 1024 * 1024,
  timeoutMs = 120_000
}) {
  if (
    typeof evaluate !== "function" ||
    typeof productId !== "string" ||
    !productId ||
    typeof downloadDirectory !== "string" ||
    !path.isAbsolute(downloadDirectory) ||
    (startDownload !== null && typeof startDownload !== "function") ||
    (pauseDownload !== null && typeof pauseDownload !== "function") ||
    !Number.isSafeInteger(minimumBytes) ||
    minimumBytes < 1 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new Error("Managed download gate input is invalid");
  }
  const usesDomActions = startDownload !== null || pauseDownload !== null;
  const readinessExpression = usesDomActions
    ? "Boolean(window.aihubPC?.getDownloadTask)"
    : "Boolean(window.aihubPC?.startDownload && window.aihubPC?.getDownloadTask && window.aihubPC?.pauseDownload)";
  const readyDeadline = Date.now() + 20_000;
  while (Date.now() < readyDeadline) {
    if (await evaluate(readinessExpression)) break;
    await delay(250);
  }
  if (!(await evaluate(readinessExpression))) {
    throw new Error("Managed download API was not available in the packaged client");
  }
  const encodedProductId = JSON.stringify(productId);
  const started = startDownload
    ? await startDownload({ evaluate, productId, timeoutMs })
    : await evaluate(`window.aihubPC.startDownload(${encodedProductId})`);
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
      const paused = pauseDownload
        ? await pauseDownload({ evaluate, productId, task, timeoutMs })
        : await evaluate(`window.aihubPC.pauseDownload(${encodedProductId})`);
      const pausedBytes = paused?.task?.progress?.receivedBytes;
      const taskDirectory = paused?.task?.progress?.downloadDirectory;
      const expectedDirectory = path.resolve(downloadDirectory);
      const sameDirectory =
        typeof taskDirectory === "string" &&
        path.resolve(taskDirectory).toLowerCase() === expectedDirectory.toLowerCase();
      if (
        paused?.ok !== true ||
        paused?.task?.phase !== "paused"
      ) {
        throw new Error(`Managed download did not pause: ${JSON.stringify(paused)}`);
      }
      if (
        paused?.task?.resumable !== true ||
        !Number.isSafeInteger(pausedBytes) ||
        pausedBytes < minimumBytes ||
        !sameDirectory
      ) {
        throw new Error(
          `Managed download durable partial did not satisfy the pause gate: ${JSON.stringify(paused)}`
        );
      }
      const directoryStat = fs.lstatSync(expectedDirectory);
      const canonicalDirectory = fs.realpathSync.native(expectedDirectory);
      if (
        !directoryStat.isDirectory() ||
        directoryStat.isSymbolicLink() ||
        canonicalDirectory.toLowerCase() !== expectedDirectory.toLowerCase()
      ) {
        throw new Error("Managed download durable partial directory is invalid");
      }
      const partials = fs
        .readdirSync(canonicalDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".part"))
        .map((entry) => path.join(canonicalDirectory, entry.name));
      if (partials.length !== 1) {
        throw new Error("Managed download durable partial was not uniquely identified");
      }
      const partialPath = partials[0];
      const partialStat = fs.lstatSync(partialPath);
      const canonicalPartial = fs.realpathSync.native(partialPath);
      if (
        !partialStat.isFile() ||
        partialStat.isSymbolicLink() ||
        path.dirname(canonicalPartial).toLowerCase() !==
          canonicalDirectory.toLowerCase() ||
        partialStat.size !== pausedBytes ||
        partialStat.size < minimumBytes
      ) {
        throw new Error("Managed download durable partial did not reach the gate");
      }
      return {
        productId,
        phase: paused.task.phase,
        receivedBytes: pausedBytes,
        partialPath: canonicalPartial
      };
    }
    await delay(250);
  }
  throw new Error(`Managed download did not reach the pause threshold: ${JSON.stringify(task)}`);
}
