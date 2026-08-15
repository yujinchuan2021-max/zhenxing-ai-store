# 依赖安全升级与审计边界

## 问题

2026-08-16 重新运行依赖审计时，网站工作区报告 20 项告警（15 high、4 moderate、1 low），PC 客户端报告 5 项 high。网站生产依赖中的 Next.js、PostCSS、Sharp 和 NanoID，以及开发链中的 Vite、Cloudflare、Wrangler、Vinext；PC 开发/打包链中的 Electron 和三个传递依赖均有已发布修复版本。

## 修复

- 网站升级到 Next.js/ESLint Config 16.3.1、Vite 8.2.1、Cloudflare Vite Plugin 1.52.1、Wrangler 4.123.0、Vinext 1.0.0-beta.6 和 RSC Plugin 0.5.34。
- PC 客户端升级 Electron 39.8.10 → 43.4.0；新版使用 Electron 内部维护的解压模块，不再依赖受影响的 `extract-zip`。
- 运行非强制 `npm audit fix`，只接受各依赖声明范围内的 Babel、PostCSS、NanoID、JS-YAML、Fast URI、brace-expansion 和 esbuild 补丁。
- 拒绝 `npm audit fix --force` 建议的 Drizzle Kit 0.31.10 → 0.18.1 破坏性降级。

## 验证

- 网站 `npm test`：build PASS，HTML 3/3 PASS；`npm run lint` PASS。
- PC `npm run build` PASS；Electron `v43.4.0` 可启动；main/preload/Admin 语法检查 PASS。
- 客户端运行、社区、下载、环境更新、扩展、已安装管理、软件更新中心和 Windows 路径聚焦回归 61/61 PASS。
- 网站与 PC 的 `npm audit --omit=dev` 均为 0；PC 完整 `npm audit` 为 0。
- 网站完整审计仅剩 Drizzle Kit → `@esbuild-kit/esm-loader` → esbuild 的 4 项 moderate，均为本地数据库迁移开发工具链，不进入生产依赖或客户端包。上游稳定版尚未移除该依赖，待稳定修复发布后正常升级，不通过降级或强制 override 掩盖。

## 防回退

依赖更新先要求两个工作区的生产审计为 0，再运行构建、Lint 和客户端聚焦回归。完整审计若只能通过 `--force`、降级或跨主版本 override 清零，必须记录实际暴露面并等待上游稳定修复，不能以审计数字替代兼容性验证。
