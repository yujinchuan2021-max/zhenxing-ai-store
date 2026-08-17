const { contextBridge, ipcRenderer } = require("electron");

const identityLoginChannel = "identity:login";
const identityLoginErrorCodes = new Set([
  "AUTHENTICATION_FAILED", "INVALID_IDENTITY_RESPONSE", "INVALID_INPUT",
  "RATE_LIMITED", "TEMPORARILY_UNAVAILABLE"
]);
const identityLoginMessageKeys = new Set([
  "identity.login.failed", "identity.login.invalid",
  "identity.login.invalidCredentials", "identity.login.rateLimited",
  "identity.login.serviceUnavailable"
]);

function identityLoginFailure(
  code = "TEMPORARILY_UNAVAILABLE",
  status = 503,
  messageKey = "identity.login.serviceUnavailable"
) {
  return { ok: false, error: { code, status, messageKey } };
}

function plainIdentityLoginObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}

function exactIdentityLoginObject(value, fields) {
  return (
    plainIdentityLoginObject(value) &&
    Object.keys(value).length === fields.size &&
    Object.keys(value).every((key) => fields.has(key))
  );
}

function identityLoginInput(value) {
  if (
    !exactIdentityLoginObject(value, new Set(["identifier", "password"])) ||
    typeof value.identifier !== "string" || !value.identifier.trim() ||
    value.identifier.length > 320 ||
    typeof value.password !== "string" || !value.password ||
    value.password.length > 4096
  ) {
    throw new Error("invalid identity login input");
  }
  return { identifier: value.identifier.trim(), password: value.password };
}

function safeIdentityLoginResult(value) {
  if (value?.ok === false) {
    const error = value.error;
    if (
      exactIdentityLoginObject(error, new Set(["code", "status", "messageKey"])) &&
      identityLoginErrorCodes.has(error.code) &&
      [400, 401, 429, 502, 503].includes(error.status) &&
      identityLoginMessageKeys.has(error.messageKey)
    ) {
      return identityLoginFailure(error.code, error.status, error.messageKey);
    }
    return identityLoginFailure("INVALID_IDENTITY_RESPONSE", 502, "identity.login.failed");
  }
  const snapshot = value?.value;
  if (
    value?.ok !== true ||
    !exactIdentityLoginObject(value, new Set(["ok", "value"])) ||
    !exactIdentityLoginObject(snapshot, new Set(["status", "user", "sessionId"])) ||
    snapshot.status !== "authenticated" ||
    !exactIdentityLoginObject(snapshot.user, new Set(["id", "email", "phone", "username", "profile"])) ||
    !exactIdentityLoginObject(snapshot.user.profile, new Set(["nickname", "avatarUrl", "bio"])) ||
    typeof snapshot.sessionId !== "string" ||
    typeof snapshot.user.id !== "string" ||
    typeof snapshot.user.email !== "string" ||
    typeof snapshot.user.phone !== "string" ||
    typeof snapshot.user.username !== "string" ||
    typeof snapshot.user.profile.nickname !== "string" ||
    typeof snapshot.user.profile.avatarUrl !== "string" ||
    typeof snapshot.user.profile.bio !== "string"
  ) {
    return identityLoginFailure("INVALID_IDENTITY_RESPONSE", 502, "identity.login.failed");
  }
  return { ok: true, value: snapshot };
}

function invokeIdentityLogin(input) {
  try {
    return ipcRenderer
      .invoke(identityLoginChannel, identityLoginInput(input))
      .then(safeIdentityLoginResult, () => identityLoginFailure());
  } catch {
    return Promise.resolve(
      identityLoginFailure("INVALID_INPUT", 400, "identity.login.invalid")
    );
  }
}

const communityEmbedChannel = "community:create-embed-session";

function communityEmbedFailure() {
  return {
    ok: false,
    error: {
      code: "TEMPORARILY_UNAVAILABLE",
      status: 503,
      messageKey: "community.serviceUnavailable"
    }
  };
}

function safeCommunityEmbedResult(value) {
  if (value?.ok === false) {
    const error = value.error;
    const allowed = new Map([
      ["SESSION_REVOKED", [401, "community.sessionExpired"]],
      ["TEMPORARILY_UNAVAILABLE", [503, "community.serviceUnavailable"]]
    ]);
    const expected = allowed.get(error?.code);
    if (
      exactIdentityLoginObject(value, new Set(["ok", "error"])) &&
      exactIdentityLoginObject(error, new Set(["code", "status", "messageKey"])) &&
      expected?.[0] === error.status &&
      expected?.[1] === error.messageKey
    ) {
      return {
        ok: false,
        error: {
          code: error.code,
          status: error.status,
          messageKey: error.messageKey
        }
      };
    }
    return {
      ok: false,
      error: {
        code: "INVALID_IDENTITY_RESPONSE",
        status: 502,
        messageKey: "community.invalidResponse"
      }
    };
  }
  const session = value?.value;
  try {
    const origin = new URL(session?.origin);
    const launchUrl = new URL(session?.launchUrl);
    const queryKeys = [...launchUrl.searchParams.keys()];
    if (
      value?.ok !== true ||
      !exactIdentityLoginObject(value, new Set(["ok", "value"])) ||
      !exactIdentityLoginObject(session, new Set(["launchUrl", "origin", "expiresAt"])) ||
      origin.href !== `${origin.origin}/` ||
      !(origin.protocol === "https:" ||
        (origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname))) ||
      launchUrl.origin !== origin.origin ||
      launchUrl.pathname !== "/aihub-sso.php" ||
      queryKeys.length !== 1 ||
      queryKeys[0] !== "ticket" ||
      !/^[A-Za-z0-9_-]{32,}$/.test(launchUrl.searchParams.get("ticket") || "") ||
      launchUrl.username ||
      launchUrl.password ||
      launchUrl.hash ||
      typeof session.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(session.expiresAt))
    ) {
      throw new Error("invalid community response");
    }
    return {
      ok: true,
      value: {
        launchUrl: launchUrl.href,
        origin: origin.origin,
        expiresAt: session.expiresAt
      }
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "INVALID_IDENTITY_RESPONSE",
        status: 502,
        messageKey: "community.invalidResponse"
      }
    };
  }
}

function invokeCommunityEmbedSession() {
  return ipcRenderer
    .invoke(communityEmbedChannel)
    .then(safeCommunityEmbedResult, () => communityEmbedFailure());
}

