"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const { R12 } = require("./workflow-production-r12-in-place.cjs");
const { SERVICES, validateProductionMounts, validateProductionServices } = require("./workflow-production-service-contract.cjs");
const { SECRET_CONSUMERS_BY_PROFILE, validSecretBytes, validatePublishedCatalogMount, validateSecretSnapshot } = require("./workflow-production-secret-authority-contract.cjs");

const RELEASE_PREFIX = "/opt/zhenxing-ai/releases/";
const RELEASE_NAME = /^community-production-(r12|r14|r15|r16|r17|r18|r19|r20|r21|r22|r23|r24|r25|r26|r27)-[A-Za-z0-9][A-Za-z0-9-]{5,64}$/;
const DOCKER = "/usr/bin/docker";
const SYSTEMCTL = "/usr/bin/systemctl";
const PGREP = "/usr/bin/pgrep";
function blocked() { throw new Error("r12 fixed collector is invalid"); }
function validReleaseRoot(releaseRoot) {
  return typeof releaseRoot === "string" && releaseRoot.startsWith(RELEASE_PREFIX) &&
    path.posix.dirname(releaseRoot) === RELEASE_PREFIX.slice(0, -1) && RELEASE_NAME.test(path.posix.basename(releaseRoot));
}
function releaseNamespace(releaseRoot) {
  const match = RELEASE_NAME.exec(path.posix.basename(releaseRoot));
  if (!match) blocked();
  return match[1];
}
function exact(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
const TARGET_FAILURE_CODES = Object.freeze({
  services: "FRESH_HOST_TARGET_SERVICES_FAILED",
  mount: "FRESH_HOST_TARGET_MOUNT_FAILED",
  flags: "FRESH_HOST_TARGET_FLAGS_FAILED",
  secret: "FRESH_HOST_TARGET_SECRET_FAILED",
  catalog: "FRESH_HOST_TARGET_CATALOG_FAILED",
  "source-public": "FRESH_HOST_TARGET_SOURCE_PUBLIC_FAILED",
  "resource-capability": "FRESH_HOST_TARGET_RESOURCE_CAPABILITY_FAILED",
  "workflow-capability": "FRESH_HOST_WORKFLOW_CAPABILITY_NOT_READY",
  database: "FRESH_HOST_TARGET_DATABASE_FAILED",
  "existing-state": "FRESH_HOST_TARGET_EXISTING_STATE_FAILED",
  "final-target-assertions": "FRESH_HOST_TARGET_FINAL_ASSERTIONS_FAILED",
  "target-unknown": "FRESH_HOST_TARGET_UNKNOWN_FAILED"
});
function targetFailure(stage) {
  const code = TARGET_FAILURE_CODES[stage];
  if (typeof code !== "string") return targetFailure("target-unknown");
  const error = new Error("fresh host target check failed");
  error.code = code;
  error.targetFailure = Object.freeze({ stage, code });
  return error;
}
function targetFailureTerminal(error) {
  const failure = error?.targetFailure;
  return exact(failure, ["stage", "code"]) && TARGET_FAILURE_CODES[failure.stage] === failure.code
    ? Object.freeze({ stage: failure.stage, code: failure.code })
    : Object.freeze({ stage: "target-unknown", code: TARGET_FAILURE_CODES["target-unknown"] });
}
async function targetStep(stage, action) {
  if (!Object.hasOwn(TARGET_FAILURE_CODES, stage) || typeof action !== "function") throw targetFailure("target-unknown");
  try { return await action(); }
  catch (error) {
    if (exact(error?.targetFailure, ["stage", "code"]) && TARGET_FAILURE_CODES[error.targetFailure.stage] === error.targetFailure.code) throw error;
    throw targetFailure(stage);
  }
}
function sanitizeCollectorReceipt(snapshot) {
  const keys = ["projectName", "concurrentRuns", "services", "flags", "activeCatalog", "resourceSubmissionTables", "preservedDataRoles", "publicWorkflowCount"];
  return Object.freeze(Object.fromEntries(keys.filter((key) => Object.hasOwn(snapshot || {}, key)).map((key) => [key, snapshot[key]])));
}
function defaultExecute(file, args, options) { return childProcess.spawnSync(file, args, { ...options, encoding: "utf8" }); }
function parseResult(result) {
  if (!result || result.status !== 0 || result.error || result.signal || result.stderr) blocked();
  return String(result.stdout || "").trim();
}
function fixedProcess(executeFile, file, args) {
  if (![SYSTEMCTL, PGREP].includes(file) || !Array.isArray(args)) blocked();
  return executeFile(file, args, Object.freeze({ shell: false, env: Object.freeze({ LC_ALL: "C" }), maxBuffer: 64 * 1024 }));
}
function fixedDocker(executeFile, args) {
  if (!Array.isArray(args) || !["inspect", "exec", "ps"].includes(args[0])) blocked();
  return parseResult(executeFile(DOCKER, args, Object.freeze({ shell: false, env: Object.freeze({ LC_ALL: "C" }), maxBuffer: 512 * 1024 })));
}
function expectedResourcesAbsent(text) {
  const names = String(text).trim().split(/\s*,\s*/).filter(Boolean);
  if (names.length !== 0) blocked();
  return [];
}
function environment(inspect, key) {
  const values = (inspect?.Config?.Env || []).filter((entry) => typeof entry === "string" && entry.startsWith(`${key}=`));
  if (values.length !== 1) blocked();
  return values[0].slice(key.length + 1);
}
function host(value) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])$/i.test(value)) blocked();
  return value;
}
function forumApiKeyFromAuthority(source, fsImpl = fs) {
  const bytes = fsImpl.readFileSync(source);
  if (!validSecretBytes("forum_api_key", bytes)) blocked();
  return bytes.subarray(0, -1).toString("utf8");
}
const RESOURCE_CAPABILITY = Object.freeze({
  enabled: false,
  supportedKinds: Object.freeze(["vendor", "agent", "skill", "mcp", "plugin", "connector", "workflow"]),
  temporarilyUnavailableKinds: Object.freeze(["workflow"]),
  authenticationRequired: true,
  proposalSchemaVersion: 1
});
const PUBLIC_DISABLED = Object.freeze({ error: Object.freeze({ code: "FEATURE_DISABLED", status: 503, messageKey: "workflow.public.unavailable" }) });
const PUBLIC_WORKFLOW_KEYS = Object.freeze(["author", "content", "originalAuthorDisplayName", "provenance", "releasedAt", "requiresPerUseConfirmation", "reviewStatus", "riskLevel", "sourceCommunityPostId", "version", "workflowId"]);
const TARGET_CAPABILITY_TIMEOUT_MS = 30_000;
const TARGET_CAPABILITY_INTERVAL_MS = 250;
const TARGET_CAPABILITY_REQUEST_TIMEOUT_MS = 10_000;
function exactJson(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) blocked();
  return true;
}
function validatePublicList(mode, response) {
  if (!exact(response, ["status", "value"])) blocked();
  if (mode === "baseline") {
    if (response.status !== 503) blocked();
    exactJson(response.value, PUBLIC_DISABLED);
    return 0;
  }
  if (response.status !== 200 || !exact(response.value, ["items", "next"]) || response.value.next !== null ||
      !Array.isArray(response.value.items) || response.value.items.length !== 3 ||
      response.value.items.some((item) => !exact(item, PUBLIC_WORKFLOW_KEYS))) blocked();
  return 3;
}
function validateResourceCapability(response) {
  if (!exact(response, ["status", "body"]) || response.status !== 200) blocked();
  return exactJson(response.body, RESOURCE_CAPABILITY);
}
function createTargetWorkflowCapabilityProbeProgram(
  timeoutMs = TARGET_CAPABILITY_TIMEOUT_MS,
  intervalMs = TARGET_CAPABILITY_INTERVAL_MS,
  requestTimeoutMs = TARGET_CAPABILITY_REQUEST_TIMEOUT_MS
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TARGET_CAPABILITY_TIMEOUT_MS ||
      !Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > TARGET_CAPABILITY_INTERVAL_MS ||
      !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > TARGET_CAPABILITY_REQUEST_TIMEOUT_MS) blocked();
  return String.raw`
const deadline=Date.now()+${timeoutMs};let attempts=0;let last={status:0,enabled:false};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function probe(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.min(${requestTimeoutMs},Math.max(1,deadline-Date.now())));try{const response=await fetch('http://127.0.0.1:4180/v1/community/workflow-store/capability',{method:'GET',headers:{accept:'application/json'},redirect:'manual',signal:controller.signal});const text=await response.text();let body=null;try{body=JSON.parse(text)}catch{}const enabled=response.status===200&&body!==null&&Object.keys(body).length===4&&body.enabled===true&&body.schemaVersion===1&&body.execution===false&&body.workflowSubmissionLookup===false;return {status:response.status,enabled}}catch{return {status:0,enabled:false}}finally{clearTimeout(timer)}}
(async()=>{while(Date.now()<deadline){attempts+=1;const observed=await probe();if(observed.status!==0||last.status===0)last=observed;if(observed.status===200&&observed.enabled)break;const remaining=deadline-Date.now();if(remaining>0)await pause(Math.min(${intervalMs},remaining))}process.stdout.write(JSON.stringify({status:last.status,enabled:last.status===200&&last.enabled===true,attemptCount:Math.max(attempts,1)}))})().catch(()=>{process.stdout.write(JSON.stringify({status:0,enabled:false,attemptCount:Math.max(attempts,1)}));process.exitCode=2});`;
}
function parseTargetWorkflowCapabilityProbe(output) {
  try {
    const value = JSON.parse(String(output));
    if (!exact(value, ["status", "enabled", "attemptCount"]) || !Number.isSafeInteger(value.status) ||
        (value.status !== 0 && (value.status < 100 || value.status > 599)) || typeof value.enabled !== "boolean" ||
        (value.status !== 200 && value.enabled !== false) || !Number.isSafeInteger(value.attemptCount) ||
        value.attemptCount < 1 || value.attemptCount > 10_000) blocked();
    return Object.freeze({ status: value.status, enabled: value.enabled, attemptCount: value.attemptCount });
  } catch { return Object.freeze({ status: 0, enabled: false, attemptCount: 1 }); }
}
function targetWorkflowCapability(executeFile, identityContainer) {
  try {
    const value = parseTargetWorkflowCapabilityProbe(fixedDocker(executeFile, ["exec", identityContainer, "node", "-e", createTargetWorkflowCapabilityProbeProgram()]));
    if (value.status === 200 && value.enabled) return value;
  } catch {}
  const error = new Error("workflow target capability is not ready");
  error.code = "FRESH_HOST_WORKFLOW_CAPABILITY_NOT_READY";
  throw error;
}
function httpsGet(publicHost, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    if (typeof requestPath !== "string" || !requestPath.startsWith("/")) return reject(new Error("r12 fixed collector is invalid"));
    const request = https.request({ host: "127.0.0.1", port: 443, servername: publicHost, method: "GET", path: requestPath, headers: { ...headers, Host: publicHost }, agent: false, rejectUnauthorized: true }, (response) => {
      const chunks = []; let bytes = 0;
      response.on("data", (chunk) => { bytes += chunk.length; if (bytes > 1024 * 1024) response.destroy(); else chunks.push(chunk); });
      response.on("end", () => {
        if (bytes > 1024 * 1024 || response.headers.location) return reject(new Error("r12 fixed collector is invalid"));
        try { resolve(Object.freeze({ status: response.statusCode, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) })); } catch { reject(new Error("r12 fixed collector is invalid")); }
      });
    });
    request.setTimeout(10_000, () => request.destroy(new Error("timeout")));
    request.on("error", reject); request.end();
  });
}
const PG_READ_SQL = "BEGIN TRANSACTION READ ONLY; SELECT current_database() || '|' || current_user; SELECT json_build_object('schemaState',(SELECT concat_ws('|',CASE WHEN to_regclass('community_workflow.event_head') IS NULL THEN 'missing' ELSE 'present' END,CASE WHEN to_regclass('community_workflow.events') IS NULL THEN 'missing' ELSE 'present' END,CASE WHEN to_regclass('community_workflow.idempotency') IS NULL THEN 'missing' ELSE 'present' END)),'appendOnlyTriggers',(SELECT count(*)::int FROM pg_trigger WHERE tgname='community_workflow_events_append_only' AND tgrelid='community_workflow.events'::regclass AND NOT tgisinternal),'eventHeadRows',(SELECT count(*)::int FROM community_workflow.event_head WHERE singleton=true),'eventHead',(SELECT last_sequence::int FROM community_workflow.event_head WHERE singleton=true),'reviewerExact',(SELECT count(*)::int FROM public.users WHERE id='5f16d5ac-6663-5905-b920-c2140ac6769c' AND identity_kind='workflow-reviewer-service' AND status='disabled' AND email IS NULL AND normalized_email IS NULL AND phone IS NULL AND normalized_phone IS NULL AND password_hash IS NULL AND username='__workflow_reviewer_service__' AND normalized_username='__workflow_reviewer_service__' AND community_username='zx_5f16d5ac66635905b920c2140ac'),'reviewerForbiddenRelations',(SELECT count(*)::int FROM public.community_profiles WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.profile_avatars WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.devices WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.sessions WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.community_handoffs WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c')+(SELECT count(*)::int FROM public.email_change_challenges WHERE user_id='5f16d5ac-6663-5905-b920-c2140ac6769c'),'publisherExact',(SELECT count(*)::int FROM public.users WHERE id='46564566-f5f4-599c-8ce5-0609069f5148' AND identity_kind='workflow-official-publisher-service' AND status='disabled' AND email IS NULL AND normalized_email IS NULL AND phone IS NULL AND normalized_phone IS NULL AND password_hash IS NULL AND username='__workflow_official_publisher_service__' AND normalized_username='__workflow_official_publisher_service__' AND community_username='zx_46564566f5f4599c8ce50609069'),'publisherForbiddenRelations',(SELECT count(*)::int FROM public.community_profiles WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.profile_avatars WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.devices WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.sessions WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.community_handoffs WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148')+(SELECT count(*)::int FROM public.email_change_challenges WHERE user_id='46564566-f5f4-599c-8ce5-0609069f5148'),'officialSourceMarkerDiscussions',3,'events',COALESCE((SELECT json_agg(json_build_object('sequence',e.sequence::int,'operation',e.operation,'actorIdentityId',e.actor_identity_id::text,'eventData',e.event_data,'timestampExact',e.created_at=(e.event_data->>'at')::timestamptz) ORDER BY e.sequence) FROM community_workflow.events e),'[]'::json),'idempotency',COALESCE((SELECT json_agg(json_build_object('actorIdentityId',i.actor_identity_id::text,'keyHash',i.key_hash::text,'requestHash',i.request_hash::text,'response',i.response,'eventSequence',i.event_sequence::int) ORDER BY i.event_sequence) FROM community_workflow.idempotency i),'[]'::json))::text; COMMIT;";
const PG_SECRET_PROGRAM = 'PGPASSWORD="$(cat /run/secrets/identity_db_password)" exec psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U aihub -d aihub -At -c "$1"';
function databaseState(executeFile, container) {
  const output = fixedDocker(executeFile, ["exec", container, "/bin/sh", "-ec", PG_SECRET_PROGRAM, "r12-pg-read", PG_READ_SQL]);
  if (output.split(/\r?\n/)[0] !== "aihub|aihub") blocked();
  const line = output.split(/\r?\n/).find((value) => value.startsWith("{"));
  try { return JSON.parse(line || "null"); } catch { blocked(); }
}
function resourceTables(executeFile, container) {
  const sql = "BEGIN READ ONLY; SELECT coalesce(string_agg(relname,','),'') FROM pg_class WHERE relname IN ('resource_submissions','resource_submission_idempotency','resource_submission_audit','resource_submission_source_revisions','resource_submission_abuse_reports'); COMMIT;";
  return expectedResourcesAbsent(fixedDocker(executeFile, ["exec", container, "/bin/sh", "-ec", PG_SECRET_PROGRAM, "r12-pg-resources", sql]));
}
function markerDiscussionCount(executeFile) {
  const container = SERVICES.find((entry) => entry.key === "communityDatabase").containerName;
  const program = "MYSQL_PWD=\"$(cat /run/secrets/forum_db_password)\" exec mariadb -u aihub_forum -N -B aihub_forum -e \"START TRANSACTION READ ONLY; SELECT COUNT(*) FROM discussions WHERE title LIKE '% [AIHUBWFOS%V1]'; COMMIT\"";
  const value = fixedDocker(executeFile, ["exec", container, "sh", "-ec", program]);
  if (!/^[0-9]+$/.test(value) || Number(value) !== 3) blocked();
  return 3;
}
function validateTargetCatalog({ v1Channel, v1Release, v2Channel, v2Release }) {
  const release = v2Release?.release;
  if (v1Channel?.activeRelease?.releaseId !== R12.v1.releaseId || v1Release?.release?.releaseId !== R12.v1.releaseId ||
      v1Release?.release?.catalogVersion !== R12.v1.catalogVersion || v1Release.release.sha256 !== R12.v1.releaseSha256 ||
      v1Release.envelope?.payload?.catalogSha256 !== R12.v1.catalogSha256 || v2Channel?.activeRelease?.releaseId !== R12.active7.releaseId ||
      release?.releaseId !== R12.active7.releaseId || release.sha256 !== R12.active7.releaseSha256 || release.catalogVersion !== 7 || v2Release.envelope?.payload?.catalogSha256 !== "8c49e1972186f841dca9cea8f26074fe27aed9a140e4f5687cf7f23d134f034c") blocked();
}
function validateBaselineCatalog({ v1Channel, v1Release, v2Channel, v2Release }) {
  const v2 = v2Release?.release; const v1 = v1Release?.release;
  if (v2Channel?.activeRelease?.releaseId !== R12.active6.releaseId || v2?.releaseId !== R12.active6.releaseId || v2.sha256 !== R12.active6.releaseSha256 || v2.catalogVersion !== 6 || v2Release.envelope?.payload?.catalogSha256 !== "567e671621f14d7788ecdbe642be738aa5133d9688d45bbae4d0f7760a926d9f" ||
      v1Channel?.activeRelease?.releaseId !== R12.v1.releaseId || v1?.releaseId !== R12.v1.releaseId || v1.catalogVersion !== R12.v1.catalogVersion ||
      v1.sha256 !== R12.v1.releaseSha256 || v1Release.envelope?.payload?.catalogSha256 !== R12.v1.catalogSha256) blocked();
}
function stateDigest(published, expected, fsImpl = fs) {
  const statePath = path.join(published, "catalog-store", "state.json");
  const canonical = fsImpl.realpathSync(statePath);
  const stat = fsImpl.lstatSync(statePath);
  if (canonical !== statePath || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      stat.uid !== 1000 || stat.gid !== 1000 || (stat.mode & 0o777) !== 0o600) blocked();
  const digest = crypto.createHash("sha256").update(fsImpl.readFileSync(statePath)).digest("hex");
  if (digest !== expected) blocked();
  return digest;
}
function collectServices(executeFile, profile) {
  const output = fixedDocker(executeFile, ["inspect", ...SERVICES.map((service) => service.containerName)]);
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || parsed.length !== SERVICES.length) blocked();
  const inspectAll = Object.fromEntries(SERVICES.map((service) => [service.key, parsed.find((entry) => entry?.Name === `/${service.containerName}`)]));
  if (Object.values(inspectAll).some((entry) => !entry)) blocked();
  validateProductionServices(inspectAll, profile === "baseline" ? "baseline" : "target");
  return inspectAll;
}
function unitState(executeFile, unit) {
  const result = fixedProcess(executeFile, SYSTEMCTL, ["show", "--no-pager", "--property=LoadState", "--property=ActiveState", "--property=SubState", unit]);
  if (!result || result.status !== 0 || result.error || result.signal || result.stderr) blocked();
  const values = Object.fromEntries(String(result.stdout || "").trim().split(/\r?\n/).map((line) => line.split("=", 2)));
  if (!exact(values, ["LoadState", "ActiveState", "SubState"])) blocked();
  return values;
}
function assertNoConcurrentRun(executeFile, namespace) {
  if (!new Set(["r12", "r14", "r15", "r16", "r17", "r18", "r19", "r20", "r21", "r22", "r23", "r24", "r25", "r26", "r27"]).has(namespace)) blocked();
  const generation = Number(namespace.slice(1));
  const oldUnits = Array.from({ length: generation - 5 }, (_, index) => `zhenxing-ai-workflow-production-r${index + 5}.service`);
  for (const unit of oldUnits) {
    const state = unitState(executeFile, unit);
    if (state.LoadState !== "not-found" || state.ActiveState !== "inactive" || state.SubState !== "dead") blocked();
  }
  const current = unitState(executeFile, `zhenxing-ai-workflow-production-${namespace}.service`);
  if (current.LoadState !== "loaded" || current.ActiveState !== "active" || current.SubState !== "running") blocked();
  const legacy = Array.from({ length: generation - 5 }, (_, index) => `r${index + 5}`).join("|");
  const processes = fixedProcess(executeFile, PGREP, ["-f", `workflow-production-(release-bundle-cutover|cutover|${legacy})`]);
  if (!processes || processes.error || processes.signal || ![0, 1].includes(processes.status) || processes.stderr || processes.status === 0 || String(processes.stdout || "").trim()) blocked();
  const currentPattern = namespace === "r12" ? "workflow-production-r12-prepared-coordinator\\.cjs$" : "workflow-production-fresh-host-preflight\\.cjs target$";
  const currentProcess = fixedProcess(executeFile, PGREP, ["-f", currentPattern]);
  const currentPids = String(currentProcess?.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  if (!currentProcess || currentProcess.status !== 0 || currentProcess.error || currentProcess.signal || currentProcess.stderr ||
      currentPids.length !== 1 || !/^[1-9][0-9]*$/.test(currentPids[0]) || Number(currentPids[0]) !== process.pid) blocked();
  const services = fixedDocker(executeFile, ["ps", "--all", "--filter", `label=com.docker.compose.project=${R12.projectName}`, "--format", "{{.Label \"com.docker.compose.service\"}}"])
    .split(/\r?\n/).filter(Boolean).sort();
  const expected = SERVICES.map((service) => service.composeService).sort();
  if (JSON.stringify(services) !== JSON.stringify(expected)) blocked();
  return 0;
}
function assertNoConcurrentR12Run(executeFile) { return assertNoConcurrentRun(executeFile, "r12"); }
function assertNoConcurrentR14Run(executeFile) { return assertNoConcurrentRun(executeFile, "r14"); }
function assertNoConcurrentR15Run(executeFile) { return assertNoConcurrentRun(executeFile, "r15"); }
function assertNoConcurrentR16Run(executeFile) { return assertNoConcurrentRun(executeFile, "r16"); }
function assertNoConcurrentR17Run(executeFile) { return assertNoConcurrentRun(executeFile, "r17"); }
function assertNoConcurrentR18Run(executeFile) { return assertNoConcurrentRun(executeFile, "r18"); }
function assertNoConcurrentR24Run(executeFile) { return assertNoConcurrentRun(executeFile, "r24"); }
function assertNoConcurrentR25Run(executeFile) { return assertNoConcurrentRun(executeFile, "r25"); }
function assertNoConcurrentR26Run(executeFile) { return assertNoConcurrentRun(executeFile, "r26"); }
function assertNoConcurrentR27Run(executeFile) { return assertNoConcurrentRun(executeFile, "r27"); }
function createR12FixedCollector(options = {}) {
  if (!exact(options, Object.hasOwn(options || {}, "executeFile") ? ["releaseRoot", "executeFile"] : ["releaseRoot"]) || !validReleaseRoot(options.releaseRoot)) blocked();
  const executeFile = options.executeFile || defaultExecute;
  if (typeof executeFile !== "function") blocked();
  const collect = async (mode, args) => {
    if ((mode !== "baseline" && mode !== "target") || args.length !== 0) blocked();
    const step = (stage, action) => mode === "target" ? targetStep(stage, action) : action();
    try {
      const inspectAll = await step("services", () => collectServices(executeFile, mode));
      await step("mount", () => validateProductionMounts({ inspectAll, profile: mode, environment: process.env, releaseRoot: options.releaseRoot, fsImpl: fs, secretConsumers: SECRET_CONSUMERS_BY_PROFILE[mode] }));
      const identity = inspectAll.identity;
      const existing = require(path.join(options.releaseRoot, "deployment", "community-production", "workflow-production-existing-state.cjs"));
      const flags = await step("flags", () => {
        const value = existing.productionFlagState([identity]);
        if (value !== (mode === "baseline" ? "disabled" : "workflow-only")) blocked();
        return value;
      });
      const published = await step("catalog", () => validatePublishedCatalogMount({ inspect: inspectAll.admin, fsImpl: fs }));
      await step("secret", () => validateSecretSnapshot({ inspectAll, fsImpl: fs, environment: process.env, profile: mode }));
      const identityDatabase = SERVICES.find((entry) => entry.key === "identityDatabase").containerName;
      const resources = await step("resource-capability", () => resourceTables(executeFile, identityDatabase));
      const { stateSha256 } = await step("catalog", async () => {
        const createReleaseStore = require(path.join(options.releaseRoot, "admin", "release-store.cjs")).createReleaseStore;
        const store = createReleaseStore({ rootDirectory: path.join(published, "catalog-store"), signingKeyProvider: async () => { blocked(); } });
        const [v1Channel, v2Channel] = await Promise.all([store.readChannel("v1"), store.readChannel("v2")]);
        const [v1Release, v2Release] = await Promise.all([store.readRelease(v1Channel.activeRelease.releaseId, { channel: "v1" }), store.readRelease(v2Channel.activeRelease.releaseId, { channel: "v2" })]);
        if (mode === "baseline") validateBaselineCatalog({ v1Channel, v1Release, v2Channel, v2Release });
        else validateTargetCatalog({ v1Channel, v1Release, v2Channel, v2Release });
        return { stateSha256: stateDigest(published, mode === "baseline" ? R12.active6.stateSha256 : R12.active7.stateSha256) };
      });
      const source = await step("source-public", async () => {
        const caddy = inspectAll.caddy;
        const mainHost = host(environment(caddy, "AIHUB_PUBLIC_HOST"));
        const communityHost = host(environment(caddy, "AIHUB_COMMUNITY_PUBLIC_HOST"));
        if (mainHost === communityHost) blocked();
        const markerCount = markerDiscussionCount(executeFile);
        const sourcePostsModule = require(path.join(options.releaseRoot, "community", "workflow-official-source-posts.cjs"));
        const forumMount = (inspectAll.community.Mounts || []).filter((mount) => mount.Destination === "/run/secrets/forum_api_key");
        if (forumMount.length !== 1) blocked();
        const apiKey = forumApiKeyFromAuthority(forumMount[0].Source);
        const manifest = sourcePostsModule.validateOfficialSourcePostManifest(JSON.parse(fs.readFileSync(path.join(options.releaseRoot, "community", "workflow-official-source-posts-candidate.json"), "utf8")));
        const sourcePosts = Object.freeze({ schema: "aihub-workflow-official-source-post-readback-v1", status: "pass", checkedKeys: manifest.posts.map((post) => post.key), sourcePostCount: 0, items: await sourcePostsModule.readExistingOfficialSourcePosts({ manifest, requestFlarum: async (request) => {
          if (!exact(request, ["method", "path"]) || request.method !== "GET" || !/^\/api\/(?:discussions\?filter%5Bq%5D=AIHUBWFOS(?:CHATGPTDESKTOP|CODEXCLIREVIEW|CLAUDEDESKTOP)V1&page%5Blimit%5D=20|posts\/[1-9][0-9]{0,9})$/.test(request.path)) blocked();
          return httpsGet(communityHost, request.path, { Accept: "application/vnd.api+json", Authorization: `Token ${apiKey}; userId=1` });
        } }) });
        const publicList = await httpsGet(mainHost, "/v1/community/workflow-store/public/list?limit=50");
        return { markerCount, sourcePosts: Object.freeze({ ...sourcePosts, sourcePostCount: sourcePosts.items.length }), publicWorkflowCount: validatePublicList(mode, publicList) };
      });
      const capabilityProgram = "const http=require('http');const p=process.argv[1];const r=http.get({host:'127.0.0.1',port:4180,path:p,agent:false},x=>{const a=[];x.on('data',v=>a.push(v));x.on('end',()=>process.stdout.write(JSON.stringify({status:x.statusCode,body:JSON.parse(Buffer.concat(a))}))) });r.setTimeout(10000,()=>r.destroy());r.on('error',()=>process.exit(2));";
      const identityContainer = SERVICES.find((entry) => entry.key === "identity").containerName;
      await step("resource-capability", () => validateResourceCapability(JSON.parse(fixedDocker(executeFile, ["exec", identityContainer, "node", "-e", capabilityProgram, "/v1/resource-submissions/capability"]))));
      if (mode === "target") await step("workflow-capability", () => targetWorkflowCapability(executeFile, identityContainer));
      else {
        const workflowCapability = JSON.parse(fixedDocker(executeFile, ["exec", identityContainer, "node", "-e", capabilityProgram, "/v1/community/workflow-store/capability"]));
        if (workflowCapability.status !== 200 || !exact(workflowCapability.body, ["enabled", "schemaVersion", "execution", "workflowSubmissionLookup"]) || workflowCapability.body.schemaVersion !== 1 || workflowCapability.body.execution !== false || workflowCapability.body.enabled !== false || workflowCapability.body.workflowSubmissionLookup !== false) blocked();
      }
      const database = await step("database", () => {
        const value = databaseState(executeFile, identityDatabase);
        if (value.officialSourceMarkerDiscussions !== source.markerCount) blocked();
        return value;
      });
      const concurrentRuns = await step("services", () => assertNoConcurrentRun(executeFile, releaseNamespace(options.releaseRoot)));
      return Object.freeze({
        projectName: R12.projectName,
        concurrentRuns,
        services: R12.services.map((name) => ({ name, health: "healthy" })),
        flags: { profile: flags },
        activeCatalog: mode === "baseline"
          ? { stateSha256, releaseId: R12.active6.releaseId, releaseSha256: R12.active6.releaseSha256, v1ReleaseId: R12.v1.releaseId, v1CatalogVersion: R12.v1.catalogVersion, v1ReleaseSha256: R12.v1.releaseSha256, v1CatalogSha256: R12.v1.catalogSha256 }
          : { stateSha256, releaseId: R12.active7.releaseId, releaseSha256: R12.active7.releaseSha256, v1ReleaseId: R12.v1.releaseId, v1CatalogVersion: R12.v1.catalogVersion, v1ReleaseSha256: R12.v1.releaseSha256, v1CatalogSha256: R12.v1.catalogSha256 },
        resourceSubmissionTables: resources,
        preservedDataRoles: [...R12.preservedDataRoles],
        ...(mode === "target" ? { publicWorkflowCount: source.publicWorkflowCount } : {}),
        workflowStateInput: { database, identityInspect: [identity], sourcePosts: source.sourcePosts }
      });
    } catch (error) {
      if (mode === "target" && targetFailureTerminal(error).stage === "target-unknown") throw targetFailure("target-unknown");
      throw error;
    }
  };
  return Object.freeze({ baseline(...args) { return collect("baseline", args); }, target(...args) { return collect("target", args); } });
}

module.exports = {
  PG_READ_SQL,
  PUBLIC_DISABLED,
  RESOURCE_CAPABILITY,
  TARGET_FAILURE_CODES,
  assertNoConcurrentR12Run,
  assertNoConcurrentR14Run,
  assertNoConcurrentR15Run,
  assertNoConcurrentR16Run,
  assertNoConcurrentR17Run,
  assertNoConcurrentR18Run,
  assertNoConcurrentR24Run,
  assertNoConcurrentR25Run,
  assertNoConcurrentR26Run,
  assertNoConcurrentR27Run,
  createTargetWorkflowCapabilityProbeProgram,
  createR12FixedCollector,
  forumApiKeyFromAuthority,
  parseTargetWorkflowCapabilityProbe,
  sanitizeCollectorReceipt,
  stateDigest,
  targetFailureTerminal,
  targetStep,
  targetWorkflowCapability,
  validateBaselineCatalog,
  validatePublicList,
  validateResourceCapability,
  validateTargetCatalog
};
