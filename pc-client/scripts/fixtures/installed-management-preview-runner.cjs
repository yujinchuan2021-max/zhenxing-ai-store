const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const {
  buildInstalledProductManagement
} = require("../../shared/installed-product-management.cjs");

const root = path.resolve(__dirname, "..", "..");
const outputDirectory = path.join(root, "output", "playwright");
const preload = path.join(__dirname, "installed-management-preview-preload.cjs");
const userData = process.env.AIHUB_INSTALLED_LAYOUT_USER_DATA;

if (!userData) throw new Error("AIHUB_INSTALLED_LAYOUT_USER_DATA is required");
app.setPath("userData", userData);

function assertInvalidCanonicalFixture() {
  const product = {
    id: "fixture-invalid-canonical-package",
    name: "Fixture Invalid Canonical Package",
    enabled: true,
    productType: "desktop-download-only",
    moduleId: "desktop-download-only.signed-catalog",
    installProfileId: "desktop-download-only.signed-catalog",
    capabilities: ["install"],
    download: {
      url: "https://example.invalid/Invalid-Setup.exe",
      fileName: "Invalid-Setup.exe",
      artifactKind: "exe",
      command: "cmd.exe"
    }
  };
  const management = buildInstalledProductManagement({
    vendors: [{ id: "fixture-vendor", enabled: true, name: "Fixture Vendor", products: [product] }],
    downloadTasks: {
      [product.id]: { productId: product.id, phase: "completed", filePath: "C:\\Fixture\\Downloads\\Invalid-Setup.exe" }
    }
  });
  assert.equal(management.packages[0]?.canInstall, false);
  return management.packages[0]?.canInstall === true;
}

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

async function snapshot(window, width, height) {
  window.setContentSize(width, height);
  await waitFor(
    window,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
    `viewport ${width} did not settle`
  );
  const result = await window.webContents.executeJavaScript(`(() => {
    const labels = [
      "Fixture Managed Desktop",
      "Fixture CLI",
      "Fixture Docker Environment",
      "Fixture Managed MCP Resource",
      "Fixture External Store Installation",
      "Fixture Vendor-managed Desktop",
      "Fixture Canonical Package",
      "Fixture Invalid Canonical Package"
    ];
    const cards = [...document.querySelectorAll(".managementCard")];
    const visibleButtons = [...document.querySelectorAll("button")].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const packageCard = cards.find((card) => card.textContent.includes("Fixture Canonical Package"));
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      pageHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      management: Boolean(document.querySelector(".installedManagementPage")),
      labels: labels.filter((label) => cards.some((card) => card.textContent.includes(label))),
      installButton: packageCard
        ? [...packageCard.querySelectorAll("button")].map((button) => button.textContent.trim())
        : [],
      buttonsInsideViewport: visibleButtons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      })
    };
  })()`);
  assert.equal(result.management, true, "installed management route did not render");
  assert.deepEqual(result.labels.sort(), [
    "Fixture CLI",
    "Fixture Canonical Package",
    "Fixture Docker Environment",
    "Fixture External Store Installation",
    "Fixture Managed Desktop",
    "Fixture Managed MCP Resource",
    "Fixture Vendor-managed Desktop"
  ]);
  assert.ok(
    result.installButton.includes("点击安装"),
    `canonical completed package must project 点击安装: ${result.installButton.join(" / ")}`
  );
  assert.ok(
    result.scrollWidth <= result.viewport,
    `viewport ${width} has horizontal overflow: ${result.scrollWidth}/${result.viewport}`
  );
  assert.equal(result.buttonsInsideViewport, true, "a visible management button is outside the viewport");
  fs.mkdirSync(outputDirectory, { recursive: true });
  window.setContentSize(width, result.pageHeight);
  await waitFor(
    window,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
    `full-page viewport ${width} did not settle`
  );
  const image = await window.webContents.capturePage();
  fs.writeFileSync(
    path.join(outputDirectory, `installed-management-${width}.png`),
    image.toPNG()
  );
  window.setContentSize(width, height);
  return result;
}

async function assertPressedFeedback(window) {
  const result = await window.webContents.executeJavaScript(`(() => {
    const rule = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .find((candidate) => candidate.selectorText === "button:not(:disabled):active");
    return rule
      ? {
          transform: rule.style.transform,
          filter: rule.style.filter,
          boxShadow: rule.style.boxShadow
        }
      : null;
  })()`);
  assert.equal(result?.transform, "translateY(2px) scale(0.985)");
  assert.equal(result?.filter, "brightness(0.94)");
  assert.match(result?.boxShadow || "", /inset/);
  assert.match(result?.boxShadow || "", /rgba\(12, 31, 25, 0\.2\)/);
  return result;
}

