"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");
const {
  applyExtensionModule,
  publicExtensionModules
} = require("../shared/product-extensions.cjs");

function catalogWithExtensions(extensions) {
  return {
    schemaVersion: 1,
    vendors: [
      {
        id: "example",
        name: "Example",
        initial: "E",
        mark: "E",
        color: "#112233",
        description: "示例厂商。",
        website: "https://example.com",
        tutorial: "https://example.com/docs",
        products: [
          {
            id: "example-cli",
            name: "Example CLI",
            kind: "其他产品",
            category: "智能体",
            description: "示例宿主产品。",
            website: "https://example.com/product",
            tutorial: "https://example.com/product/docs",
            productType: "web",
            moduleId: "web-link",
            installProfileId: "",
            requirements: [],
            installPolicy: "open-product-website",
            downloadPolicy: "none",
            signaturePolicy: "not-applicable",
            uninstallPolicy: "not-managed",
            capabilities: ["website", "tutorial"],
            extensions
          }
        ]
      }
    ]
  };
}

function linkedSkill(overrides = {}) {
  return {
    id: "example-skill",
    enabled: true,
    order: 0,
    name: "Example Skill",
    extensionType: "skill",
    description: "示例 Skill。",
    website: "https://example.com/skill",
    tutorial: "https://example.com/skill/docs",
    moduleId: "skill-link",
    installProfileId: "",
    capabilities: ["website"],
    ...overrides
  };
}

test("product extensions remain a child directory with reusable modules", () => {
  assert.equal(publicExtensionModules().length, 4);
  const extension = applyExtensionModule(
    linkedSkill({ extensionType: "mcp", moduleId: "mcp-link" }),
    "skill-link"
  );
  assert.equal(extension.extensionType, "skill");
  assert.equal(extension.moduleId, "skill-link");
  assert.equal(extension.installProfileId, "");
  assert.doesNotThrow(() => validateCatalog(catalogWithExtensions([extension])));
});

test("extension audit metadata is optional, editable and strictly validated", () => {
  const audited = linkedSkill({
    publisher: "Example Org",
    sourceKind: "reviewed-community",
    versionRef: "v1.2.3",
    requestedPermissions: ["Read the current project files"],
    credentialRequirements: ["EXAMPLE_API_KEY environment variable"],
    installScope: "Current host user",
    uninstallPlan: "Remove only the files installed by AI Hub.",
    provenanceEvidence: ["https://example.com/skill/release/v1.2.3"],
    lastVerifiedAt: "2026-07-31T12:00:00Z"
  });
  assert.doesNotThrow(() => validateCatalog(catalogWithExtensions([audited])));
  assert.doesNotThrow(() => validateCatalog(catalogWithExtensions([linkedSkill()])));

  for (const invalidMetadata of [
    { sourceKind: "unknown" },
    { requestedPermissions: [""] },
    { credentialRequirements: "API key" },
    { provenanceEvidence: ["http://example.com/evidence"] },
    { lastVerifiedAt: "2026-07-31" }
  ]) {
    assert.throws(
      () =>
        validateCatalog(
          catalogWithExtensions([linkedSkill(invalidMetadata)])
        ),
      /审计元数据无效/
    );
  }
});

test("catalog rejects duplicate, executable and unreviewed extension resources", () => {
  const duplicate = linkedSkill();
  assert.throws(
    () => validateCatalog(catalogWithExtensions([duplicate, duplicate])),
    /扩展资源数据无效/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWithExtensions([
          linkedSkill({ command: "powershell.exe -Command calc" })
        ])
      ),
    /不支持的字段/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWithExtensions([
          linkedSkill({
            moduleId: "skill-managed",
            installProfileId: "skill.unreviewed",
            capabilities: ["website", "install"]
          })
        ])
      ),
    /本地白名单/
  );
});

test("admin exposes complete extension resource CRUD inside products", () => {
  const adminHtml = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "index.html"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "app.js"),
    "utf8"
  );
  assert.match(adminHtml, /data-view="extensions"/);
  for (const marker of [
    'data-action="add-extension"',
    'data-action="delete-extension"',
    "data-extension-field",
    "data-extension-number",
    "data-extension-enabled",
    "data-extension-module",
    "data-extension-optional-field",
    "data-extension-list-field",
    "hostProductId"
  ]) {
    assert.match(adminScript, new RegExp(marker));
  }
});