// Sandboxed preloads cannot require local modules. Keep this defensive copy
// aligned with the shared five-phase public contract; main revalidates the
// same exact cancel envelope against the current durable attempt.
const submissionChannels = Object.freeze({
  capability: "identity:get-submission-capability",
  create: "identity:create-submission",
  list: "identity:list-own-submissions",
  get: "identity:get-own-submission",
  update: "identity:update-submission-draft",
  submit: "identity:submit-submission",
  evidence: "identity:add-submission-evidence",
  withdraw: "identity:withdraw-submission"
});
const submissionProposalFields = new Set([
  "submissionKind", "title", "summary", "originalAuthorIdentityId",
  "originalAuthor", "organization", "ownershipClaim", "canonicalSource",
  "licenseId", "sourceRevision", "catalogReferences", "hostTuples",
  "platforms", "scenarioTags", "rawTags", "agentCompatibility",
  "evidenceRefs", "discoveredVia", "workflowRef"
]);
const forbiddenSubmissionFields = new Set([
  "__proto__", "prototype", "constructor", "command", "args", "env",
  "headers", "credentials", "script", "secret", "endpoint", "path", "url",
  "vaultRef", "reviewerId", "reviewedBy", "reviewStatus", "risk", "riskLevel",
  "merge", "mergeIntoSubmissionId", "publicEligibility", "fingerprint",
  "dedupeFingerprint", "possibleDuplicateSubmissionIds", "internalNotes", "audit"
]);
const submissionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidSubmissionInput(message = "投稿请求无效") {
  const error = new Error(message);
  error.code = "INVALID_INPUT";
  error.status = 400;
  throw error;
}

function plainSubmissionObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}

function exactSubmissionObject(value, allowed, required = []) {
  return (
    plainSubmissionObject(value) &&
    Object.keys(value).every((key) => allowed.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function safeSubmissionTree(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) invalidSubmissionInput();
  seen.add(value);
  if (!Array.isArray(value) && !plainSubmissionObject(value)) invalidSubmissionInput();
  for (const key of Object.keys(value)) {
    if (forbiddenSubmissionFields.has(key)) invalidSubmissionInput();
    safeSubmissionTree(value[key], seen);
  }
  seen.delete(value);
}

function copySubmissionInput(value) {
  safeSubmissionTree(value);
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    invalidSubmissionInput();
  }
  if (
    typeof encoded !== "string" ||
    new TextEncoder().encode(encoded).byteLength > 128 * 1024
  ) {
    invalidSubmissionInput("投稿请求过大");
  }
  return JSON.parse(encoded);
}

function httpsSubmissionUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      typeof value === "string" && value.length <= 2048 &&
      parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      !parsed.hash && parsed.toString() === value
    );
  } catch {
    return false;
  }
}

function submissionProposal(input) {
  const value = copySubmissionInput(input);
  if (
    !exactSubmissionObject(
      value,
      submissionProposalFields,
      ["submissionKind", "title", "summary", "canonicalSource"]
    ) ||
    !["vendor", "agent", "skill", "mcp", "plugin", "connector"].includes(
      value.submissionKind
    ) ||
    typeof value.title !== "string" || !value.title.trim() || value.title.length > 160 ||
    typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 1000 ||
    !httpsSubmissionUrl(value.canonicalSource)
  ) {
    invalidSubmissionInput();
  }
  if (
    value.ownershipClaim != null &&
    !exactSubmissionObject(
      value.ownershipClaim,
      new Set(["kind", "evidenceRefs"]),
      ["kind", "evidenceRefs"]
    )
  ) {
    invalidSubmissionInput();
  }
  for (const item of value.catalogReferences || []) {
    if (
      !exactSubmissionObject(
        item,
        new Set(["kind", "canonicalId", "hostProductId"]),
        ["kind", "canonicalId"]
      )
    ) invalidSubmissionInput();
  }
  for (const item of value.hostTuples || []) {
    if (
      !exactSubmissionObject(
        item,
        new Set(["kind", "canonicalId", "hostProductId", "bindingKind"]),
        ["kind", "canonicalId", "hostProductId", "bindingKind"]
      )
    ) invalidSubmissionInput();
  }
  if (value.workflowRef != null) invalidSubmissionInput();
  for (const url of [
    ...(value.evidenceRefs || []),
    ...(value.ownershipClaim?.evidenceRefs || [])
  ]) {
    if (!httpsSubmissionUrl(url)) invalidSubmissionInput();
  }
  return value;
}

function submissionEnvelope(input, allowed, required = [...allowed]) {
  const value = copySubmissionInput(input);
  if (!exactSubmissionObject(value, allowed, required)) invalidSubmissionInput();
  return value;
}

function submissionId(value) {
  if (!submissionIdPattern.test(String(value || ""))) invalidSubmissionInput();
  return value;
}

function submissionRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) invalidSubmissionInput();
  return value;
}

const submissionErrorCodes = new Set([
  "AUTHENTICATION_REQUIRED", "FEATURE_DISABLED", "INVALID_IDENTITY_RESPONSE",
  "INVALID_INPUT", "INVALID_RESOURCE_SUBMISSION", "NOT_FOUND", "RATE_LIMITED",
  "REVISION_CONFLICT", "TEMPORARILY_UNAVAILABLE"
]);
const submissionMessageKeys = new Set([
  "resources.submit.conflict", "resources.submit.failed", "resources.submit.invalid",
  "resources.submit.loginRequired", "resources.submit.rateLimited",
  "resources.submit.serviceUnavailable", "resources.submit.unavailable"
]);
const submissionErrorStatuses = new Set([400, 401, 404, 409, 429, 502, 503]);

function submissionFailure(
  code = "TEMPORARILY_UNAVAILABLE",
  status = 503,
  messageKey = "resources.submit.serviceUnavailable"
) {
  return { ok: false, error: { code, status, messageKey } };
}

function safeSubmissionResult(value) {
  if (
    exactSubmissionObject(value, new Set(["ok", "value"]), ["ok", "value"]) &&
    value.ok === true
  ) {
    return { ok: true, value: value.value };
  }
  if (
    exactSubmissionObject(value, new Set(["ok", "error"]), ["ok", "error"]) &&
    value.ok === false &&
    exactSubmissionObject(
      value.error,
      new Set(["code", "status", "messageKey"]),
      ["code", "status", "messageKey"]
    ) &&
    submissionErrorCodes.has(value.error.code) &&
    submissionErrorStatuses.has(value.error.status) &&
    submissionMessageKeys.has(value.error.messageKey)
  ) {
    return {
      ok: false,
      error: {
        code: value.error.code,
        status: value.error.status,
        messageKey: value.error.messageKey
      }
    };
  }
  return submissionFailure();
}

