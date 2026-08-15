"use strict";

const crypto = require("node:crypto");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const PLACEHOLDER_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const LICENSE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;
const AUDIT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DATA_TYPES = new Set(["text", "number", "boolean", "image", "file-reference"]);
const RESOURCE_BINDING_KINDS = Object.freeze([
  "skill-context",
  "mcp-tool",
  "mcp-resource",
  "mcp-prompt",
  "plugin-host-extension",
  "connector-authorized-connection"
]);
const RESOURCE_BINDING_SET = new Set(RESOURCE_BINDING_KINDS);
const REVIEW_STATUSES = Object.freeze([
  "unreviewed",
  "automated-reviewed",
  "manually-reviewed",
  "rejected"
]);
const PUBLISHABLE_REVIEW_STATUSES = new Set(["automated-reviewed", "manually-reviewed"]);
const RISK_LEVELS = Object.freeze(["low", "guarded", "unsafe"]);
const RISK_LEVEL_SET = new Set(RISK_LEVELS);
const DEPENDENCY_PERMISSIONS = Object.freeze([
  "none",
  "read-selected-input",
  "write-selected-output",
  "approved-network",
  "secret-placeholder"
]);
const PERMISSION_SET = new Set(DEPENDENCY_PERMISSIONS);

class WorkflowContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkflowContractError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new WorkflowContractError(code, message);
}

function isObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, allowed, required = allowed) {
  if (!isObject(value)) fail("INVALID_SCHEMA", "需要普通 JSON 对象");
  const keys = Object.keys(value);
  if (
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    fail("INVALID_SCHEMA", "对象字段不符合工作流 data-only 合同");
  }
  return value;
}

function text(value, field, minimum, maximum) {
  if (typeof value !== "string") fail("INVALID_SCHEMA", `${field}必须是文本`);
  const normalized = value.trim();
  if (
    normalized.length < minimum ||
    normalized.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)
  ) {
    fail("INVALID_SCHEMA", `${field}长度或字符无效`);
  }
  return normalized;
}

function uuid(value, field) {
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) fail("INVALID_INPUT", `${field}无效`);
  return normalized.toLowerCase();
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail("INVALID_INPUT", `${field}必须是正整数`);
  }
  return value;
}

