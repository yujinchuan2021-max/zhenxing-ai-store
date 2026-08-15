"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  approvedCommunityOrigin,
  classifyCommunityLoadFailure,
  communityDiscussionLocation,
  communityEmbedSessionFailure,
  communityProfileSyncKey,
  isApprovedCommunityNavigation,
  validateCommunityLaunchUrl
} = require("../shared/community-embed.cjs");

const app = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
const main = fs.readFileSync(path.resolve(__dirname, "../electron/main.cjs"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "../src/styles.css"), "utf8");

function loadPreload(invoke) {
  const preload = fs.readFileSync(path.resolve(__dirname, "../electron/preload.cjs"), "utf8");
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: {
          exposeInMainWorld(_name, api) {
            context.bridge = api;
          }
        },
        ipcRenderer: { invoke, on() {}, removeListener() {} }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  return context.bridge;
}

test("community IPC failures stay structured instead of becoming Electron errors", async () => {
  const bridge = loadPreload(async (channel) => {
    assert.equal(channel, "community:create-embed-session");
    throw new Error(
      "Error invoking remote method 'community:create-embed-session': " +
        "private diagnostic"
    );
  });

  const result = await bridge.createCommunityEmbedSession();

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: false,
    error: {
      code: "TEMPORARILY_UNAVAILABLE",
      status: 503,
      messageKey: "community.serviceUnavailable"
    }
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /community:create-embed-session|Error invoking|diagnostic/i
  );
});

test("an expired community session returns to login instead of leaving a false signed-in page", async () => {
  assert.deepEqual(communityEmbedSessionFailure({ status: 401 }), {
    ok: false,
    error: {
      code: "SESSION_REVOKED",
      status: 401,
      messageKey: "community.sessionExpired"
    }
  });
  assert.deepEqual(
    communityEmbedSessionFailure(
      Object.assign(new Error("private server detail"), {
        code: "PRIVATE_DATABASE_FAILURE",
        status: 500
      })
    ),
    {
      ok: false,
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        status: 503,
        messageKey: "community.serviceUnavailable"
      }
    }
  );
  assert.doesNotMatch(
    JSON.stringify(communityEmbedSessionFailure(new Error("private diagnostic"))),
    /private|diagnostic|database/i
  );

  const bridge = loadPreload(async () => ({
    ok: true,
    value: {
      launchUrl: "https://evil.example/aihub-sso.php?ticket=private",
      origin: "https://community.zhenxingai.com",
      expiresAt: "2026-08-15T12:00:00.000Z"
    }
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(await bridge.createCommunityEmbedSession())),
    {
      ok: false,
      error: {
        code: "INVALID_IDENTITY_RESPONSE",
        status: 502,
        messageKey: "community.invalidResponse"
      }
    }
  );

  assert.match(main, /communityEmbedSessionFailure\(error\)/);
  assert.match(app, /result\.error\.code === "SESSION_REVOKED"/);
  assert.match(app, /onSessionRevokedRef\.current\(\)/);
  assert.match(app, /setEmbed\(result\.value\)/);
});

