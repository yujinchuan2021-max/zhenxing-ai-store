import assert from "node:assert/strict";
import crypto from "node:crypto";
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
const identityOrigin = "http://127.0.0.1:4180";
const mailOrigin = "http://127.0.0.1:8025";
const communityOrigin = "http://127.0.0.1:8088";
const suffix = Date.now().toString(36);
const email = `pc-center-${suffix}@aihub.local`;
const username = `pc_center_${suffix}`;
const nickname = `验收用户${suffix.slice(-4)}`;
const password = `AIHub-${suffix}-Secure9`;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-personal-center-"));
const port = 9228;

async function jsonRequest(origin, pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const value = await response.json();
  if (!response.ok) {
    throw new Error(value.message || `HTTP ${response.status}`);
  }
  return value;
}

async function provisionUser() {
  const challenge = await jsonRequest(
    identityOrigin,
    "/v1/registration/challenges",
    {
      method: "POST",
      body: { email }
    }
  );
  let code = "";
  for (let attempt = 0; attempt < 50 && !code; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mailbox = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
    const message = mailbox.messages.find((candidate) =>
      candidate.To?.some(
        (recipient) =>
          recipient.Address.toLowerCase() === email.toLowerCase()
      )
    );
    code = message?.Snippet?.match(/(\d{6})/)?.[1] || "";
  }
  assert.match(code, /^\d{6}$/);
  await jsonRequest(identityOrigin, "/v1/registration/complete", {
    method: "POST",
    body: {
      challengeId: challenge.challengeId,
      code,
      email,
      username,
      nickname,
      password,
      deviceId: crypto.randomUUID(),
      deviceName: "Personal center fixture"
    }
  });
}

