"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  cleanupPrivateFixtureDirectory,
  writeAcceptanceCaddyfile
} = require("./workflow-production-temporary-acceptance.cjs");

const ACTIVE_ADMIN_IMAGE = "zhenxing-ai/admin:0.1.40-src-186ff057efd3";
const EXPECTED_ADMIN_IMAGE_ID = "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd";
const IDENTITY_IMAGE = "zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8";
const EXPECTED_IDENTITY_IMAGE_ID = "sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01";
const EXPECTED_SOURCE_DIGEST = "d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8";
const CADDY_IMAGE = "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
const SOURCE_POST_KEYS = Object.freeze([
  "chatgpt-desktop-research", "codex-cli-code-review", "claude-desktop-content"
]);
const REPORT_SCHEMA = "aihub-workflow-official-bootstrap-acceptance-v1";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const REVIEWER_ID = "5f16d5ac-6663-5905-b920-c2140ac6769c";
const ALLOWED_REPORT_KEYS = new Set([
  "schema", "candidateOnly", "deployable", "status", "manifestDigest", "adminImageId",
  "identityImageId", "identitySourceDigest", "runnerSha256", "workflowCount", "sourcePostCount",
  "checks", "workflowReferenceHashes", "sourcePostKeys", "cleanup", "failureStage", "failureCode"
]);

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function docker(args, options = {}) {
  return String(execFileSync("docker", args, { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...options }) || "");
}
function copyCatalogDirectory(source, destination) {
  const resolved = fs.realpathSync(source);
  if (!fs.statSync(resolved).isDirectory()) throw new Error("catalog source is not a directory");
  fs.cpSync(resolved, destination, {
    recursive: true,
    errorOnExist: true,
    filter: (entry) => !/(?:catalog-signing-private\.pem|\.env|secret)$/i.test(path.basename(entry))
  });
}
function writePrivate(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value, { encoding: "utf8", mode: 0o600 });
  try { fs.chmodSync(filename, 0o600); } catch {}
}
function reportSafe(value) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !ALLOWED_REPORT_KEYS.has(key))) {
    throw new Error("bootstrap report schema is invalid");
  }
  const encoded = JSON.stringify(value);
  if (/https?:\/\/|127\.0\.0\.1|Bearer\s|cookie|password|secret|token|identityId|reviewerId|authorIdentityId|\burl\b|sql|stack/i.test(encoded)) {
    throw new Error("bootstrap report contains private evidence");
  }
  return value;
}
function assertSafeBootstrapReport(value) { return reportSafe(value); }
function assertOfficialBootstrapDatabaseCounts(value, expected) {
  if (!value || typeof value !== "object" || !Number.isSafeInteger(expected) || expected < 1 ||
      value.events !== expected || value.idempotency !== expected ||
      value.eventHeadRows !== 1 || value.eventHead !== expected) {
    throw new Error("official bootstrap database counts are invalid");
  }
  return true;
}
function cleanupExactRunnerOwnedVolumes(volumes, dockerCall = docker) {
  if (!Array.isArray(volumes) || volumes.length !== 3 || new Set(volumes).size !== volumes.length || volumes.some((volume) => !/^workflowacceptance[a-z0-9]+_caddy_(?:data|config|secret)$/.test(volume))) {
    throw new Error("runner volume scope is invalid");
  }
  let removed = true;
  for (const volume of volumes) {
    try { dockerCall(["volume", "rm", "-f", volume]); } catch { removed = false; }
  }
  let listed;
  try { listed = new Set(String(dockerCall(["volume", "ls", "--format", "{{.Name}}"])).split(/\r?\n/).filter(Boolean)); } catch { return false; }
  return removed && volumes.every((volume) => !listed.has(volume));
}
function validateOfficialBootstrapRunnerContract({ manifest, bootstrap, sourcePosts } = {}) {
  if (!manifest?.digest?.sha256 || !Array.isArray(manifest.files)) throw new Error("deployment manifest is invalid");
  if (bootstrap?.candidateOnly !== true || !Array.isArray(bootstrap.workflows) || bootstrap.workflows.length !== 3) throw new Error("bootstrap manifest is invalid");
  if (sourcePosts?.candidateOnly !== true || !Array.isArray(sourcePosts.posts) || sourcePosts.posts.length !== 3) throw new Error("source-post manifest is invalid");
  if (bootstrap.workflows.some((item) => !SOURCE_POST_KEYS.includes(item.sourcePostKey)) || sourcePosts.posts.some((item) => !SOURCE_POST_KEYS.includes(item.key))) {
    throw new Error("source post keys are not canonical");
  }
  if (new Set(bootstrap.workflows.map((item) => item.sourcePostKey)).size !== 3 || new Set(sourcePosts.posts.map((item) => item.key)).size !== 3) {
    throw new Error("source post keys are duplicated");
  }
  return true;
}

