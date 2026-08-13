"use strict";

const PROCESS_NAME_PATTERN = /^[a-z0-9 ._-]+\.exe$/i;

function normalizeProcessNames(processNames) {
  const names = Array.isArray(processNames)
    ? [...new Set(processNames)]
    : [];
  if (
    !names.length ||
    names.some(
      (name) =>
        typeof name !== "string" ||
        name.includes("/") ||
        name.includes("\\") ||
        !PROCESS_NAME_PATTERN.test(name)
    )
  ) {
    return null;
  }
  return names;
}

async function closeReviewedProcesses({
  processNames,
  strategy = "graceful",
  runTaskkill,
  isProcessRunning,
  wait = () => Promise.resolve()
}) {
  const names = normalizeProcessNames(processNames);
  if (
    !names ||
    !["graceful", "force-after-grace"].includes(strategy) ||
    typeof runTaskkill !== "function" ||
    typeof isProcessRunning !== "function" ||
    typeof wait !== "function"
  ) {
    return { ok: false, error: "该产品没有经过审核的关闭策略" };
  }

  let closed = false;
  for (const name of names) {
    const graceful = await runTaskkill(name, false);
    if (!graceful.ok && !graceful.notRunning) {
      return { ok: false, error: graceful.error || `无法关闭 ${name}` };
    }
    closed ||= graceful.ok;

    await wait(500);
    let running = await isProcessRunning(name);
    if (running && strategy === "force-after-grace") {
      const forced = await runTaskkill(name, true);
      if (!forced.ok && !forced.notRunning) {
        return { ok: false, error: forced.error || `无法强制关闭 ${name}` };
      }
      closed ||= forced.ok;
      await wait(500);
      running = await isProcessRunning(name);
    }
    if (running) {
      return { ok: false, error: `${name} 仍在运行，请关闭后重试` };
    }
  }
  return { ok: true, closed };
}

module.exports = {
  closeReviewedProcesses,
  normalizeProcessNames
};
