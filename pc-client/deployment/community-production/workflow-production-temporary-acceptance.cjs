"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const FIXTURE_POST_ID = "2147483647";
const UINT32_MAX = 4_294_967_295n;
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const REVIEWER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_IMAGE = "zhenxing-ai/admin:0.1.40-src-186ff057efd3";
const EXPECTED_ADMIN_IMAGE_ID = "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd";
const PRODUCTION_IDENTITY_CONTRACT = Object.freeze({
  image: "zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8",
  imageId: "sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01",
  sourceDigest: "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8"
});
const CADDY_IMAGE = "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
const REPORT_SCHEMA = "aihub-workflow-temporary-acceptance-v1";
// Bounded just above each service's own Compose health window; these are not shared startup sleeps.
const COMMUNITY_READY_TIMEOUT_MS = 240_000;
const CADDY_READY_TIMEOUT_MS = 150_000;
const CATALOG_READY_TIMEOUT_MS = 30_000;
const CATALOG_READY_INTERVAL_MS = 250;
const CATALOG_READY_REQUEST_TIMEOUT_MS = 10_000;
const CATALOG_READY_EXEC_TIMEOUT_MS = 35_000;
const PRIVATE_FIXTURE_ENTRIES = new Set([
  "Caddyfile", "admin-data", "admin-output", "admin-published", "community-assets",
  "community-config", "community-db", "community-storage", "compose.workflow-temporary-acceptance.yaml",
  "identity-db", "secrets"
]);
const PRIVATE_FIXTURE_OWNERSHIP_SCRIPT = String.raw`
set -eu
case "$1:$2" in *[!0-9:]*|:|*:|*:*:*) exit 20;; esac
[ -d /cleanup-root ] && [ ! -L /cleanup-root ] || exit 21
if awk '$5 ~ /^\/cleanup-root\// { found=1 } END { exit found ? 0 : 1 }' /proc/self/mountinfo; then exit 22; fi
if find /cleanup-root -xdev -type l -print -quit | grep -q .; then exit 23; fi
find /cleanup-root -xdev -exec chown -h "$1:$2" {} \;
`;
const SAFE_STAGES = new Set([
  "preflight", "prepare", "migrate", "seed", "cold-readiness", "ready",
  "owner-create", "owner-identity", "owner-submit", "reviewer-auth", "reviewer-publish",
  "public", "unlist", "database-check", "cleanup", "complete"
]);
const READY_COMPONENTS = new Set([
  "identity-database", "community-database", "admin", "identity", "community", "caddy",
  "flarum-post", "public-capability", "catalog-readiness"
]);
const READY_HEALTH_DEPENDENCIES = Object.freeze({
  community: ["identity-database", "admin", "identity", "community-database", "community"],
  caddy: ["identity-database", "admin", "identity", "community-database", "community", "caddy"]
});
const READY_REASONS = new Set([
  "health-timeout", "service-missing", "service-not-running", "healthcheck-unhealthy",
  "http-unavailable", "http-status", "contract-mismatch", "readiness-timeout", "unexpected-failure"
]);
const READY_STATUSES = new Set([
  "starting", "unhealthy", "exited", "missing", "unreachable", "unexpected-status",
  "contract-mismatch", "not-ready", "unknown"
]);
const READY_ELAPSED_BUCKETS = new Set([
  "under-5s", "5-15s", "15-30s", "30-60s", "60-120s", "120-180s", "180-240s", "over-240s"
]);
const READY_HTTP_STATUS_CLASSES = new Set([null, "unavailable", "2xx", "3xx", "4xx", "5xx", "other"]);
const READY_PROBES = new Set([
  "community-health", "caddy-health", "flarum-post-exact", "public-capability",
  "full-stack-readiness", "passed"
]);

function normalizeFixturePostId(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,9}$/.test(value)) {
    throw new Error("fixture post ID is invalid");
  }
  const parsed = BigInt(value);
  if (parsed > UINT32_MAX) throw new Error("fixture post ID exceeds Flarum UINT32");
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function elapsedBucket(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("ready attribution elapsed time is invalid");
  if (elapsedMs < 5_000) return "under-5s";
  if (elapsedMs < 15_000) return "5-15s";
  if (elapsedMs < 30_000) return "15-30s";
  if (elapsedMs < 60_000) return "30-60s";
  if (elapsedMs < 120_000) return "60-120s";
  if (elapsedMs < 180_000) return "120-180s";
  if (elapsedMs < 240_000) return "180-240s";
  return "over-240s";
}

function httpStatusClass(status) {
  if (status === 0) return "unavailable";
  if (!Number.isInteger(status) || status < 100 || status > 999) return "other";
  return `${Math.floor(status / 100)}xx`;
}

function createReadyAttribution(input) {
  const allowed = ["component", "reason", "status", "elapsedMs", "attemptCount", "httpStatusClass"];
  if (!input || typeof input !== "object" || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new Error("ready attribution input is invalid");
  }
  const value = {
    component: input.component,
    reason: input.reason,
    status: input.status,
    elapsedBucket: elapsedBucket(input.elapsedMs),
    attemptCount: input.attemptCount,
    httpStatusClass: input.httpStatusClass ?? null
  };
  if (
    !READY_COMPONENTS.has(value.component) ||
    !READY_REASONS.has(value.reason) ||
    !READY_STATUSES.has(value.status) ||
    !READY_ELAPSED_BUCKETS.has(value.elapsedBucket) ||
    !Number.isSafeInteger(value.attemptCount) || value.attemptCount < 1 || value.attemptCount > 10_000 ||
    !READY_HTTP_STATUS_CLASSES.has(value.httpStatusClass)
  ) {
    throw new Error("ready attribution is invalid");
  }
  return value;
}

