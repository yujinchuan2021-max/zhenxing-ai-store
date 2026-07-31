export type DownloadRecordSnapshot = {
  productId: string;
  filePath: string;
  sha256: string;
  fileSize: number;
};

export function runDownloadedPackageAction<T>(input: {
  productId: string;
  getDownloadRecord(productId: string): Promise<DownloadRecordSnapshot | null>;
  install(record: DownloadRecordSnapshot): Promise<T>;
  download(): Promise<T>;
}): Promise<T>;
