"use strict";

const WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID = "46564566-f5f4-599c-8ce5-0609069f5148";
const WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME = "枕星 AI";
const SERVICE_KIND = "workflow-official-publisher-service";
const SERVICE_USERNAME = "__workflow_official_publisher_service__";
const SERVICE_COMMUNITY_USERNAME = "zx_46564566f5f4599c8ce50609069";
const issuedRollbackReceipts = new WeakSet();
const ROW_FIELDS = Object.freeze([
  "id", "identity_kind", "status", "email", "normalized_email", "phone",
  "normalized_phone", "password_hash", "username", "normalized_username",
  "community_username"
]);

class WorkflowOfficialPublisherIdentityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkflowOfficialPublisherIdentityError";
    this.code = code;
  }
}

function workflowOfficialPublisherIdentityRecord() {
  return Object.freeze({
    id: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    identityKind: SERVICE_KIND,
    status: "disabled",
    email: null,
    normalizedEmail: null,
    phone: null,
    normalizedPhone: null,
    passwordHash: null,
    username: SERVICE_USERNAME,
    normalizedUsername: SERVICE_USERNAME,
    communityUsername: SERVICE_COMMUNITY_USERNAME,
    publicDisplayName: WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME
  });
}

function expectedRow(row) {
  const expected = workflowOfficialPublisherIdentityRecord();
  return row && Object.keys(row).length === ROW_FIELDS.length &&
    Object.keys(row).every((key) => ROW_FIELDS.includes(key)) &&
    row.id === expected.id && row.identity_kind === expected.identityKind &&
    row.status === expected.status && row.email === null && row.normalized_email === null &&
    row.phone === null && row.normalized_phone === null && row.password_hash === null &&
    row.username === expected.username && row.normalized_username === expected.normalizedUsername &&
    row.community_username === expected.communityUsername;
}

async function resolveWorkflowOfficialPublisherPublicIdentity(pool) {
  if (typeof pool?.query !== "function") return null;
  try {
    const result = await pool.query(
      `SELECT u.id, u.identity_kind, u.status, u.email, u.normalized_email,
              u.phone, u.normalized_phone, u.password_hash, u.username,
              u.normalized_username, u.community_username
         FROM public.users u
        WHERE u.id = $1
          AND u.identity_kind = 'workflow-official-publisher-service'
          AND u.status = 'disabled'
          AND NOT EXISTS (SELECT 1 FROM public.community_profiles WHERE user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.profile_avatars WHERE user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.devices WHERE user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.sessions WHERE user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.community_handoffs WHERE user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM public.email_change_challenges WHERE user_id = u.id)`,
      [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
    );
    if (result.rowCount !== 1 || result.rows.length !== 1 || !expectedRow(result.rows[0])) return null;
    return Object.freeze({
      identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
      displayName: WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME
    });
  } catch {
    return null;
  }
}

async function serviceRow(client, lock = false) {
  const result = await client.query(
    `SELECT id, identity_kind, status, email, normalized_email, phone, normalized_phone,
            password_hash, username, normalized_username, community_username
       FROM public.users WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
  );
  return result.rows[0] || null;
}

async function relationCounts(client) {
  const result = await client.query(
    `SELECT
       (SELECT count(*)::int FROM public.community_profiles WHERE user_id = $1) AS profiles,
       (SELECT count(*)::int FROM public.profile_avatars WHERE user_id = $1) AS avatars,
       (SELECT count(*)::int FROM public.devices WHERE user_id = $1) AS devices,
       (SELECT count(*)::int FROM public.sessions WHERE user_id = $1) AS sessions,
       (SELECT count(*)::int FROM public.community_handoffs WHERE user_id = $1) AS handoffs,
       (SELECT count(*)::int FROM public.email_change_challenges WHERE user_id = $1) AS email_changes`,
    [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
  );
  return result.rows[0];
}

async function assertVerified(client, lock = false) {
  if (!expectedRow(await serviceRow(client, lock))) {
    throw new WorkflowOfficialPublisherIdentityError(
      "WORKFLOW_OFFICIAL_PUBLISHER_IDENTITY_CONFLICT",
      "workflow official publisher identity is absent or conflicts with its governed record"
    );
  }
  const counts = await relationCounts(client);
  if (!Object.values(counts).every((value) => Number(value) === 0)) {
    throw new WorkflowOfficialPublisherIdentityError(
      "WORKFLOW_OFFICIAL_PUBLISHER_IDENTITY_EXPOSED",
      "workflow official publisher identity has forbidden browser relations"
    );
  }
  return Object.freeze({ identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID });
}

async function provisionWorkflowOfficialPublisherIdentity(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let row = await serviceRow(client, true);
    let created = false;
    if (!row) {
      const record = workflowOfficialPublisherIdentityRecord();
      await client.query(
        `INSERT INTO public.users
          (id, identity_kind, status, email, normalized_email, phone, normalized_phone,
           password_hash, username, normalized_username, community_username)
         VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, NULL, $4, $4, $5)`,
        [record.id, record.identityKind, record.status, record.username, record.communityUsername]
      );
      created = true;
    }
    await assertVerified(client, true);
    await client.query("COMMIT");
    const receipt = created ? Object.freeze({}) : null;
    if (receipt) issuedRollbackReceipts.add(receipt);
    return Object.freeze({ created, receipt, identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function verifyWorkflowOfficialPublisherIdentity(pool) {
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
    [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]
  );
  return Number(result.rows[0]?.count || 0);
}

async function rollbackProvisionedWorkflowOfficialPublisherIdentity(pool, receipt) {
  if (!issuedRollbackReceipts.has(receipt)) {
    throw new WorkflowOfficialPublisherIdentityError(
      "WORKFLOW_OFFICIAL_PUBLISHER_ROLLBACK_DENIED",
      "workflow official publisher rollback requires the current provision receipt"
    );
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertVerified(client, true);
    const events = await workflowReferenceCount(client, "community_workflow.events");
    const idempotency = await workflowReferenceCount(client, "community_workflow.idempotency");
    if (events !== 0 || idempotency !== 0) {
      throw new WorkflowOfficialPublisherIdentityError(
        "WORKFLOW_OFFICIAL_PUBLISHER_RETENTION_REQUIRED",
        "workflow official publisher identity is retained because Workflow history references it"
      );
    }
    await client.query("DELETE FROM public.users WHERE id = $1", [WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID]);
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
  WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
  WorkflowOfficialPublisherIdentityError,
  provisionWorkflowOfficialPublisherIdentity,
  resolveWorkflowOfficialPublisherPublicIdentity,
  rollbackProvisionedWorkflowOfficialPublisherIdentity,
  verifyWorkflowOfficialPublisherIdentity,
  workflowOfficialPublisherIdentityRecord
};
