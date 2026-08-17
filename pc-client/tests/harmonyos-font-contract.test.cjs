"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const fontPath = path.join(root, "src/assets/fonts/HarmonyOS_Sans_SC.ttf");

test("the client bundles the exact unmodified HarmonyOS Sans SC font", () => {
  assert.equal(fs.existsSync(fontPath), true, "font asset must exist");
  const bytes = fs.readFileSync(fontPath);
  assert.equal(bytes.length, 20_617_156);
  assert.equal(
    crypto.createHash("sha256").update(bytes).digest("hex"),
    "8978e05044e7089ad6a9de38c505c8148305607983487435a916d2610700a7ca"
  );
});

test("the renderer uses HarmonyOS Sans SC as its global font", () => {
  const styles = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
  const main = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");

  assert.match(styles, /@font-face\s*\{[\s\S]*?font-family:\s*"HarmonyOS Sans SC";[\s\S]*?url\("\.\/assets\/fonts\/HarmonyOS_Sans_SC\.ttf"\)/);
  assert.match(styles, /font-weight:\s*100 900;/);
  assert.match(styles, /font-display:\s*swap;/);
  assert.match(main, /fontFamily:\s*['"]HarmonyOS Sans SC/);
  assert.match(main, /headings:\s*\{[\s\S]*?fontFamily:\s*['"]HarmonyOS Sans SC/);
});

test("the UI and packaged notices preserve the font attribution", () => {
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const language = fs.readFileSync(path.join(root, "src/language/index.ts"), "utf8");
  const notices = fs.readFileSync(path.join(root, "../THIRD_PARTY_NOTICES.md"), "utf8");

  assert.match(app, /settings\.fontNotice/);
  assert.match(language, /"settings\.fontNotice":\s*"界面使用 HarmonyOS Sans SC 字体/);
  assert.match(language, /"settings\.fontNotice":\s*"Interface uses HarmonyOS Sans SC/);
  assert.match(notices, /HarmonyOS Sans SC/);
  assert.match(notices, /Huawei Device Co\., Ltd\./);
  assert.match(notices, /LICENSE_Fonts/);
});
