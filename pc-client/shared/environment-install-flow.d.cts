export type EnvironmentInstallStage = "idle" | "downloading" | "ready";

export type EnvironmentInstallResult = {
  downloaded: boolean;
  filePath?: string;
  source?: string;
  message?: string;
  error?: string;
};

export function runEnvironmentInstall(input: {
  environmentId: string;
  client: {
    installEnvironment(environmentId: string): Promise<EnvironmentInstallResult>;
  };
  onState(state: {
    stage: EnvironmentInstallStage;
    message: string;
  }): void;
}): Promise<EnvironmentInstallResult>;
