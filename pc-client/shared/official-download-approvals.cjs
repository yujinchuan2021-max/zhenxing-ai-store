"use strict";

// These are reviewed, immutable external entrypoints. They authorize opening
// exactly this URL for an official stable redirect; they do not authorize a
// download task, command, credentials, or a host-wide redirect policy.
const APPROVED_OFFICIAL_DOWNLOAD_SOURCES = Object.freeze({
  "fireflies-desktop": Object.freeze([
    "https://m.fireflies.ai/desktop/releases/download?platform=windows"
  ]),
  "pieces-for-developers": Object.freeze([
    "https://builds.pieces.app/stages/production/pieces_for_x/windows-exe/download?download=true&product=DOCUMENTATION_WEBSITE"
  ]),
  "zoom-workplace": Object.freeze([
    "https://zoom.us/client/latest/ZoomInstaller.exe?archType=x64"
  ])
});

function getApprovedOfficialDownloadSources(productId) {
  return APPROVED_OFFICIAL_DOWNLOAD_SOURCES[productId] || Object.freeze([]);
}

module.exports = {
  APPROVED_OFFICIAL_DOWNLOAD_SOURCES,
  getApprovedOfficialDownloadSources
};
