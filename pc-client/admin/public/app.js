const state = {
  catalog: null,
  view: "home",
  selectedVendorId: "",
  selectedProductId: "",
  dirty: false,
  publication: null,
  draftRevision: 0,
  activeCatalogVersion: 0,
  releaseData: null,
  validationReport: null,
  productModules: {
    modules: [],
    installProfiles: []
  }
};

const categories = ["AI 对话", "编程开发", "图像创作", "视频创作", "智能体", "本地模型"];
const kinds = ["桌面端", "CLI", "其他产品"];
const requirements = ["node", "git", "python", "docker"];
const content = document.querySelector("#content");
const title = document.querySelector("#pageTitle");
const saveState = document.querySelector("#saveState");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toast(message, error = false) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (element.className = "toast"), 2600);
}

function markDirty() {
  state.dirty = true;
  saveState.textContent = "有未保存修改";
}

function updateCounts() {
  const vendors = state.catalog?.vendors || [];
  document.querySelector("#vendorCount").textContent = vendors.length;
  document.querySelector("#productCount").textContent = vendors.reduce(
    (total, vendor) => total + vendor.products.length,
    0
  );
}

async function request(url, options) {
  const requestOptions = { ...(options || {}) };
  if (requestOptions.method && requestOptions.method !== "GET") {
    requestOptions.headers = {
      ...(requestOptions.headers || {}),
      "X-AIHub-Admin": "1"
    };
  }
  const response = await fetch(url, requestOptions);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

async function loadCatalog() {
  try {
    const payload = await request("/api/catalog");
    state.productModules = await request("/api/product-modules");
    state.catalog = payload.catalog;
    state.draftRevision = payload.revision;
    state.activeCatalogVersion = payload.activeCatalogVersion;
    state.releaseData = await request("/api/release");
    state.catalog.brand ||= {
      name: "AI Hub",
      mark: "A",
      slogan: "一个地方，找到并安装你的 AI 工具"
    };
    state.catalog.extraSections ||= [];
    state.catalog.community ||= {
      title: "AI Hub 社区",
      description: "交流 AI 工具的安装、使用经验与工作流。",
      provider: "Flarum",
      url: "",
      enabled: false
    };
    state.selectedVendorId = state.catalog.vendors[0]?.id || "";
    state.selectedProductId = state.catalog.vendors[0]?.products[0]?.id || "";
    state.dirty = false;
    saveState.textContent = "草稿已同步";
    updateCounts();
    render();
  } catch (error) {
    content.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    toast(error.message, true);
  }
}

async function saveDraft(showToast = true) {
  try {
    const payload = await request("/api/catalog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalog: state.catalog,
        expectedRevision: state.draftRevision
      })
    });
    state.catalog.updatedAt = payload.updatedAt;
    state.draftRevision = payload.revision;
    state.dirty = false;
    saveState.textContent = "草稿已保存";
    if (showToast) toast("草稿保存成功");
    return true;
  } catch (error) {
    toast(error.message, true);
    return false;
  }
}

async function publish() {
  if (!(await saveDraft(false))) return;
  try {
    state.publication = await request("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedDraftRevision: state.draftRevision,
        expectedActiveCatalogVersion: state.activeCatalogVersion
      })
    });
    state.activeCatalogVersion = state.publication.catalogVersion;
    state.releaseData = await request("/api/release");
    toast(`目录 v${state.publication.catalogVersion} 已签名发布`);
    state.view = "publish";
    syncNavigation();
    render();
  } catch (error) {
    toast(error.message, true);
  }
}

