const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..", "..");
const userData = process.env.AIHUB_STARTUP_PREVIEW_USER_DATA;
const expectedVendor = process.env.AIHUB_STARTUP_CATALOG_MODE === "cache" ? "Startup Cache Vendor" : "Startup Remote Vendor";
if (!userData) throw new Error("AIHUB_STARTUP_PREVIEW_USER_DATA is required");
app.setPath("userData", userData);

async function waitFor(window, expression, message) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

async function run() {
  const window = new BrowserWindow({
    show: false,
    width: 1365,
    height: 768,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "installed-management-preview-preload.cjs")
    }
  });
  try {
    await window.loadFile(path.join(root, "dist", "index.html"));
    for (const width of [1365, 740]) {
      window.setContentSize(width, 768);
      await waitFor(window, "window.innerWidth === " + width, `viewport ${width} did not resize`);
      const loading = await window.webContents.executeJavaScript(`(() => ({
        loading: Boolean(document.querySelector('[data-aihub-startup]')),
        shell: Boolean(document.querySelector('.topbar')),
        catalogVisible: document.body.textContent.includes('${expectedVendor}')
      }))()`);
      assert.deepEqual(loading, { loading: true, shell: false, catalogVisible: false });
      fs.mkdirSync(path.join(root, "output", "playwright"), { recursive: true });
      fs.writeFileSync(path.join(root, "output", "playwright", `startup-loading-${width}.png`), (await window.webContents.capturePage()).toPNG());
    }
    await waitFor(window, "Boolean(document.querySelector('.topbar'))", "catalog result did not render");
    const result = await window.webContents.executeJavaScript(`(() => ({
      loading: Boolean(document.querySelector('[data-aihub-startup]')),
      catalogVisible: document.body.textContent.includes('${expectedVendor}')
    }))()`);
    assert.deepEqual(result, { loading: false, catalogVisible: true });
    process.stdout.write(JSON.stringify({ ok: true, ...result }) + "\n");
  } finally {
    window.destroy();
  }
}

app.whenReady().then(run).then(() => app.quit(), (error) => {
  console.error(error.stack || error);
  app.exit(1);
});
