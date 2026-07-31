import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electron = path.join(
  root,
  "node_modules",
  "electron",
  "dist",
  "electron.exe"
);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-layout-"));
const port = 9226;
const child = spawn(
  electron,
  [
    root,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`
  ],
  {
    cwd: root,
    env: process.env,
    stdio: "ignore",
    windowsHide: true
  }
);

async function waitForPage() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${port}/json`)
      ).json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {
      // Electron is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("layout test could not connect to Electron");
}

try {
  const page = await waitForPage();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const send = (method, params = {}) => {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "layout evaluation failed");
    }
    return result.result.value;
  };
  await send("Runtime.enable");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(
      "Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.includes('Anthropic')))"
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await evaluate(
    "[...document.querySelectorAll('button')].find((button) => button.textContent.includes('Anthropic')).click()"
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  const result = await evaluate(`(() => {
    const row = [...document.querySelectorAll('.productRow')].find((item) =>
      item.textContent.includes('Claude Desktop')
    );
    if (!row) return { ok: false, reason: 'Claude row not found' };
    const buttons = [...row.querySelectorAll('button')];
    const centers = buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent.trim(),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        centerY: Math.round(rect.y + rect.height / 2)
      };
    });
    const spread = Math.max(...centers.map((item) => item.centerY)) -
      Math.min(...centers.map((item) => item.centerY));
    return {
      ok: buttons.length === 3 && spread <= 4,
      width: Math.round(row.getBoundingClientRect().width),
      spread,
      centers
    };
  })()`);
  socket.close();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
} finally {
  spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], {
    stdio: "ignore",
    windowsHide: true
  });
  await new Promise((resolve) => setTimeout(resolve, 750));
  fs.rmSync(userData, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  });
}
