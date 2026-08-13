"use strict";

const crypto = require("node:crypto");
const {
  DEPENDENCY_PERMISSIONS,
  RESOURCE_BINDING_KINDS,
  WorkflowContractError,
  createCommunityWorkflowStore
} = require("./workflow-store.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PLACEHOLDER_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const PLANNING_DATA_TYPES = new Set(["text", "number", "boolean", "image", "file-reference"]);
const PLANNING_REVIEW_STATUSES = new Set(["automated-reviewed", "manually-reviewed"]);
const PLANNING_RISK_LEVELS = new Set(["low", "guarded"]);
const PLANNING_PERMISSION_SET = new Set(DEPENDENCY_PERMISSIONS);
const PLANNING_BINDING_SET = new Set(RESOURCE_BINDING_KINDS);
const EVENT_OPERATIONS = new Set([
  "createDraft",
  "updateDraft",
  "submitDraft",
  "withdrawDraft",
  "attachPostReference",
  "detachPostReference",
  "reviewSubmission",
  "unlist",
  "reportRelease",
  "resolveReport"
]);
const EVENT_ACTOR_FIELDS = Object.freeze({
  createDraft: "authorIdentityId",
  updateDraft: "authorIdentityId",
  submitDraft: "authorIdentityId",
  withdrawDraft: "authorIdentityId",
  attachPostReference: "authorIdentityId",
  detachPostReference: "authorIdentityId",
  reviewSubmission: "reviewerIdentityId",
  unlist: "reviewerIdentityId",
  reportRelease: "reporterIdentityId",
  resolveReport: "reviewerIdentityId"
});

class WorkflowCandidateError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status) {
  throw new WorkflowCandidateError(code, message, status);
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function frozen(value) {
  return deepFreeze(clone(value));
}

function exact(value, fields, required = fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_INPUT", "request object is invalid");
  }
  const allowed = new Set(fields);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.has(key)) || required.some((key) => !Object.hasOwn(value, key))) {
    fail("INVALID_INPUT", "request fields are invalid");
  }
  return value;
}

function identityId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID_PATTERN.test(id)) fail("AUTHENTICATION_REQUIRED", "identity is invalid", 401);
  return id;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function idempotency(request) {
  const raw = request?.headers?.["idempotency-key"];
  if (typeof raw !== "string" || raw.length < 8 || raw.length > 200 || /[\r\n]/.test(raw)) {
    fail("IDEMPOTENCY_KEY_REQUIRED", "idempotency key is invalid");
  }
  return sha256(raw);
}

function createInMemoryWorkflowRepository() {
  const events = [];
  const keys = new Map();
  return Object.freeze({
    async loadEvents() {
      return clone(events);
    },
    async getIdempotency(actorIdentityId, keyHash) {
      const entry = keys.get(`${actorIdentityId}:${keyHash}`);
      return entry ? clone(entry) : null;
    },
    async commit({ expectedSequence, event, idempotency: entry }) {
      if (events.length !== expectedSequence) {
        fail("REVISION_CONFLICT", "workflow store changed concurrently", 409);
      }
      const key = `${entry.actorIdentityId}:${entry.keyHash}`;
      const existing = keys.get(key);
      if (existing) {
        if (existing.requestHash !== entry.requestHash) {
          fail("IDEMPOTENCY_CONFLICT", "idempotency key was reused", 409);
        }
        return clone(existing.response);
      }
      events.push({ sequence: events.length + 1, ...clone(event) });
      keys.set(key, clone(entry));
      return clone(entry.response);
    }
  });
}

