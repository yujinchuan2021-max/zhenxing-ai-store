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

export type DownloadPopoverItem = {
  id: string;
  productId: string;
  name: string;
  source: "queue" | "legacy";
  phase: string;
  state: "active" | "failed" | "completed";
  percent: number | null;
};

export function buildDownloadPopoverItems(input?: {
  names?: Record<string, string>;
  queueTasks?: Record<string, ManagedDownloadQueueTask>;
  legacyTasks?: Record<string, ManagedDownloadTask>;
}): {
  activeCount: number;
  totalCount: number;
  items: DownloadPopoverItem[];
};
