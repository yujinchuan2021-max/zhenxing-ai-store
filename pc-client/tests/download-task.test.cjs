const assert = require("node:assert/strict");
const test = require("node:test");

const {
  applyDownloadTaskEvent,
  restoreDownloadTask
} = require("../shared/download-task.cjs");

const times = [
  "2026-07-29T01:00:00.000Z",
  "2026-07-29T01:00:01.000Z",
  "2026-07-29T01:00:02.000Z",
  "2026-07-29T01:00:03.000Z",
  "2026-07-29T01:00:04.000Z",
  "2026-07-29T01:00:05.000Z",
  "2026-07-29T01:00:06.000Z",
  "2026-07-29T01:00:07.000Z",
  "2026-07-29T01:00:08.000Z",
  "2026-07-29T01:00:09.000Z"
];

function at(index) {
  return { now: () => times[index] };
}

function startTask(attemptId = "attempt-1") {
  const result = applyDownloadTaskEvent(
    null,
    {
      type: "start",
      productId: "ollama",
      attemptId
    },
    at(0)
  );
  assert.equal(result.accepted, true);
  return result.task;
}

function progress(receivedBytes, overrides = {}) {
  return {
    receivedBytes,
    totalBytes: 1_000,
    bytesPerSecond: 200,
    etaSeconds: 4,
    percent: receivedBytes / 10,
    availableBytes: 10_000,
    requiredBytes: 2_000,
    remainingBytes: 1_000 - receivedBytes,
    reserveBytes: 1_000,
    installDiskBytes: 15_000,
    installAvailableBytes: 20_000,
    downloadDirectory: "C:\\Downloads",
    installSpaceOk: true,
    spaceOk: true,
    ...overrides
  };
}

test("pauses safely before the first byte arrives", () => {
  const started = startTask();
  const pausing = applyDownloadTaskEvent(
    started,
    { type: "pause-requested", attemptId: "attempt-1" },
    at(1)
  );
  const paused = applyDownloadTaskEvent(
    pausing.task,
    {
      type: "pause",
      attemptId: "attempt-1",
      resumable: false
    },
    at(2)
  );

  assert.equal(pausing.accepted, true);
  assert.equal(pausing.task.phase, "pausing");
  assert.equal(paused.accepted, true);
  assert.equal(paused.task.phase, "paused");
  assert.equal(paused.task.resumable, false);
  assert.equal(paused.task.progress.receivedBytes, 0);
  assert.deepEqual(paused.task.logs, [
    "开始下载",
    "正在暂停下载",
    "下载已暂停"
  ]);
});

test("records an active pause without logging each progress update", () => {
  const started = startTask();
  const downloading = applyDownloadTaskEvent(
    started,
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(400)
    },
    at(1)
  );
  const pausing = applyDownloadTaskEvent(
    downloading.task,
    { type: "pause-requested", attemptId: "attempt-1" },
    at(2)
  );
  const paused = applyDownloadTaskEvent(
    pausing.task,
    {
      type: "pause",
      attemptId: "attempt-1",
      resumable: true,
      progress: progress(420)
    },
    at(3)
  );

  assert.equal(downloading.task.phase, "downloading");
  assert.equal(downloading.task.revision, started.revision + 1);
  assert.deepEqual(downloading.task.logs, started.logs);
  assert.equal(paused.task.phase, "paused");
  assert.equal(paused.task.resumable, true);
  assert.equal(paused.task.progress.receivedBytes, 420);
});

test("keeps updatedAt monotonic when the injected clock moves backward", () => {
  const started = startTask();
  const result = applyDownloadTaskEvent(
    started,
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(100)
    },
    { now: () => "2026-07-28T23:59:59.000Z" }
  );

  assert.equal(result.accepted, true);
  assert.equal(result.task.revision, started.revision + 1);
  assert.equal(result.task.updatedAt, started.updatedAt);
});

