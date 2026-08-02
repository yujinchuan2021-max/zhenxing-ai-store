"use strict";

const LOCAL_RELEASE_ARTIFACT =
  /^ZhenXing-AI-Local-(\d+\.\d+\.\d+)-(?:BUILD\.json|SHA256\.txt|Windows-x64-(?:Portable\.exe|Setup\.exe(?:\.blockmap)?))$/;
const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

function supersededLocalReleaseArtifacts(fileNames, currentVersion) {
  if (!Array.isArray(fileNames) || !RELEASE_VERSION.test(currentVersion || "")) {
    throw new TypeError("Local release artifact input is invalid");
  }
  return fileNames.filter((name) => {
    if (typeof name !== "string" || /[\\/]/.test(name)) return false;
    const match = LOCAL_RELEASE_ARTIFACT.exec(name);
    return Boolean(match && match[1] !== currentVersion);
  });
}

function formatLocalReleaseChecksums(entries) {
  if (!Array.isArray(entries) || entries.length < 1) {
    throw new TypeError("Local release checksum entries are invalid");
  }
  return entries
    .map((entry) => {
      if (
        !entry ||
        typeof entry.name !== "string" ||
        /[\\/]/.test(entry.name) ||
        !/^[a-f0-9]{64}$/i.test(entry.sha256 || "")
      ) {
        throw new TypeError("Local release checksum entry is invalid");
      }
      return `${entry.sha256.toUpperCase()}  ${entry.name}`;
    })
    .join("\n") + "\n";
}

module.exports = {
  formatLocalReleaseChecksums,
  supersededLocalReleaseArtifacts
};
