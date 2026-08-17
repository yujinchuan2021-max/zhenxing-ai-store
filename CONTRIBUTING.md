# 为枕星AI助手做贡献

[中文](#中文) · [English](#english)

## 中文

感谢你愿意帮助枕星AI助手变得更好。

我们相信，AI 工具不应该只服务少数熟悉命令行和复杂配置的人。枕星AI助手希望把复杂留给系统，把清楚的选择交给用户：帮助大家发现工具、理解用途、完成安装与配置，并知道当前状态是否可信。

### 我们坚持的方向

- **降低门槛，但不降低安全线。** 资源可以更容易被发现和理解；本地执行、安装和凭据使用仍须经过固定合同与用户确认。
- **保持轻量。** 我们做工具发现、安装、配置、验证和上手引导，不把客户端做成自动替用户生产完整项目的重型工厂。
- **事实先于数量。** Skill、MCP、插件、连接器和软件条目必须有可复核来源；“发现了”不等于“已审核”或“已发布”。
- **用户拥有最后决定。** 不静默安装、不强制更新、不把公司密钥写入客户端，也不把候选状态包装成正式可用。
- **一次把根因修好。** 优先修共享边界和真实数据流，而不是只遮住某一个页面上的症状。

### 欢迎的贡献

- 可复现的错误报告、性能问题和 Windows 兼容性反馈。
- 更清楚、更少步骤、更易访问的产品与交互改进。
- 带第一方证据的 AI 厂商、桌面产品、CLI、Skill、MCP、插件或连接器线索。
- 固定、可测试的安装、检测、配置和验证适配器。
- 文档、翻译、测试、无障碍和新手引导改进。

### 提交资源线索

请尽量提供：

1. 官方名称、发布方和稳定身份；
2. 官方网站、源码或正式文档链接；
3. 当前版本、许可证和支持的平台；
4. 兼容宿主及其一手证据；
5. 登录、凭据、数据访问、写操作、付费或不可逆风险；
6. 与现有条目可能重复或继承的关系。

资源进入研究或候选列表，不代表已经进入签名目录，也不代表客户端获得执行权限。

### 提交代码前

1. 阅读 `pc-client/CONTEXT.md` 和 `pc-client/docs/incident-feedback/README.md`。
2. 先确认真实数据流与现有公共入口，优先做最小、可回滚的根因修复。
3. 保留现有用户数据和无关工作区修改；不要用清理或重置掩盖问题。
4. 为非平凡逻辑补一条能杀死回归的最小测试。
5. 运行与改动直接相关的测试和构建，并如实记录尚未完成的真实设备验收。

### 安全边界

- 不提交密钥、令牌、账号、私有地址、真实用户数据或构建机秘密。
- 后台目录不能向客户端下发任意 EXE、Shell、PowerShell 或 CMD 命令。
- 公司模型密钥只保留在服务端；客户端仅使用受限设备或会话授权。用户自带密钥必须与公司密钥严格分离。
- 候选、本地测试、自动化通过和正式发布是不同状态，文档与界面不得混用。
- 不在贡献流程中擅自发布、签名、上传安装包或修改生产环境。

### Pull Request 清单

- 说明改了什么、为什么改，以及对用户的影响。
- 错误修复要写清根因和防复发测试。
- 只包含本次贡献需要的文件，不混入生成目录、安装包或个人草稿。
- UI 改动附上必要的前后对比；自动化截图不能冒充真实 Windows 验收。
- 明确列出已运行的检查、已知限制和仍待人工确认的事项。

### 许可证

枕星AI助手主体代码使用 [Apache License 2.0](LICENSE)。提交贡献即表示你有权提交该内容，并同意按 Apache-2.0 将其纳入项目。第三方代码、字体、图标、资源描述和链接继续遵循各自许可证与来源条款；请保留必要的版权与归属声明。

### 友善协作

请针对问题和方案讨论，不攻击贡献者。我们欢迎不同经验水平的参与者，也欢迎只提交一个清楚的问题、一个证据链接或一处文案修正。

## English

Thank you for contributing to ZhenXing AI Assistant.

Our goal is to make AI tools easier to discover, understand, install, configure, and verify without weakening security. We keep the client focused and lightweight: it is a setup and management center, not an autonomous project factory.

We welcome reproducible bug reports, usability improvements, first-party resource evidence, fixed and testable adapters, documentation, localization, accessibility work, and focused code changes.

Before opening a pull request:

1. Read `pc-client/CONTEXT.md` and the incident ledger.
2. Fix the root cause through the smallest existing shared seam.
3. Preserve user data and unrelated worktree changes.
4. Add one focused regression test for non-trivial logic.
5. Report checks and remaining real-device acceptance honestly.

Never submit secrets or user data, never turn catalog metadata into arbitrary local execution, and never present candidate or automated evidence as a formal release.

Contributions are accepted under [Apache License 2.0](LICENSE). Third-party components and content retain their own licenses and attribution requirements.
