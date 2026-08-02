const state = {
  catalog: null,
  view: "home",
  selectedVendorId: "",
  selectedProductId: "",
  selectedResourceId: "",
  selectedDiscoveryId: "",
  discoveryFilter: "pending",
  discovery: null,
  dirty: false,
  publication: null,
  draftRevision: 0,
  activeCatalogVersion: 0,
  releaseData: null,
  validationReport: null,
  productCertifications: {
    revision: 0,
    summary: { total: 0, pending: 0, reviewed: 0, accepted: 0 },
    products: []
  },
  productModules: {
    modules: [],
    entryPointTypes: [],
    installProfiles: [],
    resourceModules: [],
    extensionInstallProfiles: []
  }
};

const kinds = ["桌面端", "CLI", "其他产品"];
const requirements = ["node", "git", "python", "docker", "wsl"];
const content = document.querySelector("#content");
const title = document.querySelector("#pageTitle");
const saveState = document.querySelector("#saveState");
let discoveryPollTimer = null;

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
  document.querySelector("#resourceCount").textContent =
    state.catalog?.resources?.length || 0;
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
    state.productCertifications = await request("/api/product-certifications");
    state.catalog = payload.catalog;
    state.draftRevision = payload.revision;
    state.activeCatalogVersion = payload.activeCatalogVersion;
    state.releaseData = await request("/api/release");
    state.discovery = await request("/api/discovery");
    state.catalog.brand ||= {
      name: "枕星 AI",
      mark: "枕",
      slogan: "一个地方，找到并安装你的 AI 工具"
    };
    state.catalog.extraSections ||= [];
    state.catalog.community ||= {
      title: "枕星 AI 社区",
      description: "交流 AI 工具的安装、使用经验与工作流。",
      provider: "Flarum",
      url: "",
      enabled: false
    };
    state.catalog.categories ||= [
      ...new Set(
        state.catalog.vendors.flatMap((vendor) =>
          vendor.products.map((product) => product.category)
        )
      )
    ];
    if (!state.catalog.categories.length) {
      state.catalog.categories.push("未分类");
    }
    state.catalog.resourceStores ||= [
      { id: "skill", label: "Skill 商店", enabled: true, order: 0 },
      { id: "mcp", label: "MCP 商店", enabled: true, order: 1 },
      { id: "plugin", label: "插件商店", enabled: true, order: 2 }
    ];
    state.catalog.resources ||= [];
    state.selectedVendorId = state.catalog.vendors[0]?.id || "";
    state.selectedProductId = state.catalog.vendors[0]?.products[0]?.id || "";
    state.selectedResourceId = state.catalog.resources[0]?.id || "";
    state.selectedDiscoveryId =
      state.discovery.candidates.find((candidate) => candidate.status === "pending")?.id ||
      state.discovery.candidates[0]?.id ||
      "";
    state.dirty = false;
    saveState.textContent = "草稿已同步";
    updateCounts();
    render();
    scheduleDiscoveryPoll();
  } catch (error) {
    content.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    toast(error.message, true);
  }
}

async function refreshDiscovery() {
  state.discovery = await request("/api/discovery");
  if (
    !state.discovery.candidates.some(
      (candidate) => candidate.id === state.selectedDiscoveryId
    )
  ) {
    state.selectedDiscoveryId =
      state.discovery.candidates.find((candidate) => candidate.status === "pending")?.id ||
      state.discovery.candidates[0]?.id ||
      "";
  }
  if (state.view === "discovery") renderDiscovery();
  scheduleDiscoveryPoll();
}

function scheduleDiscoveryPoll() {
  clearTimeout(discoveryPollTimer);
  if (state.discovery?.scan?.status !== "running") return;
  discoveryPollTimer = setTimeout(async () => {
    try {
      await refreshDiscovery();
    } catch (error) {
      toast(error.message, true);
    }
  }, 1500);
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

const capabilityLabels = Object.freeze({
  website: "官网",
  tutorial: "教程",
  install: "安装",
  open: "打开已安装软件",
  uninstall: "卸载"
});

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
  product.capabilities = [
    ...(matchingProfile?.capabilities || module.capabilities || [])
  ];
  if (matchingProfile?.download) {
    product.download = { ...matchingProfile.download };
  } else {
    delete product.download;
  }
  if (Array.isArray(product.entryPoints)) {
    product.entryPoints = product.entryPoints.filter(
      (entry) => !["desktop", "cli"].includes(entry.type)
    );
    if (module.kind === "桌面端") {
      product.entryPoints.push({
        type: "desktop",
        label: module.requiresProfile ? "客户端一键安装" : "获取 Windows 客户端"
      });
    } else if (module.kind === "CLI") {
      product.entryPoints.push({
        type: "cli",
        label: module.requiresProfile ? "CLI 一键安装" : "查看 CLI 安装说明"
      });
    }
  }
}

function productEntryTypeOptions(product, selected) {
  return (state.productModules.entryPointTypes || [])
    .filter((entry) => {
      if (entry.type === "desktop") return product.kind === "桌面端";
      if (entry.type === "cli") return product.kind === "CLI";
      if (entry.type === "web") return product.kind !== "CLI";
      return true;
    })
    .map(
      (entry) =>
        `<option value="${escapeHtml(entry.type)}"${entry.type === selected ? " selected" : ""}>${escapeHtml(entry.label)}</option>`
    )
    .join("");
}

function productEntryEditor(product) {
  const entries = Array.isArray(product.entryPoints) ? product.entryPoints : [];
  const rows = entries.length
    ? entries
        .map((entry, index) => {
          const link = ["website", "web", "tutorial", "external"].includes(
            entry.type
          );
          return `<div>
            <select data-product-entry-field="${index}:type">${productEntryTypeOptions(product, entry.type)}</select>
            <input maxlength="48" data-product-entry-field="${index}:label" value="${escapeHtml(entry.label)}" placeholder="按钮文字">
            ${link ? `<input data-product-entry-field="${index}:url" value="${escapeHtml(entry.url || "")}" placeholder="https://...">` : `<small>调用当前产品的固定客户端模块</small>`}
            <button class="smallButton" data-action="move-product-entry" data-index="${index}" data-offset="-1" ${index === 0 ? "disabled" : ""}>上移</button>
            <button class="smallButton" data-action="move-product-entry" data-index="${index}" data-offset="1" ${index === entries.length - 1 ? "disabled" : ""}>下移</button>
            <button class="dangerButton" data-action="delete-product-entry" data-index="${index}">删除</button>
          </div>`;
        })
        .join("")
    : `<div class="empty">尚未配置入口；旧目录会继续使用兼容入口。</div>`;
  return `<div class="wide moduleNotice">
    <b>产品入口</b>
    <small>数组顺序就是客户端按钮顺序。链接仅允许 HTTPS；桌面端和 CLI 只调用当前产品已审核模块，不能填写命令、参数或本地路径。</small>
    <div class="sourceList">${rows}</div>
    <button class="smallButton" data-action="add-product-entry">＋ 新增入口</button>
  </div>`;
}

