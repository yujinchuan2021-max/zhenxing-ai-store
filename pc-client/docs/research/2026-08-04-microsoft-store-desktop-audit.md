# Microsoft Store 桌面产品审计（2026-08-04）

## 结论

本轮批准 6 个固定 `msstore` 源标识。现有原始快照中有 5 个候选完成了精确身份核验；Microsoft Copilot 在本机 `zh-CN` 环境不可见，但 [Microsoft Copilot 官方下载页](https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot)的 “Windows desktop app” 直接指向 Store 产品 `XP9CXNGPPJ97XX`，因此保留该固定 ID，同时必须显示地区不可用边界。

| 目录 `productId` | 固定 Store ID | 本机精确复核 | 身份结论 |
| --- | --- | --- | --- |
| `microsoft-copilot-desktop` | `XP9CXNGPPJ97XX` | `winget show --exact --source msstore` 未返回 | 微软官方下载页直达该 [Store 产品](https://apps.microsoft.com/detail/XP9CXNGPPJ97XX)；批准但标记地区可见性受限 |
| `raycast-windows` | `9PFXXSHC64H3` | Raycast / Raycast Technologies Ltd. | 与 [Raycast 官网](https://www.raycast.com/windows)和 [Store 产品](https://apps.microsoft.com/detail/9PFXXSHC64H3)一致 |
| `krisp-desktop` | `XP9D25XXG3SV5X` | Krisp 3.11.8 / Krisp Technologies, Inc | 与 [Krisp 官网](https://krisp.ai/)和 [Store 产品](https://apps.microsoft.com/detail/XP9D25XXG3SV5X)一致 |
| `voicemod-windows` | `XP9B0BH6T8Z7KZ` | Voicemod / Voicemod | 与 [Voicemod 官网](https://www.voicemod.net/)和 [Store 产品](https://apps.microsoft.com/detail/XP9B0BH6T8Z7KZ)一致 |
| `canary-mail` | `9MT5MZ5H9WL6` | Canary Mail App / Cartasec Pte. Ltd. | 与 [Canary Mail 官网](https://canarymail.io/downloads)和 [Store 产品](https://apps.microsoft.com/detail/9MT5MZ5H9WL6)一致 |
| `luminar-neo` | `9P7JQGL6GC8P` | Luminar Neo - AI Photo Editor / Skylum Software USA, Inc. | 与 [Luminar Neo 官网](https://skylum.com/luminar-download)和 [Store 产品](https://apps.microsoft.com/detail/9P7JQGL6GC8P)一致 |

这里批准的是“客户端可固定的产品身份与来源”，不是安装、启动、升级、卸载或真实用户环境验收已经完成。

## 输入与方法

- 原始输入：`output/catalog-research/microsoft-store-desktop-audit-raw.json`
- 原始快照时间：`2026-08-04T06:55:59.992Z`
- 原始文件 SHA-256：`28d753060ae229dbf27f98d92f684d0412fe3a07985d4382125e7aae8e7ae627`
- 原始范围：123 个 `desktop-official` 产品；24 个产品返回候选；33 个候选被检查；32 次 `show` 成功。
- 复核命令固定为 `winget show --id <固定 ID> --exact --source msstore --accept-source-agreements --disable-interactivity`。微软的 [`winget show` 文档](https://learn.microsoft.com/en-us/windows/package-manager/winget/show)说明该命令用于查看指定包详情。
- 逐项比较展示名、发布者、发布者官网和安装器类型；名称相似分数不作为批准证据。

原始 33 个候选可以闭合为：5 个本轮批准候选、15 个明确误匹配、1 个 SKU 选择边界、12 个身份看似成立但不属于本轮 6 项批准。Copilot 的批准证据来自微软官方下载页，因此不在原始候选 33 项内。

## 安装器类型边界

`msstore` 是查询与安装路由来源，不保证返回的每个产品都是原生 MSIX：

- Raycast、Canary Mail、Luminar Neo 当前返回 `Installer Type: msstore`，并回显相同的 `Store Product Id`。
- Krisp、Voicemod 当前从 `msstore` 源返回，但安装器类型是 `exe`；Krisp 返回厂商 CDN，Voicemod 返回 Microsoft Store 缓存域名。它们的固定 ID 可以作为 `msstore` 源标识，但客户端文案不能宣称其为原生 MSIX/Appx。
- Copilot 在当前地区无法读取安装器元数据，不能猜测其安装器类型。

## 明确误匹配（15）

| 目标产品 | 不可采用的候选 | 原因 |
| --- | --- | --- |
| Visual Studio | `XP9KHM4BK9FZ7Q` Visual Studio Code；`XP8LFCZM790F6B` Visual Studio Code - Insiders | VS Code 产品线不是 Visual Studio IDE |
| Visual Studio | `9MVLFK6TR4D4` Visual Studio / Code for Command Palette | UsefulApp 发布的第三方 Command Palette 扩展，不是 Visual Studio |
| goose Desktop | `XP8CD18BDTBP89` Escape Goose；`XPFNZL738X5GP7` Escape Goose Premium | Artieworks 游戏，与 AAIF/Nous 的 goose AI 桌面产品无关 |
| Read Desktop | `9WZDNCRFJVRW` Read Japanese；`9P5NS7R781P4` Koodo Reader；`9N0DGWH9PSZF` Reading Coach；`XP8984MS3PRZGF` WE Read；`9NBLGGH1XVD2` Fly Reader；`9WZDNCRFHWG5` Reader | 均不是 Read AI 的会议客户端；其中 WE Read 的精确 `show` 还失败 |
| AutoCAD | `9WZDNCRFJCTK` AutoCAD - DWG Viewer & Editor | Autodesk 查看/移动产品，不是目标 Windows AutoCAD 主产品 |
| Revit | `9MWHDHP59ZP8` Revit connector for SharePoint | CADtoWIN 连接器，不是 Autodesk Revit |
| SketchUp | `9MX4RQJ55NSZ` SketchUp for Schools | 教育/Web 产品形态，不是目标 Windows 桌面 SketchUp |
| Capacities | `9NSN399G59KM` Capacities Command Palette Extension | 第三方 Command Palette 扩展，不是 Capacities 桌面应用 |

`XPDCFJDKLZJLP8` Visual Studio Community 不是假冒结果，但目录中的宽泛 Visual Studio 目标没有确定授权 SKU、主版本和 workload，故不能把 Community 默认固定为目标产品。

## 身份看似成立但本轮未批准（12）

下列原始候选的名称、发布者或官网能够对应目标产品，但它们不在本轮已批准 6 项内；本报告不把“搜索到”升级成运行时白名单：

| 目录产品 | 候选 ID | 当前边界 |
| --- | --- | --- |
| `lovable-ai-app-builder` | `9P114TW5SBRG` | Store 身份看似成立，仍需单独评审桌面产品形态与生命周期 |
| `cyberlink-powerdirector` | `XPDM4ZR5KJ9JN9` | `msstore` 源返回 EXE；需单独确认版本、收据和卸载 |
| `cyberlink-photodirector` | `XPDNKZ6S9BVW9H` | `msstore` 源返回 EXE；需单独确认版本、收据和卸载 |
| `vegas-pro` | `XPFMMBD29XGD5B` | 对应 VEGAS Pro 23，但版本/SKU 生命周期尚未批准 |
| `snagit` | `XPDNSF6TXN2R6Z` | Store 源身份成立，但当前基线另选精确 WinGet 路由，避免双收据 |
| `nero-ai-video-upscaler` | `9PCT89LWP09X` | 身份成立，仍需 Nero 产品与启动器边界评审 |
| `hitpaw-vikpea` | `XPFCKS5T3JRK49` | `msstore` 源返回 EXE；生命周期未批准 |
| `hitpaw-fotorpea` | `XP8LGJ4RPLDLR6` | `msstore` 源返回 EXE；生命周期未批准 |
| `hitpaw-voicepea` | `XP9D25ZNK30P5Z` | `msstore` 源返回 EXE；生命周期未批准 |
| `hitpaw-edimakor` | `XPDCB09Q7WTPJJ` | `msstore` 源返回 EXE；生命周期未批准 |
| `paintshop-pro` | `9N6G6F7L1B43` | 身份成立，但版本、授权和生命周期未批准 |
| `sider-windows` | `9PF94J2D9F6X` | 发布者官网指向 Sider，但展示名已变为 AI File Analyst；需单独确认产品形态迁移 |

## 地区、账户与设备边界

- 当前机器的用户文化和 Windows 系统区域均为 `zh-CN`。在此环境下，5 个固定 ID 可由 `msstore` 精确查询，Copilot 不可见。这只是当前机器在当前时间的观测，不证明所有中国大陆账户或网络都得到相同结果。
- 微软明确说明，并非所有 Store 应用都在全球提供；应用还可能因账户、家庭设置、下架状态或设备兼容性而不可见。[Microsoft Store 无法找到或安装应用](https://support.microsoft.com/en-US/accounts-billing/i-can-t-find-or-install-an-app-from-microsoft-store)
- 微软也提示不同地区获取的项目可能无法在另一地区工作，不应为了绕过产品限制自动切换用户的国家或地区。[更改 Microsoft Store 国家或地区](https://support.microsoft.com/en-us/account-billing/change-your-country-or-region-in-microsoft-store-5895e006-34f4-10f7-16b1-999e40adb048)
- Copilot 官方页进一步说明，功能和应用可用性会随年龄、地区、设备类型和浏览器版本变化，部分功能需要 Microsoft 账户登录。
- 因此，“固定 Store ID”不等于“当前地区一定可安装”。客户端应保留现有 Store 网络/修复提示，但不能自动改 VPN、代理、账户地区、系统地区、Store 服务或注册表。

## 交付边界

本轮只新增审计文档和机器可读核验结果，没有修改运行时代码、静态白名单或 `admin/data/catalog-v1.json`。机器可读结果位于 `output/catalog-research/microsoft-store-desktop-verified.json`。
