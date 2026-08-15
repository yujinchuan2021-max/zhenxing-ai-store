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

async function resourceIds(window) {
  return window.webContents.executeJavaScript(`
    [...document.querySelectorAll('[data-aihub-resource-level="resources"] [data-aihub-resource-id]')]
      .map((node) => node.getAttribute('data-aihub-resource-id'))
      .sort()
  `);
}

async function chooseResourceFilter(window, marker, value) {
  const selector = `[data-aihub-resource-filter="${marker}"] [data-aihub-filter-value="${value}"]`;
  const changed = await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) return false;
    button.focus();
    button.click();
    return true;
  })()`);
  assert.equal(changed, true, `${marker}/${value} filter missing`);
}

async function assertStoreEntries(window) {
  for (const store of ["skill", "mcp", "plugin", "connector"]) {
    await click(window, `[data-aihub-resource-store-id="${store}"]`, `${store} store entry missing`);
    await waitFor(window, `Boolean(document.querySelector('[data-aihub-resource-store-current="${store}"]'))`, `${store} store was not preselected`);
    assert.equal(
      Boolean(await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-filter=host]')")),
      true,
      `${store} store must expose the host filter`
    );
    assert.equal(
      await window.webContents.executeJavaScript("document.querySelectorAll('[data-aihub-resource-filter=scenario]').length"),
      store === "skill" ? 1 : 0,
      "Skill category must not leak into another store"
    );
  }
  await click(window, '[data-aihub-resource-store-id="plugin"]', "Plugin store entry missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-empty-source="official"]\'))', "true source-empty state missing");
  assert.equal(Boolean(await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-empty-filter]')")), false);
}

async function assertSkillScenarioFilters(window) {
  await click(window, '[data-aihub-resource-store-id="skill"]', "Skill store entry missing");
  await waitFor(window, 'document.querySelectorAll(\'[data-aihub-resource-level="resources"] [data-aihub-resource-id]\').length === 2', "official Skill resources missing");
  assert.deepEqual(
    await resourceIds(window),
    ["fixture-official-game-skill", "fixture-official-skill"],
    "one multi-host Skill must still render exactly one canonical card"
  );
  const publisher = await window.webContents.executeJavaScript(`(() => ({
    card: document.querySelector('[data-aihub-resource-id="fixture-official-skill"]')?.textContent || '',
    parent: document.querySelector('[data-aihub-publisher-parent]')
  }))()`);
  assert.match(publisher.card, /Fixture Publisher/);
  assert.equal(publisher.parent, null, "publisher must remain a fact, not a parent navigation node");
  const accessibility = await window.webContents.executeJavaScript(`(() => {
    const group = document.querySelector('[data-aihub-resource-filter="scenario"] [role="group"]');
    return { label: group?.getAttribute('aria-label') || '', buttonsTyped: [...(group?.querySelectorAll('button') || [])].every((button) => button.type === 'button') };
  })()`);
  assert.match(accessibility.label, /场景|scenario/i);
  assert.equal(accessibility.buttonsTyped, true);

  await chooseResourceFilter(window, "scenario", "programming-development");
  await waitFor(window, 'document.querySelectorAll(\'[data-aihub-resource-level="resources"] [data-aihub-resource-id]\').length === 1', "official programming Skill filter did not narrow");
  assert.deepEqual(await resourceIds(window), ["fixture-official-skill"]);
  const pressed = await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('[data-aihub-resource-filter="scenario"] [data-aihub-filter-value="programming-development"]');
    return { pressed: button?.getAttribute('aria-pressed'), focused: document.activeElement === button, count: document.querySelector('.directorySummary span')?.textContent.trim() || '' };
  })()`);
  assert.deepEqual({ pressed: pressed.pressed, focused: pressed.focused }, { pressed: "true", focused: true });
  assert.match(pressed.count, /1/);

  await chooseResourceFilter(window, "source-channel", "community");
  await waitFor(window, 'document.querySelectorAll(\'[data-aihub-resource-level="resources"] [data-aihub-resource-id]\').length === 1', "community programming Skill combination did not settle");
  assert.deepEqual(await resourceIds(window), ["fixture-community-skill"]);
  await chooseResourceFilter(window, "host", "codex-cli");
  assert.deepEqual(await resourceIds(window), ["fixture-community-skill"]);
  await chooseResourceFilter(window, "scenario", "gaming");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-empty-filter]\'))', "host/category no-match state missing");

  await chooseResourceFilter(window, "scenario", "research");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-empty-filter]\'))', "no-match filter state missing");
  assert.equal(Boolean(await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-empty-source]')")), false);

  await chooseResourceFilter(window, "scenario", "全部");
  assert.deepEqual(await resourceIds(window), ["fixture-community-skill"]);
  await chooseResourceFilter(window, "host", "全部");
  await waitFor(window, 'document.querySelectorAll(\'[data-aihub-resource-level="resources"] [data-aihub-resource-id]\').length === 2', "All did not restore community Skills");
  assert.deepEqual(await resourceIds(window), ["fixture-community-game-skill", "fixture-community-skill"]);

  await chooseResourceFilter(window, "source-channel", "official");
  await chooseResourceFilter(window, "scenario", "programming-development");
  await click(window, '[data-aihub-resource-id="fixture-official-skill"]', "multi-host Skill card missing");
  await waitFor(window, 'document.querySelectorAll(\'[data-aihub-resource-compatible-hosts] [data-aihub-resource-host-id]\').length === 2', "detail did not list every compatible host");
  assert.deepEqual(await window.webContents.executeJavaScript(`
    [...document.querySelectorAll('[data-aihub-resource-compatible-hosts] [data-aihub-resource-host-id]')]
      .map((node) => node.getAttribute('data-aihub-resource-host-id')).sort()
  `), ["codex-cli", "fixture-game-host"]);
  await click(window, '[data-aihub-action="back-resource-list"]', "resource detail back button missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-id="fixture-official-skill"]\'))', "resource list did not return");
  const restored = await window.webContents.executeJavaScript(`(() => ({
    source: document.querySelector('[data-aihub-resource-filter="source-channel"] [aria-pressed="true"]')?.dataset.aihubFilterValue,
    scenario: document.querySelector('[data-aihub-resource-filter="scenario"] [aria-pressed="true"]')?.dataset.aihubFilterValue,
    host: document.querySelector('[data-aihub-resource-filter="host"] [aria-pressed="true"]')?.dataset.aihubFilterValue
  }))()`);
  assert.deepEqual(restored, { source: "official", scenario: "programming-development", host: "全部" });
  return { officialAll: 2, filtered: 1, communityAll: 2, detailHosts: 2 };
}

async function assertConnectionRelations(window) {
  await click(window, '[data-aihub-resource-store-id="mcp"]', "MCP store entry missing");
  await chooseResourceFilter(window, "source-channel", "community");
  await chooseResourceFilter(window, "host", "fixture-game-host");
  await waitFor(
    window,
    'Boolean(document.querySelector(\'[data-aihub-resource-id="fixture-community-connector"]\'))',
    "multi-mode connection resource missing"
  );
  const card = await window.webContents.executeJavaScript(`(() => ({
    count: document.querySelectorAll('[data-aihub-resource-id="fixture-community-connector"]').length,
    text: document.querySelector('[data-aihub-resource-id="fixture-community-connector"]')?.textContent || ''
  }))()`);
  assert.equal(card.count, 1, "two relations must not duplicate the canonical resource card");
  assert.match(card.text, /Fixture Connection Publisher/);

  await click(
    window,
    '[data-aihub-resource-id="fixture-community-connector"]',
    "multi-mode connection resource did not open"
  );
  await waitFor(
    window,
    'document.querySelectorAll("[data-aihub-resource-connection-mode]").length === 2',
    "connection modes did not render"
  );
  const facts = await window.webContents.executeJavaScript(`(() => {
    const group = document.querySelector('.resourceRelationFacts');
    const publisher = document.querySelector('[data-aihub-resource-publisher]');
    const hosts = document.querySelector('[data-aihub-resource-compatible-hosts]');
    const modes = document.querySelector('[data-aihub-resource-connection-modes]');
    return {
      publisher: publisher?.textContent || '',
      hosts: hosts?.querySelectorAll('[data-aihub-resource-host-id]').length || 0,
      edges: [...(modes?.querySelectorAll('[data-aihub-resource-connection-mode]') || [])]
        .map((node) => ({
          mode: node.getAttribute('data-aihub-resource-connection-mode'),
          hostId: node.getAttribute('data-aihub-resource-connection-host-id'),
          bindingKind: node.getAttribute('data-aihub-resource-connection-binding-kind'),
          text: node.textContent || ''
        })),
      peers: Boolean(group && publisher?.parentElement === group && hosts?.parentElement === group && modes?.parentElement === group),
      parentNode: document.querySelector('[data-aihub-publisher-parent]')
    };
  })()`);
  assert.match(facts.publisher, /Fixture Connection Publisher/);
  assert.equal(facts.hosts, 2);
  assert.deepEqual(facts.edges, [
    {
      mode: "remote-mcp",
      hostId: "fixture-game-host",
      bindingKind: "mcp-tool",
      text: "远程 MCP · Fixture Game Host"
    },
    {
      mode: "chatgpt-app",
      hostId: "codex-cli",
      bindingKind: "connector-authorized-connection",
      text: "ChatGPT App · Fixture Codex CLI"
    }
  ]);
  assert.equal(facts.peers, true, "publisher, hosts, and modes must be peer facts");
  assert.equal(facts.parentNode, null, "publisher must remain a fact, not a parent");

  await click(window, '[data-aihub-action="back-resource-list"]', "connection detail Back missing");
  await waitFor(
    window,
    'Boolean(document.querySelector(\'[data-aihub-resource-id="fixture-community-connector"]\'))',
    "connection resource list did not return"
  );
  assert.deepEqual(
    await window.webContents.executeJavaScript(`(() => ({
      source: document.querySelector('[data-aihub-resource-filter="source-channel"] [aria-pressed="true"]')?.dataset.aihubFilterValue,
      host: document.querySelector('[data-aihub-resource-filter="host"] [aria-pressed="true"]')?.dataset.aihubFilterValue,
      count: document.querySelectorAll('[data-aihub-resource-id="fixture-community-connector"]').length
    }))()`),
    { source: "community", host: "fixture-game-host", count: 1 }
  );
  return { cards: 1, publisher: true, hosts: 2, edges: 2, backPreserved: true };
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
  assert.equal(filters.scenarioCount, 0, "scenario filters belong only to the Skill store");
  assert.equal(filters.agentFilter, true);
  await click(window, '[data-aihub-resource-filter="agent"] [data-aihub-filter-value="mature"]', "mature Agent filter missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-resource-id="openai-codex-mcp-config"]\'))', "catalog-backed mature Agent resource missing");
  await click(window, '[data-aihub-resource-filter="agent"] [data-aihub-filter-value="all"]', "all Agent filter missing");
  await click(window, '[data-aihub-resource-filter="source-channel"] [data-aihub-filter-value="community"]', "community channel missing");
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

async function assertVendorProductRoute(window) {
  const opened = await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll('.sidebar nav button')]
      .find((node) => /全部 AI 厂商|AI vendors/i.test(node.textContent || ''));
    button?.click();
    return Boolean(button);
  })()`);
  assert.equal(opened, true, "AI vendor directory entry missing");
  await waitFor(window, 'Boolean(document.querySelector(\'[data-aihub-vendor-id="fixture-vendor"]\'))', "vendor directory did not render");
  await click(window, '[data-aihub-vendor-id="fixture-vendor"]', "fixture vendor did not open");
  await waitFor(window, 'Boolean(document.querySelector(\'.vendorHero\') && document.querySelector(\'.vendorProducts\'))', "vendor product page did not render");
  assert.equal(
    await window.webContents.executeJavaScript("document.querySelectorAll('[data-aihub-resource-filter]').length"),
    0,
    "resource-store filters must not leak into Product or Vendor pages"
  );
  return { vendor: true, products: true };
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
    await assertStoreEntries(window);
    const skillFilters = await assertSkillScenarioFilters(window);
    const connectionRelations = await assertConnectionRelations(window);
    await openUnsafeDetail(window);
    const result = {
      desktop: await snapshot(window, 1365, 768),
      narrow: await snapshot(window, 740, 768)
    };
    const submission = await assertContributionRoute(window);
    const vendorProduct = await assertVendorProductRoute(window);
    process.stdout.write(`${JSON.stringify({ ok: true, ...result, submission, skillFilters, connectionRelations, vendorProduct }, null, 2)}\n`);
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
