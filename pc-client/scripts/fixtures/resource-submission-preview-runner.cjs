const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..", "..");
const mode = process.env.AIHUB_SUBMISSION_FIXTURE_MODE || "disabled";
const userData = process.env.AIHUB_SUBMISSION_USER_DATA;
const output = path.join(root, "output", "playwright");
if (!userData) throw new Error("AIHUB_SUBMISSION_USER_DATA is required");
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

async function click(window, selector) {
  assert.equal(await window.webContents.executeJavaScript(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.click(); return true; })()`), true, `${selector} missing`);
}

async function fillRequired(window) {
  await window.webContents.executeJavaScript(`(() => {
    const set = (node, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); };
    const inputs = [...document.querySelectorAll('.submissionForm input[required]')];
    set(inputs[0], 'Fixture renderer proposal');
    set(inputs[1], 'https://example.invalid/proposal');
    const area = document.querySelector('.submissionForm textarea[required]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(area, 'Fixture summary'); area.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function screenshot(window, width) {
  window.setContentSize(width, 768);
  await waitFor(window, `window.innerWidth === ${width}`, "viewport did not settle");
  const result = await window.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter((node) => { const rect = node.getBoundingClientRect(); return rect.width && rect.height; });
    return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttonsInside: buttons.every((node) => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }) };
  })()`);
  assert.ok(result.scrollWidth <= result.viewport, "horizontal overflow");
  assert.equal(result.buttonsInside, true, "button outside viewport");
  const height = await window.webContents.executeJavaScript("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)");
  window.setContentSize(width, height);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, `resource-submission-${width}.png`), (await window.webContents.capturePage()).toPNG());
  return result;
}

async function run() {
  const window = new BrowserWindow({ show: false, width: 1365, height: 768, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "installed-management-preview-preload.cjs") } });
  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    await waitFor(window, "Boolean(document.querySelector('.sidebarContribution button'))", "global submission entry missing");
    await click(window, ".sidebarContribution button");
    await waitFor(window, "Boolean(document.querySelector('.contributionPage'))", "submission page missing");
    if (mode === "disabled") {
      await waitFor(window, "Boolean(document.querySelector('[data-aihub-action=submit-resource][disabled]'))", "disabled capability CTA missing");
    } else if (mode === "anonymous") {
      await waitFor(window, "Boolean(document.querySelector('.submissionCallout button[disabled]')) && document.body.textContent.includes('登录')", "anonymous submission gate missing");
    } else {
      await waitFor(window, "Boolean(document.querySelector('.submissionWorkspace'))", "enabled submission workspace missing");
      const workflow = await window.webContents.executeJavaScript("document.querySelector('.submissionForm option[value=workflow]').disabled");
      assert.equal(workflow, true, "workflow must be unavailable");
      assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('.submissionCandidateBoundary')) && Boolean(document.querySelector('.submissionSupplemental summary'))"), true, "candidate boundary or supplemental details missing");
      if (mode === "refresh-busy") {
        await waitFor(window, "[...document.querySelectorAll('.submissionWorkspace > header button')].some((button) => button.disabled && button.textContent.includes('刷新中'))", "submission refresh busy label missing");
        await waitFor(window, "[...document.querySelectorAll('.submissionWorkspace > header button')].some((button) => !button.disabled && button.textContent.trim() === '刷新')", "submission refresh did not recover");
      }
      if (mode === "leak") {
        await waitFor(window, "document.body.textContent.includes('Fixture submission')", "fixture owner item missing");
        const body = await window.webContents.executeJavaScript("document.body.textContent");
        assert.equal(body.includes("must-not-render"), false, "owner sensitive fields leaked");
      } else {
        await fillRequired(window);
        if (mode === "invalid") await window.webContents.executeJavaScript(`(() => {
          const input = document.querySelector('.submissionForm input[type=url]');
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'http://example.invalid/not-https'); input.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await click(window, "[data-aihub-action=save-submission]");
        if (mode === "invalid") {
          const notice = await waitFor(window, "document.querySelector('.submissionNotice-error[role=alert]')?.textContent", "validation error did not render");
          assert.ok(String(notice).includes("请填写标题"), `validation error not normalized: ${notice}`);
          assert.equal((await window.webContents.executeJavaScript("window.aihubPC.fixtureGetSubmissionCalls()")).length, 0, "invalid submission must not write");
          process.stdout.write(`${JSON.stringify({ ok: true, mode })}\n`);
          return;
        }
        if (mode === "busy") {
          await waitFor(window, "document.querySelector('[data-aihub-action=save-submission]')?.textContent.includes('保存中')", "busy label missing");
          assert.equal(await window.webContents.executeJavaScript("[...document.querySelectorAll('.submissionActions button')].every((button) => button.disabled)"), true, "busy action must disable every submission action");
        }
        if (["enabled", "refresh-busy", "busy"].includes(mode)) {
          await waitFor(window, "Boolean(document.querySelector('[data-aihub-action=submit-submission]:not([disabled])'))", "server owner result did not enable submit action");
          assert.equal(await window.webContents.executeJavaScript("document.querySelector('.submissionNotice-success[role=status]')?.textContent.includes('草稿已按服务器结果更新')"), true, "success notice missing");
          const calls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetSubmissionCalls()");
          assert.equal(calls.length, 1); assert.equal(calls[0].method, "create"); assert.ok(calls[0].idempotencyKey);
          const desktop = await screenshot(window, 1365);
          const narrow = await screenshot(window, 740);
          process.stdout.write(`${JSON.stringify({ ok: true, mode, desktop, narrow })}\n`);
          return;
        }
        const expected = mode === "conflict" ? "刷新后重试" : mode === "rate" ? "操作过于频繁" : "投稿服务暂时不可用";
        const notice = await waitFor(window, "document.querySelector('.submissionNotice-error[role=alert]')?.textContent", `${mode} error did not render`);
        assert.ok(String(notice).includes(expected), `${mode} error not normalized: ${notice}`);
        await click(window, "[data-aihub-action=save-submission]");
        const calls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetSubmissionCalls()");
        assert.equal(calls.length, 2, "failed create should be retryable");
        assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey, "create retry must reuse its idempotency key");
      }
    }
    const calls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetSubmissionCalls()");
    assert.equal(calls.length, ["disabled", "anonymous", "leak", "invalid"].includes(mode) ? 0 : ["enabled", "refresh-busy", "busy"].includes(mode) ? 1 : 2, "unexpected submission write count");
    process.stdout.write(`${JSON.stringify({ ok: true, mode })}\n`);
  } finally { if (!window.isDestroyed()) window.destroy(); }
}

app.whenReady().then(run).then(() => app.quit(), (error) => { console.error(error.stack || error); app.exit(1); });
