export type ManagedInstallPreparation =
  | "active"
  | "blocked"
  | "ready"
  | "downloaded"
  | "installed"
  | "error";

export function runVerifiedManagedInstall(input: {
  detect(): Promise<ManagedInstallPreparation>;
  setupDependencies(): Promise<unknown>;
  continueInstall(
    preparation: "ready" | "downloaded"
  ): Promise<unknown>;
}): Promise<ManagedInstallPreparation>;
