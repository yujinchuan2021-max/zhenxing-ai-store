"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { DEFAULT_RESOURCE_STORES } = require("../shared/catalog.cjs");
const { RESOURCE_TYPES } = require("../shared/ecosystem-resources.cjs");
const catalog = require("../admin/data/catalog-v1.json");

const expectedTypes = ["skill", "mcp", "plugin", "connector"];

test("resource type, migration, admin fallback and language contracts stay aligned", () => {
  assert.deepEqual([...RESOURCE_TYPES], expectedTypes);
  assert.deepEqual(
    DEFAULT_RESOURCE_STORES.map((store) => store.id),
    expectedTypes
  );

  const admin = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "app.js"),
    "utf8"
  );
  const language = fs.readFileSync(
    path.join(__dirname, "..", "src", "language", "index.ts"),
    "utf8"
  );
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "App.tsx"),
    "utf8"
  );
  assert.match(admin, /id: "connector", label: "连接器商店"/);
  assert.match(admin, /Skill、MCP、插件与连接器商店/);
  assert.match(language, /"resources\.store\.connector": "连接器商店"/);
  assert.match(language, /"resources\.store\.connector": "Connector store"/);
  assert.match(app, /store\.id === "connector"[^\n]+resources\.store\.connector/);
});

test("Unity and AweSun source definitions include the resource safety contract", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "apply-connectable-catalog.cjs"),
    "utf8"
  );
  for (const [id, nextId] of [
    ["unity-official-mcp-server", "oray-awesun-mcp"],
    ["oray-awesun-mcp", "applyConnectableTaxonomy"]
  ]) {
    const start = source.indexOf(`id: "${id}"`);
    const end = source.indexOf(nextId, start + id.length);
    assert.ok(start >= 0 && end > start, `missing source definition ${id}`);
    const definition = source.slice(start, end);
    for (const field of [
      "versionRef",
      "requestedPermissions",
      "credentialRequirements",
      "installScope",
      "uninstallPlan"
    ]) {
      assert.match(definition, new RegExp(`${field}:`), `${id} missing ${field}`);
      const resource = catalog.resources.find((entry) => entry.id === id);
      assert.ok(resource?.[field], `${id} published draft missing ${field}`);
    }
  }
});
