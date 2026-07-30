const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  resolveProductBehavior
} = require("../shared/product-policy.cjs");

const EXPECTED_PRODUCTS = Object.freeze({
  openai: ["chatgpt-desktop", "codex-cli", "chatgpt-web"],
  anthropic: ["claude-desktop", "claude-code", "claude-web"],
  bytedance: ["jianying", "doubao", "trae-desktop", "jimeng-web", "coze-web"],
  comfy: ["comfy-desktop"],
  deepseek: ["deepseek-web"],
  google: ["gemini-web", "gemini-cli"],
  dify: ["dify-web"],
  ollama: ["ollama-cli"],
  microsoft: ["microsoft-copilot-web", "microsoft-copilot-desktop"],
  github: ["github-copilot"],
  anysphere: ["cursor-desktop"],
  moonshot: ["kimi-web"],
  alibaba: ["qianwen-web"],
  tencent: ["tencent-yuanbao-web", "tencent-yuanbao-desktop"],
  zhipu: ["zhipu-qingyan-web"],
  midjourney: ["midjourney-web"],
  runway: ["runway-web"],
  elevenlabs: ["elevenlabs-web"],
  suno: ["suno-web"],
  lmstudio: ["lm-studio-desktop"],
  nomic: ["gpt4all-desktop"],
  mintplex: ["anythingllm-desktop"]
});

test("the approved catalog contains the exact 22-vendor, 33-product set", () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.deepEqual(
    catalog.vendors.map((vendor) => vendor.id).sort(),
    Object.keys(EXPECTED_PRODUCTS).sort()
  );
  for (const vendor of catalog.vendors) {
    assert.deepEqual(
      vendor.products.map((product) => product.id).sort(),
      [...EXPECTED_PRODUCTS[vendor.id]].sort()
    );
  }
});

test("every product has complete behavior and policy metadata", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.length, 33);
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

test("the six product behavior model has no unclassified catalog entries", () => {
  const counts = Object.fromEntries(
    [
      "web",
      "desktop-official",
      "desktop-reviewed",
      "cli",
      "local-model",
      "tutorial"
    ].map((type) => [type, 0])
  );
  for (const product of catalog.vendors.flatMap((vendor) => vendor.products)) {
    counts[product.productType] += 1;
  }
  assert.deepEqual(counts, {
    web: 17,
    "desktop-official": 8,
    "desktop-reviewed": 3,
    cli: 3,
    "local-model": 1,
    tutorial: 1
  });
});
