"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  canonicalScenarioTags,
  planMatureAgentPromotion,
  scenarioTagStats
} = require("../shared/catalog-taxonomy.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  matureAgentProducts,
  productsByScenarioTag
} = require("../shared/catalog-projections.cjs");

test("scenario aliases normalize to fixed canonical tags and report actual counts", () => {
  assert.deepEqual(canonicalScenarioTags(["游戏", "game-development", "编程"]), ["gaming", "game-development", "programming-development"]);
  assert.throws(() => canonicalScenarioTags(["unknown"]));
  const products = [{ scenarioTags: ["gaming"] }, { scenarioTags: ["gaming", "game-development"] }];
  assert.equal(scenarioTagStats(products).find((tag) => tag.id === "gaming").count, 2);
});

test("catalog stores canonical scenario IDs and only the shared mature channel shape", () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "admin", "published", "catalog-store", "state.json"), "utf8")).draft.catalog;
  const product = catalog.vendors[0].products[0];
  product.scenarioTags = ["gaming"];
  product.agentTag = true;
  assert.doesNotThrow(() => validateCatalog(catalog));
  product.scenarioTags = ["游戏"];
  assert.throws(() => validateCatalog(catalog), /产品数据无效/);
  product.scenarioTags = ["gaming"];
  product.agentChannel = "per-product-channel";
  assert.throws(() => validateCatalog(catalog), /产品数据无效/);
});

test("mature Agent promotion is a reviewed shared seam, not one channel per product", () => {
  const products = [{ id: "nous-hermes-desktop", agentTag: true, agentChannel: "mature-agent" }];
  const resources = [
    { id: "hermes-skill", targets: [{ productId: "nous-hermes-desktop" }] },
    { id: "hermes-mcp", targets: [{ productId: "nous-hermes-desktop" }] },
    { id: "hermes-plugin", targets: [{ productId: "nous-hermes-desktop" }] }
  ];
  const plan = planMatureAgentPromotion(products, resources, {
    productId: "nous-hermes-desktop", identityVerified: true, reviewStatus: "manually-reviewed", maintenanceOwnerId: "nous-research",
    resourceIds: ["hermes-skill", "hermes-mcp", "hermes-plugin"], activityEvidenceIds: ["2026-06", "2026-07"],
    reviewedAt: "2026-08-07T00:00:00Z"
  });
  assert.equal(plan.agentChannel, "mature-agent");
  assert.throws(() => planMatureAgentPromotion(products, resources, { ...plan, activityEvidenceIds: ["once"] }));
  const vendors = [{ id: "nous", products: [{ ...products[0], scenarioTags: ["agent-multi-agent"] }] }];
  assert.equal(matureAgentProducts(vendors).length, 1);
  assert.equal(productsByScenarioTag(vendors, "智能体").length, 1);
});
