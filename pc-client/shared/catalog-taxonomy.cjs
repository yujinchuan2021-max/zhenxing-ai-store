"use strict";

const SCENARIO_TAGS = Object.freeze([
  ["programming-development", "编程开发", ["编程", "开发", "programming", "development", "coding"]],
  ["agent-multi-agent", "Agent/多Agent", ["agent", "agents", "智能体", "多智能体"]],
  ["automation-rpa", "自动化/RPA", ["自动化", "rpa"]],
  ["office-collaboration", "办公协作", ["办公", "协作"]],
  ["data-analytics", "数据分析", ["数据", "分析"]],
  ["research", "科研", ["研究", "科研"]],
  ["knowledge-docs", "知识库/文档", ["知识库", "文档", "docs"]],
  ["writing-content", "写作内容", ["写作", "内容创作"]],
  ["image-design", "图像设计", ["图像", "设计", "image"]],
  ["video-audio", "视频音频", ["视频", "音频", "video", "audio"]],
  ["3d-cad-industrial", "3D/CAD/工业", ["3d", "cad", "工业"]],
  ["gaming", "游戏", ["游戏", "gaming"]],
  ["game-development", "游戏开发", ["游戏开发", "game development"]],
  ["marketing", "营销", ["营销", "marketing"]],
  ["ecommerce", "电商", ["电商", "e-commerce", "ecommerce"]],
  ["finance-investing", "财务投资", ["财务", "投资", "finance", "investing"]],
  ["education", "教育", ["教育", "education"]],
  ["life-health", "生活健康", ["生活", "健康", "health"]],
  ["cybersecurity-operations", "网络安全/运维", ["网络安全", "运维", "security", "operations"]],
  ["social-communication", "社交沟通", ["社交", "沟通", "communication"]],
  ["browser-information-collection", "浏览器/信息采集", ["浏览器", "信息采集", "browser"]]
].map(([id, label, aliases]) => Object.freeze({ id, label, aliases: Object.freeze(aliases) })));

const MATURE_AGENT_CHANNEL = "mature-agent";
const AGENT_COMPATIBILITY_TAG = "agent";
const PROMOTION_FIELDS = new Set([
  "identityVerified",
  "reviewStatus",
  "maintenanceOwnerId",
  "resourceIds",
  "activityEvidenceIds",
  "reviewedAt"
]);

function normalized(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase() : "";
}

function scenarioTag(value) {
  const key = normalized(value);
  return SCENARIO_TAGS.find((tag) => tag.id === key || tag.aliases.some((alias) => normalized(alias) === key)) || null;
}

function canonicalScenarioTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw new Error("scenario tags invalid");
  const tags = value.map(scenarioTag);
  if (tags.some((tag) => !tag) || new Set(tags.map((tag) => tag.id)).size !== tags.length) {
    throw new Error("scenario tags invalid");
  }
  return tags.map((tag) => tag.id);
}

function isCanonicalScenarioTags(value) {
  try {
    return value === undefined || (Array.isArray(value) && canonicalScenarioTags(value).every((id, index) => id === value[index]));
  } catch {
    return false;
  }
}

function isIsoTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isPromotion(value, { allowProductId = false } = {}) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((field) => PROMOTION_FIELDS.has(field) || (allowProductId && field === "productId")) &&
    value.identityVerified === true && value.reviewStatus === "manually-reviewed" &&
    /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value.maintenanceOwnerId || "") &&
    Array.isArray(value.resourceIds) && value.resourceIds.length >= 3 && value.resourceIds.length <= 50 &&
    new Set(value.resourceIds).size === value.resourceIds.length && value.resourceIds.every((id) => /^[a-z0-9][a-z0-9._-]{0,119}$/.test(id)) &&
    Array.isArray(value.activityEvidenceIds) && value.activityEvidenceIds.length >= 2 && value.activityEvidenceIds.length <= 50 &&
    new Set(value.activityEvidenceIds).size === value.activityEvidenceIds.length && value.activityEvidenceIds.every((id) => /^[a-z0-9][a-z0-9._-]{0,119}$/.test(id)) &&
    isIsoTimestamp(value.reviewedAt);
}

function isAgentClassification(product) {
  if (product.agentTag !== undefined && typeof product.agentTag !== "boolean") return false;
  if (product.agentChannel === undefined && product.agentPromotion === undefined) return true;
  return product.agentTag === true && product.agentChannel === MATURE_AGENT_CHANNEL && isPromotion(product.agentPromotion);
}

function planMatureAgentPromotion(products, resources, candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) ||
    Object.keys(candidate).some((field) => field !== "productId" && !PROMOTION_FIELDS.has(field)) ||
    !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(candidate.productId || "") || !isPromotion(candidate, { allowProductId: true })) {
    throw new Error("mature agent promotion invalid");
  }
  const product = (Array.isArray(products) ? products : []).find((item) => item.id === candidate.productId);
  const resourceIds = new Set((Array.isArray(resources) ? resources : [])
    .filter((resource) => resource.targets?.some((target) => target.productId === candidate.productId))
    .map((resource) => resource.id));
  if (!product || candidate.resourceIds.some((id) => !resourceIds.has(id))) {
    throw new Error("mature agent promotion evidence invalid");
  }
  return Object.freeze({
    productId: candidate.productId,
    agentTag: true,
    agentChannel: MATURE_AGENT_CHANNEL,
    agentPromotion: structuredClone(Object.fromEntries([...PROMOTION_FIELDS].map((field) => [field, candidate[field]])))
  });
}

function scenarioTagStats(products) {
  const counts = new Map(SCENARIO_TAGS.map((tag) => [tag.id, 0]));
  for (const product of Array.isArray(products) ? products : []) {
    for (const id of canonicalScenarioTags(product.scenarioTags)) counts.set(id, counts.get(id) + 1);
  }
  return SCENARIO_TAGS.map((tag) => ({ ...tag, count: counts.get(tag.id) }));
}

module.exports = {
  AGENT_COMPATIBILITY_TAG,
  MATURE_AGENT_CHANNEL,
  SCENARIO_TAGS,
  canonicalScenarioTags,
  isAgentClassification,
  isCanonicalScenarioTags,
  planMatureAgentPromotion,
  scenarioTag,
  scenarioTagStats
};
