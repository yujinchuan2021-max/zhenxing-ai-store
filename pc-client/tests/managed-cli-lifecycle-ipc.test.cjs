"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const {
  createManagedCliLifecycleCandidate,
  createPortableBinaryLifecycleExecutor,
  receiptOwnsPortableBinaryPlan
} = require("../shared/managed-cli-lifecycle-candidate.cjs");
const {
  inspectManagedBinaryCli
} = require("../shared/managed-binary-cli.cjs");
const {
  INSTALL_REGISTRY,
  cliInstallPlans
} = require("../shared/install-registry.cjs");
const {
  CHANNELS,
  FIXED_PORTABLE_BINARY_PRODUCT_IDS,
  createManagedCliLifecycleIpcFacade,
  registerManagedCliLifecycleIpc
} = require("../electron/managed-cli-lifecycle-ipc.cjs");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function portableBinaryPlan({ fileName, digest }) {
  return {
    name: "Antigravity CLI",
    driver: "portable-binary",
    version: "1.2.3",
    commandName: "antigravity",
    artifacts: {
      [process.arch]: {
        url: "https://downloads.example.invalid/antigravity.exe",
        fileName,
        allowedHosts: ["downloads.example.invalid"],
        sha256: digest,
        maximumBytes: 1024 * 1024
      }
    }
  };
}

function catalog(productId, overrides = {}) {
  const profileIds = {
    "google-antigravity-cli": "cli.antigravity",
    "moonshot-kimi-code-cli": "cli.kimi-code",
    "amp-cli": "cli.amp",
    "daytona-cli": "cli.daytona"
  };
  return {
    source: "remote",
    catalogVersion: 6,
    catalog: {
      vendors: [{
        id: overrides.vendorId || "vendor",
        enabled: true,
        products: [{
          id: productId,
          enabled: true,
          productType: "cli",
          kind: "CLI",
          moduleId: overrides.moduleId || "cli-managed",
          installProfileId: overrides.installProfileId || profileIds[productId] || "cli.other",
          requirements: overrides.requirements || [],
          capabilities: overrides.capabilities || ["website", "tutorial", "install", "update", "repair", "open", "uninstall"]
        }]
      }]
    }
  };
}

function registry() {
  return Object.freeze({
    "google-antigravity-cli": Object.freeze({
      label: "Antigravity CLI",
      profileId: "cli.antigravity",
      moduleId: "cli-managed",
      vendorId: "vendor",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      capabilities: Object.freeze(["website", "tutorial", "install", "update", "repair", "open", "uninstall"]),
      requirements: Object.freeze([])
    }),
    "openfang-cli": Object.freeze({
      label: "OpenFang",
      profileId: "cli.openfang",
      moduleId: "cli-managed",
      vendorId: "vendor",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      capabilities: Object.freeze(["website", "tutorial", "install", "update", "repair", "open", "uninstall"]),
      requirements: Object.freeze([])
    })
  });
}

function lifecycle() {
  const calls = [];
  return {
    calls,
    plan: async (input) => {
      calls.push(["plan", input]);
      return {
        ok: true,
        value: {
          planId: "plan-1",
          productId: input.productId,
          profileId: "cli.antigravity",
          moduleId: "cli-managed",
          operation: input.operation,
          driver: "portable-binary",
          requirements: [],
          receiptRequired: false,
          rollbackRequired: true,
          state: "confirmation-required"
        }
      };
    },
    confirm: async (input) => {
      calls.push(["confirm", input]);
      return { ok: true, value: { planId: input.planId, confirmationId: input.confirmationId, state: "confirmed" } };
    },
    apply: async (input) => {
      calls.push(["apply", input]);
      return {
        ok: true,
        value: {
          planId: input.planId,
          state: input.dryRun ? "dry-run" : "applied",
          receipt: { ownership: "aihub", action: "install", persisted: !input.dryRun, receiptId: "private-receipt", version: "1.1.9" },
          status: { installed: true, managed: true, detection: "installed", directory: "C:\\private\\cli" },
          rollback: { required: true, executed: false }
        }
      };
    }
  };
}

function facade(options = {}) {
  return createManagedCliLifecycleIpcFacade({
    registrations: registry(),
    lifecycle: lifecycle(),
    loadCatalog: async () => catalog("google-antigravity-cli"),
    readStatus: async (productId) => ({ productId, installed: false, managed: false, detection: "absent" }),
    recheckStatus: async (productId) => ({ productId, installed: true, managed: true, detection: "installed" }),
    ...options
  });
}

