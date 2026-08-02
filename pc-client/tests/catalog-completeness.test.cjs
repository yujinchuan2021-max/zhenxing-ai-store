const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  resolveProductBehavior
} = require("../shared/product-policy.cjs");

const PRESERVED_MANAGED_PRODUCTS = Object.freeze({
  openai: ["chatgpt-desktop", "codex-cli"],
  anthropic: ["claude-desktop", "claude-code"],
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

test("the researched catalog keeps the Windows second pass and reviewed connectable products", () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.equal(catalog.vendors.length, 139);
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.length, 270);
  const productIds = new Set(products.map((product) => product.id));
  for (const productId of HIGH_VALUE_RESEARCH_PRODUCTS) {
    assert.equal(productIds.has(productId), true, productId);
  }
  for (const productId of [
    "unity-ai-assistant",
    "unity-editor",
    "sunlogin-windows"
  ]) {
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
  for (const mergedId of [
    "chatgpt-web",
    "claude-web",
    "doubao",
    "microsoft-copilot-web",
    "qianwen-web",
    "tencent-yuanbao-web"
  ]) {
    assert.equal(productIds.has(mergedId), false, mergedId);
  }
  for (const productId of [
    "chatgpt-desktop",
    "claude-desktop",
    "bytedance-doubao",
    "microsoft-copilot-desktop",
    "alibaba-qwen-studio",
    "tencent-yuanbao-desktop"
  ]) {
    const product = products.find((item) => item.id === productId);
    assert.deepEqual(
      product.entryPoints.map((entry) => entry.type),
      ["website", "web", "desktop"],
      productId
    );
  }
});

test("Chinese vendor names use their displayed-name pinyin bucket", () => {
  const expected = {
    alibaba: "A",
    baichuan: "B",
    baidu: "B",
    bytedance: "Z",
    deepseek: "S",
    iflytek: "K",
    kingsoft: "J",
    kuaishou: "K",
    laiye: "L",
    meitu: "M",
    moonshot: "Y",
    oray: "B",
    sensetime: "S",
    tencent: "T",
    yingdao: "Y",
    youdao: "W",
    zhipu: "Z"
  };
  for (const [vendorId, initial] of Object.entries(expected)) {
    assert.equal(
      catalog.vendors.find((vendor) => vendor.id === vendorId)?.initial,
      initial,
      vendorId
    );
  }
});

test("only the reviewed mainland China network notices are enabled", () => {
  const expected = new Set([
    "anthropic",
    "google",
    "meta",
    "midjourney",
    "openai",
    "perplexity",
    "xai"
  ]);
  const actual = new Set(
    catalog.vendors
      .filter((vendor) => vendor.requiresCrossBorderNetwork === true)
      .map((vendor) => vendor.id)
  );
  assert.deepEqual(actual, expected);
  assert.equal(
    catalog.vendors.every(
      (vendor) =>
        vendor.requiresCrossBorderNetwork === undefined ||
        typeof vendor.requiresCrossBorderNetwork === "boolean"
    ),
    true
  );
});

test("every product has complete behavior and policy metadata", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.length, 270);
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
    web: 94,
    "desktop-official": 102,
    "desktop-reviewed": 26,
    "cli-official": 3,
    cli: 14,
    "local-model": 1,
    tutorial: 30
  });
});

test("ecosystem resources are top-level, typed and keep one reviewed managed Skill", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.every((product) => !("extensions" in product)), true);
  assert.equal(
    products.every((product) =>
      ["ai-tool", "ai-connectable"].includes(product.directoryKind)
    ),
    true
  );
  const resources = catalog.resources;
  assert.equal(resources.length, 71);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("skill")).length, 13);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("mcp")).length, 52);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("plugin")).length, 7);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("connector")).length, 3);
  const managed = resources.find(
    (item) => item.id === "openai-chatgpt-apps-skill"
  );
  const managedTarget = managed.targets[0];
  assert.deepEqual(
    {
      moduleId: managedTarget.moduleId,
      installProfileId: managedTarget.installProfileId,
      versionRef: managed.versionRef,
      capabilities: managedTarget.capabilities
    },
    {
      moduleId: "skill-managed",
      installProfileId: "skill.codex.chatgpt-apps",
      versionRef: "49f948faa9258a0c61caceaf225e179651397431",
      capabilities: ["website", "install", "uninstall"]
    }
  );
  assert.equal(
    resources.every(
      (item) => item.targets.every((target) =>
        item.id === "openai-chatgpt-apps-skill" ||
        (target.moduleId === "resource-link" &&
          target.installProfileId === "" &&
          target.capabilities.length === 1 &&
          target.capabilities[0] === "website")
      )
    ),
    true
  );
  const resourceIds = new Set(resources.map((item) => item.id));
  for (const resourceId of [
    "openai-codex-skills-catalog",
    "openai-chatgpt-apps-skill",
    "anthropic-claude-code-mcp",
    "openclaw-clawhub-skills",
    "comfy-custom-nodes",
    "unity-official-mcp-server",
    "oray-awesun-mcp"
  ]) {
    assert.equal(resourceIds.has(resourceId), true, resourceId);
  }
});
