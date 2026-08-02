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
const avatarBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
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
          (target.url.startsWith("file:") || target.title.includes("枕星 AI"))
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
  const runtimeEvents = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method?.startsWith("Runtime.")) {
      runtimeEvents.push(message);
    }
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
    "ZhenXing AI main view did not render"
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
  await waitFor(
    "Boolean(document.querySelector('.topActions .notificationButton')) && Boolean(document.querySelector('.topActions .accountButton'))",
    "unified account controls did not render in the PC top right"
  );
  const unifiedCenter = await evaluate(`window.aihubPC.getPersonalCenter()`);
  assert.equal(unifiedCenter.sources.account, "ready");
  assert.equal(unifiedCenter.sources.community, "ready");
  assert.equal(unifiedCenter.user.username, username);
  assert.ok(Array.isArray(unifiedCenter.notifications));
  assert.ok(Array.isArray(unifiedCenter.interactions));
  assert.ok(Array.isArray(unifiedCenter.sessions));
  const topRight = await evaluate(`(() => {
    const notification = document.querySelector('.topActions .notificationButton');
    const account = document.querySelector('.topActions .accountButton');
    return {
      notificationLabel: notification?.getAttribute('aria-label') || '',
      accountText: account?.textContent || ''
    };
  })()`);
  assert.match(topRight.notificationLabel, /^提醒/);
  assert.equal(topRight.accountText.includes(nickname), true);
  await evaluate("document.querySelector('.topActions .notificationButton').click()");
  await waitFor(
    "document.querySelector('.personalTabs button.active')?.textContent.includes('提醒')",
    "top-right reminder control did not open unified notifications"
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
      hasUsername: text.includes('@${username}'),
      avatarUsesLocalFile:
        Boolean(root.querySelector('.profileCard input[type="file"]')) &&
        ![...root.querySelectorAll('.profileCard input')].some(
          (input) => input.placeholder === 'https://'
        ),
      contactEditors: root.querySelectorAll('.contactEditor').length
    };
  })()`);
  assert.deepEqual(
    personalCenter.tabs.map((item) => item.replace(/\s*·\s*\d+$/, "")),
    ["资料", "账号安全", "提醒", "收藏", "喜欢"]
  );
  assert.equal(personalCenter.hasProfile, true);
  assert.equal(personalCenter.hasEmail, true);
  assert.equal(personalCenter.hasPhone, true);
  assert.equal(personalCenter.hasUsername, true);
  assert.equal(personalCenter.avatarUsesLocalFile, true);
  assert.equal(personalCenter.contactEditors, 0);

  await evaluate(`(() => {
    const bytes = Uint8Array.from(
      atob(${JSON.stringify(avatarBase64)}),
      (character) => character.charCodeAt(0)
    );
    const file = new File([bytes], 'avatar.png', { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('.profileCard input[type="file"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: transfer.files
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(
    `document.querySelector('.avatarPreviewButton img')?.src.startsWith(${JSON.stringify(
      `${identityOrigin}/v1/avatars/`
    )})`,
    "avatar upload did not switch to the persisted identity URL"
  );
  await waitFor(
    `(() => {
      const image = document.querySelector('.avatarPreviewButton img');
      return Boolean(image?.complete && image.naturalWidth > 0);
    })()`,
    "persisted avatar URL did not render in the Electron personal center"
  );
  const renderedAvatar = await evaluate(`(() => {
    const image = document.querySelector('.avatarPreviewButton img');
    return {
      src: image?.src || '',
      complete: Boolean(image?.complete),
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0
    };
  })()`);
  assert.equal(renderedAvatar.complete, true);
  assert.ok(renderedAvatar.naturalWidth > 0);

  const updatedNickname = `${nickname}新`;
  await evaluate(`(() => {
    const form = document.querySelector('.personalCard');
    const input = form.querySelector('input:not([type="file"])');
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
    "[...document.querySelectorAll('.personalTabs button')].find((button) => button.textContent.includes('提醒')).click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.personalList article'))",
    "unified notifications did not render"
  );

  await evaluate(
    "[...document.querySelectorAll('.sidebar button')].find((button) => button.textContent.includes('社区')).click()"
  );
  try {
    await waitFor(
      "Boolean(document.querySelector('webview.communityWebview'))",
      "embedded Flarum webview did not attach"
    );
  } catch (cause) {
    const communityDebug = await evaluate(`({
      href: location.href,
      title: document.title,
      bodyText: document.body.innerText,
      rootHtml: document.querySelector('#root')?.innerHTML || '',
      appText: document.querySelector('.pcApp')?.innerText || '',
      communityText: document.querySelector('.communityContent')?.innerText || '',
      hasCommunityShell: Boolean(document.querySelector('.embeddedCommunity')),
      hasLoginPrompt: Boolean(document.querySelector('.communityLoginRequired')),
      hasAuthModal: Boolean(document.querySelector('.authModal'))
    })`);
    throw new Error(
      `${cause instanceof Error ? cause.message : String(cause)}: ${JSON.stringify(
        communityDebug
      )}; runtime=${JSON.stringify(runtimeEvents.slice(-5))}`
    );
  }
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
    "!document.querySelector('webview.communityWebview').isLoading()",
    "embedded Flarum did not finish loading"
  );
  await evaluate(`(() => {
    const view = document.querySelector('webview.communityWebview');
    window.__aihubCommunityViewBeforeRecovery = view;
    view.dispatchEvent(new Event('render-process-gone'));
    return true;
  })()`);
  await waitFor(
    `(() => {
      const view = document.querySelector('webview.communityWebview');
      return Boolean(
        view &&
        view !== window.__aihubCommunityViewBeforeRecovery
      );
    })()`,
    "embedded Flarum webview was not rebuilt after its renderer disappeared"
  );
  await waitFor(
    `(() => {
      const view = document.querySelector('webview.communityWebview');
      return Boolean(
        view &&
        !view.isLoading() &&
        view.getURL().startsWith(${JSON.stringify(communityOrigin)})
      );
    })()`,
    "embedded Flarum did not recover after its renderer disappeared",
    30_000
  );
  await waitFor(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(
      "Boolean(document.getElementById('aihub-community-refresh'))"
    )})`,
    "community refresh control did not appear beside the Flarum search",
    20_000
  );
  await evaluate(`(() => {
    const view = document.querySelector('webview.communityWebview');
    window.__aihubCommunityRefreshNavigations = 0;
    view.addEventListener(
      'did-start-loading',
      () => {
        window.__aihubCommunityRefreshNavigations += 1;
      },
      { once: true }
    );
    return view.executeJavaScript(
      "document.getElementById('aihub-community-refresh').click()"
    ).catch(() => undefined);
  })()`);
  await waitFor(
    "window.__aihubCommunityRefreshNavigations === 1",
    "community refresh control did not reload the Flarum page"
  );
  await waitFor(
    "!document.querySelector('webview.communityWebview').isLoading()",
    "embedded Flarum did not finish reloading"
  );
  await waitFor(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(
      "Boolean(document.getElementById('aihub-community-refresh'))"
    )})`,
    "community refresh control was not restored after reload",
    20_000
  );
  await waitFor(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(
      "Boolean(document.getElementById('aihub-discussion-list-hint'))"
    )})`,
    "discussion page did not expose the hidden discussion-list hint",
    2_000
  );
  await new Promise((resolve) => setTimeout(resolve, 500));

  const community = await evaluate(`(async () => {
    const view = document.querySelector('webview.communityWebview');
    const refreshPlacement = await view.executeJavaScript(${JSON.stringify(`
      (() => {
        const button = document.getElementById("aihub-community-refresh");
        const item = document.getElementById("aihub-community-refresh-item");
        const search = document.querySelector(
          "#header-secondary .Search, .Header-secondary .Search, .Search"
        );
        const anchor = search?.closest("li") || search;
        const buttonRect = button?.getBoundingClientRect();
        const searchRect = search?.getBoundingClientRect();
        const pageText = document.body.innerText;
        const rootStyle = getComputedStyle(document.documentElement);
        const refreshStyle = button ? getComputedStyle(button) : null;
        const hero = document.querySelector(".DiscussionHero");
        const visibleSecondaryItems = [
          ...document.querySelectorAll("#header-secondary > ul > li")
        ].filter((element) => getComputedStyle(element).display !== "none");
        const headerTitle = document.querySelector(".Header-title");
        const headerPrimary = document.querySelector("#header-primary");
        const backControl = document.querySelector(".App-backControl");
        const appNavigation = document.querySelector("#app-navigation");
        const headerNavigation = document.querySelector("#header-navigation");
        const discussionHint = document.getElementById(
          "aihub-discussion-list-hint"
        );
        const discussionHintStyle = discussionHint
          ? getComputedStyle(discussionHint)
          : null;
        const discussionHintRect = discussionHint?.getBoundingClientRect();
        return {
          exists: Boolean(button),
          searchExists: Boolean(search),
          followsSearch: Boolean(anchor && item && anchor.nextElementSibling === item),
          label: button?.getAttribute("aria-label") || "",
          flarumLocale:
            typeof app !== "undefined" ? app.data.locale : "",
          theme: document.documentElement.getAttribute("data-aihub-theme"),
          bodyBackground: rootStyle.getPropertyValue("--body-bg").trim(),
          primaryColor: rootStyle.getPropertyValue("--primary-color").trim(),
          refreshBackground: refreshStyle?.backgroundColor || "",
          heroBackground: hero ? getComputedStyle(hero).backgroundColor : "",
          visibleSecondaryItems: visibleSecondaryItems.map(
            (element) => element.id || element.className
          ),
          headerTitleVisible:
            Boolean(headerTitle) && getComputedStyle(headerTitle).display !== "none",
          headerPrimaryVisible:
            Boolean(headerPrimary) && getComputedStyle(headerPrimary).display !== "none",
          backControlVisible:
            Boolean(backControl) && getComputedStyle(backControl).display !== "none",
          appNavigationVisible:
            Boolean(appNavigation) && getComputedStyle(appNavigation).display !== "none",
          headerNavigationVisible:
            Boolean(headerNavigation) && getComputedStyle(headerNavigation).display !== "none",
          discussionHint: discussionHint
            ? {
                text:
                  discussionHint
                    .querySelector(".aihub-discussion-list-label")
                    ?.textContent.trim() || "",
                title: discussionHint.title,
                display: discussionHintStyle?.display || "",
                pointerEvents: discussionHintStyle?.pointerEvents || "",
                left: discussionHintRect?.left ?? null,
                width: discussionHintRect?.width ?? null
              }
            : null,
          buttonRect: buttonRect
            ? {
                left: buttonRect.left,
                top: buttonRect.top,
                right: buttonRect.right,
                bottom: buttonRect.bottom
              }
            : null,
          searchRect: searchRect
            ? {
                left: searchRect.left,
                top: searchRect.top,
                right: searchRect.right,
                bottom: searchRect.bottom
              }
            : null,
          hasNativePostActions:
            pageText.includes("Like") ||
            pageText.includes("Unlike") ||
            pageText.includes("Follow") ||
            pageText.includes("喜欢") ||
            pageText.includes("取消喜欢") ||
            pageText.includes("关注") ||
            pageText.includes("回复")
        };
      })()
    `)});
    return {
      url: view.getURL(),
      partition: view.getAttribute('partition'),
      text: document.querySelector('.embeddedCommunity').innerText,
      hasExternalInteractionControls: Boolean(
        document.querySelector(
          '.embeddedCommunityToolbar, .embeddedCommunityActions'
        )
      ),
      refreshPlacement
    };
  })()`);
  assert.equal(community.partition, "persist:aihub-community");
  assert.equal(community.url.startsWith(`${communityOrigin}/d/`), true);
  assert.equal(community.text.includes("系统浏览器"), false);
  assert.equal(community.hasExternalInteractionControls, false);
  assert.equal(community.refreshPlacement.exists, true);
  assert.equal(community.refreshPlacement.searchExists, true);
  assert.equal(community.refreshPlacement.followsSearch, true);
  assert.equal(community.refreshPlacement.label, "刷新");
  assert.equal(community.refreshPlacement.flarumLocale, "zh-Hans");
  assert.equal(community.refreshPlacement.visibleSecondaryItems.length, 2);
  assert.equal(community.refreshPlacement.headerTitleVisible, false);
  assert.equal(community.refreshPlacement.headerPrimaryVisible, false);
  assert.equal(community.refreshPlacement.backControlVisible, false);
  assert.equal(community.refreshPlacement.appNavigationVisible, false);
  assert.equal(community.refreshPlacement.headerNavigationVisible, false);
  assert.deepEqual(community.refreshPlacement.discussionHint, {
    text: "全部讨论",
    title: "移到这里查看全部讨论",
    display: "flex",
    pointerEvents: "none",
    left: 0,
    width: 32
  });
  assert.equal(community.refreshPlacement.hasNativePostActions, true);
  assert.equal(community.refreshPlacement.theme, "light");
  assert.equal(community.refreshPlacement.bodyBackground, "#f3f7f4");
  assert.equal(community.refreshPlacement.primaryColor, "#a8ff56");
  assert.equal(
    community.refreshPlacement.heroBackground,
    "rgb(231, 251, 215)"
  );
  const discussionHintBehavior = await evaluate(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(`
      (async () => {
        const appRoot = document.getElementById("app");
        const hint = document.getElementById("aihub-discussion-list-hint");
        const originallyShowing = appRoot.classList.contains("paneShowing");
        appRoot.classList.add("paneShowing");
        await new Promise((resolve) => setTimeout(resolve, 220));
        const paneShowingOpacity = getComputedStyle(hint).opacity;
        if (!originallyShowing) appRoot.classList.remove("paneShowing");
        await new Promise((resolve) => setTimeout(resolve, 220));
        return {
          paneShowingOpacity,
          restoredOpacity: getComputedStyle(hint).opacity
        };
      })()
    `)})`
  );
  assert.deepEqual(discussionHintBehavior, {
    paneShowingOpacity: "0",
    restoredOpacity: "0.92"
  });
  const communityLayoutExpression = `(() => {
    const content = document.querySelector('.communityContent');
    const embedded = document.querySelector('.embeddedCommunity');
    const viewport = document.querySelector('.communityViewport');
    const contentRect = content.getBoundingClientRect();
    const embeddedRect = embedded.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const embeddedStyle = getComputedStyle(embedded);
    return {
      contentPadding: getComputedStyle(content).padding,
      borderWidth: embeddedStyle.borderWidth,
      borderRadius: embeddedStyle.borderRadius,
      contentRect: {
        left: contentRect.left,
        top: contentRect.top,
        right: contentRect.right,
        bottom: contentRect.bottom
      },
      embeddedRect: {
        left: embeddedRect.left,
        top: embeddedRect.top,
        right: embeddedRect.right,
        bottom: embeddedRect.bottom
      },
      viewportRect: {
        left: viewportRect.left,
        top: viewportRect.top,
        right: viewportRect.right,
        bottom: viewportRect.bottom
      }
    };
  })()`;
  const assertCommunityFill = (layout, viewportName) => {
    assert.equal(layout.contentPadding, "0px");
    assert.equal(layout.borderWidth, "0px");
    assert.equal(layout.borderRadius, "0px");
    for (const edge of ["left", "top", "right", "bottom"]) {
      assert.ok(
        Math.abs(layout.contentRect[edge] - layout.embeddedRect[edge]) <= 1,
        `${viewportName} community does not fill content ${edge} edge`
      );
      assert.ok(
        Math.abs(layout.embeddedRect[edge] - layout.viewportRect[edge]) <= 1,
        `${viewportName} webview does not fill embedded ${edge} edge`
      );
    }
  };
  const communityLayout = await evaluate(communityLayoutExpression);
  assertCommunityFill(communityLayout, "desktop");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const compactCommunityLayout = await evaluate(communityLayoutExpression);
  assertCommunityFill(compactCommunityLayout, "compact");
  await send("Emulation.clearDeviceMetricsOverride");
  await new Promise((resolve) => setTimeout(resolve, 250));

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const screenshotPath = path.join(
    output,
    "personal-center-embedded-community.png"
  );
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

  await evaluate(
    "[...document.querySelectorAll('.topActions button')].find((button) => button.textContent.includes('设置')).click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.settingsPanel'))",
    "settings panel did not open for community theme test"
  );
  await evaluate(
    "[...document.querySelectorAll('.settingsPanel .segmented button')].find((button) => button.textContent.trim() === '黑色').click()"
  );
  await waitFor(
    "document.querySelector('.pcApp').dataset.theme === 'dark'",
    "PC theme did not switch to dark"
  );
  await waitFor(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(
      "document.documentElement.getAttribute('data-aihub-theme') === 'dark'"
    )})`,
    "embedded community did not follow the PC dark theme"
  );
  await evaluate("document.querySelector('.settingsPanel header > button').click()");
  await waitFor(
    "!document.querySelector('.settingsPanel')",
    "settings panel did not close"
  );

  const darkCommunityTheme = await evaluate(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(`
      (() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const refresh = document.getElementById("aihub-community-refresh");
        const hero = document.querySelector(".DiscussionHero");
        return {
          theme: document.documentElement.getAttribute("data-aihub-theme"),
          bodyBackground: rootStyle.getPropertyValue("--body-bg").trim(),
          primaryColor: rootStyle.getPropertyValue("--primary-color").trim(),
          refreshBackground: refresh
            ? getComputedStyle(refresh).backgroundColor
            : "",
          heroBackground: hero ? getComputedStyle(hero).backgroundColor : ""
        };
      })()
    `)})`
  );
  assert.equal(darkCommunityTheme.theme, "dark");
  assert.equal(darkCommunityTheme.bodyBackground, "#0e1916");
  assert.equal(darkCommunityTheme.primaryColor, "#a8ff56");
  assert.equal(darkCommunityTheme.heroBackground, "rgb(20, 60, 50)");

  const darkScreenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const darkScreenshotPath = path.join(
    output,
    "personal-center-embedded-community-dark.png"
  );
  fs.writeFileSync(
    darkScreenshotPath,
    Buffer.from(darkScreenshot.data, "base64")
  );

  await evaluate(
    "[...document.querySelectorAll('.topActions button')].find((button) => button.textContent.includes('设置')).click()"
  );
  await waitFor(
    "Boolean(document.querySelector('.settingsPanel'))",
    "settings panel did not open for language sync test"
  );
  await evaluate(
    "[...document.querySelectorAll('.settingsPanel button')].find((button) => button.textContent.trim() === 'English').click()"
  );
  await waitFor(
    "[...document.querySelectorAll('.sidebar button')].some((button) => button.textContent.includes('Home'))",
    "PC language did not switch to English"
  );
  await waitFor(
    `document.querySelector('webview.communityWebview').executeJavaScript(${JSON.stringify(
      "(typeof app !== 'undefined' && app.data.locale === 'en' && document.getElementById('aihub-community-refresh')?.getAttribute('aria-label') === 'Refresh' && document.querySelector('#aihub-discussion-list-hint .aihub-discussion-list-label')?.textContent.trim() === 'Discussions')"
    )}).catch(() => false)`,
    "embedded community did not follow the PC English language",
    30_000
  );
  const englishLanguage = await evaluate(`(async () => ({
    stored: (await window.aihubPC.getSettings()).language,
    documentLocale: document.documentElement.lang,
    communityLocale: await document.querySelector('webview.communityWebview')
      .executeJavaScript("typeof app !== 'undefined' ? app.data.locale : ''")
  }))()`);
  assert.deepEqual(englishLanguage, {
    stored: "en",
    documentLocale: "en",
    communityLocale: "en"
  });
  await evaluate("document.querySelector('.settingsPanel header > button').click()");
  await waitFor(
    "!document.querySelector('.settingsPanel')",
    "settings panel did not close after language sync test"
  );
  const englishScreenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  const englishScreenshotPath = path.join(
    output,
    "personal-center-embedded-community-english.png"
  );
  fs.writeFileSync(
    englishScreenshotPath,
    Buffer.from(englishScreenshot.data, "base64")
  );
  socket.close();

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        personalCenter,
        renderedAvatar,
        community,
        discussionHintBehavior,
        darkCommunityTheme,
        englishLanguage,
        communityLayout,
        compactCommunityLayout,
        screenshots: {
          personalCenter: personalScreenshotPath,
          embeddedCommunity: screenshotPath,
          embeddedCommunityDark: darkScreenshotPath,
          embeddedCommunityEnglish: englishScreenshotPath
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
