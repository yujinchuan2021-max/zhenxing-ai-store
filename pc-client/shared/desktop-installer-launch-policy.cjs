"use strict";

const DESKTOP_INSTALL_INTENTS = Object.freeze([
  "install",
  "reinstall",
  "refresh"
]);

function resolveDesktopInstallerLaunchPolicy(intent = "install") {
  if (!DESKTOP_INSTALL_INTENTS.includes(intent)) return null;
  const trackPresenceTransition = intent === "install";
  return Object.freeze({
    intent,
    trackPresenceTransition,
    verificationMode: trackPresenceTransition
      ? "presence-transition"
      : "installer-owned-maintenance"
  });
}

function resolveTrustedDesktopInstallerLaunchPolicy(intent, presence) {
  const requested = resolveDesktopInstallerLaunchPolicy(intent);
  if (!requested) return { ok: false, errorCode: "INVALID_INSTALL_INTENT" };
  if (
    !presence ||
    (presence.detection === "absent" && presence.installed !== false) ||
    (presence.detection === "installed" && presence.installed !== true) ||
    !["absent", "installed"].includes(presence.detection)
  ) {
    return { ok: false, errorCode: "PRODUCT_PRESENCE_UNKNOWN" };
  }
  if (presence.detection === "installed" && intent === "install") {
    return { ok: false, errorCode: "PRODUCT_ALREADY_INSTALLED" };
  }

  const effective = resolveDesktopInstallerLaunchPolicy(
    presence.detection === "absent" ? "install" : "reinstall"
  );
  return Object.freeze({
    ok: true,
    requestedIntent: intent,
    ...effective
  });
}

function resolveCompletedPackageInstallIntent({ requestedIntent, installed }) {
  if (requestedIntent !== undefined) {
    return resolveDesktopInstallerLaunchPolicy(requestedIntent)?.intent || null;
  }
  return installed === true ? "reinstall" : "install";
}

module.exports = {
  DESKTOP_INSTALL_INTENTS,
  resolveCompletedPackageInstallIntent,
  resolveDesktopInstallerLaunchPolicy,
  resolveTrustedDesktopInstallerLaunchPolicy
};
