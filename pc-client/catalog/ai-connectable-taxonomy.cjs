"use strict";

const CONNECTABLE_CATEGORY_BY_PRODUCT_ID = Object.freeze({
  "asana-work-graph": "项目与协作",
  "atlassian-bitbucket": "编程与调试",
  "atlassian-confluence": "文档与知识库",
  "atlassian-jira": "项目与协作",
  "canva-design": "图像与设计",
  "cloudflare-platform": "云服务与运维",
  "docker-desktop": "云服务与运维",
  "figma-design": "图像与设计",
  "github-platform": "编程与调试",
  "google-chrome-devtools": "编程与调试",
  "hubspot-crm": "商业与支付",
  "jetbrains-intellij-idea": "编程与调试",
  "linear-workspace": "项目与协作",
  "notion-workspace": "文档与知识库",
  "postman-api-platform": "编程与调试",
  "sentry-platform": "云服务与运维",
  "slack-workspace": "项目与协作",
  "stripe-platform": "商业与支付",
  "sunlogin-windows": "远程控制",
  "supabase-projects": "云服务与运维",
  "unity-editor": "游戏开发",
  "vercel-projects": "云服务与运维"
});

const CONNECTABLE_CATEGORIES = Object.freeze([
  ...new Set(Object.values(CONNECTABLE_CATEGORY_BY_PRODUCT_ID))
]);

function categoryForConnectableProduct(productId) {
  const category = CONNECTABLE_CATEGORY_BY_PRODUCT_ID[productId];
  if (!category) {
    throw new Error(`AI 可接入产品缺少实用特性分类：${productId}`);
  }
  return category;
}

function applyConnectableTaxonomy(catalog) {
  const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
  for (const vendor of catalog.vendors || []) {
    for (const product of vendor.products || []) {
      const category = CONNECTABLE_CATEGORY_BY_PRODUCT_ID[product.id];
      if (product.directoryKind === "ai-connectable" && category) {
        product.category = category;
      }
    }
  }
  const usesLegacyCategory = (catalog.vendors || []).some((vendor) =>
    (vendor.products || []).some(
      (product) =>
        product.directoryKind === "ai-connectable" &&
        product.category === "AI 接入"
    )
  );
  catalog.categories = categories.filter(
    (category) => category !== "AI 接入" || usesLegacyCategory
  );
  for (const category of CONNECTABLE_CATEGORIES) {
    if (!catalog.categories.includes(category)) catalog.categories.push(category);
  }
}

module.exports = {
  CONNECTABLE_CATEGORIES,
  CONNECTABLE_CATEGORY_BY_PRODUCT_ID,
  applyConnectableTaxonomy,
  categoryForConnectableProduct
};
