"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const base = path.join(deployment, "compose.server.yaml");
const production = path.join(deployment, "compose.workflow-production.yaml");
const suffix = crypto.randomBytes(6).toString("hex");
const volume = `aihub-workflow-production-secret-smoke-${suffix}`;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-production-secret-"));
const reportDirectory = path.join(root, "output", `workflow-production-overlay-smoke-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${suffix}`);
const report = { candidateOnly: true, deployable: false, volume, checks: {} };

function run(args, options = {}) {
  const result = spawnSync("docker", args, { cwd: root, encoding: "utf8", windowsHide: true, ...options });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function write(name, value) {
  const target = path.join(scratch, name);
  fs.writeFileSync(target, value, { encoding: "utf8", mode: 0o600 });
  return target;
}

function composeEnvironment() {
  const secretDirectory = path.join(scratch, "secrets");
  fs.mkdirSync(secretDirectory);
  for (const name of [
    "identity_db_password", "forum_db_password", "forum_db_root_password", "forum_admin_password",
    "forum_api_key", "forum_password_token", "community_internal", "community_management", "community_cms_gateway"
  ]) write(path.join("secrets", name), "a".repeat(64));
  const workflowDirectory = path.join(scratch, "workflow");
  fs.mkdirSync(workflowDirectory);
  write(path.join("workflow", "workflow_review_secret"), "b".repeat(64));
  return {
    ...process.env,
    AIHUB_ADMIN_CMS_IMAGE: "zhenxing-ai/admin:smoke",
    AIHUB_IDENTITY_IMAGE: "zhenxing-ai/identity:smoke",
    AIHUB_ADMIN_DATA_DIR: scratch,
    AIHUB_ADMIN_PUBLISHED_DIR: scratch,
    AIHUB_ADMIN_OUTPUT_DIR: scratch,
    AIHUB_IDENTITY_DB_DIR: scratch,
    AIHUB_COMMUNITY_DB_DIR: scratch,
    AIHUB_COMMUNITY_CONFIG_DIR: scratch,
    AIHUB_COMMUNITY_STORAGE_DIR: scratch,
    AIHUB_COMMUNITY_ASSETS_DIR: scratch,
    AIHUB_SECRET_DIR: secretDirectory,
    AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR: workflowDirectory,
    AIHUB_PUBLIC_HOST: "zhenxingai.invalid",
    AIHUB_COMMUNITY_PUBLIC_HOST: "community.zhenxingai.invalid",
    AIHUB_FORUM_ADMIN_EMAIL: "admin@example.invalid",
    AIHUB_CADDY_DATA_VOLUME: "smoke-caddy-data",
    AIHUB_CADDY_CONFIG_VOLUME: "smoke-caddy-config",
    AIHUB_CADDY_CMS_SECRET_VOLUME: "smoke-caddy-secret"
  };
}

function main() {
  fs.mkdirSync(reportDirectory, { recursive: true });
  try {
    const config = run(["compose", "--profile", "workflow-reviewer-provision", "-f", base, "-f", production, "config", "--format", "json"], {
      env: composeEnvironment()
    }).stdout;
    fs.writeFileSync(path.join(reportDirectory, "production-overlay-compose.json"), config);
    const parsed = JSON.parse(config);
    assert.equal(parsed.services.identity.environment.AIHUB_WORKFLOW_STORE_ENABLED, "1");
    assert.equal(parsed.services.identity.environment.AIHUB_WORKFLOW_REVIEW_SECRET_FILE, "/run/secrets/workflow_review_secret");
    assert.equal(parsed.services.identity.environment.AIHUB_WORKFLOW_REVIEWER_ID, "5f16d5ac-6663-5905-b920-c2140ac6769c");
    assert.equal(parsed.services["workflow-reviewer-provision"].environment.AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE, "hold");
    assert.deepEqual(parsed.services.caddy.secrets || [], []);
    assert.equal(Object.hasOwn(parsed.services.admin, "workflow_review_secret"), false);
    report.checks.overlay = "pass";

    run(["volume", "create", volume]);
    run([
      "run", "--rm", "--user", "0:0", "-v", `${volume}:/authority`, "node:24-alpine",
      "sh", "-ec", "umask 077; printf '%064d' 0 > /authority/workflow_review_secret; chown 0:0 /authority/workflow_review_secret; chmod 600 /authority/workflow_review_secret; test \"$(stat -c '%u:%g:%a:%h:%s' /authority/workflow_review_secret)\" = '0:0:600:1:64'"
    ]);
    const denied = run([
      "run", "--rm", "--user", "65534:65534", "-v", `${volume}:/authority:ro`, "node:24-alpine",
      "sh", "-ec", "test ! -r /authority/workflow_review_secret"
    ], { allowFailure: true });
    assert.equal(denied.status, 0, `${denied.stdout}${denied.stderr}`);
    report.checks.rootOwnedAuthority = "pass";
    report.ok = true;
  } finally {
    run(["volume", "rm", volume], { allowFailure: true });
    report.cleaned = run(["volume", "inspect", volume], { allowFailure: true }).status !== 0;
    const encoded = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(path.join(reportDirectory, "report.json"), encoded);
    fs.writeFileSync(path.join(reportDirectory, "report.sha256"), `${crypto.createHash("sha256").update(encoded).digest("hex")}  report.json\n`);
    fs.rmSync(scratch, { recursive: true, force: true });
    process.stdout.write(`${reportDirectory}\n`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
