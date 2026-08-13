"use strict";

const CLI_DRIVER_OPERATIONS = Object.freeze([
  "status",
  "discover",
  "open",
  "reconcile",
  "uninstall"
]);

const CLI_RECONCILE_INTENTS = Object.freeze(["install", "update", "repair"]);

const CLI_DRIVER_IDS = Object.freeze([
  "npm",
  "companion-runtime",
  "wsl-managed",
  "portable-binary",
  "python-venv",
  "managed-msi"
]);

function driverIdForPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return "";
  return plan.driver === undefined ? "npm" : String(plan.driver || "");
}

function createCliDriverRegistry(adapters) {
  if (!adapters || typeof adapters !== "object" || Array.isArray(adapters)) {
    throw new TypeError("CLI driver adapters must be an object");
  }

  const registered = Object.create(null);
  for (const driverId of CLI_DRIVER_IDS) {
    const adapter = adapters[driverId];
    if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
      throw new TypeError(`Missing CLI driver adapter: ${driverId}`);
    }
    for (const operation of CLI_DRIVER_OPERATIONS.filter(
      (operation) => operation !== "reconcile"
    )) {
      if (typeof adapter[operation] !== "function") {
        throw new TypeError(
          `CLI driver adapter ${driverId} is missing ${operation}`
        );
      }
    }
    const reconcile = adapter.reconcile || adapter.deploy;
    if (typeof reconcile !== "function") {
      throw new TypeError(
        `CLI driver adapter ${driverId} is missing reconcile`
      );
    }
    registered[driverId] = Object.freeze({
      ...Object.fromEntries(
        CLI_DRIVER_OPERATIONS.filter((operation) => operation !== "reconcile").map((operation) => [
          operation,
          adapter[operation]
        ])
      ),
      reconcile
    });
  }

  for (const driverId of Object.keys(adapters)) {
    if (!CLI_DRIVER_IDS.includes(driverId)) {
      throw new TypeError(`Unknown CLI driver adapter: ${driverId}`);
    }
  }

  const adapterFor = (plan) => {
    const driverId = driverIdForPlan(plan);
    const adapter = registered[driverId];
    if (!adapter) {
      throw new TypeError(`Unsupported CLI driver: ${driverId || "<missing>"}`);
    }
    return adapter;
  };

  const dispatch = (operation, context) => {
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      throw new TypeError("CLI driver context must be an object");
    }
    return adapterFor(context.plan)[operation](context);
  };

  const reconcile = (context) => {
    if (!CLI_RECONCILE_INTENTS.includes(context?.intent)) {
      throw new TypeError("CLI reconcile intent must be install, update or repair");
    }
    return dispatch("reconcile", context);
  };

  return Object.freeze({
    ...Object.fromEntries(
      CLI_DRIVER_OPERATIONS.map((operation) => [
        operation,
        operation === "reconcile"
          ? reconcile
          : (context) => dispatch(operation, context)
      ])
    ),
    deploy: (context) =>
      reconcile({ ...context, intent: context?.intent || "install" })
  });
}

module.exports = {
  CLI_DRIVER_IDS,
  CLI_DRIVER_OPERATIONS,
  CLI_RECONCILE_INTENTS,
  createCliDriverRegistry,
  driverIdForPlan
};