function classifyReadyHealth({ component, rows, elapsedMs, attemptCount }) {
  const candidates = READY_HEALTH_DEPENDENCIES[component];
  if (!candidates || !Array.isArray(rows)) {
    throw new Error("ready health attribution is invalid");
  }
  const componentRows = new Map(rows.map((row) => [row?.Service, row]));
  const blockedComponent = candidates.find((name) => {
    const candidate = componentRows.get(name);
    return !candidate || candidate.State !== "running" || candidate.Health !== "healthy";
  }) || component;
  const row = componentRows.get(blockedComponent);
  if (!row) {
    return createReadyAttribution({ component: blockedComponent, reason: "service-missing", status: "missing", elapsedMs, attemptCount });
  }
  if (row.State !== "running") {
    return createReadyAttribution({ component: blockedComponent, reason: "service-not-running", status: "exited", elapsedMs, attemptCount });
  }
  if (row.Health === "unhealthy") {
    return createReadyAttribution({ component: blockedComponent, reason: "healthcheck-unhealthy", status: "unhealthy", elapsedMs, attemptCount });
  }
  return createReadyAttribution({ component: blockedComponent, reason: "health-timeout", status: "starting", elapsedMs, attemptCount });
}

function readyHealthSatisfied(component, rows) {
  const candidates = READY_HEALTH_DEPENDENCIES[component];
  if (!candidates || !Array.isArray(rows)) return false;
  return candidates.every((name) => rows.some((row) => row?.Service === name && row.State === "running" && row.Health === "healthy"));
}

function assertReadyAttribution(value) {
  if (value === null) return;
  const allowed = ["component", "reason", "status", "elapsedBucket", "attemptCount", "httpStatusClass"];
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("acceptance report ready attribution is invalid");
  }
  if (
    !READY_COMPONENTS.has(value.component) || !READY_REASONS.has(value.reason) ||
    !READY_STATUSES.has(value.status) || !READY_ELAPSED_BUCKETS.has(value.elapsedBucket) ||
    !Number.isSafeInteger(value.attemptCount) || value.attemptCount < 1 || value.attemptCount > 10_000 ||
    !READY_HTTP_STATUS_CLASSES.has(value.httpStatusClass)
  ) {
    throw new Error("acceptance report ready attribution is invalid");
  }
}

function assertSafeReport(value) {
  const allowed = [
    "schema", "candidateOnly", "deployable", "status", "manifestDigest", "identityImageId",
    "identitySourceDigest", "runnerSha256", "isolatedProjectScope", "checks", "steps",
    "workflowReference", "publicRedaction", "database", "cleanup", "failureStage", "readyAttribution",
    "finalized"
  ];
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("acceptance report schema is invalid");
  }
  assertReadyAttribution(value.readyAttribution ?? null);
  if (typeof value.finalized !== "boolean") {
    throw new Error("acceptance report finalization is invalid");
  }
  if (value.checks?.readyProbe !== undefined && !READY_PROBES.has(value.checks.readyProbe)) {
    throw new Error("acceptance report ready probe is invalid");
  }
  const encoded = JSON.stringify(value);
  if (
    /https?:\/\/|127\.0\.0\.1|Bearer\s|cookie|password|dsn|"stack"\s*:|\bat\s+\S+:[0-9]+|sql/i.test(encoded) ||
    encoded.includes(OWNER_ID) || encoded.includes(REVIEWER_ID)
  ) {
    throw new Error("acceptance report contains private evidence");
  }
  return value;
}

function run(command, args, options = {}) {
  return String(execFileSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options
  }) || "");
}

function docker(args, options) {
  return run("docker", args, options);
}

function writePrivate(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value, { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(filename, 0o600); } catch {}
}

function writeAcceptanceCaddyfile(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value, { encoding: "utf8", mode: 0o644 });
  fs.chmodSync(filename, 0o644);
}

function writeSafeReport(reportPath, report) {
  assertSafeReport(report);
  const temporaryPath = `${reportPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const fd = fs.openSync(temporaryPath, "wx", 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, reportPath);
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

function copyCatalogDirectory(source, destination) {
  const resolved = fs.realpathSync(source);
  if (!path.isAbsolute(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error("signed catalog source directory is invalid");
  }
  fs.cpSync(resolved, destination, {
    recursive: true,
    errorOnExist: true,
    filter: (entry) => !/(?:catalog-signing-private\.pem|\.env|secret)$/i.test(path.basename(entry))
  });
}

function fixedContent() {
  return {
    title: "Workflow isolated acceptance",
    summary: "Data only isolated acceptance workflow.",
    inputs: [],
    outputs: [],
    instructions: ["Follow the isolated acceptance instruction."],
    dependencies: [],
    secretPlaceholders: []
  };
}

function requestProgram() {
  return String.raw`
const fs=require('fs');
const http=require('http');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',async()=>{
  try{
    const p=JSON.parse(input);const target=p.target==='caddy'?'http://caddy':p.target==='community'?'http://community':'http://127.0.0.1:4180';
    const headers={accept:'application/json'};
    if(p.body!==undefined)headers['content-type']='application/json';
    if(p.token)headers.authorization='Bearer '+p.token;
    if(p.idempotencyKey)headers['idempotency-key']=p.idempotencyKey;
    if(p.reviewer===true)headers['x-aihub-workflow-review-secret']=fs.readFileSync('/run/secrets/workflow_review_secret','utf8');
    let status,text;
    if(p.target==='caddy'){
      ({status,text}=await new Promise((resolve,reject)=>{const req=http.request({host:'caddy',port:80,path:p.pathname,method:p.method||'GET',headers:{...headers,host:'workflow-acceptance.invalid'},agent:false},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,text:Buffer.concat(chunks).toString('utf8')}))});req.setTimeout(10000,()=>req.destroy(new Error('timeout')));req.on('error',reject);if(p.body!==undefined)req.write(JSON.stringify(p.body));req.end()}));
    }else{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
      const response=await fetch(target+p.pathname,{method:p.method||'GET',headers,body:p.body===undefined?undefined:JSON.stringify(p.body),redirect:'manual',signal:controller.signal});
      clearTimeout(timer);status=response.status;text=await response.text();
    }
    let body=null;try{body=JSON.parse(text)}catch{}
    process.stdout.write(JSON.stringify({status,body}));
  }catch{process.stdout.write(JSON.stringify({status:0,body:null}));process.exitCode=2}
});`;
}

function unavailableCatalogReadinessProbe() {
  return { status: 0, enabled: false, attemptCount: 1 };
}

function catalogReadinessProbeProgram(
  timeoutMs = CATALOG_READY_TIMEOUT_MS,
  intervalMs = CATALOG_READY_INTERVAL_MS,
  requestTimeoutMs = CATALOG_READY_REQUEST_TIMEOUT_MS
) {
  if (
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > CATALOG_READY_TIMEOUT_MS ||
    !Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > CATALOG_READY_INTERVAL_MS ||
    !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > CATALOG_READY_REQUEST_TIMEOUT_MS
  ) {
    throw new Error("catalog readiness probe bounds are invalid");
  }
  return String.raw`
