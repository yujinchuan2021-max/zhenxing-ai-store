"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  bindOfficialWorkflowSourcePosts,
  bootstrapOfficialWorkflows
} = require("../../community/workflow-official-bootstrap.cjs");
const {
  createCommunityWorkflowCandidate
} = require("../../community/workflow-persistence.cjs");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
} = require("../../identity/workflow-official-publisher-service-identity.cjs");
const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
} = require("../../identity/workflow-reviewer-service-identity.cjs");

const BOOTSTRAP_MANIFEST = Object.freeze(JSON.parse(fs.readFileSync(
  path.resolve(__dirname, "../../community/workflow-official-bootstrap-candidate.json"),
  "utf8"
)));
const SOURCE_POST_KEYS = Object.freeze(BOOTSTRAP_MANIFEST.workflows.map((workflow) => workflow.sourcePostKey));
const FLAG_KEYS = Object.freeze([
  "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
  "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
  "AIHUB_WORKFLOW_STORE_ENABLED",
  "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
  "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED",
  "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
]);
const DISABLED_FLAG_PROFILE = Object.freeze(["0", "0", "0", "0", "0", "0"]);
const WORKFLOW_ONLY_FLAG_PROFILE = Object.freeze(["0", "0", "1", "1", "0", "1"]);
const LEGACY_ENABLED_FLAG_PROFILE = Object.freeze(["1", "1", "1", "1", "1", "1"]);
const ACTIVE6_STATE_SHA256 = "abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9";
const OLD_ADMIN_IMAGE_ID = "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2";
const OLD_IDENTITY_IMAGE_ID = "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOURCE_POST_READBACK_PROGRAM = String.raw`
const fs=require('fs');
const {createLocalFlarumAdminRequest,readExistingOfficialSourcePosts,validateOfficialSourcePostManifest}=require('/app/community/workflow-official-source-posts.cjs');
const {parseForumApiKeyFile}=require('/app/identity/workflow-official-bootstrap-production.cjs');
const manifest=validateOfficialSourcePostManifest(JSON.parse(fs.readFileSync('/app/community/workflow-official-source-posts-candidate.json','utf8')));
const apiKey=parseForumApiKeyFile(fs.readFileSync('/run/secrets/forum_api_key','utf8'));
const requestFlarum=createLocalFlarumAdminRequest({apiKey,fetchImpl:globalThis.fetch});
readExistingOfficialSourcePosts({manifest,requestFlarum}).then(items=>process.stdout.write(JSON.stringify({schema:'aihub-workflow-official-source-post-readback-v1',status:'pass',checkedKeys:manifest.posts.map(post=>post.key),sourcePostCount:items.length,items})+'\n')).catch(()=>{process.exitCode=1});
`.trim();

function blocked() {
  throw new Error("existing Workflow state is invalid");
}

function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) blocked();
  return value;
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

function same(left, right) {
  return stableJson(left) === stableJson(right);
}

function productionFlagState(inspect) {
  if (!Array.isArray(inspect) || inspect.length !== 1 || !Array.isArray(inspect[0]?.Config?.Env)) blocked();
  const pairs = inspect[0].Config.Env.map((entry) => String(entry).split(/=(.*)/s).slice(0, 2));
  const values = FLAG_KEYS.map((key) => pairs.filter(([name]) => name === key).map(([, value]) => value));
  if (values.some((entries) => entries.length !== 1)) blocked();
  const flags = values.map(([value]) => value);
  if (same(flags, DISABLED_FLAG_PROFILE)) return "disabled";
  if (same(flags, WORKFLOW_ONLY_FLAG_PROFILE)) return "workflow-only";
  if (same(flags, LEGACY_ENABLED_FLAG_PROFILE)) return "legacy-enabled";
  blocked();
}

function verifiedSourcePosts(value) {
  exactObject(value, ["schema", "status", "checkedKeys", "sourcePostCount", "items"]);
  if (value.schema !== "aihub-workflow-official-source-post-readback-v1" || value.status !== "pass" ||
      !same(value.checkedKeys, SOURCE_POST_KEYS) || !Array.isArray(value.items) ||
      value.sourcePostCount !== value.items.length || ![0, SOURCE_POST_KEYS.length].includes(value.items.length)) blocked();
  const items = value.items.map((item, index) => {
    exactObject(item, ["key", "discussionId", "postId"]);
    if (item.key !== SOURCE_POST_KEYS[index] || !/^[1-9][0-9]{0,9}$/.test(item.discussionId) ||
        !/^[1-9][0-9]{0,9}$/.test(item.postId) || Number(item.discussionId) > 4294967295 ||
        Number(item.postId) > 4294967295) blocked();
    return { key: item.key, discussionId: item.discussionId, postId: item.postId };
  });
  return items;
}

function commonDatabaseState(database) {
  exactObject(database, [
    "schemaState", "appendOnlyTriggers", "eventHeadRows", "eventHead",
    "reviewerExact", "reviewerForbiddenRelations", "publisherExact",
    "publisherForbiddenRelations", "officialSourceMarkerDiscussions", "events", "idempotency"
  ]);
  if (database.schemaState !== "present|present|present" || database.appendOnlyTriggers !== 1 ||
      database.eventHeadRows !== 1 || database.reviewerExact !== 1 ||
      database.reviewerForbiddenRelations !== 0 || !Array.isArray(database.events) ||
      !Array.isArray(database.idempotency) || !Number.isSafeInteger(database.eventHead) ||
      !Number.isSafeInteger(database.officialSourceMarkerDiscussions) ||
      database.officialSourceMarkerDiscussions < 0) blocked();
}

function validateEventRows(database, boundManifest) {
  if (database.events.length !== 9 || database.idempotency.length !== 9 || database.eventHead !== 9 ||
      database.publisherExact !== 1 || database.publisherForbiddenRelations !== 0) blocked();
  const expectedOperations = ["createDraft", "submitDraft", "reviewSubmission"];
  const expectedSuffixes = ["create", "submit", "review"];
  const expectedActors = [
    WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
  ];
  const workflowIds = [];
  for (let workflowIndex = 0; workflowIndex < boundManifest.workflows.length; workflowIndex += 1) {
    const manifestWorkflow = boundManifest.workflows[workflowIndex];
    const group = database.events.slice(workflowIndex * 3, workflowIndex * 3 + 3);
    const create = group[0];
    exactObject(create, ["sequence", "operation", "actorIdentityId", "eventData", "timestampExact"]);
    exactObject(create.eventData, ["operation", "actorIdentityId", "input", "at", "generatedIds"]);
    if (!Array.isArray(create.eventData.generatedIds) || create.eventData.generatedIds.length !== 1 ||
        !UUID_PATTERN.test(create.eventData.generatedIds[0])) blocked();
    const workflowId = create.eventData.generatedIds[0].toLowerCase();
    workflowIds.push(workflowId);
    const expectedInputs = [
      {
        authorIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
        sourceCommunityPostId: manifestWorkflow.sourceCommunityPostId,
        provenance: manifestWorkflow.provenance,
        content: manifestWorkflow.content
      },
      { workflowId, authorIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID },
      {
        workflowId,
        reviewerIdentityId: WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
        decision: "publish",
        reviewStatus: manifestWorkflow.review.reviewStatus,
        riskLevel: manifestWorkflow.review.riskLevel
      }
    ];
    group.forEach((event, operationIndex) => {
      exactObject(event, ["sequence", "operation", "actorIdentityId", "eventData", "timestampExact"]);
      exactObject(event.eventData, ["operation", "actorIdentityId", "input", "at", "generatedIds"]);
      const expectedSequence = workflowIndex * 3 + operationIndex + 1;
      if (event.sequence !== expectedSequence || event.operation !== expectedOperations[operationIndex] ||
          event.actorIdentityId !== expectedActors[operationIndex] || event.eventData.operation !== event.operation ||
          event.eventData.actorIdentityId !== event.actorIdentityId || event.timestampExact !== true ||
          Number.isNaN(Date.parse(event.eventData.at)) || !same(event.eventData.input, expectedInputs[operationIndex]) ||
          (operationIndex > 0 && (!Array.isArray(event.eventData.generatedIds) || event.eventData.generatedIds.length !== 0))) blocked();
    });
    const idempotencyGroup = database.idempotency.slice(workflowIndex * 3, workflowIndex * 3 + 3);
    idempotencyGroup.forEach((entry, operationIndex) => {
      exactObject(entry, ["actorIdentityId", "keyHash", "requestHash", "response", "eventSequence"]);
      const eventSequence = workflowIndex * 3 + operationIndex + 1;
      const key = `${BOOTSTRAP_MANIFEST.bootstrapId}:${manifestWorkflow.key}:${expectedSuffixes[operationIndex]}`;
      const expectedRevision = operationIndex === 0 ? undefined : operationIndex;
      const requestHash = sha256(stableJson({
        operation: expectedOperations[operationIndex],
        input: expectedInputs[operationIndex],
        expectedRevision
      }));
      if (entry.actorIdentityId !== expectedActors[operationIndex] || entry.eventSequence !== eventSequence ||
          entry.keyHash !== sha256(key) || entry.requestHash !== requestHash ||
          !entry.response || typeof entry.response !== "object" || Array.isArray(entry.response)) blocked();
    });
  }
  if (new Set(workflowIds).size !== 3) blocked();
}

async function verifyIdempotentReplay(database, boundManifest) {
  let commits = 0;
  const repository = {
    async loadEvents() {
      return database.events.map((row) => ({ sequence: row.sequence, ...structuredClone(row.eventData) }));
    },
    async getIdempotency(actorIdentityId, keyHash) {
      const matches = database.idempotency.filter((entry) => entry.actorIdentityId === actorIdentityId && entry.keyHash === keyHash);
      if (matches.length !== 1) return null;
      return { requestHash: matches[0].requestHash, response: structuredClone(matches[0].response) };
    },
    async commit() { commits += 1; blocked(); }
  };
  const candidate = createCommunityWorkflowCandidate({
    enabled: true,
    repository,
    resolveOwnerIdentity: async () => WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    resolveReviewerIdentity: async () => WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
    resolvePublicIdentity: async () => ({
      identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
      displayName: WORKFLOW_OFFICIAL_PUBLISHER_DISPLAY_NAME
    }),
    hasCanonicalDependency: async () => true,
    hasCanonicalLicense: async () => true,
    hasCommunityPost: async () => true,
    makeId: blocked,
    now: blocked
  });
  let result;
  try {
    result = await bootstrapOfficialWorkflows({
      candidate,
      manifest: boundManifest,
      publisherIdentityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
      reviewerIdentityId: WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID,
      validation: {
        verifyCatalogSnapshot: async () => true,
        hasCanonicalDependency: async () => true,
        hasCommunityPost: async () => true
      }
    });
  } catch {
    blocked();
  }
  if (commits !== 0 || result?.status !== "published" || result.execution !== false ||
      !Array.isArray(result.items) || result.items.length !== 3) blocked();
}

async function verifyExistingWorkflowState({ database, identityInspect, sourcePosts, mode = "baseline" } = {}) {
  if (mode !== "baseline" && mode !== "target") blocked();
  commonDatabaseState(database);
  const flags = productionFlagState(identityInspect);
  const sources = verifiedSourcePosts(sourcePosts);
  const empty = database.events.length === 0 && database.idempotency.length === 0 && database.eventHead === 0 &&
    database.publisherExact === 0 && database.publisherForbiddenRelations === 0 &&
    database.officialSourceMarkerDiscussions === 0 && sources.length === 0;
  if (empty) {
    if (mode !== "baseline" || flags === "workflow-only") blocked();
    return Object.freeze({
      schema: "present", appendOnly: true, events: 0, idempotency: 0, eventHead: 0,
      reviewerExact: 1, reviewerForbiddenRelations: 0, publisherExact: 0,
      publisherForbiddenRelations: 0, sourcePostsExact: 0, officialWorkflows: 0,
      idempotentReplay: false,
      baseline: flags === "legacy-enabled" ? "legacy-enabled-online-empty" : "rolled-back-disabled-empty"
    });
  }
  if ((mode === "baseline" && flags !== "disabled") ||
      (mode === "target" && flags !== "workflow-only") ||
      sources.length !== 3 || database.officialSourceMarkerDiscussions !== 3) blocked();
  const boundManifest = bindOfficialWorkflowSourcePosts(BOOTSTRAP_MANIFEST, sources);
  validateEventRows(database, boundManifest);
  await verifyIdempotentReplay(database, boundManifest);
  return Object.freeze({
    schema: "present", appendOnly: true, events: 9, idempotency: 9, eventHead: 9,
    reviewerExact: 1, reviewerForbiddenRelations: 0, publisherExact: 1,
    publisherForbiddenRelations: 0, sourcePostsExact: 3, officialWorkflows: 3,
    idempotentReplay: true,
    baseline: mode === "target"
      ? "workflow-only-retained-official-bootstrap"
      : "disabled-retained-official-bootstrap"
  });
}

function regularAbsolute(filename) {
  return path.isAbsolute(filename) && fs.existsSync(filename) && fs.lstatSync(filename).isFile() &&
    !fs.lstatSync(filename).isSymbolicLink();
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === "source-post-program") {
    process.stdout.write(`${SOURCE_POST_READBACK_PROGRAM}\n`);
    return;
  }
  if (argv.length !== 4 || argv[0] !== "verify" || argv.slice(1).some((filename) => !regularAbsolute(filename))) blocked();
  const files = argv.slice(1).map((filename) => fs.realpathSync(filename));
  if (new Set(files.map((filename) => path.dirname(filename))).size !== 1) blocked();
  const result = await verifyExistingWorkflowState({
    database: JSON.parse(fs.readFileSync(files[0], "utf8")),
    identityInspect: JSON.parse(fs.readFileSync(files[1], "utf8")),
    sourcePosts: JSON.parse(fs.readFileSync(files[2], "utf8"))
  });
  process.stdout.write(`${JSON.stringify({
    ...result,
    catalogStateSha256: ACTIVE6_STATE_SHA256,
    oldAdminImageId: OLD_ADMIN_IMAGE_ID,
    oldIdentityImageId: OLD_IDENTITY_IMAGE_ID
  })}\n`);
}

if (require.main === module) {
  main().catch(() => { process.exitCode = 1; });
}

module.exports = {
  SOURCE_POST_KEYS,
  SOURCE_POST_READBACK_PROGRAM,
  productionFlagState,
  verifyExistingWorkflowState
};
