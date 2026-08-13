"use strict";

const MAX_IPC_BYTES = 128 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBMISSION_KINDS = new Set([
  "vendor",
  "agent",
  "skill",
  "mcp",
  "plugin",
  "connector",
  "workflow"
]);
const SUBMISSION_STATUSES = new Set([
  "draft",
  "submitted",
  "triaged",
  "needs-evidence",
  "accepted",
  "rejected",
  "withdrawn",
  "merged"
]);
const SAFE_ERROR_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "FEATURE_DISABLED",
  "INVALID_IDENTITY_RESPONSE",
  "INVALID_INPUT",
  "INVALID_RESOURCE_SUBMISSION",
  "NOT_FOUND",
  "RATE_LIMITED",
  "REVISION_CONFLICT",
  "TEMPORARILY_UNAVAILABLE"
]);
const SAFE_ERROR_STATUSES = new Set([400, 401, 404, 409, 429, 502, 503]);
const PROPOSAL_FIELDS = new Set([
  "submissionKind",
  "title",
  "summary",
  "originalAuthorIdentityId",
  "originalAuthor",
  "organization",
  "ownershipClaim",
  "canonicalSource",
  "licenseId",
  "sourceRevision",
  "catalogReferences",
  "hostTuples",
  "platforms",
  "scenarioTags",
  "rawTags",
  "agentCompatibility",
  "evidenceRefs",
  "discoveredVia",
  "workflowRef"
]);
const FORBIDDEN_FIELDS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "command",
  "args",
  "env",
  "headers",
  "credentials",
  "script",
  "secret",
  "endpoint",
  "path",
  "url",
  "vaultRef",
  "reviewerId",
  "reviewedBy",
  "reviewStatus",
  "risk",
  "riskLevel",
  "merge",
  "mergeIntoSubmissionId",
  "publicEligibility",
  "fingerprint",
  "dedupeFingerprint",
  "possibleDuplicateSubmissionIds",
  "internalNotes",
  "audit"
]);

const CHANNELS = Object.freeze({
  capability: "identity:get-submission-capability",
  create: "identity:create-submission",
  list: "identity:list-own-submissions",
  get: "identity:get-own-submission",
  update: "identity:update-submission-draft",
  submit: "identity:submit-submission",
  evidence: "identity:add-submission-evidence",
  withdraw: "identity:withdraw-submission"
});

class ResourceSubmissionIpcError extends Error {
  constructor(message, status = 400, code = "INVALID_INPUT") {
    super(message);
    this.name = "ResourceSubmissionIpcError";
    this.status = status;
    this.code = code;
  }
}

function fail(message = "投稿请求无效") {
  throw new ResourceSubmissionIpcError(message);
}

function plainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}

function exact(value, fields, required = []) {
  return (
    plainRecord(value) &&
    Object.keys(value).every((key) => fields.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function assertSafeTree(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) fail();
  seen.add(value);
  if (!Array.isArray(value) && !plainRecord(value)) fail();
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_FIELDS.has(key)) fail();
    assertSafeTree(value[key], seen);
  }
  seen.delete(value);
}

function cloneWithinLimit(value) {
  assertSafeTree(value);
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch {
    fail();
  }
  if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_IPC_BYTES) {
    fail("投稿请求过大");
  }
  return structuredClone(value);
}

function boundedText(value, maximum) {
  return typeof value === "string" && value.trim() && value.length <= maximum;
}

function httpsUrl(value) {
  if (!boundedText(value, 2048)) return false;
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash &&
      parsed.toString() === value
    );
  } catch {
    return false;
  }
}

function textArray(value, maximum = 21) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= maximum &&
      value.every((item) => boundedText(item, 2048)))
  );
}

