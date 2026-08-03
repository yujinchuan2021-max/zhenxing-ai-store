"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  authorizeFreshCatalogResource,
  evaluateFreshCatalogResourceAuthorization
} = require("../shared/managed-catalog-resource-authorization.cjs");
const {
  getExtensionInstallProfile
} = require("../shared/extension-install-registry.cjs");

const PROFILE_ID = "skill.codex.chatgpt-apps";

function localProfile(overrides = {}) {
  return {
    moduleId: "skill-managed",
    extensionId: "openai-chatgpt-apps-skill",
    hostProductId: "codex-cli",
    capabilities: ["website", "install", "uninstall"],
    adapterId: "directory-snapshot",
    sourcePath: "codex/chatgpt-apps",
    targetRelativePath: "chatgpt-apps",
    ...overrides
  };
}

function remoteCatalog(overrides = {}) {
  const result = {
    source: "remote",
    catalogVersion: 47,
    catalog: {
      resourceStores: [
        { id: "skill", label: "Skill Store", enabled: true, order: 0 },
        { id: "mcp", label: "MCP Store", enabled: true, order: 1 },
        { id: "plugin", label: "Plugin Store", enabled: true, order: 2 }
      ],
      resources: [
        {
          id: "openai-chatgpt-apps-skill",
          enabled: true,
          resourceTypes: ["skill"],
          targets: [
            {
              productId: "codex-cli",
              compatibility: "official",
              moduleId: "skill-managed",
              installProfileId: PROFILE_ID,
              capabilities: ["website", "install", "uninstall"],
              enabled: true
            }
          ]
        }
      ],
      vendors: [
        {
          id: "openai",
          enabled: true,
          products: [
            {
              id: "codex-cli",
              enabled: true,
              directoryKind: "ai-tool"
            }
          ]
        }
      ]
    }
  };
  return { ...result, ...overrides };
}

function evaluate({ catalogResult, profile, profileId, requiredCapability } = {}) {
  return evaluateFreshCatalogResourceAuthorization({
    catalogResult: catalogResult || remoteCatalog(),
    profileId: profileId || PROFILE_ID,
    profile: profile || localProfile(),
    requiredCapability: requiredCapability || "install"
  });
}

test("authorizes one enabled remote resource without exposing local operation details", () => {
  const result = evaluate();
  assert.deepEqual(result, {
    ok: true,
    profileId: PROFILE_ID,
    extensionId: "openai-chatgpt-apps-skill",
    hostProductId: "codex-cli",
    resourceType: "skill",
    catalogVersion: 47
  });
  assert.equal("sourcePath" in result, false);
  assert.equal("targetRelativePath" in result, false);
  assert.equal("adapterId" in result, false);
});

test("requires a fresh remote catalog and fails closed when loading throws", async () => {
  for (const catalogResult of [
    { ...remoteCatalog(), source: "cache" },
    { source: "unavailable", catalog: null }
  ]) {
    const result = evaluate({ catalogResult });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, "ACTIVE_RESOURCE_CATALOG_UNAVAILABLE");
  }
  const thrown = await authorizeFreshCatalogResource({
    loadCatalog: async () => {
      throw new Error("offline");
    },
    profileId: PROFILE_ID,
    profile: localProfile()
  });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.errorCode, "ACTIVE_RESOURCE_CATALOG_UNAVAILABLE");
});

test("requires exactly one enabled resource directory", () => {
  const disabled = remoteCatalog();
  disabled.catalog.resourceStores[0].enabled = false;
  assert.equal(
    evaluate({ catalogResult: disabled }).errorCode,
    "CATALOG_RESOURCE_DIRECTORY_DISABLED"
  );

  const duplicate = remoteCatalog();
  duplicate.catalog.resourceStores.push({
    id: "skill",
    label: "Duplicate",
    enabled: true,
    order: 9
  });
  assert.equal(
    evaluate({ catalogResult: duplicate }).errorCode,
    "CATALOG_RESOURCE_DIRECTORY_NOT_UNIQUE"
  );
});

test("requires exactly one enabled resource", () => {
  const disabled = remoteCatalog();
  disabled.catalog.resources[0].enabled = false;
  assert.equal(
    evaluate({ catalogResult: disabled }).errorCode,
    "CATALOG_RESOURCE_DISABLED"
  );

  const duplicate = remoteCatalog();
  duplicate.catalog.resources.push({ ...duplicate.catalog.resources[0] });
  assert.equal(
    evaluate({ catalogResult: duplicate }).errorCode,
    "CATALOG_RESOURCE_NOT_UNIQUE"
  );
});

