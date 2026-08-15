"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { app, BrowserWindow } = require("electron");
const windows = [];

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function origin(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

function errorClass(code) {
  if (code === -27) return "blocked-by-response";
  if (code === -310) return "too-many-redirects";
  if (code <= -200 && code >= -299) return "certificate";
  return code === null ? "none" : "other";
}

async function loadTopLevel(url) {
  const window = new BrowserWindow({ show: false });
  windows.push(window);
  let code = null;
  window.webContents.on("did-fail-load", (_event, value) => {
    if (value !== -3) code = value;
  });
  await window.loadURL(url);
  const fixtureTextPresent = await window.webContents.executeJavaScript(
    "document.body.textContent.includes('CSP fixture child loaded')"
  );
  return { fixtureTextPresent, errorClass: errorClass(code) };
}

async function loadWebview(parentUrl, childUrl) {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true
    }
  });
  windows.push(window);
  let code = null;
  let guest;
  const guestCreated = new Promise((resolve) => {
    const onCreated = (_event, contents) => {
      if (contents.getType() !== "webview") return;
      app.removeListener("web-contents-created", onCreated);
      guest = contents;
      contents.on("did-fail-load", (_loadEvent, value) => {
        if (value !== -3) code = value;
      });
      contents.once("did-stop-loading", resolve);
    };
    app.on("web-contents-created", onCreated);
  });
  const parentLoaded = new Promise((resolve, reject) => {
    window.webContents.once("did-finish-load", resolve);
    window.webContents.once("did-fail-load", (_event, code) => {
      if (code !== -3) reject(new Error("parent-load-failed"));
    });
  });
  void window.loadURL(`${parentUrl}/?child=${encodeURIComponent(childUrl)}`).catch(
    () => undefined
  );
  await parentLoaded;
  await Promise.race([
    guestCreated,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("webview fixture timed out")), 5_000)
    )
  ]);
  const documentState = await guest.executeJavaScript(`({
    fixtureTextPresent: document.body.textContent.includes('CSP fixture child loaded'),
    genericErrorPresent: document.body.textContent.includes('An error occurred while trying to load this page.')
  })`);
  return { ...documentState, errorClass: errorClass(code) };
}

let parentServer;
let childServer;

app.whenReady().then(async () => {
  try {
    childServer = await listen((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "frame-ancestors 'self'"
      });
      response.end("<!doctype html><body>CSP fixture child loaded</body>");
    });
    parentServer = await listen((request, response) => {
      const child = new URL(request.url, "http://fixture.invalid").searchParams.get("child");
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<!doctype html><body><script>
        const view = document.createElement('webview');
        view.setAttribute('partition', 'community-csp-fixture');
        view.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no,sandbox=yes');
        view.src = ${JSON.stringify(child)};
        document.body.append(view);
      </script></body>`);
    });
    const childUrl = `${origin(childServer)}/`;
    const topLevel = await loadTopLevel(childUrl);
    const webview = await loadWebview(origin(parentServer), childUrl);
    const result = { topLevel, webview };
    await new Promise((resolve) =>
      process.stdout.write(`${JSON.stringify(result)}\n`, resolve)
    );
    assert.equal(topLevel.fixtureTextPresent, true);
    assert.equal(topLevel.errorClass, "none");
    assert.equal(webview.fixtureTextPresent, true);
    assert.equal(webview.genericErrorPresent, false);
    assert.equal(webview.errorClass, "none");
  } catch (cause) {
    await new Promise((resolve) =>
      process.stderr.write("community-webview-csp-fixture:failed\n", resolve)
    );
    process.exitCode = 1;
  } finally {
    for (const window of windows) {
      if (!window.isDestroyed()) window.destroy();
    }
    if (parentServer) await new Promise((resolve) => parentServer.close(resolve));
    if (childServer) await new Promise((resolve) => childServer.close(resolve));
    app.exit(process.exitCode || 0);
  }
});
