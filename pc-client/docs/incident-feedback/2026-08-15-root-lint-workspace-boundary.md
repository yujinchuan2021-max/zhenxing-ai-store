# 根站点 lint 跨入桌面客户端工程

## 现象

根目录执行 `npm run lint` 时先扫描 `pc-client/dist`，导致 ESLint 格式化器以 `RangeError: Invalid string length` 崩溃。排除生成目录后，根站点的 Next.js 规则又跨入独立的 `pc-client` CommonJS 工程，产生 14,301 个错误和 13,772 个警告。

## 根因

根 ESLint 配置只忽略根层级的 `.next`、`out` 和 `build`，没有声明嵌套 `dist` 与独立 `pc-client` 工作区边界。根站点和桌面客户端使用不同的构建、模块与 lint 合同，不能由同一组 Next.js 规则混审。

## 修复与验证

- 根配置新增 `**/dist/**`，排除任意层级的生成产物。
- 根配置新增 `pc-client/**`，桌面客户端继续由其自己的 `npm run lint` 负责。
- 新增秒级合同测试，先分别证明两个忽略项缺失时 RED，再在配置修复后 GREEN。
- 修复后根 `npm run lint` 在约 3 秒内通过；桌面客户端 build、lint 与 focused tests 已分别通过。

## 防复发门禁

新增独立工作区时必须在根 ESLint 的 `globalIgnores` 中声明边界，并由该工作区自己的 lint 脚本负责。所有层级的生成目录必须用递归 glob 排除，不能只依赖根目录名称或 Git 忽略规则。
