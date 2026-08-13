export type MonitoredDesktopStatus = {
  installed: boolean;
  [key: string]: unknown;
};

export type InstallationMonitorResult<T extends MonitoredDesktopStatus> = {
  outcome: "installed" | "timeout" | "canceled";
  attempts: number;
  desktopStatus: T | null;
};

export function waitForInstallation<T extends MonitoredDesktopStatus>(input: {
  check(): Promise<T>;
  wait?: (
    intervalMs: number,
    signal?: AbortSignal
  ) => Promise<boolean | void>;
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onAttempt?: (
    status: T | null,
    attempt: number,
    error: unknown
  ) => void;
}): Promise<InstallationMonitorResult<T>>;
