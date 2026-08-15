"use strict";

const MODES = new Set(["automatic", "external", "migrate"]);

function identitySchemaMode(env = process.env) {
  const mode = String(env.AIHUB_IDENTITY_SCHEMA_MODE || "automatic").trim();
  if (!MODES.has(mode)) throw new Error("identity schema mode is invalid");
  return mode;
}

module.exports = { identitySchemaMode };
