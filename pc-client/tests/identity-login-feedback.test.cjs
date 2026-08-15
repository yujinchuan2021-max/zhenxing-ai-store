"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  CHANNEL,
  registerIdentityLoginIpc
} = require("../electron/identity-login-ipc.cjs");

const root = path.resolve(__dirname, "..");

function contrastRatio(foreground, background, foregroundMix = 0) {
  const rgb = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const foregroundRgb = rgb(foreground);
  const backgroundRgb = rgb(background);
  const mixed = foregroundRgb.map(
    (value, index) => value * foregroundMix + backgroundRgb[index] * (1 - foregroundMix)
  );
  const luminance = (values) => values
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const left = luminance(foregroundRgb);
  const right = luminance(mixed);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function loadPreload(invoke) {
  const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
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

function identitySnapshot() {
  return {
    status: "authenticated",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "login-fixture@users.invalid",
      phone: "",
      username: "login-fixture",
      profile: { nickname: "Login fixture", avatarUrl: "", bio: "" }
    },
    sessionId: "22222222-2222-4222-8222-222222222222"
  };
}

function mainHarness(client, diagnostics = []) {
  let handler;
  registerIdentityLoginIpc(
    {
      handle(channel, candidate) {
        assert.equal(channel, CHANNEL);
        handler = candidate;
      }
    },
    {
      getIdentityClient: () => client,
      logError: (...values) => diagnostics.push(values)
    }
  );
  return (input) => handler({}, input);
}

test("login IPC failure stays structured instead of becoming an invisible Electron error", async () => {
  const bridge = loadPreload(async (channel) => {
    throw new Error(
      `Error invoking remote method '${channel}': Error: ` +
        "https://identity.invalid/private diagnostic"
    );
  });

  const result = await bridge.login({
    identifier: "login-fixture@users.invalid",
    password: "fixture-password-not-a-secret"
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: false,
    error: {
      code: "TEMPORARILY_UNAVAILABLE",
      status: 503,
      messageKey: "identity.login.serviceUnavailable"
    }
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /identity:login|Error invoking|https:\/\/|diagnostic|password/i
  );
});

test("main and preload preserve authenticated state without exposing session credentials", async () => {
  const snapshot = identitySnapshot();
  const invokeMain = mainHarness({ login: async () => snapshot });
  const bridge = loadPreload((channel, input) => {
    assert.equal(channel, CHANNEL);
    return invokeMain(JSON.parse(JSON.stringify(input)));
  });

  const result = await bridge.login({
    identifier: "login-fixture@users.invalid",
    password: "fixture-password-not-a-secret"
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    value: snapshot
  });
  assert.equal("accessToken" in result.value, false);
  assert.equal("refreshToken" in result.value, false);
});

test("main login errors use a fixed safe code table and reject unknown renderer fields", async () => {
  const cases = [
    [
      { code: "AUTHENTICATION_FAILED", status: 401 },
      { code: "AUTHENTICATION_FAILED", status: 401, messageKey: "identity.login.invalidCredentials" }
    ],
    [
      { code: "INVALID_INPUT", status: 400 },
      { code: "INVALID_INPUT", status: 400, messageKey: "identity.login.invalid" }
    ],
    [
      { code: "RATE_LIMITED", status: 429 },
      { code: "RATE_LIMITED", status: 429, messageKey: "identity.login.rateLimited" }
    ],
    [
      { code: "DB_PRIVATE_FAILURE", status: 500 },
      { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "identity.login.serviceUnavailable" }
    ]
  ];
  for (const [source, expected] of cases) {
    const diagnostics = [];
    const invokeMain = mainHarness(
      {
        login: async () => {
          throw Object.assign(
            new Error("https://identity.invalid/private diagnostic secret"),
            source
          );
        }
      },
      diagnostics
    );
    const result = await invokeMain({
      identifier: "login-fixture@users.invalid",
      password: "fixture-password-not-a-secret"
    });
    assert.deepEqual(result, { ok: false, error: expected });
    assert.doesNotMatch(JSON.stringify(result), /https:\/\/|private|diagnostic|secret/i);
    assert.doesNotMatch(JSON.stringify(diagnostics), /https:\/\/|private|diagnostic|secret/i);
  }

  let called = false;
  const invalid = await mainHarness({
    login: async () => {
      called = true;
      return identitySnapshot();
    }
  })({
    identifier: "login-fixture@users.invalid",
    password: "fixture-password-not-a-secret",
    identityId: "33333333-3333-4333-8333-333333333333"
  });
  assert.equal(called, false);
  assert.deepEqual(invalid, {
    ok: false,
    error: { code: "INVALID_INPUT", status: 400, messageKey: "identity.login.invalid" }
  });
});

test("renderer makes login failures readable and keeps success on the authenticated path", () => {
  const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
  const language = fs.readFileSync(path.join(root, "src/language/index.ts"), "utf8");
  const authModal = app.match(/function AuthModal\([\s\S]*?\n}\n\ntype PersonalCenterTab/)?.[0] || "";

  assert.match(main, /registerIdentityLoginIpc\(ipcMain/);
  assert.doesNotMatch(main, /ipcMain\.handle\("identity:login"/);
  assert.match(authModal, /const result = await window\.aihubPC\.login/);
  assert.match(authModal, /if \(!result\.ok\)[\s\S]*?uiText\(result\.error\.messageKey\)/);
  assert.match(authModal, /onIdentity\(result\.value\)[\s\S]*?onClose\(\)/);
  assert.match(authModal, /finally \{\s*setBusy\(false\)/);
  assert.match(authModal, /role=\{messageTone === "error" \? "alert" : "status"\}/);
  assert.match(authModal, /<form className="authForm" onSubmit=\{submitLogin\}>/);
  assert.match(authModal, /autoComplete="username"/);
  assert.match(authModal, /autoComplete="current-password"/);

  const authMessage = styles.match(/\.authMessage\s*\{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(authMessage, /var\(--accent-ink\)/);
  assert.match(styles, /\.authMessage-error\s*\{[\s\S]*?color:\s*#b42318/);
  assert.match(styles, /\.pcApp\[data-theme="dark"\] \.authMessage-error\s*\{[\s\S]*?color:\s*#ffb4ab/);
  assert.ok(contrastRatio("#b42318", "#ffffff", 0.08) >= 4.5);
  assert.ok(contrastRatio("#ffb4ab", "#101c2e", 0.1) >= 4.5);
  for (const key of [
    "identity.login.invalidCredentials",
    "identity.login.rateLimited",
    "identity.login.serviceUnavailable",
    "identity.login.failed"
  ]) {
    assert.equal(language.match(new RegExp(`"${key}"`, "g"))?.length, 2);
  }
});
