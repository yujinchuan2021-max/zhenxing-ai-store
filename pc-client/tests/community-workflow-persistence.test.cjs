"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  WorkflowCandidateError,
  createCommunityWorkflowCandidate,
  createInMemoryWorkflowRepository,
  createPostgresWorkflowRepository,
  createCommunityWorkflowHttpHandler
} = require("../community/workflow-persistence.cjs");

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const REVIEWER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

function content(overrides = {}) {
  return {
    title: "可持久化工作流",
    summary: "只包含数据、人工说明与审核依赖。",
    inputs: [{ name: "source", type: "file-reference", required: true, description: "用户选择的输入。" }],
    outputs: [{ name: "result", type: "file-reference", description: "输出引用。" }],
    instructions: ["由用户在目标产品内手动完成。"],
    dependencies: [{ kind: "product", canonicalId: "comfyui", permissions: ["none"] }],
    secretPlaceholders: [{ name: "LOCAL_TOKEN", description: "仅在客户端本地填写。" }],
    ...overrides
  };
}

function candidate(enabled = true, overrides = {}) {
  const ids = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  ];
  let tick = 0;
  return createCommunityWorkflowCandidate({
    enabled,
    repository: overrides.repository || createInMemoryWorkflowRepository(),
    resolveOwnerIdentity: (request) => request.identityId,
    resolveReviewerIdentity: (request) => request.serviceIdentityId,
    resolvePublicIdentity: async (identityId) => ({ identityId, displayName: `author-${identityId.slice(0, 4)}` }),
    hasCanonicalDependency: ({ kind, canonicalId }) => kind === "product" && canonicalId === "comfyui",
    hasCanonicalLicense: (licenseId) => licenseId === "CC-BY-4.0",
    hasCommunityPost: (postId) => ["42", "43"].includes(postId),
    makeId: () => ids.shift(),
    now: () => `2026-08-07T01:00:${String(tick++).padStart(2, "0")}.000Z`,
    ...overrides
  });
}

function createRequest(summary = content().summary) {
  return {
    identityId: AUTHOR,
    headers: { "idempotency-key": "create-workflow-0001" },
    body: {
      sourceCommunityPostId: "42",
      provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] },
      content: content({ summary })
    }
  };
}

function fakePostgresPool() {
  const state = { events: [], idempotency: new Map(), lastSequence: 0 };
  const result = (rows = []) => ({ rows, rowCount: rows.length });
  async function query(sql, params = []) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized === "BEGIN" || normalized === "COMMIT" || normalized === "ROLLBACK") return result();
    if (normalized.includes("FROM community_workflow.events") && normalized.includes("ORDER BY")) {
      return result(state.events.map((entry) => ({ ...entry })));
    }
    if (normalized.includes("FROM community_workflow.event_head")) {
      return result([{ last_sequence: state.lastSequence }]);
    }
    if (normalized.includes("FROM community_workflow.idempotency")) {
      const entry = state.idempotency.get(`${params[0]}:${params[1]}`);
      return result(entry ? [{ request_hash: entry.request_hash, response: structuredClone(entry.response) }] : []);
    }
    if (normalized.startsWith("INSERT INTO community_workflow.events")) {
      state.events.push({
        sequence: params[0],
        operation: params[1],
        actor_identity_id: params[2],
        event_data: JSON.parse(params[3]),
        created_at: new Date(params[4])
      });
      return result();
    }
    if (normalized.startsWith("INSERT INTO community_workflow.idempotency")) {
      state.idempotency.set(`${params[0]}:${params[1]}`, {
        request_hash: params[2],
        response: JSON.parse(params[3])
      });
      return result();
    }
    if (normalized.startsWith("UPDATE community_workflow.event_head")) {
      state.lastSequence = params[0];
      return result();
    }
    throw new Error(`unexpected SQL: ${normalized}`);
  }
  return {
    query,
    async connect() {
      return { query, release() {} };
    }
  };
}

