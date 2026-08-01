export type DownloadTaskRevision = {
  productId: string;
  attemptId: string;
  attempt: number;
  revision: number;
};

export type DownloadTaskRevisionTracker = {
  accept(
    task: DownloadTaskRevision,
    options?: { freshStart?: boolean }
  ): boolean;
  beginFreshDownload(productId: string): void;
  cancelFreshDownload(productId: string): void;
  clearProduct(productId: string): void;
};

export function createDownloadTaskRevisionTracker(): DownloadTaskRevisionTracker;
