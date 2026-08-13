"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..", "..");
const mode = process.env.AIHUB_WORKFLOW_FIXTURE_MODE || "disabled-auth";
const userData = process.env.AIHUB_WORKFLOW_USER_DATA;
const output = path.join(root, "output", "playwright");
if (!userData) throw new Error("AIHUB_WORKFLOW_USER_DATA is required");
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

async function clickByText(window, text) {
  const found = await window.webContents.executeJavaScript(`(() => {
    const node = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === ${JSON.stringify(text)});
    if (!node) return false; node.click(); return true;
  })()`);
  assert.equal(found, true, `${text} button missing`);
}

async function fill(window) {
  await window.webContents.executeJavaScript(`(() => {
    const setInput = (node, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); };
    const setArea = (node, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); };
    const inputs = [...document.querySelectorAll('.workflowOwnerForm input[required]')];
    setInput(inputs[0], 'Fixture workflow draft');
    setInput(inputs[1], '42');
    setInput(inputs[2], 'MIT');
    setArea(document.querySelector('.workflowOwnerForm textarea[required]'), 'A safe candidate workflow.');
  })()`);
}

async function screenshot(window, width) {
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
  fs.writeFileSync(path.join(output, `workflow-store-${width}.png`), (await window.webContents.capturePage()).toPNG());
  return result;
}

async function run() {
  const window = new BrowserWindow({ show: false, width: 1365, height: 768, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "installed-management-preview-preload.cjs") } });
  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    await waitFor(window, "Boolean(document.querySelector('.accountButton'))", "authenticated account button missing");
    assert.equal(await window.webContents.executeJavaScript("(() => { const node = document.querySelector('.accountButton'); if (!node) return false; node.click(); return true; })()"), true, "account button missing");
    await waitFor(window, "Boolean(document.querySelector('.personalTabs'))", "personal center missing");
    if (mode === "disabled-auth") {
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.personalTabs button').length"), 10, "disabled workflow capability must not render an entry");
      assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('.workflowOwnerPage'))"), false, "disabled workflow capability must not render a page");
      process.stdout.write(`${JSON.stringify({ ok: true, mode })}\n`);
      return;
    }
    await waitFor(window, "document.querySelectorAll('.personalTabs button').length === 11", "workflow tab missing");
    await window.webContents.executeJavaScript("document.querySelectorAll('.personalTabs button')[2].click()");
    await waitFor(window, "Boolean(document.querySelector('.workflowOwnerPage[data-aihub-workflow-capability=enabled]'))", "workflow owner page missing");
    assert.equal(await window.webContents.executeJavaScript("(() => { const summary = document.querySelector('.workflowSupplemental summary'); summary.focus(); return document.activeElement === summary; })()"), true, "workflow details summary must be keyboard-focusable");
    assert.equal(await window.webContents.executeJavaScript("document.body.textContent.includes('must-not-render')"), false, "owner private fields leaked");
    assert.equal(await window.webContents.executeJavaScript("document.body.textContent.includes('import') || document.body.textContent.includes('Agent binding')"), false, "execution action leaked");
    if (mode === "refresh-busy") {
      await waitFor(window, "[...document.querySelectorAll('.workflowOwnerPage > header button')].some((button) => button.disabled && button.textContent.includes('刷新中'))", "workflow refresh busy label missing");
      await waitFor(window, "[...document.querySelectorAll('.workflowOwnerPage > header button')].some((button) => !button.disabled && button.textContent.trim() === '刷新')", "workflow refresh did not recover");
    }
    if (mode !== "leak") {
      await fill(window);
      await window.webContents.executeJavaScript("document.querySelector('[data-aihub-action=save-workflow]').click()")
      if (mode === "busy") {
        await waitFor(window, "document.querySelector('[data-aihub-action=save-workflow]')?.disabled", "busy action did not disable");
        assert.equal(await window.webContents.executeJavaScript("[...document.querySelectorAll('.workflowOwnerForm button')].every((button) => button.disabled)"), true, "busy workflow actions must be disabled");
      }
      if (["conflict", "rate", "unavailable"].includes(mode)) {
        const alert = await waitFor(window, "document.querySelector('.workflowOwnerForm .submissionNotice-error[role=alert]')?.textContent", "workflow error notice missing");
        assert.ok(String(alert).length > 0, "workflow error must be normalized");
      } else {
        await waitFor(window, "Boolean(document.querySelector('[data-aihub-action=submit-workflow]:not([disabled])'))", "owner result did not enable submit");
        const calls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetWorkflowCalls()");
        assert.equal(calls.length, 1); assert.equal(calls[0].method, "create"); assert.ok(calls[0].idempotencyKey);
      }
    }
    const desktop = await screenshot(window, 1365);
    const narrow = await screenshot(window, 740);
    process.stdout.write(`${JSON.stringify({ ok: true, mode, desktop, narrow })}\n`);
  } finally { if (!window.isDestroyed()) window.destroy(); }
}

app.whenReady().then(run).then(() => app.quit(), (error) => { console.error(error.stack || error); app.exit(1); });
