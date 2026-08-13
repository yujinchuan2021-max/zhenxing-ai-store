"use strict";

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

function parseNodeVersion(value) {
  const match = String(value || "").trim().replace(/^v/, "").match(VERSION_PATTERN);
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function compareNodeVersions(left, right) {
  const a = Array.isArray(left) ? left : parseNodeVersion(left);
  const b = Array.isArray(right) ? right : parseNodeVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function validSupportedNodeRanges(value) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 8 &&
      value.every(
        (range) =>
          range &&
          typeof range === "object" &&
          Object.keys(range).length === 2 &&
          parseNodeVersion(range.minimum) &&
          parseNodeVersion(range.maximumExclusive) &&
          compareNodeVersions(range.minimum, range.maximumExclusive) < 0
      ))
  );
}

function nodeVersionSatisfiesPlan(version, plan = {}) {
  const parsed = parseNodeVersion(version);
  if (!parsed || !validSupportedNodeRanges(plan.supportedNodeRanges)) return false;
  if (Array.isArray(plan.supportedNodeRanges)) {
    return plan.supportedNodeRanges.some(
      (range) =>
        compareNodeVersions(parsed, range.minimum) >= 0 &&
        compareNodeVersions(parsed, range.maximumExclusive) < 0
    );
  }
  return (
    plan.minimumNodeMajor === undefined ||
    (Number.isInteger(plan.minimumNodeMajor) && parsed[0] >= plan.minimumNodeMajor)
  );
}

function selectCompatibleNodeRuntime(candidates, plan) {
  if (!Array.isArray(candidates)) return null;
  return (
    candidates.find((candidate) =>
      nodeVersionSatisfiesPlan(candidate?.nodeVersion, plan)
    ) || null
  );
}

module.exports = {
  compareNodeVersions,
  nodeVersionSatisfiesPlan,
  parseNodeVersion,
  selectCompatibleNodeRuntime,
  validSupportedNodeRanges
};
