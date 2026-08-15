"use strict";

const crypto = require("node:crypto");
const {
  ResourceSubmissionError,
  applyResourceSubmissionAction,
  createAsyncWorkflowReleaseValidator,
  createResourceSubmissionRecord,
  resourceSubmissionCatalogMergeCandidate,
  submissionFingerprint
} = require("../admin/resource-submissions.cjs");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message, status, code) {
  throw new ResourceSubmissionError(message, status, code);
}

function exact(value, fields, required = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.every((key) => fields.has(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function identityId(value, field = "identity") {
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) fail(`${field} invalid`);
  return normalized;
}

function boundedText(value, maximum, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maximum) fail(`${field} invalid`);
  return normalized;
}

function boundedInteger(value, maximum, fallback, minimum = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    fail("pagination invalid");
  }
  return number;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function storedRecord(row) {
  if (!row) return null;
  return typeof row.record === "string" ? JSON.parse(row.record) : row.record;
}

function ownerActions(status) {
  if (status === "draft") return Object.freeze(["update", "submit", "withdraw"]);
  if (["submitted", "triaged", "needs-evidence"].includes(status)) {
    return Object.freeze(["evidence", "withdraw"]);
  }
  return Object.freeze([]);
}

function ownerSubmission(record) {
  return Object.freeze({
    submissionId: record.submissionId,
    expectedRevision: record.revision,
    status: record.status,
    proposal: structuredClone(record.proposal),
    allowedActions: ownerActions(record.status),
    evidenceRequired: record.status === "needs-evidence"
  });
}

function validatedWorkflowRelease(proposal) {
  const approved = proposal?.submissionKind === "workflow"
    ? proposal.workflowRef
    : null;
  return (reference) => Boolean(
    approved &&
    reference?.workflowId === approved.workflowId &&
    reference?.version === approved.version
  );
}

function assertEnabled(enabled) {
  if (!enabled) {
    fail("resource submission is unavailable", 503, "FEATURE_DISABLED");
  }
}

async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function appendAudit(client, submissionId, event) {
  await client.query(
    `INSERT INTO resource_submission_audit
       (submission_id, revision, actor_identity_id, actor_kind, action, detail, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      submissionId,
      event.revision,
      event.actorIdentityId,
      event.actorKind,
      event.action,
      JSON.stringify(event.detail),
      event.at
    ]
  );
}

async function appendSourceSnapshots(client, submissionId, before, after) {
  const prior = Array.isArray(before?.sourceSnapshots) ? before.sourceSnapshots.length : 0;
  const snapshots = Array.isArray(after?.sourceSnapshots) ? after.sourceSnapshots.slice(prior) : [];
  for (const source of snapshots) {
    await client.query(
      `INSERT INTO resource_submission_source_revisions
         (submission_id, revision, actor_identity_id, source, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [submissionId, source.revision, source.actorIdentityId, JSON.stringify(source), source.at]
    );
  }
}

async function updateRecord(client, record, previousRevision) {
  const result = await client.query(
    `UPDATE resource_submissions
     SET revision = $2,
         status = $3,
         dedupe_fingerprint = $4,
         record = $5::jsonb,
         public_eligible = $6,
         updated_at = now()
     WHERE submission_id = $1 AND revision = $7`,
    [
      record.submissionId,
      record.revision,
      record.status,
      record.dedupeFingerprint,
      JSON.stringify(record),
      Boolean(record.publicEligibility),
      previousRevision
    ]
  );
  if (result.rowCount !== 1) {
    fail("revision conflict", 409, "REVISION_CONFLICT");
  }
}

function createFixedWindowSubmissionRateLimit({
  now = Date.now,
  windowMs = 60 * 60 * 1000,
  createLimit = 10,
  mutationLimit = 120
} = {}) {
  const windows = new Map();
  return function allow(actorId, operation) {
    const timestamp = now();
    const bucket = `${actorId}\0${operation === "create" ? "create" : "mutation"}`;
    const limit = operation === "create" ? createLimit : mutationLimit;
    const prior = windows.get(bucket);
    const current =
      prior && timestamp - prior.startedAt < windowMs
        ? prior
        : { startedAt: timestamp, count: 0 };
    current.count += 1;
    windows.set(bucket, current);
    return current.count <= limit;
  };
}

function createIdentityResourceSubmissionStore({
  pool,
  enabled = false,
  workflowSubmissionLookupEnabled = false,
  lookupPublishedWorkflowRelease,
  workflowReleaseLookupTimeoutMs = 2000,
  rateLimit,
  makeId = crypto.randomUUID,
  now = () => new Date().toISOString()
} = {}) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") {
    throw new TypeError("PostgreSQL pool required");
  }
  if (enabled && typeof rateLimit !== "function") {
    throw new TypeError("rateLimit is required when resource submissions are enabled");
  }
  if (workflowSubmissionLookupEnabled && typeof lookupPublishedWorkflowRelease !== "function") {
    throw new TypeError("published workflow release lookup required when enabled");
  }
  const workflowLookupReady =
    Boolean(enabled) &&
    workflowSubmissionLookupEnabled === true &&
    typeof lookupPublishedWorkflowRelease === "function";
  const validateSubmission = createAsyncWorkflowReleaseValidator({
    lookupPublishedRelease: workflowLookupReady
      ? lookupPublishedWorkflowRelease
      : async () => false,
    timeoutMs: workflowReleaseLookupTimeoutMs
  });
  const capability = Object.freeze({
    enabled: Boolean(enabled),
    supportedKinds: Object.freeze([
      "vendor",
      "agent",
      "skill",
      "mcp",
      "plugin",
      "connector",
      "workflow"
    ]),
    // The domain kind exists, but the Identity server intentionally has no
    // trusted workflow-release lookup yet. Clients must render it unavailable.
    temporarilyUnavailableKinds: Object.freeze(workflowLookupReady ? [] : ["workflow"]),
    authenticationRequired: true,
    proposalSchemaVersion: 1
  });

  async function allow(actorId, operation) {
    if (!(await rateLimit(actorId, operation))) {
      fail("submission rate limited", 429, "RATE_LIMITED");
    }
  }

  async function create({ actor, idempotencyKey, submission }) {
    assertEnabled(enabled);
    const ownerId = identityId(actor?.identityId);
    await allow(ownerId, "create");
    const displayName = boundedText(actor?.displayName, 160, "display name");
    const key = boundedText(idempotencyKey, 160, "idempotency key");
    const proposal = await validateSubmission(submission);
    const requestHash = sha256(JSON.stringify(proposal));
    const keyHash = sha256(key);

    return inTransaction(pool, async (client) => {
      // Serialize the same owner/key before checking it, so two concurrent
      // retries cannot both observe a missing idempotency row.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [ownerId, keyHash]
      );
      const prior = await client.query(
        `SELECT request_hash, submission_id
         FROM resource_submission_idempotency
         WHERE owner_identity_id = $1 AND idempotency_key_hash = $2
         FOR UPDATE`,
        [ownerId, keyHash]
      );
      if (prior.rowCount) {
        if (prior.rows[0].request_hash !== requestHash) {
          fail("idempotency conflict", 409, "IDEMPOTENCY_CONFLICT");
        }
        const existing = await client.query(
          `SELECT record
           FROM resource_submissions
           WHERE submission_id = $1 AND owner_identity_id = $2`,
          [prior.rows[0].submission_id, ownerId]
        );
        if (!existing.rowCount) fail("submission not found", 404, "NOT_FOUND");
        return storedRecord(existing.rows[0]);
      }

      const fingerprint = submissionFingerprint(proposal);
      const duplicates = await client.query(
        `SELECT submission_id
         FROM resource_submissions
         WHERE dedupe_fingerprint = $1 AND status <> 'merged'
         ORDER BY created_at ASC`,
        [fingerprint]
      );
      const at = now();
      const record = createResourceSubmissionRecord({
        actor: { identityId: ownerId, displayName },
        proposal,
        submissionId: makeId(),
        possibleDuplicateSubmissionIds: duplicates.rows.map(
          (row) => row.submission_id
        ),
        at
      });
      await client.query(
        `INSERT INTO resource_submissions
           (submission_id, owner_identity_id, revision, status,
            dedupe_fingerprint, record, public_eligible, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)`,
        [
          record.submissionId,
          ownerId,
          record.revision,
          record.status,
          record.dedupeFingerprint,
          JSON.stringify(record),
          Boolean(record.publicEligibility),
          at
        ]
      );
      await appendSourceSnapshots(client, record.submissionId, null, record);
      await client.query(
        `INSERT INTO resource_submission_idempotency
           (owner_identity_id, idempotency_key_hash, request_hash, submission_id)
         VALUES ($1, $2, $3, $4)`,
        [ownerId, keyHash, requestHash, record.submissionId]
      );
      await appendAudit(client, record.submissionId, record.audit.at(-1));
      return record;
    });
  }

  async function get(ownerIdentityId, submissionId) {
    assertEnabled(enabled);
    const ownerId = identityId(ownerIdentityId);
    const id = identityId(submissionId, "submission id");
    const result = await pool.query(
      `SELECT record
       FROM resource_submissions
       WHERE submission_id = $1 AND owner_identity_id = $2`,
      [id, ownerId]
    );
    if (!result.rowCount) fail("submission not found", 404, "NOT_FOUND");
    return storedRecord(result.rows[0]);
  }

  async function list(ownerIdentityId, options = {}) {
    assertEnabled(enabled);
    const ownerId = identityId(ownerIdentityId);
    const offset = boundedInteger(options.offset, 1_000_000, 0);
    const limit = boundedInteger(options.limit, 100, 20, 1);
    const result = await pool.query(
      `SELECT record
       FROM resource_submissions
       WHERE owner_identity_id = $1
       ORDER BY updated_at DESC, submission_id DESC
       OFFSET $2 LIMIT $3`,
      [ownerId, offset, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    return {
      items: result.rows.slice(0, limit).map(storedRecord),
      page: {
        offset,
        limit,
        nextOffset: hasMore ? offset + limit : null
      }
    };
  }

  async function mutateOwner(input) {
    assertEnabled(enabled);
    const ownerId = identityId(input.actorId);
    const id = identityId(input.submissionId, "submission id");
    await allow(ownerId, input.action);
    return inTransaction(pool, async (client) => {
      const selected = await client.query(
        `SELECT record
         FROM resource_submissions
         WHERE submission_id = $1 AND owner_identity_id = $2
         FOR UPDATE`,
        [id, ownerId]
      );
      if (!selected.rowCount) fail("submission not found", 404, "NOT_FOUND");
      const current = storedRecord(selected.rows[0]);
      const validatedSubmission = input.action === "update"
        ? await validateSubmission(input.submission)
        : null;
      const result = applyResourceSubmissionAction(
        current,
        {
          actor: { identityId: ownerId, kind: "owner" },
          expectedRevision: input.expectedRevision,
          action: input.action,
          submission: validatedSubmission || input.submission,
          evidenceRefs: input.evidenceRefs
        },
        {
          hasWorkflowRelease: validatedWorkflowRelease(validatedSubmission),
          at: now()
        }
      );
      await updateRecord(client, result.record, current.revision);
      await appendSourceSnapshots(client, result.record.submissionId, current, result.record);
      await appendAudit(client, result.record.submissionId, result.record.audit.at(-1));
      return result.record;
    });
  }

  async function review(input) {
    assertEnabled(enabled);
    const reviewerIdentityId = boundedText(
      input.reviewerIdentityId,
      160,
      "reviewer identity"
    );
    const submissionId = identityId(input.submissionId, "submission id");
    await allow(reviewerIdentityId, `review:${input.action}`);
    return inTransaction(pool, async (client) => {
      const ids = [submissionId];
      if (input.mergeIntoSubmissionId) {
        ids.push(identityId(input.mergeIntoSubmissionId, "merge target"));
      }
      const selected = await client.query(
        `SELECT submission_id, record
         FROM resource_submissions
         WHERE submission_id = ANY($1::uuid[])
         ORDER BY submission_id
         FOR UPDATE`,
        [ids]
      );
      const records = new Map(
        selected.rows.map((row) => [row.submission_id, storedRecord(row)])
      );
      const current = records.get(submissionId);
      if (!current) fail("submission not found", 404, "NOT_FOUND");
      const mergeTarget = input.mergeIntoSubmissionId
        ? records.get(input.mergeIntoSubmissionId)
        : null;
      const validateCurrentWorkflow =
        current.proposal?.submissionKind === "workflow" &&
        (
          input.action === "accept" ||
          (input.action === "set-public-eligibility" && input.publicEligibility === true)
        );
      const validatedSubmission = validateCurrentWorkflow
        ? await validateSubmission(current.proposal)
        : null;
      const result = applyResourceSubmissionAction(
        current,
        {
          actor: { identityId: reviewerIdentityId, kind: "reviewer" },
          expectedRevision: input.expectedRevision,
          action: input.action,
          mergeTarget,
          reviewStatus: input.reviewStatus,
          riskLevel: input.riskLevel,
          publicEligibility: input.publicEligibility
        },
        {
          hasWorkflowRelease: validatedWorkflowRelease(validatedSubmission),
          at: now()
        }
      );
      await updateRecord(client, result.record, current.revision);
      await appendSourceSnapshots(client, result.record.submissionId, current, result.record);
      await appendAudit(client, result.record.submissionId, result.record.audit.at(-1));
      if (result.mergeTarget) {
        await updateRecord(client, result.mergeTarget, mergeTarget.revision);
        await appendSourceSnapshots(client, result.mergeTarget.submissionId, mergeTarget, result.mergeTarget);
        await appendAudit(
          client,
          result.mergeTarget.submissionId,
          result.mergeTarget.audit.at(-1)
        );
      }
      return result.record;
    });
  }

  async function findDuplicates({ reviewerIdentityId, submissionId }) {
    assertEnabled(enabled);
    boundedText(reviewerIdentityId, 160, "reviewer identity");
    const id = identityId(submissionId, "submission id");
    const current = await pool.query(
      `SELECT dedupe_fingerprint
       FROM resource_submissions
       WHERE submission_id = $1`,
      [id]
    );
    if (!current.rowCount) fail("submission not found", 404, "NOT_FOUND");
    const duplicates = await pool.query(
      `SELECT record
       FROM resource_submissions
       WHERE submission_id <> $1
         AND dedupe_fingerprint = $2
         AND status <> 'merged'
       ORDER BY created_at ASC`,
      [id, current.rows[0].dedupe_fingerprint]
    );
    return duplicates.rows.map(storedRecord);
  }

  async function catalogMergeCandidate({ reviewerIdentityId, submissionId }) {
    assertEnabled(enabled);
    boundedText(reviewerIdentityId, 160, "reviewer identity");
    const id = identityId(submissionId, "submission id");
    const result = await pool.query(
      `SELECT record FROM resource_submissions WHERE submission_id = $1`,
      [id]
    );
    if (!result.rowCount) fail("submission not found", 404, "NOT_FOUND");
    const record = storedRecord(result.rows[0]);
    if (record.proposal?.submissionKind === "workflow") {
      await validateSubmission(record.proposal);
    }
    return resourceSubmissionCatalogMergeCandidate(record);
  }

  async function reportAbuse({ reporterIdentityId, submissionId, reason }) {
    assertEnabled(enabled);
    const reporterId = identityId(reporterIdentityId, "reporter identity");
    const id = identityId(submissionId, "submission id");
    const reportReason = boundedText(reason, 1000, "report reason");
    await allow(reporterId, "report");
    const result = await pool.query(
      `INSERT INTO resource_submission_abuse_reports
         (report_id, submission_id, reporter_identity_id, reason)
       SELECT $1, submission_id, $2, $3
       FROM resource_submissions
       WHERE submission_id = $4
       RETURNING report_id, status, created_at`,
      [makeId(), reporterId, reportReason, id]
    );
    if (!result.rowCount) fail("submission not found", 404, "NOT_FOUND");
    return {
      reportId: result.rows[0].report_id,
      status: result.rows[0].status,
      createdAt: result.rows[0].created_at
    };
  }

  return Object.freeze({
    capability: () => capability,
    catalogMergeCandidate,
    create,
    findDuplicates,
    get,
    list,
    mutateOwner,
    reportAbuse,
    review
  });
}

function createFixedServiceReviewerAuthenticator({ secret, reviewerIdentityId }) {
  const expected = Buffer.from(String(secret || ""));
  const reviewer = boundedText(reviewerIdentityId, 160, "reviewer identity");
  if (expected.length < 32) throw new TypeError("review service secret is too short");
  return function authenticate(headers = {}) {
    const received = Buffer.from(
      String(headers["x-aihub-resource-review-secret"] || "")
    );
    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      fail("review service authentication failed", 403, "REVIEW_SERVICE_AUTHENTICATION_FAILED");
    }
    return { identityId: reviewer };
  };
}

