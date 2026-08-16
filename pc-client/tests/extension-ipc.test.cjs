"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createExtensionIpcFacade,
  safeExtensionError
} = require("../shared/extension-ipc.cjs");

test("extension facade returns only safe renderer fields", async () => {
  const manager = {
    inspect() {
      return {
        state: "installed",
        managed: true,
        hostInstalled: true,
        hostDetection: "installed",
        allowedActions: ["disable", "uninstall", "arbitrary-command"],
        targetPath: "C:\\Users\\private\\.codex\\skills\\example"
      };
    },
    execute() {
      return this.inspect();
    }
  };
  const facade = createExtensionIpcFacade(manager);

  assert.deepEqual(await facade.inspect("skill.example"), {
    ok: true,
    state: "installed",
    managed: true,
    hostInstalled: true,
    hostDetection: "installed",
    allowedActions: ["disable", "uninstall"]
  });
  assert.deepEqual(await facade.execute("skill.example", "install"), {
    ok: true,
    state: "installed",
    managed: true,
    hostInstalled: true,
    hostDetection: "installed",
    allowedActions: ["disable", "uninstall"]
  });
  assert.equal(JSON.stringify(await facade.inspect("skill.example")).includes("private"), false);
});

test("extension facade applies the caller status filter to inspect, execute, and list", async () => {
  const facade = createExtensionIpcFacade(
    {
      inspect() {
        return {
          state: "outdated",
          managed: true,
          allowedActions: ["update", "uninstall"]
        };
      },
      execute() {
        return this.inspect();
      }
    },
    {
      listProfiles: () => [
        {
          id: "skill.example",
          label: "Example",
          moduleId: "skill-managed",
          hostProductId: "codex-cli"
        }
      ],
      statusFilter: (_profileId, status) => ({
        ...status,
        allowedActions: status.allowedActions.filter((action) => action !== "update")
      })
    }
  );

  assert.deepEqual((await facade.inspect("skill.example")).allowedActions, ["uninstall"]);
  assert.deepEqual((await facade.execute("skill.example", "update")).allowedActions, [
    "uninstall"
  ]);
  assert.deepEqual((await facade.list())[0].allowedActions, ["uninstall"]);
});

test("extension list exposes managed marker-only profiles and safe anomalies", async () => {
  const statuses = {
    "skill.managed": {
      state: "installed",
      managed: true,
      allowedActions: ["uninstall"],
      targetPath: "C:\\Users\\private\\managed-skill"
    },
    "mcp.invalid": {
      state: "invalid-receipt",
      managed: false,
      allowedActions: []
    },
    "plugin.external": {
      state: "external",
      managed: false,
      allowedActions: []
    },
    "plugin.marker-only": {
      state: "installed",
      managed: true,
      enabled: true,
      allowedActions: ["disable", "uninstall"]
    },
    "skill.host-missing": {
      state: "host-missing",
      managed: false,
      allowedActions: []
    }
  };
  const facade = createExtensionIpcFacade(
    {
      inspect(profileId) {
        return statuses[profileId];
      },
      execute() {}
    },
    {
      listProfiles: () => [
        {
          id: "skill.managed",
          label: "Managed Skill",
          moduleId: "skill-managed",
          hostProductId: "codex-cli",
          capabilities: ["arbitrary-command"]
        },
        {
          id: "mcp.invalid",
          label: "Invalid MCP",
          moduleId: "mcp-managed",
          hostProductId: "codex-cli"
        },
        {
          id: "plugin.external",
          label: "External Plugin",
          moduleId: "plugin-managed",
          hostProductId: "claude-code"
        },
        {
          id: "plugin.marker-only",
          label: "Marker-only Plugin",
          moduleId: "plugin-managed",
          hostProductId: "claude-code"
        },
        {
          id: "skill.host-missing",
          label: "Unmanaged Skill",
          moduleId: "skill-managed",
          hostProductId: "codex-cli"
        },
        {
          id: "unknown.module",
          label: "Unknown",
          moduleId: "external",
          hostProductId: "codex-cli"
        }
      ]
    }
  );

  assert.deepEqual(await facade.list(), [
    {
      profileId: "skill.managed",
      label: "Managed Skill",
      resourceType: "skill",
      hostProductId: "codex-cli",
      ok: true,
      state: "installed",
      managed: true,
      allowedActions: ["uninstall"]
    },
    {
      profileId: "mcp.invalid",
      label: "Invalid MCP",
      resourceType: "mcp",
      hostProductId: "codex-cli",
      ok: true,
      state: "invalid-receipt",
      managed: false,
      allowedActions: []
    },
    {
      profileId: "plugin.marker-only",
      label: "Marker-only Plugin",
      resourceType: "plugin",
      hostProductId: "claude-code",
      ok: true,
      state: "installed",
      managed: true,
      enabled: true,
      allowedActions: ["disable", "uninstall"]
    }
  ]);
  assert.equal(JSON.stringify(await facade.list()).includes("private"), false);
  assert.equal(JSON.stringify(await facade.list()).includes("arbitrary-command"), false);
});

