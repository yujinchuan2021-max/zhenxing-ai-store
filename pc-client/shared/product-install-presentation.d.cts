export type ProductInstallPresentation = {
  filePath: string;
  buttonLabel: string;
  disabled: boolean;
  showHash: boolean;
  showTaskLog: boolean;
};

export function getProductInstallPresentation(input: {
  stage: string;
  filePath?: string;
}): ProductInstallPresentation | null;

export type ProductDownloadRecoveryPresentation = {
  messageKey: "download.connectionFailed" | null;
  actions: Array<"retry" | "resume" | "relocate" | "cancel">;
};

export function getDownloadTaskPreparation(
  downloadTask?: {
    phase: string;
    resumable?: boolean;
  } | null
): "active" | "ready" | "downloaded" | null;

export function getProductDownloadRecoveryPresentation(input: {
  stage: string;
  downloadTask?: {
    phase: string;
    resumable?: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null;
}): ProductDownloadRecoveryPresentation | null;
