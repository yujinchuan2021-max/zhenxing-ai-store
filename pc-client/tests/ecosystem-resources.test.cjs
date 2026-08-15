"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { normalizeCatalog, validateCatalog } = require("../shared/catalog.cjs");
const {
  applyResourceTargetModule,
  publicResourceModules
} = require("../shared/ecosystem-resources.cjs");

function product(id, directoryKind) {
  return {
    id,
    enabled: true,
    order: 0,
    directoryKind,
    name: id,
    kind: "其他产品",
    category: "智能体",
    description: "示例产品。",
    website: `https://example.com/${id}`,
    tutorial: `https://example.com/${id}/docs`,
    productType: "web",
    moduleId: "web-link",
    installProfileId: "",
    requirements: [],
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    capabilities: ["website", "tutorial"]
  };
}

function catalogWithResources(resources) {
  return {
    schemaVersion: 2,
    resourceStores: [
      { id: "skill", label: "Skill 商店", enabled: true, order: 0 },
      { id: "mcp", label: "MCP 商店", enabled: true, order: 1 },
      { id: "plugin", label: "插件商店", enabled: true, order: 2 },
      { id: "connector", label: "连接器商店", enabled: true, order: 3 }
    ],
    resources,
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
          product("example-ai", "ai-tool"),
          product("example-app", "ai-connectable")
        ]
      }
    ]
  };
}

function linkedResource(overrides = {}) {
  return {
    id: "example-resource",
    enabled: true,
    order: 0,
    name: "Example Resource",
    resourceTypes: ["skill", "mcp", "plugin"],
    description: "示例生态资源。",
    website: "https://example.com/resource",
    tutorial: "https://example.com/resource/docs",
    sourceKind: "community",
    sourceProductIds: ["example-app"],
    targets: [
      {
        productId: "example-ai",
        compatibility: "verified",
        moduleId: "resource-link",
        installProfileId: "",
        capabilities: ["website"],
        enabled: true
      }
    ],
    ...overrides
  };
}

test("top-level resources use reusable fixed modules and many resource types", () => {
  assert.equal(publicResourceModules().length, 4);
  const target = applyResourceTargetModule(
    linkedResource().targets[0],
    "resource-link"
  );
  assert.equal(target.moduleId, "resource-link");
  assert.equal(target.installProfileId, "");
  assert.doesNotThrow(() =>
    validateCatalog(catalogWithResources([linkedResource({ targets: [target] })]))
  );
});

test("resource publisher, source products and target products are independent", () => {
  const audited = linkedResource({
    publisherVendorId: "example",
    publisher: "Example Org",
    sourceKind: "reviewed-community",
    versionRef: "v1.2.3",
    requestedPermissions: ["Read the current project files"],
    credentialRequirements: ["EXAMPLE_API_KEY environment variable"],
    installScope: "Current user",
    uninstallPlan: "Remove only files installed by ZhenXing AI.",
    provenanceEvidence: ["https://example.com/resource/release/v1.2.3"],
    lastVerifiedAt: "2026-07-31T12:00:00Z"
  });
  assert.doesNotThrow(() => validateCatalog(catalogWithResources([audited])));

  assert.throws(
    () =>
      validateCatalog(
        catalogWithResources([
          linkedResource({ sourceProductIds: ["example-ai"] })
        ])
      ),
    /来源产品必须属于 AI 可接入目录/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWithResources([
          linkedResource({
            targets: [
              {
                ...linkedResource().targets[0],
                productId: "example-app"
              }
            ]
          })
        ])
      ),
    /资源目标配置无效/
  );
});

test("resource scenario tags accept only the shared canonical taxonomy", () => {
  assert.doesNotThrow(() => validateCatalog(catalogWithResources([
    linkedResource({ scenarioTags: ["programming-development", "gaming"] })
  ])));
  for (const scenarioTags of [
    ["编程"],
    ["not-a-scenario"],
    ["programming-development", "programming-development"],
    [
      "programming-development",
      "agent-multi-agent",
      "automation-rpa",
      "office-collaboration",
      "data-analytics",
      "research",
      "knowledge-docs",
      "writing-content",
      "image-design"
    ]
  ]) {
    assert.throws(() => validateCatalog(catalogWithResources([
      linkedResource({ scenarioTags })
    ])), /生态资源数据无效/);
  }
});

test("catalog rejects duplicate, executable and unreviewed resource policies", () => {
  const duplicate = linkedResource();
  assert.throws(
    () => validateCatalog(catalogWithResources([duplicate, duplicate])),
    /生态资源 ID 重复/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWithResources([
          linkedResource({ command: "powershell.exe -Command calc" })
        ])
      ),
    /不支持的字段/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWithResources([
          linkedResource({
            resourceTypes: ["skill"],
            targets: [
              {
                ...linkedResource().targets[0],
                moduleId: "skill-managed",
                installProfileId: "skill.unreviewed",
                capabilities: ["website", "install"]
              }
            ]
          })
        ])
      ),
    /本地白名单/
  );
});

test("v2 resources require an explicit official or community source kind", () => {
  assert.throws(() =>
    validateCatalog(catalogWithResources([
      linkedResource({ sourceKind: undefined })
    ]))
  );
});

test("risk level and review status stay independent and cannot authorize managed targets", () => {
  assert.doesNotThrow(() => validateCatalog(catalogWithResources([
    linkedResource({ reviewStatus: "unreviewed", riskLevel: "guarded" })
  ])));
  assert.throws(() => validateCatalog(catalogWithResources([
    linkedResource({
      reviewStatus: "rejected",
      riskLevel: "unsafe",
      targets: [{
        ...linkedResource().targets[0],
        moduleId: "skill-managed",
        installProfileId: "skill.codex.chatgpt-apps",
        capabilities: ["website", "install"]
      }]
    })
  ])));
});

test("v1 product children migrate to one top-level v2 resource without changing IDs", () => {
  const legacyProduct = product("example-ai", undefined);
  delete legacyProduct.directoryKind;
  legacyProduct.extensions = [
    {
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
      capabilities: ["website"]
    }
  ];
  const legacy = {
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
        products: [legacyProduct]
      }
    ]
  };
  const migrated = validateCatalog(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.vendors[0].products[0].directoryKind, "ai-tool");
  assert.equal("extensions" in migrated.vendors[0].products[0], false);
  assert.equal(migrated.resources[0].id, "example-skill");
  assert.equal(migrated.resources[0].targets[0].productId, "example-ai");
  assert.equal(migrated.resources[0].targets[0].moduleId, "resource-link");
  assert.deepEqual(normalizeCatalog(migrated), migrated);
});

test("checked-in catalog is v2 and products no longer own resources", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
  assert.equal(catalog.schemaVersion, 2);
  assert.ok(catalog.resources.length > 0);
  assert.ok(
    catalog.vendors
      .flatMap((vendor) => vendor.products)
      .every(
        (entry) =>
          ["ai-tool", "ai-connectable"].includes(entry.directoryKind) &&
          !("extensions" in entry)
      )
  );
  assert.doesNotThrow(() => validateCatalog(catalog));
});