function validateProposal(input, { allowWorkflow = false } = {}) {
  const proposal = cloneWithinLimit(input);
  if (
    !exact(
      proposal,
      PROPOSAL_FIELDS,
      ["submissionKind", "title", "summary", "canonicalSource"]
    ) ||
    !SUBMISSION_KINDS.has(proposal.submissionKind) ||
    (!allowWorkflow && proposal.submissionKind === "workflow") ||
    !boundedText(proposal.title, 160) ||
    !boundedText(proposal.summary, 1000) ||
    !httpsUrl(proposal.canonicalSource)
  ) {
    fail();
  }
  for (const field of [
    "originalAuthor",
    "organization",
    "licenseId",
    "sourceRevision",
    "discoveredVia"
  ]) {
    if (proposal[field] !== undefined && proposal[field] !== null && !boundedText(proposal[field], 160)) {
      fail();
    }
  }
  if (
    proposal.originalAuthorIdentityId !== undefined &&
    proposal.originalAuthorIdentityId !== null &&
    !UUID_PATTERN.test(proposal.originalAuthorIdentityId)
  ) {
    fail();
  }
  for (const field of [
    "platforms",
    "scenarioTags",
    "rawTags",
    "agentCompatibility"
  ]) {
    if (!textArray(proposal[field])) fail();
  }
  if (
    proposal.evidenceRefs !== undefined &&
    (!Array.isArray(proposal.evidenceRefs) ||
      proposal.evidenceRefs.length > 21 ||
      !proposal.evidenceRefs.every(httpsUrl))
  ) {
    fail();
  }
  if (
    proposal.ownershipClaim !== undefined &&
    proposal.ownershipClaim !== null &&
    (!exact(
      proposal.ownershipClaim,
      new Set(["kind", "evidenceRefs"]),
      ["kind", "evidenceRefs"]
    ) ||
      !["author", "organization"].includes(proposal.ownershipClaim.kind) ||
      !Array.isArray(proposal.ownershipClaim.evidenceRefs) ||
      proposal.ownershipClaim.evidenceRefs.length < 1 ||
      proposal.ownershipClaim.evidenceRefs.length > 8 ||
      !proposal.ownershipClaim.evidenceRefs.every(httpsUrl))
  ) {
    fail();
  }
  if (
    proposal.catalogReferences !== undefined &&
    (!Array.isArray(proposal.catalogReferences) ||
      proposal.catalogReferences.length > 21 ||
      !proposal.catalogReferences.every((item) =>
        exact(
          item,
          new Set(["kind", "canonicalId", "hostProductId"]),
          ["kind", "canonicalId"]
        )
      ))
  ) {
    fail();
  }
  if (
    proposal.hostTuples !== undefined &&
    (!Array.isArray(proposal.hostTuples) ||
      proposal.hostTuples.length > 21 ||
      !proposal.hostTuples.every((item) =>
        exact(
          item,
          new Set(["kind", "canonicalId", "hostProductId", "bindingKind"]),
          ["kind", "canonicalId", "hostProductId", "bindingKind"]
        )
      ))
  ) {
    fail();
  }
  if (proposal.submissionKind === "workflow") {
    if (
      !exact(
        proposal.workflowRef,
        new Set(["workflowId", "version"]),
        ["workflowId", "version"]
      )
    ) {
      fail();
    }
  } else if (proposal.workflowRef !== undefined && proposal.workflowRef !== null) {
    fail();
  }
  return proposal;
}

function submissionId(value) {
  if (!UUID_PATTERN.test(String(value || ""))) fail();
  return value;
}

function revision(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail();
  return value;
}

function invalidIdentityResponse(message) {
  return new ResourceSubmissionIpcError(
    message,
    502,
    "INVALID_IDENTITY_RESPONSE"
  );
}

function validateCapability(value) {
  let capability;
  try {
    capability = cloneWithinLimit(value);
  } catch {
    throw invalidIdentityResponse("投稿能力响应无效");
  }
  if (
    !exact(
      capability,
      new Set([
        "enabled",
        "supportedKinds",
        "temporarilyUnavailableKinds",
        "authenticationRequired",
        "proposalSchemaVersion"
      ]),
      ["enabled", "supportedKinds", "authenticationRequired", "proposalSchemaVersion"]
    ) ||
    typeof capability.enabled !== "boolean" ||
    capability.authenticationRequired !== true ||
    capability.proposalSchemaVersion !== 1 ||
    !Array.isArray(capability.supportedKinds) ||
    !capability.supportedKinds.every((kind) => SUBMISSION_KINDS.has(kind)) ||
    (capability.temporarilyUnavailableKinds !== undefined &&
      (!Array.isArray(capability.temporarilyUnavailableKinds) ||
        !capability.temporarilyUnavailableKinds.every((kind) => SUBMISSION_KINDS.has(kind))))
  ) {
    throw invalidIdentityResponse("投稿能力响应无效");
  }
  return capability;
}