function createPostgresWorkflowRepository({ pool, enabled = false } = {}) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") {
    throw new TypeError("PostgreSQL pool is required");
  }

  function requireEnabled() {
    if (!enabled) fail("FEATURE_DISABLED", "workflow persistence is disabled", 503);
  }

  return Object.freeze({
    async loadEvents() {
      requireEnabled();
      const result = await pool.query(
        `SELECT sequence, operation, actor_identity_id, event_data, created_at
           FROM community_workflow.events
          ORDER BY sequence ASC`
      );
      return result.rows.map((row) => ({
        ...clone(row.event_data),
        sequence: Number(row.sequence),
        operation: row.operation,
        actorIdentityId: row.actor_identity_id,
        at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
      }));
    },
    async getIdempotency(actorIdentityId, keyHash) {
      requireEnabled();
      const result = await pool.query(
        `SELECT request_hash, response
           FROM community_workflow.idempotency
          WHERE actor_identity_id = $1 AND key_hash = $2`,
        [actorIdentityId, keyHash]
      );
      if (result.rowCount === 0) return null;
      return { requestHash: result.rows[0].request_hash, response: clone(result.rows[0].response) };
    },
    async commit({ expectedSequence, event, idempotency: entry }) {
      requireEnabled();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const head = await client.query(
          "SELECT last_sequence FROM community_workflow.event_head WHERE singleton = TRUE FOR UPDATE"
        );
        if (head.rowCount !== 1) fail("CORRUPT_EVENT", "workflow event head is missing", 500);

        const previous = await client.query(
          `SELECT request_hash, response
             FROM community_workflow.idempotency
            WHERE actor_identity_id = $1 AND key_hash = $2`,
          [entry.actorIdentityId, entry.keyHash]
        );
        if (previous.rowCount > 0) {
          if (previous.rows[0].request_hash !== entry.requestHash) {
            fail("IDEMPOTENCY_CONFLICT", "idempotency key was reused", 409);
          }
          await client.query("COMMIT");
          return clone(previous.rows[0].response);
        }

        const currentSequence = Number(head.rows[0].last_sequence);
        if (currentSequence !== expectedSequence) {
          fail("REVISION_CONFLICT", "workflow store changed concurrently", 409);
        }
        const sequence = currentSequence + 1;
        await client.query(
          `INSERT INTO community_workflow.events
             (sequence, operation, actor_identity_id, event_data, created_at)
           VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)`,
          [sequence, event.operation, entry.actorIdentityId, JSON.stringify(event), event.at]
        );
        await client.query(
          `INSERT INTO community_workflow.idempotency
             (actor_identity_id, key_hash, request_hash, response, event_sequence)
           VALUES ($1, $2, $3, $4::jsonb, $5)`,
          [entry.actorIdentityId, entry.keyHash, entry.requestHash, JSON.stringify(entry.response), sequence]
        );
        await client.query(
          "UPDATE community_workflow.event_head SET last_sequence = $1 WHERE singleton = TRUE",
          [sequence]
        );
        await client.query("COMMIT");
        return clone(entry.response);
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw error;
      } finally {
        client.release();
      }
    }
  });
}

function domainSession(events, dependencies) {
  let context = null;
  const store = createCommunityWorkflowStore({
    hasCanonicalDependency: (tuple) => context?.replay === true || dependencies.hasCanonicalDependency(tuple),
    hasCanonicalLicense: (licenseId) => context?.replay === true || dependencies.hasCanonicalLicense(licenseId),
    hasCommunityPost: (postId) => context?.replay === true || dependencies.hasCommunityPost(postId),
    makeId() {
      if (context?.replay) {
        const id = context.generatedIds[context.generatedIndex++];
        if (!id) fail("CORRUPT_EVENT", "workflow event generated ID is missing", 500);
        return id;
      }
      const id = dependencies.makeId();
      context.generatedIds.push(id);
      return id;
    },
    now() {
      return context?.at;
    }
  });

  function invoke(operation, input, { at, generatedIds = [], replay = false } = {}) {
    if (!EVENT_OPERATIONS.has(operation) || typeof store[operation] !== "function") {
      fail("CORRUPT_EVENT", "workflow event operation is invalid", 500);
    }
    context = { at, replay, generatedIds: [...generatedIds], generatedIndex: 0 };
    const result = store[operation](clone(input));
    if (replay && context.generatedIndex !== context.generatedIds.length) {
      fail("CORRUPT_EVENT", "workflow event generated IDs do not match", 500);
    }
    const capturedIds = [...context.generatedIds];
    context = null;
    return { result, generatedIds: capturedIds };
  }

  for (const [index, event] of events.entries()) {
    exact(event, ["sequence", "operation", "actorIdentityId", "input", "at", "generatedIds"]);
    if (event.sequence !== index + 1 || Number.isNaN(Date.parse(event.at))) {
      fail("CORRUPT_EVENT", "workflow event metadata is invalid", 500);
    }
    const actorField = EVENT_ACTOR_FIELDS[event.operation];
    if (!actorField || event.input?.[actorField] !== event.actorIdentityId) {
      fail("CORRUPT_EVENT", "workflow event actor does not match its payload", 500);
    }
    try {
      invoke(event.operation, event.input, { at: event.at, generatedIds: event.generatedIds, replay: true });
    } catch (error) {
      if (error instanceof WorkflowContractError) {
        fail("CORRUPT_EVENT", "workflow event violates the domain contract", 500);
      }
      throw error;
    }
  }
  return Object.freeze({ store, invoke });
}

