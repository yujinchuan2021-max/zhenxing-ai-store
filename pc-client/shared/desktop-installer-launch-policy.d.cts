export type DesktopInstallIntent = "install" | "reinstall" | "refresh";

export type DesktopInstallerLaunchPolicy = {
  intent: DesktopInstallIntent;
  trackPresenceTransition: boolean;
  verificationMode:
    | "presence-transition"
    | "installer-owned-maintenance";
};

export const DESKTOP_INSTALL_INTENTS: readonly DesktopInstallIntent[];

export function resolveDesktopInstallerLaunchPolicy(
  intent?: unknown
): DesktopInstallerLaunchPolicy | null;

export type TrustedDesktopInstallerLaunchPolicy =
  | ({
      ok: true;
      requestedIntent: DesktopInstallIntent;
    } & DesktopInstallerLaunchPolicy)
  | {
      ok: false;
      errorCode:
        | "INVALID_INSTALL_INTENT"
        | "PRODUCT_PRESENCE_UNKNOWN"
        | "PRODUCT_ALREADY_INSTALLED";
    };

export function resolveTrustedDesktopInstallerLaunchPolicy(
  intent: unknown,
  presence: { installed?: unknown; detection?: unknown } | null
): TrustedDesktopInstallerLaunchPolicy;

export function resolveCompletedPackageInstallIntent(input: {
  requestedIntent?: unknown;
  installed: boolean;
}): DesktopInstallIntent | null;
