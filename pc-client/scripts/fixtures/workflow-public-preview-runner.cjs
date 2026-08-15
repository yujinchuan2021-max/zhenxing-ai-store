"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..", "..");
const mode = process.env.AIHUB_WORKFLOW_PUBLIC_FIXTURE_MODE || "disabled";
const fixedCliLifecycleMode = process.env.AIHUB_FIXED_CLI_LIFECYCLE_FIXTURE_MODE || "disabled";
const userData = process.env.AIHUB_WORKFLOW_PUBLIC_USER_DATA;
const output = path.join(root, "output", "playwright");
if (!userData) throw new Error("AIHUB_WORKFLOW_PUBLIC_USER_DATA is required");
app.setPath("userData", userData);

function waitFor(window, expression, message) {
  const deadline = Date.now() + 10_000;
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const value = await window.webContents.executeJavaScript(expression);
        if (value) return resolve(value);
        if (Date.now() > deadline) return reject(new Error(message));
        setTimeout(check, 40);
      } catch (error) { reject(error); }
    };
    void check();
  });
}

async function screenshot(window, width, label = mode) {
  window.setContentSize(width, 768);
  await waitFor(window, `window.innerWidth === ${width}`, "viewport did not settle");
  const result = await window.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter((node) => { const rect = node.getBoundingClientRect(); return rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight && !node.closest('.personalTabs'); });
    return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttonsInside: buttons.every((node) => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }) };
  })()`);
  assert.ok(result.scrollWidth <= result.viewport, "horizontal overflow");
  assert.equal(result.buttonsInside, true, "visible button outside viewport");
  const height = await window.webContents.executeJavaScript("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)");
  window.setContentSize(width, height);
  fs.mkdirSync(output, { recursive: true });
  const png = (await window.webContents.capturePage()).toPNG();
  fs.writeFileSync(path.join(output, `workflow-public-${label}-${width}.png`), png);
  if (label === "named") fs.writeFileSync(path.join(output, `workflow-public-${width}.png`), png);
  return result;
}

async function setPreviewTheme(window, theme) {
  await window.webContents.executeJavaScript(`document.querySelector('.pcApp').dataset.theme = ${JSON.stringify(theme)}`);
}

async function composerNoticeContrast(window) {
  return window.webContents.executeJavaScript(`(() => {
    const parse = (value) => {
      const rgb = value.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      const srgb = value.match(/color\\(srgb\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)/);
      const parts = rgb
        ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
        : srgb
          ? [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255]
          : null;
      if (!parts) return null;
      return parts.map((part) => {
        const channel = part / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
    };
    const luminance = ([red, green, blue]) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const node = document.querySelector('.workflowComposerNotice');
    const styles = getComputedStyle(node);
    const foreground = parse(styles.color);
    const background = parse(styles.backgroundColor);
    if (!foreground || !background) return 0;
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
  })()`);
}

async function run() {
  const window = new BrowserWindow({ show: false, width: 1365, height: 768, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "installed-management-preview-preload.cjs") } });
  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    if (fixedCliLifecycleMode !== "disabled") {
      await waitFor(window, "[...document.querySelectorAll('.navItem')].some((node) => node.textContent.includes('全部 AI 厂商'))", "vendor navigation missing");
      await window.webContents.executeJavaScript("[...document.querySelectorAll('.navItem')].find((node) => node.textContent.includes('全部 AI 厂商')).click()");
      await waitFor(window, "Boolean(document.querySelector('[data-aihub-vendor-id=\"fixture-vendor\"]'))", "fixture vendor missing");
      await window.webContents.executeJavaScript("document.querySelector('[data-aihub-vendor-id=\"fixture-vendor\"]').click()");
      await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=\"google-antigravity-cli\"]'))", "fixed CLI product missing");
      const deploy = "[data-aihub-action=fixed-cli-deploy]";
      const uninstall = "[data-aihub-action=fixed-cli-uninstall]";
      if (fixedCliLifecycleMode === "unavailable") {
        await waitFor(window, "window.aihubPC.fixtureGetFixedCliLifecycleCalls().some((call) => call.method === 'status')", "fixed CLI status was not called");
        assert.equal(await window.webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(deploy)}))`), false, "unavailable fixed CLI lifecycle must stay hidden");
        process.stdout.write(`${JSON.stringify({ ok: true, mode: "fixed-cli-unavailable" })}\n`);
        return;
      }
      await waitFor(window, `Boolean(document.querySelector(${JSON.stringify(deploy)}))`, "fixed CLI deploy action missing");
      const busyAction = fixedCliLifecycleMode === "busy-uninstall" ? uninstall : deploy;
      await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(busyAction)}).click()`);
      await waitFor(window, "window.aihubPC.fixtureGetFixedCliLifecycleCalls().some((call) => call.method === 'plan')", "fixed CLI plan was not called");
      if (fixedCliLifecycleMode.startsWith("busy")) {
        const expectedBusyText = fixedCliLifecycleMode === "busy-update" ? "正在准备更新部署" : fixedCliLifecycleMode === "busy-uninstall" ? "正在准备卸载" : "正在准备部署";
        assert.equal(await window.webContents.executeJavaScript(`(() => { const button = document.querySelector(${JSON.stringify(busyAction)}); return button.disabled && button.textContent.includes(${JSON.stringify(expectedBusyText)}); })()`), true, "busy fixed CLI action must retain its operation identity");
        await screenshot(window, 1365, `fixed-cli-${fixedCliLifecycleMode}-light`);
        await screenshot(window, 740, `fixed-cli-${fixedCliLifecycleMode}-light`);
        await setPreviewTheme(window, "dark");
        await screenshot(window, 1365, `fixed-cli-${fixedCliLifecycleMode}-dark`);
        await screenshot(window, 740, `fixed-cli-${fixedCliLifecycleMode}-dark`);
        process.stdout.write(`${JSON.stringify({ ok: true, mode: `fixed-cli-${fixedCliLifecycleMode}` })}\n`);
        return;
      }
      if (fixedCliLifecycleMode === "error") {
        await waitFor(window, "Boolean(document.querySelector('.fixedCliLifecycleNotice[role=alert]'))", "fixed CLI error notice missing");
        assert.equal(await window.webContents.executeJavaScript(`Boolean(document.querySelector('.fixedCliLifecycleConfirm'))`), false, "failed plan must not open confirmation");
        await screenshot(window, 1365, "fixed-cli-error-light");
        await screenshot(window, 740, "fixed-cli-error-light");
        await setPreviewTheme(window, "dark");
        await screenshot(window, 1365, "fixed-cli-error-dark");
        await screenshot(window, 740, "fixed-cli-error-dark");
        process.stdout.write(`${JSON.stringify({ ok: true, mode: "fixed-cli-error" })}\n`);
        return;
      }
      await waitFor(window, "Boolean(document.querySelector('.fixedCliLifecycleConfirm'))", "fixed CLI confirmation missing");
      assert.equal(await window.webContents.executeJavaScript("document.activeElement?.id === 'fixed-cli-title-google-antigravity-cli'"), true, "fixed CLI confirmation heading must receive focus");
      const confirmationText = await window.webContents.executeJavaScript("document.querySelector('.fixedCliLifecycleConfirm').textContent");
      assert.equal(confirmationText.includes("不会授予 Agent 运行权限"), true, "fixed CLI confirmation must state the Agent boundary");
      await screenshot(window, 1365, "fixed-cli-confirm");
      await screenshot(window, 740, "fixed-cli-confirm");
      await setPreviewTheme(window, "dark");
      await screenshot(window, 1365, "fixed-cli-confirm-dark");
      await screenshot(window, 740, "fixed-cli-confirm-dark");
      await setPreviewTheme(window, "light");
      await window.webContents.executeJavaScript("document.querySelector('.fixedCliLifecycleConfirm button').click()");
      await waitFor(window, "!document.querySelector('.fixedCliLifecycleConfirm')", "fixed CLI confirmation did not close");
      await waitFor(window, `document.activeElement === document.querySelector(${JSON.stringify(deploy)})`, "cancel must restore focus to the triggering action");
      await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(deploy)}).click()`);
      await waitFor(window, "Boolean(document.querySelector('.fixedCliLifecycleConfirm'))", "fixed CLI deployment confirmation missing");
      await window.webContents.executeJavaScript("document.querySelector('[data-aihub-action=fixed-cli-confirm]').click()");
      await waitFor(window, "window.aihubPC.fixtureGetFixedCliLifecycleCalls().some((call) => call.method === 'recheck')", "fixed CLI recheck was not called");
      await waitFor(window, "Boolean(document.querySelector('.fixedCliLifecycleNotice[role=status]'))", "fixed CLI success notice missing");
      await waitFor(window, "Boolean(document.querySelector('[data-aihub-action=fixed-cli-uninstall]'))", "managed fixed CLI must expose the supported uninstall action");
      await waitFor(window, `document.activeElement === document.querySelector(${JSON.stringify(deploy)})`, "confirmed deployment must restore focus to the triggering action");
      await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(deploy)}).click()`);
      await waitFor(window, "Boolean(document.querySelector('.fixedCliLifecycleConfirm'))", "fixed CLI update confirmation missing");
      assert.equal(await window.webContents.executeJavaScript("document.querySelector('.fixedCliLifecycleConfirm').textContent.includes('确认更新部署')"), true, "update confirmation must name the update operation");
      await screenshot(window, 1365, "fixed-cli-update-confirm-light");
      await screenshot(window, 740, "fixed-cli-update-confirm-light");
      await setPreviewTheme(window, "dark");
      await screenshot(window, 1365, "fixed-cli-update-confirm-dark");
      await screenshot(window, 740, "fixed-cli-update-confirm-dark");
      await setPreviewTheme(window, "light");
      await window.webContents.executeJavaScript("document.querySelector('.fixedCliLifecycleConfirm button').click()");
      await waitFor(window, "!document.querySelector('.fixedCliLifecycleConfirm')", "update confirmation did not close");
      await waitFor(window, `document.activeElement === document.querySelector(${JSON.stringify(deploy)})`, "canceled update must restore focus to the triggering action");
      await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(uninstall)}).click()`);
      await waitFor(window, "Boolean(document.querySelector('.fixedCliLifecycleConfirm'))", "fixed CLI uninstall confirmation missing");
      assert.equal(await window.webContents.executeJavaScript("document.activeElement?.id === 'fixed-cli-title-google-antigravity-cli'"), true, "uninstall confirmation heading must receive focus");
      const uninstallText = await window.webContents.executeJavaScript("document.querySelector('.fixedCliLifecycleConfirm').textContent");
      assert.equal(uninstallText.includes("确认卸载此 CLI") && uninstallText.includes("仅移除本应用收据归属的文件和配置"), true, "uninstall confirmation must name and bound the destructive action");
      assert.equal(await window.webContents.executeJavaScript("document.querySelector('[data-aihub-action=fixed-cli-confirm]').classList.contains('dangerButton')"), true, "uninstall confirmation must use danger styling");
      await setPreviewTheme(window, "light");
      await screenshot(window, 1365, "fixed-cli-uninstall-confirm-light");
      await screenshot(window, 740, "fixed-cli-uninstall-confirm-light");
      await setPreviewTheme(window, "dark");
      await screenshot(window, 1365, "fixed-cli-uninstall-confirm-dark");
      await screenshot(window, 740, "fixed-cli-uninstall-confirm-dark");
      await window.webContents.executeJavaScript("document.querySelector('[data-aihub-action=fixed-cli-confirm]').click()");
      await waitFor(window, "window.aihubPC.fixtureGetFixedCliLifecycleCalls().filter((call) => call.method === 'recheck').length === 2", "fixed CLI uninstall recheck was not called");
      await waitFor(window, "document.querySelector('.fixedCliLifecycleNotice[role=status]')?.textContent.includes('已卸载')", "fixed CLI uninstall success notice missing");
      assert.equal(await window.webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(uninstall)}))`), false, "uninstalled fixed CLI must not retain uninstall action");
      const longDeploy = "[data-aihub-fixed-cli-lifecycle=moonshot-kimi-code-cli] [data-aihub-action=fixed-cli-deploy]";
      await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(longDeploy)}).click()`);
      await waitFor(window, "Boolean(document.querySelector('[data-aihub-fixed-cli-lifecycle=moonshot-kimi-code-cli] .fixedCliLifecycleConfirm'))", "long fixed CLI confirmation missing");
      await screenshot(window, 1365, "fixed-cli-long-dark");
      await screenshot(window, 740, "fixed-cli-long-dark");
      await window.webContents.executeJavaScript("document.querySelector('[data-aihub-fixed-cli-lifecycle=moonshot-kimi-code-cli] .fixedCliLifecycleConfirm button').click()");
      await waitFor(window, "!document.querySelector('[data-aihub-fixed-cli-lifecycle=moonshot-kimi-code-cli] .fixedCliLifecycleConfirm')", "long confirmation did not close");
      const calls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetFixedCliLifecycleCalls()");
      assert.equal(calls.filter((call) => call.method === "confirm").length, 2, "fixed CLI must confirm both deploy and uninstall");
      assert.equal(calls.filter((call) => call.method === "apply").length, 2, "fixed CLI must apply both deploy and uninstall");
      assert.equal(calls.every((call) => !/command|args|env|url|path|script|shell|receipt|vault|identity/i.test(JSON.stringify(call.input))), true, "renderer sent a forbidden fixed CLI lifecycle field");
      assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('[data-aihub-fixed-cli-lifecycle=google-antigravity-cli] [data-aihub-action=fixed-cli-uninstall]'))"), false, "uninstalled fixed CLI must remain out of the managed state");
      const desktop = await screenshot(window, 1365, "fixed-cli");
      const narrow = await screenshot(window, 740, "fixed-cli");
      process.stdout.write(`${JSON.stringify({ ok: true, mode: "fixed-cli", desktop, narrow, calls })}\n`);
      return;
    }
    await waitFor(window, "window.aihubPC.fixtureGetWorkflowPublicCapabilityCalls() === 1", "public capability did not resolve");
    const nav = "[data-aihub-workflow-store=public]";
    if (["disabled", "empty", "unavailable"].includes(mode)) {
      if (mode !== "disabled") await waitFor(window, "window.aihubPC.fixtureGetWorkflowPublicCalls().length === 1", "public list did not settle");
      assert.equal(await window.webContents.executeJavaScript(`Boolean(document.querySelector(${JSON.stringify(nav)}))`), false, "empty, failed, or disabled public store must stay hidden");
      process.stdout.write(`${JSON.stringify({ ok: true, mode })}\n`);
      return;
    }
    await waitFor(window, `Boolean(document.querySelector(${JSON.stringify(nav)}))`, "public workflow navigation missing");
    await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(nav)}).click()`);
    await waitFor(window, "Boolean(document.querySelector('.workflowPublicStore'))", "public workflow page missing");
    await window.webContents.executeJavaScript("document.querySelector('.workflowPublicList button').click()");
    await waitFor(window, "Boolean(document.querySelector('.workflowPublicDetail'))", "workflow detail missing");
    assert.equal(await window.webContents.executeJavaScript("(() => { const breadcrumb = document.querySelector('.workflowPublicBreadcrumb button'); breadcrumb.focus(); return document.activeElement === breadcrumb; })()"), true, "workflow list breadcrumb must be keyboard-focusable");
    if (mode === "detail-unavailable") {
      await waitFor(window, "Boolean(document.querySelector('.workflowPublicUnavailable'))", "unavailable card missing");
    } else {
      await waitFor(window, "Boolean(document.querySelector('[data-aihub-workflow-reference=exact]'))", "exact post reference card missing");
      assert.equal(await window.webContents.executeJavaScript("(() => { const summary = document.querySelector('.workflowPublicDetails summary'); summary.focus(); return document.activeElement === summary; })()"), true, "workflow details must be keyboard-focusable");
      assert.equal(await window.webContents.executeJavaScript("/must-not-render|import|execute|Agent binding/.test(document.body.textContent)"), false, "public renderer exposed a forbidden field or action");
      if (mode === "guarded") assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('.workflowPublicGuarded'))"), true, "guarded risk notice missing");
      if (mode === "composer") {
        await waitFor(window, "Boolean(document.querySelector('.workflowComposer[data-aihub-workflow-composer=\"disabled\"]'))", "workflow composer preview missing");
        assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.workflowComposerSteps li').length"), 4, "workflow composer must render ordered resource steps");
        assert.equal(await window.webContents.executeJavaScript("(() => { const select = document.querySelector('.workflowComposer select'); select.focus(); return document.activeElement === select; })()"), true, "workflow composer Agent selector must be keyboard-focusable");
        assert.equal(await window.webContents.executeJavaScript("(() => [...document.querySelectorAll('.workflowComposer [data-aihub-action]')].every((button) => button.disabled))()"), true, "workflow composer actions must stay disabled without session handoff");
        assert.equal(await window.webContents.executeJavaScript("window.aihubPC.fixtureGetAgentBridgeCalls().length"), 0, "disabled composer must not call Bridge plan or request");
      }
      const bodyText = await window.webContents.executeJavaScript("document.body.textContent");
      if (mode === "missing" || mode === "unsafe-omitted") {
        assert.equal(bodyText.includes("Fixture original author"), false, "omitted original author must not render a placeholder");
        assert.equal(bodyText.includes("已在公开来源元数据中验证"), true, "omitted original author needs the neutral fallback");
      } else if (mode === "named") {
        assert.equal(bodyText.includes("Fixture Original Author"), true, "safe original author name missing");
      }
      await waitFor(window, "window.aihubPC.fixtureGetWorkflowPublicCalls().some((call) => call.method === 'resolve')", "exact public workflow resolve missing");
    }
    const desktop = await screenshot(window, 1365);
    const narrow = await screenshot(window, 740);
    let composerContrast = null;
    if (mode === "composer") {
      composerContrast = { light: await composerNoticeContrast(window) };
      assert.ok(composerContrast.light >= 4.5, "light composer notice contrast below 4.5:1");
      await window.webContents.executeJavaScript("document.querySelector('.pcApp').setAttribute('data-theme', 'dark')");
      composerContrast.dark = await composerNoticeContrast(window);
      assert.ok(composerContrast.dark >= 4.5, "dark composer notice contrast below 4.5:1");
      await screenshot(window, 1365, "composer-dark");
      await screenshot(window, 740, "composer-dark");
    }
    process.stdout.write(`${JSON.stringify({ ok: true, mode, desktop, narrow, composerContrast })}\n`);
  } finally { if (!window.isDestroyed()) window.destroy(); }
}

app.whenReady().then(run).then(() => app.quit(), (error) => { console.error(error.stack || error); app.exit(1); });
