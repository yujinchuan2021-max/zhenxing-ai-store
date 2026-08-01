"use strict";

async function runVerifiedManagedInstall({
  detect,
  setupDependencies,
  continueInstall
}) {
  if (
    typeof detect !== "function" ||
    typeof setupDependencies !== "function" ||
    typeof continueInstall !== "function"
  ) {
    throw new TypeError("verified managed install configuration is invalid");
  }

  // Renderer presentation state is deliberately absent from this execution
  // boundary. Every click must start with fresh product and dependency checks.
  const preparation = await detect();
  if (preparation === "blocked") {
    await setupDependencies();
  } else if (preparation === "ready" || preparation === "downloaded") {
    await continueInstall(preparation);
  }
  return preparation;
}

module.exports = { runVerifiedManagedInstall };