function createResourceSubmissionOwnerAdapter({ store, resolveIdentity }) {
  if (!store || typeof store.create !== "function") {
    throw new TypeError("resource submission store required");
  }
  if (typeof resolveIdentity !== "function") {
    throw new TypeError("identity resolver required");
  }
  const actionFields = new Set([
    "expectedRevision",
    "action",
    "submission",
    "evidenceRefs"
  ]);

  async function actor(request) {
    const resolved = await resolveIdentity(request);
    if (!resolved) fail("authentication required", 401, "AUTHENTICATION_REQUIRED");
    return resolved;
  }

  return Object.freeze({
    capability() {
      return store.capability();
    },
    async create(request) {
      const owner = await actor(request);
      return ownerSubmission(
        await store.create({
          actor: owner,
          idempotencyKey: request?.headers?.["idempotency-key"],
          submission: request?.body
        })
      );
    },
    async list(request, options) {
      const owner = await actor(request);
      const result = await store.list(owner.identityId, options);
      return Object.freeze({
        items: result.items.map(ownerSubmission),
        page: result.page
      });
    },
    async get(request, submissionId) {
      const owner = await actor(request);
      return ownerSubmission(await store.get(owner.identityId, submissionId));
    },
    async mutate(request, submissionId) {
      const body = request?.body;
      if (
        !exact(body, actionFields, ["expectedRevision", "action"]) ||
        !["update", "submit", "withdraw", "evidence"].includes(body.action)
      ) {
        fail("submission action fields invalid");
      }
      const owner = await actor(request);
      return ownerSubmission(
        await store.mutateOwner({
          actorId: owner.identityId,
          submissionId,
          expectedRevision: body.expectedRevision,
          action: body.action,
          submission: body.submission,
          evidenceRefs: body.evidenceRefs
        })
      );
    }
  });
}

