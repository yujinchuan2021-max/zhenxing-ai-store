# AI Hub 社区开源方案候选

更新时间：2026-07-28

当前已选择 Flarum 作为社区 MVP 的预发布方案。最终社区地址通过 CMS 的独立“社区设置”进入 PC 客户端，客户端只负责打开论坛网站，不保存论坛凭据。

## 候选方案

| 方案 | 技术与部署 | 优点 | 代价 | 适合阶段 |
| --- | --- | --- | --- | --- |
| Discourse | Ruby on Rails、PostgreSQL、Redis；官方生产部署以 64 位 Linux + Docker 为主 | 功能最完整、社区生态成熟、内置聊天和扩展体系 | 服务器和运维成本最高，官方建议至少 1 GB 内存并配置 swap | 社区已经确定长期运营 |
| Flarum | PHP；MIT 许可；响应式界面和扩展 API | 界面简洁、部署和资源成本相对低、适合先做论坛 | 大型社区治理能力和成熟度需要结合插件再评估 | AI Hub 社区 MVP |
| NodeBB | Node.js 22+；MongoDB、Redis 或 PostgreSQL；支持 Docker | 与 AI Hub 的 JavaScript 技术栈接近，实时通知和 API 能力强 | 仍需独立数据库与长期升级维护，GPL-3.0 | 需要实时互动和深度账号集成 |

## 当前建议

- 当前预发布实现固定使用 Flarum `2.0.0-rc.5`，部署骨架位于 `community/flarum/`。
- Docker 镜像已完成构建与 Apache/PHP 扩展验证，但没有启动数据库、创建管理员或对公网开放。
- Flarum 2.0 仍处于 RC 阶段，不能把本次镜像验证视为生产验收。
- 如果目标是长期运营、板块治理和内容沉淀：优先选择 Discourse。
- 如果后续确定要与 AI Hub 账号、通知和产品数据深度打通：再选择 NodeBB。

## 官方依据

- Discourse：https://github.com/discourse/discourse
- Discourse 官方安装要求：https://github.com/discourse/discourse/blob/main/docs/INSTALL.md
- Flarum：https://github.com/flarum/flarum
- NodeBB：https://github.com/NodeBB/NodeBB

## 上线前仍需决定

1. 正式域名、HTTPS 反向代理和服务器。
2. 邮件发送服务以及注册、找回密码策略。
3. 社区账号是否必须和 AI Hub 账号互通。