function communityPostId(value) {
  const normalized = String(value || "").trim();
  if (!/^[1-9][0-9]{0,19}$/.test(normalized)) {
    fail("INVALID_INPUT", "sourceCommunityPostId 无效");
  }
  return normalized;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function snapshot(value) {
  return deepFreeze(deepClone(value));
}

function normalizedContent(input, hasCanonicalDependency) {
  const value = exactObject(input, [
    "title",
    "summary",
    "inputs",
    "outputs",
    "instructions",
    "dependencies",
    "secretPlaceholders"
  ]);
  if (!Array.isArray(value.instructions) || value.instructions.length < 1 || value.instructions.length > 32) {
    fail("INVALID_SCHEMA", "instructions 必须包含 1-32 条人工说明");
  }
  if (!Array.isArray(value.dependencies) || value.dependencies.length > 32) {
    fail("INVALID_SCHEMA", "dependencies 必须是最多 32 项的数组");
  }
  if (!Array.isArray(value.secretPlaceholders) || value.secretPlaceholders.length > 16) {
    fail("INVALID_SCHEMA", "secretPlaceholders 必须是最多 16 项的数组");
  }
  if (!Array.isArray(value.inputs) || value.inputs.length > 32) {
    fail("INVALID_SCHEMA", "inputs 必须是最多 32 项的数组");
  }
  if (!Array.isArray(value.outputs) || value.outputs.length > 32) {
    fail("INVALID_SCHEMA", "outputs 必须是最多 32 项的数组");
  }

  function fields(entries, kind) {
    const names = new Set();
    return entries.map((entry) => {
      const allowed = kind === "input"
        ? ["name", "type", "required", "description"]
        : ["name", "type", "description"];
      exactObject(entry, allowed);
      const name = String(entry.name || "").trim();
      if (!FIELD_NAME_PATTERN.test(name) || names.has(name)) {
        fail("INVALID_SCHEMA", `${kind} 字段名无效或重复`);
      }
      if (!DATA_TYPES.has(entry.type)) fail("INVALID_SCHEMA", `${kind} 数据类型无效`);
      names.add(name);
      const normalized = {
        name,
        type: entry.type,
        description: text(entry.description, `${kind} 字段说明`, 1, 240)
      };
      if (kind === "input") {
        if (typeof entry.required !== "boolean") fail("INVALID_SCHEMA", "input.required 必须是布尔值");
        return { ...normalized, required: entry.required };
      }
      return normalized;
    });
  }

  const inputs = fields(value.inputs, "input");
  const outputs = fields(value.outputs, "output");

  const secretNames = new Set();
  const secretPlaceholders = value.secretPlaceholders.map((entry) => {
    exactObject(entry, ["name", "description"]);
    const name = String(entry.name || "").trim();
    if (!PLACEHOLDER_PATTERN.test(name) || secretNames.has(name)) {
      fail("INVALID_SCHEMA", "秘密占位符名称无效或重复");
    }
    secretNames.add(name);
    return {
      name,
      description: text(entry.description, "秘密占位符说明", 1, 240)
    };
  });

  const dependencyKeys = new Set();
  const dependencies = value.dependencies.map((entry) => {
    if (!isObject(entry)) fail("INVALID_SCHEMA", "依赖必须是普通 JSON 对象");
    if (entry.kind !== "product" && entry.kind !== "resource") {
      fail("INVALID_SCHEMA", "依赖类型必须是 product 或 resource");
    }
    exactObject(
      entry,
      entry.kind === "product"
        ? ["kind", "canonicalId", "permissions"]
        : ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]
    );
    const canonicalId = String(entry.canonicalId || "").trim();
    if (!CANONICAL_ID_PATTERN.test(canonicalId)) {
      fail("INVALID_SCHEMA", "canonicalId 格式无效");
    }
    if (
      !Array.isArray(entry.permissions) ||
      entry.permissions.length < 1 ||
      entry.permissions.length > DEPENDENCY_PERMISSIONS.length ||
      new Set(entry.permissions).size !== entry.permissions.length
    ) {
      fail("INVALID_PERMISSION", "依赖权限声明无效");
    }
    if (entry.permissions.some((permission) => !PERMISSION_SET.has(permission))) {
      fail("INVALID_PERMISSION", "依赖包含未批准权限");
    }
    if (entry.permissions.includes("none") && entry.permissions.length !== 1) {
      fail("INVALID_PERMISSION", "none 不能与其他权限并存");
    }
    if (entry.permissions.includes("secret-placeholder") && secretPlaceholders.length === 0) {
      fail("INVALID_PERMISSION", "secret-placeholder 权限需要声明秘密占位符");
    }
    const normalized = {
      kind: entry.kind,
      canonicalId,
      permissions: [...entry.permissions]
    };
    if (entry.kind === "resource") {
      const hostProductId = String(entry.hostProductId || "").trim();
      if (!CANONICAL_ID_PATTERN.test(hostProductId)) {
        fail("INVALID_SCHEMA", "hostProductId 格式无效");
      }
      if (!RESOURCE_BINDING_SET.has(entry.bindingKind)) {
        fail("INVALID_BINDING", "资源 binding 语义未获批准");
      }
      normalized.hostProductId = hostProductId;
      normalized.bindingKind = entry.bindingKind;
    }
    const key = [
      normalized.kind,
      normalized.canonicalId,
      normalized.hostProductId,
      normalized.bindingKind
    ].filter(Boolean).join(":");
    if (dependencyKeys.has(key)) fail("INVALID_SCHEMA", "依赖不能重复");
    dependencyKeys.add(key);
    if (!hasCanonicalDependency({
      kind: normalized.kind,
      canonicalId: normalized.canonicalId,
      ...(normalized.hostProductId ? { hostProductId: normalized.hostProductId } : {}),
      ...(normalized.bindingKind ? { bindingKind: normalized.bindingKind } : {})
    })) {
      fail("DEPENDENCY_NOT_FOUND", "依赖不是现有 canonical ID");
    }
    return normalized;
  });

  return deepFreeze({
    title: text(value.title, "title", 1, 120),
    summary: text(value.summary, "summary", 1, 500),
    inputs,
    outputs,
    instructions: value.instructions.map((entry) => text(entry, "instruction", 1, 1000)),
    dependencies,
    secretPlaceholders
  });
}