function validateOwnerSubmission(value) {
  let owner;
  try {
    owner = cloneWithinLimit(value);
  } catch {
    throw invalidIdentityResponse("投稿响应无效");
  }
  if (
    !exact(
      owner,
      new Set([
        "submissionId",
        "expectedRevision",
        "status",
        "proposal",
        "allowedActions",
        "evidenceRequired"
      ]),
      [
        "submissionId",
        "expectedRevision",
        "status",
        "proposal",
        "allowedActions",
        "evidenceRequired"
      ]
    ) ||
    !UUID_PATTERN.test(owner.submissionId) ||
    !Number.isSafeInteger(owner.expectedRevision) ||
    owner.expectedRevision < 1 ||
    !SUBMISSION_STATUSES.has(owner.status) ||
    !Array.isArray(owner.allowedActions) ||
    !owner.allowedActions.every((action) =>
      ["update", "submit", "evidence", "withdraw"].includes(action)
    ) ||
    typeof owner.evidenceRequired !== "boolean"
  ) {
    throw invalidIdentityResponse("投稿响应无效");
  }
  try {
    validateProposal(owner.proposal, { allowWorkflow: true });
  } catch {
    throw invalidIdentityResponse("投稿响应无效");
  }
  return owner;
}

function validateOwnerPage(value) {
  let page;
  try {
    page = cloneWithinLimit(value);
  } catch {
    throw invalidIdentityResponse("投稿列表响应无效");
  }
  if (
    !exact(page, new Set(["items", "page"]), ["items", "page"]) ||
    !Array.isArray(page.items) ||
    !exact(page.page, new Set(["offset", "limit", "nextOffset"]), ["offset", "limit", "nextOffset"]) ||
    !Number.isSafeInteger(page.page.offset) || page.page.offset < 0 ||
    !Number.isSafeInteger(page.page.limit) || page.page.limit < 1 || page.page.limit > 100 ||
    (page.page.nextOffset !== null &&
      (!Number.isSafeInteger(page.page.nextOffset) || page.page.nextOffset < 0))
  ) {
    throw invalidIdentityResponse("投稿列表响应无效");
  }
  return {
    items: page.items.map(validateOwnerSubmission),
    page: page.page
  };
}

function validateCreate(input) {
  const value = cloneWithinLimit(input);
  if (
    !exact(value, new Set(["idempotencyKey", "submission"]), ["idempotencyKey", "submission"]) ||
    !boundedText(value.idempotencyKey, 160)
  ) {
    fail();
  }
  return {
    idempotencyKey: value.idempotencyKey,
    submission: validateProposal(value.submission)
  };
}

function validateList(input = {}) {
  const value = cloneWithinLimit(input);
  if (!exact(value, new Set(["offset", "limit"]))) fail();
  for (const field of ["offset", "limit"]) {
    if (
      value[field] !== undefined &&
      (!Number.isSafeInteger(value[field]) || value[field] < 0)
    ) {
      fail();
    }
  }
  if (value.limit !== undefined && (value.limit < 1 || value.limit > 100)) fail();
  return value;
}

function validateGet(input) {
  const value = cloneWithinLimit(input);
  if (!exact(value, new Set(["submissionId"]), ["submissionId"])) fail();
  return { submissionId: submissionId(value.submissionId) };
}

function validateUpdate(input) {
  const value = cloneWithinLimit(input);
  if (
    !exact(
      value,
      new Set(["submissionId", "expectedRevision", "submission"]),
      ["submissionId", "expectedRevision", "submission"]
    )
  ) {
    fail();
  }
  return {
    submissionId: submissionId(value.submissionId),
    expectedRevision: revision(value.expectedRevision),
    submission: validateProposal(value.submission)
  };
}

function validateRevisionAction(input, field) {
  const allowed = new Set(["submissionId", "expectedRevision"]);
  if (field) allowed.add(field);
  const required = [...allowed];
  const value = cloneWithinLimit(input);
  if (!exact(value, allowed, required)) fail();
  const result = {
    submissionId: submissionId(value.submissionId),
    expectedRevision: revision(value.expectedRevision)
  };
  if (field === "evidenceRefs") {
    if (
      !Array.isArray(value.evidenceRefs) ||
      value.evidenceRefs.length < 1 ||
      value.evidenceRefs.length > 21 ||
      !value.evidenceRefs.every(httpsUrl)
    ) {
      fail();
    }
    result.evidenceRefs = value.evidenceRefs;
  }
  return result;
}