test("owner, reviewer, and public adapters persist one immutable published release", async () => {
  const workflow = candidate();
  assert.equal(workflow.capability().enabled, true);

  const created = await workflow.owner.create(createRequest());
  assert.deepEqual(await workflow.owner.create(createRequest()), created, "idempotent retry returns the first response");
  const reordered = createRequest();
  reordered.body = {
    content: reordered.body.content,
    provenance: reordered.body.provenance,
    sourceCommunityPostId: reordered.body.sourceCommunityPostId
  };
  assert.deepEqual(await workflow.owner.create(reordered), created, "JSON field order does not change idempotency");
  assert.equal(created.status, "draft");
  assert.equal("authorIdentityId" in created, false);

  const submitted = await workflow.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "submit-workflow-0001" },
    body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision }
  });
  const published = await workflow.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "review-workflow-0001" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: submitted.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded"
    }
  });
  assert.equal(published.release.version, 1);
  assert.equal(Object.isFrozen(published.release), true);

  const publicRelease = await workflow.public.get({ query: { workflowId: created.workflowId, version: 1 } });
  assert.equal(publicRelease.author.identityId, AUTHOR);
  assert.equal(publicRelease.provenance.canonicalSource.canonicalId, "42");
  assert.equal(publicRelease.reviewStatus, "manually-reviewed");
  assert.equal(publicRelease.riskLevel, "guarded");
  assert.equal(JSON.stringify(publicRelease).includes("reviewedBy"), false);
  assert.equal(JSON.stringify(publicRelease).includes("discoveredVia"), false);
  assert.equal(JSON.stringify(publicRelease).includes("value"), false);
  assert.deepEqual(await workflow.public.history({ query: { workflowId: created.workflowId } }), [publicRelease]);
  assert.equal(await workflow.lookupPublishedRelease({ workflowId: created.workflowId, version: 1 }), true);

  assert.equal((await workflow.owner.list({ identityId: AUTHOR, query: {} })).items.length, 1);
  await assert.rejects(
    () => workflow.owner.get({ identityId: OTHER, query: { workflowId: created.workflowId } }),
    (error) => error instanceof WorkflowCandidateError && error.code === "NOT_FOUND"
  );
});

test("planning resolver returns only the current public immutable Release projection", async () => {
  const workflow = candidate();
  const created = await workflow.owner.create(createRequest());
  const submitted = await workflow.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "submit-planning-0001" },
    body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision }
  });
  const first = await workflow.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "review-planning-0001" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: submitted.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "guarded"
    }
  });

  const planning = await workflow.resolvePlanningRelease({ workflowId: created.workflowId, version: 1 });
  assert.deepEqual(Object.keys(planning).sort(), ["content", "reviewStatus", "riskLevel", "version", "workflowId"]);
  assert.deepEqual(Object.keys(planning.content).sort(), [
    "dependencies", "inputs", "instructions", "outputs", "secretPlaceholders", "summary", "title"
  ]);
  assert.equal(planning.content.secretPlaceholders[0].name, "LOCAL_TOKEN");
  assert.equal("value" in planning.content.secretPlaceholders[0], false);
  assert.equal(JSON.stringify(planning).includes(AUTHOR), false);
  assert.equal(JSON.stringify(planning).includes(REVIEWER), false);
  assert.equal(JSON.stringify(planning).includes("discoveredVia"), false);
  assert.equal(Object.isFrozen(planning), true);
  assert.equal(Object.isFrozen(planning.content.secretPlaceholders[0]), true);
  assert.throws(() => {
    planning.content.secretPlaceholders[0].name = "CHANGED";
  }, TypeError);
  assert.equal(await workflow.resolvePlanningRelease({ workflowId: created.workflowId, version: 1, extra: true }), null);
  assert.equal(await workflow.resolvePlanningRelease({ workflowId: created.workflowId, version: 2 }), null);

  const updated = await workflow.owner.update({
    identityId: AUTHOR,
    headers: { "idempotency-key": "update-planning-0001" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: first.draft.revision,
      content: content({ summary: "A second immutable planning release." })
    }
  });
  const resubmitted = await workflow.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "resubmit-planning-01" },
    body: { workflowId: created.workflowId, expectedRevision: updated.expectedRevision }
  });
  const second = await workflow.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "review-planning-0002" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: resubmitted.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  assert.equal(second.release.version, 2);
  assert.equal(await workflow.resolvePlanningRelease({ workflowId: created.workflowId, version: 1 }), null);
  assert.equal(await workflow.lookupPublishedRelease({ workflowId: created.workflowId, version: 1 }), false);
  assert.equal((await workflow.resolvePlanningRelease({ workflowId: created.workflowId, version: 2 })).content.summary, "A second immutable planning release.");

  await workflow.reviewer.unlist({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "unlist-planning-0001" },
    body: { workflowId: created.workflowId, reason: "planning release withdrawn" }
  });
  assert.equal(await workflow.resolvePlanningRelease({ workflowId: created.workflowId, version: 2 }), null);

  const rejected = candidate();
  const rejectedCreated = await rejected.owner.create(createRequest());
  const rejectedSubmitted = await rejected.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "submit-rejected-plan-01" },
    body: { workflowId: rejectedCreated.workflowId, expectedRevision: rejectedCreated.expectedRevision }
  });
  await rejected.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "review-rejected-plan-01" },
    body: {
      workflowId: rejectedCreated.workflowId,
      expectedRevision: rejectedSubmitted.expectedRevision,
      decision: "reject",
      reviewStatus: "rejected",
      riskLevel: "unsafe",
      reason: "unsafe planning content"
    }
  });
  assert.equal(await rejected.resolvePlanningRelease({ workflowId: rejectedCreated.workflowId, version: 1 }), null);
  assert.equal(await candidate(false).resolvePlanningRelease({ workflowId: created.workflowId, version: 2 }), null);
});

