"use strict";

const WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID = "5f16d5ac-6663-5905-b920-c2140ac6769c";
const SERVICE_KIND = "workflow-reviewer-service";
const SERVICE_USERNAME = "__workflow_reviewer_service__";
const SERVICE_COMMUNITY_USERNAME = "zx_5f16d5ac66635905b920c2140ac";
const issuedRollbackReceipts = new WeakSet();

class WorkflowReviewerServiceIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkflowReviewerServiceIdentityError";
    this.code = code;
  }
}

function workflowReviewerServiceIdentityRecord() {
  return Object.freeze({
    id: WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
    identityKind: SERVICE_KIND,
    status: "disabled",
    email: null,
    normalizedEmail: null,
    phone: null,
    normalizedPhone: null,
    passwordHash: null,
    username: SERVICE_USERNAME,
    normalizedUsername: SERVICE_USERNAME,
    communityUsername: SERVICE_COMMUNITY_USERNAME
  });
}

function expectedRow(row) {
  const expected = workflowReviewerServiceIdentityRecord();
  return row &&
    row.id === expected.id &&
    row.identity_kind === expected.identityKind &&
    row.status === expected.status &&
    row.email === expected.email &&
    row.normalized_email === expected.normalizedEmail &&
    row.phone === expected.phone &&
    row.normalized_phone === expected.normalizedPhone &&
    row.password_hash === expected.passwordHash &&
    row.username === expected.username &&
    row.normalized_username === expected.normalizedUsername &&
    row.community_username === expected.communityUsername;
}

async function serviceRow(client, lock = false) {
  const result = await client.query(
    `SELECT id, identity_kind, status, email, normalized_email, phone, normalized_phone,
            password_hash, username, normalized_username, community_username
       FROM public.users
      WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]
  );
  return result.rows[0] || null;
}

async function browserRelationCounts(client) {
  const result = await client.query(
    `SELECT
       (SELECT count(*)::int FROM public.community_profiles WHERE user_id = $1) AS profiles,
       (SELECT count(*)::int FROM public.profile_avatars WHERE user_id = $1) AS avatars,
       (SELECT count(*)::int FROM public.devices WHERE user_id = $1) AS devices,
       (SELECT count(*)::int FROM public.sessions WHERE user_id = $1) AS sessions,
       (SELECT count(*)::int FROM public.community_handoffs WHERE user_id = $1) AS handoffs,
       (SELECT count(*)::int FROM public.email_change_challenges WHERE user_id = $1) AS email_changes`,
    [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]
  );
  return result.rows[0];
}

function noBrowserRelations(counts) {
  return Object.values(counts).every((value) => Number(value) === 0);
}

async function assertVerified(client, lock = false) {
  const row = await serviceRow(client, lock);
  if (!expectedRow(row)) {
    throw new WorkflowReviewerServiceIdentityError(
      "WORKFLOW_REVIEWER_SERVICE_IDENTITY_CONFLICT",
      "workflow reviewer service identity is absent or does not match the governed record"
    );
  }
  const relations = await browserRelationCounts(client);
  if (!noBrowserRelations(relations)) {
    throw new WorkflowReviewerServiceIdentityError(
      "WORKFLOW_REVIEWER_SERVICE_IDENTITY_EXPOSED",
      "workflow reviewer service identity has forbidden browser relations"
    );
  }
  return Object.freeze({ identityId: WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID });
}

async function provisionWorkflowReviewerServiceIdentity(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await serviceRow(client, true);
    let created = false;
    if (!row) {
      const record = workflowReviewerServiceIdentityRecord();
      await client.query(
        `INSERT INTO public.users
          (id, identity_kind, status, email, normalized_email, phone, normalized_phone,
           password_hash, username, normalized_username, community_username)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          record.id, record.identityKind, record.status, record.email,
          record.normalizedEmail, record.phone, record.normalizedPhone,
          record.passwordHash, record.username, record.normalizedUsername,
          record.communityUsername
        ]
      );
      created = true;
    }
    await assertVerified(client, true);
    await client.query("COMMIT");
    const receipt = created ? Object.freeze({}) : null;
    if (receipt) issuedRollbackReceipts.add(receipt);
    return Object.freeze({ created, receipt, identityId: WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function verifyWorkflowReviewerServiceIdentity(pool) {
  const client = await pool.connect();
  try {
    return await assertVerified(client);
  } finally {
    client.release();
  }
}

async function workflowReferenceCount(client, relation) {
  const present = await client.query("SELECT to_regclass($1) AS relation", [relation]);
  if (present.rows[0]?.relation === null) return 0;
  const result = await client.query(
    `SELECT count(*)::int AS count FROM ${relation} WHERE actor_identity_id = $1`,
    [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]
  );
  return Number(result.rows[0]?.count || 0);
}

async function rollbackProvisionedWorkflowReviewerServiceIdentity(pool, receipt) {
  if (!issuedRollbackReceipts.has(receipt)) {
    throw new WorkflowReviewerServiceIdentityError(
      "WORKFLOW_REVIEWER_SERVICE_IDENTITY_ROLLBACK_DENIED",
      "workflow reviewer service identity rollback requires the current provision receipt"
    );
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertVerified(client, true);
    const events = await workflowReferenceCount(client, "community_workflow.events");
    const idempotency = await workflowReferenceCount(client, "community_workflow.idempotency");
    if (events !== 0 || idempotency !== 0) {
      throw new WorkflowReviewerServiceIdentityError(
        "WORKFLOW_REVIEWER_SERVICE_IDENTITY_RETENTION_REQUIRED",
        "workflow reviewer service identity is retained because Workflow records reference it"
      );
    }
    await client.query("DELETE FROM public.users WHERE id = $1", [WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID]);
    await client.query("COMMIT");
    issuedRollbackReceipts.delete(receipt);
    return Object.freeze({ removed: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
  WorkflowReviewerServiceIdentityError,
  provisionWorkflowReviewerServiceIdentity,
  rollbackProvisionedWorkflowReviewerServiceIdentity,
  verifyWorkflowReviewerServiceIdentity,
  workflowReviewerServiceIdentityRecord
};
