"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const sso = fs.readFileSync(
  path.resolve(__dirname, "../community/flarum/aihub-sso.php"),
  "utf8"
);
const app = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");
const identityCommunity = fs.readFileSync(
  path.resolve(__dirname, "../identity/identity-community.cjs"),
  "utf8"
);

test("production SSO lands once on the approved HTTPS origin with a Secure session cookie", () => {
  assert.match(sso, /'root_domain'\s*=>\s*\$forumPublicHost/);
  assert.match(
    sso,
    /\$forumCookieSecure\s*=\s*\$forumPublicScheme\s*===\s*'https'/
  );
  assert.match(sso, /'verify_ssl'\s*=>\s*\$forumCookieSecure/);
  assert.match(
    sso,
    /header\('Location: '\.rtrim\(\(string\) getenv\('AIHUB_FORUM_PUBLIC_ORIGIN'\), '\/'\)\.'\/', true, 303\)/
  );
  assert.doesNotMatch(sso, /Location:[^\n]*aihub-sso\.php/);
});

test("a failed document load is not a ticket replay trigger", () => {
  const failedStart = app.indexOf("const failed = (event: Event) =>");
  const failedEnd = app.indexOf(
    'webview.addEventListener("did-navigate"',
    failedStart
  );
  assert.ok(failedStart > 0 && failedEnd > failedStart);
  const failedHandler = app.slice(failedStart, failedEnd);
  assert.doesNotMatch(failedHandler, /recoverWebview|setWebviewRecoveryAttempt/);
});

test("the fix preserves the one-minute single-use handoff boundary", () => {
  assert.match(
    identityCommunity,
    /const COMMUNITY_HANDOFF_LIFETIME_MS = 60 \* 1000/
  );
  assert.match(
    identityCommunity,
    /audience = 'community-browser'[\s\S]*consumed_at IS NULL[\s\S]*expires_at > now\(\)/
  );
  assert.match(
    app,
    /webview\.setAttribute\("partition", "persist:aihub-community"\)/
  );
  assert.match(app, /\}, \[embed\]\);/);
});
