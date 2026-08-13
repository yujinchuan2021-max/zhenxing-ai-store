"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  isAllowedUrl,
  normalizeCatalog,
  resolveCatalogCategories,
  validateCatalog
} = require("../shared/catalog.cjs");
const {
  collectVendorSources,
  isWithinScopes,
  normalizeUrl
} = require("../shared/catalog-discovery.cjs");
const { applyProductModule } = require("../shared/product-modules.cjs");

const STATE_SCHEMA_VERSION = 1;
const SAFE_DISCOVERY_MODULES = new Set([
  "web-link",
  "desktop-official",
  "cli-official",
  "tutorial-link"
]);
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(clock) {
  const value = clock();
  const milliseconds =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(milliseconds)) throw new Error("候选审核时钟无效");
  return new Date(milliseconds).toISOString();
}

function shortText(value, maximum) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function candidateId(vendorId, url) {
  return crypto
    .createHash("sha256")
    .update(`${vendorId}\n${normalizeUrl(url) || url}`)
    .digest("hex")
    .slice(0, 24);
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // The rename already consumed the temporary file.
    }
  }
}

function emptyDecisionState() {
  return { schemaVersion: STATE_SCHEMA_VERSION, decisions: {} };
}

function readDecisionState(statePath) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return emptyDecisionState();
    throw new Error(`候选审核状态读取失败：${error.message}`);
  }
  if (
    !value ||
    value.schemaVersion !== STATE_SCHEMA_VERSION ||
    !value.decisions ||
    typeof value.decisions !== "object" ||
    Array.isArray(value.decisions) ||
    Object.keys(value.decisions).length > 5000
  ) {
    throw new Error("候选审核状态无效");
  }
  for (const [id, decision] of Object.entries(value.decisions)) {
    if (
      !/^[a-f0-9]{24}$/.test(id) ||
      !decision ||
      !["ignored", "accepted"].includes(decision.status) ||
      typeof decision.updatedAt !== "string" ||
      Number.isNaN(Date.parse(decision.updatedAt)) ||
      (decision.productId !== undefined && !shortText(decision.productId, 100))
    ) {
      throw new Error("候选审核状态无效");
    }
  }
  return value;
}

function readReport(reportPath, catalog) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`候选报告读取失败：${error.message}`);
  }
  if (
    !report ||
    report.schemaVersion !== 1 ||
    typeof report.generatedAt !== "string" ||
    Number.isNaN(Date.parse(report.generatedAt)) ||
    typeof report.catalogUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(report.catalogUpdatedAt)) ||
    !Array.isArray(report.vendors) ||
    report.vendors.length > 1000
  ) {
    throw new Error("候选报告结构无效");
  }
  const catalogVendors = new Map(catalog.vendors.map((vendor) => [vendor.id, vendor]));
  const candidates = [];
  const seen = new Set();
  for (const vendorReport of report.vendors) {
    const vendor = catalogVendors.get(vendorReport?.vendorId);
    if (!vendor || !Array.isArray(vendorReport.candidates) || vendorReport.candidates.length > 100) {
      continue;
    }
    const scopes = collectVendorSources(vendor).scopes;
    for (const finding of vendorReport.candidates) {
      if (finding?.existingProductId) continue;
      const url = normalizeUrl(finding?.url);
      const evidenceUrl = normalizeUrl(finding?.evidenceUrl);
      if (
        !url ||
        !evidenceUrl ||
        !isAllowedUrl(url) ||
        !isAllowedUrl(evidenceUrl) ||
        !isWithinScopes(url, scopes) ||
        !isWithinScopes(evidenceUrl, scopes) ||
        !shortText(finding.label, 300) ||
        !["web-or-feature", "desktop", "cli", "agent"].includes(finding.inferredType) ||
        !Number.isFinite(finding.score) ||
        finding.score < 0 ||
        finding.score > 100
      ) {
        continue;
      }
      const id = candidateId(vendor.id, url);
      if (seen.has(id)) continue;
      seen.add(id);
      candidates.push({
        id,
        vendorId: vendor.id,
        vendorName: vendor.name,
        url,
        label: finding.label.trim(),
        inferredType: finding.inferredType,
        score: finding.score,
        evidenceUrl
      });
    }
  }
  return {
    generatedAt: report.generatedAt,
    catalogUpdatedAt: report.catalogUpdatedAt,
    summary: report.summary || {},
    candidates
  };
}

