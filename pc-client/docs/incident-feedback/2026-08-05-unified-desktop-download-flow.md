# 2026-08-05 统一桌面下载流程实施记录

本轮仅收敛共享调用链：有客户端批准的稳定直链时执行“一键下载 → 点击安装”，无直链时打开厂商官方下载页；普通桌面不再以包管理器作为回退。

- 下载完成只保留当前文件路径和用户触发的打开动作；EXE/MSI/MSIX 交给厂商安装器，ZIP 只打开压缩包。
- 慢速传输继续等待；只有无数据或连接失败才按批准计划尝试镜像。
- 取消、失败、文件缺失继续通过共享任务收敛；取消回到一键下载，失败可删除。
- Msty Go、Stability Matrix、Audacity 均复用同一共享映射；未修改目录内容、执行合同或 CLI。

自动回归：`product-install-presentation`、`task-center-lifecycle`、`managed-download-reliability`、`managed-download-refresh`、`windows-desktop-catalog`、`windows-package-manager-policy` 聚焦测试通过。真实 Windows 点击、厂商安装向导和文件删除后的刷新仍待实机验收。

## 2026-08-05 desktop-download-only first-task recovery

- Symptom: the first approved DeepL download returned `starting` with an attempt ID, but every later product-ID-only task lookup returned `null`; therefore the real cancel/retry scenario could not reach the shared cancellation flow.
- Cause: dynamic `desktop-download-only` artifacts were checked at IPC start but the partial and completed managed receipts did not retain the artifact kind. Later plan reconstruction passed the whole receipt to the strict artifact validator, which correctly rejected its receipt-only fields.
- Fix: persist only the approved artifact summary (`url`, `fileName`, `artifactKind`) in the managed partial/completed receipts. Reconstruct only that three-field summary and validate it again against the fixed local product profile before get, cancel, retry, or reconciliation proceeds.
- Safety: frontend artifacts remain strict three-field HTTPS inputs; receipt reconstruction never reads commands, arguments, headers, or credentials and does not widen any allowed host.
- Verification: focused desktop-download-only, product-install-presentation, and task-center lifecycle tests cover initial recovery, cancellation cleanup, a fresh attempt, and return to download after a missing local file. Existing receipts without an approved summary are safely non-recoverable and require a new catalog-authorized download.
- Remaining acceptance: repeat the packaged Windows CDP flow with a new profile—start, observe downloading, confirm cancel, observe removal, then start and cancel a second attempt—without completing a vendor download or installer launch.

## 2026-08-05 desktop-download-only legacy gate mismatch

- Symptom: after task recovery was corrected, an approved DeepL artifact could still fail before its first byte because the shared downloader sent its `managedProductId` through the legacy `MANAGED_DOWNLOADS` gate. The 14 download-only profiles deliberately are not legacy managed-download entries.
- Fix: only the fixed `desktop-download-only` profile path omits the legacy product-ID gate and sends its already validated plan `allowedHosts` to the existing final-URL gate. Legacy managed-download and environment plans keep their existing legacy gate unchanged.
- Verification: a red test was added first, then covers all 14 profiles: approved profile host accepted, unapproved host and frontend execution fields rejected, and no product-specific exception. Focused download, task-center, presentation, and network tests pass with syntax checks.
- Remaining acceptance: the packaged CDP cancellation scenario remains required; this change does not download, install, or package anything.

## 2026-08-05 desktop-download-only entry authorization mismatch

- Symptom: the 0.1.43 candidate could load the remote catalog but rejected a valid `deepl-desktop` download at the IPC admission boundary as not being in the client installer allowlist.
- Cause: the generic fresh-catalog admission only checked product capability, while the download entry had no exact shared authorization seam for the fixed download-only profile, current catalog artifact, and local action context. The legacy managed-download ID was not a valid identity for these 14 profiles.
- Fix: add a download-only admission seam that requires one enabled remote catalog product, exact `desktop-download-only` module and install profile, fixed local vendor/profile, and exact three-field artifact equality after local HTTPS/host/file/type validation. `download:start` and download-only `download:refresh` use it; legacy managed, environment, and Store paths remain unchanged.

## 2026-08-05 stale desktop action copy after package-manager migration

