"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, session } = require("electron");
const { clearCommunitySessionCookies, COMMUNITY_PARTITION } = require("../../electron/community-session.cjs");

const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const approvedOrigin = new URL(input.origin).origin;
app.setPath("userData", input.profilePath);
app.commandLine.appendSwitch("host-resolver-rules", "MAP community.phasea.test 127.0.0.1");
app.commandLine.appendSwitch("no-proxy-server");

app.on("certificate-error", (event, _contents, url, _error, _certificate, callback) => {
  if (new URL(url).hostname === "community.phasea.test") {
    event.preventDefault();
    callback(true);
    return;
  }
  callback(false);
});

function cookieSummary(cookies) {
  const cookie = cookies.find((item) => item.name === "flarum_token");
  if (!cookie) return { cookiePresent: false, secure: false, domainMatch: false };
  const cookieHost = cookie.domain.replace(/^\./, "");
  return {
    cookiePresent: Boolean(cookie.value),
    secure: cookie.secure === true,
    domainMatch: new URL(approvedOrigin).hostname === cookieHost || new URL(approvedOrigin).hostname.endsWith(`.${cookieHost}`)
  };
}

async function loadOnce(window, ticket) {
  const redirects = [];
  const failures = [];
  const onRedirect = (event, url) => {
    const parsed = new URL(url);
    if (parsed.origin !== approvedOrigin || parsed.pathname !== "/") event.preventDefault();
    redirects.push(parsed.origin === approvedOrigin && parsed.pathname === "/" ? "approved-root" : "blocked");
  };
  const onFail = (_event, code) => failures.push(code);
  window.webContents.on("will-redirect", onRedirect);
  window.webContents.on("did-fail-load", onFail);
  await window.loadURL(`${approvedOrigin}/aihub-sso.php?ticket=${ticket}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const final = new URL(window.webContents.getURL());
  const loggedIn = await window.webContents.executeJavaScript("document.body.textContent.includes('phasea_user')", true);
  const cookies = await window.webContents.session.cookies.get({ url: approvedOrigin });
  window.webContents.removeListener("will-redirect", onRedirect);
  window.webContents.removeListener("did-fail-load", onFail);
  return {
    finalOrigin: final.origin === approvedOrigin,
    finalPath: final.pathname,
    redirectCount: redirects.length,
    redirectPathsAllowed: redirects.every((value) => value === "approved-root"),
    tooManyRedirects: failures.includes(-310),
    loadFailed: failures.length > 0,
    loggedIn,
    ...cookieSummary(cookies)
  };
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { partition: COMMUNITY_PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  try {
    const first = await loadOnce(window, input.tickets[0]);
    await clearCommunitySessionCookies(session);
    const afterLogout = (await session.fromPartition(COMMUNITY_PARTITION).cookies.get({ url: approvedOrigin })).length === 0;
    const second = await loadOnce(window, input.tickets[1]);
    await clearCommunitySessionCookies(session);
    const afterRevoke = (await session.fromPartition(COMMUNITY_PARTITION).cookies.get({ url: approvedOrigin })).length === 0;
    process.stdout.write(JSON.stringify({
      partitionMatch: window.webContents.session === session.fromPartition(COMMUNITY_PARTITION),
      first,
      second,
      afterLogout,
      afterRevoke
    }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      error: "ELECTRON_SSO_LOAD_FAILED",
      errorCode: Number.isInteger(error?.errno) ? error.errno : null
    }));
    process.exitCode = 1;
  } finally {
    window.destroy();
    app.quit();
  }
});