function defaultModule(inferredType) {
  if (inferredType === "desktop") return "desktop-official";
  if (inferredType === "cli") return "cli-official";
  return "web-link";
}

function defaultCategory(inferredType, catalog) {
  const categories = resolveCatalogCategories(catalog);
  const preferred = inferredType === "agent" ? "智能体" : "AI 对话";
  return categories.includes(preferred) ? preferred : categories[0];
}

function normalizeProductInput(candidate, input, vendor, catalog) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("候选产品资料无效");
  }
  const id = String(input.id || "").trim();
  const name = String(input.name || candidate.label).trim();
  const description = String(input.description || "").trim();
  const category = String(
    input.category || defaultCategory(candidate.inferredType, catalog)
  );
  const directoryKind = String(input.directoryKind || "ai-tool");
  const moduleId = String(input.moduleId || defaultModule(candidate.inferredType));
  const tutorial = normalizeUrl(input.tutorial || candidate.evidenceUrl);
  const scopes = collectVendorSources(vendor).scopes;
  if (!/^[a-z0-9][a-z0-9._-]{1,99}$/.test(id)) {
    throw new Error("产品 ID 只能使用小写字母、数字、点、下划线和短横线");
  }
  if (catalog.vendors.some((item) => item.products.some((product) => product.id === id))) {
    throw new Error("产品 ID 已存在");
  }
  if (
    vendor.products.some(
      (product) =>
        normalizeUrl(product.website) === candidate.url ||
        (product.entryPoints || []).some(
          (entry) => entry.url && normalizeUrl(entry.url) === candidate.url
        )
    )
  ) {
    throw new Error("该候选网址已经存在于厂商产品目录");
  }
  if (!shortText(name, 150) || !shortText(description, 500)) {
    throw new Error("产品名称或描述无效");
  }
  if (!new Set(resolveCatalogCategories(catalog)).has(category)) {
    throw new Error("产品类别无效");
  }
  if (!["ai-tool", "ai-connectable"].includes(directoryKind)) {
    throw new Error("产品所属目录无效");
  }
  if (!SAFE_DISCOVERY_MODULES.has(moduleId)) {
    throw new Error("自动发现候选只能使用不执行本地命令的安全模块");
  }
  if (!tutorial || !isAllowedUrl(tutorial) || !isWithinScopes(tutorial, scopes)) {
    throw new Error("教程地址必须属于当前厂商的官方范围");
  }
  const baseProduct = {
    id,
    enabled: false,
    order: vendor.products.reduce((maximum, product) => Math.max(maximum, product.order || 0), -1) + 1,
    name,
    directoryKind,
    category,
    description,
    website: candidate.url,
    tutorial,
    requirements: [],
    installProfileId: "",
    entryPoints: [
      {
        type: candidate.inferredType === "web-or-feature" ? "web" : "website",
        label:
          candidate.inferredType === "desktop"
            ? "官方下载页"
            : candidate.inferredType === "cli"
              ? "官方安装说明"
              : name,
        url: candidate.url
      }
    ]
  };
  return applyProductModule(baseProduct, moduleId);
}

