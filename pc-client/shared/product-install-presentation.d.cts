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
