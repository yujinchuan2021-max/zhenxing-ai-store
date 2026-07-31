"use strict";

const CLI_DRIVER_OPERATIONS = Object.freeze([
  "status",
  "discover",
  "open",
  "deploy",
  "uninstall"
]);

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
    for (const operation of CLI_DRIVER_OPERATIONS) {
      if (typeof adapter[operation] !== "function") {
        throw new TypeError(
          `CLI driver adapter ${driverId} is missing ${operation}`
        );
      }
    }
    registered[driverId] = Object.freeze({
      ...Object.fromEntries(
        CLI_DRIVER_OPERATIONS.map((operation) => [
          operation,
          adapter[operation]
        ])
      )
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

  return Object.freeze(
    Object.fromEntries(
      CLI_DRIVER_OPERATIONS.map((operation) => [
        operation,
        (context) => dispatch(operation, context)
      ])
    )
  );
}

module.exports = {
  CLI_DRIVER_IDS,
  CLI_DRIVER_OPERATIONS,
  createCliDriverRegistry,
  driverIdForPlan
};