- Symptom: products already migrated from package-manager installation to an official Windows download page still displayed backend-authored `一键安装` labels.
- Cause: the catalog migration changed the execution policy but retained historical `entryPoints[].label` copy, and the client treated action copy as backend-owned even though execution meaning is client-owned.
- Fix: the shared entry-point module now derives desktop action copy from the validated download policy for every product: `official-page` becomes `前往官网下载`, while fixed `client-managed` and `desktop-download-only` artifacts become `一键下载`. Backend link labels and order remain configurable; backend data still cannot add URLs or commands to action entries.
- Boundary: this does not turn an official page into a managed artifact. A real one-click download still requires a fixed official HTTPS artifact, filename, type, and client-owned allowed host.
- Verification: red test first, then all 14 profiles allowed. Forged module/product type/profile, cross-host artifact, execution fields, and a same-host but catalog-mismatched frontend artifact fail closed. Focused entry, action-context, download, lifecycle, and presentation tests pass with syntax checks.

## 2026-08-05 signed catalog universal desktop-download admission

- Symptom: every new desktop artifact had to be added to a client-side per-product profile before the existing shared download path would admit it, leaving catalog-approved official artifacts unable to become a real one-click download.
- Fix: the canonical generic module and profile ID are both `desktop-download-only.signed-catalog`. A current remote catalog must exactly match the product identity, module, profile ID, and pure `download` object before IPC starts a download. The object permits only HTTPS `url`, path-free `fileName`, `artifactKind` (`exe`, `msi`, `msix`, `zip`), and optional unique HTTPS mirror URLs; user names/passwords and all execution fields are rejected. Mirrors are used only through the existing no-data/unreachable fallback path.
- Compatibility: the 14 existing `desktop-download-only.<productId>` profiles retain their stricter local vendor, host, and artifact-kind constraints. Legacy managed downloads, CLI, Store, and lifecycle capabilities are unchanged. The generic module exposes only website/tutorial/install; install means user-opened EXE/MSI/MSIX/ZIP after download, never automatic installation or detection.
- Candidate review: the sole research candidate, Tana (`https://assets.tana.inc/desktop/Tana-Setup-windows.exe`, `Tana-Setup-2026.29.20+c0082d7-windows.exe`, EXE), now names the canonical module/profile and remains candidate-only. Raw draft84 and immutable signed v2 active1 both contain 615 products; the earlier 614/draft-only claim was stale. Tana remains `desktop-official`/`official-page` in both until a later revision-checked bind.
- Verification: red tests cover generic signed admission without a per-product client profile, exact catalog equality, HTTPS/credentials/path/type/mirror rejection, forged module/profile/execution-field rejection, fixed-profile compatibility, and shared mirror fallback plan construction; focused policy/action-context/presentation tests and syntax checks pass.

## 2026-08-05 signed module-ID compatibility

- Symptom: the finalized generic catalog contract uses `moduleId=desktop-download-only.signed-catalog`, while policy validation, action-context creation, and fresh IPC authorization still required the historical `desktop-download-only` ID. A valid signed artifact therefore displayed in the UI but failed before download admission.
- Fix: the stable signed module ID is accepted only for products without one of the 14 fixed profiles. The historical ID remains compatible only for those fixed profiles, which still require their exact local vendor, host, and artifact-kind policy. Generic records still require the stable profile ID plus exact current remote-catalog artifact equality.
- Verification: red-to-green tests cover a stable-ID Tana-shaped artifact, reject the historical ID for a non-profile product, retain all fixed-profile checks, and reject execution fields. Focused UI/entry/download authorization/policy/action-context tests, JavaScript syntax checks, and TypeScript lint pass.

## 2026-08-05 running admin stale-module snapshot

- Symptom: after the v2 catalog was published as active2, the running local admin/release process still rejected a valid `nvidia-canvas` desktop-download-only artifact. This was a runtime process snapshot failure, not a draft, signature, or client-channel failure.
- Safe evidence: CIM identified the exact old process as `C:\Program Files\nodejs\node.exe scripts/start-local-admin.cjs`, with cwd in this workspace's `pc-client` and the only workspace start script at `pc-client/scripts/start-local-admin.cjs`; PID 34772 owned the 127.0.0.1:4173 listener. The 4443 Caddy/release process was a separate PID and was not targeted.
- Repair: only PID 34772 and its explicitly associated child process group were stopped. The formal `pc-client/scripts/start-local-admin.cjs` was relaunched from `pc-client` with a hidden window, producing PID 25020. No other service, container, user process, draft, history, or active pointer was touched.
- Verification: both `http://127.0.0.1:4173/channels/v2/catalog-release.json` and `https://localhost:4443/channels/v2/catalog-release.json` returned HTTP 200 with the same 874,078-byte envelope and SHA-256 `b8ae0cf8bf16627e17ebfa6fbeeaa629f3655232bd5a072f13f950026ef1af2f`. Both report catalogVersion 2, 375 vendors, 615 products, 35 `desktop-download-only`, 193 `desktop-official`, and 146 resources.
- Prevention: local acceptance must verify the running admin process source/cwd and compare both endpoint envelope hash and catalogVersion with the authoritative active channel after every local catalog publish; a stale process must block acceptance until the exact local script is restarted.