function createCommunityWorkflowStore({
  hasCanonicalDependency,
  hasCanonicalLicense,
  hasCommunityPost,
  makeId = crypto.randomUUID,
  now = () => new Date().toISOString()
} = {}) {
  if (typeof hasCanonicalDependency !== "function") {
    throw new TypeError("hasCanonicalDependency is required");
  }
  if (typeof hasCanonicalLicense !== "function") {
    throw new TypeError("hasCanonicalLicense is required");
  }
  if (typeof hasCommunityPost !== "function") {
    throw new TypeError("hasCommunityPost is required");
  }
  if (typeof makeId !== "function" || typeof now !== "function") {
    throw new TypeError("makeId and now must be functions");
  }

  const drafts = new Map();
  const releases = new Map();
  const listings = new Map();
  const reports = new Map();
  const postReferences = new Map();

  function timestamp() {
    const value = String(now());
    if (Number.isNaN(Date.parse(value))) fail("INVALID_INPUT", "时间来源无效");
    return value;
  }

  function nextId(field) {
    return uuid(makeId(), field);
  }

  function draftFor(workflowId) {
    const id = uuid(workflowId, "workflowId");
    const draft = drafts.get(id);
    if (!draft) fail("NOT_FOUND", "工作流草稿不存在");
    return draft;
  }

  function releaseFor(workflowId, version) {
    const id = uuid(workflowId, "workflowId");
    const release = releases.get(id)?.get(integer(version, "version"));
    if (!release) fail("NOT_FOUND", "工作流发布版本不存在");
    return release;
  }

  function requireAuthor(draft, authorIdentityId) {
    const actor = uuid(authorIdentityId, "authorIdentityId");
    if (draft.authorIdentityId !== actor) fail("AUTHOR_MISMATCH", "作者映射不可变");
    return actor;
  }

  function requireRevision(draft, expectedRevision) {
    if (integer(expectedRevision, "expectedRevision") !== draft.revision) {
      fail("REVISION_CONFLICT", "工作流草稿已在其他位置更新");
    }
  }

  function normalizedProvenance(input, originalAuthorIdentityId, sourceCommunityPostId) {
    const value = exactObject(input, ["licenseId", "derivedFrom", "discoveredVia"]);
    const licenseId = String(value.licenseId || "").trim();
    if (!LICENSE_ID_PATTERN.test(licenseId)) {
      fail("INVALID_SCHEMA", "licenseId 格式无效");
    }
    if (!hasCanonicalLicense(licenseId)) {
      fail("LICENSE_NOT_FOUND", "licenseId 不是已批准 canonical 许可证");
    }
    if (!Array.isArray(value.derivedFrom) || value.derivedFrom.length > 16) {
      fail("INVALID_SCHEMA", "derivedFrom 必须是最多 16 项的数组");
    }
    const derivedKeys = new Set();
    const derivedFrom = value.derivedFrom.map((entry) => {
      exactObject(entry, ["workflowId", "version"]);
      const release = releaseFor(entry.workflowId, entry.version);
      const key = `${release.workflowId}:${release.version}`;
      if (derivedKeys.has(key)) fail("INVALID_SCHEMA", "derivedFrom 不能重复");
      derivedKeys.add(key);
      return { workflowId: release.workflowId, version: release.version };
    });
    if (!Array.isArray(value.discoveredVia) || value.discoveredVia.length > 16) {
      fail("INVALID_SCHEMA", "discoveredVia 必须是最多 16 项的数组");
    }
    const discoveryKeys = new Set();
    const discoveredVia = value.discoveredVia.map((entry) => {
      exactObject(entry, ["kind", "canonicalId"]);
      if (entry.kind !== "community-post" && entry.kind !== "external-index") {
        fail("INVALID_SCHEMA", "discoveredVia.kind 无效");
      }
      const canonicalId = String(entry.canonicalId || "").trim();
      if (!AUDIT_ID_PATTERN.test(canonicalId)) {
        fail("INVALID_SCHEMA", "discoveredVia.canonicalId 无效");
      }
      const key = `${entry.kind}:${canonicalId}`;
      if (discoveryKeys.has(key)) fail("INVALID_SCHEMA", "discoveredVia 不能重复");
      discoveryKeys.add(key);
      return { kind: entry.kind, canonicalId };
    });
    return deepFreeze({
      originalAuthorIdentityId,
      canonicalSource: {
        kind: "community-post",
        canonicalId: sourceCommunityPostId
      },
      licenseId,
      derivedFrom,
      discoveredVia
    });
  }

  function createDraft(input) {
    exactObject(input, ["authorIdentityId", "sourceCommunityPostId", "provenance", "content"]);
    const workflowId = nextId("workflowId");
    const createdAt = timestamp();
    const authorIdentityId = uuid(input.authorIdentityId, "authorIdentityId");
    const sourceCommunityPostId = communityPostId(input.sourceCommunityPostId);
    if (!hasCommunityPost(sourceCommunityPostId)) {
      fail("COMMUNITY_POST_NOT_FOUND", "Flarum 帖子引用不存在");
    }
    const draft = {
      workflowId,
      authorIdentityId,
      sourceCommunityPostId,
      provenance: normalizedProvenance(
        input.provenance,
        authorIdentityId,
        sourceCommunityPostId
      ),
      revision: 1,
      status: "draft",
      reviewStatus: "unreviewed",
      riskLevel: null,
      latestReleaseVersion: 0,
      rejectionReason: null,
      content: normalizedContent(input.content, hasCanonicalDependency),
      createdAt,
      updatedAt: createdAt
    };
    drafts.set(workflowId, draft);
    return snapshot(draft);
  }

  function updateDraft(input) {
    exactObject(input, ["workflowId", "authorIdentityId", "content"]);
    const current = draftFor(input.workflowId);
    requireAuthor(current, input.authorIdentityId);
    if (["submitted", "withdrawn"].includes(current.status)) {
      fail("INVALID_STATE", "已投稿或已撤回草稿不能编辑");
    }
    const draft = {
      ...current,
      revision: current.revision + 1,
      status: "draft",
      reviewStatus: "unreviewed",
      riskLevel: null,
      rejectionReason: null,
      content: normalizedContent(input.content, hasCanonicalDependency),
      updatedAt: timestamp()
    };
    drafts.set(current.workflowId, draft);
    return snapshot(draft);
  }

  function submitDraft(input) {
    exactObject(input, ["workflowId", "authorIdentityId"]);
    const current = draftFor(input.workflowId);
    requireAuthor(current, input.authorIdentityId);
    if (current.status !== "draft") fail("INVALID_STATE", "只有草稿可以投稿");
    const draft = {
      ...current,
      revision: current.revision + 1,
      status: "submitted",
      updatedAt: timestamp()
    };
    drafts.set(current.workflowId, draft);
    return snapshot(draft);
  }

  function withdrawDraft(input) {
    exactObject(input, ["workflowId", "authorIdentityId", "expectedRevision"]);
    const current = draftFor(input.workflowId);
    requireAuthor(current, input.authorIdentityId);
    requireRevision(current, input.expectedRevision);
    if (current.status !== "submitted") fail("INVALID_STATE", "只有已投稿草稿可以撤回");
    const draft = {
      ...current,
      revision: current.revision + 1,
      status: "withdrawn",
      updatedAt: timestamp()
    };
    drafts.set(current.workflowId, draft);
    return snapshot(draft);
  }

  function attachPostReference(input) {
    exactObject(input, [
      "workflowId",
      "version",
      "authorIdentityId",
      "communityPostId",
      "expectedRevision"
    ]);
    const current = draftFor(input.workflowId);
    requireAuthor(current, input.authorIdentityId);
    requireRevision(current, input.expectedRevision);
    const release = releaseFor(current.workflowId, input.version);
    const postId = communityPostId(input.communityPostId);
    if (!hasCommunityPost(postId)) fail("COMMUNITY_POST_NOT_FOUND", "Flarum 帖子引用不存在");
    const key = `${release.workflowId}:${release.version}:${postId}`;
    if (postReferences.has(key)) fail("INVALID_STATE", "Flarum 帖子卡片已经关联");
    const at = timestamp();
    const postReference = deepFreeze({
      communityPostId: postId,
      card: { workflowId: release.workflowId, version: release.version },
      attachedAt: at
    });
    postReferences.set(key, postReference);
    const draft = {
      ...current,
      revision: current.revision + 1,
      updatedAt: at
    };
    drafts.set(current.workflowId, draft);
    return deepFreeze({ draft: snapshot(draft), postReference });
  }

  function detachPostReference(input) {
    exactObject(input, [
      "workflowId",
      "version",
      "authorIdentityId",
      "communityPostId",
      "expectedRevision"
    ]);
    const current = draftFor(input.workflowId);
    requireAuthor(current, input.authorIdentityId);
    requireRevision(current, input.expectedRevision);
    const release = releaseFor(current.workflowId, input.version);
    const postId = communityPostId(input.communityPostId);
    const key = `${release.workflowId}:${release.version}:${postId}`;
    if (!postReferences.delete(key)) fail("NOT_FOUND", "Flarum 帖子卡片关联不存在");
    const draft = {
      ...current,
      revision: current.revision + 1,
      updatedAt: timestamp()
    };
    drafts.set(current.workflowId, draft);
    return deepFreeze({ draft: snapshot(draft), postReference: null });
  }

  function reviewSubmission(input) {
    exactObject(input, [
      "workflowId",
      "reviewerIdentityId",
      "decision",
      "reviewStatus",
      "riskLevel",
      "reason"
    ], [
      "workflowId",
      "reviewerIdentityId",
      "decision",
      "reviewStatus",
      "riskLevel"
    ]);
    const current = draftFor(input.workflowId);
    if (current.status !== "submitted") fail("INVALID_STATE", "只有已投稿草稿可以审核");
    const reviewerIdentityId = uuid(input.reviewerIdentityId, "reviewerIdentityId");
    if (reviewerIdentityId === current.authorIdentityId) {
      fail("SELF_REVIEW_FORBIDDEN", "作者不能审核自己的工作流");
    }
    if (input.decision !== "publish" && input.decision !== "reject") {
      fail("INVALID_INPUT", "审核决定必须是 publish 或 reject");
    }
    if (!RISK_LEVEL_SET.has(input.riskLevel)) {
      fail("INVALID_INPUT", "riskLevel 无效");
    }
    const reviewedAt = timestamp();
    if (input.decision === "reject") {
      if (input.reviewStatus !== "rejected") {
        fail("INVALID_INPUT", "拒绝结果必须使用 rejected 审核状态");
      }
      const reason = text(input.reason, "拒绝原因", 2, 500);
      const draft = {
        ...current,
        revision: current.revision + 1,
        status: "rejected",
        reviewStatus: "rejected",
        riskLevel: input.riskLevel,
        rejectionReason: reason,
        updatedAt: reviewedAt
      };
      drafts.set(current.workflowId, draft);
      const listing = deepFreeze({
        workflowId: current.workflowId,
        version: null,
        sourceCommunityPostId: current.sourceCommunityPostId,
        authorIdentityId: current.authorIdentityId,
        provenance: current.provenance,
        status: "warning",
        reviewStatus: "rejected",
        riskLevel: input.riskLevel,
        requiresPerUseConfirmation: false,
        reviewedByIdentityId: reviewerIdentityId,
        publishedAt: null,
        unlistedAt: null,
        unlistedByIdentityId: null,
        moderationReason: reason,
        publiclyVisible: false,
        importable: false,
        agentBindable: false
      });
      listings.set(current.workflowId, listing);
      return deepFreeze({ draft: snapshot(draft), release: null, listing });
    }
    if (input.reason !== undefined) fail("INVALID_SCHEMA", "发布决定不接受 reason 字段");
    if (!PUBLISHABLE_REVIEW_STATUSES.has(input.reviewStatus)) {
      fail("INVALID_INPUT", "发布需要 automated-reviewed 或 manually-reviewed");
    }
    if (input.riskLevel === "unsafe") {
      fail("UNSAFE_NOT_PUBLISHABLE", "unsafe 只能保留隔离审核记录");
    }

    const version = current.latestReleaseVersion + 1;
    const release = deepFreeze({
      workflowId: current.workflowId,
      version,
      authorIdentityId: current.authorIdentityId,
      sourceCommunityPostId: current.sourceCommunityPostId,
      provenance: current.provenance,
      content: current.content,
      reviewStatus: input.reviewStatus,
      riskLevel: input.riskLevel,
      requiresPerUseConfirmation: input.riskLevel === "guarded",
      reviewedByIdentityId: reviewerIdentityId,
      releasedAt: reviewedAt
    });
    const byVersion = releases.get(current.workflowId) || new Map();
    byVersion.set(version, release);
    releases.set(current.workflowId, byVersion);
    const listing = deepFreeze({
      workflowId: current.workflowId,
      version,
      sourceCommunityPostId: current.sourceCommunityPostId,
      authorIdentityId: current.authorIdentityId,
      provenance: current.provenance,
      status: "published",
      reviewStatus: input.reviewStatus,
      riskLevel: input.riskLevel,
      requiresPerUseConfirmation: input.riskLevel === "guarded",
      reviewedByIdentityId: reviewerIdentityId,
      publishedAt: reviewedAt,
      unlistedAt: null,
      unlistedByIdentityId: null,
      moderationReason: null,
      publiclyVisible: true,
      importable: true,
      agentBindable: false
    });
    listings.set(current.workflowId, listing);
    const draft = {
      ...current,
      revision: current.revision + 1,
      status: "published",
      reviewStatus: input.reviewStatus,
      riskLevel: input.riskLevel,
      latestReleaseVersion: version,
      rejectionReason: null,
      updatedAt: reviewedAt
    };
    drafts.set(current.workflowId, draft);
    return deepFreeze({ draft: snapshot(draft), release, listing });
  }

  function unlist(input) {
    exactObject(input, ["workflowId", "reviewerIdentityId", "reason"]);
    const current = draftFor(input.workflowId);
    const reviewerIdentityId = uuid(input.reviewerIdentityId, "reviewerIdentityId");
    if (reviewerIdentityId === current.authorIdentityId) {
      fail("SELF_REVIEW_FORBIDDEN", "作者不能下架自己的工作流");
    }
    const listing = listings.get(current.workflowId);
    if (!listing || listing.status !== "published") {
      fail("INVALID_STATE", "只有已上架投影可以下架");
    }
    const unlisted = deepFreeze({
      ...listing,
      status: "unlisted",
      unlistedAt: timestamp(),
      unlistedByIdentityId: reviewerIdentityId,
      moderationReason: text(input.reason, "下架原因", 2, 500),
      publiclyVisible: false,
      importable: false
    });
    listings.set(current.workflowId, unlisted);
    return unlisted;
  }

  function reportRelease(input) {
    exactObject(input, ["workflowId", "version", "reporterIdentityId", "reason"]);
    const release = releaseFor(input.workflowId, input.version);
    const report = deepFreeze({
      reportId: nextId("reportId"),
      workflowId: release.workflowId,
      version: release.version,
      reporterIdentityId: uuid(input.reporterIdentityId, "reporterIdentityId"),
      reason: text(input.reason, "举报原因", 2, 500),
      status: "pending",
      createdAt: timestamp()
    });
    reports.set(report.reportId, report);
    return report;
  }

  function resolveReport(input) {
    exactObject(input, ["reportId", "reviewerIdentityId", "decision", "reason"]);
    const reportId = uuid(input.reportId, "reportId");
    const report = reports.get(reportId);
    if (!report) fail("NOT_FOUND", "工作流举报不存在");
    if (report.status !== "pending") fail("INVALID_STATE", "工作流举报已经处理");
    if (!["dismiss", "unlist"].includes(input.decision)) {
      fail("INVALID_INPUT", "举报处理决定无效");
    }
    const draft = draftFor(report.workflowId);
    const reviewerIdentityId = uuid(input.reviewerIdentityId, "reviewerIdentityId");
    if (reviewerIdentityId === draft.authorIdentityId) {
      fail("SELF_REVIEW_FORBIDDEN", "作者不能处理自己的工作流举报");
    }
    const reason = text(input.reason, "举报处理说明", 2, 500);
    let listing = listings.get(report.workflowId) || null;
    if (input.decision === "unlist") {
      if (!listing || listing.status !== "published" || listing.version !== report.version) {
        fail("INVALID_STATE", "举报版本不是当前已上架版本");
      }
      listing = unlist({ workflowId: report.workflowId, reviewerIdentityId, reason });
    }
    const resolved = deepFreeze({
      ...report,
      status: input.decision === "dismiss" ? "dismissed" : "resolved",
      resolution: input.decision,
      resolutionReason: reason,
      resolvedAt: timestamp(),
      resolvedByIdentityId: reviewerIdentityId
    });
    reports.set(reportId, resolved);
    return deepFreeze({ report: resolved, listing });
  }

  function createPostCard(input) {
    exactObject(input, ["workflowId", "version"]);
    const release = releaseFor(input.workflowId, input.version);
    return deepFreeze({ workflowId: release.workflowId, version: release.version });
  }

  function importRelease(input) {
    exactObject(input, ["workflowId", "version", "ownerIdentityId"]);
    const release = releaseFor(input.workflowId, input.version);
    const listing = listings.get(release.workflowId);
    if (
      !listing ||
      listing.status !== "published" ||
      listing.version !== release.version ||
      listing.riskLevel === "unsafe"
    ) {
      fail("IMPORT_NOT_ALLOWED", "只有当前已上架的 low/guarded 版本可以导入");
    }
    return {
      importedWorkflowId: nextId("importedWorkflowId"),
      ownerIdentityId: uuid(input.ownerIdentityId, "ownerIdentityId"),
      source: { workflowId: release.workflowId, version: release.version },
      sourceCommunityPostId: release.sourceCommunityPostId,
      provenance: deepClone(release.provenance),
      content: deepClone(release.content),
      reviewStatus: release.reviewStatus,
      riskLevel: release.riskLevel,
      requiresPerUseConfirmation: release.requiresPerUseConfirmation,
      importedAt: timestamp()
    };
  }

  function getDraft(workflowId) {
    return snapshot(draftFor(workflowId));
  }

  function getRelease(workflowId, version) {
    return releaseFor(workflowId, version);
  }

  function getListing(workflowId) {
    const id = uuid(workflowId, "workflowId");
    const listing = listings.get(id);
    if (!listing) fail("NOT_FOUND", "工作流上架投影不存在");
    return listing;
  }

  function listPostReferences(workflowId) {
    const id = uuid(workflowId, "workflowId");
    return deepFreeze(
      [...postReferences.values()]
        .filter((entry) => entry.card.workflowId === id)
        .sort((left, right) => left.communityPostId.localeCompare(right.communityPostId))
    );
  }

  function listDrafts() {
    return deepFreeze([...drafts.values()].map(snapshot));
  }

  function listReleases(workflowId) {
    const id = uuid(workflowId, "workflowId");
    return deepFreeze(
      [...(releases.get(id)?.values() || [])].sort((left, right) => left.version - right.version)
    );
  }

  function listListings() {
    return deepFreeze([...listings.values()]);
  }

  function getReport(reportId) {
    const report = reports.get(uuid(reportId, "reportId"));
    if (!report) fail("NOT_FOUND", "工作流举报不存在");
    return report;
  }

  function listReports() {
    return deepFreeze([...reports.values()]);
  }

  return Object.freeze({
    createDraft,
    updateDraft,
    submitDraft,
    withdrawDraft,
    attachPostReference,
    detachPostReference,
    reviewSubmission,
    unlist,
    reportRelease,
    resolveReport,
    createPostCard,
    importRelease,
    getDraft,
    getRelease,
    getListing,
    listPostReferences,
    listDrafts,
    listReleases,
    listListings,
    getReport,
    listReports
  });
}

module.exports = {
  DEPENDENCY_PERMISSIONS,
  RESOURCE_BINDING_KINDS,
  REVIEW_STATUSES,
  RISK_LEVELS,
  WorkflowContractError,
  createCommunityWorkflowStore
};
