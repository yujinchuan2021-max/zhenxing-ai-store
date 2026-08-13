const state = {
  catalog: null,
  view: "home",
  selectedVendorId: "",
  selectedProductId: "",
  selectedResourceId: "",
  resourceStoreKind: "skill",
  resourceSourceChannel: "all",
  selectedDiscoveryId: "",
  discoveryFilter: "pending",
  discovery: null,
  dirty: false,
  publication: null,
  draftRevision: 0,
  activeCatalogVersion: 0,
  releaseChannel: "v1",
  releaseData: null,
  validationReport: null,
  communityAdmin: null,
  productCertifications: {
    revision: 0,
    summary: { total: 0, pending: 0, reviewed: 0, accepted: 0 },
    products: []
  },
  productModules: {
    modules: [],
    entryPointTypes: [],
    officialDownloadKinds: [],
    installProfiles: [],
    resourceModules: [],
    extensionInstallProfiles: [],
    resourceSourceChannels: [],
    resourceSourceKinds: [],
    resourceReviewStatuses: [],
    resourceRiskLevels: []
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
    try {
      state.communityAdmin = await request("/api/community-management");
    } catch (error) {
      state.communityAdmin = { status: "unavailable", error: error.message };
    }
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
    state.catalog.homeCarousel ||= { autoplayMs: 7000, slides: [] };
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
      { id: "plugin", label: "插件商店", enabled: true, order: 2 },
      { id: "connector", label: "连接器商店", enabled: true, order: 3 }
    ];
    state.catalog.resources ||= [];
    state.selectedVendorId = state.catalog.vendors[0]?.id || "";
    state.selectedProductId = state.catalog.vendors[0]?.products[0]?.id || "";
    state.resourceStoreKind = state.catalog.resourceStores.some(
      (store) => store.id === state.resourceStoreKind
    ) ? state.resourceStoreKind : state.catalog.resourceStores[0]?.id || "skill";
    state.selectedResourceId = resourcesForSelectedStore()[0]?.id || "";
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
        channel: state.releaseChannel,
        expectedDraftRevision: state.draftRevision,
        expectedActiveCatalogVersion: state.releaseData.channels?.[state.releaseChannel]?.state?.activeCatalogVersion ?? 0
      })
    });
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

function canEditOfficialDownload(product) {
  return (
    (product.productType === "desktop-official" && product.downloadPolicy === "official-page") ||
    product.productType === "web"
  );
}

function officialDownloadKindOptions(product) {
  const kinds = state.productModules.officialDownloadKinds || [];
  const allowed = kinds.filter(({ kind }) =>
    product.productType === "web" ? kind === "no-windows" : kind !== "no-windows"
  );
  const selected = product.officialDownload?.kind || allowed[0]?.kind || "download-page";
  return allowed.map(({ kind, buttonLabel }) =>
    `<option value="${escapeHtml(kind)}"${kind === selected ? " selected" : ""}>${escapeHtml(buttonLabel || kind)}</option>`
  ).join("");
}

function officialDownloadPreview(product) {
  const metadata = (state.productModules.officialDownloadKinds || []).find(
    ({ kind }) => kind === product.officialDownload?.kind
  );
  if (!metadata) return "预览：仅打开官方入口；不会下载、安装或执行本地命令。";
  const steps = (metadata.steps || []).join("；");
  return `预览：${metadata.buttonLabel || "不提供 Windows 下载按钮"}。${steps}；仅打开官方入口，不会下载、安装或执行本地命令。`;
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
      module.legacyModuleIds?.includes(product.moduleId) ||
      (!product.moduleId && module.productType === product.productType)
  );
}

