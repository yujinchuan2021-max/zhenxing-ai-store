# 现有受管桌面包身份采样（Batch B）

采样日期：2026-08-04（Asia/Shanghai）  
范围：Kimi Work、Qoder CN IDE、腾讯元宝、CodeBuddy、WorkBuddy、QClaw  
边界：只下载并静态读取固定官方安装包，未执行任何安装器或应用；全部临时包在读取后立即删除。

## 结论

- 六款安装包的实测 SHA-256 均与客户端固定合同一致，Authenticode 均为 `Valid`。
- Kimi 在 0.1.35 Portable 中复现中文签名误判；同一官方包直采后证实 SHA、签名和产品身份均正确，归入 PowerShell 本地化输出编码问题。
- URL 或文件名里的 `x64` 不能替代真实 PE Machine：Kimi、Qoder、元宝、WorkBuddy 和 QClaw 都是 x86 引导壳；CodeBuddy 当前安装器才是 PE x64。
- 本文只解除下载器身份字段阻断；真实安装、打开、更新和卸载仍需 Windows 点击验收。

## 只读身份矩阵

| 产品 ID | 大小 | SHA-256 | PE | 签名主体 | 稳定 VersionInfo |
| --- | ---: | --- | --- | --- | --- |
| `kimi-work-desktop` | 445,358,224 B | `14edbc1bae32880bebef4937e918695b4ccb36077c084edf0eacc66cc811aec5` | x86 | `北京月之暗面科技有限公司` | `ProductName=Kimi` |
| `alibaba-qoder-cn-ide` | 191,062,352 B | `99c629dc111df2bea974e0c077a690b06f7651b95e4039ed01d9a60e51119aa4` | x86 | `BRIGHT ZENITH PRIVATE LIMITED` | `ProductName=Qoder`；`FileDescription=Qoder Setup`；`CompanyName=Qoder` |
| `tencent-yuanbao-desktop` | 53,486,128 B | `d3c7455cb9edfb70063c95f4b5ff36f980d4e299e07ccdd321304b537238ca51` | x86 | `Tencent Technology (Shenzhen) Company Limited` | `ProductName=元宝`；`FileDescription=腾讯元宝`；`CompanyName=Tencent` |
| `tencent-codebuddy` | 161,855,264 B | `fdb7342d8bb93c35b659cf67fd00ddeb8b7aa9747fbd0ad9e60bc4ae2791fd04` | x64 | `Tencent Technology (Shenzhen) Company Limited` | `ProductName=CodeBuddy`；`FileDescription=CodeBuddy Setup`；`CompanyName=Tencent Technology (Shenzhen) Company Limited` |
| `tencent-workbuddy` | 407,285,928 B | `c111bc3f54a0e53fa04924313ae660125eebffafcd5ac7722da7c3c03402cb7a` | x86 | `Tencent Technology (Shenzhen) Company Limited` | `ProductName=WorkBuddy`；`FileDescription=WorkBuddy Desktop - AI Agent Desktop Application`；发布者同签名主体 |
| `tencent-qclaw` | 568,771,520 B | `ee14abf8cab6b71359b1c7970c0cf9eadc047a01af63319dec614509e7de1c88` | x86 | `Tencent Technology (Shenzhen) Company Limited` | `ProductName=腾讯 QClaw`；`FileDescription=腾讯 QClaw`；`OriginalFilename=QClawDownload.exe`；`CompanyName=Tencent` |

Qoder 和 CodeBuddy 的 Windows VersionInfo 字段带右侧空格，因此客户端使用首尾空白容忍的锚定正则；不能改成包含匹配，也不能只匹配通用的 `Setup`。

## 官方固定入口

- Kimi：<https://kimi-img.moonshot.cn/app/download/windows/kimi_3.1.6.exe>
- Qoder CN：<https://qoder-ide.oss-accelerate.aliyuncs.com/release/1.20.1/QoderUserSetup-x64.exe>
- 腾讯元宝：<https://cdn-hybrid-prod.hunyuan.tencent.com/Desktop/official/dc75c2246b0b13c1ef8a120d56b297cf/yuanbao_2.77.1.612_x64.exe>
- CodeBuddy：<https://codebuddy-1328495429.cos.accelerate.myqcloud.com/aiide/win32-x64-user/CodeBuddy-win32-x64-user-4.10.4.33993995-1ba59196.exe>
- WorkBuddy：<https://download.codebuddy.cn/workbuddy/saas/win32-x64-user/WorkBuddy-win32-x64-user-5.3.8.34705286-e9991e2b.exe>
- QClaw：<https://package-cdn.qclaw.qq.com/qclaw/win/0.2.35-5001-624/QClaw-Setup-0.2.35-5001-624.exe>

## 发布门槛

1. 每款产品把本表的 PE 与 VersionInfo 投影到客户端本地生命周期合同。
2. 合同变化后重新生成独立审批指纹；后台不得下发 signer、PE、VersionInfo、卸载命令或打开命令。
3. 新客户端用同一系统网络完整重放至少一款中文签名包，证明 UTF-8 修复在封装环境生效。
4. 自动下载重放不等于真实安装生命周期验收。