function invokeSubmission(channel, input) {
  return ipcRenderer
    .invoke(channel, input)
    .then(safeSubmissionResult, () => submissionFailure());
}

function validateAndInvokeSubmission(work) {
  try {
    return work();
  } catch {
    return Promise.resolve(
      submissionFailure("INVALID_INPUT", 400, "resources.submit.invalid")
    );
  }
}

const resourceSubmissionBridge = Object.freeze({
  getSubmissionCapability: () => invokeSubmission(submissionChannels.capability),
  createSubmission: (input) => validateAndInvokeSubmission(() => {
    const value = submissionEnvelope(
      input,
      new Set(["idempotencyKey", "submission"])
    );
    if (
      typeof value.idempotencyKey !== "string" ||
      !value.idempotencyKey.trim() ||
      value.idempotencyKey.length > 160
    ) invalidSubmissionInput();
    return invokeSubmission(submissionChannels.create, {
      idempotencyKey: value.idempotencyKey,
      submission: submissionProposal(value.submission)
    });
  }),
  listOwnSubmissions: (input = {}) => validateAndInvokeSubmission(() => {
    const value = submissionEnvelope(input, new Set(["offset", "limit"]), []);
    if (
      (value.offset !== undefined &&
        (!Number.isSafeInteger(value.offset) || value.offset < 0)) ||
      (value.limit !== undefined &&
        (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 100))
    ) invalidSubmissionInput();
    return invokeSubmission(submissionChannels.list, value);
  }),
  getOwnSubmission: (input) => validateAndInvokeSubmission(() => {
    const value = submissionEnvelope(input, new Set(["submissionId"]));
    return invokeSubmission(submissionChannels.get, {
      submissionId: submissionId(value.submissionId)
    });
  }),
  updateSubmissionDraft: (input) => validateAndInvokeSubmission(() => {
    const value = submissionEnvelope(
      input,
      new Set(["submissionId", "expectedRevision", "submission"])
    );
    return invokeSubmission(submissionChannels.update, {
      submissionId: submissionId(value.submissionId),
      expectedRevision: submissionRevision(value.expectedRevision),
      submission: submissionProposal(value.submission)
    });
  }),
  submitSubmission: (input) => validateAndInvokeSubmission(() =>
    submissionRevisionInvoke(submissionChannels.submit, input)
  ),
  addSubmissionEvidence: (input) => validateAndInvokeSubmission(() => {
    const value = submissionEnvelope(
      input,
      new Set(["submissionId", "expectedRevision", "evidenceRefs"])
    );
    if (
      !Array.isArray(value.evidenceRefs) || !value.evidenceRefs.length ||
      value.evidenceRefs.length > 21 || !value.evidenceRefs.every(httpsSubmissionUrl)
    ) invalidSubmissionInput();
    return invokeSubmission(submissionChannels.evidence, {
      submissionId: submissionId(value.submissionId),
      expectedRevision: submissionRevision(value.expectedRevision),
      evidenceRefs: value.evidenceRefs
    });
  }),
  withdrawSubmission: (input) => validateAndInvokeSubmission(() =>
    submissionRevisionInvoke(submissionChannels.withdraw, input)
  )
});

function submissionRevisionInvoke(channel, input) {
  const value = submissionEnvelope(
    input,
    new Set(["submissionId", "expectedRevision"])
  );
  return invokeSubmission(channel, {
    submissionId: submissionId(value.submissionId),
    expectedRevision: submissionRevision(value.expectedRevision)
  });
}