function syncNavigation() {
  document.querySelectorAll("nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
}

function optionList(values, selected) {
  return values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`
    )
    .join("");
}

function productModuleFor(product) {
  return state.productModules.modules.find(
    (module) =>
      module.id === product.moduleId ||
      (!product.moduleId && module.productType === product.productType)
  );
}

function productModuleOptions(product, vendorId) {
  const selected = productModuleFor(product)?.id || "";
  return state.productModules.modules
    .map((module) => {
      const approved =
        !module.requiresProfile ||
        state.productModules.installProfiles.some(
          (profile) =>
            profile.moduleId === module.id &&
            profile.vendorId === vendorId &&
            profile.productId === product.id
        );
      return `<option value="${escapeHtml(module.id)}"${module.id === selected ? " selected" : ""}${approved ? "" : " disabled"}>${escapeHtml(module.label)}${approved ? "" : "（需先发布客户端配置）"}</option>`;
    })
    .join("");
}

function installProfileOptions(product, vendorId) {
  const module = productModuleFor(product);
  if (!module?.requiresProfile) return "";
  const profiles = state.productModules.installProfiles.filter(
    (profile) =>
      profile.moduleId === module.id &&
      profile.vendorId === vendorId &&
      profile.productId === product.id
  );
  return [
    `<option value="">请选择客户端已审核配置</option>`,
    ...profiles.map(
      (profile) =>
        `<option value="${escapeHtml(profile.id)}"${profile.id === product.installProfileId ? " selected" : ""}>${escapeHtml(profile.label)} · ${escapeHtml(profile.vendorId)}/${escapeHtml(profile.productId)}（匹配）</option>`
    )
  ].join("");
}

function applyModule(product, moduleId, vendorId) {
  const module = state.productModules.modules.find(
    (candidate) => candidate.id === moduleId
  );
  if (!module) return;
  product.moduleId = module.id;
  product.productType = module.productType;
  product.kind = module.kind;
  product.installPolicy = module.installPolicy;
  product.downloadPolicy = module.downloadPolicy;
  product.signaturePolicy = module.signaturePolicy;
  product.uninstallPolicy = module.uninstallPolicy;
  const matchingProfile = state.productModules.installProfiles.find(
    (profile) =>
      profile.moduleId === module.id &&
      profile.vendorId === vendorId &&
      profile.productId === product.id
  );
  product.installProfileId = module.requiresProfile
    ? matchingProfile?.id || ""
    : "";
  product.requirements = matchingProfile?.requirements || [];
  if (matchingProfile?.download) {
    product.download = { ...matchingProfile.download };
  } else {
    delete product.download;
  }
}

function moveItem(items, index, offset) {
  const destination = index + offset;
  if (destination < 0 || destination >= items.length) return false;
  [items[index], items[destination]] = [items[destination], items[index]];
  return true;
}

function renderHome() {
  title.textContent = "首页内容";
  const banners = state.catalog.home.banners;
  content.innerHTML = `
    <section class="intro">
      <div><p class="eyebrow">首页 / BANNER</p><h2>首页轮播内容</h2>
      <p>这里的内容发布后会直接替换 PC 客户端首页轮播。</p></div>
      <button class="smallButton" data-action="add-banner">＋ 新增轮播</button>
    </section>
    <section class="panel">
      <div class="panelHeader"><h3>品牌与 Slogan</h3></div>
      <div class="formGrid">
        <label>品牌名称<input data-brand-field="name" value="${escapeHtml(state.catalog.brand.name)}"></label>
        <label>LOGO 文字<input maxlength="4" data-brand-field="mark" value="${escapeHtml(state.catalog.brand.mark)}"></label>
        <label class="wide">Slogan<input data-brand-field="slogan" value="${escapeHtml(state.catalog.brand.slogan)}"></label>
      </div>
    </section>
    ${banners
      .map(
        (banner, index) => `
        <section class="panel">
          <div class="panelHeader"><div class="bannerIndex">${index + 1}</div><div>
          <button class="smallButton" data-action="move-banner" data-index="${index}" data-offset="-1">上移</button>
          <button class="smallButton" data-action="move-banner" data-index="${index}" data-offset="1">下移</button>
          <button class="dangerButton" data-action="delete-banner" data-index="${index}">删除</button></div></div>
          <div class="formGrid">
            <label>眉标题<input data-home="${index}:eyebrow" value="${escapeHtml(banner.eyebrow)}"></label>
            <label>按钮文字<input data-home="${index}:action" value="${escapeHtml(banner.action)}"></label>
            <label class="wide">主标题<input data-home="${index}:title" value="${escapeHtml(banner.title)}"></label>
            <label class="wide">说明<textarea data-home="${index}:description">${escapeHtml(banner.description)}</textarea></label>
          </div>
        </section>`
      )
      .join("")}
    <section class="panel">
      <div class="panelHeader"><h3>精选厂商</h3></div>
      <div class="checks">${state.catalog.vendors
        .map(
          (vendor) => `<label><input type="checkbox" data-featured="${escapeHtml(vendor.id)}"
          ${state.catalog.home.featuredVendorIds.includes(vendor.id) ? "checked" : ""}>
          ${escapeHtml(vendor.name)}${vendor.enabled === false ? "（已停用）" : ""}</label>`
        )
        .join("")}</div>
    </section>`;
}

function selectedVendor() {
  return state.catalog.vendors.find(
    (vendor) => vendor.id === state.selectedVendorId
  );
}

function renderCommunity() {
  title.textContent = "社区设置";
  const community = state.catalog.community;
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">社区 / FLARUM</p>
    <h2>社区入口配置</h2>
    <p>论坛完成 HTTPS 部署和验收前保持关闭；客户端不会展示一个不可用的开放入口。</p></div></section>
    <section class="panel">
      <div class="panelHeader"><h3>${escapeHtml(community.title)}</h3></div>
      <div class="formGrid">
        <label>社区名称<input data-community-field="title" value="${escapeHtml(community.title)}"></label>
        <label>论坛方案<input data-community-field="provider" value="${escapeHtml(community.provider)}"></label>
        <label class="wide">社区地址<input data-community-field="url" value="${escapeHtml(community.url)}" placeholder="https://community.example.com"></label>
        <label class="wide">社区说明<textarea data-community-field="description">${escapeHtml(community.description)}</textarea></label>
        <label class="toggleLabel"><input type="checkbox" data-community-enabled
          ${community.enabled ? "checked" : ""}>在 PC 客户端中开放社区入口</label>
      </div>
    </section>`;
}

function renderVendors() {
  title.textContent = "厂商管理";
  const vendor = selectedVendor();
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">目录 / 厂商</p><h2>全部 AI 厂商</h2>
    <p>厂商是产品目录的第一层，产品必须归属于某个厂商。</p></div>
    <button class="smallButton" data-action="add-vendor">＋ 新增厂商</button></section>
    <div class="twoColumn">
      <section class="panel itemList">${state.catalog.vendors
        .map(
          (item) => `<button data-vendor="${escapeHtml(item.id)}" class="${item.id === state.selectedVendorId ? "active" : ""}">
          <i style="background:${escapeHtml(item.color)}">${escapeHtml(item.mark)}</i><span>${escapeHtml(item.name)}
          <small>${item.enabled === false ? "已停用" : "已启用"} · 顺序 ${escapeHtml(item.order ?? 0)}</small></span></button>`
        )
        .join("")}</section>
      ${
        vendor
          ? `<section class="panel">
          <div class="panelHeader"><h3>${escapeHtml(vendor.name)}</h3>
          <button class="dangerButton" data-action="delete-vendor">删除厂商</button></div>
          <div class="formGrid">
             <label>厂商 ID<input data-vendor-field="id" value="${escapeHtml(vendor.id)}"></label>
             <label>厂商名称<input data-vendor-field="name" value="${escapeHtml(vendor.name)}"></label>
             <label>显示顺序<input type="number" min="0" max="100000" data-vendor-number="order" value="${escapeHtml(vendor.order ?? 0)}"></label>
             <label>首字母<input maxlength="1" data-vendor-field="initial" value="${escapeHtml(vendor.initial)}"></label>
             <label>图标文字<input maxlength="4" data-vendor-field="mark" value="${escapeHtml(vendor.mark)}"></label>
             <label class="wide">图片图标（HTTPS，可留空）<input data-vendor-field="iconUrl" value="${escapeHtml(vendor.iconUrl || "")}" placeholder="https://…"></label>
            <label>品牌颜色<input type="color" data-vendor-field="color" value="${escapeHtml(vendor.color)}"></label>
            <label>厂商官网<input data-vendor-field="website" value="${escapeHtml(vendor.website)}"></label>
            <label class="wide">教程地址<input data-vendor-field="tutorial" value="${escapeHtml(vendor.tutorial)}"></label>
             <label class="wide">厂商描述<textarea data-vendor-field="description">${escapeHtml(vendor.description)}</textarea></label>
             <label class="toggleLabel"><input type="checkbox" data-vendor-enabled ${vendor.enabled !== false ? "checked" : ""}>在客户端中启用该厂商</label>
          </div></section>`
          : `<div class="empty">暂无厂商</div>`
      }
    </div>`;
}

function allProducts() {
  return state.catalog.vendors.flatMap((vendor) =>
    vendor.products.map((product) => ({ vendor, product }))
  );
}

function selectedProductRecord() {
  return allProducts().find(
    ({ product }) => product.id === state.selectedProductId
  );
}

function renderProducts() {
  title.textContent = "产品管理";
  const record = selectedProductRecord();
  const product = record?.product;
  const productModule = product ? productModuleFor(product) : null;
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">目录 / 产品</p><h2>厂商旗下产品</h2>
    <p>选择产品模块后，安装、下载、签名和卸载流程由客户端统一实现。</p></div>
    <button class="smallButton" data-action="add-product">＋ 新增产品</button></section>
    <div class="twoColumn">
      <section class="panel itemList">${allProducts()
        .map(
          ({ vendor, product: item }) => `<button data-product="${escapeHtml(item.id)}" class="${item.id === state.selectedProductId ? "active" : ""}">
          <i style="background:${escapeHtml(vendor.color)}">${escapeHtml(vendor.mark)}</i>
          <span>${escapeHtml(item.name)}<br><small>${escapeHtml(vendor.name)} · ${escapeHtml(item.kind)} · ${item.enabled === false ? "已停用" : `顺序 ${escapeHtml(item.order ?? 0)}`}</small></span></button>`
        )
        .join("")}</section>
      ${
        product
          ? `<section class="panel">
          <div class="panelHeader"><h3>${escapeHtml(product.name)}</h3>
          <button class="dangerButton" data-action="delete-product">删除产品</button></div>
          <div class="formGrid">
            <label>产品 ID<input data-product-field="id" value="${escapeHtml(product.id)}"></label>
             <label>所属厂商<select data-product-field="vendorId">${optionList(state.catalog.vendors.map((item) => item.id), record.vendor.id)}</select></label>
             <label>产品名称<input data-product-field="name" value="${escapeHtml(product.name)}"></label>
             <label>显示顺序<input type="number" min="0" max="100000" data-product-number="order" value="${escapeHtml(product.order ?? 0)}"></label>
             <label>产品模块<select data-product-module>${productModuleOptions(product, record.vendor.id)}</select></label>
             <label>产品形态<input value="${escapeHtml(product.kind)}" readonly></label>
             ${productModule?.requiresProfile ? `
             <label class="wide">已审核安装配置<select data-install-profile>${installProfileOptions(product, record.vendor.id)}</select></label>` : ""}
             <label class="wide moduleNotice">模块说明<small>${escapeHtml(productModule?.description || "请选择产品模块")}</small></label>
             <label>工具特性<select data-product-field="category">${optionList(categories, product.category)}</select></label>
             <label>产品官网<input data-product-field="website" value="${escapeHtml(product.website)}"></label>
             <label class="wide">教程地址<input data-product-field="tutorial" value="${escapeHtml(product.tutorial)}"></label>
            <label class="wide">产品描述<textarea data-product-field="description">${escapeHtml(product.description)}</textarea></label>
            <label class="wide">模块环境要求<div class="checks">${requirements
              .map(
                (requirement) => `<label><input type="checkbox" data-requirement="${requirement}"
                ${product.requirements.includes(requirement) ? "checked" : ""} disabled>${requirement}</label>`
              )
              .join("")}</div><small>环境依赖由已审核安装配置锁定，后台不能任意增加。</small></label>
             <label>安装策略<input value="${escapeHtml(product.installPolicy)}" readonly></label>
             <label>下载策略<input value="${escapeHtml(product.downloadPolicy)}" readonly></label>
             <label>签名策略<input value="${escapeHtml(product.signaturePolicy)}" readonly></label>
             <label>卸载策略<input value="${escapeHtml(product.uninstallPolicy)}" readonly></label>
             ${product.downloadPolicy === "client-managed" ? `
             <label>已审核安装包地址<input value="${escapeHtml(product.download?.url || "")}" readonly></label>
             <label>已审核安装包文件名<input value="${escapeHtml(product.download?.fileName || "")}" readonly></label>` : ""}
             <label class="toggleLabel"><input type="checkbox" data-product-enabled ${product.enabled !== false ? "checked" : ""}>在客户端中启用该产品</label>
          </div></section>`
          : `<div class="empty">暂无产品</div>`
      }
    </div>`;
}

function renderSections() {
  title.textContent = "其他板块";
  const sections = state.catalog.extraSections;
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">导航 / 其他板块</p>
    <h2>后台挂载链接</h2>
    <p>只有启用的板块才会出现在 PC 客户端左侧大导航中。</p></div>
    <button class="smallButton" data-action="add-section">＋ 新增板块</button></section>
    ${
      sections.length
        ? sections
            .map(
              (section, index) => `
        <section class="panel">
          <div class="panelHeader"><h3>${escapeHtml(section.title)}</h3>
          <button class="dangerButton" data-action="delete-section" data-index="${index}">删除板块</button></div>
          <div class="formGrid">
            <label>板块 ID<input data-section="${index}:id" value="${escapeHtml(section.id)}"></label>
            <label>显示名称<input data-section="${index}:title" value="${escapeHtml(section.title)}"></label>
            <label class="wide">跳转链接<input data-section="${index}:url" value="${escapeHtml(section.url)}" placeholder="https://…"></label>
            <label class="wide">板块说明<textarea data-section="${index}:description">${escapeHtml(section.description)}</textarea></label>
            <label class="toggleLabel"><input type="checkbox" data-section-enabled="${index}" ${section.enabled ? "checked" : ""}>在 PC 客户端中启用</label>
          </div>
        </section>`
            )
            .join("")
        : `<div class="empty">暂无其他板块；新增后默认关闭。</div>`
    }`;
}

function renderPublish() {
  title.textContent = "发布设置";
  const publication = state.publication;
  const release = state.releaseData;
  const settings = release?.settings;
  const history = release?.history || [];
  const sourceRegistry = release?.approvedDownloadSources || [];
  const sourceMeta = new Map(
    sourceRegistry.map((source) => [
      `${source.environmentId}:${source.sourceId}`,
      source
    ])
  );
  const validation = state.validationReport;
  content.innerHTML = `
    <section class="publishCard">
      <p class="eyebrow">SIGNED RELEASE CHANNEL</p>
      <h2>签名发布到 PC 客户端</h2>
      <p>每次发布生成不可变版本和 Ed25519 签名；客户端验签、稳定灰度并拒绝旧版本重放。</p>
      <button class="secondary" data-action="validate">发布前校验</button>
      <button class="primary" data-action="publish">立即发布</button>
      ${validation ? `<div class="validationReport"><b>校验通过</b>
      <span>${validation.summary.vendors} 个厂商 · ${validation.summary.products} 个产品 · ${validation.summary.approvedDownloadSources} 个下载源</span>
      ${(validation.warnings || []).map((warning) => `<em>${escapeHtml(warning)}</em>`).join("")}</div>` : ""}
      <div class="publishMeta">
        <span>活动版本</span><code>v${escapeHtml(release?.state?.activeCatalogVersion || 0)}</code>
        <span>目录地址</span><code>${escapeHtml(publication?.url || "发布后生成")}</code>
        <span>SHA-256</span><code>${escapeHtml(publication?.sha256 || "发布后生成")}</code>
        <span>签名密钥</span><code>${escapeHtml(release?.signing?.keyId || "—")} · ${escapeHtml(release?.signing?.source || "—")}</code>
      </div>
    </section>
    <section class="panel">
      <div class="panelHeader"><h3>国内外环境下载源</h3></div>
      <p>固定为“官方源优先”；只有官方源不可用时才探测已启用的国内镜像。地址和安装包由客户端本地白名单锁定。</p>
      <div class="formGrid">
        <label>探测超时（毫秒）<input type="number" min="1000" max="15000" data-source-timeout value="${escapeHtml(state.catalog.environmentDownloads.probeTimeoutMs)}"></label>
        <label>策略<input value="官方优先，国内镜像回退" readonly></label>
      </div>
      <div class="sourceList">${state.catalog.environmentDownloads.sources.map((source, index) => {
        const meta = sourceMeta.get(`${source.environmentId}:${source.sourceId}`) || {};
        const lockedOfficial = meta.kind === "official";
        return `<div>
          <b>${escapeHtml(meta.label || source.sourceId)}</b>
          <span>${escapeHtml(meta.region === "china" ? "国内镜像" : "全球官方源")} · ${escapeHtml(source.environmentId)}</span>
          <label>同级顺序 <input type="number" min="0" max="100" data-source-order="${index}" value="${escapeHtml(source.order)}"></label>
          <label class="toggleLabel"><input type="checkbox" data-source-enabled="${index}" ${source.enabled ? "checked" : ""} ${lockedOfficial ? "disabled" : ""}>${lockedOfficial ? "官方源固定启用" : "启用回退源"}</label>
        </div>`;
      }).join("")}</div>
    </section>
    <section class="panel">
      <div class="panelHeader"><h3>目录灰度设置</h3>
      <button class="smallButton" data-action="save-release-settings">保存发布设置</button></div>
      <div class="formGrid">
        <label>灰度比例（0–100）<input type="number" min="0" max="100" data-release-catalog="rolloutPercentage" value="${escapeHtml(settings?.catalog?.rolloutPercentage ?? 100)}"></label>
        <label>稳定分桶 Salt<input data-release-catalog="rolloutSalt" value="${escapeHtml(settings?.catalog?.rolloutSalt || "catalog-stable-2026")}"></label>
        <label class="wide">发布说明<textarea data-release-catalog="notes">${escapeHtml(settings?.catalog?.notes || "")}</textarea></label>
      </div>
    </section>
    <section class="panel">
      <div class="panelHeader"><h3>Windows 更新通道</h3>
      <button class="smallButton" data-action="publish-update">发布更新清单</button></div>
      <div class="formGrid">
        <label>版本号<input data-release-update="version" value="${escapeHtml(settings?.update?.version || "0.1.1")}"></label>
        <label>灰度比例<input type="number" min="0" max="100" data-release-update="rolloutPercentage" value="${escapeHtml(settings?.update?.rolloutPercentage ?? 0)}"></label>
        <label class="wide">安装包 HTTPS 地址<input data-release-update="downloadUrl" value="${escapeHtml(settings?.update?.downloadUrl || "")}"></label>
        <label>SHA-256<input data-release-update="sha256" value="${escapeHtml(settings?.update?.sha256 || "")}"></label>
        <label>文件大小（字节）<input type="number" min="0" data-release-update="fileSize" value="${escapeHtml(settings?.update?.fileSize || 0)}"></label>
        <label class="wide">更新说明（每行一条）<textarea data-release-update-notes>${escapeHtml((settings?.update?.notes || []).join("\n"))}</textarea></label>
        <label class="toggleLabel"><input type="checkbox" data-release-update-enabled ${settings?.update?.enabled ? "checked" : ""}>启用签名更新发布</label>
      </div>
    </section>
    <section class="panel">
      <div class="panelHeader"><h3>不可变发布历史</h3></div>
      <div class="releaseHistory">${history.length ? history.map((item) => `
        <div><b>v${item.catalogVersion}</b><span>${escapeHtml(item.notes || "无说明")}</span>
        <code>${escapeHtml(item.releaseId)}</code>
        ${item.catalogVersion === release.state.activeCatalogVersion ? "<em>当前</em>" : `<button class="smallButton" data-action="rollback" data-release-id="${escapeHtml(item.releaseId)}">回滚为新版本</button>`}</div>`).join("") : "<p>尚未发布目录</p>"}</div>
    </section>`;
}

async function saveReleaseSettings(showToast = true) {
  try {
    const payload = await request("/api/release", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.releaseData.settings)
    });
    state.releaseData.settings = payload.settings;
    if (showToast) toast("发布设置已保存");
    return true;
  } catch (error) {
    toast(error.message, true);
    return false;
  }
}

function render() {
  if (!state.catalog) return;
  updateCounts();
  if (state.view === "home") renderHome();
  if (state.view === "community") renderCommunity();
  if (state.view === "vendors") renderVendors();
  if (state.view === "products") renderProducts();
  if (state.view === "sections") renderSections();
  if (state.view === "publish") renderPublish();
}

document.querySelector("nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  syncNavigation();
  render();
});

document.querySelector("#saveButton").addEventListener("click", () => saveDraft());
document.querySelector("#publishButton").addEventListener("click", publish);

content.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.vendor) {
    state.selectedVendorId = target.dataset.vendor;
    render();
  } else if (target.dataset.product) {
    state.selectedProductId = target.dataset.product;
    render();
  } else if (target.dataset.action === "add-banner") {
    state.catalog.home.banners.push({
      eyebrow: "AI HUB · PC",
      title: "新轮播标题",
      description: "请输入轮播说明。",
      action: "查看全部厂商"
    });
    markDirty(); render();
  } else if (target.dataset.action === "delete-banner") {
    if (state.catalog.home.banners.length <= 1) return toast("至少保留一个轮播", true);
    state.catalog.home.banners.splice(Number(target.dataset.index), 1);
    markDirty(); render();
  } else if (target.dataset.action === "move-banner") {
    if (moveItem(state.catalog.home.banners, Number(target.dataset.index), Number(target.dataset.offset))) {
      markDirty(); render();
    }
  } else if (target.dataset.action === "add-vendor") {
    const id = `vendor-${Date.now()}`;
    state.catalog.vendors.push({
      id, enabled: true, order: state.catalog.vendors.length, name: "新厂商", initial: "N", mark: "N", iconUrl: "", color: "#159475",
      description: "请输入厂商描述。", website: "https://example.com",
      tutorial: "https://example.com", products: []
    });
    state.selectedVendorId = id; markDirty(); render();
  } else if (target.dataset.action === "delete-vendor") {
    const vendor = selectedVendor();
    if (!vendor || vendor.products.length) return toast("请先删除或移动该厂商下的产品", true);
    if (!confirm(`确定删除厂商“${vendor.name}”吗？`)) return;
    state.catalog.vendors = state.catalog.vendors.filter((item) => item.id !== vendor.id);
    state.catalog.home.featuredVendorIds = state.catalog.home.featuredVendorIds.filter((id) => id !== vendor.id);
    state.selectedVendorId = state.catalog.vendors[0]?.id || ""; markDirty(); render();
  } else if (target.dataset.action === "add-product") {
    const vendor = state.catalog.vendors[0];
    if (!vendor) return toast("请先创建厂商", true);
    const id = `product-${Date.now()}`;
    vendor.products.push({
      id, enabled: true, order: vendor.products.length, name: "新产品",
      kind: "其他产品", category: "AI 对话",
      description: "请输入产品描述。", website: "https://example.com",
      tutorial: "https://example.com", productType: "web", requirements: [],
      moduleId: "web-link", installProfileId: "",
      installPolicy: "open-product-website", downloadPolicy: "none",
      signaturePolicy: "not-applicable", uninstallPolicy: "not-managed"
    });
    state.selectedProductId = id; markDirty(); render();
  } else if (target.dataset.action === "delete-product") {
    const record = selectedProductRecord();
    if (!record || !confirm(`确定删除产品“${record.product.name}”吗？`)) return;
    record.vendor.products = record.vendor.products.filter((item) => item.id !== record.product.id);
    state.selectedProductId = allProducts()[0]?.product.id || ""; markDirty(); render();
  } else if (target.dataset.action === "add-section") {
    state.catalog.extraSections.push({
      id: `section-${Date.now()}`,
      title: "新板块",
      description: "请输入板块说明。",
      url: "https://example.com",
      enabled: false
    });
    markDirty(); render();
  } else if (target.dataset.action === "delete-section") {
    const index = Number(target.dataset.index);
    const section = state.catalog.extraSections[index];
    if (!section || !confirm(`确定删除板块“${section.title}”吗？`)) return;
    state.catalog.extraSections.splice(index, 1);
    markDirty(); render();
  } else if (target.dataset.action === "publish") {
    publish();
  } else if (target.dataset.action === "validate") {
    if (!(await saveDraft(false)) || !(await saveReleaseSettings(false))) return;
    try {
      state.validationReport = await request("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      toast("发布前校验通过");
      render();
    } catch (error) {
      state.validationReport = null;
      toast(error.message, true);
    }
  } else if (target.dataset.action === "save-release-settings") {
    saveReleaseSettings();
  } else if (target.dataset.action === "publish-update") {
    if (!(await saveReleaseSettings(false))) return;
    try {
      const result = await request("/api/publish-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      toast(`更新 ${result.version} 已签名发布`);
    } catch (error) {
      toast(error.message, true);
    }
  } else if (target.dataset.action === "rollback") {
    if (!confirm("回滚会生成一个更高的新版本，确定继续吗？")) return;
    try {
      const result = await request("/api/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          releaseId: target.dataset.releaseId,
          expectedActiveCatalogVersion: state.activeCatalogVersion
        })
      });
      state.activeCatalogVersion = result.catalogVersion;
      state.releaseData = await request("/api/release");
      toast(`已生成回滚版本 v${result.catalogVersion}`);
      render();
    } catch (error) {
      toast(error.message, true);
    }
  }
});

content.addEventListener("input", (event) => {
  const input = event.target;
  if (input.dataset.home) {
    const [index, field] = input.dataset.home.split(":");
    state.catalog.home.banners[Number(index)][field] = input.value;
  } else if (input.dataset.brandField) {
    state.catalog.brand[input.dataset.brandField] = input.value;
  } else if (input.dataset.communityField) {
    state.catalog.community[input.dataset.communityField] = input.value;
  } else if ("communityEnabled" in input.dataset) {
    state.catalog.community.enabled = input.checked;
  } else if (input.dataset.featured) {
    const id = input.dataset.featured;
    state.catalog.home.featuredVendorIds = input.checked
      ? [...new Set([...state.catalog.home.featuredVendorIds, id])]
      : state.catalog.home.featuredVendorIds.filter((item) => item !== id);
  } else if (input.dataset.vendorField) {
    const vendor = selectedVendor();
    const field = input.dataset.vendorField;
    const previousId = vendor.id;
    vendor[field] = input.value;
    if (field === "id") {
      state.selectedVendorId = input.value;
      state.catalog.home.featuredVendorIds = state.catalog.home.featuredVendorIds.map((id) =>
        id === previousId ? input.value : id
      );
    }
  } else if (input.dataset.vendorNumber) {
    selectedVendor()[input.dataset.vendorNumber] = Number(input.value);
  } else if ("vendorEnabled" in input.dataset) {
    const vendor = selectedVendor();
    vendor.enabled = input.checked;
    if (!input.checked) {
      state.catalog.home.featuredVendorIds =
        state.catalog.home.featuredVendorIds.filter((id) => id !== vendor.id);
    }
  } else if (input.dataset.productField) {
    const record = selectedProductRecord();
    const field = input.dataset.productField;
    if (field === "vendorId") {
      record.vendor.products = record.vendor.products.filter((item) => item.id !== record.product.id);
      state.catalog.vendors.find((vendor) => vendor.id === input.value).products.push(record.product);
    } else {
      record.product[field] = input.value;
      if (field === "id") state.selectedProductId = input.value;
    }
  } else if (input.dataset.productNumber) {
    selectedProductRecord().product[input.dataset.productNumber] = Number(input.value);
  } else if ("productEnabled" in input.dataset) {
    selectedProductRecord().product.enabled = input.checked;
  } else if ("productModule" in input.dataset) {
    const record = selectedProductRecord();
    applyModule(record.product, input.value, record.vendor.id);
    markDirty();
    render();
    return;
  } else if ("installProfile" in input.dataset) {
    const product = selectedProductRecord().product;
    const profile = state.productModules.installProfiles.find(
      (candidate) => candidate.id === input.value
    );
    product.installProfileId = input.value;
    product.requirements = profile?.requirements || [];
    if (profile?.download) {
      product.download = { ...profile.download };
    } else {
      delete product.download;
    }
    markDirty();
    render();
    return;
  } else if (input.dataset.requirement) {
    const product = selectedProductRecord().product;
    product.requirements = input.checked
      ? [...new Set([...product.requirements, input.dataset.requirement])]
      : product.requirements.filter((item) => item !== input.dataset.requirement);
  } else if (input.dataset.downloadField) {
    const product = selectedProductRecord().product;
    const urlInput = content.querySelector('[data-download-field="url"]').value.trim();
    const fileInput = content.querySelector('[data-download-field="fileName"]').value.trim();
    product.download = urlInput || fileInput ? { url: urlInput, fileName: fileInput } : undefined;
  } else if (input.dataset.section) {
    const [index, field] = input.dataset.section.split(":");
    state.catalog.extraSections[Number(index)][field] = input.value;
  } else if (input.dataset.sectionEnabled) {
    state.catalog.extraSections[Number(input.dataset.sectionEnabled)].enabled =
      input.checked;
  } else if (input.dataset.releaseCatalog) {
    const field = input.dataset.releaseCatalog;
    state.releaseData.settings.catalog[field] =
      field === "rolloutPercentage" ? Number(input.value) : input.value;
  } else if (input.dataset.releaseUpdate) {
    const field = input.dataset.releaseUpdate;
    state.releaseData.settings.update[field] =
      ["rolloutPercentage", "fileSize"].includes(field)
        ? Number(input.value)
        : input.value;
  } else if ("releaseUpdateEnabled" in input.dataset) {
    state.releaseData.settings.update.enabled = input.checked;
  } else if ("releaseUpdateNotes" in input.dataset) {
    state.releaseData.settings.update.notes = input.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } else if ("sourceTimeout" in input.dataset) {
    state.catalog.environmentDownloads.probeTimeoutMs = Number(input.value);
  } else if (input.dataset.sourceOrder) {
    state.catalog.environmentDownloads.sources[Number(input.dataset.sourceOrder)].order =
      Number(input.value);
  } else if (input.dataset.sourceEnabled) {
    state.catalog.environmentDownloads.sources[Number(input.dataset.sourceEnabled)].enabled =
      input.checked;
  } else {
    return;
  }
  markDirty();
});

loadCatalog();