test("create awaits canonical dependency approval and rejects async false", async () => {
  const workflow = candidate(true, {
    hasCanonicalDependency: async () => false
  });
  await assert.rejects(
    () => workflow.owner.create(createRequest()),
    (error) => error instanceof WorkflowCandidateError && error.code === "DEPENDENCY_NOT_FOUND"
  );
  const http = createCommunityWorkflowHttpHandler({ candidate: workflow });
  assert.deepEqual(
    await http.handle({
      ...createRequest(),
      method: "POST",
      path: "/v1/community/workflow-store/owner/drafts",
      headers: {
        ...createRequest().headers,
        "content-type": "application/json"
      }
    }),
    { status: 400, body: { error: { code: "DEPENDENCY_NOT_FOUND", status: 400 } } }
  );
});

test("update and attach recheck only their exact dependency tuple and Flarum post", async () => {
  let dependencyApproved = true;
  let attachedPostApproved = false;
  const dependencyCalls = [];
  const postCalls = [];
  const workflow = candidate(true, {
    hasCanonicalDependency: async (tuple) => {
      dependencyCalls.push(tuple);
      return dependencyApproved && tuple.kind === "product" && tuple.canonicalId === "comfyui";
    },
    hasCommunityPost: async (postId) => {
      postCalls.push(postId);
      return postId === "42" || (postId === "43" && attachedPostApproved);
    }
  });
  const created = await workflow.owner.create(createRequest());
  assert.deepEqual(dependencyCalls, [{ kind: "product", canonicalId: "comfyui" }]);
  assert.deepEqual(postCalls, ["42"]);

  await assert.rejects(
    () => workflow.owner.update({
      identityId: AUTHOR,
      headers: { "idempotency-key": "tuple-mismatch-0001" },
      body: {
        workflowId: created.workflowId,
        expectedRevision: created.expectedRevision,
        content: content({
          dependencies: [{ kind: "product", canonicalId: "unapproved-product", permissions: ["none"] }]
        })
      }
    }),
    (error) => error instanceof WorkflowCandidateError && error.code === "DEPENDENCY_NOT_FOUND"
  );
  assert.deepEqual(dependencyCalls.at(-1), { kind: "product", canonicalId: "unapproved-product" });

  dependencyApproved = false;
  await assert.rejects(
    () => workflow.owner.update({
      identityId: AUTHOR,
      headers: { "idempotency-key": "async-update-false-01" },
      body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision, content: content() }
    }),
    (error) => error instanceof WorkflowCandidateError && error.code === "DEPENDENCY_NOT_FOUND"
  );

  dependencyApproved = true;
  const submitted = await workflow.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "async-submit-0001" },
    body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision }
  });
  const published = await workflow.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "async-publish-001" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: submitted.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  await assert.rejects(
    () => workflow.owner.attachPost({
      identityId: AUTHOR,
      headers: { "idempotency-key": "async-attach-false" },
      body: {
        workflowId: created.workflowId,
        version: published.release.version,
        communityPostId: "43",
        expectedRevision: published.draft.revision
      }
    }),
    (error) => error instanceof WorkflowCandidateError && error.code === "COMMUNITY_POST_NOT_FOUND"
  );
  attachedPostApproved = true;
  const attached = await workflow.owner.attachPost({
    identityId: AUTHOR,
    headers: { "idempotency-key": "async-attach-true1" },
    body: {
      workflowId: created.workflowId,
      version: published.release.version,
      communityPostId: "43",
      expectedRevision: published.draft.revision
    }
  });
  assert.deepEqual(attached.postReference.card, { workflowId: created.workflowId, version: 1 });
  assert.deepEqual(postCalls, ["42", "43", "43"]);
});

