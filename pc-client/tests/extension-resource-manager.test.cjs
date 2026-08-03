"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createExtensionResourceManager
} = require("../shared/extension-resource-manager.cjs");

const PROFILE = Object.freeze({
  adapterId: "test-adapter",
  extensionId: "example-resource",
  hostProductId: "example-host",
  capabilities: Object.freeze([
    "install",
    "update",
    "repair",
    "enable",
    "disable",
    "uninstall"
  ])
});

function fixture(initialState = "not-installed") {
  let status = { state: initialState, managed: initialState !== "not-installed" };
  const calls = [];
  const authorizations = [];
  const manager = createExtensionResourceManager({
    profileLookup: (id) => (id === "profile.example" ? PROFILE : null),
    adapters: {
      "test-adapter": {
        inspect() {
          return status;
        },
        execute(_profileId, action) {
          calls.push(action);
          if (action === "install" || action === "repair" || action === "update") {
            status = { state: "installed", managed: true, enabled: true };
          } else if (action === "disable") {
            status = { state: "disabled", managed: true, enabled: false };
          } else if (action === "enable") {
            status = { state: "installed", managed: true, enabled: true };
          } else if (action === "uninstall") {
            status = { state: "not-installed", managed: false };
          }
        }
      }
    },
    inspectHost: async () => ({ installed: true, detection: "installed" }),
    authorizeAction: async (request) => {
      authorizations.push(request.action);
      return { ok: true };
    }
  });
  return { manager, calls, authorizations };
}

test("manager exposes state-derived actions and completes a full lifecycle", async () => {
  const { manager, calls, authorizations } = fixture();
  assert.deepEqual((await manager.inspect("profile.example")).allowedActions, ["install"]);
  assert.equal((await manager.execute("profile.example", "install")).state, "installed");
  assert.deepEqual((await manager.inspect("profile.example")).allowedActions, [
    "disable",
    "uninstall"
  ]);
  assert.equal((await manager.execute("profile.example", "disable")).state, "disabled");
  assert.equal((await manager.execute("profile.example", "enable")).state, "installed");
  assert.equal((await manager.execute("profile.example", "uninstall")).state, "not-installed");
  assert.deepEqual(calls, ["install", "disable", "enable", "uninstall"]);
  assert.deepEqual(authorizations, ["install", "enable"]);
});

test("update and repair require fresh catalog authorization", async () => {
  for (const [state, action] of [["outdated", "update"], ["stale", "repair"]]) {
    const { manager, authorizations } = fixture(state);
    assert.equal((await manager.execute("profile.example", action)).state, "installed");
    assert.deepEqual(authorizations, [action]);
  }
});

test("missing host blocks writes but still permits owned cleanup", async () => {
  let state = { state: "stale", managed: true };
  const manager = createExtensionResourceManager({
    profileLookup: () => PROFILE,
    adapters: {
      "test-adapter": {
        inspect: () => state,
        execute: (_profileId, action) => {
          assert.equal(action, "uninstall");
          state = { state: "not-installed", managed: false };
        }
      }
    },
    inspectHost: () => ({ installed: false, detection: "absent" })
  });
  assert.deepEqual((await manager.inspect("profile.example")).allowedActions, ["uninstall"]);
  assert.equal((await manager.execute("profile.example", "uninstall")).state, "host-missing");
});

test("missing host is reported explicitly before the first install", async () => {
  const manager = createExtensionResourceManager({
    profileLookup: () => PROFILE,
    adapters: {
      "test-adapter": {
        inspect: () => ({ state: "not-installed", managed: false }),
        execute: () => assert.fail("host-missing resource must not execute")
      }
    },
    inspectHost: () => ({ installed: false, detection: "absent" })
  });
  assert.deepEqual(await manager.inspect("profile.example"), {
    state: "host-missing",
    managed: false,
    enabled: undefined,
    hostInstalled: false,
    hostDetection: "absent",
    allowedActions: []
  });
});

test("external resources and unauthorized actions are not mutated", async () => {
  const { manager, calls } = fixture("external");
  assert.deepEqual((await manager.inspect("profile.example")).allowedActions, []);
  await assert.rejects(
    manager.execute("profile.example", "install"),
    (error) => error.code === "EXTENSION_ACTION_UNAVAILABLE"
  );
  await assert.rejects(
    manager.execute("profile.example", "launch"),
    (error) => error.code === "EXTENSION_ACTION_NOT_APPROVED"
  );
  assert.deepEqual(calls, []);
});

test("catalog denial prevents adapter execution", async () => {
  const calls = [];
  const manager = createExtensionResourceManager({
    profileLookup: () => PROFILE,
    adapters: {
      "test-adapter": {
        inspect: () => ({ state: "not-installed", managed: false }),
        execute: (_profileId, action) => calls.push(action)
      }
    },
    inspectHost: () => ({ installed: true, detection: "installed" }),
    authorizeAction: () => ({
      ok: false,
      errorCode: "CATALOG_RESOURCE_DISABLED",
      error: "disabled"
    })
  });
  await assert.rejects(
    manager.execute("profile.example", "install"),
    (error) => error.code === "CATALOG_RESOURCE_DISABLED"
  );
  assert.deepEqual(calls, []);
});

test("owned uninstall stays offline when the remote catalog is unavailable", async () => {
  let status = { state: "installed", managed: true };
  const calls = [];
  const manager = createExtensionResourceManager({
    profileLookup: () => PROFILE,
    adapters: {
      "test-adapter": {
        inspect: () => status,
        execute: (_profileId, action) => {
          calls.push(action);
          status = { state: "not-installed", managed: false };
        }
      }
    },
    inspectHost: () => ({ installed: true, detection: "installed" }),
    authorizeAction: () => {
      throw new Error("remote catalog must not be consulted for uninstall");
    }
  });

  assert.equal((await manager.execute("profile.example", "uninstall")).state, "not-installed");
  assert.deepEqual(calls, ["uninstall"]);
});
