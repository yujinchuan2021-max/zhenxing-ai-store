# ADR-0005：枕星AI助手 品牌与兼容标识

状态：已采用

产品公开名称统一为“枕星AI助手”，英文名称为“ZhenXing AI Assistant”，官网域名为 `zhenxingai.com`。网站、PC 窗口、安装包、快捷方式、后台、社区和账号邮件均使用新品牌。

已有本地状态仍使用内部 `aihub` 协议名、IPC 名、环境变量、数据库名、安装收据格式、`com.aihub.desktop` 应用 ID 和 `%APPDATA%\AI Hub` 用户数据目录。这些字段不向用户表达品牌，只承担升级兼容；直接改名会导致旧用户丢失会话、下载记录、安装所有权或被安装为第二个应用。

新制品统一使用 `ZhenXing-AI-<version>-Windows-x64-*` 命名。旧制品只用于历史升级验收，不再作为新版本输出。

连接本机 Docker 签名目录的验收制品必须使用 `ZhenXing-AI-Local-<version>-Windows-x64-*`，不得与正式生产制品混用。