test("ingress resolvers reject object, undefined, throw, and timeout results", async (context) => {
  const cases = [
    {
      name: "dependency object",
      overrides: { hasCanonicalDependency: async () => ({ approved: true }) },
      code: "DEPENDENCY_NOT_FOUND"
    },
    {
      name: "license undefined",
      overrides: { hasCanonicalLicense: async () => undefined },
      code: "LICENSE_NOT_FOUND"
    },
    {
      name: "license async false",
      overrides: { hasCanonicalLicense: async () => false },
      code: "LICENSE_NOT_FOUND"
    },
    {
      name: "post async false",
      overrides: { hasCommunityPost: async () => false },
      code: "COMMUNITY_POST_NOT_FOUND"
    },
    {
      name: "post throw",
      overrides: { hasCommunityPost: async () => { throw new Error("upstream detail"); } },
      code: "COMMUNITY_POST_NOT_FOUND"
    },
    {
      name: "post timeout",
      overrides: {
        hasCommunityPost: () => new Promise(() => {}),
        resolverTimeoutMs: 5
      },
      code: "COMMUNITY_POST_NOT_FOUND"
    }
  ];
  for (const entry of cases) {
    await context.test(entry.name, async () => {
      const workflow = candidate(true, entry.overrides);
      await assert.rejects(
        () => workflow.owner.create(createRequest()),
        (error) => error instanceof WorkflowCandidateError && error.code === entry.code && !error.message.includes("upstream detail")
      );
    });
  }
});

test("catalog dependency failure and timeout are unavailable, not canonical absence", async (context) => {
  for (const entry of [
    {
      name: "catalog unavailable",
      resolver: async () => {
        const error = new Error("private catalog failure");
        error.code = "TEMPORARILY_UNAVAILABLE";
        error.status = 503;
        throw error;
      },
      timeout: 2_000
    },
    { name: "catalog timeout", resolver: () => new Promise(() => {}), timeout: 5 }
  ]) {
    await context.test(entry.name, async () => {
      const workflow = candidate(true, {
        hasCanonicalDependency: entry.resolver,
        resolverTimeoutMs: entry.timeout
      });
      await assert.rejects(
        () => workflow.owner.create(createRequest()),
        (error) => error instanceof WorkflowCandidateError &&
          error.code === "TEMPORARILY_UNAVAILABLE" && error.status === 503 &&
          !error.message.includes("private catalog failure")
      );
    });
  }
});

test("non-ingress actions and replay never call external fact resolvers", async () => {
  const repository = createInMemoryWorkflowRepository();
  let calls = 0;
  const approved = candidate(true, {
    repository,
    hasCanonicalDependency: async () => { calls += 1; return true; },
    hasCanonicalLicense: async () => { calls += 1; return true; },
    hasCommunityPost: async () => { calls += 1; return true; }
  });
  const created = await approved.owner.create(createRequest());
  calls = 0;
  const submitted = await approved.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "no-lookup-submit1" },
    body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision }
  });
  await approved.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "no-lookup-review1" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: submitted.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  await approved.public.get({ query: { workflowId: created.workflowId, version: 1 } });
  assert.equal(calls, 0);

  const replayed = candidate(true, {
    repository,
    hasCanonicalDependency: () => { throw new Error("replay dependency lookup"); },
    hasCanonicalLicense: () => { throw new Error("replay license lookup"); },
    hasCommunityPost: () => { throw new Error("replay post lookup"); }
  });
  assert.equal((await replayed.owner.get({ identityId: AUTHOR, query: { workflowId: created.workflowId } })).status, "published");
  assert.equal((await replayed.public.get({ query: { workflowId: created.workflowId, version: 1 } })).version, 1);
});

