"use strict";

// This is deliberately a small, fixed adapter around the source-closed
// Identity one-shot. The one-shot accepts only the literal v2 catalog channel.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ACTIVE_ADMIN_IMAGE = "zhenxing-ai/admin:0.1.40-src-186ff057efd3";
const EXPECTED_ADMIN_IMAGE_ID = "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd";
const IDENTITY_IMAGE = "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e";
const EXPECTED_IDENTITY_IMAGE_ID = "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748";
const EXPECTED_SOURCE_DIGEST = "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7";
const SOURCE_POST_KEYS = Object.freeze(["chatgpt-desktop-research", "codex-cli-code-review", "claude-desktop-content"]);
const REPORT_KEYS = new Set(["schema", "candidateOnly", "deployable", "status", "manifestDigest", "adminImageId", "identityImageId", "identitySourceDigest", "workflowCount", "sourcePostCount", "sourcePostKeys", "workflowReferenceHashes", "checks", "failureStage", "failureCode"]);

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function docker(args, options = {}) { return String(execFileSync("docker", args, { encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options }) || ""); }
function compose(files, args, options) { return docker(["compose", ...files.flatMap((file) => ["-f", file]), ...args], options); }
function fail(message) { const error = new Error(message); error.code = "OFFICIAL_BOOTSTRAP_PRODUCTION_BLOCKED"; throw error; }
function isAbsoluteRegular(file) { return path.isAbsolute(file) && fs.existsSync(file) && fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(); }
function isAbsoluteDirectory(directory) { return path.isAbsolute(directory) && fs.existsSync(directory) && fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink(); }
function nativePath(value) {
  const candidate = String(value || "");
  return process.platform === "win32" && /^\/[a-zA-Z]\//.test(candidate)
    ? `${candidate[1].toUpperCase()}:\\${candidate.slice(3).replaceAll("/", "\\")}`
    : candidate;
}
function safeReport(value) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !REPORT_KEYS.has(key))) fail("bootstrap report is invalid");
  if (/https?:\/\/|secret|token|password|identityId|reviewerId|workflowId|sourceCommunityPostId|\burl\b|sql|stack/i.test(JSON.stringify(value))) fail("bootstrap report leaks a private value");
  return value;
}
function publicSafe(value) {
  const forbidden = new Set(["identityId", "reviewerId", "reviewedBy", "audit", "internalNotes", "secretPlaceholders", "price", "currency", "order", "payment", "entitlement", "execution"]);
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(([key, child]) => !forbidden.has(key) && publicSafe(child));
}
function normalizePublicHost(value) {
  const host = String(value || "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
    fail("wrapper public host is invalid");
  }
  return host;
}
function publicProbeSummary(identityList, caddyList) {
  const statusClass = (status) => Number.isInteger(status) && status >= 100 && status <= 599 ? `${Math.floor(status / 100)}xx` : "none";
  const itemCount = (value) => Array.isArray(value?.body?.items) ? value.body.items.length : null;
  return Object.freeze({
    identityStatusClass: statusClass(identityList?.status),
    identityItemCount: itemCount(identityList),
    caddyStatusClass: statusClass(caddyList?.status),
    caddyItemCount: itemCount(caddyList)
  });
}
function exactPublicListResponse(value) {
  return value?.status === 200 && Array.isArray(value.body?.items) && value.body.items.length === 3 && publicSafe(value.body);
}
function waitForPublicTls(probe, {
  deadlineMs = 300_000,
  intervalMs = 1_000,
  now = Date.now,
  sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
} = {}) {
  const deadline = now() + deadlineMs;
  let attemptCount = 0;
  while (now() < deadline) {
    attemptCount += 1;
    try {
      if (probe("caddy", "/health")?.status === 200) return Object.freeze({ attemptCount });
    } catch {}
    const remaining = deadline - now();
    if (remaining > 0) sleep(Math.min(intervalMs, remaining));
  }
  fail("public TLS is unavailable");
}
function readFixedV2Release(adminOrigin) {
  const probe = String.raw`const http=require('http');const origin=new URL(process.argv[1]);if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.search||origin.hash)process.exit(2);const req=http.get({host:origin.hostname,port:Number(origin.port),path:'/channels/v2/catalog-release.json',headers:{accept:'application/json'},agent:false},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{let body=null;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{}process.stdout.write(JSON.stringify({status:res.statusCode,body}))})});req.setTimeout(10000,()=>req.destroy(new Error('timeout')));req.on('error',()=>process.exit(2));`;
  let value;
  try {
    value = JSON.parse(execFileSync(process.execPath, ["-e", probe, adminOrigin], {
      encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024
    }));
  } catch {
    fail("fixed Admin v2 catalog is unavailable");
  }
  if (value?.status !== 200 || !value.body || typeof value.body !== "object") {
    fail("fixed Admin v2 catalog is unavailable");
  }
  return value.body;
}
function bootstrapProgram() {
  return "const {Pool}=require('pg');const p=require('fs').readFileSync('/run/secrets/identity_db_password','utf8').trim();const pool=new Pool({connectionString:'postgres://aihub:'+encodeURIComponent(p)+'@identity-database:5432/aihub'});const m=require('/app/identity/workflow-official-bootstrap-production.cjs');m.runOfficialWorkflowProductionBootstrap({pool,catalogChannel:'v2'}).then(v=>process.stdout.write(JSON.stringify(v)+'\\n')).catch(()=>{process.exitCode=1}).finally(()=>pool.end())";
}
const REQUEST_PROGRAM = String.raw`const http=require('http'),https=require('https');let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',async()=>{try{const p=JSON.parse(input),caddy=p.target==='caddy',o=caddy?{host:'caddy',port:443,servername:p.publicHost,path:p.path,headers:{host:p.publicHost}}:{host:'127.0.0.1',port:4180,path:p.path,headers:{}};const r=(caddy?https:http).get({...o,agent:false},x=>{const b=[];x.on('data',v=>b.push(v));x.on('end',()=>{let body=null;try{body=JSON.parse(Buffer.concat(b).toString('utf8'))}catch{}process.stdout.write(JSON.stringify({status:x.statusCode,body}))})});r.setTimeout(10000,()=>r.destroy(new Error('timeout')));r.on('error',()=>process.exit(2))}catch{process.exit(2)}});`;