test("distinguishes resumable and non-resumable failures", () => {
  const downloading = applyDownloadTaskEvent(
    startTask(),
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(300)
    },
    at(1)
  ).task;

  const resumableFailure = applyDownloadTaskEvent(
    downloading,
    {
      type: "failed",
      attemptId: "attempt-1",
      resumable: true,
      errorCode: "NETWORK_RESET",
      errorMessage: "网络连接中断",
      progress: progress(320)
    },
    at(2)
  );
  const cleanFailure = applyDownloadTaskEvent(
    startTask("attempt-clean"),
    {
      type: "failed",
      attemptId: "attempt-clean",
      resumable: false,
      errorCode: "NO_RANGE",
      errorMessage: "服务器不支持断点续传"
    },
    at(1)
  );

  assert.equal(resumableFailure.task.phase, "failed");
  assert.equal(resumableFailure.task.resumable, true);
  assert.equal(
    resumableFailure.task.logs.at(-1),
    "下载失败，可继续"
  );
  assert.equal(cleanFailure.task.phase, "failed");
  assert.equal(cleanFailure.task.resumable, false);
  assert.equal(
    cleanFailure.task.logs.at(-1),
    "下载失败，需重新下载"
  );
});

test("cancels a task through canceling and discards resumability", () => {
  const downloading = applyDownloadTaskEvent(
    startTask(),
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(250)
    },
    at(1)
  ).task;
  const canceling = applyDownloadTaskEvent(
    downloading,
    { type: "cancel-requested", attemptId: "attempt-1" },
    at(2)
  );
  const canceled = applyDownloadTaskEvent(
    canceling.task,
    { type: "cancel", attemptId: "attempt-1" },
    at(3)
  );

  assert.equal(canceling.task.phase, "canceling");
  assert.equal(canceled.task.phase, "canceled");
  assert.equal(canceled.task.resumable, false);
  assert.equal(canceled.task.filePath, null);
  assert.deepEqual(canceled.task.logs.slice(-2), [
    "正在取消下载",
    "下载已取消"
  ]);
});

test("turns an explicit cancel cleanup failure into a retryable failed task", () => {
  const canceling = applyDownloadTaskEvent(
    startTask(),
    { type: "cancel-requested", attemptId: "attempt-1" },
    at(1)
  ).task;
  const ordinaryFailure = applyDownloadTaskEvent(
    canceling,
    {
      type: "failed",
      attemptId: "attempt-1",
      resumable: true,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage: "cleanup failed"
    },
    at(2)
  );
  const cleanupFailure = applyDownloadTaskEvent(
    canceling,
    {
      type: "cancel-cleanup-failed",
      attemptId: "attempt-1",
      resumable: true,
      errorCode: "CANCEL_CLEANUP_FAILED",
      errorMessage: "cleanup failed"
    },
    at(2)
  );

  assert.equal(ordinaryFailure.accepted, false);
  assert.equal(ordinaryFailure.task.phase, "canceling");
  assert.equal(cleanupFailure.accepted, true);
  assert.equal(cleanupFailure.task.phase, "failed");
  assert.equal(cleanupFailure.task.resumable, true);
  assert.equal(cleanupFailure.task.errorCode, "CANCEL_CLEANUP_FAILED");
});

test("recovers trusted completion evidence from canceling without broadening completion", () => {
  const canceling = applyDownloadTaskEvent(
    startTask(),
    { type: "cancel-requested", attemptId: "attempt-1" },
    at(1)
  ).task;
  const artifact = {
    attemptId: "attempt-1",
    progress: progress(1_000, {
      bytesPerSecond: 0,
      etaSeconds: 0,
      percent: 100,
      remainingBytes: 0
    }),
    filePath: "C:\\Downloads\\OllamaSetup.exe",
    sha256: "verified-sha256",
    fileSize: 1_000
  };
  const ordinaryCompletion = applyDownloadTaskEvent(
    canceling,
    { type: "completed", ...artifact },
    at(2)
  );
  const recovered = applyDownloadTaskEvent(
    canceling,
    { type: "recover-completed", ...artifact },
    at(2)
  );

  assert.equal(ordinaryCompletion.accepted, false);
  assert.equal(ordinaryCompletion.task.phase, "canceling");
  assert.equal(recovered.accepted, true);
  assert.equal(recovered.task.phase, "completed");
  assert.equal(recovered.task.filePath, artifact.filePath);
});

