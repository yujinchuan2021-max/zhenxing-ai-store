"use strict";

const MAX_IPC_BYTES = 128 * 1024;
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const OPERATIONS = new Set(["install", "update", "repair", "uninstall"]);
const FORBIDDEN = new Set([
  "__proto__", "prototype", "constructor", "command", "commands", "args",
  "arguments", "env", "environment", "headers", "credentials", "credential",
  "token", "tokens", "secret", "secrets", "script", "scripts", "shell",
  "endpoint", "url", "urls", "path", "paths", "cwd", "executable",
  "receiptId", "receipt", "receipts", "vault", "identity"
]);
const CHANNELS = Object.freeze({
  plan: "cli-lifecycle:plan",
  confirm: "cli-lifecycle:confirm",
  apply: "cli-lifecycle:apply",
  status: "cli-lifecycle:status",
  recheck: "cli-lifecycle:recheck"
});
const FIXED_PORTABLE_BINARY_PRODUCT_IDS = Object.freeze([
  "google-antigravity-cli",
  "moonshot-kimi-code-cli",
  "amp-cli",
  "daytona-cli"
]);

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeTree(value, seen = new Set(), depth = 0) {
  if (value === null || typeof value !== "object") return true;
  if (depth > 32 || seen.has(value) || (!Array.isArray(value) && !plain(value))) return false;
  seen.add(value);
  for (const [field, child] of Object.entries(value)) {
    if (FORBIDDEN.has(field) || !safeTree(child, seen, depth + 1)) return false;
  }
  seen.delete(value);
  return true;
}

function exact(value, fields) {
  return plain(value) && Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field));
}

function ipcInput(value, fields) {
  if (!exact(value, fields) || !safeTree(value)) throw new TypeError("invalid input");
  const encoded = JSON.stringify(value);
  if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_IPC_BYTES) {
    throw new RangeError("input too large");
  }
  return value;
}

function error(code) {
  const entries = {
    INPUT_INVALID: [400, "cli.lifecycle.invalidInput"],
    INPUT_TOO_LARGE: [413, "cli.lifecycle.inputTooLarge"],
    FIXED_PROFILE_UNAVAILABLE: [403, "cli.lifecycle.unavailable"],
    ACTIVE_CATALOG_UNAVAILABLE: [503, "cli.lifecycle.catalogUnavailable"],
    CATALOG_PROFILE_MISMATCH: [403, "cli.lifecycle.catalogMismatch"],
    CATALOG_CAPABILITY_DISABLED: [403, "cli.lifecycle.capabilityDisabled"],
    LIFECYCLE_UNAVAILABLE: [503, "cli.lifecycle.unavailable"]
  };
  const [status, messageKey] = entries[code] || entries.LIFECYCLE_UNAVAILABLE;
  return Object.freeze({ ok: false, error: Object.freeze({ code, status, messageKey }) });
}

function safeCallError(cause) {
  return error(cause instanceof RangeError ? "INPUT_TOO_LARGE" : "INPUT_INVALID");
}

function copy(value) {
  if (!safeTree(value)) throw new TypeError("unsafe output");
  return JSON.parse(JSON.stringify(value));
}

function publicStatus(status) {
  return Object.freeze({
    ...(typeof status?.productId === "string" ? { productId: status.productId } : {}),
    installed: status?.installed === true,
    managed: status?.managed === true,
    detection: typeof status?.detection === "string" ? status.detection : "unknown",
    ...(typeof status?.version === "string" && status.version ? { version: status.version } : {})
  });
}

function publicApplyValue(value) {
  const receipt = value?.receipt && plain(value.receipt)
    ? {
        ownership: value.receipt.ownership === "aihub" ? "aihub" : "none",
        action: typeof value.receipt.action === "string" ? value.receipt.action : "",
        persisted: value.receipt.persisted === true,
        version: typeof value.receipt.version === "string" ? value.receipt.version : ""
      }
    : null;
  return Object.freeze({
    planId: typeof value?.planId === "string" ? value.planId : "",
    state: typeof value?.state === "string" ? value.state : "unknown",
    receipt,
    ...(value?.status ? { status: publicStatus(value.status) } : {}),
    rollback: {
      required: value?.rollback?.required === true,
      executed: value?.rollback?.executed === true
    }
  });
}

function publicLifecycleResult(operation, result) {
  if (!plain(result) || result.ok !== true || !Object.hasOwn(result, "value")) {
    const code = typeof result?.error === "string" ? result.error : "LIFECYCLE_UNAVAILABLE";
    return error(code);
  }
  if (operation === "apply") return Object.freeze({ ok: true, value: publicApplyValue(result.value) });
  try {
    return Object.freeze({ ok: true, value: Object.freeze(copy(result.value)) });
  } catch {
    return error("LIFECYCLE_UNAVAILABLE");
  }
}

function fixedRegistration(registrations, productId, operation) {
  const registration = registrations?.[productId];
  return FIXED_PORTABLE_BINARY_PRODUCT_IDS.includes(productId) &&
    registration?.mode === "managed-cli" &&
    registration.moduleId === "cli-managed" &&
    registration.productType === "cli" &&
    registration.kind === "CLI" &&
    Array.isArray(registration.capabilities) &&
    registration.capabilities.includes(operation)
    ? registration
    : null;
}

