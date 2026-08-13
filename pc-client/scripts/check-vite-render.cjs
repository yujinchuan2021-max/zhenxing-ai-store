const { app, BrowserWindow } = require("electron");

const targetUrl = process.env.ZHENXING_RENDER_URL || "http://127.0.0.1:5174/";

async function main() {
  await app.whenReady();
  const window = new BrowserWindow({ show: false });

  try {
    await window.loadURL(targetUrl);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await window.webContents.executeJavaScript(`({
      title: document.title,
      rootChildren: document.querySelector('#root')?.childElementCount ?? 0,
      visibleText: (document.querySelector('#root')?.innerText || '').trim()
    })`);

    if (result.rootChildren < 1 || !result.visibleText) {
      throw new Error(`Renderer is blank: ${JSON.stringify(result)}`);
    }

    console.log(JSON.stringify(result));
  } finally {
    window.destroy();
    app.quit();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  app.exit(1);
});
