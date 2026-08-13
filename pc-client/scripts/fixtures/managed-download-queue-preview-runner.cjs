"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..", "..");
const userData = process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_USER_DATA;
const output = path.join(root, "output", "playwright");
if (!userData) throw new Error("AIHUB_MANAGED_DOWNLOAD_QUEUE_USER_DATA is required");
app.setPath("userData", userData);

function waitFor(window, expression, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        if (await window.webContents.executeJavaScript(expression)) return resolve();
        if (Date.now() > deadline) return reject(new Error(message));
        setTimeout(check, 40);
      } catch (error) { reject(error); }
    };
    void check();
  });
}

function flushRenderer(window) {
  return window.webContents.executeJavaScript("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
}

async function screenshot(window, width, label) {
  window.setContentSize(width, 768);
  await waitFor(window, `window.innerWidth === ${width}`, "viewport did not settle");
  const metrics = await window.webContents.executeJavaScript(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight;
    });
    return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttonsInside: buttons.every((node) => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }) };
  })()`);
  assert.ok(metrics.scrollWidth <= metrics.viewport, "horizontal overflow");
  assert.equal(metrics.buttonsInside, true, "visible button outside viewport");
  const height = await window.webContents.executeJavaScript("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)");
  window.setContentSize(width, height);
  if (process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT !== "1") {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, `managed-download-queue-${label}-${width}.png`), (await window.webContents.capturePage()).toPNG());
  }
  return metrics;
}

async function run() {
  const window = new BrowserWindow({ show: false, width: 1365, height: 768, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "installed-management-preview-preload.cjs") } });
  let bannerWindow = null;
  let composerWindow = null;
  const causalObservations = [];
  let stage = "create window";
  try {
    stage = "load renderer";
    await window.loadFile(path.join(root, "dist", "index.html"));
    const rawCatalogBefore = await window.webContents.executeJavaScript("window.aihubPC.getCatalog().then((result) => result.catalog)");
    stage = "assert carousel and fixed-language presentation";
    await waitFor(window, "Boolean(document.querySelector('.carouselHero'))", "fixture carousel missing");
    const carousel = await window.webContents.executeJavaScript(`(() => {
      const hero = document.querySelector('.carouselHero');
      const previous = hero.querySelector('[data-aihub-carousel-action=previous]');
      const next = hero.querySelector('[data-aihub-carousel-action=next]');
      const heroRect = hero.getBoundingClientRect();
      const previousRect = previous?.getBoundingClientRect();
      const nextRect = next?.getBoundingClientRect();
      return {
        pause: Boolean(hero.querySelector('.carouselPause')),
        edges: hero.querySelectorAll('.carouselEdge').length,
        dots: hero.querySelectorAll('.carouselControls button').length,
        grouped: hero.querySelector('.carouselControls')?.getAttribute('role') === 'group',
        previousAtEdge: Boolean(previousRect && previousRect.left <= heroRect.left + 24),
        nextAtEdge: Boolean(nextRect && nextRect.right >= heroRect.right - 24),
        sizes: [previousRect?.width || 0, previousRect?.height || 0, nextRect?.width || 0, nextRect?.height || 0]
      };
    })()`);
    assert.equal(carousel.pause, false, "carousel must not expose a play/pause button");
    assert.equal(carousel.edges, 2, "carousel must expose two edge arrows");
    assert.ok(carousel.dots >= 2, "carousel dots must remain visible");
    assert.equal(carousel.grouped, true, "carousel dots must expose one screen-reader group");
    assert.equal(carousel.previousAtEdge, true, "previous arrow must sit on the banner edge");
    assert.equal(carousel.nextAtEdge, true, "next arrow must sit on the banner edge");
    assert.equal(carousel.sizes.every((value) => value >= 40), true, "edge arrows must retain a 40px target");
    for (const theme of ["light", "dark"]) {
      for (const width of [1365, 740]) {
        window.setContentSize(width, 768);
        await waitFor(window, `window.innerWidth === ${width}`, "carousel viewport did not settle");
        await window.webContents.executeJavaScript(`document.querySelector('.pcApp').dataset.theme = ${JSON.stringify(theme)}`);
        const state = await window.webContents.executeJavaScript(`(() => {
          const hero = document.querySelector('.carouselHero');
          const arrows = [...hero.querySelectorAll('.carouselEdge')];
          const dots = [...hero.querySelectorAll('.carouselControls button')];
          const dot = dots[0];
          dot.focus();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            arrowsInside: arrows.every((button) => { const rect = button.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }),
            focusableDot: document.activeElement === dot,
            readableArrows: arrows.every((button) => getComputedStyle(button).color !== getComputedStyle(button).backgroundColor),
            dotTargets: dots.map((button) => { const rect = button.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }),
            dotVisuals: dots.map((button) => { const style = getComputedStyle(button, '::before'); return { width: parseFloat(style.width), height: parseFloat(style.height), active: button.getAttribute('aria-current') === 'true' }; }),
            mouseTarget: (() => { const rect = dots[1].getBoundingClientRect(); return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), label: dots[1].getAttribute('aria-label') }; })()
          };
        })()`);
        assert.equal(state.overflow, false, `${theme}/${width} carousel must not overflow`);
        assert.equal(state.arrowsInside, true, `${theme}/${width} carousel arrows must stay in the viewport`);
        assert.equal(state.focusableDot, true, `${theme}/${width} carousel dots must remain keyboard-focusable`);
        assert.equal(state.readableArrows, true, `${theme}/${width} carousel arrows must remain visible`);
        assert.equal(state.dotTargets.every(({ width: targetWidth, height }) => targetWidth >= 24 && height >= 24), true, `${theme}/${width} carousel dots must retain a 24px pointer target`);
        assert.equal(state.dotVisuals.every(({ width: visualWidth, height, active }) => visualWidth === (active ? 28 : 18) && height === (active ? 8 : 5)), true, `${theme}/${width} carousel dot visuals must retain their compact size`);
        window.webContents.sendInputEvent({ type: "mouseDown", x: state.mouseTarget.x, y: state.mouseTarget.y, button: "left", clickCount: 1 });
        window.webContents.sendInputEvent({ type: "mouseUp", x: state.mouseTarget.x, y: state.mouseTarget.y, button: "left", clickCount: 1 });
        await waitFor(window, `document.querySelector('.carouselControls button[aria-current=true]')?.getAttribute('aria-label') === ${JSON.stringify(state.mouseTarget.label)}`, `${theme}/${width} carousel pointer navigation failed`);
        await window.webContents.executeJavaScript("document.querySelector('.heroVisual').focus()");
        window.webContents.sendInputEvent({ type: "keyDown", keyCode: "LEFT" });
        window.webContents.sendInputEvent({ type: "keyUp", keyCode: "LEFT" });
        await waitFor(window, "document.querySelector('.carouselControls button[aria-current=true]') === document.querySelector('.carouselControls button') && document.querySelectorAll('.carouselControls button[aria-current=true]').length === 1", `${theme}/${width} carousel keyboard navigation or aria-current failed`);
      }
    }
    window.setContentSize(1365, 768);
    await waitFor(window, "window.innerWidth === 1365", "carousel desktop viewport did not restore");
    await window.webContents.executeJavaScript("document.querySelector('.pcApp').dataset.theme = 'light'");
    await window.webContents.executeJavaScript("document.querySelector('.heroVisual').focus()");
    window.webContents.sendInputEvent({ type: "keyDown", keyCode: "RIGHT" });
    window.webContents.sendInputEvent({ type: "keyUp", keyCode: "RIGHT" });
    await waitFor(window, "document.querySelector('.carouselControls button[aria-current=true]')?.getAttribute('aria-label')?.includes('2')", "carousel keyboard navigation failed");
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(window, "Boolean(document.querySelector('.settingsPanel'))", "settings panel missing");
    const chineseTaskName = await window.webContents.executeJavaScript("document.querySelector('.managedDownloadList [data-product-id=fixture-running-canonical]')?.textContent || ''");
    assert.match(chineseTaskName, /Fixture Running Download/, "Chinese task center must use the primary product name before switching languages");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('.settingsPanel button')].find((node) => node.textContent.trim() === 'English').click()");
    await waitFor(window, "document.querySelector('.carouselHero h1')?.textContent === 'Localized slide title'", "localized carousel title missing");
    const localizedHome = await window.webContents.executeJavaScript(`(() => ({
      slogan: document.querySelector('.brand')?.getAttribute('title'),
      slideDescription: document.querySelector('.carouselHero .heroCopy > span')?.textContent,
      slideAction: document.querySelector('.carouselActions .primaryAction')?.textContent,
      slideSecondaryAction: document.querySelector('.carouselActions .quietButton')?.textContent,
      slideAlt: document.querySelector('.carouselImage')?.getAttribute('alt'),
      vendor: document.querySelector('.featuredCard b')?.textContent,
      store: document.querySelector('[data-aihub-resource-store-id=skill]')?.textContent,
      extra: [...document.querySelectorAll('.navItem')].filter((node) => node.textContent.includes('Localized extra section')).length,
      taskRows: document.querySelectorAll('.managedDownloadList [data-product-id=fixture-running-canonical]').length,
      taskName: document.querySelector('.managedDownloadList [data-product-id=fixture-running-canonical]')?.textContent
    }))()`);
    assert.equal(localizedHome.slogan, "Localized catalog brand slogan", "brand slogan did not consume localized English");
    assert.equal(localizedHome.slideDescription, "Localized slide description", "carousel description did not consume localized English");
    assert.match(localizedHome.slideAction || "", /Localized slide action/, "carousel action did not consume localized English");
    assert.match(localizedHome.slideSecondaryAction || "", /Localized secondary action/, "carousel secondary action did not consume localized English");
    assert.equal(localizedHome.slideAlt, "Localized slide image alt", "carousel image alt did not consume localized English");
    assert.equal(localizedHome.vendor, "Localized vendor name", "featured vendor did not consume localized English");
    assert.match(localizedHome.store || "", /Localized Skill Store/, "resource store did not consume localized English");
    assert.equal(localizedHome.extra, 1, "extra section did not consume localized English exactly once");
    assert.equal(localizedHome.taskRows, 1, "localized task must remain one authoritative row");
    assert.match(localizedHome.taskName || "", /Localized task product name/, "task name did not consume localized English");
    assert.equal((localizedHome.taskName || "").includes("Fixture Running Download"), false, "task row retained its old primary name after switching to English");
    window.setContentSize(740, 768);
    await waitFor(window, "window.innerWidth === 740", "localized narrow viewport did not settle");
    assert.equal(await window.webContents.executeJavaScript("document.documentElement.scrollWidth <= innerWidth && document.querySelectorAll('.carouselHero h1').length === 1"), true, "localized 740 home must stay single and within the viewport");
    window.setContentSize(1365, 768);
    await waitFor(window, "window.innerWidth === 1365", "localized desktop viewport did not restore");

    bannerWindow = new BrowserWindow({ show: false, width: 740, height: 768, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "installed-management-preview-preload.cjs") } });
    await bannerWindow.loadFile(path.join(root, "dist", "index.html"), { query: { fixtureHome: "banner", fixtureLanguage: "zh" } });
    const bannerRawBefore = await bannerWindow.webContents.executeJavaScript("window.aihubPC.getCatalog().then((result) => result.catalog)");
    await waitFor(bannerWindow, `document.querySelector('.hero:not(.carouselHero) h1')?.textContent === ${JSON.stringify(rawCatalogBefore.home.banners[0].title)}`, "primary banner title missing before language switch");
    await bannerWindow.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(bannerWindow, "Boolean(document.querySelector('.settingsPanel'))", "banner settings panel missing");
    await bannerWindow.webContents.executeJavaScript("[...document.querySelectorAll('.settingsPanel button')].find((node) => node.textContent.trim() === 'English').click()");
    await waitFor(bannerWindow, "document.querySelector('.hero:not(.carouselHero) h1')?.textContent === 'Localized banner title'", "localized banner title missing");
    const localizedBanner = await bannerWindow.webContents.executeJavaScript(`(() => ({
      eyebrow: document.querySelector('.hero:not(.carouselHero) .heroCopy > p')?.textContent,
      description: document.querySelector('.hero:not(.carouselHero) .heroCopy > span')?.textContent,
      action: document.querySelector('.hero:not(.carouselHero) .primaryAction')?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth
    }))()`);
    assert.deepEqual(localizedBanner, { eyebrow: "Localized banner eyebrow", description: "Localized banner description", action: "Localized banner action →", overflow: false }, "banner did not consume localized English");
    await bannerWindow.webContents.executeJavaScript("[...document.querySelectorAll('.settingsPanel button')].find((node) => node.textContent.trim() === '中文').click()");
    await waitFor(bannerWindow, `document.querySelector('.hero:not(.carouselHero) h1')?.textContent === ${JSON.stringify(rawCatalogBefore.home.banners[0].title)}`, "banner did not restore its primary title");
    assert.equal(await bannerWindow.webContents.executeJavaScript("!document.querySelector('.hero:not(.carouselHero)').textContent.includes('Localized banner')"), true, "banner retained an old English display value after returning to Chinese");
    assert.deepEqual(await bannerWindow.webContents.executeJavaScript("window.aihubPC.getCatalog().then((result) => result.catalog)"), bannerRawBefore, "banner language switching mutated the raw catalog DTO");
    bannerWindow.destroy();
    bannerWindow = null;

    stage = "open localized Workflow Composer";
    composerWindow = new BrowserWindow({ show: false, width: 740, height: 768, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "installed-management-preview-preload.cjs") } });
    await composerWindow.loadFile(path.join(root, "dist", "index.html"), { query: { fixtureLanguage: "en", workflowPublicMode: "composer", agentBridgeMode: "enabled" } });
    await waitFor(composerWindow, "Boolean(document.querySelector('[data-aihub-workflow-store=public]'))", "localized Workflow Store navigation missing");
    await composerWindow.webContents.executeJavaScript("document.querySelector('[data-aihub-workflow-store=public]').click()");
    await waitFor(composerWindow, "Boolean(document.querySelector('.workflowPublicList button'))", "localized Workflow list missing");
    await composerWindow.webContents.executeJavaScript("document.querySelector('.workflowPublicList button').click()");
    await waitFor(composerWindow, "Boolean(document.querySelector('.workflowComposer select'))", "localized Workflow Composer missing");
    stage = "inspect localized Workflow Composer";
    const localizedComposer = await composerWindow.webContents.executeJavaScript(`(() => ({
      options: [...document.querySelectorAll('.workflowComposer select option')].map((node) => node.textContent),
      steps: document.querySelectorAll('.workflowComposerSteps li').length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      bridgeCalls: window.aihubPC.fixtureGetAgentBridgeCalls().length
    }))()`);
    assert.deepEqual(localizedComposer.options, ["Localized product name"], "Workflow Composer did not consume exactly one localized Agent name");
    assert.equal(localizedComposer.steps, 4, "Workflow Composer fixture lost its ordered dependency steps");
    assert.equal(localizedComposer.overflow, false, "localized Workflow Composer overflowed at 740px");
    assert.equal(localizedComposer.bridgeCalls, 0, "localized Workflow Composer must not invoke the disabled Bridge actions");
    stage = "compare localized Workflow Composer catalog";
    assert.deepEqual(await composerWindow.webContents.executeJavaScript("window.aihubPC.getCatalog().then((result) => result.catalog)"), rawCatalogBefore, "Workflow Composer localization mutated the raw catalog DTO");
    composerWindow.destroy();
    composerWindow = null;

    stage = "verify localized carousel routes";
    const routePreconditions = await window.webContents.executeJavaScript(`(() => ({
      settings: Boolean(document.querySelector('.settingsPanel > header > button')),
      secondary: Boolean(document.querySelector('.carouselActions .quietButton')),
      primary: Boolean(document.querySelector('.carouselActions .primaryAction'))
    }))()`);
    assert.deepEqual(routePreconditions, { settings: true, secondary: true, primary: true }, "localized carousel route controls missing");
    assert.equal(rawCatalogBefore.homeCarousel.slides[1].secondaryAction.href, "https://example.invalid/carousel-secondary", "localized secondary action changed its signed URL");
    stage = "activate localized carousel primary route";
    await window.webContents.executeJavaScript("(() => { document.querySelector('.carouselActions .primaryAction').click(); return true; })()");
    stage = "wait localized carousel primary route";
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-resource-source-context=official]'))", "localized primary action did not keep its signed resource route");
    stage = "return localized home";
    await window.webContents.executeJavaScript("(() => { document.querySelector('.sidebar nav .navItem').click(); return true; })()");
    await waitFor(window, "document.querySelector('.carouselHero h1')?.textContent === 'Localized slide title'", "localized home did not return after route verification");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('.navItem')].find((node) => node.textContent.includes('All AI vendors')).click()");
    await waitFor(window, "document.querySelector('[data-aihub-vendor-id=fixture-vendor]')?.textContent.includes('Localized vendor description')", "localized vendor card missing");
    const localizedVendorCard = await window.webContents.executeJavaScript("document.querySelector('[data-aihub-vendor-id=fixture-vendor]').textContent");
    assert.match(localizedVendorCard, /Localized vendor name/, "vendor name did not consume localized English");
    assert.match(localizedVendorCard, /Localized product name/, "vendor card product did not consume localized English");
    assert.equal(localizedVendorCard.includes("Startup Remote Vendor") || localizedVendorCard.includes("Fixture Codex CLI"), false, "vendor card retained an old primary display value");
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-aihub-vendor-id=fixture-vendor]').length"), 1, "localized vendor rendered more than once");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-vendor-id=fixture-vendor]').click()");
    await waitFor(window, "document.querySelector('[data-aihub-product-id=codex-cli]')?.textContent.includes('Localized product description')", "localized product row missing");
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-aihub-product-id=codex-cli]').length"), 1, "localized product rendered more than once");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-store-id=skill]').click()");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-resource-product-id=codex-cli]'))", "localized Skill host missing");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-product-id=codex-cli]').click()");
    await waitFor(window, "document.querySelector('[data-aihub-resource-id=fixture-official-skill]')?.textContent.includes('Localized resource description')", "localized resource row missing");
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-aihub-resource-id=fixture-official-skill]').length"), 1, "localized resource rendered more than once");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-community-discussions=true]').click()");
    await waitFor(window, "document.querySelector('.communityLoginRequired h1')?.textContent === 'Localized community title'", "localized community title missing");
    assert.match(await window.webContents.executeJavaScript("document.querySelector('.communityLoginRequired').textContent"), /Localized community description/, "community description did not consume localized English");
    assert.match(await window.webContents.executeJavaScript("document.querySelector('.communityLoginRequired').textContent"), /Fixture Community Provider/, "community provider proper name must remain unchanged");
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.communityLoginRequired').length"), 1, "localized community surface rendered more than once");
    stage = "restore Chinese language";
    await waitFor(window, "Boolean(document.querySelector('.settingsPanel'))", "settings panel did not remain available for language restore");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('.settingsPanel button')].find((node) => node.textContent.trim() === '中文').click()");
    await waitFor(window, "[...document.querySelectorAll('.navItem')].some((node) => node.textContent.includes('Skill 商店'))", "language did not return to Chinese");
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click(); document.querySelector('.sidebar nav .navItem').click()");
    await waitFor(window, `document.querySelector('.carouselHero h1')?.textContent === ${JSON.stringify(rawCatalogBefore.homeCarousel.slides[0].title)}`, "carousel did not restore its primary title");
    const restoredHome = await window.webContents.executeJavaScript(`(() => ({
      slogan: document.querySelector('.brand')?.getAttribute('title'),
      slideDescription: document.querySelector('.carouselHero .heroCopy > span')?.textContent,
      slideAction: document.querySelector('.carouselActions .primaryAction')?.textContent,
      slideSecondaryAction: document.querySelector('.carouselActions .quietButton')?.textContent,
      slideAlt: document.querySelector('.carouselImage')?.getAttribute('alt'),
      vendor: document.querySelector('.featuredCard b')?.textContent,
      store: document.querySelector('[data-aihub-resource-store-id=skill]')?.textContent,
      extra: [...document.querySelectorAll('.navItem')].filter((node) => node.textContent.includes(${JSON.stringify(rawCatalogBefore.extraSections[0].title)})).length,
      staleEnglish: document.body.textContent.includes('Localized slide') || document.body.textContent.includes('Localized catalog')
    }))()`);
    assert.equal(restoredHome.slogan, rawCatalogBefore.brand.slogan, "brand slogan did not restore its primary value");
    assert.equal(restoredHome.slideDescription, rawCatalogBefore.homeCarousel.slides[0].description, "carousel description did not restore its primary value");
    assert.match(restoredHome.slideAction || "", new RegExp(rawCatalogBefore.homeCarousel.slides[0].primaryAction.label), "carousel primary action did not restore its primary label");
    assert.equal(restoredHome.slideSecondaryAction, rawCatalogBefore.homeCarousel.slides[0].secondaryAction.label, "carousel secondary action did not restore its primary label");
    assert.equal(restoredHome.slideAlt, rawCatalogBefore.homeCarousel.slides[0].imageAlt, "carousel image alt did not restore its primary value");
    assert.equal(restoredHome.vendor, rawCatalogBefore.vendors[0].name, "featured vendor did not restore its primary name");
    assert.match(restoredHome.store || "", new RegExp(rawCatalogBefore.resourceStores[0].label), "resource store did not restore its primary label");
    assert.equal(restoredHome.extra, 1, "extra section did not restore exactly one primary label");
    assert.equal(restoredHome.staleEnglish, false, "home retained an old English display value after returning to Chinese");
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(window, "Boolean(document.querySelector('.settingsPanel'))", "Chinese task center did not reopen");
    const restoredTask = await window.webContents.executeJavaScript("document.querySelector('.managedDownloadList [data-product-id=fixture-running-canonical]')?.textContent || ''");
    assert.match(restoredTask, /Fixture Running Download/, "task name did not restore its primary product name");
    assert.equal(restoredTask.includes("Localized task product name"), false, "task row retained an old English name after returning to Chinese");
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click(); [...document.querySelectorAll('.navItem')].find((node) => node.textContent.includes('全部 AI 厂商')).click()");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-vendor-id=fixture-vendor]'))", "primary vendor card missing after language restore");
    const restoredVendorCard = await window.webContents.executeJavaScript("document.querySelector('[data-aihub-vendor-id=fixture-vendor]').textContent");
    assert.match(restoredVendorCard, new RegExp(rawCatalogBefore.vendors[0].name), "vendor name did not restore its primary value");
    assert.match(restoredVendorCard, /Fixture Codex CLI/, "vendor product did not restore its primary name");
    assert.equal(restoredVendorCard.includes("Localized vendor") || restoredVendorCard.includes("Localized product"), false, "vendor card retained an old English value");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-vendor-id=fixture-vendor]').click()");
    await waitFor(window, "document.querySelector('[data-aihub-product-id=codex-cli]')?.textContent.includes('Fixture Codex CLI')", "product row did not restore its primary value");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-store-id=skill]').click()");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-resource-product-id=codex-cli]'))", "primary Skill host missing after language restore");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-product-id=codex-cli]').click()");
    await waitFor(window, "document.querySelector('[data-aihub-resource-id=fixture-official-skill]')?.textContent.includes('Fixture Official Skill')", "resource row did not restore its primary value");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-community-discussions=true]').click()");
    await waitFor(window, `document.querySelector('.communityLoginRequired h1')?.textContent === ${JSON.stringify(rawCatalogBefore.community.title)}`, "community title did not restore its primary value");
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.communityLoginRequired').textContent.includes('Localized community')"), false, "community retained an old English value");
    assert.deepEqual(await window.webContents.executeJavaScript("window.aihubPC.getCatalog().then((result) => result.catalog)"), rawCatalogBefore, "zh-en-zh rendering mutated the raw catalog DTO");
    stage = "open Skill resource store";
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-store-id=skill]').click()");
    await waitFor(window, "document.querySelector('[data-aihub-resource-source-context=official]')", "Skill official source missing");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-resource-product-id=codex-cli]'))", "default official Skill source did not project");
    stage = "select community Skill source";
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-filter=source-channel] [data-aihub-filter-value=community]').click()");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-resource-product-id=codex-cli]'))", "community Skill host did not project");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-resource-product-id=codex-cli]').click()");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-resource-id=fixture-community-skill]'))", "signed-catalog community Skill did not project");
    const communitySkill = await window.webContents.executeJavaScript(`(() => ({
      context: document.querySelector('[data-aihub-resource-source-context=community]')?.textContent || '',
      managed: Boolean(document.querySelector('[data-aihub-resource-id=fixture-community-skill] [data-aihub-action=inspect-extension]')),
      overflow: document.documentElement.scrollWidth > innerWidth
    }))()`);
    assert.match(communitySkill.context, /社区 Skill 商店/, "current Skill source must remain explicit");
    assert.equal(communitySkill.managed, false, "community link-only Skill must not gain a managed action");
    assert.equal(communitySkill.overflow, false, "community Skill view must not overflow");
    for (const theme of ["light", "dark"]) {
      for (const width of [1365, 740]) {
        window.setContentSize(width, 768);
        await waitFor(window, `window.innerWidth === ${width}`, "community Skill viewport did not settle");
        await window.webContents.executeJavaScript(`document.querySelector('.pcApp').dataset.theme = ${JSON.stringify(theme)}`);
        assert.equal(
          await window.webContents.executeJavaScript("document.documentElement.scrollWidth <= innerWidth"),
          true,
          `${theme}/${width} community Skill view must not overflow`
        );
      }
    }
    window.setContentSize(1365, 768);
    await waitFor(window, "window.innerWidth === 1365", "community Skill desktop viewport did not restore");
    await window.webContents.executeJavaScript("document.querySelector('.pcApp').dataset.theme = 'light'");
    stage = "navigate fixture";
    await waitFor(window, "[...document.querySelectorAll('.navItem')].some((node) => node.textContent.includes('全部 AI 厂商'))", "vendor navigation missing");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('.navItem')].find((node) => node.textContent.includes('全部 AI 厂商')).click()");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-vendor-id=fixture-vendor]'))", "fixture vendor missing");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-vendor-id=fixture-vendor]').click()");
    const backButton = await window.webContents.executeJavaScript(`(() => {
      const button = document.querySelector('.backButton');
      button.focus({ focusVisible: true });
      const style = getComputedStyle(button);
      return {
        borderWidth: parseFloat(style.borderTopWidth),
        height: button.getBoundingClientRect().height,
        focused: document.activeElement === button
      };
    })()`);
    assert.ok(backButton.borderWidth > 0, "back navigation must have an explicit button boundary");
    assert.ok(backButton.height >= 36, "back navigation must retain a clear click target");
    assert.equal(backButton.focused, true, "back navigation must remain keyboard-focusable");
    stage = "assert initial authority";
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(window, "document.querySelectorAll('.managedDownloadList [data-product-id=fixture-running-canonical]').length > 0", "initial queue task missing");
    const initialAuthority = await window.webContents.executeJavaScript(`(() => ({
      rows: document.querySelectorAll('.managedDownloadList [data-product-id=\"fixture-running-canonical\"]').length,
      activeText: document.querySelector('.taskFilters button.active')?.textContent || ''
    }))()`);
    assert.equal(initialAuthority.rows, 1, "one durable product attempt must render once");
    assert.match(initialAuthority.activeText, /1/, "one durable product attempt must count once");
    await new Promise((resolve) => setTimeout(resolve, 650));
    assert.equal(
      await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'list').length"),
      1,
      "queue list must be only the startup snapshot"
    );
    stage = "assert delayed list cannot overwrite a newer event";
    await window.webContents.executeJavaScript(`(() => {
      window.aihubPC.fixtureDelayManagedDownloadQueueList(160);
      window.dispatchEvent(new Event('focus'));
      setTimeout(() => window.aihubPC.fixtureSetManagedDownloadQueueTask(
        'fixture-running-canonical',
        'downloading',
        512,
        1024,
        undefined,
        { taskId: 'fixture-attempt-newer', presentation: { state: 'active', canCancel: true, canRetry: false } }
      ), 10);
    })()`);
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-action=cancel-managed-download]'))", "newer event did not project active presentation");
    await new Promise((resolve) => setTimeout(resolve, 220));
    assert.equal(
      await window.webContents.executeJavaScript("Boolean(document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-action=cancel-managed-download]'))"),
      true,
      "a stale list must not overwrite a newer task attempt"
    );
    assert.equal(
      await window.webContents.executeJavaScript("document.querySelectorAll('.managedDownloadList [data-product-id=fixture-running-canonical]').length"),
      1,
      "a stale list must not duplicate the newer durable task"
    );
    stage = "assert delayed list cannot delete a newer event";
    await window.webContents.executeJavaScript(`(() => {
      window.aihubPC.fixtureDelayManagedDownloadQueueList(160);
      window.dispatchEvent(new Event('focus'));
      setTimeout(() => window.aihubPC.fixtureSetManagedDownloadQueueTask(
        'fixture-missing-canonical',
        'failed',
        0,
        0,
        undefined,
        { taskId: 'fixture-appeared-during-list', presentation: { state: 'failed', canCancel: false, canRetry: true } }
      ), 10);
    })()`);
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=fixture-missing-canonical] [data-aihub-action=retry-managed-download]'))", "newer task absent from delayed list did not project");
    await new Promise((resolve) => setTimeout(resolve, 220));
    assert.equal(
      await window.webContents.executeJavaScript("Boolean(document.querySelector('[data-aihub-product-id=fixture-missing-canonical] [data-aihub-action=retry-managed-download]'))"),
      true,
      "a stale list missing a product must not delete its newer task"
    );
    await window.webContents.executeJavaScript("window.aihubPC.fixtureDeleteManagedDownloadQueueTask('fixture-missing-canonical'); window.dispatchEvent(new Event('focus'))");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=fixture-missing-canonical] [data-aihub-action=enqueue-managed-download]'))", "cleanup snapshot did not remove the injected race task");
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click()");
    await window.webContents.executeJavaScript(`(() => {
      window.aihubPC.fixtureDelayManagedDownloadQueueStatus('fixture-running-canonical', 120);
      window.aihubPC.fixtureSetManagedDownloadQueueTask(
        'fixture-running-canonical',
        'downloading',
        512,
        1024,
        undefined,
        { taskId: 'fixture-attempt-newer', presentation: { state: 'active', canCancel: true, canRetry: false } }
      );
      setTimeout(() => window.aihubPC.fixtureSetManagedDownloadQueueTask(
        'fixture-running-canonical',
        'failed',
        0,
        0,
        undefined,
        { taskId: 'fixture-attempt-latest', presentation: { state: 'failed', canCancel: false, canRetry: true } }
      ), 10);
    })()`);
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-action=retry-managed-download]'))", "a stale status response replaced the newer task attempt");
    assert.equal(
      await window.webContents.executeJavaScript("Boolean(document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-action=cancel-managed-download]'))"),
      false,
      "queue action buttons must follow the public presentation"
    );
    await window.webContents.executeJavaScript("window.aihubPC.fixtureSetManagedDownloadQueueTask('fixture-running-canonical', 'downloading', 512, 1024)");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-action=cancel-managed-download]'))", "queue presentation did not return to active");
    stage = "assert same-attempt status cannot be overwritten by a stale queued list";
    const sameAttemptTaskId = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks().then((tasks) => tasks.find((task) => task.productId === 'fixture-running-canonical').taskId)");
    const sameAttemptCallStart = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().length");
    await window.webContents.executeJavaScript(`(() => {
      const taskId = ${JSON.stringify(sameAttemptTaskId)};
      window.aihubPC.fixtureSetManagedDownloadQueueTask(
        'fixture-running-canonical',
        'downloading',
        512,
        1024,
        undefined,
        { taskId, emit: false }
      );
      window.aihubPC.fixtureHoldManagedDownloadQueueStatus('fixture-running-canonical');
      for (let revision = 1001; revision <= 1003; revision += 1) {
        window.aihubPC.fixtureEmitDownloadTask({
          productId: 'fixture-running-canonical',
          attemptId: taskId,
          attempt: 1,
          revision,
          phase: 'downloading'
        });
      }
      window.aihubPC.fixtureHoldManagedDownloadQueueList([{
        taskId,
        productId: 'fixture-running-canonical',
        profileId: 'fixture-canonical-profile',
        phase: 'queued',
        progress: { receivedBytes: 0, totalBytes: 1024, bytesPerSecond: 0, percent: 0 },
        presentation: { state: 'active', canCancel: true, canRetry: false }
      }]);
      window.dispatchEvent(new Event('focus'));
    })()`);
    assert.deepEqual(
      await window.webContents.executeJavaScript(`window.aihubPC.fixtureGetManagedDownloadQueueCalls().slice(${sameAttemptCallStart}).filter((call) => ['status-call', 'list-held'].includes(call.method)).map((call) => call.method)`),
      ["status-call", "list-held"],
      "the same-attempt status and stale list must both be held"
    );
    assert.equal(await window.webContents.executeJavaScript("window.aihubPC.fixtureResolveManagedDownloadQueueStatus('fixture-running-canonical')"), true, "held status was not released");
    await flushRenderer(window);
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await flushRenderer(window);
    const beforeListRelease = await window.webContents.executeJavaScript(`(() => ({
      productPhase: document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase'),
      taskPhase: document.querySelector('.managedQueueTask[data-product-id=fixture-running-canonical]')?.getAttribute('data-aihub-managed-download-phase'),
      rows: document.querySelectorAll('.managedDownloadList [data-product-id=fixture-running-canonical]').length,
      canCancel: Boolean(document.querySelector('.managedQueueTask[data-product-id=fixture-running-canonical] [data-aihub-action=cancel-managed-download]'))
    }))()`);
    assert.deepEqual(beforeListRelease, { productPhase: "downloading", taskPhase: "downloading", rows: 1, canCancel: true }, "validated public status must reach both renderer projections before list release");
    assert.equal(await window.webContents.executeJavaScript("window.aihubPC.fixtureReleaseManagedDownloadQueueList()"), true, "held list was not released");
    await flushRenderer(window);
    const afterListRelease = await window.webContents.executeJavaScript(`(() => ({
      productPhase: document.querySelector('[data-aihub-product-id=fixture-running-canonical] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase'),
      taskPhase: document.querySelector('.managedQueueTask[data-product-id=fixture-running-canonical]')?.getAttribute('data-aihub-managed-download-phase'),
      rows: document.querySelectorAll('.managedDownloadList [data-product-id=fixture-running-canonical]').length,
      canCancel: Boolean(document.querySelector('.managedQueueTask[data-product-id=fixture-running-canonical] [data-aihub-action=cancel-managed-download]'))
    }))()`);
    assert.deepEqual(afterListRelease, { productPhase: "downloading", taskPhase: "downloading", rows: 1, canCancel: true }, "a stale same-attempt queued list must not overwrite either renderer projection");
    assert.deepEqual(
      await window.webContents.executeJavaScript(`window.aihubPC.fixtureGetManagedDownloadQueueCalls().slice(${sameAttemptCallStart}).filter((call) => ['status-call', 'status-resolved', 'list-held', 'list-resolved'].includes(call.method)).map((call) => call.method)`),
      ["status-call", "list-held", "status-resolved", "status-call", "status-resolved", "list-resolved"],
      "the race must follow the fixture's real call log"
    );
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click()");
    await flushRenderer(window);
    stage = "assert deferred enqueue cannot overwrite an accepted public status";
    const deferredProductId = "fixture-missing-canonical";
    const deferredTaskId = "fixture-deferred-enqueue-attempt";
    const deferredSelector = `[data-aihub-product-id=${deferredProductId}] [data-aihub-action=enqueue-managed-download]`;
    const deferredCallStart = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().length");
    const deferredListCallsBefore = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'list').length");
    await window.webContents.executeJavaScript(`window.aihubPC.fixtureHoldManagedDownloadQueueEnqueue(${JSON.stringify(deferredProductId)}, ${JSON.stringify(deferredTaskId)})`);
    const statusBeforeRaw = await window.webContents.executeJavaScript(`window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === ${JSON.stringify(deferredProductId)}).length`);
    await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(deferredSelector)}).click()`);
    await waitFor(window, `window.aihubPC.fixtureGetManagedDownloadQueueCalls().some((call) => call.method === 'enqueue-held' && call.input.productId === ${JSON.stringify(deferredProductId)})`, "deferred enqueue was not held");
    await window.webContents.executeJavaScript(`window.aihubPC.fixtureSetManagedDownloadQueueTask(
      ${JSON.stringify(deferredProductId)},
      'downloading',
      512,
      1024,
      undefined,
      { taskId: ${JSON.stringify(deferredTaskId)} }
    )`);
    await waitFor(window, `window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === ${JSON.stringify(deferredProductId)}).length > ${statusBeforeRaw}`, "raw invalidation was not accepted as a status request");
    causalObservations.push("event-accepted", "status-call");
    await waitFor(window, `document.querySelector('[data-aihub-product-id=${deferredProductId}] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase') === 'downloading'`, "public downloading status did not reach the product card before command completion");
    causalObservations.push("status-apply");
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(window, `document.querySelector('.managedQueueTask[data-product-id=${deferredProductId}]')?.getAttribute('data-aihub-managed-download-phase') === 'downloading'`, "public downloading status did not reach Task Center before command completion");
    assert.equal(await window.webContents.executeJavaScript(`document.querySelectorAll('.managedDownloadList [data-product-id=${deferredProductId}]').length`), 1, "deferred attempt must render once before command completion");
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click()");
    const statusBeforeResolve = await window.webContents.executeJavaScript(`window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === ${JSON.stringify(deferredProductId)}).length`);
    await window.webContents.executeJavaScript(`window.aihubPC.fixtureResolveManagedDownloadQueueEnqueue(${JSON.stringify(deferredProductId)})`);
    await waitFor(window, `window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === ${JSON.stringify(deferredProductId)}).length > ${statusBeforeResolve}`, "late queued command result did not cause the mandatory status read");
    causalObservations.push("status-call");
    await waitFor(window, `document.querySelector('[data-aihub-product-id=${deferredProductId}] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase') === 'downloading'`, "late queued command result remained on the product card");
    causalObservations.push("status-apply");
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(window, `document.querySelector('.managedQueueTask[data-product-id=${deferredProductId}]')?.getAttribute('data-aihub-managed-download-phase') === 'downloading'`, "late queued command result remained in Task Center");
    const deferredFinal = await window.webContents.executeJavaScript(`(() => ({
      rows: document.querySelectorAll('.managedDownloadList [data-product-id=${deferredProductId}]').length,
      canCancel: Boolean(document.querySelector('.managedQueueTask[data-product-id=${deferredProductId}] [data-aihub-action=cancel-managed-download]'))
    }))()`);
    assert.deepEqual(deferredFinal, { rows: 1, canCancel: true }, "late queued command result must converge to one cancellable downloading row");
    const deferredCallOrder = await window.webContents.executeJavaScript(`window.aihubPC.fixtureGetManagedDownloadQueueCalls().slice(${deferredCallStart})
      .filter((call) => call.input?.productId === ${JSON.stringify(deferredProductId)} && ['enqueue', 'enqueue-held', 'status', 'enqueue-resolved'].includes(call.method))
      .map((call) => call.method)`);
    assert.deepEqual(deferredCallOrder, ["enqueue", "enqueue-held", "status", "enqueue-resolved", "status"], "deferred command must trigger one public status before and after its queued reply");
    const deferredListCallsAfter = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'list').length");
    assert.equal(deferredListCallsAfter - deferredListCallsBefore, 0, "deferred command must converge without any list refresh");
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click()");
    await window.webContents.executeJavaScript(`window.aihubPC.fixtureDeleteManagedDownloadQueueTask(${JSON.stringify(deferredProductId)}); window.dispatchEvent(new Event('focus'))`);
    await waitFor(window, `Boolean(document.querySelector(${JSON.stringify(deferredSelector)}))`, "deferred fixture task did not clean up");
    stage = "exercise queue";
    const enqueueCallBaseline = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'enqueue').length");
    const ids = ["fixture-missing-canonical", "fixture-queue-long-canonical", "fixture-queue-second-canonical", "fixture-queue-third-canonical"];
    for (const id of ids) {
      const selector = `[data-aihub-product-id=${id}] [data-aihub-action=enqueue-managed-download]`;
      await waitFor(window, `Boolean(document.querySelector(${JSON.stringify(selector)}))`, `${id} enqueue action missing`);
      await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await waitFor(window, `window.aihubPC.fixtureGetManagedDownloadQueueCalls().some((call) => call.method === 'enqueue' && call.input.productId === ${JSON.stringify(id)})`, `${id} did not enqueue`);
    }
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical] [data-aihub-action=enqueue-managed-download]').disabled"), true, "queued product must disable repeat enqueue");
    await window.webContents.executeJavaScript("window.aihubPC.enqueueManagedDownload({ productId: 'fixture-queue-third-canonical' })");
    await waitFor(window, `window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'enqueue').length === ${enqueueCallBaseline + 5}`, "duplicate enqueue missing");
    const queue = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks()");
    assert.equal(queue.filter((task) => task.phase === "downloading").length, 3, "only three resources may download together");
    const queuedAttempt = queue.find((task) => task.productId === "fixture-queue-third-canonical");
    assert.equal(queuedAttempt.phase, "queued", "fourth resource must queue");
    assert.equal(queuedAttempt.progress.receivedBytes, 0, "queued task must remain at zero received bytes");
    assert.equal(typeof queuedAttempt.taskId, "string", "queued task attempt must remain current");
    stage = "assert same-attempt invalidations converge without a quiet window";
    await window.webContents.executeJavaScript(`(() => {
      window.aihubPC.fixtureSetManagedDownloadQueueTask(
        'fixture-queue-third-canonical',
        'downloading',
        512,
        1024,
        undefined,
        { taskId: ${JSON.stringify(queuedAttempt.taskId)}, emit: false }
      );
      window.aihubPC.fixtureDelayManagedDownloadQueueStatus('fixture-queue-third-canonical', 80);
      let revision = 0;
      window.__managedDownloadConvergenceInterval = setInterval(() => {
        window.aihubPC.fixtureEmitDownloadTask({
          productId: 'fixture-queue-third-canonical',
          attemptId: ${JSON.stringify(queuedAttempt.taskId)},
          attempt: 1,
          revision: ++revision,
          phase: 'failed',
          filePath: 'C:\\\\raw-queue-secret.exe',
          errorMessage: 'RAW_QUEUE_SECRET'
        });
      }, 15);
    })()`);
    await waitFor(
      window,
      "document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase') === 'downloading'",
      "same-attempt public status did not converge while raw invalidations continued",
      1_000
    );
    const productConvergence = await window.webContents.executeJavaScript(`(() => ({
      cancel: Boolean(document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical] [data-aihub-action=cancel-managed-download]')),
      retry: Boolean(document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical] [data-aihub-action=retry-managed-download]')),
      errorLeaked: document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical]')?.textContent.includes('RAW_QUEUE_SECRET') || false,
      pathLeaked: document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical]')?.textContent.includes('raw-queue-secret.exe') || false,
      statusCalls: window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === 'fixture-queue-third-canonical').length
    }))()`);
    assert.equal(productConvergence.cancel, true, "product actions must use public canCancel");
    assert.equal(productConvergence.retry, false, "raw failed phase must not create a retry action");
    assert.equal(productConvergence.errorLeaked, false, "raw error token must not reach the product card");
    assert.equal(productConvergence.pathLeaked, false, "raw path token must not reach the product card");
    assert.ok(productConvergence.statusCalls >= 2, "dirty same-attempt events must continue status reads");
    await window.webContents.executeJavaScript("document.querySelector('.topActions .quietButton:nth-child(2)').click()");
    await waitFor(window, "document.querySelector('.managedQueueTask[data-product-id=fixture-queue-third-canonical]')?.getAttribute('data-aihub-managed-download-phase') === 'downloading'", "Task Center did not converge with the product card");
    const taskCenterConvergence = await window.webContents.executeJavaScript(`(() => ({
      rows: document.querySelectorAll('.managedDownloadList [data-product-id=fixture-queue-third-canonical]').length,
      cancel: Boolean(document.querySelector('.managedQueueTask[data-product-id=fixture-queue-third-canonical] [data-aihub-action=cancel-managed-download]')),
      errorLeaked: document.querySelector('.managedQueueTask[data-product-id=fixture-queue-third-canonical]')?.textContent.includes('RAW_QUEUE_SECRET') || false,
      pathLeaked: document.querySelector('.managedQueueTask[data-product-id=fixture-queue-third-canonical]')?.textContent.includes('raw-queue-secret.exe') || false
    }))()`);
    assert.equal(taskCenterConvergence.rows, 1, "same attempt must render and count once");
    assert.equal(taskCenterConvergence.cancel, true, "Task Center must use the same public canCancel");
    assert.equal(taskCenterConvergence.errorLeaked, false, "raw error token must not reach Task Center");
    assert.equal(taskCenterConvergence.pathLeaked, false, "raw path token must not reach Task Center");
    causalObservations.push("event-accepted", "status-call", "status-apply");
    await window.webContents.executeJavaScript("clearInterval(window.__managedDownloadConvergenceInterval)");
    await new Promise((resolve) => setTimeout(resolve, 240));
    const cleanStatusCalls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === 'fixture-queue-third-canonical').length");
    await new Promise((resolve) => setTimeout(resolve, 160));
    assert.equal(
      await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => call.method === 'status' && call.input.productId === 'fixture-queue-third-canonical').length"),
      cleanStatusCalls,
      "status reads must stop after the same-attempt dirty revision is clean"
    );
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click()");
    await window.webContents.executeJavaScript(`window.aihubPC.fixtureSetManagedDownloadQueueTask(
      'fixture-queue-third-canonical',
      'queued',
      0,
      1024,
      undefined,
      { taskId: ${JSON.stringify(queuedAttempt.taskId)} }
    )`);
    await waitFor(window, "document.querySelector('[data-aihub-product-id=fixture-queue-third-canonical] [data-aihub-managed-download-phase]')?.getAttribute('data-aihub-managed-download-phase') === 'queued'", "fixture queue state did not restore");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('button')].find((node) => node.textContent.includes('设置')).click()");
    await waitFor(window, "document.querySelectorAll('.managedQueueTask').length === 5", "download center did not render all queue tasks");
    const queueSemantics = await window.webContents.executeJavaScript(`(() => {
      const section = document.querySelector('.managedQueueSection');
      const heading = document.getElementById('managed-download-queue-heading');
      const rows = [...section.querySelectorAll('.managedQueueTask')];
      const progress = [...section.querySelectorAll('[role=progressbar]')];
      const legacy = document.querySelector('.managedDownloadList > [data-product-id="fixture-running-canonical"]');
      return {
        named: Boolean(section && heading && section.getAttribute('aria-labelledby') === heading.id),
        rows: rows.length,
        progress: progress.map((node) => ({
          min: node.getAttribute('aria-valuemin'),
          max: node.getAttribute('aria-valuemax'),
          now: node.getAttribute('aria-valuenow'),
          label: node.getAttribute('aria-label')
        })),
        statuses: rows.map((node) => node.querySelector('[role=status]')?.textContent || ''),
        duplicatedLegacy: Boolean(legacy),
        allActive: [...document.querySelectorAll('.taskFilters button')].some((node) => node.textContent.includes('全部进行中'))
      };
    })()`);
    assert.equal(queueSemantics.named, true, "managed queue must be a named section");
    assert.equal(queueSemantics.rows, 5, "queue section must contain only queue rows");
    assert.equal(queueSemantics.duplicatedLegacy, false, "a queue task must not render a second legacy row");
    assert.equal(queueSemantics.allActive, true, "active count must be labeled as all active tasks");
    assert.equal(queueSemantics.progress.length, 3, "only downloading tasks expose progress");
    assert.equal(queueSemantics.progress.every((item) => item.min === '0' && item.max === '100' && item.now !== null && item.label), true, "progress must expose safe percentage semantics");
    assert.equal(queueSemantics.statuses.length, 5, "ordinary queue states must announce status");
    await screenshot(window, 1365, "queued-light");
    await screenshot(window, 740, "queued-light");
    await window.webContents.executeJavaScript("document.querySelector('.pcApp').dataset.theme = 'dark'");
    await screenshot(window, 1365, "queued-dark");
    await screenshot(window, 740, "queued-dark");
    await window.webContents.executeJavaScript("document.querySelector('.pcApp').dataset.theme = 'light'");
    await window.webContents.executeJavaScript("window.aihubPC.fixtureSetManagedDownloadQueueTask('fixture-queue-second-canonical', 'downloading', 128, 0)");
    await waitFor(window, "document.querySelector('.managedQueueTask[data-product-id=fixture-queue-second-canonical] [role=status]')?.textContent.includes('%') === false", "unknown-size task should not invent a percentage");
    assert.equal(
      await window.webContents.executeJavaScript("Boolean(document.querySelector('.managedQueueTask[data-product-id=fixture-queue-second-canonical] [role=progressbar]'))"),
      false,
      "unknown-size task must use status text instead of a fake progress bar"
    );
    await window.webContents.executeJavaScript("document.querySelector('.settingsPanel > header > button').click()");
    const cancel = "[data-aihub-product-id=fixture-queue-third-canonical] [data-aihub-action=cancel-managed-download]";
    await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(cancel)}).click()`);
    await waitFor(window, "Boolean(document.querySelector('.managedDownloadCancelActions .dangerButton'))", "cancel confirmation missing");
    const inspectCancelAction = async (theme, width) => {
      await window.webContents.executeJavaScript(`document.querySelector('.pcApp').dataset.theme = ${JSON.stringify(theme)}`);
      window.setContentSize(width, 740);
      await waitFor(window, `window.innerWidth === ${width}`, "cancel viewport did not settle");
      const safeWasFocused = await window.webContents.executeJavaScript("document.activeElement === document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)')");
      window.webContents.sendInputEvent({ type: "keyDown", keyCode: "TAB" });
      window.webContents.sendInputEvent({ type: "keyUp", keyCode: "TAB" });
      await waitFor(window, "document.activeElement === document.querySelector('.managedDownloadCancelActions .dangerButton')", "keyboard focus did not reach the danger action");
      return window.webContents.executeJavaScript(`(() => {
        const danger = document.querySelector('.managedDownloadCancelActions .dangerButton');
        const keep = document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)');
        const parse = (value) => (value.match(/\\d+(?:\\.\\d+)?/g) || []).slice(0, 3).map(Number);
        const luminance = ([red, green, blue]) => [red, green, blue].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const style = getComputedStyle(danger);
        const keepStyle = getComputedStyle(keep);
        const background = parse(style.backgroundColor);
        const foreground = parse(style.color);
        const contrast = (Math.max(luminance(background), luminance(foreground)) + 0.05) /
          (Math.min(luminance(background), luminance(foreground)) + 0.05);
        const dangerWasFocused = document.activeElement === danger;
        danger.disabled = true;
        const disabledOpacity = Number(getComputedStyle(danger).opacity);
        danger.disabled = false;
        keep.focus();
        const rect = danger.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          keepBackground: keepStyle.backgroundColor,
          redDominant: background[0] > background[1] * 1.5 && background[0] > background[2] * 1.5,
          contrast,
          safeWasFocused: ${safeWasFocused},
          dangerWasFocused,
          disabledOpacity,
          insideViewport: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
        };
      })()`);
    };
    const lightCancel = await inspectCancelAction("light", 1365);
    const darkCancel = await inspectCancelAction("dark", 740);
    for (const state of [lightCancel, darkCancel]) {
      assert.notEqual(state.background, state.keepBackground, "cancel-and-discard must be visually distinct from keeping the download");
      assert.equal(state.redDominant, true, "cancel-and-discard must retain a danger color");
      assert.ok(state.contrast >= 4.5, "danger action foreground must have readable contrast");
      assert.equal(state.safeWasFocused, true, "keep-download must retain the safe default focus");
      assert.equal(state.dangerWasFocused, true, "danger action must remain keyboard-focusable");
      assert.ok(state.disabledOpacity < 1, "disabled danger action must look disabled");
      assert.equal(state.insideViewport, true, "cancel action must remain within the viewport");
    }
    await window.webContents.executeJavaScript("document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)').focus()");
    window.webContents.sendInputEvent({ type: "keyDown", keyCode: "TAB" });
    window.webContents.sendInputEvent({ type: "keyUp", keyCode: "TAB" });
    await waitFor(window, "document.activeElement === document.querySelector('.managedDownloadCancelActions .dangerButton')", "Tab must reach danger");
    window.webContents.sendInputEvent({ type: "keyDown", keyCode: "TAB", modifiers: ["SHIFT"] });
    window.webContents.sendInputEvent({ type: "keyUp", keyCode: "TAB", modifiers: ["SHIFT"] });
    await waitFor(window, "document.activeElement === document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)')", "Shift+Tab must return to safe action");
    window.webContents.sendInputEvent({ type: "keyDown", keyCode: "ESCAPE" });
    window.webContents.sendInputEvent({ type: "keyUp", keyCode: "ESCAPE" });
    await waitFor(window, "!document.querySelector('.managedDownloadCancelModal')", "Escape must close the dialog");
    let kept = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks().then(tasks=>tasks.find(task=>task.productId==='fixture-queue-third-canonical'))");
    assert.equal(kept.taskId, queuedAttempt.taskId, "Escape must keep the queued task");
    await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(cancel)}).click()`);
    await waitFor(window, "Boolean(document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)'))", "safe confirmation missing");
    await window.webContents.executeJavaScript("document.querySelector('.managedDownloadCancelActions button:not(.dangerButton)').click()");
    await waitFor(window, "!document.querySelector('.managedDownloadCancelModal')", "safe dismissal must close the dialog");
    kept = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks().then(tasks=>tasks.find(task=>task.productId==='fixture-queue-third-canonical'))");
    assert.equal(kept.taskId, queuedAttempt.taskId, "safe dismissal must keep the queued task");
    await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(cancel)}).click()`);
    await waitFor(window, "Boolean(document.querySelector('.managedDownloadCancelActions .dangerButton'))", "danger confirmation missing after safe dismissal");
    await window.webContents.executeJavaScript("document.querySelector('.pcApp').dataset.theme = 'light'");
    window.setContentSize(1365, 740);
    await waitFor(window, "window.innerWidth === 1365", "cancel desktop viewport did not restore");
    await window.webContents.executeJavaScript("document.querySelector('.managedDownloadCancelActions .dangerButton').click()");
    await waitFor(window, "window.aihubPC.fixtureGetManagedDownloadQueueCalls().some((call) => call.method === 'cancel')", "cancel was not called");
    const afterCancel = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks()");
    const independentBefore = queue.find((task) => task.productId === "fixture-queue-long-canonical");
    const independentAfter = afterCancel.find((task) => task.productId === "fixture-queue-long-canonical");
    assert.equal(independentAfter.taskId, independentBefore.taskId, "danger cancellation must not change the independent task");
    assert.equal(independentAfter.phase, "downloading", "danger cancellation must not stop the independent task");
    const cancelCall = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().find((call) => call.method === 'cancel')");
    assert.deepEqual(cancelCall.input, { productId: "fixture-queue-third-canonical", taskId: queuedAttempt.taskId, confirmed: true }, "danger cancellation must use the exact queued attempt");
    await window.webContents.executeJavaScript("window.aihubPC.fixtureSetManagedDownloadQueueTask('fixture-queue-second-canonical', 'failed', 128, 1024, 'DOWNLOAD_CONNECTION_FAILED')");
    await waitFor(window, "Boolean(document.querySelector('[data-aihub-product-id=fixture-queue-second-canonical] [data-aihub-action=retry-managed-download]'))", "retry action missing");
    const failedSemantics = await window.webContents.executeJavaScript(`(() => {
      const row = document.querySelector('[data-aihub-product-id="fixture-queue-second-canonical"]');
      return {
        alert: row.querySelector('[role=alert]')?.textContent || '',
        hasProgress: Boolean(row.querySelector('[role=progressbar]')),
        text: row.textContent
      };
    })()`);
    assert.ok(failedSemantics.alert, "failed queue task must announce an alert");
    assert.equal(failedSemantics.hasProgress, false, "failed task must not present stale progress");
    assert.equal(/DOWNLOAD_CONNECTION_FAILED|path|receipt/i.test(failedSemantics.text), false, "failed task must not expose technical details");
    const failedAttempt = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks().then(tasks=>tasks.find(task=>task.productId==='fixture-queue-second-canonical').taskId)");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-product-id=fixture-queue-second-canonical] [data-aihub-action=retry-managed-download]').click()");
    await waitFor(window, "window.aihubPC.fixtureGetManagedDownloadQueueCalls().some((call) => call.method === 'retry')", "retry was not called");
    const retriedAttempt = await window.webContents.executeJavaScript("window.aihubPC.listManagedDownloadTasks().then(tasks=>tasks.find(task=>task.productId==='fixture-queue-second-canonical').taskId)");
    assert.notEqual(retriedAttempt, failedAttempt, "retry must create a fresh attempt");
    await window.webContents.executeJavaScript("window.aihubPC.fixtureSetManagedDownloadRecordAvailable(true); window.aihubPC.fixtureSetManagedDownloadQueueTask('fixture-missing-canonical', 'downloaded')");
    await waitFor(window, "document.body.textContent.includes('下载完成，等待你安装或打开下一步')", "downloaded task must wait for a separate user action");
    const downloadedAction = await window.webContents.executeJavaScript(`(() => {
      const row = document.querySelector('[data-aihub-product-id=fixture-missing-canonical]');
      const action = row?.querySelector('[data-aihub-action=open-downloaded-package]');
      return { exists: Boolean(action), disabled: action?.disabled ?? true, text: action?.textContent || '' };
    })()`);
    assert.equal(downloadedAction.exists, true, "a downloaded package must expose the existing safe next-step action");
    assert.equal(downloadedAction.disabled, false, "the downloaded package action must be available to the user");
    assert.match(downloadedAction.text, /点击安装/, "an EXE download must use the existing install presentation");
    await window.webContents.executeJavaScript("document.querySelector('[data-aihub-product-id=fixture-missing-canonical] [data-aihub-action=open-downloaded-package]').click()");
    await waitFor(window, "window.aihubPC.fixtureGetManagedDownloadQueueCalls().some((call) => call.method === 'launch-installer')", "downloaded package action did not reach the existing record-gated installer seam");
    const packageCalls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls().filter((call) => ['get-record', 'launch-installer'].includes(call.method))");
    assert.deepEqual(packageCalls.slice(-2).map((call) => call.method), ["get-record", "launch-installer"], "downloaded package must recheck its record before opening the installer");
    assert.deepEqual(packageCalls.at(-1).input, { productId: "fixture-missing-canonical", intent: "install" }, "renderer must pass only the existing product intent to the installer seam");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('button')].find((node) => node.textContent.includes('设置')).click()");
    await waitFor(window, "Boolean(document.querySelector('.managedDownloadList'))", "download center missing");
    const desktop = await screenshot(window, 1365, "light");
    const narrow = await screenshot(window, 740, "light");
    await window.webContents.executeJavaScript("document.querySelector('.pcApp').dataset.theme = 'dark'");
    await screenshot(window, 1365, "dark");
    await screenshot(window, 740, "dark");
    const calls = await window.webContents.executeJavaScript("window.aihubPC.fixtureGetManagedDownloadQueueCalls()");
    for (const method of ["enqueue", "list", "status", "cancel", "retry"]) assert.ok(calls.some((call) => call.method === method), `${method} preload method was not called`);
    assert.equal(calls.every((call) => !/command|args|env|path|script|shell|receipt|vault|identity/i.test(JSON.stringify(call.input || {}))), true, "renderer sent a forbidden queue field");
    const causalCounts = Object.fromEntries(["event-accepted", "status-call", "status-apply"].map((kind) => [kind, causalObservations.filter((item) => item === kind).length]));
    assert.deepEqual(causalCounts, { "event-accepted": 2, "status-call": 3, "status-apply": 3 }, "fixture causal observations must cover both command/event orderings");
    if (process.env.AIHUB_MANAGED_DOWNLOAD_QUEUE_NO_OUTPUT !== "1") {
      process.stdout.write(`${JSON.stringify({ ok: true, desktop, narrow, callCount: calls.length, causalCounts })}\n`);
    }
  } catch (error) {
    throw new Error(`${stage}: ${error instanceof Error ? error.message : error}`);
  } finally {
    if (bannerWindow && !bannerWindow.isDestroyed()) bannerWindow.destroy();
    if (composerWindow && !composerWindow.isDestroyed()) composerWindow.destroy();
    if (!window.isDestroyed()) window.destroy();
  }
}

app.whenReady().then(run).then(() => app.quit(), (error) => { console.error(error.stack || error); app.exit(1); });
