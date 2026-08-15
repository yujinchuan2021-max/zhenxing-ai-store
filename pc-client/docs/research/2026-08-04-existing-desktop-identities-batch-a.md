# 现有受管桌面包身份采样（Batch A）

采样日期：2026-08-04（Asia/Shanghai）  
客户端：`枕星 AI 0.1.35 Windows x64 Portable`  
范围：`jianying`、`trae-desktop`、`trae-solo-cn`、`bytedance-doubao`、`google-antigravity-desktop`、`cursor-desktop`

## 结论

- 六个官方固定包的实测 SHA-256 都与客户端本地固定合同一致；不存在 CDN 内容漂移。
- `google-antigravity-desktop` 与 `cursor-desktop` 通过 0.1.35 Portable 的完整下载、SHA、Authenticode 与身份校验，任务进入 `completed`。
- `jianying`、`trae-desktop`、`trae-solo-cn`、`bytedance-doubao` 都完整取得了与固定 SHA 一致的官方包，但 0.1.35 Portable 在 Authenticode 发布者合同处拒绝，统一返回 `DOWNLOADED_INSTALLER_INVALID` / `安装包签发者与产品安全契约不匹配`。本次只记录这个可复现事实，不推测拒绝原因。
- 六款安装器均未执行。隔离 Portable 下载目录和补充直采目录均已清理；复核时 `%TEMP%` 下相关残留目录计数均为 `0`。

