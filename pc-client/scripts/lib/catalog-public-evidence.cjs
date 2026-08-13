"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROTECTED_SEGMENT = /^(?:private|secret|secrets|protected)$/i;
const PROTECTED_EXTENSION = /\.(?:pem|key|p12|pfx|jwk|env)$/i;

function normalizedRelative(value) {
  if (typeof value !== "string" || !value || path.isAbsolute(value)) throw new Error("EVIDENCE_PATH_INVALID");
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || PROTECTED_SEGMENT.test(segment)) || PROTECTED_EXTENSION.test(segments.at(-1))) {
    throw new Error("EVIDENCE_PATH_PROTECTED");
  }
  return segments.join("/");
}

function createPublicEvidenceCollector({ rootDirectory, allowedPaths, readFile = fs.readFileSync }) {
  const root = fs.realpathSync(path.resolve(rootDirectory));
  const allowed = new Set((allowedPaths || []).map(normalizedRelative));
  let readCount = 0;
  return Object.freeze({
    read(relativePath) {
      const relative = normalizedRelative(relativePath);
      if (!allowed.has(relative)) throw new Error("EVIDENCE_ALLOWLIST_REJECTED");
      const target = path.resolve(root, relative);
      if (!target.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error("EVIDENCE_PATH_INVALID");
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(target).toLowerCase() !== target.toLowerCase()) throw new Error("EVIDENCE_FILE_INVALID");
      const bytes = readFile(target);
      readCount += 1;
      return bytes;
    },
    get readCount() {
      return readCount;
    }
  });
}

module.exports = { createPublicEvidenceCollector };
