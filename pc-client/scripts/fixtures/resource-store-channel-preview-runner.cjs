const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..", "..");
const outputDirectory = path.join(root, "output", "playwright");
const preload = path.join(__dirname, "installed-management-preview-preload.cjs");
const userData = process.env.AIHUB_RESOURCE_CHANNEL_USER_DATA;

if (!userData) throw new Error("AIHUB_RESOURCE_CHANNEL_USER_DATA is required");
app.setPath("userData", userData);

function waitFor(window, expression, message) {
  const deadline = Date.now() + 10_000;
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const value = await window.webContents.executeJavaScript(expression);
        if (value) return resolve(value);
        if (Date.now() >= deadline) return reject(new Error(message));
        setTimeout(check, 50);
      } catch (error) {
        reject(error);
      }
    };
    void check();
  });
}

async function click(window, selector, message) {
  const clicked = await window.webContents.executeJavaScript(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
  })()`);
  assert.equal(clicked, true, message);
}

async function assertEmptyCommunitySkillChannel(window) {
  await click(window, '[data-aihub-resource-store-id="skill"]', "Skill store entry missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-filter="source-channel"]\'))', "Skill source filter did not render");
  await click(window, '[data-aihub-resource-filter="source-channel"] [data-aihub-filter-value="community"]', "community Skill channel missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-empty-source="community"]\'))', "empty community Skill state did not render");
  const state = await window.webContents.executeJavaScript(`(() => ({
    context: document.querySelector('[data-aihub-resource-source-context]')?.textContent.trim() || '',
    empty: document.querySelector('[data-aihub-resource-empty-source="community"]')?.textContent.trim() || '',
    switchAction: Boolean(document.querySelector('[data-aihub-action="switch-resource-source-official"]')),
    discussions: document.querySelector('[data-aihub-community-discussions]')?.textContent.trim() || ''
  }))()`);
  assert.match(state.context, /Skill/i, "current source context must name the Skill channel");
  assert.match(state.empty, /community|社区/i, "empty state must explain that the selected community channel is empty");
  assert.equal(state.switchAction, true, "empty community Skill state must offer an explicit return to official Skills");
  assert.match(state.discussions, /discussion|讨论/i, "sidebar community entry must retain its discussion meaning");
  await click(window, '[data-aihub-action="switch-resource-source-official"]', "return to official Skills action missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-product-id="codex-cli"]\'))', "official Skills did not return after the explicit action");
  return state;
}

async function snapshotEmptyCommunitySkillChannel(window, width, height, theme) {
  await click(window, '[data-aihub-resource-store-id="skill"]', "Skill store entry missing");
  await click(window, '[data-aihub-resource-filter="source-channel"] [data-aihub-filter-value="community"]', "community Skill channel missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-empty-source="community"]\'))', "empty community Skill state did not render");
  window.setContentSize(width, height);
  await waitFor(window, `window.innerWidth === ${width}`, `viewport ${width} did not settle`);
  const result = await window.webContents.executeJavaScript(`(() => {
    const app = document.querySelector('.pcApp');
    if (app) app.dataset.theme = ${JSON.stringify(theme)};
    const action = document.querySelector('[data-aihub-action="switch-resource-source-official"]');
    action?.focus();
    const buttons = [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      focused: document.activeElement === action,
      buttonsInsideViewport: buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      })
    };
  })()`);
  assert.equal(result.focused, true, "return to official Skills action must be keyboard-focusable");
  assert.ok(result.scrollWidth <= result.viewport, `community Skill ${theme}/${width} has horizontal overflow`);
  assert.equal(result.buttonsInsideViewport, true, "community Skill actions must stay in the viewport");
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, `resource-store-community-empty-${theme}-${width}.png`), (await window.webContents.capturePage()).toPNG());
  await click(window, '[data-aihub-action="switch-resource-source-official"]', "return to official Skills action missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-product-id="codex-cli"]\'))', "official Skills did not return after the explicit action");
  return result;
}

async function openUnsafeDetail(window) {
  await click(window, '[data-aihub-resource-store-id="mcp"]', "MCP store entry missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-filter="source-channel"]\'))', "resource channel filters did not render");
  const filters = await window.webContents.executeJavaScript(`(() => ({
    stores: [...document.querySelectorAll('[data-aihub-resource-store-id]')].map((node) => node.getAttribute('data-aihub-resource-store-id')),
    scenarioCount: document.querySelectorAll('[data-aihub-resource-filter="scenario"] [data-aihub-filter-value]').length,
    agentFilter: Boolean(document.querySelector('[data-aihub-resource-filter="agent"]'))
  }))()`);
  assert.deepEqual(filters.stores, ["skill", "mcp", "plugin", "connector"]);
  assert.equal(filters.scenarioCount, 22, "all plus 21 canonical scenario filters must render");
  assert.equal(filters.agentFilter, true);
  await click(window, '[data-aihub-resource-filter="agent"] [data-aihub-filter-value="mature"]', "mature Agent filter missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-product-id="codex-cli"]\'))', "catalog-backed mature Agent host missing");
  await click(window, '[data-aihub-resource-filter="agent"] [data-aihub-filter-value="all"]', "all Agent filter missing");
  await click(window, '[data-aihub-resource-filter="source-channel"] [data-aihub-filter-value="community"]', "community channel missing");
  await click(window, '[data-aihub-resource-filter="scenario"] [data-aihub-filter-value="gaming"]', "gaming scenario filter missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-product-id="fixture-game-host"]\'))', "community gaming host missing");
  await click(window, '[data-aihub-resource-product-id="fixture-game-host"]', "community gaming host did not open");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-id="fixture-unsafe-community-mcp"]\'))', "unsafe community resource missing");
  await click(window, '[data-aihub-resource-id="fixture-unsafe-community-mcp"]', "unsafe community resource detail did not open");
  await waitFor(window, 'Boolean(document.querySelector(\'.resourceWarning\'))', "unsafe warning did not render");
}

async function assertContributionRoute(window) {
  await click(window, '.sidebarContribution button', "global submission entry missing");
  await waitFor(window, 'Boolean(document.querySelector(\'.contributionPage\'))', "submission route did not render");
  const result = await window.webContents.executeJavaScript(`(() => ({
    actions: document.querySelectorAll('[data-aihub-action="submit-resource"]').length,
    disabled: document.querySelector('[data-aihub-action="submit-resource"]')?.disabled === true,
    fields: [...document.querySelectorAll('[data-aihub-submission-field]')].map((node) => node.dataset.aihubSubmissionField)
  }))()`);
  assert.equal(result.actions, 1, "only the global submission route may contain a submit CTA");
  assert.equal(result.disabled, true, "submission must stay unavailable until a backend capability exists");
  assert.deepEqual(result.fields, [], "disabled submission seam must not expose owner or reviewer fields");
  return result;
}

async function snapshot(window, width, height) {
  window.setContentSize(width, height);
  await waitFor(window, `window.innerWidth === ${width}`, `viewport ${width} did not settle`);
  const result = await window.webContents.executeJavaScript(`(() => {
    const details = document.querySelector('.resourceSourceDetails');
    if (details) details.open = true;
    const visibleButtons = [...document.querySelectorAll('button')].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      warning: document.querySelector('.resourceWarning')?.textContent.trim() || '',
      managedProbe: Boolean(document.querySelector('[data-aihub-action="inspect-extension"]')),
      externalData: document.body.textContent.includes('外部平台数据'),
      buttonsInsideViewport: visibleButtons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }),
      pageHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
    };
  })()`);
  assert.match(result.warning, /已被拒绝|rejected/i);
  assert.equal(result.managedProbe, false, "unsafe resource must not expose a managed probe");
  assert.equal(result.externalData, true, "external values must retain their platform label");
  assert.ok(result.scrollWidth <= result.viewport, `viewport ${width} has horizontal overflow`);
  assert.equal(result.buttonsInsideViewport, true, "visible resource buttons must stay in the viewport");
  fs.mkdirSync(outputDirectory, { recursive: true });
  window.setContentSize(width, result.pageHeight);
  await waitFor(window, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))', `full-page viewport ${width} did not settle`);
  fs.writeFileSync(path.join(outputDirectory, `resource-store-channel-${width}.png`), (await window.webContents.capturePage()).toPNG());
  window.setContentSize(width, height);
  return result;
}

async function run() {
  const window = new BrowserWindow({
    show: false,
    width: 1365,
    height: 768,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload }
  });
  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-store-id="skill"]\'))', "resource stores did not render");
    const skillEmpty = await assertEmptyCommunitySkillChannel(window);
    const skillEmptyPreviews = {
      lightDesktop: await snapshotEmptyCommunitySkillChannel(window, 1365, 768, "light"),
      lightNarrow: await snapshotEmptyCommunitySkillChannel(window, 740, 768, "light"),
      darkDesktop: await snapshotEmptyCommunitySkillChannel(window, 1365, 768, "dark"),
      darkNarrow: await snapshotEmptyCommunitySkillChannel(window, 740, 768, "dark")
    };
    await openUnsafeDetail(window);
    const result = {
      desktop: await snapshot(window, 1365, 768),
      narrow: await snapshot(window, 740, 768)
    };
    const submission = await assertContributionRoute(window);
    process.stdout.write(`${JSON.stringify({ ok: true, ...result, submission, skillEmpty, skillEmptyPreviews }, null, 2)}\n`);
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady().then(run).then(
  () => app.quit(),
  (error) => {
    console.error(error.stack || error);
    app.exit(1);
  }
);
