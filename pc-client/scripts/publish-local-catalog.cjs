"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.resolve(root, process.argv[2] || "admin/data/catalog-v1.json");
const statePath = path.join(root, "admin", "published", "catalog-store", "state.json");
const composePath = path.join(root, "deployment", "local", "compose.yaml");
const origin = "http://127.0.0.1:4173";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function request(pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname}: HTTP ${response.status} ${text}`);
  return JSON.parse(text);
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const health = await request("/health");
      if (health.status === "ok") return;
    } catch {
      // The rebuilt container is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("重建后的后台未在 45 秒内开始监听");
}

async function main() {
  const desired = validateCatalog(structuredClone(readJson(catalogPath)));
  const state = readJson(statePath);
  const expectedRevision = state?.draft?.revision || 0;
  const expectedActiveCatalogVersion = state?.activeCatalogVersion || 0;
  if (!Number.isSafeInteger(expectedRevision) || !Number.isSafeInteger(expectedActiveCatalogVersion)) {
    throw new Error("目录发布状态缺少有效版本号");
  }

  execFileSync("docker", ["compose", "-f", composePath, "build", "admin"], { cwd: root, stdio: "inherit" });
  execFileSync("docker", ["compose", "-f", composePath, "up", "-d", "admin"], { cwd: root, stdio: "inherit" });
  await waitForHealth();

  const headers = {
    "content-type": "application/json",
    origin,
    "x-aihub-admin": "1"
  };
  const saved = await request("/api/catalog", {
    method: "PUT",
    headers,
    body: JSON.stringify({ catalog: desired, expectedRevision })
  });
  const validation = await request("/api/validate", { method: "POST", headers, body: "{}" });
  if (validation.ok !== true) throw new Error("后台目录校验没有通过");
  const published = await request("/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedDraftRevision: saved.revision,
      expectedActiveCatalogVersion
    })
  });
  const ready = await request("/ready");
  if (ready.draftRevision !== saved.revision || ready.activeCatalogVersion !== published.catalogVersion) {
    throw new Error("发布后版本与后台就绪状态不一致");
  }
  console.log(JSON.stringify({ saved, validation, published, ready }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