## 2026-08-05 migrated desktop identity inheriting package-manager lifecycle

- Symptom: a product ID that had moved to the signed catalog or official-page desktop contract could still inherit capabilities and install mode from an older local Winget/package-manager registration.
- Cause: shared behavior and installed-product projection selected the registry by product ID alone, without requiring the current catalog product type/module/profile to match that registration.
- Fix: registry capabilities and lifecycle are now used only when the catalog identity matches the registered product type and any explicitly supplied module/profile. A canonical signed-catalog product therefore exposes only website/tutorial/install, while a current official-page product exposes no local install/open/uninstall action; the 14 fixed profiles remain separately host/vendor/type constrained.
- Verification: focused matrix covers msty-studio official-page versus canonical migration, fixed-profile rejection/acceptance, installed-management projection, canonical/fixed/reviewed/Store behavior, and download/task/install presentation. No catalog, state, release, or package was changed.
- Evidence boundary: draft85/v2 active2 contains 615 products and 265 Windows-desktop products; authoritative strategy counts are 21 canonical signed-catalog, 14 fixed legacy profiles, 36 reviewed managed installers, 1 Store bootstrapper (ChatGPT), and 193 official-page records. The independent coverage scan reports 85 direct-artifact candidates, 69 official-page, 110 dynamic/unresolved, and 1 Store; candidates not represented by an approved client contract remain official-page/blocked and are not promoted by this fix. Upscayl remains blocked after the reported 404.

## 2026-08-05 canonical signed receipt lifecycle marker

- Symptom: a canonical `desktop-download-only.signed-catalog` download could be authorized and start in memory, but its partial/completed receipt was written as an unmarked generic record. After a process or task-map loss, product-ID-only cancel, retry, reconcile, and missing-file recovery could not reconstruct the trusted artifact.
- Cause: `buildSignedDesktopDownloadPlan` omitted the `signedCatalogDownload` marker even though receipt reconstruction correctly required that marker before accepting the stored URL, filename, artifact kind, and mirror list.
- Fix: canonical plans now carry the same marker as the fixed download-only plan. The existing managed receipt writer therefore persists the approved artifact summary and lifecycle lookup revalidates it through the signed-catalog validator; no URL, command, header, credential, or host input is accepted from the renderer.
- Verification: the focused data-driven desktop matrix covers fixed and canonical plans, signed receipt recovery, user-opened EXE/MSI/MSIX/ZIP presentation, cancel/retry/file-loss task behavior, Store repair isolation, and existing package-manager policy. The canonical plan assertion fails if the marker is removed.
- Strategy boundary: active3/draft86 audits 265 Windows desktop products (37 reviewed, 174 official, 54 download-only). Only a catalog record with an approved direct HTTPS artifact becomes a client download. Vendor bootstrap, Store, login-required, manual-selector, and official-page routes remain external user-driven flows with no installation receipt, detection, open, or uninstall claim until their owning catalog and renderer contracts are implemented.

## 2026-08-05 acquisition precision fallback gate