const INGRESS_FACT_OPERATIONS = new Set(["createDraft", "updateDraft", "attachPostReference"]);

function collectIngressFacts(events, operation, input, at) {
  const dependencies = new Map();
  const licenses = new Set();
  const posts = new Set();
  if (!INGRESS_FACT_OPERATIONS.has(operation)) return { dependencies, licenses, posts };
  const probe = domainSession(events, {
    hasCanonicalDependency(tuple) {
      dependencies.set(stableJson(tuple), frozen(tuple));
      return true;
    },
    hasCanonicalLicense(licenseId) {
      licenses.add(licenseId);
      return true;
    },
    hasCommunityPost(postId) {
      posts.add(postId);
      return true;
    },
    makeId: crypto.randomUUID,
    now: () => at
  });
  probe.invoke(operation, input, { at });
  return { dependencies, licenses, posts };
}

const RESOLVER_TIMEOUT = Symbol("resolver-timeout");

async function requireLiteralTrue(
  resolver,
  value,
  timeoutMs,
  code,
  message,
  { unavailableOnFailure = false } = {}
) {
  let timeout;
  let approved;
  try {
    approved = await Promise.race([
      Promise.resolve().then(() => resolver(frozen(value))),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(RESOLVER_TIMEOUT), timeoutMs);
      })
    ]);
  } catch {
    if (unavailableOnFailure) {
      fail("TEMPORARILY_UNAVAILABLE", "workflow dependency catalog is temporarily unavailable", 503);
    }
    approved = false;
  } finally {
    clearTimeout(timeout);
  }
  if (approved === RESOLVER_TIMEOUT && unavailableOnFailure) {
    fail("TEMPORARILY_UNAVAILABLE", "workflow dependency catalog is temporarily unavailable", 503);
  }
  if (approved !== true) fail(code, message);
}

function approvedDependencies(facts, makeId, now) {
  const dependencyKeys = new Set(facts.dependencies.keys());
  const licenses = new Set(facts.licenses);
  const posts = new Set(facts.posts);
  return {
    hasCanonicalDependency: (tuple) => dependencyKeys.delete(stableJson(tuple)),
    hasCanonicalLicense: (licenseId) => licenses.delete(licenseId),
    hasCommunityPost: (postId) => posts.delete(postId),
    makeId,
    now
  };
}

function ownerDraft(store, draft) {
  const allowedActions = [];
  if (["draft", "rejected", "published"].includes(draft.status)) allowedActions.push("update");
  if (draft.status === "draft") allowedActions.push("submit");
  if (draft.status === "submitted") allowedActions.push("withdraw");
  if (draft.latestReleaseVersion > 0) allowedActions.push("attach-post", "detach-post");
  return frozen({
    workflowId: draft.workflowId,
    expectedRevision: draft.revision,
    status: draft.status,
    sourceCommunityPostId: draft.sourceCommunityPostId,
    provenance: draft.provenance,
    content: draft.content,
    reviewStatus: draft.reviewStatus,
    riskLevel: draft.riskLevel,
    latestReleaseVersion: draft.latestReleaseVersion,
    rejectionReason: draft.rejectionReason,
    postReferences: store.listPostReferences(draft.workflowId),
    allowedActions
  });
}

function page(items, query = {}) {
  const limit = query.limit == null ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail("INVALID_INPUT", "pagination limit is invalid");
  const after = query.after == null ? null : String(query.after);
  const start = after ? items.findIndex((entry) => entry.workflowId === after) + 1 : 0;
  if (after && start === 0) fail("INVALID_INPUT", "pagination cursor is invalid");
  const selected = items.slice(start, start + limit);
  return frozen({ items: selected, next: start + limit < items.length ? selected.at(-1).workflowId : null });
}

