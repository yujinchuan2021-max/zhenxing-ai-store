"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("settings primes the packaged runtime version when the client starts", () => {
  const app = read("src/App.tsx");
  const main = read("electron/main.cjs");
  const preload = read("electron/preload.cjs");
  const updateCheck = app.slice(
    app.indexOf("const checkForUpdate"),
    app.indexOf("const installUpdate")
  );

  assert.match(main, /const currentVersion = app\.getVersion\(\);/);
  assert.match(preload, /checkForUpdate:\s*\(\) => ipcRenderer\.invoke\("update:check"\)/);
  assert.match(updateCheck, /await window\.aihubPC\.checkForUpdate\(\)/);
  assert.match(updateCheck, /setUpdateResult\(result\)/);
  assert.match(
    app,
    /useEffect\(\(\) => \{\s*void checkForUpdate\(\)\.catch\(\(\) => undefined\);\s*\}, \[\]\);/,
    "the packaged client must read its runtime version before Settings is opened"
  );
  assert.match(app, /\{updateResult\?\.currentVersion \|\| packageJson\.version\}/);
});
