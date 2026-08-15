"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { createRequire } = require("node:module");
const {
  createFixedWorkflowReviewerAuthenticator,
  createIdentityWorkflowStoreGateway
} = require("../identity/workflow-store.cjs");

const root = path.resolve(__dirname, "..");
const identityRequire = createRequire(path.join(root, "identity", "package.json"));
const { Pool } = identityRequire("pg");
const databaseUrl = process.env.AIHUB_TEST_WORKFLOW_DATABASE_URL;
if (!databaseUrl) throw new Error("AIHUB_TEST_WORKFLOW_DATABASE_URL is required");

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const REVIEWER = "22222222-2222-4222-8222-222222222222";
const REVIEW_SECRET = "isolated-workflow-review-secret-32-bytes";
const pool = new Pool({ connectionString: databaseUrl, max: 3 });

function sql(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

async function call(gateway, method, route, { token = "", secret = "", body, query = {} } = {}) {
  return gateway.handle({
    method,
    path: route,
    accessToken: token,
    headers: {
      ...(body ? { "content-type": "application/json", "idempotency-key": crypto.randomUUID() } : {}),
      ...(secret ? { "x-aihub-workflow-review-secret": secret } : {})
    },
    body,
    query
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function verifyCurrentIdentityHttpDefaults() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(root, "identity", "server.cjs")], {
    cwd: root,
    env: {
      ...process.env,
      AIHUB_IDENTITY_HOST: "127.0.0.1",
      AIHUB_IDENTITY_PORT: String(port),
      AIHUB_IDENTITY_DATABASE_URL: databaseUrl,
      AIHUB_IDENTITY_SCHEMA_MODE: "external",
      AIHUB_REGISTRATION_ENABLED: "false",
      AIHUB_WORKFLOW_STORE_ENABLED: "0",
      AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED: "0",
      AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const diagnostics = [];
  child.stdout.on("data", (chunk) => diagnostics.push(chunk.toString("utf8")));
  child.stderr.on("data", (chunk) => diagnostics.push(chunk.toString("utf8")));
  try {
    let capabilityResponse;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (child.exitCode !== null) throw new Error("isolated Identity exited before readiness");
      try {
        capabilityResponse = await fetch(`http://127.0.0.1:${port}/v1/community/workflow-store/capability`);
        if (capabilityResponse.ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(capabilityResponse?.ok, `isolated Identity did not become ready: ${diagnostics.join("").slice(0, 500)}`);
    const capability = await capabilityResponse.json();
    assert.equal(capability.enabled, false);
    assert.equal(capability.workflowSubmissionLookup, false);
    const publicCapabilityResponse = await fetch(`http://127.0.0.1:${port}/v1/community/workflow-store/public/capability`);
    assert.equal(publicCapabilityResponse.status, 200);
    assert.deepEqual(await publicCapabilityResponse.json(), { enabled: false, schemaVersion: 1, execution: false });

    for (const body of ["{", JSON.stringify({ padding: "x".repeat(129 * 1024) })]) {
      const response = await fetch(`http://127.0.0.1:${port}/v1/community/workflow-store/owner/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: { code: "INVALID_INPUT", status: 400, messageKey: "workflow.store.invalid" }
      });
    }
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 3000)).then(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      })
    ]);
  }
}

async function main() {
  await pool.query(sql("identity/schema.sql"));
  await pool.query(sql("community/migrations/candidates/0001-workflow-store.sql"));
  await pool.query(
    `INSERT INTO users (id, email, normalized_email, username, normalized_username, community_username, password_hash)
     VALUES
       ($1, 'owner@example.test', 'owner@example.test', 'owner', 'owner', 'zx_111111111111411181111111111', 'not-a-real-credential'),
       ($2, 'reviewer@example.test', 'reviewer@example.test', 'reviewer', 'reviewer', 'zx_222222222222422282222222222', 'not-a-real-credential')`,
    [AUTHOR, REVIEWER]
  );
  await pool.query(
    `INSERT INTO community_profiles (user_id, nickname)
     VALUES ($1, 'Current owner'), ($2, 'Current reviewer')`,
    [AUTHOR, REVIEWER]
  );

  const gateway = createIdentityWorkflowStoreGateway({
    pool,
    workflowStoreEnabled: true,
    workflowPublicStoreEnabled: true,
    resourceSubmissionsEnabled: true,
    workflowSubmissionLookupEnabled: true,
    resolveOwnerIdentity: async (request) => request.accessToken === "isolated-owner-token" ? AUTHOR : null,
    authenticateReviewer: createFixedWorkflowReviewerAuthenticator({
      secret: REVIEW_SECRET,
      reviewerIdentityId: REVIEWER
    }),
    resolvePublicIdentity: async (identityId) => {
      const result = await pool.query(
        "SELECT user_id AS id, nickname FROM community_profiles WHERE user_id = $1",
        [identityId]
      );
      return result.rowCount === 1
        ? { identityId: result.rows[0].id, displayName: result.rows[0].nickname }
        : null;
    },
    hasCanonicalDependency: async (tuple) => tuple.kind === "product" && tuple.canonicalId === "comfyui",
    hasCanonicalLicense: async (licenseId) => licenseId === "CC-BY-4.0",
    hasCommunityPost: async (postId) => postId === "42"
  });

  assert.equal(gateway.capability().enabled, true);
  assert.equal(gateway.publicCapability().enabled, true);
  assert.equal(gateway.submissionLookupEnabled, true);
  const created = await call(gateway, "POST", "/v1/community/workflow-store/owner/drafts", {
    token: "isolated-owner-token",
    body: {
      sourceCommunityPostId: "42",
      provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] },
      content: {
        title: "Isolated PostgreSQL workflow",
        summary: "A data-only acceptance fixture.",
        inputs: [], outputs: [],
        instructions: ["Follow the documented steps."],
        dependencies: [{ kind: "product", canonicalId: "comfyui", permissions: ["none"] }],
        secretPlaceholders: []
      }
    }
  });
  assert.equal(created.status, 201);
  const submitted = await call(gateway, "POST", "/v1/community/workflow-store/owner/drafts/submit", {
    token: "isolated-owner-token",
    body: { workflowId: created.body.workflowId, expectedRevision: created.body.expectedRevision }
  });
  assert.equal(submitted.status, 200);
  const reviewed = await call(gateway, "POST", "/v1/community/workflow-store/reviewer/review", {
    secret: REVIEW_SECRET,
    body: {
      workflowId: created.body.workflowId,
      expectedRevision: submitted.body.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  assert.equal(reviewed.status, 200);
  assert.equal(await gateway.lookupPublishedRelease({ workflowId: created.body.workflowId, version: 1 }), true);
  const publicRelease = await call(gateway, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: created.body.workflowId, version: 1 }
  });
  assert.equal(publicRelease.status, 200);
  assert.deepEqual(publicRelease.body.author, { displayName: "Current owner" });
  assert.equal(publicRelease.body.originalAuthorDisplayName, "Current owner");
  assert.doesNotMatch(JSON.stringify(publicRelease.body), /identityId/);
  assert.equal(JSON.stringify(publicRelease.body).includes("secretPlaceholders"), false);
  await pool.query("UPDATE community_profiles SET nickname = 'Renamed original owner' WHERE user_id = $1", [AUTHOR]);
  const renamedPublicRelease = await call(gateway, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: created.body.workflowId, version: 1 }
  });
  assert.equal(renamedPublicRelease.status, 200);
  assert.equal(renamedPublicRelease.body.originalAuthorDisplayName, "Renamed original owner");
  assert.equal(Object.hasOwn(renamedPublicRelease.body, "originalAuthorOrganization"), false);
  const publicList = await call(gateway, "GET", "/v1/community/workflow-store/public/list", {
    query: { limit: 10, riskLevel: "low" }
  });
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.items.length, 1);

  const unlisted = await call(gateway, "POST", "/v1/community/workflow-store/reviewer/unlist", {
    secret: REVIEW_SECRET,
    body: { workflowId: created.body.workflowId, reason: "Isolated unlist recheck." }
  });
  assert.equal(unlisted.status, 200);
  assert.equal(await gateway.lookupPublishedRelease({ workflowId: created.body.workflowId, version: 1 }), false);
  const unavailable = await call(gateway, "GET", "/v1/community/workflow-store/public/release", {
    query: { workflowId: created.body.workflowId, version: 1 }
  });
  assert.deepEqual(unavailable, {
    status: 404,
    body: { error: { code: "PUBLIC_WORKFLOW_UNAVAILABLE", status: 404, messageKey: "workflow.public.unavailable" } }
  });
  const count = await pool.query("SELECT count(*)::int AS count FROM community_workflow.events");
  assert.equal(count.rows[0].count, 4);

  await pool.query(sql("community/migrations/candidates/0001-workflow-store.rollback.sql"));
  const absent = await pool.query("SELECT to_regclass('community_workflow.events') AS relation");
  assert.equal(absent.rows[0].relation, null);
  await pool.query(sql("community/migrations/candidates/0001-workflow-store.sql"));
  const reapplied = await pool.query("SELECT last_sequence::int AS value FROM community_workflow.event_head WHERE singleton = true");
  assert.equal(reapplied.rows[0].value, 0);
  await verifyCurrentIdentityHttpDefaults();
  process.stdout.write(JSON.stringify({ ok: true, eventsBeforeRollback: count.rows[0].count, rollback: true, reapply: true, publicRead: true, publicUnlistFailClosed: true, identityHttpDefaultDisabled: true, identityHttpSafeParsing: true }) + "\n");
}

main().finally(() => pool.end()).catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exitCode = 1;
});
