"use strict";

const fs = require("node:fs");
const path = require("node:path");

const catalogPath = path.join(__dirname, "..", "admin", "data", "catalog-v1.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const updates = Object.freeze({
  "alibaba-qwen-code": {
    installProfileId: "cli.qwen-code",
    requirements: ["node"],
    description: "Qwen 官方终端编程智能体。AI Hub 使用固定版本官方 npm 包部署，安装后直接打开命令窗口。"
  },
  "github-copilot-cli": {
    installProfileId: "cli.github-copilot",
    requirements: ["node"],
    description: "GitHub 官方 Copilot 终端智能体。AI Hub 使用固定版本官方 npm 包部署，首次打开后由用户登录 GitHub。"
  },
  "minimax-cli": {
    installProfileId: "cli.minimax",
    requirements: ["node"],
    description: "MiniMax 官方终端智能体。AI Hub 使用固定版本官方 npm 包部署，安装后直接打开命令窗口。"
  },
  "comfy-cli": {
    installProfileId: "cli.comfy",
    requirements: ["python"],
    description: "Comfy 官方命令行管理工具。AI Hub 会自动检测 Python，并安装到独立虚拟环境。"
  },
  "hf-cli": {
    installProfileId: "cli.hugging-face",
    requirements: ["python"],
    description: "Hugging Face 官方命令行工具。AI Hub 会自动检测 Python，并安装到独立虚拟环境。"
  },
  "mistral-vibe-code-cli": {
    installProfileId: "cli.mistral-vibe",
    requirements: ["python"],
    description: "Mistral 官方 Vibe 编程智能体。AI Hub 会自动检测 Python，并安装到独立虚拟环境。"
  },
  "amazon-kiro-cli": {
    installProfileId: "cli.kiro",
    requirements: [],
    description: "Amazon 官方 Kiro CLI。AI Hub 下载固定 Windows x64 MSI，校验哈希与数字签名后安装。"
  }
});

let changed = 0;
for (const vendor of catalog.vendors) {
  for (const product of vendor.products) {
    const update = updates[product.id];
    if (!update) continue;
    Object.assign(product, {
      kind: "CLI",
      moduleId: "cli-managed",
      installPolicy: "client-managed-cli",
      downloadPolicy: "none",
      signaturePolicy: "not-applicable",
      uninstallPolicy: "client-managed",
      capabilities: ["website", "tutorial", "install", "open", "uninstall"],
      productType: "cli",
      ...update
    });
    changed += 1;
  }
}

for (const vendor of catalog.vendors) {
  for (const product of vendor.products) {
    if (product.id === "alibaba-qoder-cn-cli") {
      Object.assign(product, {
        moduleId: "cli-official",
        installPolicy: "open-official-install",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed",
        capabilities: ["website", "tutorial"],
        productType: "cli-official",
        requirements: [],
        installProfileId: "",
        description: "Qoder 中国版 CLI。现有国际版安装身份已移除；待中国版官方 postinstall 与平台依赖完成审核后再开放一键安装。"
      });
    }
    if (product.id === "nous-hermes-agent") {
      Object.assign(product, {
        moduleId: "cli-official",
        installPolicy: "open-official-install",
        downloadPolicy: "none",
        signaturePolicy: "not-applicable",
        uninstallPolicy: "not-managed",
        capabilities: ["website", "tutorial"],
        productType: "cli-official",
        requirements: [],
        installProfileId: "",
        description: "Nous Research 官方 Hermes Agent。Windows 原生支持仍为 beta，待多产物固定版本与完整性审核完成后再开放一键安装。"
      });
    }
    if (product.id === "claude-code") {
      product.requirements = ["node", "git"];
      product.description = "Anthropic 官方 Claude Code。AI Hub 使用固定版本 npm 专用模块安装，并关闭未经审核的依赖脚本。";
    }
  }
}

if (changed !== Object.keys(updates).length) {
  throw new Error(`Expected ${Object.keys(updates).length} CLI products, updated ${changed}`);
}
catalog.updatedAt = new Date().toISOString();
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Updated ${changed} managed CLI products.`);
