import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
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
const fixtureDirectory = path.join(userData, "fixture-download");
const fixturePath = path.join(fixtureDirectory, "Claude-Setup-x64.exe");
fs.mkdirSync(fixtureDirectory);
fs.writeFileSync(fixturePath, "ZhenXing AI downloaded package layout fixture");
const fixtureBytes = fs.statSync(fixturePath).size;
const fixtureSha256 = crypto
  .createHash("sha256")
  .update(fs.readFileSync(fixturePath))
  .digest("hex");
fs.writeFileSync(
  path.join(userData, "download-records.json"),
  JSON.stringify({
    "claude-desktop": {
      productId: "claude-desktop",
      filePath: fixturePath,
      downloadRoot: fixtureDirectory,
      sha256: fixtureSha256,
      fileSize: fixtureBytes,
      resumedFrom: 0,
      downloadedAt: "2026-07-31T00:00:00.000Z",
      url: "https://claude.ai/api/desktop/win32/x64/setup/latest/redirect",
      source: ""
    }
  })
);
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
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          "layout evaluation failed"
      );
    }
    return result.result.value;
  };
  await send("Runtime.enable");
  let openedVendorDirectory = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    openedVendorDirectory = await evaluate(`(() => {
      const button = [...document.querySelectorAll('.navItem')].find(
        (candidate) => candidate.textContent.includes('全部厂商')
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (openedVendorDirectory) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!openedVendorDirectory) {
    const startupState = await evaluate(`({
      title: document.title,
      body: document.body?.innerText?.slice(0, 1000) || '',
      buttons: [...document.querySelectorAll('button')]
        .slice(0, 20)
        .map((button) => button.textContent.trim())
    })`);
    throw new Error(
      `vendor directory navigation was not rendered: ${JSON.stringify(startupState)}`
    );
  }
  let vendorDirectoryReady = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(
      "Boolean([...document.querySelectorAll('.vendorCard')].find((button) => button.textContent.includes('OpenAI')))"
    );
    if (ready) {
      vendorDirectoryReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!vendorDirectoryReady) {
    const startupState = await evaluate(`(async () => ({
      title: document.title,
      body: document.body?.innerText?.slice(0, 1000) || '',
      buttons: [...document.querySelectorAll('button')]
        .slice(0, 20)
        .map((button) => button.textContent.trim()),
      catalog: await window.aihubPC?.getCatalog?.()
    }))()`);
    throw new Error(
      `vendor directory did not render at ${page.url}: ${JSON.stringify(startupState)}`
    );
  }
  const catalogExpansionResult = await evaluate(`(() => {
    const ids = [...document.querySelectorAll('.vendorCard')]
      .map((card) => card.dataset.aihubVendorId);
    const required = [
      'quora',
      'jan',
      'cherryhq',
      'msty',
      'genspark',
      'qihoo360',
      'iflytek',
      'youdao',
      'topazlabs'
    ];
    return {
      ok: ids.length === 100 && required.every((id) => ids.includes(id)),
      vendorCount: ids.length,
      missing: required.filter((id) => !ids.includes(id))
    };
  })()`);
  const vendorFilterResult = {};
  for (const [initial, expectedVendorIds] of Object.entries({
    A: ["alibaba", "anthropic"],
    S: ["deepseek", "sensetime"],
    Y: ["moonshot"],
    Z: ["bytedance", "zhipu"]
  })) {
    const clicked = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.filterRow')];
      const button = [...(rows[1]?.querySelectorAll('button') || [])].find(
        (candidate) => candidate.textContent.trim() === ${JSON.stringify(initial)}
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const visibleVendorIds = await evaluate(
      "[...document.querySelectorAll('.vendorCard')].map((card) => card.dataset.aihubVendorId)"
    );
    vendorFilterResult[initial] = {
      clicked,
      visibleVendorIds,
      ok:
        clicked &&
        expectedVendorIds.every((vendorId) => visibleVendorIds.includes(vendorId))
    };
  }
  await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.filterRow')];
    const button = [...(rows[1]?.querySelectorAll('button') || [])].find(
      (candidate) => candidate.textContent.trim() === '全部'
    );
    button?.click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const networkNoticeVisible = await evaluate(
    "Boolean(document.querySelector('[data-aihub-vendor-id=\"openai\"]')?.textContent.includes('（中国用户需要科学上网）'))"
  );
  await evaluate(
    "[...document.querySelectorAll('.vendorCard')].find((button) => button.textContent.includes('OpenAI')).click()"
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  const productResult = await evaluate(`(() => {
    const row = document.querySelector('[data-aihub-product-id="chatgpt-desktop"]');
    const cli = document.querySelector('[data-aihub-product-id="codex-cli"]');
    if (!row) return { ok: false, reason: 'ChatGPT row not found' };
    if (!cli) return { ok: false, reason: 'Codex CLI row not found' };
    const buttons = [...row.querySelectorAll('button')].map((button) =>
      button.textContent.trim()
    );
    const rows = [...document.querySelectorAll('.productRow')];
    return {
      ok:
        row.querySelector('h4')?.textContent.trim() === 'ChatGPT' &&
        buttons.includes('工具官网 ↗') &&
        buttons.includes('ChatGPT 网页版 ↗') &&
        row.textContent.includes('可视化应用') &&
        cli.textContent.includes('命令行工具') &&
        cli.textContent.includes('终端窗口') &&
        rows.filter((item) => item.querySelector('h4')?.textContent.trim() === 'ChatGPT').length === 1 &&
        !document.body.textContent.includes('ChatGPT Web') &&
        !row.textContent.includes('SHA-256') &&
        !row.textContent.includes('任务记录'),
      width: Math.round(row.getBoundingClientRect().width),
      buttons,
      cliText: cli.textContent.trim().replace(/\s+/g, ' ')
    };
  })()`);
  await evaluate(
    "[...document.querySelectorAll('.topActions button')].find((button) => button.textContent.trim() === '已安装').click()"
  );
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const ready = await evaluate(
      "Boolean([...document.querySelectorAll('.managementCard')].find((item) => item.textContent.includes('Docker')))"
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const managementResult = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('.managementCard')];
    const docker = cards.find((item) =>
      item.textContent.includes('Docker') &&
      item.textContent.includes('运行环境')
    );
    const chatgpt = cards.find((item) =>
      item.textContent.includes('ChatGPT') &&
      item.textContent.includes('桌面端')
    );
    const installer = cards.find((item) =>
      item.textContent.includes('Claude') &&
      item.textContent.includes('Claude-Setup-x64.exe')
    );
    const dockerButtons = docker
      ? [...docker.querySelectorAll('button')].map((button) => ({
          text: button.textContent.trim(),
          disabled: button.disabled
        }))
      : [];
    const installerButtons = installer
      ? [...installer.querySelectorAll('button')].map((button) =>
          button.textContent.trim()
        )
      : [];
    const chatgptButtons = chatgpt
      ? [...chatgpt.querySelectorAll('button')].map((button) => ({
          text: button.textContent.trim(),
          disabled: button.disabled
        }))
      : [];
    return {
      ok:
        Boolean(docker) &&
        dockerButtons.some((button) => button.text === '打开') &&
        dockerButtons.some((button) => button.text === '关闭') &&
        dockerButtons.some(
          (button) => button.text === '卸载' && !button.disabled
        ) &&
        Boolean(chatgpt) &&
        chatgptButtons.some(
          (button) => button.text === '打开' && !button.disabled
        ) &&
        chatgptButtons.some(
          (button) => button.text === '卸载' && !button.disabled
        ) &&
        Boolean(installer) &&
        installerButtons.includes('立即安装') &&
        installerButtons.includes('打开文件夹') &&
        installerButtons.includes('删除安装包'),
      dockerButtons,
      chatgptButtons,
      installerButtons,
      cardTexts: cards.map((item) => item.textContent.trim().replace(/\s+/g, ' '))
    };
  })()`);
  await evaluate(
    "[...document.querySelectorAll('.topActions button')].find((button) => button.textContent.includes('设置')).click()"
  );
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(
      "Boolean(document.querySelector('.settingsPanel .environmentList'))"
    );
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const settingsResult = await evaluate(`(() => {
    const docker = [...document.querySelectorAll('.environmentList > div')]
      .find((item) => item.textContent.includes('Docker'));
    const uninstall = docker
      ? [...docker.querySelectorAll('button')]
          .find((button) => button.textContent.includes('卸载'))
      : null;
    return {
      ok: Boolean(docker && uninstall && !uninstall.disabled),
      uninstallText: uninstall?.textContent.trim() || '',
      disabled: uninstall?.disabled ?? null
    };
  })()`);
  socket.close();
  const result = {
    ok:
      catalogExpansionResult.ok &&
      Object.values(vendorFilterResult).every((item) => item.ok) &&
      networkNoticeVisible &&
      productResult.ok &&
      managementResult.ok &&
      settingsResult.ok,
    vendorFilters: vendorFilterResult,
    catalogExpansion: catalogExpansionResult,
    networkNoticeVisible,
    product: productResult,
    management: managementResult,
    settings: settingsResult
  };
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
