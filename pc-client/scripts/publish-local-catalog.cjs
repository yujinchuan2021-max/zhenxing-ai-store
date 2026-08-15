"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.join(__dirname, "..");
const catalogPath = path.resolve(
  root,
  process.argv[2] || "admin/data/catalog-v1.json"
);
const statePath = path.join(
  root,
  "admin",
  "published",
  "catalog-store",
  "state.json"
);
const composePath = path.join(root, "deployment", "local", "compose.yaml");
const origin = "http://127.0.0.1:4173";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function request(pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname}: HTTP ${response.status} ${text}`);
  }
  return JSON.parse(text);
}

function requireRunningAdmin() {
  const containerId = String(
    execFileSync(
      "docker",
      [
        "compose",
        "-f",
        composePath,
        "ps",
        "--status",
        "running",
        "-q",
        "admin"
      ],
      { cwd: root, encoding: "utf8", windowsHide: true }
    )
  ).trim();
  if (!/^[a-f0-9]{64}$/.test(containerId)) {
    throw new Error(
      "The existing local admin service must be running before catalog publication"
    );
  }
  return containerId;
}

async function requireHealthyAdmin() {
  requireRunningAdmin();
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const health = await request("/health");
      if (health.status === "ok") return;
      lastError = new Error("The local admin service returned an unhealthy status");
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `The existing local admin service is not healthy: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`
  );
}

async function main() {
  execFileSync(
    process.execPath,
    [path.join(root, "scripts", "verify-local-service-topology.cjs")],
    { cwd: root, stdio: "inherit", windowsHide: true }
  );
  execFileSync(
    process.execPath,
    [
      path.join(root, "scripts", "verify-live-local-service-source.cjs"),
      "--service",
      "admin"
    ],
    { cwd: root, stdio: "inherit", windowsHide: true }
  );
  const desired = validateCatalog(structuredClone(readJson(catalogPath)));
  const state = readJson(statePath);
  const expectedRevision = state?.draft?.revision || 0;
  const expectedActiveCatalogVersion = state?.activeCatalogVersion || 0;
  if (
    !Number.isSafeInteger(expectedRevision) ||
    !Number.isSafeInteger(expectedActiveCatalogVersion)
  ) {
    throw new Error("Catalog publication state is missing valid version numbers");
  }

  // Catalog data is bind-mounted into admin. Publishing must not rebuild or
  // recreate application-code containers outside the service-image transaction.
  await requireHealthyAdmin();

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
  const validation = await request("/api/validate", {
    method: "POST",
    headers,
    body: "{}"
  });
  if (validation.ok !== true) {
    throw new Error("Backend catalog validation did not pass");
  }
  const published = await request("/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedDraftRevision: saved.revision,
      expectedActiveCatalogVersion
    })
  });
  const ready = await request("/ready");
  if (
    ready.draftRevision !== saved.revision ||
    ready.activeCatalogVersion !== published.catalogVersion
  ) {
    throw new Error("Published catalog versions differ from backend ready state");
  }
  console.log(JSON.stringify({ saved, validation, published, ready }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
