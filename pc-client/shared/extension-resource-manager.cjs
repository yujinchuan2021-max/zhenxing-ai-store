"use strict";

const APPROVED_ACTIONS = Object.freeze([
  "install",
  "update",
  "repair",
  "enable",
  "disable",
  "uninstall"
]);
const WRITE_ACTIONS = new Set(["install", "update", "repair", "enable"]);

function managerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertProfile(profile) {
  if (
    !isRecord(profile) ||
    typeof profile.adapterId !== "string" ||
    !profile.adapterId ||
    typeof profile.hostProductId !== "string" ||
    !profile.hostProductId ||
    !Array.isArray(profile.capabilities) ||
    profile.capabilities.some((value) => typeof value !== "string")
  ) {
    throw managerError(
      "EXTENSION_PROFILE_NOT_APPROVED",
      "Extension profile is not approved"
    );
  }
  return profile;
}

function allowedActions(profile, status, host) {
  const supports = (action) => profile.capabilities.includes(action);
  const hostReady = host?.installed === true;
  const actions = [];
  const add = (action, condition = true) => {
    if (condition && supports(action)) actions.push(action);
  };

  switch (status?.state) {
    case "not-installed":
      add("install", hostReady);
      break;
    case "installed":
      add("disable", hostReady);
      add("uninstall");
      break;
    case "disabled":
      add("enable", hostReady);
      add("uninstall");
      break;
    case "outdated":
      add("update", hostReady);
      add("repair", hostReady);
      add(status.enabled === false ? "enable" : "disable", hostReady);
      add("uninstall");
      break;
    case "stale":
      add("repair", hostReady);
      add("uninstall");
      break;
    default:
      break;
  }
  return actions;
}

function publicStatus(profile, status, host) {
  const adapterState =
    typeof status?.state === "string" ? status.state : "unsafe";
  const state =
    adapterState === "not-installed" && host?.installed !== true
      ? "host-missing"
      : adapterState;
  return Object.freeze({
    state,
    managed: status?.managed === true,
    enabled:
      typeof status?.enabled === "boolean" ? status.enabled : undefined,
    hostInstalled: host?.installed === true,
    hostDetection:
      ["installed", "absent", "unknown"].includes(host?.detection)
        ? host.detection
        : "unknown",
    allowedActions: Object.freeze(allowedActions(profile, status, host))
  });
}

function createExtensionResourceManager({
  profileLookup,
  adapters,
  inspectHost,
  authorizeAction = async () => ({ ok: true })
}) {
  if (
    typeof profileLookup !== "function" ||
    !isRecord(adapters) ||
    typeof inspectHost !== "function" ||
    typeof authorizeAction !== "function"
  ) {
    throw new TypeError("Extension resource manager options are invalid");
  }

  const activeProfiles = new Set();

  function context(profileId) {
    const profile = assertProfile(profileLookup(profileId));
    const adapter = adapters[profile.adapterId];
    if (
      !adapter ||
      typeof adapter.inspect !== "function" ||
      typeof adapter.execute !== "function"
    ) {
      throw managerError(
        "EXTENSION_ADAPTER_UNAVAILABLE",
        "Extension adapter is unavailable"
      );
    }
    return { profile, adapter };
  }

  async function inspect(profileId) {
    const { profile, adapter } = context(profileId);
    const [status, host] = await Promise.all([
      Promise.resolve(adapter.inspect(profileId)),
      Promise.resolve(inspectHost(profile.hostProductId))
    ]);
    return publicStatus(profile, status, host);
  }

  async function execute(profileId, action) {
    if (!APPROVED_ACTIONS.includes(action)) {
      throw managerError(
        "EXTENSION_ACTION_NOT_APPROVED",
        "Extension action is not approved"
      );
    }
    const { profile, adapter } = context(profileId);
    if (!profile.capabilities.includes(action)) {
      throw managerError(
        "EXTENSION_ACTION_NOT_APPROVED",
        "Extension action is not enabled by the local profile"
      );
    }
    if (activeProfiles.has(profileId)) {
      throw managerError("EXTENSION_BUSY", "Extension operation is already running");
    }

    activeProfiles.add(profileId);
    try {
      const before = await inspect(profileId);
      if (!before.allowedActions.includes(action)) {
        throw managerError(
          "EXTENSION_ACTION_UNAVAILABLE",
          "Extension action is unavailable in the current state"
        );
      }
      if (WRITE_ACTIONS.has(action)) {
        const authorization = await authorizeAction({
          profileId,
          profile,
          action
        });
        if (!authorization?.ok) {
          throw managerError(
            authorization?.errorCode || "EXTENSION_CATALOG_AUTHORIZATION_FAILED",
            authorization?.error || "Extension catalog authorization failed"
          );
        }
      }
      await Promise.resolve(adapter.execute(profileId, action));
      return await inspect(profileId);
    } finally {
      activeProfiles.delete(profileId);
    }
  }

  return Object.freeze({ inspect, execute });
}

module.exports = {
  APPROVED_ACTIONS,
  allowedActions,
  createExtensionResourceManager
};