const target='http://127.0.0.1:4180/v1/community/workflow-store/capability';
const deadline=Date.now()+${timeoutMs};
let attempts=0;
let last={status:0,enabled:false};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(){
  const remaining=deadline-Date.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Math.min(${requestTimeoutMs},Math.max(1,remaining)));
  try{
    const response=await fetch(target,{method:'GET',headers:{accept:'application/json'},redirect:'manual',signal:controller.signal});
    const text=await response.text();
    let body=null;try{body=JSON.parse(text)}catch{}
    const ready=response.status===200&&body!==null&&body.enabled===true&&body.schemaVersion===1&&body.execution===false&&body.workflowSubmissionLookup===false;
    return {status:response.status,enabled:ready};
  }catch{return {status:0,enabled:false}}
  finally{clearTimeout(timer)}
}
  (async()=>{
    while(Date.now()<deadline){
      attempts+=1;
      const observed=await request();
      if(observed.status!==0||last.status===0)last=observed;
      if(observed.status===200&&observed.enabled===true)break;
    const remaining=deadline-Date.now();
    if(remaining>0)await delay(Math.min(${intervalMs},remaining));
  }
  process.stdout.write(JSON.stringify({status:last.status,enabled:last.status===200&&last.enabled===true,attemptCount:Math.max(attempts,1)}));
})().catch(()=>{process.stdout.write(JSON.stringify({status:0,enabled:false,attemptCount:Math.max(attempts,1)}));process.exitCode=2});`;
}

function parseCatalogReadinessProbe(output) {
  try {
    const value = JSON.parse(output);
    const keys = Object.keys(value || {});
    if (
      keys.length !== 3 || !keys.includes("status") || !keys.includes("enabled") || !keys.includes("attemptCount") ||
      !Number.isInteger(value.status) || (value.status !== 0 && (value.status < 100 || value.status > 599)) ||
      typeof value.enabled !== "boolean" || (value.status !== 200 && value.enabled !== false) ||
      !Number.isSafeInteger(value.attemptCount) || value.attemptCount < 1 || value.attemptCount > 10_000
    ) {
      return unavailableCatalogReadinessProbe();
    }
    return { status: value.status, enabled: value.enabled, attemptCount: value.attemptCount };
  } catch {
    return unavailableCatalogReadinessProbe();
  }
}

function runCatalogReadinessProbe(container, dockerFn = docker) {
  try {
    const output = dockerFn(["exec", "-i", container, "node", "-e", catalogReadinessProbeProgram()], {
      timeout: CATALOG_READY_EXEC_TIMEOUT_MS,
      killSignal: "SIGKILL"
    });
    return parseCatalogReadinessProbe(output);
  } catch {
    return unavailableCatalogReadinessProbe();
  }
}

function validateArguments(argv, scriptDirectory) {
  if (argv.length !== 3) throw new Error("runner requires base, production overlay, and evidence paths");
  const expected = ["compose.server.yaml", "compose.workflow-production.yaml"];
  const resolved = argv.slice(0, 2).map((value, index) => {
    if (!path.isAbsolute(value) || path.basename(value) !== expected[index]) throw new Error("runner compose path is invalid");
    const real = fs.realpathSync(value);
    if (real !== fs.realpathSync(path.join(scriptDirectory, expected[index]))) throw new Error("runner compose path is not repository controlled");
    return real;
  });
  const evidence = argv[2];
  if (!path.isAbsolute(evidence) || !fs.existsSync(evidence) || !fs.statSync(evidence).isDirectory() || fs.lstatSync(evidence).isSymbolicLink()) {
    throw new Error("runner evidence path is invalid");
  }
  return [...resolved, fs.realpathSync(evidence)];
}

function validatePrivateFixtureCleanupScope({ evidence, project, runRoot }) {
  if (!/^workflowacceptance[0-9]{17}[0-9a-f]{12}$/.test(project)) {
    throw new Error("private cleanup scope has an invalid project name");
  }
  if (![evidence, runRoot].every((value) => typeof value === "string" && path.isAbsolute(value))) {
    throw new Error("private cleanup scope must use absolute paths");
  }
  const evidenceReal = fs.realpathSync.native(evidence);
  const runRootReal = fs.realpathSync.native(runRoot);
  if (
    fs.lstatSync(evidenceReal).isSymbolicLink() ||
    fs.lstatSync(runRootReal).isSymbolicLink() ||
    path.dirname(runRootReal) !== evidenceReal ||
    path.basename(runRootReal) !== `${project}-private`
  ) {
    throw new Error("private cleanup scope is not the exact runner-owned directory");
  }
  return runRootReal;
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertPrivateFixtureEntries(runRoot) {
  for (const entry of fs.readdirSync(runRoot)) {
    if (!PRIVATE_FIXTURE_ENTRIES.has(entry) || fs.lstatSync(path.join(runRoot, entry)).isSymbolicLink()) {
      throw new Error("private cleanup scope contains an unapproved entry");
    }
  }
}

function assertNoContainerMountReference(runRoot, dockerFn = docker) {
  const ids = dockerFn(["ps", "-aq"]).trim().split(/\r?\n/).filter(Boolean);
  if (!ids.length) return;
  const inspected = JSON.parse(dockerFn(["container", "inspect", ...ids]));
  const referenced = inspected.some((container) => (container.Mounts || []).some((mount) => {
    if (mount.Type !== "bind" || typeof mount.Source !== "string") return false;
    const source = path.resolve(mount.Source);
    return isWithin(source, runRoot);
  }));
  if (referenced) throw new Error("private cleanup scope is still referenced by a container");
}

function restorePrivateFixtureOwnership(runRoot, dockerFn = docker) {
  const linuxIdentity = process.platform === "linux" && typeof process.getuid === "function" && typeof process.getgid === "function";
  const uid = linuxIdentity ? process.getuid() : 0;
  const gid = linuxIdentity ? process.getgid() : 0;
  if (!Number.isSafeInteger(uid) || uid < 0 || !Number.isSafeInteger(gid) || gid < 0) {
    throw new Error("private cleanup runner identity is invalid");
  }
  dockerFn([
    "run", "--rm", "--network", "none", "--user", "0:0", "--read-only",
    "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "DAC_READ_SEARCH", "--security-opt", "no-new-privileges:true",
    "--mount", `type=bind,src=${runRoot},dst=/cleanup-root`, "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=1m",
    "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", PRIVATE_FIXTURE_OWNERSHIP_SCRIPT, "cleanup", String(uid), String(gid)
  ], { stdio: ["ignore", "ignore", "ignore"] });
}

function removePrivateFixtureTreePostorder(directory) {
  const root = fs.lstatSync(directory);
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error("private cleanup fallback encountered an unsafe directory");
  }
  for (const entry of fs.readdirSync(directory)) {
    const target = path.join(directory, entry);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      throw new Error("private cleanup fallback encountered a symbolic link");
    }
    if (stat.isDirectory()) removePrivateFixtureTreePostorder(target);
    else if (stat.isFile()) fs.unlinkSync(target);
    else throw new Error("private cleanup fallback encountered a special entry");
  }
  fs.rmdirSync(directory);
}

function cleanupPrivateFixtureDirectory({ evidence, project, runRoot, dockerFn = docker, removeFn = fs.rmSync }) {
  if (!fs.existsSync(runRoot)) return true;
  try {
    const exactRoot = validatePrivateFixtureCleanupScope({ evidence, project, runRoot });
    assertPrivateFixtureEntries(exactRoot);
    assertNoContainerMountReference(exactRoot, dockerFn);
    restorePrivateFixtureOwnership(exactRoot, dockerFn);
    removeFn(exactRoot, { recursive: true, force: true });
    if (fs.existsSync(exactRoot)) removePrivateFixtureTreePostorder(exactRoot);
    return !fs.existsSync(exactRoot);
  } catch {
    return false;
  }
}

function normalizeIdentityContract(value) {
  if (
    !value || typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== "image,imageId,sourceDigest" ||
    !/^zhenxing-ai\/identity:workflow-readiness-candidate-[0-9a-f]{12}$/.test(value.image) ||
    !/^sha256:[0-9a-f]{64}$/.test(value.imageId) ||
    !/^[0-9a-f]{64}$/.test(value.sourceDigest) ||
    !value.image.endsWith(value.sourceDigest.slice(0, 12))
  ) {
    throw new Error("Identity acceptance contract is invalid");
  }
  return Object.freeze({ ...value });
}

async function executeWithIdentityContract(argv, requestedIdentityContract) {
  normalizeFixturePostId(FIXTURE_POST_ID);
  const identityContract = normalizeIdentityContract(requestedIdentityContract);
  const scriptDirectory = __dirname;
  const [base, overlay, evidence] = validateArguments(argv, scriptDirectory);
  const suffix = crypto.randomBytes(6).toString("hex");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const project = `workflowacceptance${stamp}${suffix}`.toLowerCase().slice(0, 55);
  const runRoot = path.join(evidence, `${project}-private`);
  const reportPath = path.join(evidence, "workflow-temporary-acceptance-report.json");
  const externalVolumes = [`${project}_caddy_data`, `${project}_caddy_config`, `${project}_caddy_secret`];
  const report = {
    schema: REPORT_SCHEMA,
    candidateOnly: true,
    deployable: false,
    status: "blocked",
    manifestDigest: null,
    identityImageId: null,
    identitySourceDigest: null,
    runnerSha256: sha256(fs.readFileSync(__filename)),
    isolatedProjectScope: project,
    checks: {},
    steps: {},
    workflowReference: null,
    publicRedaction: null,
    database: null,
    cleanup: { scope: project, completed: false },
    failureStage: "preflight",
    readyAttribution: null,
    finalized: false
  };
  let stage = "preflight";
  let completedFlow = false;
  let composeFiles = [];
  let composeEnvironment;

  function compose(args, options = {}) {
    const call = ["compose", "--project-name", project];
    for (const file of composeFiles) call.push("-f", file);
    return docker([...call, ...args], { env: composeEnvironment, ...options });
  }
  function updateStage(next) {
    if (!SAFE_STAGES.has(next)) throw new Error("runner stage is invalid");
    stage = next;
    report.failureStage = next;
  }
  function request(payload) {
    const container = `${project}-identity-1`;
    const output = docker(["exec", "-i", container, "node", "-e", requestProgram()], {
      input: JSON.stringify(payload)
    });
    return JSON.parse(output);
  }
  async function waitHealthy(services, timeoutMs = 180_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const rows = compose(["ps", "--format", "json"]).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      if (services.every((service) => rows.some((row) => row.Service === service && row.Health === "healthy"))) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("isolated service health timeout");
  }
  function composeRows() {
    return compose(["ps", "--format", "json"]).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
  async function waitReadyHealthy(component, timeoutMs) {
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    let attempts = 0;
    let rows = [];
    while (Date.now() < deadline) {
      attempts += 1;
      rows = composeRows();
      if (readyHealthSatisfied(component, rows)) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    report.readyAttribution = classifyReadyHealth({
      component,
      rows,
      elapsedMs: Date.now() - startedAt,
      attemptCount: Math.max(attempts, 1)
    });
    throw new Error("isolated ready component health timeout");
  }
  async function startReadyService(component, timeoutMs) {
    const startedAt = Date.now();
    try {
      compose(["up", "-d", component]);
      await waitReadyHealthy(component, timeoutMs);
    } catch (error) {
      if (report.readyAttribution === null) {
        try {
          report.readyAttribution = classifyReadyHealth({
            component,
            rows: composeRows(),
            elapsedMs: Date.now() - startedAt,
            attemptCount: 1
          });
        } catch {
          report.readyAttribution = createReadyAttribution({
            component,
            reason: "unexpected-failure",
            status: "unknown",
            elapsedMs: Date.now() - startedAt,
            attemptCount: 1
          });
        }
      }
      throw error;
    }
  }

  try {
    fs.mkdirSync(runRoot, { recursive: false, mode: 0o700 });
    const manifest = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "manifest.json"), "utf8"));
    report.manifestDigest = manifest.digest.sha256;
    const image = JSON.parse(docker(["image", "inspect", identityContract.image]))[0];
    if (image.Id !== identityContract.imageId || image.Config?.Labels?.["com.aihub.source-content-sha256"] !== identityContract.sourceDigest) {
      throw new Error("Identity candidate image does not match frozen source");
    }
    report.identityImageId = image.Id;
    report.identitySourceDigest = identityContract.sourceDigest;
    const adminImage = JSON.parse(docker(["image", "inspect", ADMIN_IMAGE]))[0];
    if (adminImage.Id !== EXPECTED_ADMIN_IMAGE_ID) throw new Error("Admin candidate image is not the frozen acceptance image");
    report.checks.supplyChain = true;

    updateStage("prepare");
    const secrets = path.join(runRoot, "secrets");
    const names = [
      "identity_db_password", "forum_db_password", "forum_db_root_password", "forum_admin_password",
      "forum_api_key", "forum_password_token", "community_internal", "community_management",
      "community_cms_gateway", "workflow_review_secret"
    ];
    for (const name of names) writePrivate(path.join(secrets, name), crypto.randomBytes(32).toString("hex"));
    const adminData = path.join(runRoot, "admin-data");
    const adminPublished = path.join(runRoot, "admin-published");
    copyCatalogDirectory(process.env.AIHUB_ADMIN_DATA_DIR || "", adminData);
    copyCatalogDirectory(process.env.AIHUB_ADMIN_PUBLISHED_DIR || "", adminPublished);
    fs.mkdirSync(path.join(runRoot, "admin-output"));
    for (const volume of externalVolumes) docker(["volume", "create", volume]);
    const seed = spawnSync("docker", [
      "run", "--rm", "-i", "--user", "0:0", "-v", `${externalVolumes[2]}:/target`,
      "--entrypoint", "/bin/sh", CADDY_IMAGE,
      "-ec", "umask 077; IFS= read -r value; printf %s \"$value\" > /target/community_cms_gateway; chown 0:0 /target/community_cms_gateway; chmod 400 /target/community_cms_gateway"
    ], { encoding: "utf8", input: `${fs.readFileSync(path.join(secrets, "community_cms_gateway"), "utf8")}\n`, windowsHide: true });
    if (seed.status !== 0) throw new Error("isolated Caddy secret seed failed");

    const caddyfile = path.join(runRoot, "Caddyfile");
    writeAcceptanceCaddyfile(caddyfile, fs.readFileSync(path.join(scriptDirectory, "Caddyfile"), "utf8")
      .replace(/^\{\$AIHUB_PUBLIC_HOST\}/m, "http://{$AIHUB_PUBLIC_HOST}")
      .replace(/^\{\$AIHUB_COMMUNITY_PUBLIC_HOST\}/m, "http://{$AIHUB_COMMUNITY_PUBLIC_HOST}"));
    const override = path.join(runRoot, "compose.workflow-temporary-acceptance.yaml");
    const caddyMount = `${caddyfile.replaceAll("\\", "/")}:/etc/caddy/Caddyfile:ro`;
    writePrivate(override, `services:\n  identity-migrate:\n    image: ${identityContract.image}\n  workflow-migrate:\n    image: ${identityContract.image}\n  workflow-official-bootstrap:\n    image: ${identityContract.image}\n  workflow-reviewer-provision:\n    image: ${identityContract.image}\n  admin:\n    ports: !reset []\n  identity:\n    image: ${identityContract.image}\n    environment:\n      AIHUB_WORKFLOW_REVIEWER_ID: ${REVIEWER_ID}\n  caddy:\n    ports: !reset []\n    volumes:\n      - ${JSON.stringify(caddyMount)}\n`);
    composeFiles = [base, overlay];
    if (process.platform === "win32") composeFiles.push(path.join(scriptDirectory, "compose.windows-acceptance.yaml"));
    composeFiles.push(override);
    composeEnvironment = {
      ...process.env,
      AIHUB_ADMIN_CMS_IMAGE: ADMIN_IMAGE,
      AIHUB_ADMIN_DATA_DIR: adminData,
      AIHUB_ADMIN_PUBLISHED_DIR: adminPublished,
      AIHUB_ADMIN_OUTPUT_DIR: path.join(runRoot, "admin-output"),
      AIHUB_IDENTITY_DB_DIR: path.join(runRoot, "identity-db"),
      AIHUB_COMMUNITY_DB_DIR: path.join(runRoot, "community-db"),
      AIHUB_COMMUNITY_CONFIG_DIR: path.join(runRoot, "community-config"),
      AIHUB_COMMUNITY_STORAGE_DIR: path.join(runRoot, "community-storage"),
      AIHUB_COMMUNITY_ASSETS_DIR: path.join(runRoot, "community-assets"),
      AIHUB_SECRET_DIR: secrets,
      AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: secrets,
      AIHUB_FORUM_ADMIN_EMAIL: "workflow-acceptance@example.invalid",
      AIHUB_PUBLIC_HOST: "workflow-acceptance.invalid",
      AIHUB_COMMUNITY_PUBLIC_HOST: "community.workflow-acceptance.invalid",
      AIHUB_CADDY_DATA_VOLUME: externalVolumes[0],
      AIHUB_CADDY_CONFIG_VOLUME: externalVolumes[1],
      AIHUB_CADDY_CMS_SECRET_VOLUME: externalVolumes[2]
    };
    compose(["config", "--no-interpolate"]);
    compose(["up", "-d", "identity-database", "community-database", "admin"]);
    await waitHealthy(["identity-database", "community-database", "admin"]);

    updateStage("migrate");
    compose(["--profile", "migration", "run", "--rm", "identity-migrate"]);
    compose(["--profile", "migration", "run", "--rm", "community-migrate"]);
    compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=apply", "workflow-migrate"]);
    compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=verify", "workflow-migrate"]);
    report.checks.explicitMigrations = true;

    updateStage("seed");
    const token = crypto.randomBytes(32).toString("base64url");
    const accessHash = sha256(token);
    const seedIdentity = `\nINSERT INTO users (id,email,normalized_email,username,normalized_username,community_username,password_hash) VALUES\n('${OWNER_ID}','workflow-owner@example.invalid','workflow-owner@example.invalid','workflow_owner','workflow_owner','zx_111111111111411181111111111','not-a-login-password'),\n('${REVIEWER_ID}','workflow-reviewer@example.invalid','workflow-reviewer@example.invalid','workflow_reviewer','workflow_reviewer','zx_222222222222422282222222222','not-a-login-password');\nINSERT INTO community_profiles (user_id,nickname,bio) VALUES ('${OWNER_ID}','Workflow Owner',''),('${REVIEWER_ID}','Workflow Reviewer','');\nINSERT INTO devices (user_id,id,name) VALUES ('${OWNER_ID}','33333333-3333-4333-8333-333333333333','Workflow acceptance');\nINSERT INTO sessions (id,user_id,device_id,access_hash,access_expires_at,refresh_hash,refresh_expires_at) VALUES ('44444444-4444-4444-8444-444444444444','${OWNER_ID}','33333333-3333-4333-8333-333333333333','${accessHash}',now()+interval '30 minutes','${sha256(crypto.randomBytes(32))}',now()+interval '1 hour');\n`;
    docker(["exec", "-i", `${project}-identity-database-1`, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "aihub", "-d", "aihub"], { input: seedIdentity, stdio: ["pipe", "ignore", "pipe"] });
    const forumUserId = "2147483646";
    const seedFlarum = `\nINSERT INTO users (id,username,nickname,email,is_email_confirmed,password,joined_at) VALUES (${forumUserId},'zx_111111111111411181111111111','Workflow Owner','workflow-owner@example.invalid',1,'!',NOW());\nINSERT INTO aihub_identity_links (identity_user_id,forum_user_id,community_username) VALUES ('${OWNER_ID}',${forumUserId},'zx_111111111111411181111111111');\nINSERT INTO discussions (id,title,comment_count,participant_count,created_at,user_id,slug,is_private,is_approved) VALUES (${FIXTURE_POST_ID},'Workflow acceptance source',1,1,NOW(),${forumUserId},'workflow-acceptance-source',0,1);\nINSERT INTO posts (id,discussion_id,number,created_at,user_id,type,content,is_private,is_approved) VALUES (${FIXTURE_POST_ID},${FIXTURE_POST_ID},1,NOW(),${forumUserId},'comment','Workflow acceptance source.',0,1);\nUPDATE discussions SET first_post_id=${FIXTURE_POST_ID},last_post_id=${FIXTURE_POST_ID},last_posted_at=NOW(),last_posted_user_id=${forumUserId},last_post_number=1 WHERE id=${FIXTURE_POST_ID};\n`;
    docker(["exec", "-i", `${project}-community-database-1`, "sh", "-ec", "exec mariadb -u root --password=\"$(cat /run/secrets/forum_db_root_password)\" aihub_forum"], { input: seedFlarum, stdio: ["pipe", "ignore", "pipe"] });
    report.checks.fixedFlarumPostSeeded = true;

    updateStage("cold-readiness");
    const network = `${project}_default`;
    docker(["network", "disconnect", network, `${project}-admin-1`]);
    compose(["up", "-d", "--no-deps", "identity"]);
    await waitHealthy(["identity"]);
    const coldCapability = request({ pathname: "/v1/community/workflow-store/capability" });
    const coldCreate = request({
      pathname: "/v1/community/workflow-store/owner/drafts", method: "POST", token,
      idempotencyKey: crypto.randomUUID(), body: { sourceCommunityPostId: FIXTURE_POST_ID, provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] }, content: fixedContent() }
    });
    if (coldCapability.status !== 200 || coldCapability.body?.enabled !== false || coldCreate.status !== 503 || coldCreate.body?.error?.code !== "TEMPORARILY_UNAVAILABLE") {
      throw new Error("cold catalog readiness boundary failed");
    }
    report.checks.coldCatalogUnavailable = true;
    docker(["network", "connect", "--alias", "admin", network, `${project}-admin-1`]);
    const readyDeadline = Date.now() + 30_000;
    let readyCapability;
    while (Date.now() < readyDeadline) {
      readyCapability = request({ pathname: "/v1/community/workflow-store/capability" });
      if (readyCapability.status === 200 && readyCapability.body?.enabled === true) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (readyCapability?.body?.enabled !== true || readyCapability.body.execution !== false || readyCapability.body.schemaVersion !== 1) {
      throw new Error("catalog readiness did not recover");
    }
    report.checks.catalogReady = true;

    updateStage("ready");
    report.checks.readyProbe = "community-health";
    await startReadyService("community", COMMUNITY_READY_TIMEOUT_MS);
    report.checks.readyProbe = "caddy-health";
    await startReadyService("caddy", CADDY_READY_TIMEOUT_MS);
    report.checks.readyProbe = "flarum-post-exact";
    const flarumStartedAt = Date.now();
    const flarumPost = request({ target: "community", pathname: `/api/posts/${FIXTURE_POST_ID}` });
    if (flarumPost.status !== 200 || flarumPost.body?.data?.type !== "posts" || flarumPost.body?.data?.id !== FIXTURE_POST_ID) {
      report.readyAttribution = createReadyAttribution({
        component: "flarum-post",
        reason: flarumPost.status === 0 ? "http-unavailable" : (flarumPost.status === 200 ? "contract-mismatch" : "http-status"),
        status: flarumPost.status === 0 ? "unreachable" : (flarumPost.status === 200 ? "contract-mismatch" : "unexpected-status"),
        elapsedMs: Date.now() - flarumStartedAt,
        attemptCount: 1,
        httpStatusClass: httpStatusClass(flarumPost.status)
      });
      throw new Error("real isolated Flarum post did not resolve exactly");
    }
    report.checks.readyProbe = "public-capability";
    const publicStartedAt = Date.now();
    const publicCapability = request({ pathname: "/v1/community/workflow-store/public/capability" });
    if (publicCapability.status !== 200 || publicCapability.body?.enabled !== true || publicCapability.body.execution !== false) {
      report.readyAttribution = createReadyAttribution({
        component: "public-capability",
        reason: publicCapability.status === 0 ? "http-unavailable" : (publicCapability.status === 200 ? "contract-mismatch" : "http-status"),
        status: publicCapability.status === 0 ? "unreachable" : (publicCapability.status === 200 ? "contract-mismatch" : "unexpected-status"),
        elapsedMs: Date.now() - publicStartedAt,
        attemptCount: 1,
        httpStatusClass: httpStatusClass(publicCapability.status)
      });
      throw new Error("public capability boundary failed");
    }
    report.checks.readyProbe = "full-stack-readiness";
    const fullStackReadyStartedAt = Date.now();
    const fullStackCapability = runCatalogReadinessProbe(`${project}-identity-1`);
    report.steps.fullStackCapability = {
      status: fullStackCapability.status,
      code: null
    };
    if (fullStackCapability.status !== 200 || fullStackCapability.enabled !== true) {
      report.readyAttribution = createReadyAttribution({
        component: "catalog-readiness",
        reason: fullStackCapability.status === 0 ? "http-unavailable" : "readiness-timeout",
        status: fullStackCapability.status === 0 ? "unreachable" : "not-ready",
        elapsedMs: Date.now() - fullStackReadyStartedAt,
        attemptCount: fullStackCapability.attemptCount,
        httpStatusClass: httpStatusClass(fullStackCapability.status)
      });
      throw new Error("full stack catalog readiness did not recover");
    }
    report.checks.readyProbe = "passed";

    updateStage("owner-create");
    const createKey = crypto.randomUUID();
    const createBody = { sourceCommunityPostId: FIXTURE_POST_ID, provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] }, content: fixedContent() };
    const created = request({ pathname: "/v1/community/workflow-store/owner/drafts", method: "POST", token, idempotencyKey: createKey, body: createBody });
    const repeated = request({ pathname: "/v1/community/workflow-store/owner/drafts", method: "POST", token, idempotencyKey: createKey, body: createBody });
    report.steps.ownerCreate = { status: created.status, code: created.body?.error?.code || null };
    report.steps.ownerCreateRepeat = { status: repeated.status, code: repeated.body?.error?.code || null };
    if (created.status !== 201 || repeated.status !== 201 || repeated.body?.workflowId !== created.body?.workflowId || repeated.body?.expectedRevision !== created.body?.expectedRevision) {
      throw new Error("owner create idempotency failed");
    }
    const workflowId = created.body.workflowId;
    report.checks.ownerCreateIdempotent = true;
    updateStage("owner-identity");
    const own = request({ pathname: `/v1/community/workflow-store/owner/draft?workflowId=${workflowId}`, token });
    const forged = request({ pathname: "/v1/community/workflow-store/owner/drafts", method: "POST", token, idempotencyKey: crypto.randomUUID(), body: { ...createBody, authorIdentityId: REVIEWER_ID } });
    report.steps.ownerGet = { status: own.status, code: own.body?.error?.code || null };
    report.steps.ownerForgery = { status: forged.status, code: forged.body?.error?.code || null };
    if (own.status !== 200 || forged.status !== 400) throw new Error("owner identity boundary failed");
    updateStage("owner-submit");
    const submitted = request({ pathname: "/v1/community/workflow-store/owner/drafts/submit", method: "POST", token, idempotencyKey: crypto.randomUUID(), body: { workflowId, expectedRevision: 1 } });
    report.steps.ownerSubmit = { status: submitted.status, code: submitted.body?.error?.code || null };
    if (submitted.status !== 200 || submitted.body?.expectedRevision !== 2) throw new Error("owner submit failed");
    report.checks.owner = true;

    updateStage("reviewer-auth");
    const reviewBody = { workflowId, expectedRevision: 2, decision: "publish", reviewStatus: "manually-reviewed", riskLevel: "low" };
    const missingSecret = request({ pathname: "/v1/community/workflow-store/reviewer/review", method: "POST", idempotencyKey: crypto.randomUUID(), body: reviewBody });
    const forgedReviewer = request({ pathname: "/v1/community/workflow-store/reviewer/review", method: "POST", reviewer: true, idempotencyKey: crypto.randomUUID(), body: { ...reviewBody, reviewerId: OWNER_ID } });
    report.steps.reviewerMissingSecret = { status: missingSecret.status, code: missingSecret.body?.error?.code || null };
    report.steps.reviewerBodyForgery = { status: forgedReviewer.status, code: forgedReviewer.body?.error?.code || null };
    updateStage("reviewer-publish");
    const published = request({ pathname: "/v1/community/workflow-store/reviewer/review", method: "POST", reviewer: true, idempotencyKey: crypto.randomUUID(), body: reviewBody });
    report.steps.reviewerPublish = { status: published.status, code: published.body?.error?.code || null };
    if (missingSecret.status !== 403 || forgedReviewer.status !== 400 || published.status !== 200) throw new Error("reviewer authentication boundary failed");
    report.checks.reviewer = true;

    updateStage("public");
    const list = request({ pathname: "/v1/community/workflow-store/public/list?limit=10" });
    const release = request({ pathname: `/v1/community/workflow-store/public/release?workflowId=${workflowId}&version=1` });
    report.steps.publicList = { status: list.status, code: list.body?.error?.code || null };
    report.steps.publicRelease = { status: release.status, code: release.body?.error?.code || null };
    const encoded = JSON.stringify(release.body || {});
    const forbidden = /identityId|reviewer|audit|discoveredVia|secretPlaceholders|credentials|headers|\burl\b/i.test(encoded);
    if (list.status !== 200 || list.body?.items?.length !== 1 || list.body.items[0]?.workflowId !== workflowId || release.status !== 200 || forbidden) {
      throw new Error("public projection or redaction failed");
    }
    report.publicRedaction = { exactSingleListing: true, outerWireDtoAllowlisted: true, noOwnerOrReviewerFields: true, noSecretFields: true };

    updateStage("unlist");
    const unlisted = request({ pathname: "/v1/community/workflow-store/reviewer/unlist", method: "POST", reviewer: true, idempotencyKey: crypto.randomUUID(), body: { workflowId, reason: "Isolated acceptance complete." } });
    const unavailable = request({ pathname: `/v1/community/workflow-store/public/release?workflowId=${workflowId}&version=1` });
    const empty = request({ pathname: "/v1/community/workflow-store/public/list?limit=10" });
    const reviewerPublic = request({ target: "caddy", pathname: "/v1/community/workflow-store/reviewer/probe" });
    const internalPublic = request({ target: "caddy", pathname: "/v1/internal/community/handoffs/redeem" });
    report.steps.unlist = { status: unlisted.status, code: unlisted.body?.error?.code || null };
    report.steps.publicAfterUnlist = { status: unavailable.status, code: unavailable.body?.error?.code || null };
    report.steps.caddyReviewer = { status: reviewerPublic.status, code: reviewerPublic.body?.error?.code || null };
    report.steps.caddyInternal = { status: internalPublic.status, code: internalPublic.body?.error?.code || null };
    if (unlisted.status !== 200 || unavailable.status !== 404 || unavailable.body?.error?.code !== "PUBLIC_WORKFLOW_UNAVAILABLE" || empty.body?.items?.length !== 0 || reviewerPublic.status !== 404 || internalPublic.status !== 404) {
      throw new Error("unlist or Caddy public boundary failed");
    }
    report.checks.publicAndUnlist = true;

    updateStage("database-check");
    const databaseSql = `SELECT json_build_object('eventCount',(SELECT count(*) FROM community_workflow.events),'operations',(SELECT array_agg(operation ORDER BY sequence)=ARRAY['createDraft','submitDraft','reviewSubmission','unlist'] FROM community_workflow.events),'actors',(SELECT array_agg(actor_identity_id::text ORDER BY sequence)=ARRAY['${OWNER_ID}','${OWNER_ID}','${REVIEWER_ID}','${REVIEWER_ID}'] FROM community_workflow.events),'references',(SELECT (min(event_data->'generatedIds'->>0) FILTER (WHERE sequence=1)='${workflowId}') AND bool_and(CASE WHEN sequence=1 THEN true ELSE event_data->'input'->>'workflowId'='${workflowId}' END) FROM community_workflow.events),'head',(SELECT last_sequence=4 FROM community_workflow.event_head WHERE singleton=true),'idempotencyCount',(SELECT count(*) FROM community_workflow.idempotency),'idempotencySequences',(SELECT array_agg(event_sequence ORDER BY event_sequence)=ARRAY[1::bigint,2::bigint,3::bigint,4::bigint] FROM community_workflow.idempotency));`;
    const dbOutput = docker(["exec", "-i", `${project}-identity-database-1`, "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-U", "aihub", "-d", "aihub"], { input: databaseSql });
    const database = JSON.parse(dbOutput.trim());
    if (Number(database.eventCount) !== 4 || database.operations !== true || database.actors !== true || database.references !== true || database.head !== true || Number(database.idempotencyCount) !== 4 || database.idempotencySequences !== true) {
      throw new Error("append-only event or idempotency evidence failed");
    }
    report.database = { eventCount: 4, operationsInOrder: true, actorRolesInOrder: true, generatedReferenceConsistent: true, eventHead: 4, idempotencyCount: 4, idempotencyReferencesInOrder: true };
    report.workflowReference = { sha256: sha256(workflowId), version: 1 };
    report.checks.realFlarumExactPost = true;
    report.checks.httpSequence = true;
    updateStage("complete");
    completedFlow = true;
  } catch {
    report.status = "blocked";
  } finally {
    const failedAt = stage;
    updateStage("cleanup");
    let cleanupComplete = true;
    if (composeFiles.length) {
      try { compose(["down", "--volumes", "--remove-orphans"], { stdio: ["ignore", "ignore", "ignore"], timeout: 120_000 }); }
      catch { cleanupComplete = false; }
    }
    for (const volume of externalVolumes) {
      try { docker(["volume", "rm", "-f", volume], { stdio: ["ignore", "ignore", "ignore"], timeout: 30_000 }); }
      catch { cleanupComplete = false; }
    }
    let containers = "";
    let networks = "";
    let volumes = "";
    try { containers = docker(["ps", "-aq", "--filter", `label=com.docker.compose.project=${project}`]).trim(); }
    catch { cleanupComplete = false; }
    try { networks = docker(["network", "ls", "-q", "--filter", `label=com.docker.compose.project=${project}`]).trim(); }
    catch { cleanupComplete = false; }
    try { volumes = docker(["volume", "ls", "-q", "--filter", `label=com.docker.compose.project=${project}`]).trim(); }
    catch { cleanupComplete = false; }
    const projectResourcesRemoved = cleanupComplete && !containers && !networks && !volumes;
    report.cleanup = { scope: project, completed: false, projectResourcesRemoved, privateFixtureRemoved: false };
    report.status = projectResourcesRemoved ? "blocked" : "partial";
    report.failureStage = failedAt;
    try {
      assertSafeReport(report);
    } catch {
      report.checks = { reportRedaction: false };
      report.steps = {};
      report.workflowReference = null;
      report.publicRedaction = null;
      report.database = null;
      report.readyAttribution = null;
      report.status = projectResourcesRemoved ? "blocked" : "partial";
      report.failureStage = failedAt;
      assertSafeReport(report);
    }
    writeSafeReport(reportPath, report);

    const privateFixtureRemoved = cleanupPrivateFixtureDirectory({ evidence, project, runRoot });
    report.cleanup = {
      scope: project,
      completed: projectResourcesRemoved && privateFixtureRemoved,
      projectResourcesRemoved,
      privateFixtureRemoved
    };
    const passed = completedFlow && report.database?.eventCount === 4 && report.cleanup.completed === true;
    report.status = passed ? "pass" : (report.cleanup.completed ? "blocked" : "partial");
    report.failureStage = passed ? null : (report.cleanup.completed ? failedAt : "cleanup");
    report.finalized = true;
    writeSafeReport(reportPath, report);
  }
  if (report.status !== "pass") throw new Error("Workflow temporary acceptance blocked");
  process.stdout.write(`${reportPath}\n`);
  return report;
}

async function execute(argv = process.argv.slice(2)) {
  return executeWithIdentityContract(argv, PRODUCTION_IDENTITY_CONTRACT);
}

if (require.main === module) {
  execute().catch(() => { process.exitCode = 1; });
}

module.exports = {
  FIXTURE_POST_ID,
  CADDY_IMAGE,
  PRODUCTION_IDENTITY_CONTRACT,
  PRIVATE_FIXTURE_OWNERSHIP_SCRIPT,
  UINT32_MAX,
  assertSafeReport,
  catalogReadinessProbeProgram,
  classifyReadyHealth,
  createReadyAttribution,
  execute,
  executeWithIdentityContract,
  normalizeFixturePostId,
  runCatalogReadinessProbe,
  cleanupPrivateFixtureDirectory,
  validateArguments,
  validatePrivateFixtureCleanupScope,
  writeAcceptanceCaddyfile,
  writeSafeReport
};