function productModuleOptions(product, vendorId) {
  const selected = productModuleFor(product)?.id || "";
  return state.productModules.modules
    .map((module) => {
      const approved =
        !module.requiresProfile ||
        Boolean(module.catalogProfileId) ||
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
      (profile.moduleId === module.id || module.legacyModuleIds?.includes(profile.moduleId)) &&
      profile.vendorId === vendorId &&
      profile.productId === product.id
  );
  if (module.catalogProfileId && profiles.length === 0) return "";
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
      (profile.moduleId === module.id || module.legacyModuleIds?.includes(profile.moduleId)) &&
      profile.vendorId === vendorId &&
      profile.productId === product.id
  );
  product.installProfileId = module.requiresProfile
    ? matchingProfile?.id || module.catalogProfileId || ""
    : "";
  product.requirements = matchingProfile?.requirements || [];
  product.capabilities = [
    ...(matchingProfile?.capabilities || module.capabilities || [])
  ];
  if (matchingProfile?.download) {
    product.download = { ...matchingProfile.download };
  } else if (module.catalogProfileId) {
    product.download ||= { url: "", fileName: "", artifactKind: "exe", mirrors: [] };
  } else {
    delete product.download;
  }
  if (
    module.productType !== "desktop-official" &&
    !(module.productType === "web" && product.officialDownload?.kind === "no-windows")
  ) {
    delete product.officialDownload;
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

function selectedResourceStoreKind() {
  return state.catalog.resourceStores.some(
    (store) => store.id === state.resourceStoreKind
  ) ? state.resourceStoreKind : state.catalog.resourceStores[0]?.id || "skill";
}

function selectedResourceSourceChannel() {
  return ["all", ...(state.productModules.resourceSourceChannels || [])].includes(
    state.resourceSourceChannel
  ) ? state.resourceSourceChannel : "all";
}

function resourceSourceChannel(resource) {
  return resource.sourceKind === "official" ? "official" : "community";
}

function resourceReviewStatus(resource) {
  return (state.productModules.resourceReviewStatuses || []).includes(
    resource.reviewStatus
  ) ? resource.reviewStatus : "unreviewed";
}

function resourceRiskLevel(resource) {
  return (state.productModules.resourceRiskLevels || []).includes(
    resource.riskLevel
  ) ? resource.riskLevel : "guarded";
}

function resourceMetadataSnapshot(resource) {
  return resource?.metadataSnapshot &&
    typeof resource.metadataSnapshot === "object" &&
    !Array.isArray(resource.metadataSnapshot)
    ? resource.metadataSnapshot
    : {};
}

function resourceStoreSourceStats(kind) {
  const stats = { official: 0, community: 0 };
  for (const resource of allResources()) {
    if (!resource.resourceTypes.includes(kind)) continue;
    stats[resourceSourceChannel(resource)] += 1;
  }
  return stats;
}

function resourcesForSelectedStore() {
  const kind = selectedResourceStoreKind();
  const sourceChannel = selectedResourceSourceChannel();
  return allResources()
    .filter(
      (resource) =>
        resource.resourceTypes.includes(kind) &&
        (sourceChannel === "all" || resourceSourceChannel(resource) === sourceChannel)
    )
    .sort((left, right) => (left.order || 0) - (right.order || 0) || left.id.localeCompare(right.id));
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

function normalizeCarouselSort(slides) {
  slides.forEach((slide, index) => (slide.sort = index));
}

function carouselPreview(imageUrl) {
  return /^(https:\/\/|\/assets\/[A-Za-z0-9])/.test(imageUrl || "")
    ? `<img class="carouselPreview" src="${escapeHtml(imageUrl)}" alt="">`
    : "";
}

function renderHome() {
  title.textContent = "首页内容";
  const banners = state.catalog.home.banners;
  const carousel = state.catalog.homeCarousel;
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
      <div class="panelHeader"><div><h3>视觉轮播（发布路径图片）</h3><small>仅 HTTPS 或 /assets/ 图片；操作仅限已批准内部路径或 HTTPS。</small></div>
      <button class="smallButton" data-action="add-carousel-slide">＋新增视觉轮播</button></div>
      <div class="formGrid"><label>自动播放毫秒<input type="number" min="3000" max="12000" data-carousel-autoplay value="${carousel.autoplayMs}"></label></div>
      ${carousel.slides.map((slide, index) => `
        <section class="carouselSlide">
          <div class="panelHeader"><div class="bannerIndex">${index + 1}</div><div>
            <button class="smallButton" data-action="move-carousel-slide" data-index="${index}" data-offset="-1">上移</button>
            <button class="smallButton" data-action="move-carousel-slide" data-index="${index}" data-offset="1">下移</button>
            <button class="dangerButton" data-action="delete-carousel-slide" data-index="${index}">删除</button></div></div>
          <div class="formGrid">
            <label>标识<input data-carousel="${index}:id" value="${escapeHtml(slide.id)}"></label>
            <label>排序<input type="number" value="${slide.sort}" readonly></label>
            <label class="wide">图片 URL<input data-carousel="${index}:imageUrl" value="${escapeHtml(slide.imageUrl)}"></label>
            <label class="wide">图片替代文字<input data-carousel="${index}:imageAlt" value="${escapeHtml(slide.imageAlt)}"></label>
            <label class="wide">标题<input data-carousel="${index}:title" value="${escapeHtml(slide.title)}"></label>
            <label class="wide">说明<textarea data-carousel="${index}:description">${escapeHtml(slide.description)}</textarea></label>
            <label>主操作文字<input data-carousel="${index}:primaryLabel" value="${escapeHtml(slide.primaryAction.label)}"></label>
            <label>主操作地址<input data-carousel="${index}:primaryHref" value="${escapeHtml(slide.primaryAction.href)}"></label>
            <label>次操作文字<input data-carousel="${index}:secondaryLabel" value="${escapeHtml(slide.secondaryAction?.label || "")}"></label>
            <label>次操作地址<input data-carousel="${index}:secondaryHref" value="${escapeHtml(slide.secondaryAction?.href || "")}"></label>
            <label class="targetEnabled"><input type="checkbox" data-carousel-enabled="${index}" ${slide.enabled ? "checked" : ""}> 启用</label>
          </div>
          ${carouselPreview(slide.imageUrl)}
        </section>`).join("") || '<p class="empty">没有 slide 时，客户端将回退到内置首页内容。</p>'}
    </section>
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
  title.textContent = "社区管理";
  const community = state.catalog.community;
  const summary = state.communityAdmin || { status: "unavailable" };
  const metric = (value) =>
    value?.status === "ready" && Number.isSafeInteger(value.total)
      ? value.total
      : "—";
  const availability = (value) =>
    value?.status === "ready"
      ? metric(value)
      : value?.reason === "moderation-extension-not-configured"
        ? "未配置"
        : "不可用";
  const targets = summary.targets || { discussions: [], posts: [] };
  const capabilities = summary.capabilities || {};
  content.innerHTML = `
    <section class="intro"><div><p class="eyebrow">社区 / FLARUM</p>
    <h2>社区管理</h2>
    <p>摘要经 CMS 服务端从 Docker 内网读取；不嵌入 Flarum 管理页，也不传递管理员密码、Cookie 或 API key。</p></div>
    <div class="communityActions"><button class="smallButton" data-action="refresh-community-summary">刷新摘要</button></div></section>
    <section class="communitySummary ${summary.status === "ready" ? "ready" : "unavailable"}">
      <div><span>社区健康</span><b>${summary.health === "ready" ? "可用" : "不可用"}</b></div>
      <div><span>用户</span><b>${metric(summary.users)}</b></div>
      <div><span>帖子</span><b>${metric(summary.posts)}</b></div>
      <div><span>待审核</span><b>${availability(summary.pending)}</b></div>
      <div><span>举报</span><b>${availability(summary.reports)}</b></div>
    </section>
    ${summary.status === "ready" ? "" : `<p class="reviewWarning error">${escapeHtml(summary.error || "社区管理桥未就绪。")}</p>`}
    <section class="panel communityAdminNote"><h3>受控管理说明</h3>
      <p>CMS 只同源调用固定社区管理 API；浏览器不会接收 Flarum 管理员密码、Cookie、API key 或上游密钥。</p>
      <p>原生 Flarum 管理入口${capabilities.nativeAdmin ? "已配置" : "未配置"}。待审核或举报扩展未安装时明确显示“未配置”，不会以零条伪装。</p>
    </section>
    <section class="panel communityTargets"><div class="panelHeader"><div><h3>最近讨论</h3><small>仅显示由社区桥接提供的有限目标。</small></div></div>
      <div class="communityTargetList">${targets.discussions.length ? targets.discussions.map((target) => `
        <div class="communityTarget"><div><b>${escapeHtml(target.title)}</b><small>#${escapeHtml(target.id)} · ${target.hidden ? "已隐藏" : "可见"}</small></div>
        <button class="smallButton" data-community-action="set-discussion-hidden" data-community-id="${escapeHtml(target.id)}" data-community-hidden="${target.hidden ? "false" : "true"}" ${capabilities.setDiscussionHidden ? "" : "disabled"}>${target.hidden ? "恢复显示" : "隐藏"}</button></div>`).join("") : "<p class=\"empty\">暂无可管理讨论。</p>"}</div>
    </section>
    <section class="panel communityTargets"><div class="panelHeader"><div><h3>最近帖子</h3><small>操作只允许切换该帖子可见状态。</small></div></div>
      <div class="communityTargetList">${targets.posts.length ? targets.posts.map((target) => `
        <div class="communityTarget"><div><b>${escapeHtml(target.preview)}</b><small>#${escapeHtml(target.id)} · 讨论 ${escapeHtml(target.discussionId)} · 第 ${escapeHtml(target.number)} 楼 · ${target.hidden ? "已隐藏" : "可见"}</small></div>
        <button class="smallButton" data-community-action="set-post-hidden" data-community-id="${escapeHtml(target.id)}" data-community-hidden="${target.hidden ? "false" : "true"}" ${capabilities.setPostHidden ? "" : "disabled"}>${target.hidden ? "恢复显示" : "隐藏"}</button></div>`).join("") : "<p class=\"empty\">暂无可管理帖子。</p>"}</div>
    </section>
    <section class="panel">
      <div class="panelHeader"><h3>${escapeHtml(community.title)}入口配置</h3></div>
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
          <i style="background:${escapeHtml(item.color)}">${item.iconAsset ? `<img src="/${escapeHtml(item.iconAsset.path)}" alt="">` : escapeHtml(item.mark)}</i><span>${escapeHtml(item.name)}
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
             <div class="wide vendorLogoEditor">
               <div class="vendorLogoPreview" style="background:${escapeHtml(vendor.color)}">
                 ${vendor.iconAsset ? `<img src="/${escapeHtml(vendor.iconAsset.path)}" alt="${escapeHtml(vendor.name)} Logo">` : `<b>${escapeHtml(vendor.mark)}</b>`}
               </div>
               <div class="vendorLogoFields">
                 <label>官方 Logo 来源<input data-vendor-icon-source placeholder="https://厂商官网/品牌资源页"></label>
                 <label>上传图片<input type="file" accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml,.ico,.svg" data-vendor-icon-file></label>
                 <div class="vendorLogoActions">
                   <button class="smallButton" data-action="upload-vendor-icon">上传并校验</button>
                   ${vendor.iconAsset ? `<button class="dangerButton" data-action="remove-vendor-icon">移除 Logo</button>` : ""}
                 </div>
                 <small>${vendor.iconAsset ? `已审核资产 · ${escapeHtml(vendor.iconAsset.sha256.slice(0, 12))}…` : "未上传时客户端显示图标文字；只接受官方来源的 PNG、JPG、WebP、ICO 或安全 SVG。"}</small>
               </div>
             </div>
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

const platformSupportOptions = Object.freeze({
  platforms: ["windows", "macos", "linux"],
  runtimes: ["native", "wsl", "container", "browser", "remote"],
  statuses: ["supported", "unsupported", "unknown", "blocked"],
  architectures: ["x64", "arm64", "x86", "universal", "unknown"]
});

function platformSupportSubject(scope) {
  if (scope === "product") return selectedProductRecord()?.product || null;
  if (scope === "resource") return selectedResource() || null;
  return null;
}

function platformSupportEditor(scope, claims) {
  const support = Array.isArray(claims) ? claims : [];
  const select = (values, current) => optionList(values, current);
  return `<div class="wide platformSupportCandidate">
    <div class="panelHeader"><div><b>Platform support (candidate-only)</b><small>Disabled for execution until a separately reviewed fixed profile and client platform request exist. Targets do not duplicate these claims.</small></div>
    <button class="smallButton" data-action="add-platform-support" data-platform-subject="${scope}">+ Add declaration</button></div>
    ${support.length ? support.map((claim, claimIndex) => `
      <div class="formGrid platformSupportClaim">
        <label>Platform<select data-platform-support-claim="${scope}:${claimIndex}:platform">${select(platformSupportOptions.platforms, claim.platform)}</select></label>
        <label>Runtime<select data-platform-support-claim="${scope}:${claimIndex}:runtime">${select(platformSupportOptions.runtimes, claim.runtime)}</select></label>
        <label>Status<select data-platform-support-claim="${scope}:${claimIndex}:status">${select(platformSupportOptions.statuses, claim.status)}</select></label>
        <label class="wide">Architectures<div class="checks">${platformSupportOptions.architectures.map((architecture) => `<label><input type="checkbox" data-platform-support-architecture="${scope}:${claimIndex}:${architecture}" ${(claim.architectures || []).includes(architecture) ? "checked" : ""}>${architecture}</label>`).join("")}</div></label>
        ${(claim.evidence || []).map((evidence, evidenceIndex) => `
          <label class="wide">First-party HTTPS evidence<input maxlength="2048" data-platform-support-evidence="${scope}:${claimIndex}:${evidenceIndex}:url" value="${escapeHtml(evidence.url || "")}" placeholder="https://official.example/platform"></label>
          <label>Observed at<input maxlength="40" data-platform-support-evidence="${scope}:${claimIndex}:${evidenceIndex}:observedAt" value="${escapeHtml(evidence.observedAt || "")}" placeholder="2026-08-07T00:00:00.000Z"></label>
          <button class="dangerButton" data-action="delete-platform-evidence" data-platform-subject="${scope}" data-claim-index="${claimIndex}" data-evidence-index="${evidenceIndex}" ${(claim.evidence || []).length <= 1 ? "disabled" : ""}>Remove evidence</button>`).join("")}
        <div class="rowActions"><button class="smallButton" data-action="add-platform-evidence" data-platform-subject="${scope}" data-claim-index="${claimIndex}">+ Evidence</button>
        <button class="dangerButton" data-action="delete-platform-support" data-platform-subject="${scope}" data-claim-index="${claimIndex}">Remove declaration</button></div>
      </div>`).join("") : `<small>No platform declaration. Existing catalog behavior remains unchanged.</small>`}
    <small>Only controlled platform/runtime/status/architecture values and first-party HTTPS evidence are accepted. No commands, scripts, credentials, arbitrary endpoints, or target-level overrides.</small>
  </div>`;
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
             ${productModule?.requiresProfile && (!productModule.catalogProfileId || installProfileOptions(product, record.vendor.id)) ? `
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
             ${platformSupportEditor("product", product.platformSupport)}
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
              ${productModule?.catalogProfileId ? `
              <label class="wide">HTTPS 下载地址<input maxlength="2048" data-signed-download="url" value="${escapeHtml(product.download?.url || "")}"></label>
              <label>无路径文件名<input maxlength="180" data-signed-download="fileName" value="${escapeHtml(product.download?.fileName || "")}"></label>
              <label>制品类型<select data-signed-download="artifactKind">${optionList(["exe", "msi", "msix", "zip"], product.download?.artifactKind || "exe")}</select></label>
              <label class="wide">HTTPS 镜像（每行一个，最多 4 个）<textarea data-signed-download="mirrors">${escapeHtml((product.download?.mirrors || []).join("\n"))}</textarea></label>
              <small class="wide">目录只保存下载元数据；禁止 command、args、env、script、headers、credentials，下载后仅由用户点击打开。</small>` : ""}
             ${canEditOfficialDownload(product) ? `
              <label class="wide">官方入口 HTTPS 地址<input maxlength="2048" data-official-download="url" value="${escapeHtml(product.officialDownload?.url || "")}"></label>
              <label>官方入口类型<select data-official-download="kind">${officialDownloadKindOptions(product)}</select></label>
              ${product.productType === "desktop-official" ? `<label class="wide">覆盖产品 ID（仅厂商安装流程，逗号分隔）<input maxlength="512" data-official-download="coveredProductIds" value="${escapeHtml((product.officialDownload?.coveredProductIds || []).join(","))}"></label>` : ""}
              <label class="wide">极短说明（可选）<input maxlength="120" data-official-download="note" value="${escapeHtml(product.officialDownload?.note || "")}"></label>
              <small class="wide">${escapeHtml(officialDownloadPreview(product))}</small>` : ""}
             <label class="toggleLabel"><input type="checkbox" data-product-enabled ${product.enabled !== false ? "checked" : ""}>在客户端中启用该产品</label>
          </div></section>`
          : `<div class="empty">暂无产品</div>`
      }
    </div>`;
}

function renderResources() {
  title.textContent = "生态资源";
  const resourceKind = selectedResourceStoreKind();
  const resourceSourceChannel = selectedResourceSourceChannel();
  const sourceStats = resourceStoreSourceStats(resourceKind);
  const resourceItems = resourcesForSelectedStore();
  const resource = selectedResource();
  const metadata = resourceMetadataSnapshot(resource);
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
    <section class="intro"><div><p class="eyebrow">目录 / 生态资源</p><h2>Skill、MCP、插件与连接器商店</h2>
    <p>资源独立于厂商产品保存，可关联来源产品并接入多个 AI 工具。后台只能选择客户端固定模块和已审核配置，不能下发命令。</p></div>
    <label>当前商店<select data-resource-store-kind>${state.catalog.resourceStores.map((store) => `<option value="${escapeHtml(store.id)}"${store.id === resourceKind ? " selected" : ""}>${escapeHtml(store.label)}</option>`).join("")}</select></label>
    <label>资源频道<select data-resource-source-channel>${[["all", "全部"], ["official", `官方 (${sourceStats.official})`], ["community", `社区 (${sourceStats.community})`]].map(([value, label]) => `<option value="${value}"${value === resourceSourceChannel ? " selected" : ""}>${label}</option>`).join("")}</select><small>社区包含已审核社区与社区来源；详情保留原始审核状态。</small></label>
    <button class="smallButton" data-action="add-resource">＋ 新增资源</button></section>
    <section class="panel">
      <div class="panelHeader"><div><h3>商店入口</h3><small>入口固定为 Skill、MCP、插件和连接器；可调整名称、顺序和启停。</small></div></div>
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
      <section class="panel itemList">${resourceItems.length
        ? resourceItems.map((item) => `
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
            <option value="official"${resource.sourceKind === "official" ? " selected" : ""}>官方</option>
            <option value="reviewed-community"${resource.sourceKind === "reviewed-community" ? " selected" : ""}>已审核社区</option>
            <option value="community"${resource.sourceKind === "community" ? " selected" : ""}>社区</option>
          </select></label>
          <label>审核状态<select data-resource-optional-field="reviewStatus">${(state.productModules.resourceReviewStatuses || []).map((status) => `<option value="${escapeHtml(status)}"${status === resourceReviewStatus(resource) ? " selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></label>
          <label>风险等级<select data-resource-optional-field="riskLevel">${(state.productModules.resourceRiskLevels || []).map((level) => `<option value="${escapeHtml(level)}"${level === resourceRiskLevel(resource) ? " selected" : ""}>${escapeHtml(level)}</option>`).join("")}</select><small>风险与审核状态独立；unsafe/rejected 不能绑定受管模块。</small></label>
          <label class="wide">资源类型<div class="checks">${state.catalog.resourceStores.map((store) => `<label><input type="checkbox" data-resource-type="${escapeHtml(store.id)}" ${resource.resourceTypes.includes(store.id) ? "checked" : ""}>${escapeHtml(store.label)}</label>`).join("")}</div><small>同一个资源可以同时属于多个商店。</small></label>
          <label class="wide">官网<input data-resource-field="website" value="${escapeHtml(resource.website)}"></label>
          <label class="wide">教程地址<input data-resource-field="tutorial" value="${escapeHtml(resource.tutorial)}"></label>
          <label class="wide">描述<textarea data-resource-field="description">${escapeHtml(resource.description)}</textarea></label>
          <label class="wide">来源产品<div class="checks">${sourceProducts.length
            ? sourceProducts.map(({ vendor, product }) => `<label><input type="checkbox" data-resource-source-product="${escapeHtml(product.id)}" ${(resource.sourceProductIds || []).includes(product.id) ? "checked" : ""}>${escapeHtml(vendor.name)} / ${escapeHtml(product.name)}</label>`).join("")
            : "暂无 AI 可接入产品"}</div><small>这里只能选择“AI 可接入厂商”目录中的产品。</small></label>
          <div class="wide resourceMetadata">
            <div class="panelHeader"><div><b>来源快照</b><small>只保存已审核的来源、作者、许可和发现元数据；不接受命令、密钥或执行地址。</small></div></div>
            <div class="formGrid">
              <label>来源平台<input data-resource-metadata-field="sourcePlatform" value="${escapeHtml(metadata.sourcePlatform || "")}"></label>
              <label>发现渠道<input data-resource-metadata-field="discoveredVia" value="${escapeHtml(metadata.discoveredVia || "")}"></label>
              <label class="wide">来源页<input maxlength="2048" data-resource-metadata-field="sourcePage" value="${escapeHtml(metadata.sourcePage || "")}"></label>
              <label class="wide">原始规范来源<input maxlength="2048" data-resource-metadata-field="canonicalSource" value="${escapeHtml(metadata.canonicalSource || "")}"></label>
              <label>原作者或组织<input maxlength="160" data-resource-metadata-field="originalAuthor" value="${escapeHtml(metadata.originalAuthor || "")}"></label>
              <label>许可 ID<input maxlength="100" data-resource-metadata-field="licenseId" value="${escapeHtml(metadata.licenseId || "")}"></label>
              <label>固定 revision<input maxlength="128" data-resource-metadata-field="sourceRevision" value="${escapeHtml(metadata.sourceRevision || "")}"></label>
              <label>外部 ID<input maxlength="160" data-resource-metadata-field="externalId" value="${escapeHtml(metadata.externalId || "")}"></label>
              <label>观测时间<input maxlength="40" data-resource-metadata-field="observedAt" value="${escapeHtml(metadata.observedAt || "")}" placeholder="2026-08-08T00:00:00.000Z"></label>
              <label>来源状态<select data-resource-metadata-field="provenanceStatus"><option value="first-party-verified"${metadata.provenanceStatus === "first-party-verified" ? " selected" : ""}>first-party-verified</option><option value="provenance-unresolved"${metadata.provenanceStatus === "provenance-unresolved" ? " selected" : ""}>provenance-unresolved</option></select></label>
              <label>许可状态<select data-resource-metadata-field="licenseStatus"><option value="verified"${metadata.licenseStatus === "verified" ? " selected" : ""}>verified</option><option value="unverified"${metadata.licenseStatus === "unverified" ? " selected" : ""}>unverified</option></select></label>
            </div>
          </div>
          ${platformSupportEditor("resource", resource.platformSupport)}
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
  const channel = state.releaseChannel;
  const channelRelease = release?.channels?.[channel] || { state: release?.state, history: release?.history || [] };
  const channelState = channelRelease.state;
  const settings = release?.settings;
  const history = channelRelease.history || [];
  const sourceRegistry = release?.approvedDownloadSources || [];
  const sourceMeta = new Map(
    sourceRegistry.map((source) => [
      `${source.environmentId}:${source.sourceId}`,
      source
    ])
  );
  const validation = state.validationReport;
  content.innerHTML = `
    <label>目录频道 <select data-release-channel><option value="v1" ${channel === "v1" ? "selected" : ""}>v1（兼容）</option><option value="v2" ${channel === "v2" ? "selected" : ""}>v2（新版客户端）</option></select></label>
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
        <span>活动版本</span><code>v${escapeHtml(channelState?.activeCatalogVersion || 0)} · ${channel}</code>
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
        ${item.catalogVersion === channelState?.activeCatalogVersion ? "<em>当前</em>" : `<button class="smallButton" data-action="rollback" data-release-id="${escapeHtml(item.releaseId)}">回滚为新版本</button>`}</div>`).join("") : "<p>尚未发布目录</p>"}</div>
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

async function refreshCommunitySummary() {
  try {
    state.communityAdmin = await request("/api/community-management");
    renderCommunity();
  } catch (error) {
    state.communityAdmin = { status: "unavailable", error: error.message };
    renderCommunity();
    toast(error.message, true);
  }
}

async function changeCommunityVisibility(target) {
  const action = target.dataset.communityAction;
  const id = target.dataset.communityId;
  const hidden = target.dataset.communityHidden === "true";
  const body = action === "set-discussion-hidden"
    ? { action, discussionId: id, hidden }
    : { action, postId: id, hidden };
  const originalText = target.textContent;
  target.disabled = true;
  try {
    await request("/api/community-management/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-AIHub-CSRF": "1" },
      body: JSON.stringify(body)
    });
    await refreshCommunitySummary();
  } catch (error) {
    target.disabled = false;
    target.textContent = originalText;
    toast(error.message, true);
  }
}

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
  if (target.dataset.communityAction) {
    await changeCommunityVisibility(target);
  } else if (target.dataset.action === "refresh-community-summary") {
    await refreshCommunitySummary();
  } else if (target.dataset.vendor) {
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
  } else if (target.dataset.action === "add-carousel-slide") {
    const slides = state.catalog.homeCarousel.slides;
    slides.push({ id: `slide-${Date.now()}`, imageUrl: "/assets/home-carousel/placeholder.svg", imageAlt: "请填写图片替代文字", title: "新视觉轮播", description: "请填写轮播说明。", primaryAction: { label: "查看 AI 厂商", href: "/vendors" }, sort: slides.length, enabled: false });
    markDirty(); render();
  } else if (target.dataset.action === "delete-carousel-slide") {
    state.catalog.homeCarousel.slides.splice(Number(target.dataset.index), 1);
    normalizeCarouselSort(state.catalog.homeCarousel.slides);
    markDirty(); render();
  } else if (target.dataset.action === "move-carousel-slide") {
    const slides = state.catalog.homeCarousel.slides;
    if (moveItem(slides, Number(target.dataset.index), Number(target.dataset.offset))) {
      normalizeCarouselSort(slides); markDirty(); render();
    }
  } else if (target.dataset.action === "add-vendor") {
    const id = `vendor-${Date.now()}`;
    state.catalog.vendors.push({
      id, enabled: true, order: state.catalog.vendors.length, name: "新厂商", initial: "N", mark: "N", iconUrl: "", color: "#159475",
      description: "请输入厂商描述。", website: "https://example.com",
      tutorial: "https://example.com", products: []
    });
    state.selectedVendorId = id; markDirty(); render();
  } else if (target.dataset.action === "upload-vendor-icon") {
    const vendor = selectedVendor();
    const file = content.querySelector("[data-vendor-icon-file]")?.files?.[0];
    const sourceUrl = content.querySelector("[data-vendor-icon-source]")?.value.trim();
    if (!vendor || !file) return toast("请选择 Logo 图片", true);
    if (!sourceUrl?.startsWith("https://")) {
      return toast("请填写厂商官方 HTTPS Logo 来源", true);
    }
    if (file.size > 384 * 1024) return toast("Logo 不能超过 384 KB", true);
    target.disabled = true;
    target.textContent = "正在上传…";
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("无法读取 Logo 图片"));
        reader.readAsDataURL(file);
      });
      const result = await request("/api/vendor-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: vendor.id, dataUrl, sourceUrl })
      });
      vendor.iconAsset = result.asset;
      vendor.iconUrl = "";
      markDirty();
      renderVendors();
      toast("Logo 已上传并通过校验，请保存草稿");
    } catch (error) {
      toast(error.message, true);
      renderVendors();
    }
  } else if (target.dataset.action === "remove-vendor-icon") {
    const vendor = selectedVendor();
    if (!vendor) return;
    delete vendor.iconAsset;
    vendor.iconUrl = "";
    markDirty();
    renderVendors();
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
  } else if (target.dataset.action === "add-platform-support") {
    const subject = platformSupportSubject(target.dataset.platformSubject);
    if (!subject) return;
    subject.platformSupport ||= [];
    subject.platformSupport.push({
      platform: "windows",
      runtime: "native",
      status: "unknown",
      architectures: ["unknown"],
      evidence: [{
        kind: "first-party",
        url: "",
        observedAt: new Date().toISOString()
      }]
    });
    markDirty();
    render();
  } else if (target.dataset.action === "delete-platform-support") {
    const subject = platformSupportSubject(target.dataset.platformSubject);
    if (!subject) return;
    subject.platformSupport?.splice(Number(target.dataset.claimIndex), 1);
    if (!subject.platformSupport?.length) delete subject.platformSupport;
    markDirty();
    render();
  } else if (target.dataset.action === "add-platform-evidence") {
    const subject = platformSupportSubject(target.dataset.platformSubject);
    const claim = subject?.platformSupport?.[Number(target.dataset.claimIndex)];
    if (!claim) return;
    claim.evidence.push({
      kind: "first-party",
      url: "",
      observedAt: new Date().toISOString()
    });
    markDirty();
    render();
  } else if (target.dataset.action === "delete-platform-evidence") {
    const subject = platformSupportSubject(target.dataset.platformSubject);
    const claim = subject?.platformSupport?.[Number(target.dataset.claimIndex)];
    if (!claim || claim.evidence.length <= 1) return;
    claim.evidence.splice(Number(target.dataset.evidenceIndex), 1);
    markDirty();
    render();
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
      resourceTypes: [selectedResourceStoreKind()],
      description: "请输入生态资源描述。",
      website: "https://example.com",
      tutorial: "https://example.com",
      sourceKind: "community",
      reviewStatus: "unreviewed",
      riskLevel: "guarded",
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
          channel: state.releaseChannel,
          releaseId: target.dataset.releaseId,
          expectedActiveCatalogVersion: state.releaseData.channels?.[state.releaseChannel]?.state?.activeCatalogVersion ?? 0
        })
      });
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
  } else if (input.dataset.carousel) {
    const [index, field] = input.dataset.carousel.split(":");
    const slide = state.catalog.homeCarousel.slides[Number(index)];
    if (field === "primaryLabel") slide.primaryAction.label = input.value;
    else if (field === "primaryHref") slide.primaryAction.href = input.value;
    else if (field === "secondaryLabel" || field === "secondaryHref") {
      slide.secondaryAction ||= { label: "", href: "" };
      slide.secondaryAction[field === "secondaryLabel" ? "label" : "href"] = input.value;
      if (!slide.secondaryAction.label && !slide.secondaryAction.href) delete slide.secondaryAction;
    } else slide[field] = input.value;
  } else if ("carouselEnabled" in input.dataset) {
    state.catalog.homeCarousel.slides[Number(input.dataset.carouselEnabled)].enabled = input.checked;
  } else if ("carouselAutoplay" in input.dataset) {
    state.catalog.homeCarousel.autoplayMs = Number(input.value);
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
  } else if (input.dataset.platformSupportClaim) {
    const [scope, claimIndex, field] = input.dataset.platformSupportClaim.split(":");
    const claim = platformSupportSubject(scope)?.platformSupport?.[Number(claimIndex)];
    if (!claim) return;
    claim[field] = input.value;
  } else if (input.dataset.platformSupportArchitecture) {
    const [scope, claimIndex, architecture] = input.dataset.platformSupportArchitecture.split(":");
    const claim = platformSupportSubject(scope)?.platformSupport?.[Number(claimIndex)];
    if (!claim) return;
    claim.architectures = input.checked
      ? [...new Set([...(claim.architectures || []), architecture])]
      : (claim.architectures || []).filter((item) => item !== architecture);
  } else if (input.dataset.platformSupportEvidence) {
    const [scope, claimIndex, evidenceIndex, field] = input.dataset.platformSupportEvidence.split(":");
    const evidence = platformSupportSubject(scope)?.platformSupport?.[Number(claimIndex)]?.evidence?.[Number(evidenceIndex)];
    if (!evidence) return;
    evidence[field] = input.value.trim();
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
  } else if (input.dataset.officialDownload) {
    const product = selectedProductRecord().product;
    product.officialDownload ||= {
      url: "",
      kind: product.productType === "web" ? "no-windows" : "download-page"
    };
    if (input.dataset.officialDownload === "coveredProductIds") {
      const values = input.value.split(",").map((value) => value.trim()).filter(Boolean);
      if (values.length) product.officialDownload.coveredProductIds = [...new Set(values)];
      else delete product.officialDownload.coveredProductIds;
    } else if (input.dataset.officialDownload === "note") {
      const value = input.value.trim();
      if (value) product.officialDownload.note = value;
      else delete product.officialDownload.note;
    } else {
      product.officialDownload[input.dataset.officialDownload] = input.value.trim();
    }
  } else if (input.dataset.signedDownload) {
    const product = selectedProductRecord().product;
    product.download ||= { url: "", fileName: "", artifactKind: "exe", mirrors: [] };
    if (input.dataset.signedDownload === "mirrors") {
      product.download.mirrors = input.value
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean);
    } else {
      product.download[input.dataset.signedDownload] = input.value.trim();
    }
  } else if (input.dataset.downloadField) {
    const product = selectedProductRecord().product;
    const urlInput = content.querySelector('[data-download-field="url"]').value.trim();
    const fileInput = content.querySelector('[data-download-field="fileName"]').value.trim();
    product.download = urlInput || fileInput ? { url: urlInput, fileName: fileInput } : undefined;
  } else if ("resourceStoreKind" in input.dataset) {
    state.resourceStoreKind = input.value;
    state.selectedResourceId = resourcesForSelectedStore()[0]?.id || "";
    renderResources();
    return;
  } else if ("resourceSourceChannel" in input.dataset) {
    state.resourceSourceChannel = input.value;
    state.selectedResourceId = resourcesForSelectedStore()[0]?.id || "";
    renderResources();
    return;
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
  } else if (input.dataset.resourceMetadataField) {
    const resource = selectedResource();
    const field = input.dataset.resourceMetadataField;
    const value = input.value.trim();
    resource.metadataSnapshot = { ...resourceMetadataSnapshot(resource) };
    if (value) resource.metadataSnapshot[field] = value;
    else delete resource.metadataSnapshot[field];
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
  } else if ("releaseChannel" in input.dataset) {
    state.releaseChannel = input.value;
    renderPublish();
    return;
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