const workflowChannels = Object.freeze({
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
const workflowPublicChannels = Object.freeze({
  capability: "identity:get-workflow-public-capability",
  list: "identity:list-workflow-public",
  get: "identity:get-workflow-public",
  resolve: "identity:resolve-workflow-public"
});
const workflowErrorCodes = new Set(["AUTHENTICATION_REQUIRED", "FEATURE_DISABLED", "IDEMPOTENCY_CONFLICT", "INVALID_IDENTITY_RESPONSE", "INVALID_INPUT", "NOT_FOUND", "PUBLIC_WORKFLOW_UNAVAILABLE", "RATE_LIMITED", "REVISION_CONFLICT", "TEMPORARILY_UNAVAILABLE"]);
const workflowMessageKeys = new Set(["workflow.public.unavailable", "workflow.store.accessDenied", "workflow.store.conflict", "workflow.store.failed", "workflow.store.invalid", "workflow.store.loginRequired", "workflow.store.notFound", "workflow.store.rateLimited", "workflow.store.serviceUnavailable", "workflow.store.unavailable"]);

function invalidWorkflowInput() { invalidSubmissionInput("工作流请求无效"); }
function workflowId(value) { if (!submissionIdPattern.test(String(value || ""))) invalidWorkflowInput(); return value; }
function workflowPositive(value) { if (!Number.isSafeInteger(value) || value < 1) invalidWorkflowInput(); return value; }
function workflowExact(input, fields, required = fields) { const value = copySubmissionInput(input); if (!exactSubmissionObject(value, new Set(fields), required)) invalidWorkflowInput(); return value; }
function workflowContent(input) {
  const value = workflowExact(input, ["title", "summary", "inputs", "outputs", "instructions", "dependencies", "secretPlaceholders"]);
  if (![value.inputs, value.outputs, value.instructions, value.dependencies, value.secretPlaceholders].every(Array.isArray)) invalidWorkflowInput();
  for (const entry of value.inputs) workflowExact(entry, ["name", "type", "required", "description"]);
  for (const entry of value.outputs) workflowExact(entry, ["name", "type", "description"]);
  for (const entry of value.dependencies) workflowExact(entry, entry?.kind === "product" ? ["kind", "canonicalId", "permissions"] : ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]);
  for (const entry of value.secretPlaceholders) workflowExact(entry, ["name", "description"]);
  return value;
}
function workflowDraft(input) {
  const value = workflowExact(input, ["sourceCommunityPostId", "provenance", "content"]);
  const provenance = workflowExact(value.provenance, ["licenseId", "derivedFrom", "discoveredVia"]);
  if (!Array.isArray(provenance.derivedFrom) || !Array.isArray(provenance.discoveredVia)) invalidWorkflowInput();
  for (const entry of provenance.derivedFrom) workflowExact(entry, ["workflowId", "version"]);
  for (const entry of provenance.discoveredVia) workflowExact(entry, ["kind", "canonicalId"]);
  return { sourceCommunityPostId: String(value.sourceCommunityPostId), provenance, content: workflowContent(value.content) };
}
function workflowFailure(code = "TEMPORARILY_UNAVAILABLE", status = 503, messageKey = "workflow.store.serviceUnavailable") { return { ok: false, error: { code, status, messageKey } }; }
function safeWorkflowResult(value) {
  if (exactSubmissionObject(value, new Set(["ok", "value"]), ["ok", "value"]) && value.ok === true) return { ok: true, value: value.value };
  if (exactSubmissionObject(value, new Set(["ok", "error"]), ["ok", "error"]) && value.ok === false && exactSubmissionObject(value.error, new Set(["code", "status", "messageKey"]), ["code", "status", "messageKey"]) && workflowErrorCodes.has(value.error.code) && submissionErrorStatuses.has(value.error.status) && workflowMessageKeys.has(value.error.messageKey)) return { ok: false, error: { code: value.error.code, status: value.error.status, messageKey: value.error.messageKey } };
  return workflowFailure();
}
function invokeWorkflow(channel, input) { return ipcRenderer.invoke(channel, input).then(safeWorkflowResult, () => workflowFailure()); }
function validWorkflowCall(work) { try { return work(); } catch { return Promise.resolve(workflowFailure("INVALID_INPUT", 400, "workflow.store.invalid")); } }
function workflowKey(value) { if (typeof value !== "string" || value.length < 8 || value.length > 200 || /[\r\n]/.test(value)) invalidWorkflowInput(); return value; }
function workflowMutationInput(input, extra = []) { const value = workflowExact(input, ["idempotencyKey", "workflowId", "expectedRevision", ...extra]); value.idempotencyKey = workflowKey(value.idempotencyKey); value.workflowId = workflowId(value.workflowId); value.expectedRevision = workflowPositive(value.expectedRevision); return value; }
const workflowStoreBridge = Object.freeze({
  getWorkflowStoreCapability: () => invokeWorkflow(workflowChannels.capability),
  getWorkflowPublicCapability: () => invokeWorkflow(workflowPublicChannels.capability),
  listPublicWorkflows: (input = {}) => validWorkflowCall(() => { const value = workflowExact(input, ["limit", "after", "riskLevel"], []); if (value.limit !== undefined && (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 50)) invalidWorkflowInput(); if (value.after !== undefined) value.after = workflowId(value.after); if (value.riskLevel !== undefined && !["low", "guarded"].includes(value.riskLevel)) invalidWorkflowInput(); return invokeWorkflow(workflowPublicChannels.list, value); }),
  getPublicWorkflow: (input) => validWorkflowCall(() => { const value = workflowExact(input, ["workflowId", "version"]); return invokeWorkflow(workflowPublicChannels.get, { workflowId: workflowId(value.workflowId), version: workflowPositive(value.version) }); }),
  resolvePublicWorkflow: (input) => validWorkflowCall(() => { const value = workflowExact(input, ["workflowId", "version"]); return invokeWorkflow(workflowPublicChannels.resolve, { workflowId: workflowId(value.workflowId), version: workflowPositive(value.version) }); }),
  createWorkflowDraft: (input) => validWorkflowCall(() => { const value = workflowExact(input, ["idempotencyKey", "draft"]); return invokeWorkflow(workflowChannels.create, { idempotencyKey: workflowKey(value.idempotencyKey), draft: workflowDraft(value.draft) }); }),
  listOwnWorkflowDrafts: (input = {}) => validWorkflowCall(() => { const value = workflowExact(input, ["limit", "after"], []); if (value.limit !== undefined && (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > 50)) invalidWorkflowInput(); return invokeWorkflow(workflowChannels.list, value); }),
  getOwnWorkflowDraft: (input) => validWorkflowCall(() => { const value = workflowExact(input, ["workflowId"]); return invokeWorkflow(workflowChannels.get, { workflowId: workflowId(value.workflowId) }); }),
  updateWorkflowDraft: (input) => validWorkflowCall(() => { const value = workflowMutationInput(input, ["content"]); value.content = workflowContent(value.content); return invokeWorkflow(workflowChannels.update, value); }),
  submitWorkflowDraft: (input) => validWorkflowCall(() => invokeWorkflow(workflowChannels.submit, workflowMutationInput(input))),
  withdrawWorkflowDraft: (input) => validWorkflowCall(() => invokeWorkflow(workflowChannels.withdraw, workflowMutationInput(input))),
  attachWorkflowPost: (input) => validWorkflowCall(() => { const value = workflowMutationInput(input, ["version", "communityPostId"]); value.version = workflowPositive(value.version); value.communityPostId = String(value.communityPostId); return invokeWorkflow(workflowChannels.attach, value); }),
  detachWorkflowPost: (input) => validWorkflowCall(() => { const value = workflowMutationInput(input, ["version", "communityPostId"]); value.version = workflowPositive(value.version); value.communityPostId = String(value.communityPostId); return invokeWorkflow(workflowChannels.detach, value); }),
  reportWorkflowRelease: (input) => validWorkflowCall(() => { const value = workflowExact(input, ["idempotencyKey", "workflowId", "version", "reason"]); value.idempotencyKey = workflowKey(value.idempotencyKey); value.workflowId = workflowId(value.workflowId); value.version = workflowPositive(value.version); if (typeof value.reason !== "string" || value.reason.length < 2 || value.reason.length > 500) invalidWorkflowInput(); return invokeWorkflow(workflowChannels.report, value); })
});

const localAgentBridgeChannels = Object.freeze({
  capability: "agent-bridge:capability",
  search: "agent-bridge:search",
  get: "agent-bridge:get",
  plan: "agent-bridge:plan",
  request: "agent-bridge:request"
});
const localAgentBridgeErrors = new Set(["BRIDGE_DISABLED", "INPUT_INVALID", "NOT_FOUND", "SOURCE_UNAVAILABLE", "TEMPORARILY_UNAVAILABLE"]);
const localAgentBridgeMessageKeys = new Set(["agent.bridge.disabled", "agent.bridge.invalid", "agent.bridge.notFound", "agent.bridge.unavailable"]);
const localAgentBridgePrivateFields = new Set(["agentId", "sessionId", "grantId", "receipt", "receipts", "authorizationReceipts", "vault", "vaultReferences", "identity", "identityId", "audit", "secret", "secrets", "token", "tokens"]);
function localAgentBridgeFailure(code = "TEMPORARILY_UNAVAILABLE") { return { ok: false, error: { code, status: code === "INPUT_INVALID" ? 400 : code === "NOT_FOUND" ? 404 : 503, messageKey: code === "INPUT_INVALID" ? "agent.bridge.invalid" : code === "NOT_FOUND" ? "agent.bridge.notFound" : code === "BRIDGE_DISABLED" ? "agent.bridge.disabled" : "agent.bridge.unavailable" } }; }
function hasLocalAgentBridgePrivateField(value) { return value && typeof value === "object" && Object.entries(value).some(([key, child]) => localAgentBridgePrivateFields.has(key) || hasLocalAgentBridgePrivateField(child)); }
function safeLocalAgentBridgeResult(value) {
  try {
    const result = copySubmissionInput(value);
    if (hasLocalAgentBridgePrivateField(result)) return localAgentBridgeFailure();
    if (exactSubmissionObject(result, new Set(["ok", "value"]), ["ok", "value"]) && result.ok === true) return result;
    if (exactSubmissionObject(result, new Set(["ok", "error"]), ["ok", "error"]) && result.ok === false && exactSubmissionObject(result.error, new Set(["code", "status", "messageKey"]), ["code", "status", "messageKey"]) && localAgentBridgeErrors.has(result.error.code) && [400, 404, 503].includes(result.error.status) && localAgentBridgeMessageKeys.has(result.error.messageKey)) return result;
  } catch {}
  return localAgentBridgeFailure();
}
function invokeLocalAgentBridge(channel, input) { return ipcRenderer.invoke(channel, input).then(safeLocalAgentBridgeResult, () => localAgentBridgeFailure()); }
function localAgentBridgeInput(input, fields, required = fields) { const value = copySubmissionInput(input); if (!exactSubmissionObject(value, new Set(fields), required)) invalidSubmissionInput(); return value; }
function validLocalAgentBridgeCall(work) { try { return work(); } catch { return Promise.resolve(localAgentBridgeFailure("INPUT_INVALID")); } }
const localAgentBridge = Object.freeze({
  getLocalAgentBridgeCapability: () => invokeLocalAgentBridge(localAgentBridgeChannels.capability),
  searchLocalAgentBridge: (input) => validLocalAgentBridgeCall(() => invokeLocalAgentBridge(localAgentBridgeChannels.search, localAgentBridgeInput(input, ["kind", "query", "limit", "visibility", "agentId", "sessionId"], ["kind", "query", "limit"]))),
  getLocalAgentBridge: (input) => validLocalAgentBridgeCall(() => invokeLocalAgentBridge(localAgentBridgeChannels.get, localAgentBridgeInput(input, ["kind", "id", "version", "visibility", "agentId", "sessionId"], ["kind", "id"]))),
  planLocalAgentBridge: (input) => validLocalAgentBridgeCall(() => invokeLocalAgentBridge(localAgentBridgeChannels.plan, localAgentBridgeInput(input, ["agentId", "sessionId", "agentProductId", "workflowId", "version", "useId"]))),
  requestLocalAgentBridge: (input) => validLocalAgentBridgeCall(() => invokeLocalAgentBridge(localAgentBridgeChannels.request, localAgentBridgeInput(input, ["agentId", "sessionId", "planId", "capabilityKey", "useId"])))
});

const fixedCliLifecycleChannels = Object.freeze({
  plan: "cli-lifecycle:plan",
  confirm: "cli-lifecycle:confirm",
  apply: "cli-lifecycle:apply",
  status: "cli-lifecycle:status",
  recheck: "cli-lifecycle:recheck"
});
const fixedCliLifecycleErrors = new Set([
  "INPUT_INVALID", "INPUT_TOO_LARGE", "FIXED_PROFILE_UNAVAILABLE",
  "ACTIVE_CATALOG_UNAVAILABLE", "CATALOG_PROFILE_MISMATCH",
  "CATALOG_CAPABILITY_DISABLED", "LIFECYCLE_UNAVAILABLE",
  "OWNED_RECEIPT_REQUIRED", "CONFIRMATION_NOT_ALLOWED",
  "USER_CONFIRMATION_REQUIRED", "CONFIRMATION_REQUIRED",
  "CONFIRMATION_EXPIRED", "OWNED_RECEIPT_REVOKED",
  "FIXED_EXECUTOR_UNAVAILABLE", "FIXED_EXECUTOR_FAILED",
  "APPLY_FAILED", "APPLY_FAILED_ROLLED_BACK"
]);
const fixedCliLifecycleMessageKeys = new Set([
  "cli.lifecycle.invalidInput", "cli.lifecycle.inputTooLarge",
  "cli.lifecycle.unavailable", "cli.lifecycle.catalogUnavailable",
  "cli.lifecycle.catalogMismatch", "cli.lifecycle.capabilityDisabled"
]);
const fixedCliLifecyclePrivateFields = new Set([
  "command", "commands", "args", "env", "environment", "headers",
  "credentials", "credential", "token", "tokens", "secret", "secrets",
  "script", "scripts", "shell", "endpoint", "url", "urls", "path", "paths",
  "cwd", "executable", "receiptId", "directory", "prefix", "productRoot",
  "marker", "managementId", "vault", "identity"
]);
function fixedCliLifecycleFailure(code = "TEMPORARILY_UNAVAILABLE") {
  return {
    ok: false,
    error: {
      code,
      status: code === "INPUT_INVALID" ? 400 : code === "INPUT_TOO_LARGE" ? 413 : 503,
      messageKey: code === "INPUT_INVALID"
        ? "cli.lifecycle.invalidInput"
        : code === "INPUT_TOO_LARGE"
          ? "cli.lifecycle.inputTooLarge"
          : "cli.lifecycle.unavailable"
    }
  };
}
function hasFixedCliLifecyclePrivateField(value) {
  return value && typeof value === "object" && Object.entries(value).some(([key, child]) =>
    fixedCliLifecyclePrivateFields.has(key) || hasFixedCliLifecyclePrivateField(child)
  );
}
function safeFixedCliLifecycleResult(value) {
  try {
    const result = copySubmissionInput(value);
    if (hasFixedCliLifecyclePrivateField(result)) return fixedCliLifecycleFailure();
    if (exactSubmissionObject(result, new Set(["ok", "value"]), ["ok", "value"]) && result.ok === true) return result;
    if (exactSubmissionObject(result, new Set(["ok", "error"]), ["ok", "error"]) && result.ok === false && exactSubmissionObject(result.error, new Set(["code", "status", "messageKey"]), ["code", "status", "messageKey"]) && fixedCliLifecycleErrors.has(result.error.code) && [400, 403, 413, 503].includes(result.error.status) && fixedCliLifecycleMessageKeys.has(result.error.messageKey)) return result;
  } catch {}
  return fixedCliLifecycleFailure();
}
function invokeFixedCliLifecycle(channel, input) {
  return ipcRenderer.invoke(channel, input).then(safeFixedCliLifecycleResult, () => fixedCliLifecycleFailure());
}
function fixedCliLifecycleInput(input, fields) {
  const value = copySubmissionInput(input);
  if (!exactSubmissionObject(value, new Set(fields), fields)) invalidSubmissionInput();
  return value;
}
function validFixedCliLifecycleCall(work) {
  try { return work(); } catch { return Promise.resolve(fixedCliLifecycleFailure("INPUT_INVALID")); }
}
const fixedCliLifecycleBridge = Object.freeze({
  planFixedCliLifecycle: (input) => validFixedCliLifecycleCall(() => invokeFixedCliLifecycle(fixedCliLifecycleChannels.plan, fixedCliLifecycleInput(input, ["productId", "operation", "useId"]))),
  confirmFixedCliLifecycle: (input) => validFixedCliLifecycleCall(() => invokeFixedCliLifecycle(fixedCliLifecycleChannels.confirm, fixedCliLifecycleInput(input, ["planId", "useId", "confirmationId"]))),
  applyFixedCliLifecycle: (input) => validFixedCliLifecycleCall(() => invokeFixedCliLifecycle(fixedCliLifecycleChannels.apply, fixedCliLifecycleInput(input, ["planId", "useId", "confirmationId", "dryRun"]))),
  getFixedCliLifecycleStatus: (input) => validFixedCliLifecycleCall(() => invokeFixedCliLifecycle(fixedCliLifecycleChannels.status, fixedCliLifecycleInput(input, ["productId"]))),
  recheckFixedCliLifecycle: (input) => validFixedCliLifecycleCall(() => invokeFixedCliLifecycle(fixedCliLifecycleChannels.recheck, fixedCliLifecycleInput(input, ["productId"])))
});

const managedDownloadQueueChannels = Object.freeze({
  enqueue: "download:enqueue",
  discoverPackages: "download:discover-packages",
  list: "download:list",
  status: "download:status",
  cancel: "download:cancel",
  retry: "download:retry"
});
const managedDownloadQueuePhases = new Set(["queued", "downloading", "downloaded", "failed", "cancelled"]);
function managedDownloadQueueFailure(code = "DOWNLOAD_QUEUE_REJECTED") {
  return { ok: false, errorCode: code };
}
function managedDownloadQueueArtifact(value) {
  if (!exactSubmissionObject(value, new Set(["url", "fileName", "artifactKind", "mirrors"]), ["url", "fileName"])) invalidSubmissionInput();
  if (!httpsSubmissionUrl(value.url) || typeof value.fileName !== "string" || value.fileName.length > 256 || /[\\\\/]/.test(value.fileName)) invalidSubmissionInput();
  if (value.artifactKind !== undefined && !["exe", "msi", "msix", "zip"].includes(value.artifactKind)) invalidSubmissionInput();
  if (value.mirrors !== undefined && (!Array.isArray(value.mirrors) || value.mirrors.length > 4 || value.mirrors.some((url) => !httpsSubmissionUrl(url)))) invalidSubmissionInput();
  return value;
}
function managedDownloadQueueInput(input, allowArtifact) {
  let value;
  try { value = JSON.parse(JSON.stringify(input)); } catch { invalidSubmissionInput(); }
  const allowed = new Set(allowArtifact ? ["productId", "artifact"] : ["productId"]);
  if (!exactSubmissionObject(value, allowed, ["productId"]) || typeof value.productId !== "string" || !value.productId || value.productId.length > 160) invalidSubmissionInput();
  if (Object.hasOwn(value, "artifact")) managedDownloadQueueArtifact(value.artifact);
  return value;
}
function managedPackageDiscoveryInput(input) {
  if (!Array.isArray(input) || input.length > 128) invalidSubmissionInput();
  const productIds = new Set();
  return input.map((candidate) => {
    const value = managedDownloadQueueInput(candidate, true);
    if (productIds.has(value.productId)) invalidSubmissionInput();
    productIds.add(value.productId);
    return value;
  });
}
function managedDownloadCancelInput(input) {
  let value;
  try { value = JSON.parse(JSON.stringify(input)); } catch { invalidSubmissionInput(); }
  if (!exactSubmissionObject(value, new Set(["productId", "taskId", "confirmed"]), ["productId", "taskId", "confirmed"]) ||
      typeof value.productId !== "string" || !value.productId || value.productId.length > 160 ||
      typeof value.taskId !== "string" || !value.taskId || value.taskId.length > 160 ||
      value.confirmed !== true) invalidSubmissionInput();
  return value;
}
function managedDownloadQueueTask(value) {
  if (!exactSubmissionObject(value, new Set(["taskId", "productId", "profileId", "phase", "progress", "errorCode", "presentation"]), ["taskId", "productId", "profileId", "phase", "progress", "presentation"])) return null;
  if (![value.taskId, value.productId, value.profileId].every((field) => typeof field === "string") || !managedDownloadQueuePhases.has(value.phase)) return null;
  if (!exactSubmissionObject(value.progress, new Set(["receivedBytes", "totalBytes", "bytesPerSecond", "percent"]), ["receivedBytes", "totalBytes", "bytesPerSecond", "percent"])) return null;
  if (![value.progress.receivedBytes, value.progress.totalBytes, value.progress.bytesPerSecond].every(Number.isSafeInteger) || value.progress.percent !== null && !Number.isFinite(value.progress.percent)) return null;
  if (!exactSubmissionObject(value.presentation, new Set(["state", "canCancel", "canRetry"]), ["state", "canCancel", "canRetry"]) ||
      !["active", "failed", "completed"].includes(value.presentation.state) ||
      typeof value.presentation.canCancel !== "boolean" || typeof value.presentation.canRetry !== "boolean") return null;
  return value;
}
function safeManagedDownloadQueueResult(value) {
  if (Array.isArray(value)) {
    const tasks = value.map(managedDownloadQueueTask);
    return tasks.every(Boolean) ? tasks : [];
  }
  if (!exactSubmissionObject(value, new Set(["ok", "reused", "task", "errorCode"]), ["ok"])) return managedDownloadQueueFailure();
  const task = value.task === undefined ? undefined : managedDownloadQueueTask(value.task);
  if (value.task !== undefined && !task) return managedDownloadQueueFailure();
  return value.ok === true
    ? { ok: true, ...(value.reused === true ? { reused: true } : {}), ...(task ? { task } : {}) }
    : managedDownloadQueueFailure(typeof value.errorCode === "string" ? value.errorCode : undefined);
}
function invokeManagedDownloadQueue(channel, input) {
  return ipcRenderer.invoke(channel, input).then(safeManagedDownloadQueueResult, () => managedDownloadQueueFailure());
}
function validManagedDownloadQueueCall(work) {
  try { return work(); } catch { return Promise.resolve(managedDownloadQueueFailure("INPUT_INVALID")); }
}
const managedDownloadQueueBridge = Object.freeze({
  enqueueManagedDownload: (input) => validManagedDownloadQueueCall(() => invokeManagedDownloadQueue(managedDownloadQueueChannels.enqueue, managedDownloadQueueInput(input, true))),
  discoverDownloadedPackages: (input) => validManagedDownloadQueueCall(() => invokeManagedDownloadQueue(managedDownloadQueueChannels.discoverPackages, managedPackageDiscoveryInput(input))),
  listManagedDownloadTasks: () => invokeManagedDownloadQueue(managedDownloadQueueChannels.list),
  getManagedDownloadTaskStatus: (input) => validManagedDownloadQueueCall(() => invokeManagedDownloadQueue(managedDownloadQueueChannels.status, managedDownloadQueueInput(input, false))),
  cancelManagedDownload: (input) => validManagedDownloadQueueCall(() => invokeManagedDownloadQueue(managedDownloadQueueChannels.cancel, managedDownloadCancelInput(input))),
  retryManagedDownload: (input) => validManagedDownloadQueueCall(() => invokeManagedDownloadQueue(managedDownloadQueueChannels.retry, managedDownloadQueueInput(input, true)))
});

contextBridge.exposeInMainWorld("aihubPC", {
  getCatalog: () => ipcRenderer.invoke("catalog:get"),
  scanManagedInventory: () => ipcRenderer.invoke("inventory:scan"),
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  checkSoftwareUpdates: () => ipcRenderer.invoke("software-updates:check"),
  openUpdateDownload: () => ipcRenderer.invoke("update:open-download"),
  listExtensions: () => ipcRenderer.invoke("extension:list"),
  getExtensionStatus: (profileId) =>
    ipcRenderer.invoke("extension:status", profileId),
  installExtension: (profileId) =>
    ipcRenderer.invoke("extension:install", profileId),
  uninstallExtension: (profileId) =>
    ipcRenderer.invoke("extension:uninstall", profileId),
  inspectExtension: (profileId) =>
    ipcRenderer.invoke("extension:inspect", profileId),
  executeExtension: (profileId, action) =>
    ipcRenderer.invoke("extension:execute", profileId, action),
  getIdentity: () => ipcRenderer.invoke("identity:current"),
  requestRegistrationCode: (email) =>
    ipcRenderer.invoke("identity:request-code", email),
  register: (input) => ipcRenderer.invoke("identity:register", input),
  login: invokeIdentityLogin,
  logout: () => ipcRenderer.invoke("identity:logout"),
  listIdentitySessions: () => ipcRenderer.invoke("identity:list-sessions"),
  revokeIdentitySession: (sessionId) =>
    ipcRenderer.invoke("identity:revoke-session", sessionId),
  updateIdentityProfile: (input) =>
    ipcRenderer.invoke("identity:update-profile", input),
  updateIdentityAvatar: (input) =>
    ipcRenderer.invoke("identity:update-avatar", input),
  updateIdentityPhone: (input) =>
    ipcRenderer.invoke("identity:update-phone", input),
  requestIdentityEmailChange: (input) =>
    ipcRenderer.invoke("identity:request-email-change", input),
  completeIdentityEmailChange: (input) =>
    ipcRenderer.invoke("identity:complete-email-change", input),
  changeIdentityPassword: (input) =>
    ipcRenderer.invoke("identity:change-password", input),
  getPersonalCenter: () =>
    ipcRenderer.invoke("identity:get-personal-center"),
  ...resourceSubmissionBridge,
  ...workflowStoreBridge,
  ...localAgentBridge,
  ...fixedCliLifecycleBridge,
  ...managedDownloadQueueBridge,
  getIdentityUserByUsername: (username) =>
    ipcRenderer.invoke("identity:get-user-by-username", username),
  listIdentityFollowers: (options) =>
    ipcRenderer.invoke("identity:list-followers", options),
  listIdentityFollowing: (options) =>
    ipcRenderer.invoke("identity:list-following", options),
  followIdentityUser: (userId) =>
    ipcRenderer.invoke("identity:follow-user", userId),
  unfollowIdentityUser: (userId) =>
    ipcRenderer.invoke("identity:unfollow-user", userId),
  listDirectConversations: (options) =>
    ipcRenderer.invoke("identity:list-direct-conversations", options),
  listDirectMessages: (peerUserId, options) =>
    ipcRenderer.invoke("identity:list-direct-messages", peerUserId, options),
  sendDirectMessage: (peerUserId, input) =>
    ipcRenderer.invoke("identity:send-direct-message", peerUserId, input),
  markDirectMessagesRead: (peerUserId, throughMessageId) =>
    ipcRenderer.invoke(
      "identity:mark-direct-messages-read",
      peerUserId,
      throughMessageId
    ),
  markPersonalCenterNotificationRead: (source, notificationId) =>
    ipcRenderer.invoke(
      "identity:mark-personal-center-notification-read",
      source,
      notificationId
    ),
  listSiteMessages: () => ipcRenderer.invoke("identity:list-messages"),
  markSiteMessageRead: (messageId) =>
    ipcRenderer.invoke("identity:mark-message-read", messageId),
  listCommunityInteractions: () =>
    ipcRenderer.invoke("identity:list-community-interactions"),
  setCommunityInteraction: (discussionId, input) =>
    ipcRenderer.invoke(
      "identity:set-community-interaction",
      discussionId,
      input
    ),
  createCommunityEmbedSession: invokeCommunityEmbedSession,
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setLanguage: (language) =>
    ipcRenderer.invoke("settings:set-language", language),
  chooseDownloadDirectory: () =>
    ipcRenderer.invoke("settings:choose-download-directory"),
  chooseCliDirectory: () =>
    ipcRenderer.invoke("settings:choose-cli-directory"),
  openCliDirectory: () =>
    ipcRenderer.invoke("settings:open-cli-directory"),
  openDownloadDirectory: () =>
    ipcRenderer.invoke("settings:open-download-directory"),
  openWindowsUninstallSettings: () =>
    ipcRenderer.invoke("settings:open-windows-uninstall"),
  clearDownloadDirectory: () =>
    ipcRenderer.invoke("settings:clear-download-directory"),
  scanEnvironment: () => ipcRenderer.invoke("environment:scan"),
  openEnvironmentLocation: (environmentId) =>
    ipcRenderer.invoke("environment:open-location", environmentId),
  installEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:install", environmentId),
  updateEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:update", environmentId),
  getEnvironmentPackage: (environmentId) =>
    ipcRenderer.invoke("environment:package-get", environmentId),
  openEnvironmentInstaller: (environmentId) =>
    ipcRenderer.invoke("environment:open-installer", environmentId),
  openEnvironmentUpdater: (environmentId) =>
    ipcRenderer.invoke("environment:open-updater", environmentId),
  getEnvironmentOperation: (environmentId) =>
    ipcRenderer.invoke("environment:operation-get", environmentId),
  checkEnvironmentOperation: (environmentId, generation, operationId) =>
    ipcRenderer.invoke(
      "environment:operation-check",
      environmentId,
      generation,
      operationId
    ),
  uninstallEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:uninstall", environmentId),
  startDownload: (productId, artifact) =>
    ipcRenderer.invoke("download:start", productId, artifact),
  refreshDownload: (productId, artifact) =>
    ipcRenderer.invoke("download:refresh", productId, artifact),
  pauseDownload: (productId) =>
    ipcRenderer.invoke("download:pause", productId),
  cancelDownload: (input) =>
    validManagedDownloadQueueCall(() => ipcRenderer.invoke("download:discard", managedDownloadCancelInput(input))),
  getDownloadTask: (productId) =>
    ipcRenderer.invoke("download:get-task", productId),
  getPartialDownload: (productId) =>
    ipcRenderer.invoke("download:get-partial", productId),
  getDownloadRecord: (productId) =>
    ipcRenderer.invoke("download:get-record", productId),
  showDownloadInFolder: (productId) =>
    ipcRenderer.invoke("download:show-in-folder", productId),
  clearDownloadHistory: (productId) =>
    ipcRenderer.invoke("download:clear-history", productId),
  clearCompletedDownloads: () =>
    ipcRenderer.invoke("download:clear-completed"),
  deleteDownloadedPackage: (productId) =>
    ipcRenderer.invoke("download:delete-package", productId),
  launchInstaller: (productId, intent) =>
    ipcRenderer.invoke("installer:launch", productId, intent),
  getDesktopOperation: (productId) =>
    ipcRenderer.invoke("desktop:operation-get", productId),
  checkDesktopOperation: (productId, generation, operationId) =>
    ipcRenderer.invoke(
      "desktop:operation-check",
      productId,
      generation,
      operationId
    ),
  getDesktopStatus: (productId) =>
    ipcRenderer.invoke("desktop:status", productId),
  updateDesktopProduct: (productId) =>
    ipcRenderer.invoke("desktop:update", productId),
  uninstallDesktopProduct: (productId) =>
    ipcRenderer.invoke("desktop:uninstall", productId),
  openDesktopApp: (productId) =>
    ipcRenderer.invoke("desktop:open", productId),
  openDesktopLocation: (productId) =>
    ipcRenderer.invoke("desktop:open-location", productId),
  closeDesktopApp: (productId) =>
    ipcRenderer.invoke("desktop:close", productId),
  openEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:open", environmentId),
  closeEnvironment: (environmentId) =>
    ipcRenderer.invoke("environment:close", environmentId),
  getCliStatus: (productId) => ipcRenderer.invoke("cli:status", productId),
  openCli: (productId) => ipcRenderer.invoke("cli:open", productId),
  openCliLocation: (productId) =>
    ipcRenderer.invoke("cli:open-location", productId),
  deployCli: (productId) => ipcRenderer.invoke("cli:deploy", productId),
  reconcileCli: (productId, intent) =>
    ipcRenderer.invoke("cli:reconcile", productId, intent),
  uninstallCli: (productId) => ipcRenderer.invoke("cli:uninstall", productId),
  notifyCliTask: (payload) =>
    ipcRenderer.invoke("task-notification:cli", payload),
  updateCliTrayTask: (payload) =>
    ipcRenderer.invoke("tray:update-cli-task", payload),
  onDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("download:progress", listener);
    return () => ipcRenderer.removeListener("download:progress", listener);
  },
  onDownloadTask: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("download:task", listener);
    return () => ipcRenderer.removeListener("download:task", listener);
  },
  onEnvironmentOperation: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("environment:operation", listener);
    return () =>
      ipcRenderer.removeListener("environment:operation", listener);
  },
  onDesktopOperation: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("desktop:operation", listener);
    return () =>
      ipcRenderer.removeListener("desktop:operation", listener);
  },
  onCliLog: (callback) => {
    const listener = (_event, entry) => callback(entry);
    ipcRenderer.on("cli:log", listener);
    return () => ipcRenderer.removeListener("cli:log", listener);
  },
  onTaskNotificationOpen: (callback) => {
    const listener = (_event, target) => callback(target);
    ipcRenderer.on("task-notification:open", listener);
    return () =>
      ipcRenderer.removeListener("task-notification:open", listener);
  }
});