test("fixed CLI lifecycle IPC exports the exact review package operations", () => {
  assert.deepEqual(FIXED_PORTABLE_BINARY_PRODUCT_IDS, [
    "google-antigravity-cli",
    "moonshot-kimi-code-cli",
    "amp-cli",
    "daytona-cli"
  ]);
  assert.deepEqual(Object.keys(CHANNELS).sort(), ["apply", "confirm", "plan", "recheck", "status"].sort());
});

test("every review-package fixed CLI profile is a local portable-binary profile", () => {
  const plans = cliInstallPlans();
  for (const productId of FIXED_PORTABLE_BINARY_PRODUCT_IDS) {
    const registration = INSTALL_REGISTRY[productId];
    const plan = plans[productId];
    assert.equal(registration.mode, "managed-cli");
    assert.equal(registration.moduleId, "cli-managed");
    assert.equal(registration.productType, "cli");
    assert.equal(registration.kind, "CLI");
    assert.equal(plan.driver, "portable-binary");
    assert.ok(Object.values(plan.artifacts).every((artifact) =>
      artifact && typeof artifact.fileName === "string" && Array.isArray(artifact.allowedHosts)
    ));
  }
});

test("parallel fixed CLI fixtures keep their temp and receipt roots independent before plan", async (t) => {
  const runs = await Promise.all(Array.from({ length: 12 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-fixed-cli-ipc-parallel-"));
    const receiptPath = path.join(root, "receipts.json");
    fs.writeFileSync(receiptPath, "{}");
    const subject = facade();
    const planned = await subject.plan({
      productId: "google-antigravity-cli",
      operation: "install",
      useId: "use-1"
    });
    return { root, receiptPath, planned };
  }));
  for (const { root } of runs) t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(new Set(runs.map(({ root }) => root)).size, runs.length);
  assert.equal(new Set(runs.map(({ receiptPath }) => receiptPath)).size, runs.length);
  assert.ok(runs.every(({ planned }) => planned.ok === true && planned.value.planId === "plan-1"));
});

test("fixed CLI lifecycle rejects non-review portable-binary products and hostile execution fields before planning", async () => {
  const subject = facade({ loadCatalog: async () => catalog("openfang-cli") });
  assert.equal((await subject.plan({ productId: "openfang-cli", operation: "install", useId: "use-1" })).error.code, "FIXED_PROFILE_UNAVAILABLE");
  assert.equal((await subject.plan({ productId: "google-antigravity-cli", operation: "install", useId: "use-1", command: "whoami" })).error.code, "INPUT_INVALID");
});

test("fixed CLI lifecycle requires current signed catalog to match the fixed client profile", async () => {
  const badProfile = facade({ loadCatalog: async () => catalog("google-antigravity-cli", { installProfileId: "cli.fake" }) });
  assert.equal((await badProfile.plan({ productId: "google-antigravity-cli", operation: "install", useId: "use-1" })).error.code, "CATALOG_PROFILE_MISMATCH");

  const missingCapability = facade({ loadCatalog: async () => catalog("google-antigravity-cli", { capabilities: ["website"] }) });
  assert.equal((await missingCapability.plan({ productId: "google-antigravity-cli", operation: "install", useId: "use-1" })).error.code, "CATALOG_CAPABILITY_DISABLED");
});

test("fixed CLI lifecycle rechecks the current signed catalog before confirmation and apply", async () => {
  let current = catalog("google-antigravity-cli");
  const backing = lifecycle();
  const subject = facade({ lifecycle: backing, loadCatalog: async () => current });
  const planned = await subject.plan({ productId: "google-antigravity-cli", operation: "install", useId: "use-1" });
  assert.equal(planned.ok, true);
  current = catalog("google-antigravity-cli", { capabilities: ["website"] });
  assert.equal((await subject.confirm({ planId: planned.value.planId, useId: "use-1", confirmationId: "confirm-1" })).error.code, "CATALOG_CAPABILITY_DISABLED");
  assert.equal((await subject.apply({ planId: planned.value.planId, useId: "use-1", confirmationId: "confirm-1", dryRun: false })).error.code, "CATALOG_CAPABILITY_DISABLED");
  assert.deepEqual(backing.calls.map(([operation]) => operation), ["plan"]);
});