function createDiscoveryReview({
  reportPath,
  statePath,
  clock = () => new Date(),
  runScan,
  commitCatalog
}) {
  if (
    typeof reportPath !== "string" ||
    !path.isAbsolute(reportPath) ||
    typeof statePath !== "string" ||
    !path.isAbsolute(statePath) ||
    typeof clock !== "function" ||
    typeof runScan !== "function" ||
    typeof commitCatalog !== "function"
  ) {
    throw new TypeError("候选审核模块配置无效");
  }

  let scan = { status: "idle", startedAt: null, finishedAt: null, error: "" };

  function snapshot(catalog) {
    validateCatalog(clone(catalog));
    const report = readReport(reportPath, catalog);
    const decisions = readDecisionState(statePath).decisions;
    const candidates = (report?.candidates || []).map((candidate) => {
      const decision = decisions[candidate.id];
      return {
        ...candidate,
        status: decision?.status || "pending",
        productId: decision?.productId || "",
        reviewedAt: decision?.updatedAt || "",
        suggestedModuleId: defaultModule(candidate.inferredType),
        suggestedCategory: defaultCategory(candidate.inferredType, catalog)
      };
    });
    return {
      available: Boolean(report),
      stale: Boolean(report && report.catalogUpdatedAt !== catalog.updatedAt),
      generatedAt: report?.generatedAt || "",
      catalogUpdatedAt: report?.catalogUpdatedAt || "",
      scan: { ...scan },
      summary: {
        pending: candidates.filter((candidate) => candidate.status === "pending").length,
        ignored: candidates.filter((candidate) => candidate.status === "ignored").length,
        accepted: candidates.filter((candidate) => candidate.status === "accepted").length,
        checkedPages: Number(report?.summary?.checkedPages) || 0,
        failures: Number(report?.summary?.failures) || 0,
        researchLeads: Number(report?.summary?.researchLeads) || 0
      },
      candidates
    };
  }

  function decision({ catalog, candidateId: id, status }) {
    if (!["pending", "ignored"].includes(status)) throw new Error("候选审核动作无效");
    const current = snapshot(catalog);
    const candidate = current.candidates.find((item) => item.id === id);
    if (!candidate) throw new Error("候选不存在或已失效");
    const state = readDecisionState(statePath);
    if (status === "pending") delete state.decisions[id];
    else {
      state.decisions[id] = {
        status: "ignored",
        updatedAt: nowIso(clock)
      };
    }
    atomicWriteJson(statePath, state);
    return snapshot(catalog);
  }

  async function acceptCandidate({ catalog, candidateId: id, expectedRevision, product: input }) {
    const current = snapshot(catalog);
    const candidate = current.candidates.find((item) => item.id === id);
    if (!candidate || candidate.status === "accepted") {
      throw new Error("候选不存在或已经加入草稿");
    }
    const nextCatalog = normalizeCatalog(clone(catalog));
    const vendor = nextCatalog.vendors.find((item) => item.id === candidate.vendorId);
    if (!vendor) throw new Error("候选所属厂商不存在");
    const product = normalizeProductInput(candidate, input, vendor, nextCatalog);
    vendor.products.push(product);
    validateCatalog(nextCatalog);
    const saved = await commitCatalog({ catalog: nextCatalog, expectedRevision });
    const state = readDecisionState(statePath);
    state.decisions[id] = {
      status: "accepted",
      productId: product.id,
      updatedAt: nowIso(clock)
    };
    atomicWriteJson(statePath, state);
    return { ...saved, product: clone(product), candidate: clone(candidate) };
  }

  function startScan() {
    if (scan.status === "running") return { started: false, scan: { ...scan } };
    scan = {
      status: "running",
      startedAt: nowIso(clock),
      finishedAt: null,
      error: ""
    };
    Promise.resolve()
      .then(runScan)
      .then(() => {
        scan = {
          ...scan,
          status: "completed",
          finishedAt: nowIso(clock),
          error: ""
        };
      })
      .catch((error) => {
        scan = {
          ...scan,
          status: "failed",
          finishedAt: nowIso(clock),
          error: String(error?.message || error).slice(0, 500)
        };
      });
    return { started: true, scan: { ...scan } };
  }

  return Object.freeze({ snapshot, decision, acceptCandidate, startScan });
}

module.exports = {
  SAFE_DISCOVERY_MODULES,
  candidateId,
  createDiscoveryReview
};
