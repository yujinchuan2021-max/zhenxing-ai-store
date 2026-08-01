"use strict";

function localReleaseCommandResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError("Local release command result is invalid");
  }
  const cleanupPending = Object.entries(result).some(
    ([name, value]) => /cleanupPending$/i.test(name) && value === true
  );
  return {
    ...result,
    ok: !cleanupPending
  };
}

module.exports = {
  localReleaseCommandResult
};