await provisionUser();
const publicDiscussions = await jsonRequest(
  communityOrigin,
  "/api/discussions?page[limit]=1"
);
const discussionId = String(publicDiscussions.data?.[0]?.id || "");
assert.match(discussionId, /^[0-9]+$/);

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
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${port}/json`)
      ).json();
      const page = targets.find(
        (target) =>
          target.type === "page" &&
          (target.url.startsWith("file:") || target.title.includes("AI Hub"))
      );
      if (page) return page;
    } catch {
      // Electron is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("personal center test could not connect to Electron");
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
          "Electron evaluation failed"
      );
    }
    return result.result.value;
  };
  const waitFor = async (expression, message, timeout = 20_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(message);
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await waitFor(
    "Boolean(document.querySelector('.topActions'))",
    "AI Hub main view did not render"
  );
  await evaluate(
    "[...document.querySelectorAll('.topActions button')].find((button) => button.textContent.trim() === '登录').click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.authModal'))",
    "login modal did not open"
  );
  await evaluate(`(() => {
    const inputs = document.querySelectorAll('.authModal input');
    const set = (element, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], ${JSON.stringify(email)});
    set(inputs[1], ${JSON.stringify(password)});
    document.querySelector('.authModal form').requestSubmit();
  })()`);
  await waitFor(
    `Boolean([...document.querySelectorAll('.topActions button')].find(
      (button) => button.textContent.includes(${JSON.stringify(nickname)})
    )) && !document.querySelector('.authModal')`,
    "PC login did not establish the unified session"
  );

  await evaluate(
    "[...document.querySelectorAll('.topActions button')].find((button) => button.textContent.includes('验收用户')).click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.personalCenter'))",
    "personal center did not open"
  );
  const personalCenter = await evaluate(`(() => {
    const root = document.querySelector('.personalCenter');
    const text = root?.innerText || '';
    const tabs = [...root.querySelectorAll('.personalTabs button')]
      .map((button) => button.textContent.trim());
    return {
      tabs,
      hasProfile: text.includes('公开资料') && text.includes('个签'),
      hasEmail: text.includes('登录邮箱'),
      hasPhone: text.includes('手机号'),
      hasUsername: text.includes('@${username}')
    };
  })()`);
  assert.deepEqual(
    personalCenter.tabs.map((item) => item.replace(" · 新", "")),
    ["资料", "账号安全", "站内信", "收藏", "喜欢"]
  );
  assert.equal(personalCenter.hasProfile, true);
  assert.equal(personalCenter.hasEmail, true);
  assert.equal(personalCenter.hasPhone, true);
  assert.equal(personalCenter.hasUsername, true);

  const updatedNickname = `${nickname}新`;
  await evaluate(`(() => {
    const form = document.querySelector('.personalCard');
    const input = form.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    ).set;
    setter.call(input, ${JSON.stringify(updatedNickname)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
  })()`);
  await waitFor(
    `Boolean([...document.querySelectorAll('.topActions button')].find(
      (button) => button.textContent.includes(${JSON.stringify(updatedNickname)})
    ))`,
    "profile update did not flow back to the PC session"
  );
  const output = path.join(root, "output", "playwright");
  fs.mkdirSync(output, { recursive: true });
  const personalScreenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const personalScreenshotPath = path.join(
    output,
    "personal-center.png"
  );
  fs.writeFileSync(
    personalScreenshotPath,
    Buffer.from(personalScreenshot.data, "base64")
  );

  await evaluate(
    "[...document.querySelectorAll('.personalTabs button')].find((button) => button.textContent.includes('账号安全')).click()"
  );
  await waitFor(
    "document.querySelector('.personalCenter').innerText.includes('登录设备')",
    "security tab did not render"
  );
  await evaluate(
    "[...document.querySelectorAll('.personalTabs button')].find((button) => button.textContent.includes('站内信')).click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.personalList article'))",
    "site messages did not render"
  );

  await evaluate(
    "[...document.querySelectorAll('.sidebar button')].find((button) => button.textContent.includes('社区')).click()"
  );
  await waitFor(
    "Boolean(document.querySelector('webview.communityWebview'))",
    "embedded Flarum webview did not attach"
  );
  await waitFor(
    `(() => {
      const view = document.querySelector('webview.communityWebview');
      return view && view.getURL().startsWith(${JSON.stringify(communityOrigin)});
    })()`,
    "embedded Flarum did not navigate to the approved origin",
    30_000
  );
  await evaluate(
    `document.querySelector('webview.communityWebview').loadURL(${JSON.stringify(
      `${communityOrigin}/d/${discussionId}`
    )})`
  );
  await waitFor(
    "Boolean([...document.querySelectorAll('.embeddedCommunityToolbar button')].find((button) => button.textContent.trim() === '收藏'))",
    "discussion interaction toolbar did not appear",
    20_000
  );
  await evaluate(
    "[...document.querySelectorAll('.embeddedCommunityToolbar button')].find((button) => button.textContent.trim() === '收藏').click()"
  );
  await waitFor(
    "Boolean([...document.querySelectorAll('.embeddedCommunityToolbar button')].find((button) => button.textContent.trim() === '已收藏'))",
    "favorite state did not persist"
  );
  await evaluate(
    "[...document.querySelectorAll('.embeddedCommunityToolbar button')].find((button) => button.textContent.trim() === '喜欢').click()"
  );
  await waitFor(
    "Boolean([...document.querySelectorAll('.embeddedCommunityToolbar button')].find((button) => button.textContent.trim() === '已喜欢'))",
    "like state did not persist"
  );
  await waitFor(
    "!document.querySelector('webview.communityWebview').isLoading()",
    "embedded Flarum did not finish loading"
  );
  await new Promise((resolve) => setTimeout(resolve, 500));

  const community = await evaluate(`(async () => {
    const view = document.querySelector('webview.communityWebview');
    const interactions = await window.aihubPC.listCommunityInteractions();
    return {
      url: view.getURL(),
      partition: view.getAttribute('partition'),
      text: document.querySelector('.embeddedCommunity').innerText,
      interaction: interactions.find(
        (item) => item.discussionId === ${JSON.stringify(discussionId)}
      ) || null
    };
  })()`);
  assert.equal(community.partition, "persist:aihub-community");
  assert.equal(community.url.startsWith(`${communityOrigin}/d/`), true);
  assert.equal(community.text.includes("系统浏览器"), false);
  assert.equal(community.interaction?.favorited, true);
  assert.equal(community.interaction?.liked, true);

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const screenshotPath = path.join(
    output,
    "personal-center-embedded-community.png"
  );
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  socket.close();

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        personalCenter,
        community,
        screenshots: {
          personalCenter: personalScreenshotPath,
          embeddedCommunity: screenshotPath
        }
      },
      null,
      2
    )}\n`
  );
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