async function publicReleaseDto(release, resolvePublicIdentity) {
  const author = await resolvePublicIdentity(release.authorIdentityId);
  if (
    !author ||
    author.identityId !== release.authorIdentityId ||
    typeof author.displayName !== "string" ||
    !author.displayName.trim() ||
    author.displayName.length > 160
  ) {
    fail("PUBLIC_IDENTITY_UNAVAILABLE", "public author identity is unavailable", 503);
  }
  return frozen({
    workflowId: release.workflowId,
    version: release.version,
    author: { identityId: release.authorIdentityId, displayName: author.displayName.trim() },
    sourceCommunityPostId: release.sourceCommunityPostId,
    provenance: {
      originalAuthorIdentityId: release.provenance.originalAuthorIdentityId,
      canonicalSource: release.provenance.canonicalSource,
      licenseId: release.provenance.licenseId,
      derivedFrom: release.provenance.derivedFrom
    },
    content: release.content,
    reviewStatus: release.reviewStatus,
    riskLevel: release.riskLevel,
    requiresPerUseConfirmation: release.requiresPerUseConfirmation,
    releasedAt: release.releasedAt
  });
}

function projectionObject(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  const keys = Object.keys(value);
  return (prototype === Object.prototype || prototype === null) &&
    keys.length === fields.length &&
    keys.every((field) => fields.includes(field));
}

