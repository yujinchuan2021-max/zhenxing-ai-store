"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const styles = fs.readFileSync(path.resolve(__dirname, "../src/styles.css"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../src/App.tsx"), "utf8");

test("compact top-bar actions keep their accessible labels on one line", () => {
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.topActions > button[\s\S]*?white-space:\s*nowrap/,
    "top-bar actions must not wrap at the 740px acceptance width"
  );
});

test("compact top-bar lets the search column shrink before authenticated actions overflow", () => {
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.topbar\s*\{[\s\S]*?grid-template-columns:\s*180px minmax\(0, 1fr\) auto/
  );
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.topActions\s*\{[\s\S]*?gap:\s*4px/);
});

test("personal center uses the shared accent token rather than a separate green theme", () => {
  assert.match(
    styles,
    /\.personalIdentity p\s*\{[\s\S]*?color:\s*var\(--accent\)/
  );
  assert.match(styles, /\.personalTabs button\.active\s*\{[\s\S]*?background:\s*var\(--accent\)/);
  assert.match(styles, /\.personalCard \.accentButton\s*\{[\s\S]*?background:\s*var\(--accent\)/);
  const personalStyles = styles.match(/\.personalCenter[\s\S]*?\.contactEditorActions[\s\S]*?\}/)?.[0] || "";
  assert.doesNotMatch(personalStyles, /#a8ff56|#98ef49|#9df04f/i);
});

test("profile writes keep avatar changes on the dedicated upload boundary", () => {
  const submitProfile = app.match(/const submitProfile =[\s\S]*?const chooseAvatar =/)?.[0];
  assert.ok(submitProfile);
  assert.doesNotMatch(submitProfile, /avatarUrl/);
  assert.match(app, /updateIdentityAvatar\(\{ dataUrl \}\)/);
});

test("profile operations retain visible busy and normalized error feedback", () => {
  const personalCenter = app.match(/function PersonalCenterPage\([\s\S]*?\n}\n\nfunction /)?.[0];
  assert.ok(personalCenter);
  assert.match(
    personalCenter,
    /const run =[\s\S]*?setBusy\(true\)[\s\S]*?setNotice\(""\)[\s\S]*?catch \(error\)[\s\S]*?setNotice\([\s\S]*?finally \{\s*setBusy\(false\)/
  );
  assert.match(personalCenter, /className="accentButton" disabled=\{busy\}/);
  assert.match(personalCenter, /\{notice && <p className="personalNotice">\{runtimeMessage\(notice\)\}<\/p>\}/);
});