test("keeps embedded-community back navigation out of the webview layout flow", () => {
  assert.match(
    app,
    /<section className="embeddedCommunity">\s*<div className="communityBackControl">\s*<BackButton onBack=\{goBack\} \/>\s*<\/div>/
  );
  assert.match(styles, /\.embeddedCommunity\s*\{[\s\S]*?position:\s*relative/);
  assert.match(styles, /\.communityBackControl\s*\{[\s\S]*?position:\s*absolute/);
});

test("rebuilds a community handoff when public identity profile data changes", () => {
  const base = {
    status: "authenticated",
    user: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      profile: { nickname: "用户", avatarUrl: "/v1/avatars/a?v=1", bio: "简介" }
    }
  };
  assert.notEqual(
    communityProfileSyncKey(base),
    communityProfileSyncKey({
      ...base,
      user: {
        ...base.user,
        profile: { ...base.user.profile, avatarUrl: "/v1/avatars/a?v=2" }
      }
    })
  );
  assert.equal(communityProfileSyncKey({ status: "anonymous" }), "anonymous");
});

test("accepts only a fixed HTTPS or loopback community origin", () => {
  assert.equal(
    approvedCommunityOrigin("http://127.0.0.1:8088"),
    "http://127.0.0.1:8088"
  );
  assert.equal(
    approvedCommunityOrigin("https://community.example.com"),
    "https://community.example.com"
  );
  assert.throws(() => approvedCommunityOrigin("http://community.example.com"));
  assert.throws(() =>
    approvedCommunityOrigin("https://community.example.com/forum")
  );
});

test("validates one-time embedded community launch URLs exactly", () => {
  const ticket = "a".repeat(43);
  assert.equal(
    validateCommunityLaunchUrl(
      `http://127.0.0.1:8088/aihub-sso.php?ticket=${ticket}`,
      "http://127.0.0.1:8088"
    ),
    `http://127.0.0.1:8088/aihub-sso.php?ticket=${ticket}`
  );
  assert.throws(() =>
    validateCommunityLaunchUrl(
      `http://127.0.0.1:8088/aihub-sso.php?ticket=${ticket}&next=https://evil.example`,
      "http://127.0.0.1:8088"
    )
  );
  assert.throws(() =>
    validateCommunityLaunchUrl(
      `https://evil.example/aihub-sso.php?ticket=${ticket}`,
      "http://127.0.0.1:8088"
    )
  );
});

test("keeps embedded navigation same-origin and identifies discussions", () => {
  const origin = "http://127.0.0.1:8088";
  assert.equal(
    isApprovedCommunityNavigation(`${origin}/all`, origin),
    true
  );
  assert.equal(
    isApprovedCommunityNavigation("https://evil.example/", origin),
    false
  );
  assert.deepEqual(
    communityDiscussionLocation(`${origin}/d/42-ai-hub/3`, origin),
    { discussionId: "42", path: "/d/42-ai-hub/3" }
  );
  assert.equal(communityDiscussionLocation(`${origin}/tags`, origin), null);
});

test("classifies webview load failures without exposing Electron diagnostics", () => {
  assert.deepEqual(classifyCommunityLoadFailure(-310), {
    errorClass: "redirect",
    messageKey: "community.pageFailedRedirect"
  });
  assert.deepEqual(classifyCommunityLoadFailure(-200), {
    errorClass: "tls",
    messageKey: "community.pageFailedTls"
  });
  assert.deepEqual(classifyCommunityLoadFailure(-105), {
    errorClass: "network",
    messageKey: "community.pageFailedNetwork"
  });
  assert.deepEqual(classifyCommunityLoadFailure(-27), {
    errorClass: "blocked",
    messageKey: "community.pageFailedBlocked"
  });
  assert.equal(classifyCommunityLoadFailure(-3), null);
  assert.equal(classifyCommunityLoadFailure(-105, false), null);
  assert.deepEqual(classifyCommunityLoadFailure(-999), {
    errorClass: "load",
    messageKey: "community.pageFailed"
  });
  assert.doesNotMatch(
    app,
    /setError\(\s*detail\.errorDescription\s*\|\|/
  );
});

test("keeps confirmed main-frame failure visible", () => {
  assert.match(app, /const webviewFailedRef = useRef\(false\)/);
  assert.match(app, /const markReady = \(\) => \{\s*if \(webviewFailedRef\.current\) return;/);
  assert.match(
    app,
    /classifyCommunityLoadFailure\(\s*detail\.errorCode,\s*detail\.isMainFrame\s*\)/
  );
  assert.match(
    app,
    /webviewFailedRef\.current = true;\s*webviewReadyRef\.current = false;\s*setWebviewReady\(false\);\s*setLoading\(false\);/
  );
});

test("binds webview listeners before the ticket navigation can attach", () => {
  const createIndex = app.indexOf('document.createElement("webview")');
  const listenerIndex = app.indexOf(
    'webview.addEventListener("did-fail-load", failed)',
    createIndex
  );
  const sourceIndex = app.indexOf(
    'webview.setAttribute("src", embed.launchUrl)',
    createIndex
  );
  const attachIndex = app.indexOf("host.replaceChildren(webview)", createIndex);
  assert.ok(createIndex >= 0, "community webview was not created explicitly");
  assert.ok(listenerIndex > createIndex, "community failure listener was not bound");
  assert.ok(sourceIndex > listenerIndex, "ticket source was set before listeners");
  assert.ok(attachIndex > sourceIndex, "webview attached before its ticket source was fixed");
  assert.match(
    main,
    /!isApprovedCommunityNavigation\(initialUrl, communityOrigin\)\s*\|\|\s*params\.partition !== "persist:aihub-community"/
  );
});

test("does not replay a one-time ticket when community presentation props change", () => {
  assert.match(app, /const onTargetConsumedRef = useRef\(onTargetConsumed\)/);
  assert.match(app, /const communityThemeRef = useRef\(theme\)/);
  assert.match(app, /const communityLanguageRef = useRef\(language\)/);
  assert.match(app, /onTargetConsumedRef\.current\(\)/);
  assert.match(
    app,
    /const webview = webviewRef\.current;[\s\S]*?buildCommunityThemeScript\(theme\)[\s\S]*?buildCommunityLanguageScript\(language\)[\s\S]*?\}, \[language, theme\]\);/
  );
  assert.match(app, /\}, \[embed\]\);/);
  assert.doesNotMatch(
    app,
    /\}, \[embed, language, onTargetConsumed, theme\]\);/
  );
});
