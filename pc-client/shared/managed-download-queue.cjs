"use strict";

const DEFAULT_CONCURRENCY = 3;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 4;
const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;

function publicJob(job) {
  return Object.freeze({
    id: job.id,
    phase: job.phase,
    ...(job.errorCode ? { errorCode: job.errorCode } : {})
  });
}

function createManagedDownloadQueue({ concurrency = DEFAULT_CONCURRENCY, start } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < MIN_CONCURRENCY || concurrency > MAX_CONCURRENCY ||
      typeof start !== "function") {
    throw new TypeError("managed download queue options are invalid");
  }

  const jobs = new Map();
  const pending = [];
  const active = new Set();
  function pump() {
    while (active.size < concurrency && pending.length) {
      const id = pending.shift();
      const job = jobs.get(id);
      if (!job || job.phase !== "queued") continue;
      active.add(id);
      job.phase = "downloading";
      job.controller = new AbortController();
      Promise.resolve(start({
        id: job.id,
        ...job.input,
        signal: job.controller.signal,
        controller: job.controller
      })).then(
        (result) => {
          const resultPhase = typeof result?.phase === "string" ? result.phase : "downloaded";
          job.phase = resultPhase === "failed"
            ? "failed"
            : job.controller.signal.aborted || resultPhase === "canceled" || resultPhase === "cancelled"
              ? "cancelled"
              : resultPhase;
          job.errorCode = "";
        },
        (error) => {
          job.phase = job.controller.signal.aborted ? "cancelled" : "failed";
          job.errorCode = typeof error?.code === "string" ? error.code : "DOWNLOAD_FAILED";
        }
      ).finally(() => {
        job.controller = null;
        active.delete(id);
        pump();
      });
    }
  }

  function enqueue(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) || !ID.test(String(input.id || ""))) {
      return Object.freeze({ accepted: false, errorCode: "INPUT_INVALID" });
    }
    const existing = jobs.get(input.id);
    if (existing && (existing.phase === "queued" || active.has(input.id))) {
      return Object.freeze({ accepted: true, reused: true, task: publicJob(existing) });
    }
    const job = existing && (existing.phase === "failed" || existing.phase === "cancelled")
      ? existing
      : { id: input.id, input: null, phase: "queued", errorCode: "", controller: null };
    job.input = { ...input };
    delete job.input.id;
    job.phase = "queued";
    job.errorCode = "";
    jobs.set(job.id, job);
    pending.push(job.id);
    pump();
    return Object.freeze({ accepted: true, reused: false, task: publicJob(job) });
  }

  function cancel(id) {
    const job = jobs.get(id);
    if (!job || !ID.test(String(id || ""))) return Object.freeze({ accepted: false, errorCode: "TASK_NOT_FOUND" });
    if (job.phase === "queued") {
      const index = pending.indexOf(id);
      if (index >= 0) pending.splice(index, 1);
      job.phase = "cancelled";
      return Object.freeze({ accepted: true, task: publicJob(job) });
    }
    if (active.has(id) && job.controller) {
      job.controller.abort();
      return Object.freeze({ accepted: true, task: publicJob(job) });
    }
    return Object.freeze({ accepted: false, errorCode: "TASK_NOT_CANCELLABLE", task: publicJob(job) });
  }

  return Object.freeze({
    enqueue,
    cancel,
    status(id) {
      const job = jobs.get(id);
      return job ? publicJob(job) : null;
    },
    list() {
      return Object.freeze([...jobs.values()].map(publicJob));
    },
    dispose() {
      for (const id of [...pending]) cancel(id);
      for (const id of [...active]) cancel(id);
    }
  });
}

module.exports = {
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  MIN_CONCURRENCY,
  createManagedDownloadQueue
};