function parseArgs(argv, scriptDirectory = __dirname) {
  if (argv.length < 5) fail("wrapper requires evidence, Admin origin, public host, and canonical Compose files");
  const [evidence, adminOrigin, publicHostInput, ...files] = argv;
  if (!isAbsoluteDirectory(evidence) || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(adminOrigin) || files.some((file) => !isAbsoluteRegular(file))) fail("wrapper arguments are invalid");
  const canonicalFiles = files.map((file) => fs.realpathSync(file));
  const expectedBase = fs.realpathSync(path.join(scriptDirectory, "compose.server.yaml"));
  const expectedOverlay = fs.realpathSync(path.join(scriptDirectory, "compose.workflow-production.yaml"));
  if (canonicalFiles[0] !== expectedBase || canonicalFiles[1] !== expectedOverlay) fail("wrapper Compose files are invalid");
  const isolated = process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE ?? "0";
  const acceptanceListSet = Object.hasOwn(process.env, "AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES");
  const acceptanceRootSet = Object.hasOwn(process.env, "AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT");
  if (isolated === "0") {
    if (canonicalFiles.length !== 2 || acceptanceListSet || acceptanceRootSet) fail("wrapper production Compose files are invalid");
  } else if (isolated === "1") {
    if (canonicalFiles.length !== 5 || !acceptanceListSet || !acceptanceRootSet) fail("wrapper isolated Compose files are invalid");
    const listPath = nativePath(process.env.AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES);
    const rootPath = nativePath(process.env.AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT);
    if (!isAbsoluteRegular(listPath) || !isAbsoluteDirectory(rootPath)) fail("wrapper isolated Compose controls are invalid");
    const entries = fs.readFileSync(listPath, "utf8").split(/\r?\n/);
    if (entries.at(-1) === "") entries.pop();
    if (entries.length !== 5 || entries.some((entry) => !entry || /[\x00-\x1f\x7f]/.test(entry))) fail("wrapper isolated Compose controls are invalid");
    const controlledFiles = entries.map(nativePath);
    if (controlledFiles.some((file) => !isAbsoluteRegular(file)) || JSON.stringify(controlledFiles.map((file) => fs.realpathSync(file))) !== JSON.stringify(canonicalFiles)) fail("wrapper isolated Compose controls are invalid");
    const extras = canonicalFiles.slice(2);
    const canonicalRoot = fs.realpathSync(rootPath);
    if (JSON.stringify(extras.map((file) => path.basename(file))) !== JSON.stringify(["compose.windows-acceptance.yaml", "ports.override.yaml", "caddy.override.yaml"]) || new Set(extras).size !== 3 || extras.some((file) => path.dirname(file) !== canonicalRoot)) fail("wrapper isolated Compose files are invalid");
  } else {
    fail("wrapper isolated acceptance mode is invalid");
  }
  return { evidence: fs.realpathSync(evidence), adminOrigin, publicHost: normalizePublicHost(publicHostInput), files: canonicalFiles };
}
function verifyContract(scriptDirectory, files) {
  const manifest = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "manifest.json"), "utf8"));
  const bootstrap = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "..", "..", "community", "workflow-official-bootstrap-candidate.json"), "utf8"));
  const posts = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "..", "..", "community", "workflow-official-source-posts-candidate.json"), "utf8"));
  if (!manifest?.digest?.sha256 || bootstrap?.candidateOnly !== true || posts?.candidateOnly !== true || !Array.isArray(bootstrap.workflows) || !Array.isArray(posts.posts) || JSON.stringify(bootstrap.workflows.map((item) => item.sourcePostKey)) !== JSON.stringify(SOURCE_POST_KEYS) || JSON.stringify(posts.posts.map((item) => item.key)) !== JSON.stringify(SOURCE_POST_KEYS)) fail("frozen bootstrap manifest is invalid");
  const images = compose(files, ["config", "--images"]).trim().split(/\r?\n/);
  if (!images.includes(ACTIVE_ADMIN_IMAGE) || !images.includes(IDENTITY_IMAGE)) fail("production images do not match the frozen bootstrap contract");
  const identity = JSON.parse(docker(["image", "inspect", IDENTITY_IMAGE]))[0];
  const admin = JSON.parse(docker(["image", "inspect", ACTIVE_ADMIN_IMAGE]))[0];
  if (identity?.Id !== EXPECTED_IDENTITY_IMAGE_ID || identity?.Config?.Labels?.["com.aihub.source-content-sha256"] !== EXPECTED_SOURCE_DIGEST || admin?.Id !== EXPECTED_ADMIN_IMAGE_ID) fail("production image closure mismatch");
  return { manifest, bootstrap, identity, admin };
}
function execute(argv = process.argv.slice(2)) {
  const evidence = isAbsoluteDirectory(argv[0]) ? fs.realpathSync(argv[0]) : fail("wrapper evidence directory is invalid");
  const scriptDirectory = __dirname;
  const reportPath = path.join(evidence, "workflow-official-bootstrap-production-report.json");
  let stage = "arguments";
  let report = { schema: "aihub-workflow-official-bootstrap-production-v1", candidateOnly: true, deployable: false, status: "blocked", manifestDigest: null, adminImageId: null, identityImageId: null, identitySourceDigest: EXPECTED_SOURCE_DIGEST, workflowCount: 0, sourcePostCount: 0, sourcePostKeys: SOURCE_POST_KEYS, workflowReferenceHashes: [], checks: {}, failureStage: stage, failureCode: "OFFICIAL_BOOTSTRAP_PRODUCTION_BLOCKED" };
  try {
    const { adminOrigin, publicHost, files } = parseArgs(argv, scriptDirectory);
    stage = "preflight";
    report.failureStage = stage;
    const frozen = verifyContract(scriptDirectory, files);
    report.manifestDigest = frozen.manifest.digest.sha256; report.adminImageId = frozen.admin.Id; report.identityImageId = frozen.identity.Id;
    stage = "catalog";
    const release = readFixedV2Release(adminOrigin);
    if (!release || typeof release !== "object") fail("active7 catalog is unavailable");
    report.checks.active7Catalog = true;
    const identityContainer = compose(files, ["ps", "-q", "identity"]).trim();
    if (!identityContainer) fail("Identity is unavailable for public verification");
    const probe = (target, endpoint) => JSON.parse(docker(["exec", "-i", identityContainer, "node", "-e", REQUEST_PROGRAM], { input: JSON.stringify({ target, path: endpoint, publicHost }) }));
    stage = "public-tls";
    waitForPublicTls(probe);
    report.checks.publicTlsReady = true;
    stage = "bootstrap";
    const output = compose(files, ["--profile", "workflow-official-bootstrap", "run", "--no-deps", "--rm", "-T", "--entrypoint", "/bin/sh", "workflow-official-bootstrap", "-ec", `exec node -e \"${bootstrapProgram().replaceAll('"', '\\"')}\"`]);
    const line = output.split(/\r?\n/).map((item) => item.trim()).filter((item) => item.startsWith("{") && item.endsWith("}")).at(-1);
    const result = JSON.parse(line || "{}");
    if (result.status !== "published" || result.execution !== false || !Array.isArray(result.items) || result.items.length !== 3) fail("official one-shot did not publish exactly three workflows");
    const ids = result.items.map((item) => item.workflowId);
    stage = "public";
    const list = probe("identity", "/v1/community/workflow-store/public/list?limit=50");
    const caddy = probe("caddy", "/v1/community/workflow-store/public/list?limit=50");
    report.checks.publicProbe = publicProbeSummary(list, caddy);
    if (!exactPublicListResponse(list) || !exactPublicListResponse(caddy)) fail("outer public list is invalid");
    for (const id of ids) { const detail = probe("identity", `/v1/community/workflow-store/public/release?workflowId=${id}&version=1`); if (detail.status !== 200 || detail.body?.version !== 1 || !publicSafe(detail.body)) fail("outer public detail is invalid"); }
    report.workflowCount = 3; report.sourcePostCount = 3; report.workflowReferenceHashes = ids.map(sha256); report.checks = { ...report.checks, sourcePostsExactGet: true, publisherOwnerReviewerPublic: true, publicListDetail3: true, caddyPublicList3: true, idempotentOneShot: true };
    report.status = "pass"; report.failureStage = null; report.failureCode = null;
  } catch (error) {
    report.failureStage = stage;
    report.failureCode = stage === "catalog" ? "OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE" : "OFFICIAL_BOOTSTRAP_PRODUCTION_BLOCKED";
  }
  safeReport(report);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  if (report.status !== "pass") fail("official bootstrap production wrapper blocked");
  process.stdout.write(`${reportPath}\n`);
  return report;
}
if (require.main === module) { try { execute(); } catch { process.exitCode = 1; } }
module.exports = { ACTIVE_ADMIN_IMAGE, EXPECTED_ADMIN_IMAGE_ID, IDENTITY_IMAGE, EXPECTED_IDENTITY_IMAGE_ID, EXPECTED_SOURCE_DIGEST, SOURCE_POST_KEYS, REQUEST_PROGRAM, execute, exactPublicListResponse, safeReport, normalizePublicHost, publicProbeSummary, waitForPublicTls };
