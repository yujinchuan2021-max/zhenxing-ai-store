"use strict";

const MAX_IPC_BYTES = 128 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor", "command", "args", "env", "headers", "credentials", "script", "secret", "endpoint", "path", "url", "reviewerId", "reviewedBy", "internalNotes", "audit", "identityId", "authorIdentityId"]);
const CHANNELS = Object.freeze({
  capability: "identity:get-workflow-store-capability",
  create: "identity:create-workflow-draft",
  list: "identity:list-own-workflow-drafts",
  get: "identity:get-own-workflow-draft",
  update: "identity:update-workflow-draft",
  submit: "identity:submit-workflow-draft",
  withdraw: "identity:withdraw-workflow-draft",
  attach: "identity:attach-workflow-post",
  detach: "identity:detach-workflow-post",
  report: "identity:report-workflow-release"
});
const PUBLIC_CHANNELS = Object.freeze({
  capability: "identity:get-workflow-public-capability",
  list: "identity:list-workflow-public",
  get: "identity:get-workflow-public",
  resolve: "identity:resolve-workflow-public"
});

class WorkflowStoreIpcError extends Error {
  constructor(message, status = 400, code = "INVALID_INPUT") {
    super(message); this.name = "WorkflowStoreIpcError"; this.status = status; this.code = code;
  }
}

function fail(message = "工作流请求无效") { throw new WorkflowStoreIpcError(message); }
function plain(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const p = Object.getPrototypeOf(value); return p === Object.prototype || p === null; }
function exact(value, allowed, required = allowed) { if (!plain(value) || Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) fail(); return value; }
function safeTree(value, seen = new Set()) { if (value === null || typeof value !== "object") return; if (seen.has(value) || (!Array.isArray(value) && !plain(value))) fail(); seen.add(value); for (const key of Object.keys(value)) { if (FORBIDDEN.has(key)) fail(); safeTree(value[key], seen); } seen.delete(value); }
function copy(value) { safeTree(value); let encoded; try { encoded = JSON.stringify(value); } catch { fail(); } if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_IPC_BYTES) fail("工作流请求过大"); return JSON.parse(encoded); }
function copyResponse(value) { let encoded; try { encoded = JSON.stringify(value); } catch { fail(); } if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_IPC_BYTES) fail(); const result = JSON.parse(encoded); const check = (entry) => { if (entry === null || typeof entry !== "object") return; if (!Array.isArray(entry) && !plain(entry)) fail(); for (const child of Object.values(entry)) check(child); }; check(result); return result; }
function uuid(value) { const normalized = String(value || "").trim().toLowerCase(); if (!UUID_PATTERN.test(normalized)) fail(); return normalized; }
function positive(value) { if (!Number.isSafeInteger(value) || value < 1) fail(); return value; }
function idempotencyKey(value) { if (typeof value !== "string" || value.length < 8 || value.length > 200 || /[\r\n]/.test(value)) fail(); return value; }

function validateContent(input) {
  const value = exact(copy(input), ["title", "summary", "inputs", "outputs", "instructions", "dependencies", "secretPlaceholders"]);
  if (!Array.isArray(value.inputs) || !Array.isArray(value.outputs) || !Array.isArray(value.instructions) || !Array.isArray(value.dependencies) || !Array.isArray(value.secretPlaceholders)) fail();
  for (const entry of value.inputs) exact(entry, ["name", "type", "required", "description"]);
  for (const entry of value.outputs) exact(entry, ["name", "type", "description"]);
  for (const entry of value.dependencies) {
    if (entry?.kind === "product") exact(entry, ["kind", "canonicalId", "permissions"]);
    else if (entry?.kind === "resource") exact(entry, ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]);
    else fail();
  }
  for (const entry of value.secretPlaceholders) exact(entry, ["name", "description"]);
  return value;
}

function validateProvenance(input) {
  const value = exact(copy(input), ["licenseId", "derivedFrom", "discoveredVia"]);
  if (!Array.isArray(value.derivedFrom) || !Array.isArray(value.discoveredVia)) fail();
  for (const entry of value.derivedFrom) exact(entry, ["workflowId", "version"]);
  for (const entry of value.discoveredVia) exact(entry, ["kind", "canonicalId"]);
  return value;
}

