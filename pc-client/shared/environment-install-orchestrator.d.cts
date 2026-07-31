export type EnvironmentInstallFlowSnapshot = {
  activeEnvironmentId: string;
  queuedEnvironmentIds: readonly string[];
  pendingProductIds: readonly string[];
};

export type EnvironmentInstallOrchestrator = {
  enqueue(
    productId: string,
    requirements: readonly string[]
  ): EnvironmentInstallFlowSnapshot;
  next(installedIds: readonly string[]): string;
  complete(environmentId: string): EnvironmentInstallFlowSnapshot;
  readyProducts(installedIds: readonly string[]): string[];
  fail(environmentId: string): string[];
  snapshot(): EnvironmentInstallFlowSnapshot;
};

export function createEnvironmentInstallOrchestrator(): EnvironmentInstallOrchestrator;
