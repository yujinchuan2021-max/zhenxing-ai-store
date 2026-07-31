const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  resolveProductBehavior
} = require("../shared/product-policy.cjs");

const PRESERVED_MANAGED_PRODUCTS = Object.freeze({
  openai: ["chatgpt-desktop", "codex-cli", "chatgpt-web"],
  anthropic: ["claude-desktop", "claude-code", "claude-web"],
  comfy: ["comfy-desktop"],
  google: ["gemini-cli"],
  ollama: ["ollama-cli"]
});

const HIGH_VALUE_RESEARCH_PRODUCTS = Object.freeze([
  "openai-codex",
  "google-jules",
  "amazon-kiro-ide",
  "amazon-kiro-cli",
  "kimi-work-desktop",
  "kimi-claw",
  "kimi-claw-desktop",
  "kimi-webbridge",
  "moonshot-kimi-code-cli",
  "minimax-cli",
  "hf-cli",
  "openclaw-agent",
  "openclaw-windows-hub",
  "chatgpt-work",
  "claude-cowork",
  "claude-tag",
  "google-antigravity-desktop",
  "google-antigravity-cli",
  "google-gemini-spark",
  "google-flow",
  "google-stitch",
  "microsoft-agent-365",
  "cursor-cli",
  "elevenlabs-agents",
  "tencent-qclaw",
  "tencent-ima",
  "tencent-clawpro",
  "tencent-ardot",
  "alibaba-qoder-cn-ide",
  "alibaba-qoderwork-cn",
  "alibaba-qoder-cn-cli",
  "alibaba-qoderwake-cn",
  "alibaba-qoder-cloud-agents-cn",
  "nous-hermes-agent",
  "cline-agent",
  "opencode",
  "comfy-cli"
]);

test("the researched catalog contains the 49-vendor, 148-product audited batch", () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.equal(catalog.vendors.length, 49);
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.length, 148);
  const productIds = new Set(products.map((product) => product.id));
  for (const productId of HIGH_VALUE_RESEARCH_PRODUCTS) {
    assert.equal(productIds.has(productId), true, productId);
  }
  for (const [vendorId, expectedProductIds] of Object.entries(
    PRESERVED_MANAGED_PRODUCTS
  )) {
    const vendor = catalog.vendors.find((item) => item.id === vendorId);
    assert.ok(vendor, vendorId);
    for (const productId of expectedProductIds) {
      assert.equal(
        vendor.products.some((product) => product.id === productId),
        true,
        `${vendorId}/${productId}`
      );
    }
  }
  assert.equal(productIds.has("openai-sora-retired"), false);
  assert.equal(productIds.has("amazon-q-developer-transition"), false);
  assert.equal(productIds.has("microsoft-autogen-maintenance"), false);
});

test("every product has complete behavior and policy metadata", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.length, 148);
  for (const product of products) {
    assert.ok(product.name);
    assert.ok(product.description);
    assert.ok(product.category);
    assert.match(product.website, /^https:\/\//);
    assert.match(product.tutorial, /^https:\/\//);
    assert.ok(product.productType);
    assert.ok(Array.isArray(product.requirements));
    assert.ok(product.installPolicy);
    assert.ok(product.downloadPolicy);
    assert.ok(product.signaturePolicy);
    assert.ok(product.uninstallPolicy);
    const behavior = resolveProductBehavior(product);
    assert.equal(
      behavior.opensDirectly || behavior.requiresEnvironmentCheck,
      true
    );
  }
});

test("the seven product behavior modules classify every catalog entry", () => {
  const counts = Object.fromEntries(
    [
      "web",
      "desktop-official",
      "desktop-reviewed",
      "cli-official",
      "cli",
      "local-model",
      "tutorial"
    ].map((type) => [type, 0])
  );
  for (const product of catalog.vendors.flatMap((vendor) => vendor.products)) {
    counts[product.productType] += 1;
  }
  assert.deepEqual(counts, {
    web: 72,
    "desktop-official": 1,
    "desktop-reviewed": 26,
    "cli-official": 3,
    cli: 14,
    "local-model": 1,
    tutorial: 31
  });
});

test("skills and MCP entries stay under products with one reviewed managed Skill", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  const extensions = products.flatMap((product) => product.extensions || []);
  assert.equal(extensions.length, 24);
  assert.equal(extensions.filter((item) => item.extensionType === "skill").length, 15);
  assert.equal(extensions.filter((item) => item.extensionType === "mcp").length, 9);
  const managed = extensions.find(
    (item) => item.id === "openai-chatgpt-apps-skill"
  );
  assert.deepEqual(
    {
      moduleId: managed.moduleId,
      installProfileId: managed.installProfileId,
      versionRef: managed.versionRef,
      capabilities: managed.capabilities
    },
    {
      moduleId: "skill-managed",
      installProfileId: "skill.codex.chatgpt-apps",
      versionRef: "49f948faa9258a0c61caceaf225e179651397431",
      capabilities: ["website", "install", "uninstall"]
    }
  );
  assert.equal(
    extensions.every(
      (item) =>
        item.id === "openai-chatgpt-apps-skill" ||
        (item.moduleId === `${item.extensionType}-link` &&
          item.installProfileId === "" &&
          item.capabilities.length === 1 &&
          item.capabilities[0] === "website")
    ),
    true
  );
  const extensionIds = new Set(extensions.map((item) => item.id));
  for (const extensionId of [
    "openai-codex-skills-catalog",
    "openai-chatgpt-apps-skill",
    "anthropic-claude-code-mcp",
    "openclaw-clawhub-skills",
    "comfy-custom-nodes"
  ]) {
    assert.equal(extensionIds.has(extensionId), true, extensionId);
  }
});
