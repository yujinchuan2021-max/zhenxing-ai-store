"use strict";

const path = require("node:path");

const OFFICIAL_IMAGES = Object.freeze([
  Object.freeze({ name: "postgres", ref: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193" }),
  Object.freeze({ name: "mariadb", ref: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4" }),
  Object.freeze({ name: "caddy", ref: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d" })
]);
const FAILURE_STAGES = new Set(OFFICIAL_IMAGES.flatMap(({ name }) => [
  `official-image-export-${name}-inspect`,
  `official-image-export-${name}-save`,
  `official-image-export-${name}-archive`
]));

function fail(stage) {
  throw Object.assign(new Error("r12 official image export blocked"), { stage });
}
function call(docker, args, stage) {
  let result;
  try { result = docker(args); } catch { fail(stage); }
  if (!result || result.status !== 0) fail(stage);
}
function exportOfficialImages({ docker, archiveDirectory, statSync }) {
  for (const image of OFFICIAL_IMAGES) {
    const archive = path.join(archiveDirectory, `${image.name}.tar`);
    call(docker, ["image", "inspect", image.ref], `official-image-export-${image.name}-inspect`);
    call(docker, ["save", "--output", archive, image.ref], `official-image-export-${image.name}-save`);
    let stats;
    try { stats = statSync(archive); } catch { fail(`official-image-export-${image.name}-archive`); }
    if (!stats || !stats.isFile()) fail(`official-image-export-${image.name}-archive`);
  }
}
function isOfficialImageExportFailureStage(stage) { return FAILURE_STAGES.has(stage); }
function officialImageExportFailureStage(stage, fallback) { return isOfficialImageExportFailureStage(stage) ? stage : fallback; }

module.exports = { OFFICIAL_IMAGES, exportOfficialImages, isOfficialImageExportFailureStage, officialImageExportFailureStage };
