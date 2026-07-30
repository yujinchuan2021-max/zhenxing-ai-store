import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "admin", "data", "catalog-v1.json");

const policies = {
  "chatgpt-desktop": {
    productType: "desktop-official",
    tutorial: "https://help.openai.com/en/collections/3742473-chatgpt"
  },
  "codex-cli": {
    productType: "cli",
    tutorial: "https://github.com/openai/codex",
    requirements: ["node"]
  },
  "chatgpt-web": {
    productType: "web",
    tutorial: "https://help.openai.com/en/collections/3742473-chatgpt"
  },
  "claude-desktop": {
    productType: "desktop-official",
    website: "https://claude.com/download",
    tutorial:
      "https://support.claude.com/en/collections/16163169-claude-desktop"
  },
  "claude-code": {
    productType: "cli",
    website: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
    tutorial: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
    requirements: ["node", "git"]
  },
  "claude-web": {
    productType: "web",
    tutorial: "https://support.claude.com"
  },
  jianying: {
    productType: "desktop-official",
    tutorial: "https://www.capcut.cn/learning"
  },
  doubao: {
    productType: "web",
    tutorial: "https://www.doubao.com"
  },
  "comfy-desktop": {
    productType: "desktop-reviewed",
    tutorial: "https://docs.comfy.org"
  },
  "deepseek-web": {
    productType: "web",
    tutorial: "https://api-docs.deepseek.com"
  },
  "gemini-web": {
    productType: "web",
    tutorial: "https://support.google.com/gemini"
  },
  "gemini-cli": {
    productType: "cli",
    tutorial: "https://github.com/google-gemini/gemini-cli",
    requirements: ["node"]
  },
  "dify-web": {
    productType: "web",
    tutorial: "https://docs.dify.ai"
  },
  "ollama-cli": {
    productType: "local-model",
    website: "https://ollama.com/download/windows",
    tutorial: "https://docs.ollama.com",
    kind: "桌面端"
  }
};

function behavior(productType) {
  if (productType === "web") {
    return [
      "open-product-website",
      "none",
      "not-applicable",
      "not-managed"
    ];
  }
  if (productType === "desktop-official") {
    return [
      "open-official-download",
      "official-page",
      "vendor-controlled",
      "vendor-managed"
    ];
  }
  if (productType === "cli") {
    return [
      "client-managed-cli",
      "none",
      "not-applicable",
      "client-managed"
    ];
  }
  return [
    "client-managed-installer",
    "client-managed",
    "client-reviewed",
    "client-managed"
  ];
}

const catalog = JSON.parse(fs.readFileSync(target, "utf8"));
for (const vendor of catalog.vendors) {
  for (const product of vendor.products) {
    const policy = policies[product.id];
    if (!policy) throw new Error(`缺少第三阶段产品策略：${product.id}`);
    const [installPolicy, downloadPolicy, signaturePolicy, uninstallPolicy] =
      behavior(policy.productType);
    Object.assign(product, {
      tutorial: policy.tutorial,
      website: policy.website ?? product.website,
      productType: policy.productType,
      requirements: policy.requirements ?? product.requirements,
      installPolicy,
      downloadPolicy,
      signaturePolicy,
      uninstallPolicy
    });
    if (policy.kind) product.kind = policy.kind;
  }
}
catalog.updatedAt = new Date().toISOString();
fs.writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`第三阶段目录字段已补齐：${target}`);