function planningText(value, maximum) {
  return typeof value === "string" && value === value.trim() &&
    value.length > 0 && value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function planningFields(entries, kind) {
  if (!Array.isArray(entries) || entries.length > 32) return null;
  const fields = kind === "input"
    ? ["name", "type", "required", "description"]
    : ["name", "type", "description"];
  const names = new Set();
  const result = [];
  for (const entry of entries) {
    if (!projectionObject(entry, fields) ||
        typeof entry.name !== "string" || !FIELD_NAME_PATTERN.test(entry.name) ||
        names.has(entry.name) || !PLANNING_DATA_TYPES.has(entry.type) ||
        planningText(entry.description, 240) === null ||
        (kind === "input" && typeof entry.required !== "boolean")) return null;
    names.add(entry.name);
    result.push(kind === "input"
      ? { name: entry.name, type: entry.type, required: entry.required, description: entry.description }
      : { name: entry.name, type: entry.type, description: entry.description });
  }
  return result;
}

function planningDependencies(entries) {
  if (!Array.isArray(entries) || entries.length > 32) return null;
  const keys = new Set();
  const result = [];
  for (const entry of entries) {
    if (!entry || (entry.kind !== "product" && entry.kind !== "resource")) return null;
    const fields = entry.kind === "product"
      ? ["kind", "canonicalId", "permissions"]
      : ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"];
    if (!projectionObject(entry, fields) || typeof entry.canonicalId !== "string" ||
        !CANONICAL_ID_PATTERN.test(entry.canonicalId) || !Array.isArray(entry.permissions) ||
        entry.permissions.length < 1 || entry.permissions.length > DEPENDENCY_PERMISSIONS.length ||
        new Set(entry.permissions).size !== entry.permissions.length ||
        entry.permissions.some((permission) => !PLANNING_PERMISSION_SET.has(permission)) ||
        (entry.permissions.includes("none") && entry.permissions.length !== 1)) return null;
    const dependency = {
      kind: entry.kind,
      canonicalId: entry.canonicalId,
      permissions: [...entry.permissions]
    };
    if (entry.kind === "resource") {
      if (typeof entry.hostProductId !== "string" || !CANONICAL_ID_PATTERN.test(entry.hostProductId) ||
          !PLANNING_BINDING_SET.has(entry.bindingKind)) return null;
      dependency.hostProductId = entry.hostProductId;
      dependency.bindingKind = entry.bindingKind;
    }
    const key = [
      dependency.kind,
      dependency.canonicalId,
      dependency.hostProductId || "",
      dependency.bindingKind || ""
    ].join("\u0000");
    if (keys.has(key)) return null;
    keys.add(key);
    result.push(dependency);
  }
  return result;
}

function planningSecretPlaceholders(entries) {
  if (!Array.isArray(entries) || entries.length > 16) return null;
  const names = new Set();
  const result = [];
  for (const entry of entries) {
    if (!projectionObject(entry, ["name", "description"]) || typeof entry.name !== "string" ||
        !PLACEHOLDER_PATTERN.test(entry.name) || names.has(entry.name) ||
        planningText(entry.description, 240) === null) return null;
    names.add(entry.name);
    result.push({ name: entry.name, description: entry.description });
  }
  return result;
}

function planningReleaseDto(release) {
  if (!release || typeof release !== "object" || !UUID_PATTERN.test(release.workflowId) ||
      !Number.isSafeInteger(release.version) || release.version < 1 ||
      !PLANNING_REVIEW_STATUSES.has(release.reviewStatus) ||
      !PLANNING_RISK_LEVELS.has(release.riskLevel) ||
      !projectionObject(release.content, [
        "title", "summary", "inputs", "outputs", "instructions", "dependencies", "secretPlaceholders"
      ])) return null;
  const title = planningText(release.content.title, 120);
  const summary = planningText(release.content.summary, 500);
  const inputs = planningFields(release.content.inputs, "input");
  const outputs = planningFields(release.content.outputs, "output");
  const dependencies = planningDependencies(release.content.dependencies);
  const secretPlaceholders = planningSecretPlaceholders(release.content.secretPlaceholders);
  if (!title || !summary || !inputs || !outputs || !dependencies || !secretPlaceholders ||
      !Array.isArray(release.content.instructions) ||
      release.content.instructions.length < 1 || release.content.instructions.length > 32) return null;
  const instructions = release.content.instructions.map((instruction) => planningText(instruction, 1000));
  if (instructions.some((instruction) => instruction === null)) return null;
  return frozen({
    workflowId: release.workflowId.toLowerCase(),
    version: release.version,
    reviewStatus: release.reviewStatus,
    riskLevel: release.riskLevel,
    content: { title, summary, inputs, outputs, instructions, dependencies, secretPlaceholders }
  });
}

function planningReference(value) {
  if (!projectionObject(value, ["workflowId", "version"])) return null;
  const workflowId = typeof value.workflowId === "string" ? value.workflowId.trim() : "";
  return UUID_PATTERN.test(workflowId) && Number.isSafeInteger(value.version) && value.version > 0
    ? { workflowId: workflowId.toLowerCase(), version: value.version }
    : null;
}

function createCommunityWorkflowCandidate({
  enabled = false,
  repository,
  resolveOwnerIdentity,
  resolveReviewerIdentity,
  resolvePublicIdentity,
  hasCanonicalDependency = () => false,
  hasCanonicalLicense = () => false,
  hasCommunityPost = () => false,
  resolverTimeoutMs = 2000,
  makeId = crypto.randomUUID,
  now = () => new Date().toISOString()
} = {}) {
  if (
    !repository ||
    typeof repository.loadEvents !== "function" ||
    typeof repository.getIdempotency !== "function" ||
    typeof repository.commit !== "function" ||
    typeof resolveOwnerIdentity !== "function" ||
    typeof resolveReviewerIdentity !== "function" ||
    typeof resolvePublicIdentity !== "function" ||
    typeof hasCanonicalDependency !== "function" ||
    typeof hasCanonicalLicense !== "function" ||
    typeof hasCommunityPost !== "function"
  ) {
    throw new TypeError("workflow candidate dependencies are required");
  }
  if (!Number.isSafeInteger(resolverTimeoutMs) || resolverTimeoutMs < 1 || resolverTimeoutMs > 30_000) {
    throw new TypeError("workflow resolver timeout is invalid");
  }
  const replayDependencies = {
    hasCanonicalDependency: () => false,
    hasCanonicalLicense: () => false,
    hasCommunityPost: () => false,
    makeId,
    now
  };

  async function validateIngressFacts(events, operation, input, at) {
    const facts = collectIngressFacts(events, operation, input, at);
    for (const tuple of facts.dependencies.values()) {
      await requireLiteralTrue(
        hasCanonicalDependency,
        tuple,
        resolverTimeoutMs,
        "DEPENDENCY_NOT_FOUND",
        "workflow dependency was not approved",
        { unavailableOnFailure: true }
      );
    }
    for (const licenseId of facts.licenses) {
      await requireLiteralTrue(
        hasCanonicalLicense,
        licenseId,
        resolverTimeoutMs,
        "LICENSE_NOT_FOUND",
        "workflow license was not approved"
      );
    }
    for (const postId of facts.posts) {
      await requireLiteralTrue(
        hasCommunityPost,
        postId,
        resolverTimeoutMs,
        "COMMUNITY_POST_NOT_FOUND",
        "Flarum post was not found"
      );
    }
    return facts;
  }

  function requireEnabled() {
    if (!enabled) fail("FEATURE_DISABLED", "workflow store is disabled", 503);
  }

  async function readStore() {
    requireEnabled();
    const events = await repository.loadEvents();
    return domainSession(events, replayDependencies).store;
  }

  async function mutate({ request, actorIdentityId, operation, input, expectedRevision, response }) {
    requireEnabled();
    const actor = identityId(actorIdentityId);
    input = frozen(input);
    const keyHash = idempotency(request);
    const requestHash = sha256(stableJson({ operation, input, expectedRevision }));
    const previous = await repository.getIdempotency(actor, keyHash);
    if (previous) {
      if (previous.requestHash !== requestHash) fail("IDEMPOTENCY_CONFLICT", "idempotency key was reused", 409);
      return frozen(previous.response);
    }
    const events = await repository.loadEvents();
    let session;
    let invoked;
    try {
      session = domainSession(events, replayDependencies);
      if (expectedRevision !== undefined) {
        const draft = session.store.getDraft(input.workflowId);
        if (draft.revision !== expectedRevision) fail("REVISION_CONFLICT", "workflow draft changed", 409);
      }
      const at = String(now());
      if (Number.isNaN(Date.parse(at))) fail("INVALID_INPUT", "time source is invalid");
      const facts = await validateIngressFacts(events, operation, input, at);
      session = domainSession(events, approvedDependencies(facts, makeId, now));
      invoked = session.invoke(operation, input, { at });
      const result = frozen(response(session.store, invoked.result));
      const event = {
        operation,
        actorIdentityId: actor,
        input,
        at,
        generatedIds: invoked.generatedIds
      };
      return frozen(await repository.commit({
        expectedSequence: events.length,
        event,
        idempotency: { actorIdentityId: actor, keyHash, requestHash, response: result }
      }));
    } catch (error) {
      if (error instanceof WorkflowContractError) {
        throw new WorkflowCandidateError(error.code, error.message, error.code === "NOT_FOUND" ? 404 : 400);
      }
      throw error;
    }
  }

  async function ownerIdentity(request) {
    return identityId(await resolveOwnerIdentity(request));
  }

  async function reviewerIdentity(request) {
    return identityId(await resolveReviewerIdentity(request));
  }

  const owner = Object.freeze({
    async create(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["sourceCommunityPostId", "provenance", "content"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "createDraft",
        input: { authorIdentityId: actor, ...body },
        response: (store, draft) => ownerDraft(store, draft)
      });
    },
    async update(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["workflowId", "expectedRevision", "content"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "updateDraft",
        input: { workflowId: body.workflowId, authorIdentityId: actor, content: body.content },
        expectedRevision: body.expectedRevision,
        response: (store, draft) => ownerDraft(store, draft)
      });
    },
    async submit(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["workflowId", "expectedRevision"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "submitDraft",
        input: { workflowId: body.workflowId, authorIdentityId: actor },
        expectedRevision: body.expectedRevision,
        response: (store, draft) => ownerDraft(store, draft)
      });
    },
    async withdraw(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["workflowId", "expectedRevision"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "withdrawDraft",
        input: { workflowId: body.workflowId, authorIdentityId: actor, expectedRevision: body.expectedRevision },
        expectedRevision: body.expectedRevision,
        response: (store, draft) => ownerDraft(store, draft)
      });
    },
    async attachPost(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["workflowId", "version", "communityPostId", "expectedRevision"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "attachPostReference",
        input: { ...body, authorIdentityId: actor },
        expectedRevision: body.expectedRevision,
        response: (store, result) => ({ draft: ownerDraft(store, result.draft), postReference: result.postReference })
      });
    },
    async detachPost(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["workflowId", "version", "communityPostId", "expectedRevision"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "detachPostReference",
        input: { ...body, authorIdentityId: actor },
        expectedRevision: body.expectedRevision,
        response: (store, result) => ({ draft: ownerDraft(store, result.draft), postReference: null })
      });
    },
    async report(request) {
      const actor = await ownerIdentity(request);
      const body = exact(request?.body, ["workflowId", "version", "reason"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "reportRelease",
        input: { ...body, reporterIdentityId: actor },
        response: (_store, report) => ({
          reportId: report.reportId,
          workflowId: report.workflowId,
          version: report.version,
          status: report.status,
          createdAt: report.createdAt
        })
      });
    },
    async list(request) {
      const actor = await ownerIdentity(request);
      const store = await readStore();
      const items = store.listDrafts()
        .filter((draft) => draft.authorIdentityId === actor)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.workflowId.localeCompare(left.workflowId))
        .map((draft) => ownerDraft(store, draft));
      return page(items, request?.query);
    },
    async get(request) {
      const actor = await ownerIdentity(request);
      const query = exact(request?.query, ["workflowId"]);
      const store = await readStore();
      let draft;
      try {
        draft = store.getDraft(query.workflowId);
      } catch {
        fail("NOT_FOUND", "workflow draft was not found", 404);
      }
      if (draft.authorIdentityId !== actor) fail("NOT_FOUND", "workflow draft was not found", 404);
      return ownerDraft(store, draft);
    }
  });

  const reviewer = Object.freeze({
    async review(request) {
      const actor = await reviewerIdentity(request);
      const body = exact(
        request?.body,
        ["workflowId", "expectedRevision", "decision", "reviewStatus", "riskLevel", "reason"],
        ["workflowId", "expectedRevision", "decision", "reviewStatus", "riskLevel"]
      );
      const input = {
        workflowId: body.workflowId,
        reviewerIdentityId: actor,
        decision: body.decision,
        reviewStatus: body.reviewStatus,
        riskLevel: body.riskLevel,
        ...(body.reason === undefined ? {} : { reason: body.reason })
      };
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "reviewSubmission",
        input,
        expectedRevision: body.expectedRevision,
        response: (_store, result) => result
      });
    },
    async unlist(request) {
      const actor = await reviewerIdentity(request);
      const body = exact(request?.body, ["workflowId", "reason"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "unlist",
        input: { ...body, reviewerIdentityId: actor },
        response: (_store, listing) => listing
      });
    },
    async resolveReport(request) {
      const actor = await reviewerIdentity(request);
      const body = exact(request?.body, ["reportId", "decision", "reason"]);
      return mutate({
        request,
        actorIdentityId: actor,
        operation: "resolveReport",
        input: { ...body, reviewerIdentityId: actor },
        response: (_store, result) => result
      });
    },
    async listReports(request = {}) {
      await reviewerIdentity(request);
      const query = exact(request.query || {}, ["status", "limit", "after"], []);
      const store = await readStore();
      const status = query.status == null ? null : String(query.status);
      if (status !== null && !["pending", "dismissed", "resolved"].includes(status)) {
        fail("INVALID_INPUT", "report status is invalid");
      }
      const reports = store.listReports()
        .filter((report) => status === null || report.status === status)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.reportId.localeCompare(left.reportId));
      const limit = query.limit == null ? 20 : Number(query.limit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail("INVALID_INPUT", "pagination limit is invalid");
      const after = query.after == null ? null : String(query.after);
      const start = after ? reports.findIndex((entry) => entry.reportId === after) + 1 : 0;
      if (after && start === 0) fail("INVALID_INPUT", "pagination cursor is invalid");
      const items = reports.slice(start, start + limit);
      return frozen({ items, next: start + limit < reports.length ? items.at(-1).reportId : null });
    }
  });

  async function publishedStore(workflowId) {
    const store = await readStore();
    let listing;
    try {
      listing = store.getListing(workflowId);
    } catch {
      fail("NOT_FOUND", "published workflow was not found", 404);
    }
    if (listing.status !== "published" || listing.publiclyVisible !== true || !["low", "guarded"].includes(listing.riskLevel)) {
      fail("NOT_FOUND", "published workflow was not found", 404);
    }
    return { store, listing };
  }

  async function resolvePlanningRelease(reference) {
    if (!enabled) return null;
    const requested = planningReference(reference);
    if (!requested) return null;
    try {
      const { store, listing } = await publishedStore(requested.workflowId);
      if (
        listing.version !== requested.version ||
        !PLANNING_REVIEW_STATUSES.has(listing.reviewStatus) ||
        !PLANNING_RISK_LEVELS.has(listing.riskLevel)
      ) return null;
      const release = store.getRelease(requested.workflowId, requested.version);
      if (
        release.reviewStatus !== listing.reviewStatus ||
        release.riskLevel !== listing.riskLevel
      ) return null;
      return planningReleaseDto(release);
    } catch {
      return null;
    }
  }

  const publicRead = Object.freeze({
    async get(request) {
      const query = exact(request?.query, ["workflowId", "version"], ["workflowId"]);
      const { store, listing } = await publishedStore(query.workflowId);
      const version = query.version == null ? listing.version : Number(query.version);
      let release;
      try {
        release = store.getRelease(listing.workflowId, version);
      } catch {
        fail("NOT_FOUND", "published workflow release was not found", 404);
      }
      return publicReleaseDto(release, resolvePublicIdentity);
    },
    async history(request) {
      const query = exact(request?.query, ["workflowId"]);
      const { store, listing } = await publishedStore(query.workflowId);
      return frozen(await Promise.all(store.listReleases(listing.workflowId).map((release) => publicReleaseDto(release, resolvePublicIdentity))));
    },
    async list(request = {}) {
      const store = await readStore();
      const listings = store.listListings()
        .filter((listing) => listing.status === "published" && listing.publiclyVisible === true && ["low", "guarded"].includes(listing.riskLevel))
        .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || right.workflowId.localeCompare(left.workflowId));
      const releases = await Promise.all(listings.map((listing) => publicReleaseDto(store.getRelease(listing.workflowId, listing.version), resolvePublicIdentity)));
      return page(releases, request.query);
    }
  });

  return Object.freeze({
    capability() {
      return frozen({ enabled: Boolean(enabled), schemaVersion: 1, execution: false, workflowSubmissionLookup: false });
    },
    owner,
    reviewer,
    public: publicRead,
    resolvePlanningRelease,
    async lookupPublishedRelease(reference) {
      return (await resolvePlanningRelease(reference)) !== null;
    }
  });
}