test("retry creates a new attempt and rejects every late old-attempt event", () => {
  const failed = applyDownloadTaskEvent(
    startTask(),
    {
      type: "failed",
      attemptId: "attempt-1",
      resumable: false,
      errorCode: "OFFLINE",
      errorMessage: "网络不可用"
    },
    at(1)
  ).task;
  const retried = applyDownloadTaskEvent(
    failed,
    {
      type: "retry",
      attemptId: "attempt-2"
    },
    at(2)
  );

  assert.equal(retried.accepted, true);
  assert.equal(retried.task.attemptId, "attempt-2");
  assert.equal(retried.task.attempt, 2);
  assert.equal(retried.task.phase, "starting");
  assert.equal(retried.task.progress.receivedBytes, 0);
  assert.equal(retried.task.errorCode, null);
  assert.equal(retried.task.errorMessage, null);

  const staleEvents = [
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(500)
    },
    {
      type: "pause",
      attemptId: "attempt-1",
      resumable: true
    },
    {
      type: "failed",
      attemptId: "attempt-1",
      resumable: true,
      errorMessage: "旧请求失败"
    },
    { type: "cancel", attemptId: "attempt-1" },
    {
      type: "completed",
      attemptId: "attempt-1",
      filePath: "C:\\Downloads\\old.exe",
      sha256: "old-digest",
      fileSize: 1_000
    }
  ];

  for (const event of staleEvents) {
    const result = applyDownloadTaskEvent(retried.task, event, at(3));
    assert.equal(result.accepted, false, event.type);
    assert.equal(result.task, retried.task, event.type);
  }

  const freshProgress = applyDownloadTaskEvent(
    retried.task,
    {
      type: "progress",
      attemptId: "attempt-2",
      progress: progress(100)
    },
    at(3)
  );
  assert.equal(freshProgress.accepted, true);
  assert.equal(freshProgress.task.phase, "downloading");
});

test("completes with a verified artifact snapshot", () => {
  const downloading = applyDownloadTaskEvent(
    startTask(),
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(900)
    },
    at(1)
  ).task;
  const completed = applyDownloadTaskEvent(
    downloading,
    {
      type: "completed",
      attemptId: "attempt-1",
      progress: progress(1_000, {
        bytesPerSecond: 0,
        etaSeconds: 0,
        percent: 100,
        remainingBytes: 0
      }),
      filePath: "C:\\Downloads\\OllamaSetup.exe",
      sha256: "verified-sha256",
      fileSize: 1_000
    },
    at(2)
  );

  assert.equal(completed.accepted, true);
  assert.equal(completed.task.phase, "completed");
  assert.equal(completed.task.resumable, false);
  assert.equal(completed.task.progress.percent, 100);
  assert.equal(completed.task.filePath, "C:\\Downloads\\OllamaSetup.exe");
  assert.equal(completed.task.sha256, "verified-sha256");
  assert.equal(completed.task.fileSize, 1_000);
  assert.equal(completed.task.logs.at(-1), "下载完成");
});

test("keeps only the latest 40 status logs", () => {
  const current = {
    ...startTask(),
    logs: Array.from({ length: 40 }, (_, index) => `状态 ${index + 1}`)
  };
  const result = applyDownloadTaskEvent(
    current,
    { type: "pause-requested", attemptId: "attempt-1" },
    at(1)
  );

  assert.equal(result.accepted, true);
  assert.equal(result.task.logs.length, 40);
  assert.equal(result.task.logs[0], "状态 2");
  assert.equal(result.task.logs.at(-1), "正在暂停下载");
});

test("restores valid snapshots and rejects damaged persisted records", () => {
  const valid = applyDownloadTaskEvent(
    startTask(),
    {
      type: "progress",
      attemptId: "attempt-1",
      progress: progress(125)
    },
    at(1)
  ).task;
  const restored = restoreDownloadTask(JSON.parse(JSON.stringify(valid)));

  assert.deepEqual(restored, valid);
  assert.notEqual(restored, valid);
  assert.notEqual(restored.progress, valid.progress);
  assert.notEqual(restored.logs, valid.logs);

  const damagedRecords = [
    null,
    { ...valid, schemaVersion: 2 },
    { ...valid, productId: "" },
    { ...valid, attempt: 0 },
    { ...valid, revision: -1 },
    { ...valid, phase: "mystery" },
    { ...valid, progress: { ...valid.progress, receivedBytes: -1 } },
    { ...valid, progress: { ...valid.progress, percent: 101 } },
    { ...valid, updatedAt: "not-a-date" },
    { ...valid, logs: [...valid.logs, ...Array(40).fill("overflow")] },
    { ...valid, phase: "completed" },
    { ...valid, phase: "failed", errorMessage: null }
  ];

  for (const damaged of damagedRecords) {
    assert.equal(restoreDownloadTask(damaged), null);
  }
});
