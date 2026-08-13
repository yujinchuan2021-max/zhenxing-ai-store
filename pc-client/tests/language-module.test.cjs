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
  const dependencyLock = JSON.parse(
    read("community/flarum/dependency-lock.json")
  );
  const runtimeEntrypoint = read("community/flarum/docker-entrypoint.sh");
  const migrationEntrypoint = read("community/flarum/migration-entrypoint.sh");
  assert.match(main, /settings:set-language/);
  assert.match(preload, /setLanguage/);
  assert.match(app, /buildCommunityLanguageScript\(language\)/);
  assert.match(app, /savePreferences\(\{ locale: targetLocale \}\)/);
  assert.match(app, /typeof app !== "undefined" \? app : globalThis\.app/);
  assert.match(
    dockerfile,
    /flarum-lang\/chinese-simplified:\$\{LANGUAGE_VERSION\}/
  );
  assert.match(
    dependencyLock.chineseSimplified,
    /^2\.x-dev#[a-f0-9]{40}$/
  );
  assert.match(migrationEntrypoint, /extension:enable flarum-lang-chinese-simplified/);
  assert.doesNotMatch(
    runtimeEntrypoint,
    /php\s+flarum\s+(?:install|migrate|extension:enable)\b/
  );
});

test("localizes built-in home and brand fallback copy with the selected PC language", () => {
  const app = read("src/App.tsx");
  assert.match(app, /function builtInBanners\(language: Language\)/);
  assert.match(app, /function builtInBrand\(language: Language\)/);
  assert.doesNotMatch(app, /createLanguage\("zh"\)\.text\("(?:home|brand)\./);
});

test("gives every enabled PC button one shared pressed state", () => {
  const styles = read("src/styles.css");
  assert.match(styles, /button:not\(:disabled\):active\s*\{/);
  assert.match(styles, /transform:\s*translateY\(2px\) scale\(0\.985\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