当前固定合同来源：[`shared/windows-desktop-catalog.cjs`](../../shared/windows-desktop-catalog.cjs#L171-L285)。完整下载与只读身份采样入口：[`scripts/reproduce-packaged-managed-download.mjs`](../../scripts/reproduce-packaged-managed-download.mjs#L24-L155)。

## 0.1.35 Portable 重放结果

逐项串行执行，避免 Electron 单实例/CDP 端口互相干扰：

```powershell
$env:AIHUB_LOCAL_RELEASE_CLIENT='C:\Users\yujin\Documents\AI hub\pc-client\release-review-0.1.35-complete\ZhenXing-AI-Local-0.1.35-Windows-x64-Portable.exe'
$env:AIHUB_DOWNLOAD_REPRO_TIMEOUT_MS='1800000'
node scripts/reproduce-packaged-managed-download.mjs <product-id> --complete --report-identity
```

| 产品 ID | Portable 最终状态 | 任务/实包大小 | SHA-256 | 与固定合同一致 |
|---|---|---:|---|---|
| `jianying` | `failed`：签发者合同不匹配 | 610,062,936 B | `439ea7cb0fd6815806fe952b82aa28142cc0461214d60fdd30dd5d3e8006f579` | 是（同一官方固定包只读复核） |
| `trae-desktop` | `failed`：签发者合同不匹配 | 361,985,768 B | `2fc70f0a68f5269e232d8aa92c5ca4b3f7514a34bb321ea2784a9c2ff8428379` | 是（同一官方固定包只读复核） |
| `trae-solo-cn` | `failed`：签发者合同不匹配 | 351,167,768 B | `f15b4430d74195156f37de03164c6f27e14306024f1e0962aa9dab2084bce8e1` | 是（同一官方固定包只读复核） |
| `bytedance-doubao` | `failed`：签发者合同不匹配 | 587,912,592 B | `7269365d3ecd4d432b9ef685f44de92ac02af384b7d8c2f781809fcc989434ed` | 是（同一官方固定包只读复核） |
| `google-antigravity-desktop` | `completed` | 138,067,936 B | `82dc656c6922ec52b7c1e6c1475464a4fdb0dd7bded00b596e6a490405e22d50` | 是 |
| `cursor-desktop` | `completed` | 198,259,360 B | `93b3ad1b9971c8ff9be18fc9c46d592749e47ea6d2e3711efe6d5a9d4091877f` | 是 |

失败任务按下载器合同会清空 `filePath`、`sha256` 和 `fileSize`，因此前四项在同一固定 URL 上补做了只读直采。直采仅下载、计算 SHA、读取签名/PE/VersionInfo，随后删除临时文件；没有启动 EXE。

## 只读身份明细

### 剪映专业版（`jianying`）

- 官方固定包：<https://lf3-package.vlabstatic.com/obj/faceu-packages/Jianying_11_1_0_14287_jianyingpro_0_creatortool.exe>
- 本地合同：[`windows-desktop-catalog.cjs:171-190`](../../shared/windows-desktop-catalog.cjs#L171-L190)
- 大小 / SHA-256：`610,062,936` B / `439ea7cb0fd6815806fe952b82aa28142cc0461214d60fdd30dd5d3e8006f579`
- Authenticode：`Valid`；Subject：`CN=深圳市脸萌科技有限公司, O=深圳市脸萌科技有限公司, L=深圳市, S=广东省, C=CN, ...`
- PE Machine：`0x8664`（`34404`，x64）
- VersionInfo：
  - `ProductName=剪映专业版`
  - `FileDescription=JianyingPro`
  - `OriginalFilename=JianyingPro`
  - `CompanyName=ByteDance`
  - `ProductVersion=11.1.0.14287`
  - `FileVersion=11.1.0.14287`

### TRAE（`trae-desktop`）

- 官方固定包：<https://lf-cdn.trae.com.cn/obj/trae-com-cn/pkg/app/releases/stable/2.3.62837/win32/Trae_CN-Setup-x64.exe>
- 本地合同：[`windows-desktop-catalog.cjs:191-209`](../../shared/windows-desktop-catalog.cjs#L191-L209)
- 大小 / SHA-256：`361,985,768` B / `2fc70f0a68f5269e232d8aa92c5ca4b3f7514a34bb321ea2784a9c2ff8428379`
- Authenticode：`Valid`；Subject：`CN=北京引力弹弓科技有限公司, O=北京引力弹弓科技有限公司, S=北京市, C=CN, ...`
- PE Machine：`0x014c`（`332`，x86 bootstrapper）
- VersionInfo：
  - `ProductName=Trae CN`
  - `FileDescription=Trae CN Setup`
  - `OriginalFilename=`（空）
  - `CompanyName=Beijing Yinli Catapult Technology Co., Ltd.`
  - `ProductVersion=3.3.83`
  - `FileVersion=3.3.83`

### TRAE Work（`trae-solo-cn`）

- 官方固定包：<https://lf-cdn.trae.com.cn/obj/trae-com-cn/pkg/app/releases/stable/2.3.62834/win32/TRAE_Work_CN-Setup-x64.exe>
- 本地合同：[`windows-desktop-catalog.cjs:210-228`](../../shared/windows-desktop-catalog.cjs#L210-L228)
- 大小 / SHA-256：`351,167,768` B / `f15b4430d74195156f37de03164c6f27e14306024f1e0962aa9dab2084bce8e1`
- Authenticode：`Valid`；Subject：`CN=北京引力弹弓科技有限公司, O=北京引力弹弓科技有限公司, S=北京市, C=CN, ...`
- PE Machine：`0x014c`（`332`，x86 bootstrapper）
- VersionInfo：
  - `ProductName=TRAE Work CN`
  - `FileDescription=TRAE Work CN Setup`
  - `OriginalFilename=`（空）
  - `CompanyName=Beijing Yinli Catapult Technology Co., Ltd.`
  - `ProductVersion=0.1.43`
  - `FileVersion=0.1.43`

### 豆包桌面版（`bytedance-doubao`）

- 官方固定包：<https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao_pc/2.20.9/Doubao_installer_2.20.9.exe>
- 本地合同：[`windows-desktop-catalog.cjs:229-247`](../../shared/windows-desktop-catalog.cjs#L229-L247)
- 大小 / SHA-256：`587,912,592` B / `7269365d3ecd4d432b9ef685f44de92ac02af384b7d8c2f781809fcc989434ed`
- Authenticode：`Valid`；Subject：`CN=北京春田知韵科技有限公司, O=北京春田知韵科技有限公司, S=北京市, C=CN, ...`
- PE Machine：`0x8664`（`34404`，x64）
- VersionInfo：
  - `ProductName=Doubao Installer`
  - `FileDescription=Doubao Installer`
  - `OriginalFilename=Doubao Installer.exe`
  - `CompanyName=Beijing Chuntian Zhiyun Technology Co., Ltd.`
  - `ProductVersion=2.20.9`
  - `FileVersion=2.20.9`

### Google Antigravity（`google-antigravity-desktop`）

- 官方固定包：<https://storage.googleapis.com/antigravity-public/antigravity-hub/2.4.3-4510119262814208/windows-x64/Antigravity-x64.exe>
- 本地合同：[`windows-desktop-catalog.cjs:248-266`](../../shared/windows-desktop-catalog.cjs#L248-L266)
- 大小 / SHA-256：`138,067,936` B / `82dc656c6922ec52b7c1e6c1475464a4fdb0dd7bded00b596e6a490405e22d50`
- Authenticode：`Valid`；Subject：`CN=Google LLC, O=Google LLC, L=Mountain View, S=California, C=US, ...`
- PE Machine：`0x014c`（`332`，x86 bootstrapper）
- VersionInfo：
  - `ProductName=Antigravity`
  - `FileDescription=Antigravity - Agentic Desktop Application`
  - `OriginalFilename=`（空）
  - `CompanyName=Google`
  - `ProductVersion=2.4.3`
  - `FileVersion=2.4.3`

### Cursor（`cursor-desktop`）

- 官方固定包：<https://downloads.cursor.com/production/a758f2241ca99fecf380180b6cbdbbce0f1f42cf/win32/x64/user-setup/CursorUserSetup-x64-3.14.7.exe>
- 本地合同：[`windows-desktop-catalog.cjs:267-285`](../../shared/windows-desktop-catalog.cjs#L267-L285)
- 大小 / SHA-256：`198,259,360` B / `93b3ad1b9971c8ff9be18fc9c46d592749e47ea6d2e3711efe6d5a9d4091877f`
- Authenticode：`Valid`；Subject：`CN="Anysphere, Inc.", O="Anysphere, Inc.", L=San Francisco, S=California, C=US`
- PE Machine：`0x014c`（`332`，x86 bootstrapper）
- VersionInfo：
  - `ProductName=Cursor`
  - `FileDescription=Cursor Setup`
  - `OriginalFilename=`（空）
  - `CompanyName=Anysphere`
  - `ProductVersion=3.14.7`
  - `FileVersion=3.14.7`

## 后续合同修复输入

本次证据只支持以下动作：

1. 为六个固定包补齐真实 PE Machine 与稳定 VersionInfo 字段；`architecture` 必须描述下载器 EXE 的 PE Machine，而不是 payload 或文件名中的 `x64`。
2. 对前四款逐一修复当前发布包的签发者匹配合同，并用同一条 0.1.35 Portable 重放命令回归；在任务进入 `completed` 之前不能宣称下载闭环通过。
3. 本文不覆盖安装界面、UAC、真实安装、打开、更新或卸载验收。