function validateDraft(input) {
  const value = exact(copy(input), ["sourceCommunityPostId", "provenance", "content"]);
  return { sourceCommunityPostId: String(value.sourceCommunityPostId), provenance: validateProvenance(value.provenance), content: validateContent(value.content) };
}

function envelope(input, fields, required = fields) { return exact(copy(input), fields, required); }
function baseMutation(input, extra = []) { const value = envelope(input, ["idempotencyKey", "workflowId", "expectedRevision", ...extra]); value.idempotencyKey = idempotencyKey(value.idempotencyKey); value.workflowId = uuid(value.workflowId); value.expectedRevision = positive(value.expectedRevision); return value; }

function validateOwner(value) {
  const owner = exact(copy(value), ["workflowId", "expectedRevision", "status", "sourceCommunityPostId", "provenance", "content", "latestReleaseVersion", "rejectionReason", "postReferences", "allowedActions"]);
  uuid(owner.workflowId); positive(owner.expectedRevision); validateProvenance(owner.provenance); validateContent(owner.content);
  if (!Array.isArray(owner.postReferences) || !Array.isArray(owner.allowedActions)) fail("身份服务返回无效工作流");
  for (const ref of owner.postReferences) { exact(ref, ["communityPostId", "card", "attachedAt"]); exact(ref.card, ["workflowId", "version"]); }
  return owner;
}

function publicDisplayName(value) {
  if (typeof value !== "string") fail();
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 ||
      /[\p{Cc}\p{Cf}]/u.test(normalized) || /[<>]/.test(normalized) ||
      /&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);/i.test(normalized) ||
      /\b(?:https?:\/\/|www\.)/i.test(normalized) ||
      /\b(?:password|passwd|secret|token|credential|api[-_ ]?key|bearer)\b/i.test(normalized)) fail();
  return normalized;
}

function validatePublicWorkflow(value) {
  const fields = ["workflowId", "version", "author", "originalAuthorDisplayName", "sourceCommunityPostId", "provenance", "content", "reviewStatus", "riskLevel", "requiresPerUseConfirmation", "releasedAt"];
  const release = exact(copyResponse(value), fields, fields.filter((field) => field !== "originalAuthorDisplayName"));
  release.workflowId = uuid(release.workflowId);
  release.version = positive(release.version);
  release.author = exact(release.author, ["displayName"]);
  release.author.displayName = publicDisplayName(release.author.displayName);
  if (Object.hasOwn(release, "originalAuthorDisplayName")) {
    release.originalAuthorDisplayName = publicDisplayName(release.originalAuthorDisplayName);
  }
  if (typeof release.sourceCommunityPostId !== "string" || typeof release.releasedAt !== "string") fail();
  release.provenance = exact(release.provenance, ["canonicalSource", "licenseId", "derivedFrom"]);
  if (typeof release.provenance.licenseId !== "string") fail();
  release.provenance.canonicalSource = exact(release.provenance.canonicalSource, ["kind", "canonicalId"]);
  if (release.provenance.canonicalSource.kind !== "community-post" || typeof release.provenance.canonicalSource.canonicalId !== "string") fail();
  if (!Array.isArray(release.provenance.derivedFrom)) fail();
  for (const entry of release.provenance.derivedFrom) { exact(entry, ["workflowId", "version"]); uuid(entry.workflowId); positive(entry.version); }
  release.content = exact(release.content, ["title", "summary", "inputs", "outputs", "instructions", "dependencies"]);
  if (typeof release.content.title !== "string" || typeof release.content.summary !== "string") fail();
  if (![release.content.inputs, release.content.outputs, release.content.instructions, release.content.dependencies].every(Array.isArray)) fail();
  for (const entry of release.content.inputs) { exact(entry, ["name", "type", "required", "description"]); if (typeof entry.name !== "string" || typeof entry.type !== "string" || typeof entry.required !== "boolean" || typeof entry.description !== "string") fail(); }
  for (const entry of release.content.outputs) { exact(entry, ["name", "type", "description"]); if (typeof entry.name !== "string" || typeof entry.type !== "string" || typeof entry.description !== "string") fail(); }
  if (release.content.instructions.some((entry) => typeof entry !== "string")) fail();
  for (const entry of release.content.dependencies) { if (!["product", "resource"].includes(entry?.kind)) fail(); exact(entry, entry.kind === "product" ? ["kind", "canonicalId", "permissions"] : ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]); if (typeof entry.canonicalId !== "string" || !Array.isArray(entry.permissions) || entry.permissions.some((permission) => typeof permission !== "string") || (entry.kind === "resource" && (typeof entry.hostProductId !== "string" || typeof entry.bindingKind !== "string"))) fail(); }
  if (!["automated-reviewed", "manually-reviewed"].includes(release.reviewStatus) || !["low", "guarded"].includes(release.riskLevel) || typeof release.requiresPerUseConfirmation !== "boolean") fail();
  return release;
}