function createCommunityWorkflowHttpHandler({ candidate } = {}) {
  if (!candidate || typeof candidate.capability !== "function") {
    throw new TypeError("workflow candidate is required");
  }
  const routes = new Map([
    ["GET /v1/community/workflow-store/capability", { call: () => candidate.capability(), status: 200 }],
    ["POST /v1/community/workflow-store/owner/drafts", { call: (request) => candidate.owner.create(request), status: 201 }],
    ["POST /v1/community/workflow-store/owner/drafts/update", { call: (request) => candidate.owner.update(request), status: 200 }],
    ["POST /v1/community/workflow-store/owner/drafts/submit", { call: (request) => candidate.owner.submit(request), status: 200 }],
    ["POST /v1/community/workflow-store/owner/drafts/withdraw", { call: (request) => candidate.owner.withdraw(request), status: 200 }],
    ["POST /v1/community/workflow-store/owner/posts/attach", { call: (request) => candidate.owner.attachPost(request), status: 200 }],
    ["POST /v1/community/workflow-store/owner/posts/detach", { call: (request) => candidate.owner.detachPost(request), status: 200 }],
    ["POST /v1/community/workflow-store/owner/reports", { call: (request) => candidate.owner.report(request), status: 201 }],
    ["GET /v1/community/workflow-store/owner/drafts", { call: (request) => candidate.owner.list(request), status: 200 }],
    ["GET /v1/community/workflow-store/owner/draft", { call: (request) => candidate.owner.get(request), status: 200 }],
    ["POST /v1/community/workflow-store/reviewer/review", { call: (request) => candidate.reviewer.review(request), status: 200 }],
    ["POST /v1/community/workflow-store/reviewer/unlist", { call: (request) => candidate.reviewer.unlist(request), status: 200 }],
    ["POST /v1/community/workflow-store/reviewer/reports/resolve", { call: (request) => candidate.reviewer.resolveReport(request), status: 200 }],
    ["GET /v1/community/workflow-store/reviewer/reports", { call: (request) => candidate.reviewer.listReports(request), status: 200 }],
    ["GET /v1/community/workflow-store/public/list", { call: (request) => candidate.public.list(request), status: 200 }],
    ["GET /v1/community/workflow-store/public/release", { call: (request) => candidate.public.get(request), status: 200 }],
    ["GET /v1/community/workflow-store/public/history", { call: (request) => candidate.public.history(request), status: 200 }]
  ]);

  return Object.freeze({
    async handle(request) {
      const method = typeof request?.method === "string" ? request.method.toUpperCase() : "";
      const path = typeof request?.path === "string" ? request.path : "";
      const route = routes.get(`${method} ${path}`);
      if (!route) return frozen({ status: 404, body: { error: { code: "NOT_FOUND", status: 404 } } });
      const mediaType = String(request?.headers?.["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
      if (method === "POST" && mediaType !== "application/json") {
        return frozen({ status: 415, body: { error: { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 } } });
      }
      try {
        return frozen({ status: route.status, body: await route.call(request) });
      } catch (error) {
        if (error instanceof WorkflowCandidateError) {
          return frozen({ status: error.status, body: { error: { code: error.code, status: error.status } } });
        }
        throw error;
      }
    }
  });
}

module.exports = {
  WorkflowCandidateError,
  createCommunityWorkflowCandidate,
  createInMemoryWorkflowRepository,
  createPostgresWorkflowRepository,
  createCommunityWorkflowHttpHandler
};