- Symptom: PortraitPro and Raycast on active4/draft87 both rendered the generic official-download-page entry, although the user reported a vendor-installer flow for PortraitPro and existing local Store audit evidence identifies Raycast Store ID `9PFXXSHC64H3`.
- Evidence: `node scripts/check-desktop-acquisition-matrix.cjs <active4 release> tests/fixtures/desktop-acquisition-user-report-matrix.json` intentionally exits 1 and reports both current `download-page` values against expected `vendor-bootstrap` and `store`. The Raycast Store identity is independently recorded in `windows-package-manager-catalog.cjs` and the 2026-08-04 Store audit. PortraitPro has no locally approved bootstrap record yet; its matrix row is a user-report regression expectation, not authorization to bind a catalog candidate.
- Fix: add a pure acquisition-matrix gate for directory candidates. It compares the current catalog's real action kind and URL with review evidence, rejects duplicate/non-desktop/invalid-URL rows, and, when `complete:true`, requires every 263 current desktop record plus each reclassified `web/no-windows` record exactly once. `vendor-bootstrap` now requires an explicit coverage set containing the selected product, so a shared installer cannot silently lose the product relationship.
- Boundary: all eight external kinds already validate through catalog policy and render as an external `window.open` action, never a download task, installer launch, receipt, detection, open-product, or uninstall claim. Login-required remains a fixed external route and is not optimized or used as a blocker in this incident.
- Remaining acceptance: directory must supply a revision-87, complete evidence matrix. It may bind Raycast as Store only after backend approval; it must supply reviewed first-party vendor-bootstrap evidence and coverage for PortraitPro before changing that record. Frontend must render `coveredProductIds` if the user-facing bootstrap coverage list is required; the shared policy now guarantees the field exists.

## 2026-08-06 fixed-profile receipt sources and unknown-size streams

- Symptoms: in the 0.1.50 Windows package, Filmora, EdrawMax, EdrawMind, and PDFelement failed on redownload with `Cannot read properties of undefined (reading 'slice')`; Blender stopped before downloading with `无法确认安装包大小，已停止下载`.
- Root causes: the fixed `desktop-download-only` plan marked its receipt as signed but omitted the normalized `sources` array later serialized by both first-download and replacement paths. Separately, disk preflight treated a missing `Content-Length` as a terminal `SIZE_UNKNOWN` error before the response body could stream.
- Excluded hypotheses: the Wondershare failure occurs while serializing the authorized plan before replacement commit, so it is not replacement-receipt cleanup or a product-specific dossier failure. A known-size response already passes the same disk preflight, while the no-length fixture fails there before reading data, excluding the Blender URL gate and body reader as the trigger.
- Shared fix: fixed profiles now produce the same immutable official-source array shape as canonical plans. Unknown-size downloads require the configured reserve instead of a declared total, then recheck available space plus the next chunk before every write; known-size preflight remains unchanged, and write-stream `ENOSPC`, cancellation, task persistence, path isolation, HTTPS, and approved-host gates remain active.
- Automated evidence: all four active5 Wondershare product shapes fail at the same missing-source boundary before the fix and pass independently after it; a 200 streaming response without `Content-Length` now writes all fixture chunks, while a chunk that would consume the reserve is rejected. Focused download state-machine, disk, network, desktop-download-only, and task-center tests are the release gate.
- Remaining acceptance: rebuild is outside this change. A later Windows candidate must redownload one fixed-profile Wondershare product and stream the Blender MSI from its real server, then verify cancel/retry and low-space messaging without launching either installer.

## 2026-08-06 canonical catalog priority over stale Winget detection

- Symptom: the 0.1.51 Portable candidate rendered `detection-error` instead of the one-click download action for active5 `microsoft-power-bi-desktop`, `alibaba-quark-ai-browser`, and `alibaba-dingtalk-ai`, despite each having an enabled canonical signed-catalog artifact.
- Cause: `detectDesktopProduct()` looked up a historical static Winget registration by product ID before inspecting the currently resolved catalog contract. The reused IDs therefore ran the old package-manager detector and could report `unknown` when its inventory was unavailable.
- Fix: the shared action-context module now identifies only an enabled, artifact-valid `desktop-download-only.signed-catalog` product. The desktop detector returns an explicitly absent, non-managed status before the legacy Winget branch for that verified contract. Batch inventory resolves the catalog once and excludes only these canonical collisions from its Winget snapshot; all other static Winget products retain the prior detector.
- Verification: a red-to-green active5 fixture executes the real detector function body with a colliding legacy Winget row. All three canonical IDs retain fresh download authorization and `canInstall`, return `absent`, and make zero Winget detector calls. The legacy Winget control still makes one call. A batch fixture proves the same verified catalog snapshot is passed through and disables the Winget scan only when every scanned collision is canonical. Focused detection, policy/action-context, download-only, installed-management, and task-center tests plus syntax checks pass.
- Remaining acceptance: a rebuilt Windows candidate must verify all three cards render the install-product one-click download state without `detection-error`; this code change does not download or install a third-party package.