function allResources() {
  return state.catalog.resources || [];
}

function selectedResource() {
  return allResources().find(
    (resource) => resource.id === state.selectedResourceId
  );
}

function resourceModuleFor(target) {
  return state.productModules.resourceModules.find(
    (module) => module.id === target.moduleId
  );
}

function resourceModuleOptions(resource, target) {
  return state.productModules.resourceModules
    .filter(
      (module) =>
        !module.resourceType || resource.resourceTypes.includes(module.resourceType)
    )
    .map((module) => {
      const approved =
        !module.requiresProfile ||
        state.productModules.extensionInstallProfiles.some(
          (profile) =>
            profile.moduleId === module.id &&
            profile.extensionId === resource.id &&
            profile.hostProductId === target.productId
        );
      return `<option value="${escapeHtml(module.id)}"${module.id === target.moduleId ? " selected" : ""}${approved ? "" : " disabled"}>${escapeHtml(module.label)}${approved ? "" : "（需先发布客户端配置）"}</option>`;
    })
    .join("");
}

function resourceInstallProfileOptions(resource, target) {
  const module = resourceModuleFor(target);
  if (!module?.requiresProfile) return "";
  const profiles = state.productModules.extensionInstallProfiles.filter(
    (profile) =>
      profile.moduleId === module.id &&
      profile.extensionId === resource.id &&
      profile.hostProductId === target.productId
  );
  return [
    `<option value="">请选择客户端已审核配置</option>`,
    ...profiles.map(
      (profile) =>
        `<option value="${escapeHtml(profile.id)}"${profile.id === target.installProfileId ? " selected" : ""}>${escapeHtml(profile.label)} · ${escapeHtml(profile.hostProductId)}（匹配）</option>`
    )
  ].join("");
}

function applyResourceModule(resource, target, moduleId) {
  const module = state.productModules.resourceModules.find(
    (candidate) => candidate.id === moduleId
  );
  if (!module) return;
  target.moduleId = module.id;
  const matchingProfile = state.productModules.extensionInstallProfiles.find(
    (profile) =>
      profile.moduleId === module.id &&
      profile.extensionId === resource.id &&
      profile.hostProductId === target.productId
  );
  if (module.requiresProfile && !matchingProfile) {
    const fallback = state.productModules.resourceModules.find(
      (candidate) => candidate.id === "resource-link"
    );
    target.moduleId = fallback?.id || "resource-link";
    target.installProfileId = "";
    target.capabilities = [...(fallback?.capabilities || ["website"])];
    return;
  }
  target.installProfileId = module.requiresProfile
    ? matchingProfile?.id || ""
    : "";
  target.capabilities = [
    ...(matchingProfile?.capabilities || module.capabilities || [])
  ];
}

function productLabel(productId) {
  const record = allProducts().find(({ product }) => product.id === productId);
  return record ? `${record.vendor.name} / ${record.product.name}` : productId;
}

