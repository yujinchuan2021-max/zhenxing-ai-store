"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CLI_DRIVER_IDS,
  CLI_DRIVER_OPERATIONS,
  CLI_RECONCILE_INTENTS,
  createCliDriverRegistry,
  driverIdForPlan
} = require("../shared/cli-driver-registry.cjs");
const { cliInstallPlans } = require("../shared/install-registry.cjs");

function adaptersThatRecord(calls) {
  return Object.fromEntries(
    CLI_DRIVER_IDS.map((driverId) => [
      driverId,
      Object.fromEntries(
        CLI_DRIVER_OPERATIONS.map((operation) => [
          operation,
          async (context) => {
            calls.push({ driverId, operation, context });
            return `${driverId}:${operation}:${context.productId}`;
          }
        ])
      )
    ])
  );
}

test("one registry routes every CLI lifecycle operation through one reviewed adapter", async () => {
  const calls = [];
  const registry = createCliDriverRegistry(adaptersThatRecord(calls));

  for (const driverId of CLI_DRIVER_IDS) {
    const plan = { driver: driverId };
    for (const operation of CLI_DRIVER_OPERATIONS) {
      const productId = `${driverId}-${operation}`;
      const context = {
        productId,
        plan,
        evidence: "kept",
        ...(operation === "reconcile" ? { intent: "install" } : {})
      };
      assert.equal(
        await registry[operation](context),
        `${driverId}:${operation}:${productId}`
      );
    }
  }

  assert.equal(calls.length, CLI_DRIVER_IDS.length * CLI_DRIVER_OPERATIONS.length);
  assert.ok(calls.every(({ context }) => context.evidence === "kept"));
});

test("a legacy plan without a driver uses the npm adapter for its complete lifecycle", async () => {
  const calls = [];
  const registry = createCliDriverRegistry(adaptersThatRecord(calls));
  const plan = { packageName: "@example/cli" };

  assert.equal(driverIdForPlan(plan), "npm");
  for (const operation of CLI_DRIVER_OPERATIONS) {
    const context = {
      productId: "example-cli",
      plan,
      ...(operation === "reconcile" ? { intent: "install" } : {})
    };
    assert.equal(
      await registry[operation](context),
      `npm:${operation}:example-cli`
    );
  }
  assert.deepEqual(
    calls.map(({ driverId, operation }) => `${driverId}:${operation}`),
    CLI_DRIVER_OPERATIONS.map((operation) => `npm:${operation}`)
  );
});

test("reconcile validates one lifecycle intent and deploy remains an install alias", async () => {
  const calls = [];
  const registry = createCliDriverRegistry(adaptersThatRecord(calls));
  const plan = { packageName: "@example/cli" };

  for (const intent of CLI_RECONCILE_INTENTS) {
    await registry.reconcile({ productId: "example-cli", plan, intent });
  }
  await registry.deploy({ productId: "example-cli", plan });

  assert.deepEqual(
    calls.map(({ operation, context }) => [operation, context.intent]),
    [
      ["reconcile", "install"],
      ["reconcile", "update"],
      ["reconcile", "repair"],
      ["reconcile", "install"]
    ]
  );
  assert.throws(
    () => registry.reconcile({ productId: "example-cli", plan, intent: "run" }),
    /intent must be install, update or repair/
  );
});

test("legacy deploy adapters are normalized behind the same reconcile interface", async () => {
  const calls = [];
  const adapters = Object.fromEntries(
    Object.entries(adaptersThatRecord([])).map(([driverId, adapter]) => [
      driverId,
      {
        ...adapter,
        reconcile: undefined,
        deploy: async (context) => {
          calls.push({ driverId, context });
          return context.intent;
        }
      }
    ])
  );
  const registry = createCliDriverRegistry(adapters);

  assert.equal(
    await registry.reconcile({
      productId: "example-cli",
      plan: { packageName: "@example/cli" },
      intent: "update"
    }),
    "update"
  );
  assert.equal(calls.length, 1);
});

test("status keeps its synchronous contract and every local CLI plan resolves to a registered driver", () => {
  const adapters = adaptersThatRecord([]);
  adapters.npm.status = ({ productId }) => ({ productId, installed: true });
  const registry = createCliDriverRegistry(adapters);

  assert.deepEqual(
    registry.status({ productId: "codex-cli", plan: {} }),
    { productId: "codex-cli", installed: true }
  );
  for (const plan of Object.values(cliInstallPlans())) {
    assert.ok(CLI_DRIVER_IDS.includes(driverIdForPlan(plan)));
  }
});

test("the seam rejects incomplete, extra and backend-like driver adapters", () => {
  const complete = adaptersThatRecord([]);
  assert.throws(
    () =>
      createCliDriverRegistry({
        ...complete,
        "python-venv": { ...complete["python-venv"], uninstall: undefined }
      }),
    /python-venv is missing uninstall/
  );
  assert.throws(
    () => createCliDriverRegistry({ ...complete, "remote-shell": complete.npm }),
    /Unknown CLI driver adapter: remote-shell/
  );

  const registry = createCliDriverRegistry(complete);
  assert.throws(
    () =>
      registry.deploy({
        productId: "hostile-cli",
        plan: { driver: "remote-shell", command: "powershell.exe" }
      }),
    /Unsupported CLI driver: remote-shell/
  );
});
