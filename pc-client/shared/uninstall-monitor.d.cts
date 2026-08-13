export type UninstallMonitorStatus = {
  installed: boolean;
  detection: "installed" | "absent" | "unknown";
  [key: string]: unknown;
};

export type UninstallMonitorResult<T extends UninstallMonitorStatus> = {
  outcome: "uninstalled" | "timeout" | "canceled";
  attempts: number;
  desktopStatus: T | null;
};

export function waitForUninstallation<T extends UninstallMonitorStatus>(options: {
  check: () => Promise<T>;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<unknown>;
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onAttempt?: (status: T | null, attempt: number, error: unknown) => void;
}): Promise<UninstallMonitorResult<T>>;