test("candidate is disabled by default and the HTTP seam exposes no execution route", async () => {
  const workflow = candidate(false);
  assert.deepEqual(workflow.capability(), {
    enabled: false,
    schemaVersion: 1,
    execution: false,
    workflowSubmissionLookup: false
  });
  const http = createCommunityWorkflowHttpHandler({ candidate: workflow });
  assert.deepEqual(await http.handle({ method: "GET", path: "/v1/community/workflow-store/capability" }), {
    status: 200,
    body: workflow.capability()
  });
  assert.equal((await http.handle({ method: "POST", path: "/v1/community/workflow-store/invoke" })).status, 404);
  assert.deepEqual(
    await http.handle({
      method: "POST",
      path: "/v1/community/workflow-store/owner/drafts",
      identityId: AUTHOR,
      headers: { "content-type": "application/json", "idempotency-key": "disabled-create-01" },
      body: createRequest().body
    }),
    { status: 503, body: { error: { code: "FEATURE_DISABLED", status: 503 } } }
  );
  assert.throws(() => candidate(true, { resolverTimeoutMs: 0 }), /resolver timeout/);
});

test("idempotency, expected revision, schema, and reviewer identity fail closed", async () => {
  const workflow = candidate();
  const created = await workflow.owner.create(createRequest());

  await assert.rejects(
    () => workflow.owner.create(createRequest("different request under the same key")),
    (error) => error instanceof WorkflowCandidateError && error.code === "IDEMPOTENCY_CONFLICT" && error.status === 409
  );
  await assert.rejects(
    () => workflow.owner.update({
      identityId: AUTHOR,
      headers: { "idempotency-key": "stale-update-0001" },
      body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision + 1, content: content() }
    }),
    (error) => error instanceof WorkflowCandidateError && error.code === "REVISION_CONFLICT" && error.status === 409
  );
  await assert.rejects(
    () => workflow.owner.update({
      identityId: AUTHOR,
      headers: { "idempotency-key": "command-update-01" },
      body: {
        workflowId: created.workflowId,
        expectedRevision: created.expectedRevision,
        content: { ...content(), command: "whoami" }
      }
    }),
    (error) => error instanceof WorkflowCandidateError && error.code === "INVALID_SCHEMA"
  );

  const submitted = await workflow.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "submit-forged-01" },
    body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision }
  });
  await assert.rejects(
    () => workflow.reviewer.review({
      serviceIdentityId: REVIEWER,
      headers: { "idempotency-key": "forged-reviewer-01" },
      body: {
        workflowId: created.workflowId,
        expectedRevision: submitted.expectedRevision,
        decision: "publish",
        reviewStatus: "manually-reviewed",
        riskLevel: "low",
        reviewerIdentityId: OTHER
      }
    }),
    (error) => error instanceof WorkflowCandidateError && error.code === "INVALID_INPUT"
  );
});

