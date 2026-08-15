"use strict";

const MAX_IPC_BYTES = 128 * 1024;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor", "command", "args", "env", "headers", "credentials", "script", "secret", "token", "url", "path", "endpoint", "receipt", "receipts", "vault", "vaultReferences", "identity", "identityId", "agentId", "sessionId", "grantId", "audit"]);
const CHANNELS = Object.freeze({
  capability: "agent-bridge:capability",
  search: "agent-bridge:search",
  get: "agent-bridge:get",
  plan: "agent-bridge:plan",
  request: "agent-bridge:request"
});
const OPERATIONS = Object.freeze(["search", "get", "plan", "request"]);

function plain(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; }
function copy(value) {
  const seen = new Set();
  const check = (entry) => {
    if (entry === null || typeof entry !== "object") return;
    if (seen.has(entry) || (!Array.isArray(entry) && !plain(entry))) throw new TypeError("unsafe bridge value");
    seen.add(entry);
    for (const [key, child] of Object.entries(entry)) { if (FORBIDDEN.has(key)) throw new TypeError("unsafe bridge field"); check(child); }
    seen.delete(entry);
  };
  check(value);
  const encoded = JSON.stringify(value);
  if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_IPC_BYTES) throw new TypeError("bridge value too large");
  return JSON.parse(encoded);
}
function failure(code = "SOURCE_UNAVAILABLE") {
  const errors = {
    BRIDGE_DISABLED: { status: 503, messageKey: "agent.bridge.disabled" },
    INPUT_INVALID: { status: 400, messageKey: "agent.bridge.invalid" },
    NOT_FOUND: { status: 404, messageKey: "agent.bridge.notFound" },
    SOURCE_UNAVAILABLE: { status: 503, messageKey: "agent.bridge.unavailable" }
  };
  const value = errors[code] || errors.SOURCE_UNAVAILABLE;
  return { ok: false, error: { code: errors[code] ? code : "SOURCE_UNAVAILABLE", ...value } };
}
function capability(enabled) { return { ok: true, value: { schemaVersion: 1, enabled, execution: false, operations: enabled ? [...OPERATIONS] : [] } }; }
function readyShape(value) {
  return plain(value) && Object.keys(value).length === 4 &&
    value.verifiedCatalog === true && value.immutableWorkflowReleaseResolver === true &&
    value.agentSessionReceiptSnapshot === true && value.bridgeReady === true;
}
function publicTicket(value) {
  if (!plain(value) || Object.keys(value).some((key) => !["schemaVersion", "kind", "requestId", "planId", "agentId", "useId", "capabilityKey", "status", "expiresAt"].includes(key))) throw new TypeError("unsafe confirmation ticket");
  const { schemaVersion, kind, requestId, planId, useId, capabilityKey, status, expiresAt } = value;
  if (schemaVersion !== 1 || kind !== "agent-capability-confirmation-request" || ![requestId, planId, useId, capabilityKey, status, expiresAt].every((entry) => typeof entry === "string" && entry.length > 0)) throw new TypeError("invalid confirmation ticket");
  return { schemaVersion, kind, requestId, planId, useId, capabilityKey, status, expiresAt };
}
function publicResult(operation, result) {
  if (!plain(result) || result.ok !== true || Object.keys(result).some((key) => !["ok", "value", "audit"].includes(key)) || !Object.hasOwn(result, "value")) return failure();
  try { return { ok: true, value: operation === "request" ? publicTicket(result.value) : copy(result.value) }; } catch { return failure(); }
}

function createLocalAgentBridgeIpcFacade({ bridge, getReadiness, logError = () => {} } = {}) {
  async function enabled() {
    if (!OPERATIONS.every((operation) => typeof bridge?.[operation] === "function") || typeof getReadiness !== "function") return false;
    try { return readyShape(await getReadiness()); } catch (error) { logError("Local Agent Bridge readiness failed", error); return false; }
  }
  async function dispatch(operation, input) {
    if (!(await enabled())) return failure("BRIDGE_DISABLED");
    try { return publicResult(operation, await bridge[operation](copy(input))); } catch (error) { logError("Local Agent Bridge IPC failed", error); return failure(); }
  }
  return Object.freeze({
    capability: async () => capability(await enabled()),
    search: (input = {}) => dispatch("search", input),
    get: (input) => dispatch("get", input),
    plan: (input) => dispatch("plan", input),
    request: (input) => dispatch("request", input)
  });
}

function registerLocalAgentBridgeIpc(ipcMain, options = {}) {
  if (!ipcMain?.handle) throw new TypeError("agent bridge IPC requires ipcMain.handle");
  const facade = createLocalAgentBridgeIpcFacade(options);
  ipcMain.handle(CHANNELS.capability, () => facade.capability());
  for (const operation of OPERATIONS) ipcMain.handle(CHANNELS[operation], (_event, input) => facade[operation](input));
  return facade;
}

module.exports = { CHANNELS, MAX_IPC_BYTES, createLocalAgentBridgeIpcFacade, registerLocalAgentBridgeIpc };
