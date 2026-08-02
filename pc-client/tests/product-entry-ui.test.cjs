"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(
  path.resolve(__dirname, "../src/App.tsx"),
  "utf8"
);
const main = fs.readFileSync(
  path.resolve(__dirname, "../electron/main.cjs"),
  "utf8"
);
const preload = fs.readFileSync(
  path.resolve(__dirname, "../electron/preload.cjs"),
  "utf8"
);

test("the product card renders backend entry points without vendor branches", () => {
  const row = app.match(/function ProductRow\([\s\S]*?function AuthModal/)?.[0];
  assert.ok(row);
  assert.match(row, /const entryPoints = behavior\.entryPoints \|\| \[\]/);
  assert.match(row, /entryPoints\.find/);
  assert.match(row, /linkEntries\.map/);
  assert.match(row, /entry\.label/);
  assert.doesNotMatch(row, /chatgpt|claude|yuanbao|doubao/i);
});

test("CLI products are labeled separately and expose an installed terminal action", () => {
  assert.match(app, /product\.kind === "CLI"[\s\S]*?product\.kind\.cli/);
  assert.match(app, /cliStatus\?\.installed[\s\S]*?onOpenCli/);
  assert.match(app, /product\.openCli/);
});

test("CLI folder and Windows uninstall settings use argument-free IPC", () => {
  assert.match(
    preload,
    /openCliDirectory:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("settings:open-cli-directory"\)/
  );
  assert.match(
    preload,
    /openWindowsUninstallSettings:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("settings:open-windows-uninstall"\)/
  );
  assert.match(
    main,
    /ipcMain\.handle\("settings:open-cli-directory", async \(\) => \{[\s\S]*?readSettings\(\)\.cliInstallDirectory[\s\S]*?path\.isAbsolute[\s\S]*?fs\.realpathSync[\s\S]*?isDirectory\(\)[\s\S]*?shell\.openPath/
  );
  assert.match(
    main,
    /ipcMain\.handle\("settings:open-windows-uninstall", async \(\) => \{[\s\S]*?ms-settings:appsfeatures/
  );
});