test("missing resources and runtime errors become safe messages", async () => {
  assert.deepEqual(await createExtensionIpcFacade(null).inspect("skill.example"), {
    ok: false,
    state: "unavailable",
    managed: false,
    allowedActions: [],
    error: "扩展安装资源不可用，请更新枕星AI助手 后重试"
  });
  const facade = createExtensionIpcFacade({
    inspect() {
      const error = new Error("C:\\Users\\private\\secret-path");
      error.code = "EXTENSION_SOURCE_MISSING";
      throw error;
    },
    execute() {}
  });
  const result = await facade.inspect("skill.example");
  assert.equal(result.error, "扩展安装资源缺失，请更新枕星AI助手 后重试");
  assert.equal(JSON.stringify(result).includes("secret-path"), false);
  assert.equal(safeExtensionError(new Error("private detail")), "扩展操作失败，请稍后重试");
});

test("Electron exposes extension list/inspect/execute IPC interfaces", () => {
  const main = fs.readFileSync(
    path.join(__dirname, "..", "electron", "main.cjs"),
    "utf8"
  );
  const preload = fs.readFileSync(
    path.join(__dirname, "..", "electron", "preload.cjs"),
    "utf8"
  );
  const types = fs.readFileSync(
    path.join(__dirname, "..", "src", "vite-env.d.ts"),
    "utf8"
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
  assert.match(main, /ipcMain\.handle\("extension:inspect", \(_event, profileId\)/);
  assert.match(main, /ipcMain\.handle\("extension:execute", \(_event, profileId, action\)/);
  assert.match(main, /ipcMain\.handle\("extension:list", \(\) => extensionIpcFacade\.list\(\)\)/);
  assert.match(main, /listProfiles = \(\) => publicExtensionInstallProfiles\(\)/);
  assert.doesNotMatch(main, /localExtensionReceiptProfiles/);
  assert.match(main, /createClaudeCodeMcpRuntime\(\{/);
  assert.match(main, /createCursorMcpRuntime\(\{/);
  assert.match(main, /"claude-code-mcp-cli": claudeMcpRuntime/);
  assert.match(main, /"cursor-mcp-json": cursorMcpRuntime/);
  assert.match(main, /shell: false/);
  assert.match(preload, /ipcRenderer\.invoke\("extension:inspect", profileId\)/);
  assert.match(preload, /ipcRenderer\.invoke\("extension:execute", profileId, action\)/);
  assert.match(preload, /ipcRenderer\.invoke\("extension:list"\)/);
  assert.match(types, /listExtensions\(\): Promise<ExtensionInventoryEntry\[\]>/);
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

test("managed resource UI probes only after an explicit action", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "App.tsx"),
    "utf8"
  );
  const language = fs.readFileSync(
    path.join(__dirname, "..", "src", "language", "index.ts"),
    "utf8"
  );
  assert.match(app, /function ResourceRow/);
  assert.doesNotMatch(app, /getExtensionStatus\(target\.installProfileId\)/);
  assert.match(app, /inspectExtension\(target\.installProfileId\)/);
  assert.match(app, /executeExtension\(target\.installProfileId, action\)/);
  assert.match(app, /listExtensions\(\)/);
  assert.match(app, /data-aihub-extension-inventory="local-receipts"/);
  assert.match(app, /entry\.allowedActions\.map\(\(action\) =>/);
  assert.match(app, /data-aihub-action=\{`\$\{action\}-installed-extension`\}/);
  assert.match(
    app,
    /result\.ok\s*\? \{ \.\.\.item, \.\.\.result, error: undefined \}\s*: \{\s*\.\.\.item,\s*ok: false,\s*error:/
  );
  assert.match(app, /disabled=\{busyAction !== null\}/);
  assert.match(app, /resourceTargetPresentation\(resource, target\)/);
  assert.match(app, /const managed = presentation\.managed/);
  assert.match(app, /managed && !status/);
  assert.match(app, /onClick=\{\(\) => void runAction\("inspect"\)\}/);
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