function normalizedError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const originalCode = typeof error?.code === "string" ? error.code : "TEMPORARILY_UNAVAILABLE";
  const safeCode = SAFE_ERROR_CODES.has(originalCode)
    ? originalCode
    : "TEMPORARILY_UNAVAILABLE";
  const safeStatus = SAFE_ERROR_STATUSES.has(status) ? status : 503;
  if (status === 401 || ["SESSION_REVOKED", "AUTHENTICATION_REQUIRED"].includes(originalCode)) {
    return {
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
      messageKey: "resources.submit.loginRequired"
    };
  }
  if (originalCode === "FEATURE_DISABLED") {
    return {
      code: "FEATURE_DISABLED",
      status: 503,
      messageKey: "resources.submit.unavailable"
    };
  }
  if (status === 409 || originalCode === "REVISION_CONFLICT") {
    return {
      code: "REVISION_CONFLICT",
      status: 409,
      messageKey: "resources.submit.conflict"
    };
  }
  if (status === 404) {
    return { code: "NOT_FOUND", status: 404, messageKey: "resources.submit.failed" };
  }
  if (status === 429) {
    return {
      code: "RATE_LIMITED",
      status: 429,
      messageKey: "resources.submit.rateLimited"
    };
  }
  if (status === 400) {
    return {
      code: safeCode === "TEMPORARILY_UNAVAILABLE" ? "INVALID_INPUT" : safeCode,
      status: 400,
      messageKey: "resources.submit.invalid"
    };
  }
  return {
    code: safeCode,
    status: safeStatus,
    messageKey:
      safeStatus === 503
        ? "resources.submit.serviceUnavailable"
        : "resources.submit.failed"
  };
}

function success(value) {
  return { ok: true, value };
}

function failure(error) {
  return { ok: false, error: normalizedError(error) };
}

function registerResourceSubmissionIpc(
  ipcMain,
  { getIdentityClient, logError = console.error } = {}
) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle required");
  }
  if (typeof getIdentityClient !== "function") {
    throw new TypeError("getIdentityClient required");
  }

  function handle(channel, validateInput, execute, validateOutput) {
    ipcMain.handle(channel, async (_event, input) => {
      try {
        const validated = validateInput(input);
        const client = getIdentityClient();
        const current = await client.current();
        if (current?.status !== "authenticated") {
          throw new ResourceSubmissionIpcError(
            "authentication required",
            401,
            "AUTHENTICATION_REQUIRED"
          );
        }
        return success(validateOutput(await execute(client, validated)));
      } catch (error) {
        logError("Resource submission IPC failed", {
          channel,
          code: error?.code,
          status: error?.status,
          message: error instanceof Error ? error.message : String(error)
        }, error);
        return failure(error);
      }
    });
  }

  ipcMain.handle(CHANNELS.capability, async () => {
    try {
      return success(
        validateCapability(
          await getIdentityClient().getResourceSubmissionCapability()
        )
      );
    } catch (error) {
      logError("Resource submission IPC failed", {
        channel: CHANNELS.capability,
        code: error?.code,
        status: error?.status,
        message: error instanceof Error ? error.message : String(error)
      }, error);
      return failure(error);
    }
  });
  handle(
    CHANNELS.create,
    validateCreate,
    (client, input) =>
      client.createMyResourceSubmission(input.idempotencyKey, input.submission),
    validateOwnerSubmission
  );
  handle(
    CHANNELS.list,
    validateList,
    (client, input) => client.listMyResourceSubmissions(input),
    validateOwnerPage
  );
  handle(
    CHANNELS.get,
    validateGet,
    (client, input) => client.getMyResourceSubmission(input.submissionId),
    validateOwnerSubmission
  );
  handle(
    CHANNELS.update,
    validateUpdate,
    (client, input) =>
      client.mutateMyResourceSubmission(input.submissionId, {
        action: "update",
        expectedRevision: input.expectedRevision,
        submission: input.submission
      }),
    validateOwnerSubmission
  );
  handle(
    CHANNELS.submit,
    (input) => validateRevisionAction(input),
    (client, input) =>
      client.mutateMyResourceSubmission(input.submissionId, {
        action: "submit",
        expectedRevision: input.expectedRevision
      }),
    validateOwnerSubmission
  );
  handle(
    CHANNELS.evidence,
    (input) => validateRevisionAction(input, "evidenceRefs"),
    (client, input) =>
      client.mutateMyResourceSubmission(input.submissionId, {
        action: "evidence",
        expectedRevision: input.expectedRevision,
        evidenceRefs: input.evidenceRefs
      }),
    validateOwnerSubmission
  );
  handle(
    CHANNELS.withdraw,
    (input) => validateRevisionAction(input),
    (client, input) =>
      client.mutateMyResourceSubmission(input.submissionId, {
        action: "withdraw",
        expectedRevision: input.expectedRevision
      }),
    validateOwnerSubmission
  );
}

module.exports = {
  CHANNELS,
  ResourceSubmissionIpcError,
  registerResourceSubmissionIpc,
  validateCapability,
  validateOwnerSubmission
};
