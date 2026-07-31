export type ManagedDownloadFailure = {
  errorCode: string;
  errorMessage: string;
};

export function isRetryableManagedDownloadError(error: unknown): boolean;

export function fetchManagedDownloadResponse<T>(input: {
  fetchResponse: () => Promise<T>;
  refreshNetwork?: (input: {
    retryNumber: number;
    error: unknown;
  }) => Promise<unknown>;
  retries?: number;
}): Promise<T>;

export function managedDownloadFailure(error: unknown): ManagedDownloadFailure;

export function refreshManagedDownloadSession(input: {
  networkSession: {
    setProxy(config: Record<string, string>): Promise<unknown>;
    forceReloadProxyConfig(): Promise<unknown>;
    closeAllConnections(): Promise<unknown>;
  };
}): Promise<void>;