const REQUEST_PROGRAM = String.raw`const fs=require('fs'),http=require('http');let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',async()=>{try{const p=JSON.parse(input),h={accept:'application/json'};if(p.body!==undefined)h['content-type']='application/json';if(p.idempotencyKey)h['idempotency-key']=p.idempotencyKey;if(p.reviewer)h['x-aihub-workflow-review-secret']=fs.readFileSync('/run/secrets/workflow_review_secret','utf8');let status,text;if(p.target==='caddy'){({status,text}=await new Promise((resolve,reject)=>{const r=http.request({host:'caddy',port:80,path:p.path,method:p.method||'GET',headers:{...h,host:'workflow-official-acceptance.invalid'},agent:false},x=>{const c=[];x.on('data',v=>c.push(v));x.on('end',()=>resolve({status:x.statusCode,text:Buffer.concat(c).toString('utf8')}))});r.setTimeout(10000,()=>r.destroy(new Error('timeout')));r.on('error',reject);if(p.body!==undefined)r.write(JSON.stringify(p.body));r.end()}))}else{const r=await fetch('http://127.0.0.1:4180'+p.path,{method:p.method||'GET',headers:h,body:p.body===undefined?undefined:JSON.stringify(p.body)});status=r.status;text=await r.text()}let body=null;try{body=JSON.parse(text)}catch{}process.stdout.write(JSON.stringify({status,body}))}catch{process.stdout.write(JSON.stringify({status:0,body:null}));process.exitCode=2}});`;