function publicReference(input) { const value = envelope(input, ["workflowId", "version"]); return { workflowId: uuid(value.workflowId), version: positive(value.version) }; }
function publicList(input = {}) { const value = envelope(input, ["limit", "after", "riskLevel"], []); if (value.limit !== undefined && (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 50)) fail(); if (value.after !== undefined) value.after = uuid(value.after); if (value.riskLevel !== undefined && !["low", "guarded"].includes(value.riskLevel)) fail(); return value; }

function normalizeError(error, publicRead = false) {
  const status = Number(error?.status); const code = String(error?.code || "");
  if (publicRead && (status === 404 || code === "NOT_FOUND" || code === "PUBLIC_WORKFLOW_UNAVAILABLE" || code === "FEATURE_DISABLED")) return { code: "PUBLIC_WORKFLOW_UNAVAILABLE", status: status === 404 ? 404 : 503, messageKey: "workflow.public.unavailable" };
  if (status === 401 || code === "AUTHENTICATION_REQUIRED" || code === "SESSION_REVOKED") return { code: "AUTHENTICATION_REQUIRED", status: 401, messageKey: "workflow.store.loginRequired" };
  if (status === 404 || code === "NOT_FOUND") return { code: "NOT_FOUND", status: 404, messageKey: "workflow.store.notFound" };
  if (status === 409 || ["REVISION_CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(code)) return { code: code === "IDEMPOTENCY_CONFLICT" ? code : "REVISION_CONFLICT", status: 409, messageKey: "workflow.store.conflict" };
  if (status === 429 || code === "RATE_LIMITED") return { code: "RATE_LIMITED", status: 429, messageKey: "workflow.store.rateLimited" };
  if (code === "FEATURE_DISABLED") return { code, status: 503, messageKey: "workflow.store.unavailable" };
  if (status === 400 || code === "INVALID_INPUT") return { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" };
  if (code === "INVALID_IDENTITY_RESPONSE") return { code, status: 502, messageKey: "workflow.store.failed" };
  return { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "workflow.store.serviceUnavailable" };
}

function success(value) { return { ok: true, value }; }
function failure(error, publicRead = false) { return { ok: false, error: normalizeError(error, publicRead) }; }

function registerWorkflowStoreIpc(ipcMain, { getIdentityClient, logError = () => {} } = {}) {
  if (!ipcMain?.handle || typeof getIdentityClient !== "function") throw new TypeError("workflow IPC dependencies are required");
  const mutationArguments = (value) => {
    const { idempotencyKey: key, ...body } = value;
    return [key, body];
  };
  const handle = (channel, validate, call, validateResult) => ipcMain.handle(channel, async (_event, input) => {
    try {
      const client = getIdentityClient();
      const publicRead = Object.values(PUBLIC_CHANNELS).includes(channel);
      if (channel !== CHANNELS.capability && !publicRead) {
        const current = await client.current();
        if (current?.status !== "authenticated") throw new WorkflowStoreIpcError("请先登录", 401, "AUTHENTICATION_REQUIRED");
      }
      const result = await call(client, validate ? validate(input) : undefined);
      if (!validateResult) return success(copy(result));
      try {
        return success(validateResult(result));
      } catch (cause) {
        const error = new WorkflowStoreIpcError(
          "身份服务返回无效工作流",
          502,
          "INVALID_IDENTITY_RESPONSE"
        );
        error.cause = cause;
        throw error;
      }
    } catch (error) {
      logError("Workflow store IPC failed", error);
      return failure(error, Object.values(PUBLIC_CHANNELS).includes(channel));
    }
  });
  handle(CHANNELS.capability, null, (client) => client.getWorkflowStoreCapability(), (value) => exact(copy(value), ["enabled", "schemaVersion", "execution", "workflowSubmissionLookup"]));
  handle(CHANNELS.create, (input) => { const value = envelope(input, ["idempotencyKey", "draft"]); return { idempotencyKey: idempotencyKey(value.idempotencyKey), draft: validateDraft(value.draft) }; }, (client, value) => client.createMyWorkflowDraft(value.idempotencyKey, value.draft), validateOwner);
  handle(CHANNELS.list, (input = {}) => { const value = envelope(input, ["limit", "after"], []); if (value.limit !== undefined && (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 50)) fail(); return value; }, (client, value) => client.listMyWorkflowDrafts(value), (value) => { const page = exact(copy(value), ["items", "next"]); if (!Array.isArray(page.items)) fail(); page.items = page.items.map(validateOwner); return page; });
  handle(CHANNELS.get, (input) => ({ workflowId: uuid(envelope(input, ["workflowId"]).workflowId) }), (client, value) => client.getMyWorkflowDraft(value.workflowId), validateOwner);
  handle(CHANNELS.update, (input) => { const value = baseMutation(input, ["content"]); value.content = validateContent(value.content); return value; }, (client, value) => client.updateMyWorkflowDraft(...mutationArguments(value)), validateOwner);
  for (const [channel, method] of [[CHANNELS.submit, "submitMyWorkflowDraft"], [CHANNELS.withdraw, "withdrawMyWorkflowDraft"]]) handle(channel, baseMutation, (client, value) => client[method](...mutationArguments(value)), validateOwner);
  for (const [channel, method] of [[CHANNELS.attach, "attachMyWorkflowPost"], [CHANNELS.detach, "detachMyWorkflowPost"]]) handle(channel, (input) => { const value = baseMutation(input, ["version", "communityPostId"]); value.version = positive(value.version); value.communityPostId = String(value.communityPostId); return value; }, (client, value) => client[method](...mutationArguments(value)), (value) => { const result = exact(copy(value), ["draft", "postReference"]); result.draft = validateOwner(result.draft); if (result.postReference !== null) { exact(result.postReference, ["communityPostId", "card", "attachedAt"]); exact(result.postReference.card, ["workflowId", "version"]); } return result; });
  handle(CHANNELS.report, (input) => { const value = envelope(input, ["idempotencyKey", "workflowId", "version", "reason"]); value.idempotencyKey = idempotencyKey(value.idempotencyKey); value.workflowId = uuid(value.workflowId); value.version = positive(value.version); if (typeof value.reason !== "string" || value.reason.length < 2 || value.reason.length > 500) fail(); return value; }, (client, value) => client.reportWorkflowRelease(...mutationArguments(value)), (value) => exact(copy(value), ["reportId", "workflowId", "version", "status", "createdAt"]));
  handle(PUBLIC_CHANNELS.capability, null, (client) => client.getWorkflowPublicCapability(), (value) => exact(copyResponse(value), ["enabled", "schemaVersion", "execution"]));
  handle(PUBLIC_CHANNELS.list, publicList, (client, value) => client.listPublicWorkflows(value), (value) => { const page = exact(copyResponse(value), ["items", "next"]); if (!Array.isArray(page.items)) fail(); page.items = page.items.map(validatePublicWorkflow); if (page.next !== null) page.next = uuid(page.next); return page; });
  handle(PUBLIC_CHANNELS.get, publicReference, (client, value) => client.getPublicWorkflow(value), validatePublicWorkflow);
  handle(PUBLIC_CHANNELS.resolve, publicReference, (client, value) => client.resolvePublicWorkflow(value), validatePublicWorkflow);
}

module.exports = { CHANNELS, PUBLIC_CHANNELS, MAX_IPC_BYTES, WorkflowStoreIpcError, registerWorkflowStoreIpc };
