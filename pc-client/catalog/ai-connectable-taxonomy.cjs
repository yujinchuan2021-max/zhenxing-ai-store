"use strict";

const CONNECTABLE_CATEGORY_BY_PRODUCT_ID = Object.freeze({
  "ableton-live": "音频制作",
  "adobe-creative-cloud": "图像与设计",
  "asana-work-graph": "项目与协作",
  "atlassian-bitbucket": "编程与调试",
  "atlassian-confluence": "文档与知识库",
  "atlassian-jira": "项目与协作",
  "autodesk-fusion": "3D 创作",
  "blender": "3D 创作",
  "davinci-resolve": "视频创作",
  "canva-design": "图像与设计",
  "cloudflare-platform": "云服务与运维",
  "docker-desktop": "云服务与运维",
  "figma-design": "图像与设计",
  "godot-engine": "游戏开发",
  "github-platform": "编程与调试",
  "google-chrome-devtools": "编程与调试",
  "hubspot-crm": "商业与支付",
  "home-assistant": "智能设备",
  "jetbrains-intellij-idea": "编程与调试",
  "linear-workspace": "项目与协作",
  "notion-workspace": "文档与知识库",
  "n8n-platform": "工作流自动化",
  "obs-studio": "直播与录制",
  "postman-api-platform": "编程与调试",
  "sentry-platform": "云服务与运维",
  "slack-workspace": "项目与协作",
  "stripe-platform": "商业与支付",
  "sketchup": "3D 创作",
  "sunlogin-windows": "远程控制",
  "supabase-projects": "云服务与运维",
  "unity-editor": "游戏开发",
  "uipath-platform": "办公自动化",
  "unreal-engine": "游戏开发",
  "affinity": "图像与设计",
  "vercel-projects": "云服务与运维",
  "zapier-platform": "工作流自动化",
  "monday-work-management": "项目与协作",
  "mongodb-platform": "数据库与数据",
  "grafana-platform": "可观测性",
  "datadog-platform": "可观测性",
  "elastic-platform": "数据库与数据",
  "roblox-studio": "游戏开发",
  "penpot-platform": "图像与设计",
  "webflow-platform": "图像与设计",
  "miro-workspace": "项目与协作",
  "matlab": "工程计算与仿真",
  "simulink": "工程计算与仿真",
  "nvidia-omniverse": "3D 与工业仿真",
  "gitlab-platform": "编程与调试",
  "salesforce-platform": "办公自动化",
  "servicenow-platform": "工作流自动化",
  "azure-devops": "编程与调试",
  "terraform-platform": "云服务与运维",
  "pulumi-cloud": "云服务与运维",
  "browserstack-test-platform": "编程与调试",
  "circleci-platform": "编程与调试",
  "clickup-workspace": "项目与协作",
  "box-content-cloud": "文档与知识库",
  "pipedream-platform": "工作流自动化",
  "make-platform": "工作流自动化",
  "google-workspace": "办公自动化",
  "zoom-workplace": "项目与协作",
  "shopify-storefront": "商业与支付",
  "wolfram-mathematica": "工程计算与仿真",
  "wolfram-cloud": "工程计算与仿真",
  "ansys-lumerical": "工程计算与仿真",
  "cesiumjs": "地图与地理空间",
  "siemens-xcelerator-developer-portal": "文档与知识库",
  "arcgis-location-platform": "地图与地理空间",
  "synopsys-verdi": "工程计算与仿真",
  "azure-cloud-platform": "云服务与运维",
  "aws-cloud-platform": "云服务与运维",
  "databricks-data-intelligence-platform": "数据库与数据",
  "snowflake-ai-data-cloud": "数据库与数据",
  "redis-database": "数据库与数据",
  "neo4j-graph-database": "数据库与数据",
  "confluent-cloud": "数据库与数据",
  "paypal-commerce-platform": "商业与支付",
  "wix-platform": "网站与建站",
  "wordpress-com": "内容管理与发布",
  "semrush-platform": "营销与搜索",
  "intercom-platform": "客户服务",
  "intercom-fin": "客户服务"
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