function createResourceSubmissionReviewAdapter({ store, authenticateService }) {
  if (!store || typeof store.review !== "function") {
    throw new TypeError("resource submission store required");
  }
  if (typeof authenticateService !== "function") {
    throw new TypeError("review service authenticator required");
  }
  const reviewFields = new Set([
    "submissionId",
    "expectedRevision",
    "action",
    "mergeIntoSubmissionId",
    "reviewStatus",
    "riskLevel",
    "publicEligibility"
  ]);
  return Object.freeze({
    async review(request) {
      const body = request?.body;
      if (
        !exact(body, reviewFields, ["submissionId", "expectedRevision", "action"])
      ) {
        fail("review fields invalid");
      }
      const reviewer = await authenticateService(request?.headers || {});
      return store.review({ ...body, reviewerIdentityId: reviewer.identityId });
    },
    async findDuplicates(request) {
      const body = request?.body;
      if (!exact(body, new Set(["submissionId"]), ["submissionId"])) {
        fail("duplicate query fields invalid");
      }
      const reviewer = await authenticateService(request?.headers || {});
      return store.findDuplicates({
        reviewerIdentityId: reviewer.identityId,
        submissionId: body.submissionId
      });
    },
    async catalogMergeCandidate(request) {
      const body = request?.body;
      if (!exact(body, new Set(["submissionId"]), ["submissionId"])) {
        fail("candidate query fields invalid");
      }
      const reviewer = await authenticateService(request?.headers || {});
      return store.catalogMergeCandidate({
        reviewerIdentityId: reviewer.identityId,
        submissionId: body.submissionId
      });
    }
  });
}

module.exports = {
  createFixedServiceReviewerAuthenticator,
  createFixedWindowSubmissionRateLimit,
  createIdentityResourceSubmissionStore,
  createResourceSubmissionOwnerAdapter,
  createResourceSubmissionReviewAdapter
};
