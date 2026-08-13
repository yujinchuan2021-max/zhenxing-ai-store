import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "admin", "data", "catalog-v1.json");

if (fs.existsSync(target) && !process.argv.includes("--force")) {
  console.log(`保留现有 CMS 草稿：${target}`);
  process.exit(0);
}

const result = await build({
  stdin: {
    contents: 'import { vendors } from "./src/data.ts"; export default vendors;',
    resolveDir: root,
    sourcefile: "catalog-seed.ts"
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false
});
const source = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { default: vendors } = await import(moduleUrl);
const seededVendors = vendors.map((vendor) => ({
  ...vendor,
  products: vendor.products.map(({ extensions: _extensions, ...product }) => ({
    ...product,
    directoryKind: "ai-tool"
  }))
}));

const catalog = {
  schemaVersion: 2,
  updatedAt: new Date().toISOString(),
  brand: {
    name: "枕星 AI",
    mark: "枕",
    slogan: "一个地方，找到并安装你的 AI 工具"
  },
  extraSections: [],
  community: {
    title: "枕星 AI 社区",
    description: "交流 AI 工具的安装、使用经验与工作流。",
    provider: "Flarum",
    url: "",
    enabled: false
  },
  home: {
    banners: [
      {
        eyebrow: "枕星 AI · PC",
        title: "一个地方，找到并安装你的 AI 工具",
        description:
          "从厂商进入，查看桌面端、CLI 与其他产品；只有点击安装后才进行环境检测。",
        action: "查看全部 AI 厂商"
      },
      {
        eyebrow: "厂商优先",
        title: "先选厂商，再看它旗下的全部产品",
        description:
          "按 A–Z 和工具特性筛选厂商，进入厂商页后统一查看产品、官网与使用教程。",
        action: "进入 AI 厂商目录"
      }
    ],
    featuredVendorIds: seededVendors.slice(0, 4).map((vendor) => vendor.id)
  },
  resourceStores: [
    { id: "skill", label: "Skill 商店", enabled: true, order: 0 },
    { id: "mcp", label: "MCP 商店", enabled: true, order: 1 },
    { id: "plugin", label: "插件商店", enabled: true, order: 2 }
  ],
  resources: [],
  vendors: seededVendors
};

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`已生成 CMS 初始目录：${target}`);
