"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createExtensionIpcFacade,
  safeExtensionError
} = require("../shared/extension-ipc.cjs");

test("extension facade returns only safe renderer fields", () => {
  const runtime = {
    getStatus() {
      return {
        state: "installed",
        managed: true,
        targetPath: "C:\\Users\\private\\.codex\\skills\\example"
      };
    },
    install() {
      return {
        receipt: {
          ownedPaths: ["C:\\Users\\private\\.codex\\skills\\example"]
        }
      };
    },
    uninstall() {}
  };
  const facade = createExtensionIpcFacade(runtime);

  assert.deepEqual(facade.status("skill.example"), {
    ok: true,
    state: "installed",
    managed: true
  });
  assert.deepEqual(facade.install("skill.example"), {
    ok: true,
    state: "installed",
    managed: true
  });
  assert.equal(JSON.stringify(facade.status("skill.example")).includes("private"), false);
});

test("missing resources and runtime errors become safe messages", () => {
  assert.deepEqual(createExtensionIpcFacade(null).status("skill.example"), {
    ok: false,
    state: "unavailable",
    managed: false,
    error: "扩展安装资源不可用，请更新 AI Hub 后重试"
  });
  const facade = createExtensionIpcFacade({
    getStatus() {
      const error = new Error("C:\\Users\\private\\secret-path");
      error.code = "EXTENSION_SOURCE_MISSING";
      throw error;
    }
  });
  const result = facade.status("skill.example");
  assert.equal(result.error, "扩展安装资源缺失，请更新 AI Hub 后重试");
  assert.equal(JSON.stringify(result).includes("secret-path"), false);
  assert.equal(safeExtensionError(new Error("private detail")), "扩展操作失败，请稍后重试");
});

test("Electron exposes extension IPC with profileId as its only renderer input", () => {
  const main = fs.readFileSync(
    path.join(__dirname, "..", "electron", "main.cjs"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.join(__dirname, "..", "electron", "preload.cjs"),
    "utf8"
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
  for (const channel of ["status", "install", "uninstall"]) {
    assert.match(
      main,
      new RegExp(`ipcMain\\.handle\\("extension:${channel}", \\(_event, profileId\\)`)
    );
    assert.match(
      preload,
      new RegExp(`ipcRenderer\\.invoke\\("extension:${channel}", profileId\\)`)
    );
  }
  assert.doesNotMatch(preload, /extension:(?:status|install|uninstall)"\s*,\s*profileId\s*,/);
  assert.match(main, /process\.resourcesPath, "extensions"/);
  assert.match(main, /__dirname, "\.\.", "extension-resources"/);
  assert.deepEqual(
    packageJson.build.extraResources.find(
      (resource) => resource.from === "extension-resources"
    ),
    { from: "extension-resources", to: "extensions" }
  );
  assert.ok(
    main.lastIndexOf("initializeExtensionRuntime();") <
      main.lastIndexOf("registerIpc();")
  );
});

test("managed extension UI uses status and busy install or uninstall actions", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "App.tsx"),
    "utf8"
  );
  const language = fs.readFileSync(
    path.join(__dirname, "..", "src", "language", "index.ts"),
    "utf8"
  );
  assert.match(app, /function ExtensionResourceRow/);
  assert.match(app, /getExtensionStatus\(extension\.installProfileId\)/);
  assert.match(app, /installExtension\(extension\.installProfileId\)/);
  assert.match(app, /uninstallExtension\(extension\.installProfileId\)/);
  assert.match(app, /disabled=\{busyAction !== null\}/);
  assert.match(app, /extension\.capabilities\.includes\("website"\)/);
  for (const key of [
    "extensions.checking",
    "extensions.installing",
    "extensions.uninstalling",
    "extensions.installed",
    "extensions.failed"
  ]) {
    assert.match(language, new RegExp(`"${key}"`));
  }
});