async function execute(argv = process.argv.slice(2)) {
  if (argv.length !== 3 || argv.some((value) => !path.isAbsolute(value))) throw new Error("runner requires absolute base, production overlay, evidence paths");
  const scriptDirectory = __dirname;
  const base = fs.realpathSync(argv[0]);
  const overlay = fs.realpathSync(argv[1]);
  const evidence = fs.realpathSync(argv[2]);
  if (path.basename(base) !== "compose.server.yaml" || path.basename(overlay) !== "compose.workflow-production.yaml") throw new Error("runner compose path is not canonical");
  const manifest = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "manifest.json"), "utf8"));
  const bootstrap = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "..", "..", "community", "workflow-official-bootstrap-candidate.json"), "utf8"));
  const sourcePosts = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "..", "..", "community", "workflow-official-source-posts-candidate.json"), "utf8"));
  validateOfficialBootstrapRunnerContract({ manifest, bootstrap, sourcePosts });
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const project = `workflowacceptance${stamp}${crypto.randomBytes(6).toString("hex")}`.toLowerCase();
  const runRoot = path.join(evidence, `${project}-private`);
  const reportPath = path.join(evidence, "workflow-official-bootstrap-acceptance-report.json");
  const volumes = [`${project}_caddy_data`, `${project}_caddy_config`, `${project}_caddy_secret`];
  const report = { schema: REPORT_SCHEMA, candidateOnly: true, deployable: false, status: "blocked", manifestDigest: manifest.digest.sha256, adminImageId: null, identityImageId: null, identitySourceDigest: EXPECTED_SOURCE_DIGEST, runnerSha256: sha256(fs.readFileSync(__filename)), workflowCount: 0, sourcePostCount: 0, checks: {}, workflowReferenceHashes: [], sourcePostKeys: SOURCE_POST_KEYS, cleanup: { completed: false }, failureStage: "preflight", failureCode: null };
  let files = []; let env; let stage = "preflight"; let completed = false; let workflowIds = [];
  const compose = (args, options = {}) => docker(["compose", "--project-name", project, ...files.flatMap((file) => ["-f", file]), ...args], { env, ...options });
  const request = (payload) => JSON.parse(docker(["exec", "-i", `${project}-identity-1`, "node", "-e", REQUEST_PROGRAM], { input: JSON.stringify(payload) }));
  const rows = () => compose(["ps", "--format", "json"]).trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const waitHealthy = async (names, timeout = 240000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (names.every((name) => rows().some((row) => row.Service === name && row.State === "running" && row.Health === "healthy"))) return; await new Promise((resolve) => setTimeout(resolve, 1000)); } throw new Error("service health timeout"); };
  const setStage = (next) => { stage = next; report.failureStage = next; };
  try {
    fs.mkdirSync(runRoot, { recursive: false, mode: 0o700 });
    const identityImage = JSON.parse(docker(["image", "inspect", IDENTITY_IMAGE]))[0];
    const adminImage = JSON.parse(docker(["image", "inspect", ACTIVE_ADMIN_IMAGE]))[0];
    if (identityImage.Id !== EXPECTED_IDENTITY_IMAGE_ID || identityImage.Config?.Labels?.["com.aihub.source-content-sha256"] !== EXPECTED_SOURCE_DIGEST) throw new Error("Identity image closure mismatch");
    if (adminImage.Id !== EXPECTED_ADMIN_IMAGE_ID) throw new Error("active7 Admin image mismatch");
    report.identityImageId = identityImage.Id; report.adminImageId = adminImage.Id; report.checks.supplyChain = true;
    setStage("prepare");
    const secrets = path.join(runRoot, "secrets");
    for (const name of ["identity_db_password", "forum_db_password", "forum_db_root_password", "forum_admin_password", "forum_api_key", "forum_password_token", "community_internal", "community_management", "community_cms_gateway", "workflow_review_secret"]) {
      const value = crypto.randomBytes(32).toString("hex");
      writePrivate(path.join(secrets, name), name === "forum_api_key" ? `${value}\n` : value);
    }
    const adminData = path.join(runRoot, "admin-data"); const adminPublished = path.join(runRoot, "admin-published");
    copyCatalogDirectory(process.env.AIHUB_ADMIN_DATA_DIR || path.join(scriptDirectory, "..", "..", "admin", "data"), adminData);
    copyCatalogDirectory(process.env.AIHUB_ADMIN_PUBLISHED_DIR || path.join(scriptDirectory, "..", "..", "admin", "published"), adminPublished);
    fs.mkdirSync(path.join(runRoot, "admin-output"));
    for (const volume of volumes) docker(["volume", "create", volume]);
    const seed = spawnSync("docker", ["run", "--rm", "-i", "--user", "0:0", "-v", `${volumes[2]}:/target`, "--entrypoint", "/bin/sh", CADDY_IMAGE, "-ec", "umask 077; IFS= read -r value; printf %s \"$value\" > /target/community_cms_gateway; chmod 400 /target/community_cms_gateway"], { encoding: "utf8", input: `${fs.readFileSync(path.join(secrets, "community_cms_gateway"), "utf8")}\n`, windowsHide: true });
    if (seed.status !== 0) throw new Error("Caddy secret seed failed");
    const caddyfile = path.join(runRoot, "Caddyfile"); writeAcceptanceCaddyfile(caddyfile, fs.readFileSync(path.join(scriptDirectory, "Caddyfile"), "utf8").replace(/^\{\$AIHUB_PUBLIC_HOST\}/m, "http://{$AIHUB_PUBLIC_HOST}").replace(/^\{\$AIHUB_COMMUNITY_PUBLIC_HOST\}/m, "http://{$AIHUB_COMMUNITY_PUBLIC_HOST}"));
    const override = path.join(runRoot, "compose.workflow-temporary-acceptance.yaml");
    const caddyMount = `${caddyfile.replaceAll("\\", "/")}:/etc/caddy/Caddyfile:ro`;
    writePrivate(override, `services:\n  admin:\n    ports: !reset []\n  caddy:\n    ports: !reset []\n    volumes:\n      - ${JSON.stringify(caddyMount)}\n`);
    files = [base, overlay]; if (process.platform === "win32") files.push(path.join(scriptDirectory, "compose.windows-acceptance.yaml")); files.push(override);
    env = { ...process.env, AIHUB_ADMIN_CMS_IMAGE: ACTIVE_ADMIN_IMAGE, AIHUB_ADMIN_DATA_DIR: adminData, AIHUB_ADMIN_PUBLISHED_DIR: adminPublished, AIHUB_ADMIN_OUTPUT_DIR: path.join(runRoot, "admin-output"), AIHUB_IDENTITY_DB_DIR: path.join(runRoot, "identity-db"), AIHUB_COMMUNITY_DB_DIR: path.join(runRoot, "community-db"), AIHUB_COMMUNITY_CONFIG_DIR: path.join(runRoot, "community-config"), AIHUB_COMMUNITY_STORAGE_DIR: path.join(runRoot, "community-storage"), AIHUB_COMMUNITY_ASSETS_DIR: path.join(runRoot, "community-assets"), AIHUB_SECRET_DIR: secrets, AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: secrets, AIHUB_FORUM_ADMIN_EMAIL: "workflow-official-acceptance@example.invalid", AIHUB_PUBLIC_HOST: "workflow-official-acceptance.invalid", AIHUB_COMMUNITY_PUBLIC_HOST: "community.workflow-official-acceptance.invalid", AIHUB_CADDY_DATA_VOLUME: volumes[0], AIHUB_CADDY_CONFIG_VOLUME: volumes[1], AIHUB_CADDY_CMS_SECRET_VOLUME: volumes[2] };
    compose(["config", "--no-interpolate"]);
    compose(["up", "-d", "identity-database", "community-database", "admin"]); await waitHealthy(["identity-database", "community-database", "admin"]);
    setStage("migrate");
    compose(["--profile", "migration", "run", "--rm", "identity-migrate"]); compose(["--profile", "migration", "run", "--rm", "community-migrate"]); compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=apply", "workflow-migrate"]); compose(["--profile", "workflow-migration", "run", "--rm", "-e", "AIHUB_WORKFLOW_MIGRATION_MODE=verify", "workflow-migrate"]);
    setStage("ready"); compose(["up", "-d", "identity"]); await waitHealthy(["identity"]); compose(["up", "-d", "community"]); await waitHealthy(["community"]); compose(["up", "-d", "caddy"]); await waitHealthy(["caddy"]); report.checks.health = true;
    compose(["--profile", "workflow-reviewer-provision", "run", "--rm", "workflow-reviewer-provision"], { input: "commit\n" });
    report.checks.reviewerServiceProvisioned = true;
    setStage("bootstrap");
    const bootstrapProgram = "const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.AIHUB_IDENTITY_DATABASE_URL});const m=require('/app/identity/workflow-official-bootstrap-production.cjs');m.runOfficialWorkflowProductionBootstrap({pool,catalogChannel:'v2'}).then(v=>process.stdout.write(JSON.stringify(v)+'\\n')).catch(e=>{process.stderr.write(String(e&&e.stack||e)+'\\n');process.exitCode=1}).finally(()=>pool.end())";
    const runOfficialBootstrap = () => {
      const output = compose(["--profile", "workflow-official-bootstrap", "run", "--rm", "--entrypoint", "/bin/sh", "workflow-official-bootstrap", "-ec", "p=$(cat /run/secrets/identity_db_password); export AIHUB_IDENTITY_DATABASE_URL=postgres://aihub:$p@identity-database:5432/aihub; exec node -e \"" + bootstrapProgram.replaceAll('"', '\\"') + "\""]);
      const jsonLine = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("{") && line.endsWith("}")).at(-1);
      const result = JSON.parse(jsonLine || "{}");
      if (result.status !== "published" || result.execution !== false || !Array.isArray(result.items) || result.items.length !== 3) throw new Error("official one-shot did not publish three workflows");
      return result;
    };
    const readDatabaseCounts = () => JSON.parse(docker(["exec", "-i", `${project}-identity-database-1`, "psql", "-X", "-At", "-U", "aihub", "-d", "aihub", "-c", "select json_build_object('events',(select count(*)::int from community_workflow.events),'idempotency',(select count(*)::int from community_workflow.idempotency),'eventHeadRows',(select count(*)::int from community_workflow.event_head where singleton=true),'eventHead',(select last_sequence::int from community_workflow.event_head where singleton=true));"]).trim() || "{}");
    const first = runOfficialBootstrap();
    report.workflowCount = 3; report.sourcePostCount = 3; report.checks.active7CatalogChannel = true; report.checks.sourcePostKeysBound = true; report.checks.publisherOwnerReviewerPublic = true;
    workflowIds = first.items.map((item) => item.workflowId);
    const list = request({ path: "/v1/community/workflow-store/public/list?limit=50" });
    if (list.status !== 200 || list.body?.items?.length !== 3 || list.body?.items.some((item) => item.author?.displayName !== "枕星AI助手")) throw new Error("public list is not exactly three official workflows");
    for (const id of workflowIds) { const detail = request({ path: `/v1/community/workflow-store/public/release?workflowId=${id}&version=1` }); if (detail.status !== 200 || detail.body?.workflowId !== id || detail.body?.version !== 1) throw new Error("public detail failed"); }
    const caddyProbe = request({ target: "caddy", path: "/v1/community/workflow-store/public/list?limit=50" });
    if (caddyProbe.status !== 200 || caddyProbe.body?.items?.length !== 3) throw new Error("Caddy public route failed");
    report.checks.publicListDetail3 = true; report.checks.caddyPublicList3 = true; report.workflowReferenceHashes = workflowIds.map((id) => sha256(id));
    const firstCounts = readDatabaseCounts();
    assertOfficialBootstrapDatabaseCounts(firstCounts, 9);
    const replay = runOfficialBootstrap();
    const replayWorkflowIds = replay.items.map((item) => item.workflowId);
    if (replayWorkflowIds.length !== workflowIds.length || replayWorkflowIds.some((id, index) => id !== workflowIds[index])) throw new Error("official bootstrap replay changed workflows");
    const replayCounts = readDatabaseCounts();
    assertOfficialBootstrapDatabaseCounts(replayCounts, 9);
    for (const [index, id] of workflowIds.entries()) { const unlisted = request({ method: "POST", path: "/v1/community/workflow-store/reviewer/unlist", reviewer: true, idempotencyKey: `official-bootstrap-unlist-${index + 1}`, body: { workflowId: id, reason: "official acceptance cleanup" } }); if (unlisted.status !== 200) throw new Error("official unlist failed"); }
    const empty = request({ path: "/v1/community/workflow-store/public/list?limit=50" });
    const unlistCounts = readDatabaseCounts();
    assertOfficialBootstrapDatabaseCounts(unlistCounts, 12);
    if (empty.status !== 200 || empty.body?.items?.length !== 0) throw new Error("cleanup did not preserve append-only history");
    report.checks.appendOnlyCounts = {
      firstBootstrap: { events: firstCounts.events, idempotency: firstCounts.idempotency, eventHead: firstCounts.eventHead },
      replay: { events: replayCounts.events, idempotency: replayCounts.idempotency, eventHead: replayCounts.eventHead },
      afterUnlist: { events: unlistCounts.events, idempotency: unlistCounts.idempotency, eventHead: unlistCounts.eventHead }
    };
    report.checks.unlistOnlyCleanup = true; completed = true; stage = "complete";
  } catch (error) { if (process.env.AIHUB_RUNNER_DEBUG === "1") process.stderr.write(`${error?.stack || error}\n`); report.status = "blocked"; report.failureCode = /^[A-Z0-9_-]{3,64}$/.test(error?.code || "") ? error.code : "RUNNER_STAGE_FAILED"; }
  finally {
    const failedStage = stage;
    try { if (files.length) compose(["down", "--volumes", "--remove-orphans"], { stdio: ["ignore", "ignore", "ignore"] }); } catch {}
    const exactRunnerVolumesRemoved = cleanupExactRunnerOwnedVolumes(volumes);
    let composeProjectResourcesRemoved = false;
    try {
      composeProjectResourcesRemoved = !docker(["ps", "-aq", "--filter", `label=com.docker.compose.project=${project}`]).trim() && !docker(["network", "ls", "-q", "--filter", `label=com.docker.compose.project=${project}`]).trim() && !docker(["volume", "ls", "-q", "--filter", `label=com.docker.compose.project=${project}`]).trim();
    } catch {}
    const projectResourcesRemoved = composeProjectResourcesRemoved && exactRunnerVolumesRemoved;
    const privateFixtureRemoved = cleanupPrivateFixtureDirectory({ evidence, project, runRoot });
    report.cleanup = { completed: projectResourcesRemoved && privateFixtureRemoved, projectResourcesRemoved, exactRunnerVolumesRemoved, privateFixtureRemoved };
    report.status = completed && report.cleanup.completed ? "pass" : (report.cleanup.completed ? "blocked" : "partial"); report.failureStage = report.status === "pass" ? null : failedStage;
    reportSafe(report); fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  if (report.status !== "pass") throw new Error("official Workflow bootstrap acceptance blocked");
  process.stdout.write(`${reportPath}\n`);
  return report;
}

if (require.main === module) execute().catch(() => { process.exitCode = 1; });
module.exports = { ACTIVE_ADMIN_IMAGE, EXPECTED_ADMIN_IMAGE_ID, IDENTITY_IMAGE, EXPECTED_IDENTITY_IMAGE_ID, EXPECTED_SOURCE_DIGEST, SOURCE_POST_KEYS, assertOfficialBootstrapDatabaseCounts, assertSafeBootstrapReport, cleanupExactRunnerOwnedVolumes, execute, validateOfficialBootstrapRunnerContract };
