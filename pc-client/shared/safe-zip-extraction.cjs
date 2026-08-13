"use strict";

const fs = require("node:fs");
const path = require("node:path");

function validateZipEntries(entries, maximumEntries) {
  if (!Array.isArray(entries) || !entries.length ||
    !Number.isSafeInteger(maximumEntries) || maximumEntries < 1 ||
    entries.length > maximumEntries) return null;
  const normalized = [];
  const seen = new Set();
  for (const raw of entries) {
    if (typeof raw !== "string" || !raw || raw.length > 512 || /[\0-\x1f]/.test(raw)) return null;
    const value = raw.replace(/\\/g, "/");
    const directory = value.endsWith("/");
    const trimmed = directory ? value.slice(0, -1) : value;
    const segments = trimmed.split("/");
    if (!trimmed || value.startsWith("/") || /^[A-Za-z]:/.test(value) ||
      segments.some((segment) => !segment || segment === "." || segment === ".." || /[:*?"<>|]/.test(segment))) return null;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    normalized.push(`${trimmed}${directory ? "/" : ""}`);
  }
  return normalized;
}

function inspectExtractedTree(root, { maximumEntries, maximumBytes, fileSystem = fs } = {}) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
    !Number.isSafeInteger(maximumEntries) || maximumEntries < 1 ||
    !Number.isSafeInteger(maximumBytes) || maximumBytes < 1) return null;
  try {
    const canonicalRoot = fileSystem.realpathSync.native(root);
    const rootStat = fileSystem.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
      path.resolve(canonicalRoot).toLowerCase() !== path.resolve(root).toLowerCase()) return null;
    const queue = [canonicalRoot];
    let entries = 0;
    let bytes = 0;
    while (queue.length) {
      const directory = queue.pop();
      for (const name of fileSystem.readdirSync(directory)) {
        entries += 1;
        if (entries > maximumEntries) return null;
        const candidate = path.join(directory, name);
        const stat = fileSystem.lstatSync(candidate);
        if (stat.isSymbolicLink()) return null;
        const canonical = fileSystem.realpathSync.native(candidate);
        const relative = path.relative(canonicalRoot, canonical);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
        if (stat.isDirectory()) queue.push(canonical);
        else if (stat.isFile()) {
          bytes += stat.size;
          if (bytes > maximumBytes) return null;
        } else return null;
      }
    }
    return { entries, bytes };
  } catch {
    return null;
  }
}

module.exports = { inspectExtractedTree, validateZipEntries };