async function assertManagementBusy(window) {
  const findButton = (cardName, label) => `(() => {
    const card = [...document.querySelectorAll('.managementCard')]
      .find((item) => item.textContent.includes(${JSON.stringify(cardName)}));
    return card && [...card.querySelectorAll('button')]
      .find((item) => item.textContent.trim() === ${JSON.stringify(label)});
  })()`;
  const start = async (cardName, label, key, busyLabel) => {
    await window.webContents.executeJavaScript(
      `window.aihubPC.fixtureHoldManagementAction(${JSON.stringify(key)})`
    );
    const clicked = await window.webContents.executeJavaScript(
      `(() => { const button = ${findButton(cardName, label)}; button?.click(); return Boolean(button); })()`
    );
    assert.equal(clicked, true, `${key} trigger missing`);
    await waitFor(
      window,
      `(() => { const button = ${findButton(cardName, busyLabel)}; return button?.disabled === true; })()`,
      `${key} did not enter its immediate busy presentation`
    );
  };

  await start(
    "Fixture Managed Desktop",
    "打开",
    "open:fixture-managed-desktop",
    "打开中…"
  );
  const independentCalls = await window.webContents.executeJavaScript(`(() => {
    const card = [...document.querySelectorAll('.managementCard')]
      .find((item) => item.textContent.includes('Fixture Canonical Package'));
    const button = card && [...card.querySelectorAll('button')]
      .find((item) => item.textContent.trim() === '打开文件夹');
    button?.click();
    return window.aihubPC.fixtureGetManagementActionCalls();
  })()`);
  assert.ok(
    independentCalls.includes("show-package:fixture-canonical-package"),
    "another card must remain usable"
  );
  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureResolveManagementAction('open:fixture-managed-desktop')`
  );
  await waitFor(
    window,
    `(() => { const button = ${findButton("Fixture Managed Desktop", "打开")}; return button && !button.disabled; })()`,
    "open action did not recover"
  );

  await start(
    "Fixture Canonical Package",
    "删除安装包",
    "delete-package:fixture-canonical-package",
    "删除中…"
  );
  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureResolveManagementAction('delete-package:fixture-canonical-package', true)`
  );
  await waitFor(
    window,
    `(() => { const button = ${findButton("Fixture Canonical Package", "删除安装包")}; return button && !button.disabled; })()`,
    "delete action did not recover after rejection"
  );

  await start(
    "Fixture Node Environment",
    "卸载",
    "uninstall-environment:node",
    "卸载中…"
  );
  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureResolveManagementAction('uninstall-environment:node')`
  );
  await waitFor(
    window,
    `(() => { const button = ${findButton("Fixture Node Environment", "卸载")}; return button && !button.disabled; })()`,
    "uninstall action did not recover"
  );
}

async function assertEnvironmentUpdate(window) {
  const nodeCard = `(() => [...document.querySelectorAll('.managementCard')]
    .find((item) => item.textContent.includes('Fixture Node Environment')))()`;
  const initial = await window.webContents.executeJavaScript(`(() => {
    const card = ${nodeCard};
    return {
      recommended: card?.textContent.includes('审核推荐版本 24.18.0') === true,
      action: [...(card?.querySelectorAll('button') || [])]
        .some((button) => button.textContent.trim() === '更新')
    };
  })()`);
  assert.deepEqual(initial, { recommended: true, action: true });

  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureHoldManagementAction('prepare-update:node')`
  );
  await window.webContents.executeJavaScript(`(() => {
    const card = ${nodeCard};
    [...card.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === '更新')?.click();
  })()`);
  await waitFor(
    window,
    `(() => { const card = ${nodeCard}; const button = [...card.querySelectorAll('button')].find((item) => item.textContent.trim() === '下载更新中…'); return button?.disabled === true; })()`,
    "environment update download did not become busy"
  );
  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureResolveManagementAction('prepare-update:node')`
  );
  await waitFor(
    window,
    `(() => { const card = ${nodeCard}; return [...card.querySelectorAll('button')].some((item) => item.textContent.trim() === '打开更新安装包' && !item.disabled); })()`,
    "environment update did not advance to explicit open"
  );

  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureHoldManagementAction('open-updater:node')`
  );
  await window.webContents.executeJavaScript(`(() => {
    const card = ${nodeCard};
    [...card.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === '打开更新安装包')?.click();
  })()`);
  await waitFor(
    window,
    `(() => { const card = ${nodeCard}; const button = [...card.querySelectorAll('button')].find((item) => item.textContent.trim() === '打开更新中…'); return button?.disabled === true; })()`,
    "environment updater open did not become busy"
  );
  await window.webContents.executeJavaScript(
    `window.aihubPC.fixtureResolveManagementAction('open-updater:node')`
  );
  await waitFor(
    window,
    `(() => { const card = ${nodeCard}; return [...card.querySelectorAll('button')].some((item) => item.textContent.trim() === '打开更新安装包' && !item.disabled); })()`,
    "environment updater open did not recover"
  );
}

async function openVendor(window, vendorId) {
  const opened = await window.webContents.executeJavaScript(`(() => {
    const button = [...document.querySelectorAll(".navItem")].find(
      (candidate) => candidate.textContent.includes("全部 AI 厂商")
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(opened, true, "vendor directory action was not rendered");
  await waitFor(
    window,
    `Boolean(document.querySelector('[data-aihub-vendor-id="${vendorId}"]'))`,
    `${vendorId} vendor card did not render`
  );
  const selected = await window.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('[data-aihub-vendor-id="${vendorId}"]');
    if (!card) return false;
    card.click();
    return true;
  })()`);
  assert.equal(selected, true, `${vendorId} vendor card did not open`);
}

