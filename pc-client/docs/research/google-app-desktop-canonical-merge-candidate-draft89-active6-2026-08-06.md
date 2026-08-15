# Google app for desktop canonical merge candidate

状态：`candidateOnly=true`、`publishable=false`。唯一输入是同目录的 intake candidate；本文件仅固化通过内存校验的单项合并。

- 前置：draft revision 89；v2 active 6；release `catalog-v00000006-567e671621f1-3dcee587`。
- 操作：仅向既有 `google` 厂商追加 `google-app-desktop`；不修改其他 615 个产品或 146 个资源。
- 合同：`desktop-download-only.signed-catalog`、HTTPS `GoogleAppInstaller.exe`、`exe`、无镜像。允许主机由已签名 artifact URL 唯一派生；不记录 `allowedHosts`。
- 内存验证：`validateCatalog`、`validatePublication`、单项 desktop acquisition matrix、ID/厂商/顺序/搜索检查均通过；预期 616 个产品、146 个资源。
- 禁止：候选不是保存或发布授权；不得加入 command、args、env、headers、script、credentials 或其他执行字段。
