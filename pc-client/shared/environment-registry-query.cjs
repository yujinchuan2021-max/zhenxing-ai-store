"use strict";

function isMissingExactRegistryValueQuery(error) {
  return Boolean(
    error &&
      error.code === 1 &&
      error.killed !== true &&
      error.timedOut !== true &&
      !error.signal
  );
}

module.exports = { isMissingExactRegistryValueQuery };