function catalogProduct(catalogResult, productId, registration, operation) {
  if (catalogResult?.source !== "remote" || !Array.isArray(catalogResult?.catalog?.vendors)) {
    return error("ACTIVE_CATALOG_UNAVAILABLE");
  }
  const matches = [];
  for (const vendor of catalogResult.catalog.vendors) {
    if (vendor?.enabled === false) continue;
    for (const product of Array.isArray(vendor?.products) ? vendor.products : []) {
      if (product?.id === productId) matches.push({ vendor, product });
    }
  }
  if (matches.length !== 1 || matches[0].product.enabled === false) {
    return error("FIXED_PROFILE_UNAVAILABLE");
  }
  const { vendor, product } = matches[0];
  if (
    vendor.id !== registration.vendorId ||
    product.productType !== registration.productType ||
    product.kind !== registration.kind ||
    product.moduleId !== registration.moduleId ||
    product.installProfileId !== registration.profileId ||
    !Array.isArray(product.requirements) ||
    product.requirements.length !== registration.requirements.length ||
    !product.requirements.every((item) => registration.requirements.includes(item))
  ) {
    return error("CATALOG_PROFILE_MISMATCH");
  }
  if (!Array.isArray(product.capabilities) || !product.capabilities.includes(operation)) {
    return error("CATALOG_CAPABILITY_DISABLED");
  }
  return null;
}

function createManagedCliLifecycleIpcFacade({
  registrations,
  lifecycle,
  loadCatalog,
  readStatus,
  recheckStatus
} = {}) {
  if (!plain(registrations) || !lifecycle || typeof lifecycle.plan !== "function" ||
      typeof lifecycle.confirm !== "function" || typeof lifecycle.apply !== "function" ||
      typeof loadCatalog !== "function" || typeof readStatus !== "function" ||
      typeof recheckStatus !== "function") {
    throw new TypeError("managed CLI lifecycle IPC options are invalid");
  }

  const approvedPlans = new Map();

  async function authorize(productId, operation) {
    const registration = fixedRegistration(registrations, productId, operation);
    if (!registration) return error("FIXED_PROFILE_UNAVAILABLE");
    try {
      return catalogProduct(await loadCatalog(), productId, registration, operation);
    } catch {
      return error("ACTIVE_CATALOG_UNAVAILABLE");
    }
  }

  async function authorizePendingPlan(planId) {
    const pending = approvedPlans.get(planId);
    if (!pending) return error("FIXED_PROFILE_UNAVAILABLE");
    return authorize(pending.productId, pending.operation);
  }

  return Object.freeze({
    async plan(value) {
      let request;
      try {
        request = ipcInput(value, ["productId", "operation", "useId"]);
        if (![request.productId, request.useId].every((item) => typeof item === "string" && ID.test(item)) ||
            !OPERATIONS.has(request.operation)) throw new TypeError("invalid input");
      } catch (cause) {
        return safeCallError(cause);
      }
      const blocked = await authorize(request.productId, request.operation);
      if (blocked) return blocked;
      const result = publicLifecycleResult("plan", await lifecycle.plan(request).catch(() => null));
      if (result.ok === true && typeof result.value?.planId === "string") {
        approvedPlans.set(result.value.planId, Object.freeze({
          productId: request.productId,
          operation: request.operation
        }));
      }
      return result;
    },
    async confirm(value) {
      let request;
      try {
        request = ipcInput(value, ["planId", "useId", "confirmationId"]);
        if (![request.planId, request.useId, request.confirmationId].every((item) => typeof item === "string" && ID.test(item))) {
          throw new TypeError("invalid input");
        }
      } catch (cause) {
        return safeCallError(cause);
      }
      const blocked = await authorizePendingPlan(request.planId);
      if (blocked) return blocked;
      return publicLifecycleResult("confirm", await lifecycle.confirm(request).catch(() => null));
    },
    async apply(value) {
      let request;
      try {
        request = ipcInput(value, ["planId", "useId", "confirmationId", "dryRun"]);
        if (![request.planId, request.useId, request.confirmationId].every((item) => typeof item === "string" && ID.test(item)) ||
            typeof request.dryRun !== "boolean") throw new TypeError("invalid input");
      } catch (cause) {
        return safeCallError(cause);
      }
      const blocked = await authorizePendingPlan(request.planId);
      if (blocked) return blocked;
      return publicLifecycleResult("apply", await lifecycle.apply(request).catch(() => null));
    },
    async status(value) {
      let request;
      try {
        request = ipcInput(value, ["productId"]);
        if (typeof request.productId !== "string" || !ID.test(request.productId)) throw new TypeError("invalid input");
      } catch (cause) {
        return safeCallError(cause);
      }
      if (!fixedRegistration(registrations, request.productId, "install")) return error("FIXED_PROFILE_UNAVAILABLE");
      return Object.freeze({ ok: true, value: publicStatus(await readStatus(request.productId)) });
    },
    async recheck(value) {
      let request;
      try {
        request = ipcInput(value, ["productId"]);
        if (typeof request.productId !== "string" || !ID.test(request.productId)) throw new TypeError("invalid input");
      } catch (cause) {
        return safeCallError(cause);
      }
      if (!fixedRegistration(registrations, request.productId, "install")) return error("FIXED_PROFILE_UNAVAILABLE");
      return Object.freeze({ ok: true, value: publicStatus(await recheckStatus(request.productId)) });
    }
  });
}

function registerManagedCliLifecycleIpc(ipcMain, facade) {
  if (!ipcMain?.handle || !facade) throw new TypeError("managed CLI lifecycle IPC requires ipcMain and facade");
  for (const [operation, channel] of Object.entries(CHANNELS)) {
    ipcMain.handle(channel, (_event, input) => facade[operation](input));
  }
}

module.exports = {
  CHANNELS,
  FIXED_PORTABLE_BINARY_PRODUCT_IDS,
  createManagedCliLifecycleIpcFacade,
  registerManagedCliLifecycleIpc
};
