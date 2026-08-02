"use strict";

const LINK_ENTRY_TYPES = new Set([
  "website",
  "web",
  "tutorial",
  "external"
]);
const ACTION_ENTRY_TYPES = new Set(["desktop", "cli"]);
const PRODUCT_ENTRY_POINT_TYPES = Object.freeze([
  Object.freeze({ type: "website", label: "工具官网", kind: "link" }),
  Object.freeze({ type: "web", label: "网页版", kind: "link" }),
  Object.freeze({ type: "desktop", label: "Windows 客户端", kind: "product-action" }),
  Object.freeze({ type: "cli", label: "命令行工具", kind: "product-action" }),
  Object.freeze({ type: "tutorial", label: "使用教程", kind: "link" }),
  Object.freeze({ type: "external", label: "相关链接", kind: "link" })
]);

function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLabel(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 48 &&
    value.trim() === value
  );
}

function entryPointTypeMetadata() {
  return PRODUCT_ENTRY_POINT_TYPES.map((entry) => ({ ...entry }));
}

function validateProductEntryPoints(product) {
  if (product.entryPoints === undefined) return "";
  if (!Array.isArray(product.entryPoints) || product.entryPoints.length > 12) {
    return "产品入口数量无效";
  }

  const singletonTypes = new Set();
  for (const entry of product.entryPoints) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return "产品入口结构无效";
    }
    if (!isLabel(entry.label)) return "产品入口名称无效";

    if (LINK_ENTRY_TYPES.has(entry.type)) {
      if (
        Object.keys(entry).some(
          (field) => !["type", "label", "url"].includes(field)
        ) ||
        !isHttpsUrl(entry.url)
      ) {
        return "产品链接入口无效";
      }
      if (product.kind === "CLI" && entry.type === "web") {
        return "CLI 产品不能合并网页版入口";
      }
    } else if (ACTION_ENTRY_TYPES.has(entry.type)) {
      if (
        Object.keys(entry).some(
          (field) => !["type", "label"].includes(field)
        )
      ) {
        return "产品操作入口不能携带命令、参数、路径或链接";
      }
      if (entry.type === "desktop" && product.kind !== "桌面端") {
        return "桌面入口只能绑定可视化桌面产品";
      }
      if (entry.type === "cli" && product.kind !== "CLI") {
        return "CLI 入口只能绑定独立 CLI 产品";
      }
    } else {
      return "产品入口类型无效";
    }

    if (entry.type !== "external") {
      if (singletonTypes.has(entry.type)) return "产品入口类型重复";
      singletonTypes.add(entry.type);
    }
  }
  return "";
}

function legacyProductEntryPoints(product) {
  const entries = [];
  const addLink = (type, label, url) => {
    if (isHttpsUrl(url)) entries.push({ type, label, url });
  };
  const addTutorial = () => {
    if (product.tutorial && product.tutorial !== product.website) {
      addLink("tutorial", "打开教程", product.tutorial);
    }
  };

  if (product.productType === "web") {
    addLink("web", "打开网页版", product.website);
    addTutorial();
  } else if (product.productType === "tutorial") {
    addLink("tutorial", "打开教程", product.tutorial);
  } else if (product.productType === "desktop-official") {
    entries.push({ type: "desktop", label: "获取 Windows 客户端" });
    addTutorial();
  } else if (product.productType === "cli-official") {
    entries.push({ type: "cli", label: "查看 CLI 安装说明" });
    addTutorial();
  } else if (["desktop-reviewed", "local-model"].includes(product.productType)) {
    addLink("website", "工具官网", product.website);
    addTutorial();
    entries.push({ type: "desktop", label: "一键安装" });
  } else if (product.productType === "cli") {
    addLink("website", "CLI 官网", product.website);
    addTutorial();
    entries.push({ type: "cli", label: "一键安装" });
  }
  return entries;
}

function resolveProductEntryPoints(product) {
  const source =
    product.entryPoints === undefined
      ? legacyProductEntryPoints(product)
      : product.entryPoints;
  return Object.freeze(
    source.map((entry) => Object.freeze({ ...entry }))
  );
}

module.exports = {
  ACTION_ENTRY_TYPES,
  LINK_ENTRY_TYPES,
  PRODUCT_ENTRY_POINT_TYPES,
  entryPointTypeMetadata,
  resolveProductEntryPoints,
  validateProductEntryPoints
};