test("fixed CLI lifecycle plans, confirms, applies, and redacts receipt/path internals", async () => {
  const backing = lifecycle();
  const subject = facade({ lifecycle: backing });
  const planned = await subject.plan({ productId: "google-antigravity-cli", operation: "install", useId: "use-1" });
  assert.equal(planned.ok, true);
  assert.equal(planned.value.driver, "portable-binary");
  assert.deepEqual(backing.calls[0], ["plan", { productId: "google-antigravity-cli", operation: "install", useId: "use-1" }]);
  assert.equal((await subject.confirm({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1" })).ok, true);
  const applied = await subject.apply({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1", dryRun: false });
  assert.equal(applied.ok, true);
  assert.deepEqual(applied.value.receipt, { ownership: "aihub", action: "install", persisted: true, version: "1.1.9" });
  assert.deepEqual(applied.value.status, { installed: true, managed: true, detection: "installed" });
  assert.doesNotMatch(JSON.stringify(applied), /private-receipt|C:\\\\private/i);
});

test("fixed CLI lifecycle exposes status and recheck without executing apply", async () => {
  const subject = facade();
  assert.deepEqual(await subject.status({ productId: "google-antigravity-cli" }), {
    ok: true,
    value: { productId: "google-antigravity-cli", installed: false, managed: false, detection: "absent" }
  });
  assert.deepEqual(await subject.recheck({ productId: "google-antigravity-cli" }), {
    ok: true,
    value: { productId: "google-antigravity-cli", installed: true, managed: true, detection: "installed" }
  });
});

test("fixed CLI lifecycle registers structured main handlers", async () => {
  const handlers = new Map();
  registerManagedCliLifecycleIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, facade());
  assert.deepEqual([...handlers.keys()].sort(), Object.values(CHANNELS).sort());
  assert.equal((await handlers.get(CHANNELS.plan)({}, { productId: "google-antigravity-cli", operation: "install", useId: "use-1" })).ok, true);
});

test("fixed CLI lifecycle facade applies, rechecks, rolls back bad updates, and uninstalls in an isolated root", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-fixed-cli-ipc-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const good = path.join(root, "good.exe");
  const bad = path.join(root, "bad.exe");
  fs.writeFileSync(good, Buffer.alloc(2048, 7));
  fs.writeFileSync(bad, Buffer.alloc(2048, 9));
  const plan = portableBinaryPlan({ fileName: "antigravity.exe", digest: sha256(good) });
  const plans = { "google-antigravity-cli": plan };
  const receipts = {};
  let sourcePath = good;
  let nextId = 0;
  const status = () => inspectManagedBinaryCli({
    productId: "google-antigravity-cli",
    plan,
    receipt: receipts["google-antigravity-cli"] || null,
    configuredPrefix: root,
    architecture: process.arch,
    verifyIntegrity: true,
    hashFile: (filePath, algorithm = "sha256") => {
      assert.equal(algorithm, "sha256");
      return sha256(filePath);
    }
  });
  const lifecycle = createManagedCliLifecycleCandidate({
    registrations: registry(),
    plans,
    readReceipt: async ({ productId }) => receipts[productId] || null,
    receiptOwnsPlan: ({ productId, receipt }) => receiptOwnsPortableBinaryPlan({
      productId,
      plan,
      receipt,
      installRoot: root,
      architecture: process.arch,
      fileSystem: fs,
      hashFile: (filePath, algorithm = "sha256") => {
        assert.equal(algorithm, "sha256");
        return sha256(filePath);
      }
    }),
    verifyUserConfirmation: async ({ useId }) => useId === "use-1",
    executor: createPortableBinaryLifecycleExecutor({
      installRoot: root,
      artifactProvider: async () => ({ filePath: sourcePath }),
      receiptStore: {
        read: (productId) => receipts[productId] || null,
        write: (productId, receipt) => { receipts[productId] = receipt; },
        remove: (productId) => { delete receipts[productId]; }
      },
      architecture: process.arch,
      fileSystem: fs,
      hashFile: (filePath, algorithm = "sha256") => {
        assert.equal(algorithm, "sha256");
        return sha256(filePath);
      },
      makeReceiptId: () => `receipt-${++nextId}`,
      randomId: () => `id-${++nextId}`.padEnd(48, "0"),
      randomBytes: () => Buffer.alloc(24, ++nextId)
    }),
    now: () => "2026-08-08T00:00:00.000Z",
    makeId: () => `plan-${++nextId}`
  });
  const subject = createManagedCliLifecycleIpcFacade({
    registrations: registry(),
    lifecycle,
    loadCatalog: async () => catalog("google-antigravity-cli"),
    readStatus: async () => status(),
    recheckStatus: async () => status()
  });
  const handlers = new Map();
  registerManagedCliLifecycleIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, subject);
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: {
          invoke: (channel, input) => handlers.get(channel)({}, JSON.parse(JSON.stringify(input))),
          on() {},
          removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8"), context, {
    filename: "electron/preload.cjs"
  });
  const bridge = context.bridge;

  const install = await bridge.planFixedCliLifecycle({ productId: "google-antigravity-cli", operation: "install", useId: "use-1" });
  assert.equal(install.ok, true);
  assert.equal((await bridge.confirmFixedCliLifecycle({ planId: install.value.planId, useId: "use-1", confirmationId: "confirm-1" })).ok, true);
  assert.equal((await bridge.applyFixedCliLifecycle({ planId: install.value.planId, useId: "use-1", confirmationId: "confirm-1", dryRun: false })).ok, true);
  assert.equal((await bridge.recheckFixedCliLifecycle({ productId: "google-antigravity-cli" })).value.installed, true);
  const installedExecutable = receipts["google-antigravity-cli"].executable;
  assert.equal(sha256(installedExecutable), sha256(good));

  sourcePath = bad;
  const update = await bridge.planFixedCliLifecycle({ productId: "google-antigravity-cli", operation: "update", useId: "use-1" });
  assert.equal(update.ok, true);
  assert.equal((await bridge.confirmFixedCliLifecycle({ planId: update.value.planId, useId: "use-1", confirmationId: "confirm-2" })).ok, true);
  assert.equal((await bridge.applyFixedCliLifecycle({ planId: update.value.planId, useId: "use-1", confirmationId: "confirm-2", dryRun: false })).error.code, "APPLY_FAILED_ROLLED_BACK");
  assert.equal(sha256(installedExecutable), sha256(good));
  assert.equal((await bridge.recheckFixedCliLifecycle({ productId: "google-antigravity-cli" })).value.installed, true);

  const uninstall = await bridge.planFixedCliLifecycle({ productId: "google-antigravity-cli", operation: "uninstall", useId: "use-1" });
  assert.equal(uninstall.ok, true);
  assert.equal((await bridge.confirmFixedCliLifecycle({ planId: uninstall.value.planId, useId: "use-1", confirmationId: "confirm-3" })).ok, true);
  assert.equal((await bridge.applyFixedCliLifecycle({ planId: uninstall.value.planId, useId: "use-1", confirmationId: "confirm-3", dryRun: false })).ok, true);
  assert.equal((await bridge.recheckFixedCliLifecycle({ productId: "google-antigravity-cli" })).value.installed, false);
});

test("main wires fixed CLI lifecycle facade without changing legacy cli handlers", () => {
  const main = fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8");
  assert.match(main, /registerManagedCliLifecycleIpc\(ipcMain,\s*createFixedCliLifecycleFacade\(\)\)/);
  assert.match(main, /createManagedCliLifecycleCandidate/);
  assert.match(main, /createPortableBinaryLifecycleExecutor/);
  assert.match(main, /FIXED_PORTABLE_BINARY_PRODUCT_IDS/);
  assert.match(main, /ipcMain\.handle\("cli:deploy"/);
  assert.match(main, /ipcMain\.handle\("cli:uninstall"/);
});

test("preload exposes only structured fixed CLI lifecycle methods and safe rejected envelopes", async () => {
  const preload = fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8");
  const calls = [];
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: {
          invoke: async (...args) => { calls.push(args); throw new Error("receipt secret path"); },
          on() {},
          removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  const methods = Object.keys(context.bridge).filter((name) => /FixedCliLifecycle/.test(name)).sort();
  assert.deepEqual(methods, [
    "applyFixedCliLifecycle",
    "confirmFixedCliLifecycle",
    "getFixedCliLifecycleStatus",
    "planFixedCliLifecycle",
    "recheckFixedCliLifecycle"
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(await context.bridge.planFixedCliLifecycle({
    productId: "google-antigravity-cli",
    operation: "install",
    useId: "use-1"
  }))), {
    ok: false,
    error: { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "cli.lifecycle.unavailable" }
  });
  assert.equal(calls[0][0], CHANNELS.plan);
});

test("preload rejects fixed CLI lifecycle successes that contain receipt or path internals", async () => {
  const preload = fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8");
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: { exposeInMainWorld(_name, api) { context.bridge = api; } },
        ipcRenderer: {
          invoke: async () => ({ ok: true, value: { receipt: { receiptId: "private" }, status: { directory: "C:\\private" } } }),
          on() {},
          removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  assert.deepEqual(JSON.parse(JSON.stringify(await context.bridge.applyFixedCliLifecycle({
    planId: "plan-1",
    useId: "use-1",
    confirmationId: "confirm-1",
    dryRun: true
  }))), {
    ok: false,
    error: { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "cli.lifecycle.unavailable" }
  });
});
