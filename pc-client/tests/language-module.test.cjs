"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function resourceKeys(source) {
  return new Set(
    [...source.matchAll(/^\s*"(auto\.[a-f0-9]+)":/gm)].map(
      (match) => match[1]
    )
  );
}

function placeholders(source, key) {
  const match = source.match(
    new RegExp(`^\\s*"${key.replace(".", "\\.")}":\\s*("(?:[^"\\\\]|\\\\.)*"),$`, "m")
  );
  assert.ok(match, `missing language key ${key}`);
  return [...JSON.parse(match[1]).matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((item) => item[1])
    .sort();
}

test("keeps all extracted PC copy in paired language resources", () => {
  const chinese = read("src/language/generated.ts");
  const english = read("src/language/generated.en.ts");
  const chineseKeys = resourceKeys(chinese);
  const englishKeys = resourceKeys(english);
  assert.ok(chineseKeys.size >= 380);
  assert.deepEqual(englishKeys, chineseKeys);
  for (const key of chineseKeys) {
    assert.deepEqual(placeholders(english, key), placeholders(chinese, key));
  }
});

test("does not scatter user-facing Chinese copy back into the PC page", () => {
  const app = read("src/App.tsx");
  const remaining = app
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(({ text }) => /\p{Script=Han}/u.test(text))
    .filter(({ text }) => !/builtInBanners|builtInBrand/.test(text))
    .filter(({ line }) => line < 302 || line > 319)
    .filter(({ text }) =>
      !/["'](全部|桌面端|其他产品|、)["']/.test(text)
    );
  assert.deepEqual(remaining, []);
});

test("persists one PC language and applies it to the embedded community", () => {
  const app = read("src/App.tsx");
  const main = read("electron/main.cjs");
  const preload = read("electron/preload.cjs");
  const dockerfile = read("community/flarum/Dockerfile");
  const entrypoint = read("community/flarum/docker-entrypoint.sh");
  assert.match(main, /settings:set-language/);
  assert.match(preload, /setLanguage/);
  assert.match(app, /buildCommunityLanguageScript\(language\)/);
  assert.match(app, /savePreferences\(\{ locale: targetLocale \}\)/);
  assert.match(app, /typeof app !== "undefined" \? app : globalThis\.app/);
  assert.match(dockerfile, /flarum-lang\/chinese-simplified:2\.x-dev/);
  assert.match(entrypoint, /flarum-lang-chinese-simplified/);
});

test("gives every enabled PC button one shared pressed state", () => {
  const styles = read("src/styles.css");
  assert.match(styles, /button:not\(:disabled\):active\s*\{/);
  assert.match(styles, /transform:\s*translateY\(2px\) scale\(0\.985\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