function resourceTargetProductOptions(resource, target) {
  const module = resourceModuleFor(target);
  return allProducts()
    .filter(
      ({ product }) =>
        product.directoryKind === "ai-tool" &&
        (!module?.requiresProfile ||
          state.productModules.extensionInstallProfiles.some(
            (profile) =>
              profile.moduleId === module.id &&
              profile.extensionId === resource.id &&
              profile.hostProductId === product.id
          ))
    )
    .map(
      ({ vendor, product }) =>
        `<option value="${escapeHtml(product.id)}"${product.id === target.productId ? " selected" : ""}>${escapeHtml(vendor.name)} / ${escapeHtml(product.name)}</option>`
    )
    .join("");
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
             <label class="toggleLabel"><input type="checkbox" data-vendor-requires-cross-border-network ${vendor.requiresCrossBorderNetwork ? "checked" : ""}>中国用户需要科学上网</label>
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

function catalogCategories() {
  return state.catalog?.categories || [];
}

function selectedProductRecord() {
  return allProducts().find(
    ({ product }) => product.id === state.selectedProductId
  );
}

const certificationLabels = Object.freeze({
  pending: "待审核",
  reviewed: "已审核",
  accepted: "已实机验收"
});

const certificationCheckLabels = Object.freeze({
  downloadIntegrity: "下载与完整性",
  installerLaunch: "安装器调起",
  postInstallDetection: "安装后检测",
  open: "打开",
  updateOwnership: "更新归属",
  uninstall: "卸载",
  dataRetention: "用户数据保留"
});

function productCertificationFor(productId) {
  return state.productCertifications.products.find(
    (certification) => certification.productId === productId
  ) || null;
}

function certificationEditor(certification) {
  if (!certification) return "";
  const status = certification.status;
  const acceptance = certification.acceptance;
  const transitionFields = `
    <label>操作人<input maxlength="100" data-certification-field="changedBy" placeholder="姓名或账号"></label>
    <label class="wide">备注<textarea maxlength="500" data-certification-field="notes" placeholder="可留空"></textarea></label>`;
  return `<div class="wide certificationCard">
    <div class="certificationHeader"><div><b>Windows 桌面认证</b><small>认证记录不授予执行权限；本地白名单仍是唯一执行入口。</small></div>
    <span class="statusPill ${escapeHtml(status)}">${escapeHtml(certificationLabels[status] || status)}</span></div>
    <div class="certificationMeta"><span>本地执行配置</span><b>${certification.review ? "已锁定" : "不可用"}</b>
    <span>审核资料</span><code>${escapeHtml(certification.review?.reviewReference || "未建立")}</code>
    <span>历史记录</span><b>${escapeHtml(certification.historyCount || 0)} 条</b></div>
    ${certification.staleAcceptance ? `<p class="reviewWarning">执行契约已变化，需要重新实机验收。</p>` : ""}
    ${status === "accepted" ? `<div class="acceptedNotice">${escapeHtml(acceptance.acceptedBy)} · ${escapeHtml(acceptance.clientVersion)} · ${escapeHtml(acceptance.windowsVersion)}<br>${escapeHtml(new Date(acceptance.acceptedAt).toLocaleString("zh-CN"))} · ${escapeHtml(acceptance.evidenceReference)}</div>
      <div class="formGrid certificationForm">${transitionFields}</div>
      <div class="reviewActions"><button class="smallButton" data-action="review-product-certification">重新验收</button><button class="dangerButton" data-action="hold-product-certification">退回待审核</button></div>` : ""}
    ${status === "reviewed" ? `<div class="formGrid certificationForm">
      <label>验收人<input maxlength="100" data-certification-field="changedBy" placeholder="姓名或账号"></label>
      <label>客户端版本<input maxlength="64" data-certification-field="clientVersion" placeholder="例如 0.1.25"></label>
      <label>Windows 版本<input maxlength="120" data-certification-field="windowsVersion" placeholder="例如 Windows 11 24H2"></label>
      <label>证据位置<input maxlength="500" data-certification-field="evidenceReference" placeholder="验收单或截图目录"></label>
      <label class="wide">验收项<div class="checks">${Object.entries(certificationCheckLabels).map(([field, label]) => `<label><input type="checkbox" data-certification-check="${field}">${label}</label>`).join("")}</div></label>
      <label class="wide">备注<textarea maxlength="500" data-certification-field="notes" placeholder="可留空"></textarea></label>
      </div><div class="reviewActions"><button class="primary" data-action="accept-product-certification">记录实机验收</button><button class="dangerButton" data-action="hold-product-certification">退回待审核</button></div>` : ""}
    ${status === "pending" ? `<div class="formGrid certificationForm">${transitionFields}</div>
      <div class="reviewActions"><button class="primary" data-action="review-product-certification" ${certification.review ? "" : "disabled"}>恢复已审核</button></div>` : ""}
  </div>`;
}

function renderProducts() {
  title.textContent = "产品管理";
  const record = selectedProductRecord();
  const product = record?.product;
  const productModule = product ? productModuleFor(product) : null;
  const certification = product ? productCertificationFor(product.id) : null;
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">目录 / 产品</p><h2>厂商旗下产品</h2>
    <p>选择产品模块后，安装、下载、签名和卸载流程由客户端统一实现。</p></div>
    <button class="smallButton" data-action="add-product">＋ 新增产品</button></section>
    <section class="panel">
      <div class="panelHeader"><div><h3>产品类别</h3><small>类别由后台目录统一管理；重命名会同步更新使用该类别的产品。</small></div></div>
      <div class="sourceList">${catalogCategories().map((category, index) => `
        <div><input maxlength="40" data-category-name="${index}" value="${escapeHtml(category)}">
        <button class="smallButton" data-action="rename-category" data-index="${index}">重命名</button>
        <button class="dangerButton" data-action="delete-category" data-index="${index}">删除</button></div>`).join("")}</div>
      <div class="rowActions"><input maxlength="40" data-new-category placeholder="输入新类别名称">
      <button class="smallButton" data-action="add-category">＋ 新增类别</button></div>
    </section>
    <div class="twoColumn">
      <section class="panel itemList">${allProducts()
        .map(
          ({ vendor, product: item }) => `<button data-product="${escapeHtml(item.id)}" class="${item.id === state.selectedProductId ? "active" : ""}">
          <i style="background:${escapeHtml(vendor.color)}">${escapeHtml(vendor.mark)}</i>
          <span>${escapeHtml(item.name)}<br><small>${escapeHtml(vendor.name)} · ${item.directoryKind === "ai-connectable" ? "AI 可接入" : "AI 工具"} · ${escapeHtml(item.kind)} · ${item.enabled === false ? "已停用" : `顺序 ${escapeHtml(item.order ?? 0)}`}${productCertificationFor(item.id) ? ` · ${escapeHtml(certificationLabels[productCertificationFor(item.id).status])}` : ""}</small></span></button>`
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
             <label>所属目录<select data-product-field="directoryKind">
               <option value="ai-tool"${product.directoryKind === "ai-tool" ? " selected" : ""}>全部 AI 厂商</option>
               <option value="ai-connectable"${product.directoryKind === "ai-connectable" ? " selected" : ""}>全部 AI 可接入厂商</option>
             </select></label>
             <label>产品模块<select data-product-module>${productModuleOptions(product, record.vendor.id)}</select></label>
             <label>产品形态<input value="${escapeHtml(product.kind)}" readonly></label>
             ${productModule?.requiresProfile ? `
             <label class="wide">已审核安装配置<select data-install-profile>${installProfileOptions(product, record.vendor.id)}</select></label>` : ""}
              <label class="wide moduleNotice">模块说明<small>${escapeHtml(productModule?.description || "请选择产品模块")}</small></label>
              ${certificationEditor(certification)}
             <label class="wide">模块功能<div class="checks">${(productModule?.capabilities || [])
               .map(
                 (capability) => `<label><input type="checkbox" data-capability="${escapeHtml(capability)}"
                 ${(product.capabilities || []).includes(capability) ? "checked" : ""}>${escapeHtml(capabilityLabels[capability] || capability)}</label>`
               )
               .join("")}</div><small>后台可以关闭或重新启用客户端已经审核的功能；不能下发命令或新增本地执行能力。</small></label>
             <label>工具特性<select data-product-field="category">${optionList(catalogCategories(), product.category)}</select></label>
             <label>产品官网<input data-product-field="website" value="${escapeHtml(product.website)}"></label>
             <label class="wide">教程地址<input data-product-field="tutorial" value="${escapeHtml(product.tutorial)}"></label>
             <label class="wide">产品描述<textarea data-product-field="description">${escapeHtml(product.description)}</textarea></label>
             ${productEntryEditor(product)}
             <label class="wide">产品组件子目录<div class="checks">${record.vendor.products
               .filter(
                 (candidate) =>
                   candidate.id !== product.id && candidate.kind !== "CLI"
               )
               .map(
                 (candidate) => `<label><input type="checkbox" data-product-component="${escapeHtml(candidate.id)}"
                 ${(product.componentProductIds || []).includes(candidate.id) ? "checked" : ""}>${escapeHtml(candidate.name)}</label>`
               )
               .join("")}</div><small>这里只建立同一厂商产品之间的结构关系；安装能力仍由每个子产品自己的客户端白名单决定。</small></label>
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

function renderResources() {
  title.textContent = "生态资源";
  const resource = selectedResource();
  const resourceIdLocked = Boolean(
    resource?.targets.some((target) => resourceModuleFor(target)?.requiresProfile)
  );
  const sourceProducts = allProducts().filter(
    ({ product }) => product.directoryKind === "ai-connectable"
  );
  const targetProducts = allProducts().filter(
    ({ product }) => product.directoryKind === "ai-tool"
  );
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">目录 / 生态资源</p><h2>Skill、MCP 与插件商店</h2>
    <p>资源独立于厂商产品保存，可关联来源产品并接入多个 AI 工具。后台只能选择客户端固定模块和已审核配置，不能下发命令。</p></div>
    <button class="smallButton" data-action="add-resource">＋ 新增资源</button></section>
    <section class="panel">
      <div class="panelHeader"><div><h3>商店入口</h3><small>入口固定为 Skill、MCP 和插件；可调整名称、顺序和启停。</small></div></div>
      <div class="resourceStores">${state.catalog.resourceStores
        .map(
          (store, index) => `<div>
            <b>${escapeHtml(store.id.toUpperCase())}</b>
            <input maxlength="40" data-resource-store-field="${index}:label" value="${escapeHtml(store.label)}">
            <input type="number" min="0" max="100000" data-resource-store-field="${index}:order" value="${escapeHtml(store.order)}">
            <label><input type="checkbox" data-resource-store-enabled="${index}" ${store.enabled !== false ? "checked" : ""}>启用</label>
          </div>`
        )
        .join("")}</div>
    </section>
    <div class="twoColumn resourceColumns">
      <section class="panel itemList">${allResources().length
        ? allResources().map((item) => `
          <button data-resource="${escapeHtml(item.id)}" class="${item.id === state.selectedResourceId ? "active" : ""}">
          <i>${escapeHtml(item.resourceTypes.map((type) => type[0].toUpperCase()).join("/"))}</i>
          <span>${escapeHtml(item.name)}<br><small>${escapeHtml(item.resourceTypes.join(" + ").toUpperCase())} · ${item.enabled === false ? "已停用" : `顺序 ${escapeHtml(item.order ?? 0)}`} · ${escapeHtml(item.targets.length)} 个目标</small></span></button>`).join("")
        : `<div class="empty">暂无生态资源</div>`}</section>
      ${resource ? `<section class="panel">
        <div class="panelHeader"><h3>${escapeHtml(resource.name)}</h3>
        <button class="dangerButton" data-action="delete-resource">删除资源</button></div>
        <div class="formGrid">
          <label>资源 ID<input data-resource-field="id" value="${escapeHtml(resource.id)}" ${resourceIdLocked ? "readonly" : ""}>${resourceIdLocked ? "<small>已绑定客户端安装白名单，升级客户端配置后才能更换 ID。</small>" : ""}</label>
          <label>名称<input data-resource-field="name" value="${escapeHtml(resource.name)}"></label>
          <label>显示顺序<input type="number" min="0" max="100000" data-resource-number="order" value="${escapeHtml(resource.order ?? 0)}"></label>
          <label>发布厂商<select data-resource-optional-field="publisherVendorId"><option value="">未关联厂商</option>${state.catalog.vendors.map((vendor) => `<option value="${escapeHtml(vendor.id)}"${vendor.id === resource.publisherVendorId ? " selected" : ""}>${escapeHtml(vendor.name)}</option>`).join("")}</select></label>
          <label>发布者<input data-resource-optional-field="publisher" value="${escapeHtml(resource.publisher || "")}" placeholder="厂商、组织或维护者"></label>
          <label>来源类型<select data-resource-optional-field="sourceKind">
            <option value="">未标注</option>
            <option value="official"${resource.sourceKind === "official" ? " selected" : ""}>官方</option>
            <option value="reviewed-community"${resource.sourceKind === "reviewed-community" ? " selected" : ""}>已审核社区</option>
            <option value="community"${resource.sourceKind === "community" ? " selected" : ""}>社区</option>
          </select></label>
          <label class="wide">资源类型<div class="checks">${state.catalog.resourceStores.map((store) => `<label><input type="checkbox" data-resource-type="${escapeHtml(store.id)}" ${resource.resourceTypes.includes(store.id) ? "checked" : ""}>${escapeHtml(store.label)}</label>`).join("")}</div><small>同一个资源可以同时属于多个商店。</small></label>
          <label class="wide">官网<input data-resource-field="website" value="${escapeHtml(resource.website)}"></label>
          <label class="wide">教程地址<input data-resource-field="tutorial" value="${escapeHtml(resource.tutorial)}"></label>
          <label class="wide">描述<textarea data-resource-field="description">${escapeHtml(resource.description)}</textarea></label>
          <label class="wide">来源产品<div class="checks">${sourceProducts.length
            ? sourceProducts.map(({ vendor, product }) => `<label><input type="checkbox" data-resource-source-product="${escapeHtml(product.id)}" ${(resource.sourceProductIds || []).includes(product.id) ? "checked" : ""}>${escapeHtml(vendor.name)} / ${escapeHtml(product.name)}</label>`).join("")
            : "暂无 AI 可接入产品"}</div><small>这里只能选择“AI 可接入厂商”目录中的产品。</small></label>
          <div class="wide resourceTargets">
            <div class="panelHeader"><div><b>接入目标</b><small>每个目标选择一个 AI 工具、兼容性和固定客户端模块。</small></div><button class="smallButton" data-action="add-resource-target" ${targetProducts.length ? "" : "disabled"}>＋ 添加目标</button></div>
            ${(resource.targets || []).map((target, index) => {
              const module = resourceModuleFor(target);
              return `<div class="resourceTarget">
                <label>AI 工具<select data-resource-target-field="${index}:productId">${resourceTargetProductOptions(resource, target)}</select></label>
                <label>兼容性<select data-resource-target-field="${index}:compatibility">
                  <option value="official"${target.compatibility === "official" ? " selected" : ""}>官方支持</option>
                  <option value="protocol-compatible"${target.compatibility === "protocol-compatible" ? " selected" : ""}>协议兼容</option>
                  <option value="verified"${target.compatibility === "verified" ? " selected" : ""}>已验证</option>
                </select></label>
                <label>客户端模块<select data-resource-target-module="${index}">${resourceModuleOptions(resource, target)}</select></label>
                ${module?.requiresProfile ? `<label>已审核安装配置<select data-resource-target-profile="${index}">${resourceInstallProfileOptions(resource, target)}</select></label>` : ""}
                <label class="wide">模块功能<div class="checks">${(module?.capabilities || []).map((capability) => `<label><input type="checkbox" data-resource-target-capability="${index}:${escapeHtml(capability)}" ${(target.capabilities || []).includes(capability) ? "checked" : ""}>${escapeHtml(capabilityLabels[capability] || capability)}</label>`).join("")}</div><small>${escapeHtml(module?.description || "请选择资源模块")} 后台只能关闭已审核能力。</small></label>
                <label class="targetEnabled"><input type="checkbox" data-resource-target-enabled="${index}" ${target.enabled !== false ? "checked" : ""}>启用该目标</label>
                <button class="dangerButton" data-action="delete-resource-target" data-index="${index}" ${resource.targets.length <= 1 ? "disabled" : ""}>删除目标</button>
              </div>`;
            }).join("")}
          </div>
          <label>版本引用<input data-resource-optional-field="versionRef" value="${escapeHtml(resource.versionRef || "")}" placeholder="版本号、标签或提交号"></label>
          <label>安装范围<input data-resource-optional-field="installScope" value="${escapeHtml(resource.installScope || "")}" placeholder="用户级、项目级或宿主范围"></label>
          <label class="wide">请求权限<textarea data-resource-list-field="requestedPermissions" placeholder="一行一项">${escapeHtml((resource.requestedPermissions || []).join("\n"))}</textarea></label>
          <label class="wide">凭据要求<textarea data-resource-list-field="credentialRequirements" placeholder="一行一项，不填写密钥值">${escapeHtml((resource.credentialRequirements || []).join("\n"))}</textarea></label>
          <label class="wide">卸载方案<textarea data-resource-optional-field="uninstallPlan" placeholder="说明如何移除以及保留哪些用户数据">${escapeHtml(resource.uninstallPlan || "")}</textarea></label>
          <label class="wide">来源证据<textarea data-resource-list-field="provenanceEvidence" placeholder="一行一个 HTTPS 官方或审核证据链接">${escapeHtml((resource.provenanceEvidence || []).join("\n"))}</textarea></label>
          <label class="wide">最后核验时间<input data-resource-optional-field="lastVerifiedAt" value="${escapeHtml(resource.lastVerifiedAt || "")}" placeholder="2026-07-31T12:00:00Z"></label>
          <label class="toggleLabel"><input type="checkbox" data-resource-enabled ${resource.enabled !== false ? "checked" : ""}>在生态资源商店中启用</label>
        </div></section>` : `<div class="empty">选择或新增一个生态资源</div>`}
    </div>`;
}

function discoveryStatusLabel(status) {
  if (status === "ignored") return "已忽略";
  if (status === "accepted") return "已加入草稿";
  return "待审核";
}

function discoveryScanLabel(status) {
  if (status === "running") return "正在扫描";
  if (status === "completed") return "扫描完成";
  if (status === "failed") return "扫描失败";
  return "尚未扫描";
}

function suggestedDiscoveryProductId(candidate) {
  const suffix = candidate.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${candidate.vendorId}-${suffix || candidate.id.slice(0, 10)}`.slice(0, 100);
}

function renderDiscovery() {
  title.textContent = "产品候选";
  const discovery = state.discovery;
  if (!discovery) {
    content.innerHTML = `<div class="empty">正在读取候选报告…</div>`;
    return;
  }
  const filtered = discovery.candidates.filter(
    (candidate) =>
      state.discoveryFilter === "all" || candidate.status === state.discoveryFilter
  );
  if (!filtered.some((candidate) => candidate.id === state.selectedDiscoveryId)) {
    state.selectedDiscoveryId = filtered[0]?.id || "";
  }
  const selected = filtered.find(
    (candidate) => candidate.id === state.selectedDiscoveryId
  );
  const safeModules = state.productModules.modules.filter((module) =>
    ["web-link", "desktop-official", "cli-official", "tutorial-link"].includes(module.id)
  );
  const scanRunning = discovery.scan.status === "running";
  const scanError = discovery.scan.error
    ? `<div class="reviewWarning error">${escapeHtml(discovery.scan.error)}</div>`
    : "";
  const staleNotice = discovery.stale
    ? `<div class="reviewWarning">目录在报告生成后有过修改，候选仍可加入停用草稿；建议完成当前审核后重新扫描。</div>`
    : "";
  const selectedDetail = selected
    ? `<section class="panel reviewDetail">
        <div class="panelHeader"><div><h3>${escapeHtml(selected.label)}</h3>
        <small>${escapeHtml(selected.vendorName)} · 置信分 ${escapeHtml(selected.score)} · ${escapeHtml(discoveryStatusLabel(selected.status))}</small></div>
        <span class="statusPill ${escapeHtml(selected.status)}">${escapeHtml(discoveryStatusLabel(selected.status))}</span></div>
        <div class="reviewEvidence">
          <a href="${escapeHtml(selected.url)}" target="_blank" rel="noreferrer">打开候选页面 ↗</a>
          <a href="${escapeHtml(selected.evidenceUrl)}" target="_blank" rel="noreferrer">查看发现来源 ↗</a>
          <code>${escapeHtml(selected.url)}</code>
        </div>
        ${selected.status === "accepted"
          ? `<div class="acceptedNotice">已加入产品草稿：<b>${escapeHtml(selected.productId)}</b>。默认保持停用，请到“产品管理”补充资料后再启用和发布。</div>`
          : selected.status === "ignored"
            ? `<div class="reviewActions"><button class="secondary" data-action="restore-discovery" data-candidate-id="${escapeHtml(selected.id)}">恢复为待审核</button></div>`
            : `<div class="formGrid reviewForm">
                <label>产品 ID<input data-discovery-product="id" value="${escapeHtml(suggestedDiscoveryProductId(selected))}"></label>
                <label>产品名称<input data-discovery-product="name" value="${escapeHtml(selected.label)}"></label>
                <label>产品类别<select data-discovery-product="category">${optionList(catalogCategories(), catalogCategories().includes(selected.suggestedCategory) ? selected.suggestedCategory : catalogCategories()[0])}</select></label>
                <label>所属目录<select data-discovery-product="directoryKind"><option value="ai-tool">全部 AI 厂商</option><option value="ai-connectable">全部 AI 可接入厂商</option></select></label>
                <label>产品模块<select data-discovery-product="moduleId">${safeModules.map((module) => `<option value="${escapeHtml(module.id)}"${module.id === selected.suggestedModuleId ? " selected" : ""}>${escapeHtml(module.label)}</option>`).join("")}</select></label>
                <label class="wide">教程地址<input data-discovery-product="tutorial" value="${escapeHtml(selected.evidenceUrl)}"></label>
                <label class="wide">产品描述<textarea data-discovery-product="description">${escapeHtml(`${selected.label}，来源于 ${selected.vendorName} 官方页面。`)}</textarea></label>
              </div>
              <div class="reviewActions">
                <button class="secondary" data-action="ignore-discovery" data-candidate-id="${escapeHtml(selected.id)}">忽略</button>
                <button class="primary" data-action="accept-discovery" data-candidate-id="${escapeHtml(selected.id)}">加入停用草稿</button>
              </div>`}
      </section>`
    : `<div class="empty">当前筛选下没有候选</div>`;

  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">目录 / 官方源发现</p><h2>产品候选审核</h2>
    <p>自动扫描只提供官方证据。确认后的产品先进入停用草稿，本地安装能力仍必须由客户端白名单批准。</p></div>
    <button class="primary" data-action="scan-discovery" ${scanRunning ? "disabled" : ""}>${scanRunning ? "正在扫描…" : "重新扫描官方源"}</button></section>
    <section class="reviewSummary">
      <div><span>待审核</span><b>${escapeHtml(discovery.summary.pending)}</b></div>
      <div><span>已忽略</span><b>${escapeHtml(discovery.summary.ignored)}</b></div>
      <div><span>已加入草稿</span><b>${escapeHtml(discovery.summary.accepted)}</b></div>
      <div><span>页面 / 线索</span><b>${escapeHtml(discovery.summary.checkedPages)} / ${escapeHtml(discovery.summary.researchLeads)}</b></div>
      <div><span>扫描状态</span><b>${escapeHtml(discoveryScanLabel(discovery.scan.status))}</b></div>
    </section>
    ${staleNotice}${scanError}
    <div class="filterTabs">
      ${[
        ["pending", "待审核"],
        ["ignored", "已忽略"],
        ["accepted", "已加入草稿"],
        ["all", "全部"]
      ].map(([value, label]) => `<button data-discovery-filter="${value}" class="${state.discoveryFilter === value ? "active" : ""}">${label}</button>`).join("")}
    </div>
    ${discovery.available
      ? `<div class="twoColumn reviewColumns">
          <section class="panel itemList reviewList">${filtered.length
            ? filtered.map((candidate) => `<button data-discovery="${escapeHtml(candidate.id)}" class="${candidate.id === state.selectedDiscoveryId ? "active" : ""}">
                <i>${candidate.inferredType === "cli" ? "C" : candidate.inferredType === "desktop" ? "D" : candidate.inferredType === "agent" ? "A" : "W"}</i>
                <span>${escapeHtml(candidate.label)}<br><small>${escapeHtml(candidate.vendorName)} · ${escapeHtml(discoveryStatusLabel(candidate.status))} · ${escapeHtml(candidate.inferredType)}</small></span>
              </button>`).join("")
            : `<div class="empty">暂无候选</div>`}</section>
          ${selectedDetail}
        </div>`
      : `<div class="empty">还没有候选报告，点击“重新扫描官方源”开始生成。</div>`}`;
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
      <span>${validation.summary.vendors} 个厂商 · ${validation.summary.products} 个产品 · ${validation.summary.resources || 0} 个生态资源 · ${validation.summary.approvedDownloadSources} 个下载源${validation.certifications ? ` · 桌面认证 ${validation.certifications.accepted}/${validation.certifications.total}` : ""}</span>
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
  if (state.view === "resources") renderResources();
  if (state.view === "discovery") renderDiscovery();
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

async function transitionProductCertification(target, status) {
  const changedBy = content.querySelector(
    '[data-certification-field="changedBy"]'
  )?.value.trim();
  if (!changedBy) return toast("请填写操作人", true);
  const field = (name) =>
    content.querySelector(`[data-certification-field="${name}"]`)?.value || "";
  const body = {
    productId: state.selectedProductId,
    status,
    expectedRevision: state.productCertifications.revision,
    changedBy,
    notes: field("notes")
  };
  if (status === "accepted") {
    body.clientVersion = field("clientVersion");
    body.windowsVersion = field("windowsVersion");
    body.evidenceReference = field("evidenceReference");
    body.checks = Object.fromEntries(
      Object.keys(certificationCheckLabels).map((name) => [
        name,
        Boolean(content.querySelector(`[data-certification-check="${name}"]`)?.checked)
      ])
    );
  }
  const originalText = target.textContent;
  target.disabled = true;
  target.textContent = "正在保存…";
  try {
    const payload = await request("/api/product-certifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    state.productCertifications = {
      revision: payload.revision,
      summary: payload.summary,
      products: payload.products
    };
    renderProducts();
    toast(`认证状态已更新为“${certificationLabels[status]}”`);
  } catch (error) {
    target.disabled = false;
    target.textContent = originalText;
    toast(error.message, true);
  }
}

content.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.vendor) {
    state.selectedVendorId = target.dataset.vendor;
    render();
  } else if (target.dataset.product) {
    state.selectedProductId = target.dataset.product;
    render();
  } else if (target.dataset.resource) {
    state.selectedResourceId = target.dataset.resource;
    render();
  } else if (target.dataset.discovery) {
    state.selectedDiscoveryId = target.dataset.discovery;
    renderDiscovery();
  } else if (target.dataset.discoveryFilter) {
    state.discoveryFilter = target.dataset.discoveryFilter;
    state.selectedDiscoveryId = "";
    renderDiscovery();
  } else if (target.dataset.action === "accept-product-certification") {
    await transitionProductCertification(target, "accepted");
  } else if (target.dataset.action === "review-product-certification") {
    await transitionProductCertification(target, "reviewed");
  } else if (target.dataset.action === "hold-product-certification") {
    await transitionProductCertification(target, "pending");
  } else if (target.dataset.action === "scan-discovery") {
    target.disabled = true;
    target.textContent = "正在启动…";
    try {
      await request("/api/discovery/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      await refreshDiscovery();
      toast("官方产品扫描已开始");
    } catch (error) {
      toast(error.message, true);
      renderDiscovery();
    }
  } else if (
    target.dataset.action === "ignore-discovery" ||
    target.dataset.action === "restore-discovery"
  ) {
    const status =
      target.dataset.action === "ignore-discovery" ? "ignored" : "pending";
    try {
      state.discovery = await request("/api/discovery/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: target.dataset.candidateId,
          status
        })
      });
      state.selectedDiscoveryId = "";
      renderDiscovery();
      toast(status === "ignored" ? "候选已忽略" : "候选已恢复");
    } catch (error) {
      toast(error.message, true);
    }
  } else if (target.dataset.action === "accept-discovery") {
    const values = Object.fromEntries(
      [...content.querySelectorAll("[data-discovery-product]")].map((input) => [
        input.dataset.discoveryProduct,
        input.value
      ])
    );
    target.disabled = true;
    target.textContent = "正在加入…";
    try {
      const result = await request("/api/discovery/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: target.dataset.candidateId,
          expectedRevision: state.draftRevision,
          product: values
        })
      });
      state.draftRevision = result.revision;
      await loadCatalog();
      toast(`“${result.product.name}”已加入停用草稿`);
    } catch (error) {
      toast(error.message, true);
      renderDiscovery();
    }
  } else if (target.dataset.action === "add-banner") {
    state.catalog.home.banners.push({
      eyebrow: "枕星 AI · PC",
      title: "新轮播标题",
      description: "请输入轮播说明。",
      action: "查看全部 AI 厂商"
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
    if (state.catalog.resources.some((resource) => resource.publisherVendorId === vendor.id)) {
      return toast("请先移除生态资源中的发布厂商引用", true);
    }
    if (!confirm(`确定删除厂商“${vendor.name}”吗？`)) return;
    state.catalog.vendors = state.catalog.vendors.filter((item) => item.id !== vendor.id);
    state.catalog.home.featuredVendorIds = state.catalog.home.featuredVendorIds.filter((id) => id !== vendor.id);
    state.selectedVendorId = state.catalog.vendors[0]?.id || ""; markDirty(); render();
  } else if (target.dataset.action === "add-category") {
    const input = content.querySelector("[data-new-category]");
    const category = input?.value.trim() || "";
    if (!category || category.length > 40) {
      return toast("类别名称应为 1–40 个字符", true);
    }
    if (catalogCategories().includes(category)) {
      return toast("该产品类别已经存在", true);
    }
    state.catalog.categories.push(category);
    markDirty();
    renderProducts();
  } else if (target.dataset.action === "rename-category") {
    const index = Number(target.dataset.index);
    const previous = catalogCategories()[index];
    const input = content.querySelector(`[data-category-name="${index}"]`);
    const category = input?.value.trim() || "";
    if (!previous) return;
    if (!category || category.length > 40) {
      return toast("类别名称应为 1–40 个字符", true);
    }
    if (
      category !== previous &&
      catalogCategories().some((item, itemIndex) =>
        itemIndex !== index && item === category
      )
    ) {
      return toast("该产品类别已经存在", true);
    }
    if (category === previous) return toast("类别名称没有变化");
    if (!confirm(`将类别“${previous}”重命名为“${category}”，并同步更新相关产品吗？`)) {
      return renderProducts();
    }
    for (const { product } of allProducts()) {
      if (product.category === previous) product.category = category;
    }
    state.catalog.categories[index] = category;
    markDirty();
    renderProducts();
  } else if (target.dataset.action === "delete-category") {
    const index = Number(target.dataset.index);
    const category = catalogCategories()[index];
    if (!category) return;
    if (allProducts().some(({ product }) => product.category === category)) {
      return toast("该类别仍有产品，不能删除", true);
    }
    if (catalogCategories().length <= 1) {
      return toast("目录至少需要保留一个产品类别", true);
    }
    if (!confirm(`确定删除类别“${category}”吗？`)) return;
    state.catalog.categories.splice(index, 1);
    markDirty();
    renderProducts();
  } else if (target.dataset.action === "add-product-entry") {
    const product = selectedProductRecord()?.product;
    if (!product) return;
    product.entryPoints ||= [];
    const actionType = product.kind === "CLI" ? "cli" : "website";
    product.entryPoints.push(
      actionType === "cli"
        ? { type: "cli", label: "CLI 一键安装" }
        : {
            type: "website",
            label: "工具官网",
            url: product.website
          }
    );
    markDirty();
    renderProducts();
  } else if (target.dataset.action === "delete-product-entry") {
    const product = selectedProductRecord()?.product;
    if (!product?.entryPoints) return;
    product.entryPoints.splice(Number(target.dataset.index), 1);
    markDirty();
    renderProducts();
  } else if (target.dataset.action === "move-product-entry") {
    const product = selectedProductRecord()?.product;
    if (
      product?.entryPoints &&
      moveItem(
        product.entryPoints,
        Number(target.dataset.index),
        Number(target.dataset.offset)
      )
    ) {
      markDirty();
      renderProducts();
    }
  } else if (target.dataset.action === "add-product") {
    const vendor = state.catalog.vendors[0];
    if (!vendor) return toast("请先创建厂商", true);
    const id = `product-${Date.now()}`;
    vendor.products.push({
      id, enabled: true, order: vendor.products.length, name: "新产品",
      kind: "其他产品", directoryKind: "ai-tool", category: catalogCategories()[0],
      description: "请输入产品描述。", website: "https://example.com",
      tutorial: "https://example.com", productType: "web", requirements: [],
      moduleId: "web-link", installProfileId: "",
      installPolicy: "open-product-website", downloadPolicy: "none",
      signaturePolicy: "not-applicable", uninstallPolicy: "not-managed"
      , capabilities: ["website", "tutorial"], entryPoints: [
        { type: "web", label: "打开网页版", url: "https://example.com" }
      ], componentProductIds: []
    });
    state.selectedProductId = id; markDirty(); render();
  } else if (target.dataset.action === "delete-product") {
    const record = selectedProductRecord();
    const parent = allProducts().find(({ product }) =>
      (product.componentProductIds || []).includes(record?.product.id)
    );
    if (parent) {
      return toast("请先从父产品组件目录中移除该产品", true);
    }
    if (record?.product.componentProductIds?.length) {
      return toast("请先移除该产品下的组件关系", true);
    }
    const resourceReference = state.catalog.resources.find(
      (resource) =>
        (resource.sourceProductIds || []).includes(record?.product.id) ||
        resource.targets.some((resourceTarget) => resourceTarget.productId === record?.product.id)
    );
    if (resourceReference) {
      return toast(`请先从生态资源“${resourceReference.name}”中移除该产品引用`, true);
    }
    if (!record || !confirm(`确定删除产品“${record.product.name}”吗？`)) return;
    record.vendor.products = record.vendor.products.filter((item) => item.id !== record.product.id);
    state.selectedProductId = allProducts()[0]?.product.id || ""; markDirty(); render();
  } else if (target.dataset.action === "add-resource") {
    const firstTarget = allProducts().find(
      ({ product }) => product.directoryKind === "ai-tool"
    )?.product;
    if (!firstTarget) return toast("请先创建一个 AI 工具类产品", true);
    const id = `resource-${Date.now()}`;
    state.catalog.resources.push({
      id,
      enabled: true,
      order: state.catalog.resources.length,
      name: "新生态资源",
      resourceTypes: ["skill"],
      description: "请输入生态资源描述。",
      website: "https://example.com",
      tutorial: "https://example.com",
      sourceProductIds: [],
      targets: [{
        productId: firstTarget.id,
        compatibility: "protocol-compatible",
        moduleId: "resource-link",
        installProfileId: "",
        capabilities: ["website"],
        enabled: true
      }]
    });
    state.selectedResourceId = id;
    markDirty();
    render();
  } else if (target.dataset.action === "delete-resource") {
    const resource = selectedResource();
    if (!resource || !confirm(`确定删除生态资源“${resource.name}”吗？`)) return;
    state.catalog.resources = state.catalog.resources.filter(
      (item) => item.id !== resource.id
    );
    state.selectedResourceId = allResources()[0]?.id || "";
    markDirty();
    render();
  } else if (target.dataset.action === "add-resource-target") {
    const resource = selectedResource();
    if (!resource) return;
    const product = allProducts().find(
      ({ product }) =>
        product.directoryKind === "ai-tool" &&
        !resource.targets.some((item) => item.productId === product.id)
    )?.product;
    if (!product) return toast("没有可添加的 AI 工具目标", true);
    resource.targets.push({
      productId: product.id,
      compatibility: "protocol-compatible",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    });
    markDirty();
    renderResources();
  } else if (target.dataset.action === "delete-resource-target") {
    const resource = selectedResource();
    if (!resource || resource.targets.length <= 1) {
      return toast("生态资源至少需要保留一个接入目标", true);
    }
    resource.targets.splice(Number(target.dataset.index), 1);
    markDirty();
    renderResources();
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
      for (const resource of state.catalog.resources) {
        if (resource.publisherVendorId === previousId) {
          resource.publisherVendorId = input.value;
        }
      }
    }
  } else if (input.dataset.vendorNumber) {
    selectedVendor()[input.dataset.vendorNumber] = Number(input.value);
  } else if ("vendorRequiresCrossBorderNetwork" in input.dataset) {
    selectedVendor().requiresCrossBorderNetwork = input.checked;
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
    const previousId = record.product.id;
    if (field === "vendorId") {
      record.vendor.products = record.vendor.products.filter((item) => item.id !== record.product.id);
      state.catalog.vendors.find((vendor) => vendor.id === input.value).products.push(record.product);
    } else {
      if (field === "directoryKind") {
        const isTarget = state.catalog.resources.some((resource) =>
          resource.targets.some((target) => target.productId === record.product.id)
        );
        const isSource = state.catalog.resources.some((resource) =>
          (resource.sourceProductIds || []).includes(record.product.id)
        );
        if (input.value === "ai-connectable" && isTarget) {
          input.value = record.product.directoryKind;
          return toast("请先移除该产品的生态资源接入目标", true);
        }
        if (input.value === "ai-tool" && isSource) {
          input.value = record.product.directoryKind;
          return toast("请先移除该产品的生态资源来源引用", true);
        }
      }
      record.product[field] = input.value;
      if (field === "id") {
        for (const { product } of allProducts()) {
          product.componentProductIds = (product.componentProductIds || []).map(
            (id) => id === previousId ? input.value : id
          );
        }
        for (const resource of state.catalog.resources) {
          resource.sourceProductIds = (resource.sourceProductIds || []).map(
            (id) => id === previousId ? input.value : id
          );
          for (const target of resource.targets) {
            if (target.productId === previousId) target.productId = input.value;
          }
        }
        state.selectedProductId = input.value;
      }
    }
  } else if (input.dataset.productEntryField) {
    const product = selectedProductRecord().product;
    const [indexText, field] = input.dataset.productEntryField.split(":");
    const entry = product.entryPoints?.[Number(indexText)];
    if (!entry) return;
    if (field === "type") {
      entry.type = input.value;
      if (["website", "web", "tutorial", "external"].includes(entry.type)) {
        entry.url ||= product.website;
      } else {
        delete entry.url;
      }
      markDirty();
      renderProducts();
      return;
    }
    entry[field] = input.value;
  } else if (input.dataset.productComponent) {
    const product = selectedProductRecord().product;
    product.componentProductIds = input.checked
      ? [...new Set([...(product.componentProductIds || []), input.dataset.productComponent])]
      : (product.componentProductIds || []).filter(
          (item) => item !== input.dataset.productComponent
        );
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
    product.capabilities = [
      ...(profile?.capabilities || productModuleFor(product)?.capabilities || [])
    ];
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
  } else if (input.dataset.capability) {
    const product = selectedProductRecord().product;
    product.capabilities = input.checked
      ? [...new Set([...(product.capabilities || []), input.dataset.capability])]
      : (product.capabilities || []).filter(
          (item) => item !== input.dataset.capability
        );
  } else if (input.dataset.downloadField) {
    const product = selectedProductRecord().product;
    const urlInput = content.querySelector('[data-download-field="url"]').value.trim();
    const fileInput = content.querySelector('[data-download-field="fileName"]').value.trim();
    product.download = urlInput || fileInput ? { url: urlInput, fileName: fileInput } : undefined;
  } else if (input.dataset.resourceStoreField) {
    const [indexText, field] = input.dataset.resourceStoreField.split(":");
    state.catalog.resourceStores[Number(indexText)][field] =
      field === "order" ? Number(input.value) : input.value;
  } else if (input.dataset.resourceStoreEnabled) {
    state.catalog.resourceStores[Number(input.dataset.resourceStoreEnabled)].enabled =
      input.checked;
  } else if (input.dataset.resourceField) {
    const resource = selectedResource();
    const field = input.dataset.resourceField;
    resource[field] = input.value;
    if (field === "id") state.selectedResourceId = input.value;
  } else if (input.dataset.resourceOptionalField) {
    const resource = selectedResource();
    const field = input.dataset.resourceOptionalField;
    const value = input.value.trim();
    if (value) resource[field] = value;
    else delete resource[field];
  } else if (input.dataset.resourceListField) {
    const resource = selectedResource();
    const field = input.dataset.resourceListField;
    const values = input.value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (values.length) resource[field] = [...new Set(values)];
    else delete resource[field];
  } else if (input.dataset.resourceNumber) {
    selectedResource()[input.dataset.resourceNumber] = Number(input.value);
  } else if ("resourceEnabled" in input.dataset) {
    selectedResource().enabled = input.checked;
  } else if (input.dataset.resourceType) {
    const resource = selectedResource();
    const type = input.dataset.resourceType;
    const usedByTarget = resource.targets.some(
      (target) => resourceModuleFor(target)?.resourceType === type
    );
    if (!input.checked && (resource.resourceTypes.length === 1 || usedByTarget)) {
      input.checked = true;
      return toast(
        usedByTarget
          ? "请先更改使用该类型的目标模块"
          : "生态资源至少需要保留一个类型",
        true
      );
    }
    resource.resourceTypes = input.checked
      ? [...new Set([...resource.resourceTypes, type])]
      : resource.resourceTypes.filter((item) => item !== type);
    markDirty();
    renderResources();
    return;
  } else if (input.dataset.resourceSourceProduct) {
    const resource = selectedResource();
    const productId = input.dataset.resourceSourceProduct;
    resource.sourceProductIds = input.checked
      ? [...new Set([...(resource.sourceProductIds || []), productId])]
      : (resource.sourceProductIds || []).filter((item) => item !== productId);
  } else if (input.dataset.resourceTargetField) {
    const resource = selectedResource();
    const [indexText, field] = input.dataset.resourceTargetField.split(":");
    const target = resource.targets[Number(indexText)];
    if (field === "productId" && resource.targets.some(
      (item, index) => index !== Number(indexText) && item.productId === input.value
    )) {
      input.value = target.productId;
      return toast("同一资源不能重复添加同一个 AI 工具目标", true);
    }
    target[field] = input.value;
    if (field === "productId") {
      applyResourceModule(resource, target, target.moduleId);
      markDirty();
      renderResources();
      return;
    }
  } else if (input.dataset.resourceTargetModule) {
    const resource = selectedResource();
    const target = resource.targets[Number(input.dataset.resourceTargetModule)];
    applyResourceModule(resource, target, input.value);
    markDirty();
    renderResources();
    return;
  } else if (input.dataset.resourceTargetProfile) {
    const resource = selectedResource();
    const target = resource.targets[Number(input.dataset.resourceTargetProfile)];
    const profile = state.productModules.extensionInstallProfiles.find(
      (candidate) => candidate.id === input.value
    );
    target.installProfileId = input.value;
    target.capabilities = [
      ...(profile?.capabilities || resourceModuleFor(target)?.capabilities || [])
    ];
    markDirty();
    renderResources();
    return;
  } else if (input.dataset.resourceTargetCapability) {
    const resource = selectedResource();
    const [indexText, capability] = input.dataset.resourceTargetCapability.split(":");
    const target = resource.targets[Number(indexText)];
    target.capabilities = input.checked
      ? [...new Set([...(target.capabilities || []), capability])]
      : (target.capabilities || []).filter((item) => item !== capability);
  } else if (input.dataset.resourceTargetEnabled) {
    selectedResource().targets[Number(input.dataset.resourceTargetEnabled)].enabled =
      input.checked;
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