## 2026-08-06 Quark versioned direct artifact drift

- Symptom: active5 `alibaba-quark-ai-browser` had a canonical versioned CDN EXE that now returns 404 before the first download byte.
- Evidence and decision: first-party review verified the exact HTTPS stable entry `https://download.quark.cn/download/quarkpc?ch=pcquark@default` redirects to the current official Windows EXE. It is therefore an external `stable-redirect`, not a replacement managed direct artifact and not a package-manager fallback.
- Fix: add only that exact entry to Quark's fixed reviewed sources in the client-owned package-manager dossier. The existing origin validator now accepts a future `desktop-official` candidate using this URL; arbitrary subdomains, URLs, commands, and download task/receipt creation remain rejected or absent.
- Verification: the active5-shaped candidate was red with `officialDownload origin rejected`, then green after the fixed source update. A hostile `evil.quark.cn` candidate remains rejected. Focused official-download, dossier, package-manager, acquisition matrix, and product-policy tests pass.
- Remaining acceptance: backend must create and approve the revision-88/active5 candidate before catalog publication; no catalog, state, save, publication, package, download, or installation occurred here.

## 2026-08-06 discovery harness terminal-action and channel attribution

- Symptom: the 0.1.52 discovery labeled thirteen direct products as missing a one-click control and could not find Asana or ClickUp rows.
- Cause: its direct branch read the product card immediately after render and required only `install-product`, before asynchronous desktop detection could choose either the first-install or valid reinstall action. Its search navigation selected the first vendor ID without retaining the product's directory kind; Asana and ClickUp both have an `ai-tool` and an `ai-connectable` projection.
- Fix: the packaged acceptance helper waits for either enabled terminal action (`install-product` or `refresh-product`) and the navigation helper optionally selects the exact search-result directory. The active5 script supplies the product directory kind. No renderer, desktop product, receipt, source, or catalog contract changed.
- Evidence: Filmora's isolated smoke already recorded `install-product`, authorized bytes, pause, and retry. The exact active5 shapes show Asana and ClickUp are `ai-connectable`; Docker's external Winget inventory correctly implies `refresh-product`. The 15-row attribution is recorded beside the discovery report.
- Remaining acceptance: rerun the full discovery only after the user client has closed, because the acceptance gate refuses to reuse or terminate an active user session. Automated reruns are still not user-machine acceptance.

## 2026-08-06 exact external stable-redirect approvals

- Symptom: Fireflies, Pieces, and Zoom first-party stable redirect candidates were correctly rejected because their external entry origins were not in a client-owned approval.
- Fix: three immutable exact URLs are stored separately from execution profiles. External `stable-redirect` URLs outside a product website origin must now match an approved full URL, including path and query; this does not authorize a download task, executable, command, header, credential, or final CDN host.
- Verification: red test first failed without the approval registry; it now accepts each exact entry and rejects a same-origin URL with a changed query. Quark's existing exact stable redirect stays valid.
- Remaining acceptance: backend may only bind those candidates after its separate revision check and explicit authorization; no catalog/state save, publication, package, or third-party download occurred here.

## 2026-08-06 fixed download profile degraded by inconclusive Winget inventory

- Symptom: the 0.1.53 Portable initially rendered Filmora's one-click download, then replaced it with an installation-detection error and no managed action attribute.
- Cause: the enabled active6 product and its fixed download profile/artifact were valid, but the same product ID retained a historical Winget inventory profile. Unlike canonical signed-catalog products, fixed download profiles did not distinguish a conclusive installed result from an inconclusive Winget scan; `unknown` therefore overrode the usable download action.
- Fix: a current enabled fixed `desktop-download-only` contract is recognized only through its existing local profile/vendor/artifact validation. Its legacy Winget result is preserved when installed, but only `unknown` is normalized to absent so the download remains available. Canonical products still bypass Winget, and non-download-only legacy products retain unknown.
- Verification: the active6 Filmora fixture failed red with `unknown` and now returns absent. Separate guards preserve fixed-profile installed status, zero Winget calls for canonical collisions, and unchanged unknown status for a legacy client-managed product. No renderer, helper, catalog, state, package, download, or installation changed.
- Remaining acceptance: the next Windows candidate must confirm Filmora remains on `install-product` after inventory settles, while a machine with a detected Filmora installation still offers the existing refresh/reinstall action.