async function snapshotProductStates(window, width, height) {
  window.setContentSize(width, height);
  await waitFor(
    window,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.innerWidth === " + width + "))))",
    `product-state viewport ${width} did not resize`
  );
  await waitFor(
    window,
    "Boolean(document.querySelector('[data-aihub-product-id=\"fixture-running-canonical\"]'))",
    "fixture product rows did not render"
  );
  const result = await window.webContents.executeJavaScript(`(() => {
    const busyRow = document.querySelector('[data-aihub-product-id="fixture-running-canonical"]');
    const missingRow = document.querySelector('[data-aihub-product-id="fixture-missing-canonical"]');
    const busy = busyRow?.querySelector('[data-aihub-action="product-busy"]');
    const missing = missingRow?.querySelector('[data-aihub-action="install-product"]');
    busy?.click();
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      busyDisabled: busy?.disabled === true,
      busyAction: busy?.dataset.aihubAction || "",
      missingAction: missing?.dataset.aihubAction || "",
      missingLabel: missing?.textContent.trim() || "",
      duplicateDownloadStarts: window.aihubPC.fixtureGetDownloadStarts(),
      pageHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
    };
  })()`);
  assert.equal(result.busyDisabled, true, "running download must disable its primary action");
  assert.equal(result.busyAction, "product-busy");
  assert.equal(result.missingAction, "install-product", "missing package must return to download action");
  assert.equal(result.missingLabel, "一键下载");
  assert.deepEqual(result.duplicateDownloadStarts, [], "disabled busy action must not start a duplicate download");
  assert.ok(result.scrollWidth <= result.viewport, "product-state fixture has horizontal overflow");
  fs.mkdirSync(outputDirectory, { recursive: true });
  window.setContentSize(width, result.pageHeight);
  await waitFor(
    window,
    "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
    `product-state viewport ${width} did not settle`
  );
  fs.writeFileSync(
    path.join(outputDirectory, `installed-management-states-${width}.png`),
    (await window.webContents.capturePage()).toPNG()
  );
  window.setContentSize(width, height);
  return result;
}

async function assertCliRedeployPresentation(window) {
  await openVendor(window, "anytype");
  try {
    await waitFor(
      window,
      "Boolean(document.querySelector('[data-aihub-product-id=\"anytype-cli\"] [data-aihub-action=\"install-product\"]'))",
      "deploy-only CLI action did not render"
    );
  } catch (error) {
    const dom = await window.webContents.executeJavaScript(`(() => ({
      rows: [...document.querySelectorAll('.productRow')].map((row) => ({
        id: row.dataset.aihubProductId,
        text: row.textContent.trim(),
        actions: [...row.querySelectorAll('button')].map((button) => ({ text: button.textContent.trim(), action: button.dataset.aihubAction || '' }))
      }))
    }))()`);
    throw new Error(`${error.message}: ${JSON.stringify(dom)}`);
  }
  const action = await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('[data-aihub-product-id="anytype-cli"] [data-aihub-action="install-product"]');
    return button ? { disabled: button.disabled, label: button.textContent.trim() } : null;
  })()`);
  assert.equal(action?.disabled, false, "missing CLI must offer an enabled redeploy action");
  return action;
}

async function run() {
  const invalidCanonicalCanInstall = assertInvalidCanonicalFixture();
  const window = new BrowserWindow({
    show: false,
    width: 1365,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload
    }
  });
  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    await waitFor(
      window,
      "Boolean(document.querySelector('.topActions button.quietButton'))",
      "home top actions did not render"
    );
    const clicked = await window.webContents.executeJavaScript(`(() => {
      const button = [...document.querySelectorAll(".topActions button")].find(
        (candidate) => candidate.textContent.trim() === "已安装"
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(clicked, true, "installed management action was not rendered");
    await waitFor(
      window,
      "Boolean(document.querySelector('.installedManagementPage'))",
      "installed management action did not navigate"
    );
    const result = {
      desktop: await snapshot(window, 1365, 768),
      narrow: await snapshot(window, 740, 768)
    };
    await assertManagementBusy(window);
    await assertEnvironmentUpdate(window);
    const activeFeedback = await assertPressedFeedback(window);
    if (process.env.AIHUB_INSTALLED_QUEUE_ONLY === "1") {
      process.stdout.write(`${JSON.stringify({ ok: true, invalidCanonicalCanInstall, ...result }, null, 2)}\n`);
      return;
    }
    await openVendor(window, "fixture-vendor");
    const states = {
      desktop: await snapshotProductStates(window, 1365, 768),
      narrow: await snapshotProductStates(window, 740, 768)
    };
    const cliRedeploy = await assertCliRedeployPresentation(window);
    process.stdout.write(`${JSON.stringify({ ok: true, invalidCanonicalCanInstall, activeFeedback, ...result, states, cliRedeploy }, null, 2)}\n`);
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