test("reports can unlist public projection without mutating the immutable release", async () => {
  const workflow = candidate();
  const created = await workflow.owner.create(createRequest());
  const submitted = await workflow.owner.submit({
    identityId: AUTHOR,
    headers: { "idempotency-key": "submit-report-0001" },
    body: { workflowId: created.workflowId, expectedRevision: created.expectedRevision }
  });
  const reviewed = await workflow.reviewer.review({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "publish-report-001" },
    body: {
      workflowId: created.workflowId,
      expectedRevision: submitted.expectedRevision,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }
  });
  const immutableRelease = reviewed.release;
  const report = await workflow.owner.report({
    identityId: OTHER,
    headers: { "idempotency-key": "report-release-001" },
    body: { workflowId: created.workflowId, version: 1, reason: "license provenance needs review" }
  });
  assert.equal("reporterIdentityId" in report, false);
  const resolved = await workflow.reviewer.resolveReport({
    serviceIdentityId: REVIEWER,
    headers: { "idempotency-key": "resolve-report-001" },
    body: { reportId: report.reportId, decision: "unlist", reason: "hidden while provenance is checked" }
  });
  assert.equal(resolved.report.status, "resolved");
  assert.deepEqual(reviewed.release, immutableRelease);
  assert.equal(await workflow.lookupPublishedRelease({ workflowId: created.workflowId, version: 1 }), false);
  await assert.rejects(
    () => workflow.public.get({ query: { workflowId: created.workflowId, version: 1 } }),
    (error) => error instanceof WorkflowCandidateError && error.code === "NOT_FOUND"
  );
  assert.equal((await workflow.reviewer.listReports({ serviceIdentityId: REVIEWER, query: { status: "resolved" } })).items.length, 1);
});

test("PostgreSQL candidate is explicitly disabled and its migration is isolated from runtime schema", async () => {
  const pool = {
    query() {
      throw new Error("disabled repository must not query");
    },
    connect() {
      throw new Error("disabled repository must not connect");
    }
  };
  const repository = createPostgresWorkflowRepository({ pool });
  await assert.rejects(
    () => repository.loadEvents(),
    (error) => error instanceof WorkflowCandidateError && error.code === "FEATURE_DISABLED"
  );

  const migration = fs.readFileSync(path.join(__dirname, "../community/migrations/candidates/0001-workflow-store.sql"), "utf8");
  const rollback = fs.readFileSync(path.join(__dirname, "../community/migrations/candidates/0001-workflow-store.rollback.sql"), "utf8");
  const identitySchema = fs.readFileSync(path.join(__dirname, "../identity/schema.sql"), "utf8");
  const identityEntrypoint = fs.readFileSync(path.join(__dirname, "../deployment/community-production/identity-entrypoint.sh"), "utf8");
  const flarumRuntime = fs.readFileSync(path.join(__dirname, "../community/flarum/docker-entrypoint.sh"), "utf8");
  const productionCompose = fs.readFileSync(path.join(__dirname, "../deployment/community-production/compose.server.yaml"), "utf8");
  const workflowRunner = fs.readFileSync(path.join(__dirname, "../deployment/community-production/run-workflow-migration.sh"), "utf8");
  const unrelatedRuntimeContracts = [
    "../deployment/community-production/run-migrations.sh",
    "../deployment/local/compose.yaml",
    "../deployment/admin-only/compose.server.yaml",
    "../community/flarum/migration-entrypoint.sh"
  ].map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");
  assert.match(migration, /Candidate only/);
  assert.match(migration, /CREATE SCHEMA community_workflow/);
  assert.match(migration, /REFERENCES public\.users\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /append-only/);
  assert.match(rollback, /DROP SCHEMA IF EXISTS community_workflow CASCADE/);
  assert.doesNotMatch(identitySchema, /community_workflow/);
  assert.match(identityEntrypoint, /AIHUB_WORKFLOW_MIGRATION_MODE/);
  assert.match(productionCompose, /profiles: \["workflow-migration"\]/);
  assert.match(productionCompose, /AIHUB_WORKFLOW_STORE_ENABLED: "0"/);
  assert.match(workflowRunner, /--profile workflow-migration run --rm/);
  assert.doesNotMatch(flarumRuntime, /workflow-store|community_workflow/);
  assert.doesNotMatch(unrelatedRuntimeContracts, /AIHUB_WORKFLOW_STORE|0001-workflow-store|community_workflow/);
});

test("PostgreSQL repository persists and replays through the same domain state machine", async () => {
  const repository = createPostgresWorkflowRepository({ pool: fakePostgresPool(), enabled: true });
  const first = candidate(true, { repository });
  const created = await first.owner.create(createRequest());
  const replayed = candidate(true, { repository });
  assert.deepEqual(await replayed.owner.get({ identityId: AUTHOR, query: { workflowId: created.workflowId } }), created);
  assert.deepEqual(await replayed.owner.create(createRequest()), created);
});