test("requires exactly one enabled AI-tool host and enabled vendor", () => {
  for (const mutate of [
    (catalog) => {
      catalog.catalog.vendors[0].enabled = false;
    },
    (catalog) => {
      catalog.catalog.vendors[0].products[0].enabled = false;
    },
    (catalog) => {
      catalog.catalog.vendors[0].products[0].directoryKind = "ai-connectable";
    }
  ]) {
    const catalogResult = remoteCatalog();
    mutate(catalogResult);
    assert.equal(
      evaluate({ catalogResult }).errorCode,
      "CATALOG_RESOURCE_HOST_DISABLED"
    );
  }

  const duplicate = remoteCatalog();
  duplicate.catalog.vendors.push({
    id: "duplicate",
    enabled: true,
    products: [
      { id: "codex-cli", enabled: true, directoryKind: "ai-tool" }
    ]
  });
  assert.equal(
    evaluate({ catalogResult: duplicate }).errorCode,
    "CATALOG_RESOURCE_HOST_NOT_UNIQUE"
  );
});

test("requires exactly one enabled target", () => {
  const disabled = remoteCatalog();
  disabled.catalog.resources[0].targets[0].enabled = false;
  assert.equal(
    evaluate({ catalogResult: disabled }).errorCode,
    "CATALOG_RESOURCE_TARGET_DISABLED"
  );

  const duplicate = remoteCatalog();
  duplicate.catalog.resources[0].targets.push({
    ...duplicate.catalog.resources[0].targets[0]
  });
  assert.equal(
    evaluate({ catalogResult: duplicate }).errorCode,
    "CATALOG_RESOURCE_TARGET_NOT_UNIQUE"
  );
});

test("requires module, profile, extension and host identities to agree", () => {
  for (const [field, value] of [
    ["moduleId", "mcp-managed"],
    ["installProfileId", "skill.codex.other"],
    ["productId", "other-host"]
  ]) {
    const catalogResult = remoteCatalog();
    catalogResult.catalog.resources[0].targets[0][field] = value;
    assert.equal(
      evaluate({ catalogResult }).errorCode,
      "CATALOG_RESOURCE_PROFILE_MISMATCH"
    );
  }
});

test("requires resource type and remote capabilities to stay inside the local profile", () => {
  const wrongType = remoteCatalog();
  wrongType.catalog.resources[0].resourceTypes = ["mcp"];
  assert.equal(
    evaluate({ catalogResult: wrongType }).errorCode,
    "CATALOG_RESOURCE_TYPE_MISMATCH"
  );

  const reducedCapabilities = remoteCatalog();
  reducedCapabilities.catalog.resources[0].targets[0].capabilities = [
    "website",
    "install"
  ];
  assert.equal(evaluate({ catalogResult: reducedCapabilities }).ok, true);
  assert.equal(
    evaluate({
      catalogResult: reducedCapabilities,
      profile: localProfile({
        capabilities: ["website", "install", "update", "uninstall"]
      }),
      requiredCapability: "update"
    }).errorCode,
    "CATALOG_RESOURCE_CAPABILITY_DISABLED"
  );

  const wrongCapabilities = remoteCatalog();
  wrongCapabilities.catalog.resources[0].targets[0].capabilities.push(
    "execute-arbitrary-command"
  );
  assert.equal(
    evaluate({ catalogResult: wrongCapabilities }).errorCode,
    "CATALOG_RESOURCE_CAPABILITY_MISMATCH"
  );

  assert.equal(
    evaluate({
      profile: localProfile({ resourceType: "mcp" })
    }).errorCode,
    "LOCAL_EXTENSION_PROFILE_INVALID"
  );
});

test("rejects command, path and package fields supplied by the catalog", () => {
  for (const [field, value] of [
    ["command", "powershell.exe"],
    ["sourcePath", "C:\\unsafe"],
    ["packageName", "unreviewed-package"]
  ]) {
    const catalogResult = remoteCatalog();
    catalogResult.catalog.resources[0].targets[0][field] = value;
    assert.equal(
      evaluate({ catalogResult }).errorCode,
      "CATALOG_RESOURCE_OPERATION_FIELDS_FORBIDDEN"
    );
  }
});

test("rejects invalid or non-managed local profiles before catalog matching", () => {
  assert.equal(
    evaluate({ profileId: "../unsafe" }).errorCode,
    "CATALOG_RESOURCE_PROFILE_ID_INVALID"
  );
  assert.equal(
    evaluate({ profile: localProfile({ moduleId: "resource-link" }) }).errorCode,
    "LOCAL_EXTENSION_PROFILE_INVALID"
  );
  assert.equal(
    evaluate({ profile: localProfile({ capabilities: ["website"] }) }).errorCode,
    "LOCAL_EXTENSION_PROFILE_INVALID"
  );
});

test("every checked-in managed resource is authorized only through its local profile", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
  for (const profileId of [
    "skill.codex.chatgpt-apps",
    "mcp.codex.openai-developer-docs",
    "plugin.claude.commit-commands"
  ]) {
    const result = evaluateFreshCatalogResourceAuthorization({
      catalogResult: { source: "remote", catalogVersion: 48, catalog },
      profileId,
      profile: getExtensionInstallProfile(profileId)
    });
    assert.equal(result.ok, true, profileId);
    assert.equal(result.catalogVersion, 48);
  }
});
