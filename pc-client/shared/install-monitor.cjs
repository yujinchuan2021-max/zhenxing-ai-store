function delay(milliseconds, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, milliseconds);
    function onAbort() {
      clearTimeout(timer);
      resolve(false);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForInstallation({
  check,
  wait = delay,
  intervalMs = 2500,
  maxAttempts = 240,
  signal,
  onAttempt
}) {
  if (typeof check !== "function" || typeof wait !== "function") {
    throw new Error("安装监控参数无效");
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("安装监控次数无效");
  }

  let lastStatus = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return { outcome: "canceled", attempts: attempt - 1, desktopStatus: lastStatus };
    }
    let error = null;
    try {
      lastStatus = await check();
    } catch (candidate) {
      error = candidate;
    }
    onAttempt?.(lastStatus, attempt, error);
    if (lastStatus?.installed) {
      return {
        outcome: "installed",
        attempts: attempt,
        desktopStatus: lastStatus
      };
    }
    if (attempt < maxAttempts) {
      const completed = await wait(intervalMs, signal);
      if (completed === false || signal?.aborted) {
        return {
          outcome: "canceled",
          attempts: attempt,
          desktopStatus: lastStatus
        };
      }
    }
  }
  return {
    outcome: "timeout",
    attempts: maxAttempts,
    desktopStatus: lastStatus
  };
}

module.exports = { waitForInstallation };
