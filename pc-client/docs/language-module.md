# PC 与社区统一语言模块

## 唯一入口

`src/language/index.ts` 是界面语言的唯一入口，负责：

- 语言值校正与默认回退。
- 稳定文案键和变量插值。
- HTML 文档 locale。
- Flarum locale 映射。
- PC 当前语言读取接口。

页面组件只能调用 `createLanguage(...).text(...)` 或 `uiText(...)`，不再直接维护用户可见文案。

## 资源文件

- `src/language/generated.ts`：简体中文资源。
- `src/language/generated.en.ts`：英文资源。
- `src/language/index.ts`：人工命名的核心导航、社区和设置文案。

厂商名称、产品名称、产品描述和首页运营内容属于后台目录数据，不属于客户端语言资源。

## 更新流程

1. 完成页面逻辑修改。
2. 执行 `npm run language:extract`，把新增的中文界面文案提取到资源目录。
3. 在资源文件内统一调整文案，不回到页面寻找文字。
4. 需要生成英文初稿时执行 `npm run language:translate`，随后人工校对 `generated.en.ts`。
5. 执行 `npm test`。测试会检查中英文键、插值变量和页面残留文案。

## 社区同步

设置中的语言通过 Electron 设置接口持久化。内置社区加载后使用同一个语言值更新 Flarum 用户的 `locale`：中文映射为 `zh-Hans`，英文映射为 `en`。社区语言变化后由 Flarum 自己重载对应资源，PC 不复制社区文案。
