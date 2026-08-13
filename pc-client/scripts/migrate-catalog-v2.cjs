"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizeCatalog, validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((entry) => path.resolve(entry))
  : [
      path.join(root, "admin", "data", "catalog-v1.json"),
      path.join(root, "catalog", "catalog-v1.example.json")
    ];

const correctedTypes = Object.freeze({
  "anthropic-official-plugin-marketplace": ["plugin"],
  "comfy-custom-nodes": ["plugin"],
  "google-gemini-cli-extensions": ["plugin"],
  "moonshot-kimi-plugins": ["plugin"],
  "anythingllm-agent-skills": ["skill", "mcp"],
  "amazon-kiro-powers": ["plugin"],
  "pika-mcp-skills": ["mcp", "skill"],
  "openclaw-clawhub-plugins": ["plugin"],
  "cline-official-skills-plugins": ["skill", "mcp", "plugin"]
});

function cleanLegacyResourceDescription(value) {
  return value
    .replace(
      /\s*原始形态为 [^。]+，当前按最接近的 (?:skill|mcp) 子目录展示。/g,
      ""
    )
    .trim();
}

for (const filePath of targets) {
  const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const catalog = normalizeCatalog(current);
  for (const resource of catalog.resources) {
    resource.description = cleanLegacyResourceDescription(resource.description);
    if (correctedTypes[resource.id]) {
      resource.resourceTypes = [...correctedTypes[resource.id]];
    }
  }
  validateCatalog(catalog);
  fs.writeFileSync(filePath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  process.stdout.write(`Migrated ${filePath}\n`);
}
