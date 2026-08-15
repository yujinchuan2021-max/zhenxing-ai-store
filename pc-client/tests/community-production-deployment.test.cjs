"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const compose = fs.readFileSync(path.join(deployment, "compose.server.yaml"), "utf8");
const caddy = fs.readFileSync(path.join(deployment, "Caddyfile"), "utf8");
const readme = fs.readFileSync(path.join(deployment, "README.md"), "utf8");
const server = fs.readFileSync(path.join(root, "admin", "server.cjs"), "utf8");
const identityServer = fs.readFileSync(path.join(root, "identity", "server.cjs"), "utf8");
const windowsAcceptancePath = path.join(deployment, "compose.windows-acceptance.yaml");
const adminOnlyCompose = fs.readFileSync(path.join(root, "deployment", "admin-only", "compose.server.yaml"), "utf8");
const localCompose = fs.readFileSync(path.join(root, "deployment", "local", "compose.yaml"), "utf8");
const identityDockerfile = fs.readFileSync(path.join(deployment, "identity.Dockerfile"), "utf8");
const workflowAcceptancePath = path.join(deployment, "compose.workflow-acceptance.yaml");
const workflowProductionPath = path.join(deployment, "compose.workflow-production.yaml");
const workflowMigrationRunnerPath = path.join(deployment, "workflow-migrate.cjs");
const workflowMigrationHostPath = path.join(deployment, "run-workflow-migration.sh");
const workflowProductionMigrationPath = path.join(deployment, "run-workflow-production-migration.sh");
const workflowProductionCutoverPath = path.join(deployment, "workflow-production-cutover.sh");
const workflowProductionAcceptanceRunnerPath = path.join(
  deployment,
  "workflow-production-temporary-acceptance.cjs"
);
const identityMigrationHostPath = path.join(deployment, "run-migrations.sh");
const workflowProductionEmergencyDisablePath = path.join(deployment, "workflow-production-emergency-disable.sh");
const workflowReviewerSecretPath = path.join(deployment, "workflow-review-secret.sh");
const hostSecretAuthorityPath = path.join(deployment, "host-secret-authority.sh");
const workflowCutoverComposeSmokePath = path.join(root, "scripts", "test-workflow-cutover-compose-five-file-smoke.cjs");
const caddyEntrypointPath = path.join(deployment, "caddy-entrypoint.sh");
const caddySecretSeedPath = path.join(deployment, "caddy-secret-seed.sh");
const seedCaddySecretVolumePath = path.join(deployment, "seed-caddy-secret-volume.sh");
const issueCaddyGatewaySecretPath = path.join(deployment, "issue-caddy-gateway-secret.sh");
const probeCaddySecretVolumePath = path.join(deployment, "probe-caddy-secret-volume.sh");
const probeCaddyMockPath = path.join(deployment, "caddy-secret-probe-mock.cjs");
const caddyRuntimeOwnershipGatePath = path.join(root, "scripts", "test-caddy-runtime-ownership.cjs");
const workflowProductionOverlaySmokePath = path.join(root, "scripts", "test-workflow-production-overlay-smoke.cjs");
const workflowProductionMigrationRollbackPath = path.join(root, "scripts", "test-workflow-production-migration-rollback.cjs");
const workflowCandidate = fs.readFileSync(path.join(root, "docs", "workflow-store-production-deployment-candidate.md"), "utf8");
const expectedIdentitySourceDigest = "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7";
const expectedIdentityImage = "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e";
const nodeHttpHealth = /require\('http'\)\.get\(\{host:'127\.0\.0\.1',port:4173,path:'\/health',agent:false\},r=>\{r\.resume\(\);process\.exit\(r\.statusCode===200\?0:1\)\}\);req\.setTimeout\(2000,\(\)=>\{req\.destroy\(\);process\.exit\(1\)\}\);req\.on\('error',\(\)=>process\.exit\(1\)\)/;

test("production topology has no build, default secret, public database, or signing key", () => {
  assert.doesNotMatch(compose, /^\s*build:/m);
  assert.doesNotMatch(compose, /:-[^}\n]+/);
  assert.doesNotMatch(compose, /AIHUB_CATALOG_SIGNING_PRIVATE_KEY/);
  assert.match(compose, /127\.0\.0\.1:4174:4174/);
  assert.match(compose, /AIHUB_REGISTRATION_ENABLED: "0"/);
  assert.equal((compose.match(/mem_limit:/g) || []).length, 9);
  assert.equal((compose.match(/cpus:/g) || []).length, 9);
});

test("Admin catalog serving is not throttled below the signed-catalog readiness window", () => {
  const admin = compose.match(/\n  admin:\n[\s\S]*?(?=\n  identity-database:)/)?.[0] || "";
  assert.match(admin, /cpus: "0\.75"/);
  assert.doesNotMatch(admin, /cpus: "0\.20"/);
});

test("PostgreSQL health proves the exact TCP database and principal before either one-shot Identity migration", () => {
  const database = compose.match(/\n  identity-database:\n[\s\S]*?(?=\n  identity-migrate:)/)?.[0] || "";
  const outerMigration = fs.readFileSync(identityMigrationHostPath, "utf8");
  const temporaryAcceptance = fs.readFileSync(workflowProductionAcceptanceRunnerPath, "utf8");

  assert.match(database, /PGPASSWORD=\\"\$\(cat \/run\/secrets\/identity_db_password\)\\" psql -X -v ON_ERROR_STOP=1 -h 127\.0\.0\.1 -U aihub -d aihub -Atqc/);
  assert.match(database, /current_database\(\)='aihub'/);
  assert.match(database, /current_user='aihub'/);
  assert.match(database, /grep -qx 1/);
  assert.doesNotMatch(database, /pg_isready/);
  assert.match(compose, /identity-migrate:[\s\S]*?identity-database: \{ condition: service_healthy \}/);
  assert.match(outerMigration, /--profile migration run --rm identity-migrate/);
  assert.match(temporaryAcceptance, /compose\(\["--profile", "migration", "run", "--rm", "identity-migrate"\]\)/);
});

test("identity image includes the canonical submission model without enabling it", () => {
  assert.match(
    identityDockerfile,
    /COPY admin\/resource-submissions\.cjs \/app\/admin\/resource-submissions\.cjs/
  );
  assert.match(identityDockerfile, /shared\/catalog-taxonomy\.cjs/);
  assert.match(compose, /AIHUB_RESOURCE_SUBMISSIONS_ENABLED: "0"/);
  assert.match(compose, /AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION: "0"/);
});

test("Workflow Store production base is disabled and acceptance enables only explicit candidate flags", () => {
  assert.equal(fs.existsSync(workflowAcceptancePath), true);
  const override = fs.readFileSync(workflowAcceptancePath, "utf8");
  for (const variable of [
    "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
    "AIHUB_WORKFLOW_STORE_ENABLED",
    "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
    "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED"
  ]) {
    assert.match(compose, new RegExp(`${variable}: "0"`));
    assert.match(override, new RegExp(`${variable}: "1"`));
  }
  assert.match(compose, /AIHUB_WORKFLOW_STORE_SCHEMA_VERSION: "0"/);
  assert.match(override, /AIHUB_WORKFLOW_STORE_SCHEMA_VERSION: "1"/);
  assert.doesNotMatch(compose, /workflow_review_secret/);
  assert.match(override, /AIHUB_WORKFLOW_REVIEW_SECRET_FILE: \/run\/secrets\/workflow_review_secret/);
  assert.match(override, /workflow_review_secret:\s*\n\s+file: \$\{AIHUB_WORKFLOW_ACCEPTANCE_SECRET_DIR/);
});

test("Workflow Store production enablement is a separate fail-closed overlay, never the acceptance fixture", () => {
  assert.equal(fs.existsSync(workflowProductionPath), true);
  const production = fs.readFileSync(workflowProductionPath, "utf8");
  const acceptance = fs.readFileSync(workflowAcceptancePath, "utf8");
  for (const variable of [
    "AIHUB_WORKFLOW_STORE_ENABLED",
    "AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED",
    "AIHUB_WORKFLOW_STORE_SCHEMA_VERSION"
  ]) {
    assert.match(compose, new RegExp(`${variable}: "0"`));
    assert.match(production, new RegExp(`${variable}: "1"`));
  }
  for (const variable of [
    "AIHUB_RESOURCE_SUBMISSIONS_ENABLED",
    "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION",
    "AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED"
  ]) {
    assert.match(compose, new RegExp(`${variable}: "0"`));
    assert.match(production, new RegExp(`${variable}: "0"`));
  }
  assert.match(production, /AIHUB_WORKFLOW_REVIEW_SECRET_FILE: \/run\/secrets\/workflow_review_secret/);
  assert.match(production, /AIHUB_WORKFLOW_REVIEWER_ID: 5f16d5ac-6663-5905-b920-c2140ac6769c/);
  assert.match(production, /workflow-reviewer-provision:[\s\S]*?profiles: \["workflow-reviewer-provision"\]/);
  assert.doesNotMatch(production, /AIHUB_WORKFLOW_PRODUCTION_REVIEWER_ID|22222222-2222-4222-8222-222222222222/);
  assert.match(production, /workflow_review_secret:\s*\n\s+file: \$\{AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR:\?set production workflow secret directory\}\/workflow_review_secret/);
  assert.doesNotMatch(production, /ACCEPTANCE|acceptance|fixture|localhost|127\.0\.0\.1:\d{4}/);
  assert.doesNotMatch(production, /\n  (?:admin|community|caddy):/);
  assert.doesNotMatch(production, new RegExp(acceptance.match(/AIHUB_WORKFLOW_ACCEPTANCE_REVIEWER_ID/) ? "AIHUB_WORKFLOW_ACCEPTANCE_REVIEWER_ID" : "^$"));
});

test("Workflow schema changes require an explicit one-shot job and verified backup", () => {
  assert.equal(fs.existsSync(workflowMigrationRunnerPath), true);
  assert.equal(fs.existsSync(workflowMigrationHostPath), true);
  const runner = fs.readFileSync(workflowMigrationRunnerPath, "utf8");
  const host = fs.readFileSync(workflowMigrationHostPath, "utf8");
  assert.match(compose, /workflow-migrate:\s*[\s\S]*?profiles: \["workflow-migration"\]/);
  assert.match(compose, /workflow-migrate:\s*[\s\S]*?restart: "no"/);
  assert.match(compose, /AIHUB_WORKFLOW_MIGRATION_MODE: verify/);
  assert.doesNotMatch(compose.slice(compose.indexOf("  identity:"), compose.indexOf("\n  community-database:")), /AIHUB_WORKFLOW_MIGRATION_MODE/);
  assert.match(runner, /0001-workflow-store\.sql/);
  assert.match(runner, /0001-workflow-store\.rollback\.sql/);
  assert.match(runner, /community_workflow\.events/);
  assert.doesNotMatch(runner, /community_workflow\.workflow_events/);
  assert.match(host, /sha256sum -c SHA256SUMS/);
  assert.match(host, /identity\.pgdump/);
  assert.match(host, /--profile workflow-migration run --rm/);
  assert.match(host, /AIHUB_WORKFLOW_MIGRATION_MODE/);
});

test("Workflow production migration refuses unsafe rollback and needs a verified absolute backup", () => {
  assert.equal(fs.existsSync(workflowProductionMigrationPath), true);
  const productionMigration = fs.readFileSync(workflowProductionMigrationPath, "utf8");
  assert.match(productionMigration, /backup directory must be absolute/);
  assert.match(productionMigration, /sha256sum -c SHA256SUMS/);
  assert.match(productionMigration, /action.*apply\|verify\|rollback/);
  assert.match(productionMigration, /to_regclass\('community_workflow\.events'\)/);
  assert.match(productionMigration, /query_to_xml/);
  assert.match(productionMigration, /migration was not applied; rollback is a no-op/);
  assert.doesNotMatch(productionMigration, /community_workflow\.workflow_events/);
  assert.match(productionMigration, /refuses rollback after Workflow events/);
  assert.match(productionMigration, /run-workflow-migration\.sh/);
});

test("Workflow production secret authority is host-file-only, audited, and isolated from Caddy", () => {
  assert.equal(fs.existsSync(hostSecretAuthorityPath), true);
  assert.equal(fs.existsSync(workflowReviewerSecretPath), true);
  const authority = fs.readFileSync(hostSecretAuthorityPath, "utf8");
  const reviewer = fs.readFileSync(workflowReviewerSecretPath, "utf8");
  assert.match(reviewer, /host-secret-authority\.sh/);
  assert.match(reviewer, /workflow-review/);
  assert.match(reviewer, /\[\[ \$# -eq 2 \]\]/);
  assert.match(authority, /issue\|validate\|revoke/);
  assert.match(authority, /approved_uid="\$SUDO_UID"/);
  assert.match(authority, /approved_gid="\$SUDO_GID"/);
  assert.match(authority, /source_mode" == "600"/);
  assert.match(authority, /source_links" == "1"/);
  assert.match(authority, /openssl rand -hex 32/);
  assert.match(authority, /mktemp --tmpdir="\$directory"/);
  assert.match(authority, /mv -fT -- "\$temporary" "\$target"/);
  assert.match(authority, /docker ps -q/);
  assert.doesNotMatch(authority, /(?:echo|printf).*\$secret/);
  assert.doesNotMatch(authority, /(?:-e|--env).*SECRET/);
  assert.doesNotMatch(compose, /workflow_review_secret/);
  assert.doesNotMatch(caddy, /workflow-review-secret|workflow_review_secret/);
});

test("Workflow production cutover is one-shot, restores the disabled base on failure, and never prunes volumes", () => {
  assert.equal(fs.existsSync(workflowProductionCutoverPath), true);
  const cutover = fs.readFileSync(workflowProductionCutoverPath, "utf8");
  assert.match(cutover, /verify-manifest\.cjs/);
  assert.match(cutover, /identity-source-manifest\.cjs/);
  assert.match(cutover, /docker load/);
  assert.match(cutover, /start_reviewer_provision/);
  assert.match(cutover, /finish_reviewer_provision rollback/);
  assert.match(cutover, /finish_reviewer_provision commit/);
  assert.match(cutover, /90/);
  assert.match(cutover, /CapEff/);
  assert.match(cutover, /workflow-store\/reviewer/);
  assert.match(cutover, /catalog-release\.json/);
  assert.doesNotMatch(cutover, /--volumes|\bprune\b/);
  assert.match(cutover, /restore_disabled_base/);
  assert.match(cutover, /workflow-production-temporary-acceptance\.cjs/);
  assert.match(
    fs.readFileSync(workflowProductionAcceptanceRunnerPath, "utf8"),
    /TEMPORARILY_UNAVAILABLE/
  );
  assert.match(cutover, /TEMPORARY_ACCEPTANCE_REQUIRES_EXPLICIT_AUTHORIZATION/);
});

test("Workflow production cutover isolated acceptance uses one normalized five-file Compose argv", () => {
  assert.equal(fs.existsSync(workflowCutoverComposeSmokePath), true);
  const cutover = fs.readFileSync(workflowProductionCutoverPath, "utf8");
  const backup = fs.readFileSync(path.join(deployment, "backup.sh"), "utf8");
  const migration = fs.readFileSync(path.join(deployment, "run-workflow-production-migration.sh"), "utf8");
  const smoke = fs.readFileSync(workflowCutoverComposeSmokePath, "utf8");
  assert.match(cutover, /workflow-cutover-compose-files\.sh/);
  assert.match(cutover, /resolve_workflow_cutover_compose_files "\$base" "\$overlay"/);
  assert.match(cutover, /compose_args=\(\)/);
  assert.match(cutover, /docker compose "\$\{compose_args\[@\]\}"/);
  assert.match(cutover, /rollback_args=\("\$\{compose_args\[@\]\}"\)/);
  assert.match(cutover, /rollback_args\[3\]="\$evidence\/rollback-identity\.yaml"/);
  assert.match(backup, /workflow-cutover-compose-files\.sh/);
  assert.match(backup, /docker compose "\$\{compose_args\[@\]\}"/);
  assert.match(migration, /workflow-cutover-compose-files\.sh/);
  assert.match(migration, /docker compose "\$\{compose_args\[@\]\}"/);
  assert.match(smoke, /compose\.windows-acceptance\.yaml/);
  assert.match(smoke, /ports\.override\.yaml/);
  assert.match(smoke, /caddy\.override\.yaml/);
  assert.match(smoke, /HostConfig\.PortBindings/);
  assert.match(smoke, /--force-recreate/);
  assert.match(smoke, /AIHUB_WORKFLOW_ROLLBACK=1/);
});

test("Workflow emergency disable reuses the normalized Compose argv without deleting durable state", () => {
  const emergencyDisable = fs.readFileSync(workflowProductionEmergencyDisablePath, "utf8");
  assert.match(emergencyDisable, /workflow-cutover-compose-files\.sh/);
  assert.match(emergencyDisable, /resolve_workflow_cutover_compose_files "\$base" "\$overlay"/);
  assert.match(emergencyDisable, /disabled_args=\("\$\{compose_args\[@\]\}"\)/);
  assert.match(emergencyDisable, /disabled_args\[3\]=/);
  assert.match(emergencyDisable, /docker compose "\$\{disabled_args\[@\]\}"/);
  assert.doesNotMatch(emergencyDisable, /--volumes|\bprune\b|\bdown\b|workflow-migration|DROP\s+SCHEMA/i);
});

test("Workflow production overlay has a real-Docker root-owned authority smoke without starting a full stack", () => {
  assert.equal(fs.existsSync(workflowProductionOverlaySmokePath), true);
  const smoke = fs.readFileSync(workflowProductionOverlaySmokePath, "utf8");
  assert.match(smoke, /compose\.workflow-production\.yaml/);
  assert.match(smoke, /spawnSync\("docker"/);
  assert.match(smoke, /workflow_review_secret/);
  assert.match(smoke, /--user", "0:0"/);
  assert.match(smoke, /0:0:600:1:64/);
  assert.match(smoke, /--user", "65534:65534"/);
  assert.match(smoke, /volume", "rm"/);
  assert.doesNotMatch(smoke, /(?:console\.log|console\.error).*secret/);
});

test("Workflow migration regression removes only its disposable Docker volume", () => {
  const source = fs.readFileSync(workflowProductionMigrationRollbackPath, "utf8");
  assert.match(source, /dockerCompose\(\["down", "--remove-orphans", "--volumes"\]\)/);
});

test("Identity image copies one Workflow state machine and its exact persistence closure", () => {
  assert.match(identityDockerfile, /COPY community\/workflow-store\.cjs[\s\\]+community\/workflow-persistence\.cjs[\s\\]+community\/workflow-composition\.cjs/);
  assert.match(identityDockerfile, /COPY community\/migrations\/candidates\/0001-workflow-store\.sql[\s\S]*?0001-workflow-store\.rollback\.sql[\s\S]*?\/app\/community\/migrations\/candidates\//);
  assert.match(identityDockerfile, /COPY deployment\/community-production\/workflow-migrate\.cjs \/app\/identity\/workflow-migrate\.cjs/);
  assert.equal((identityDockerfile.match(/community\/workflow-store\.cjs/g) || []).length, 1);
  const manifest = require("../deployment/community-production/identity-source-manifest.cjs")
    .createIdentitySourceManifest();
  assert.equal(manifest.digest.sha256, expectedIdentitySourceDigest);
  assert.equal(manifest.files.length, 74);
  assert.deepEqual(
    manifest.files.find((entry) => entry.path === "deployment/community-production/workflow-migrate.cjs"),
    {
      path: "deployment/community-production/workflow-migrate.cjs",
      bytes: 2261,
      sha256: "7424559e45062e261603e5f700c443d9eec9ee7d26eafc7954902b942b7f8932"
    }
  );
  const paths = new Set(manifest.files.map((entry) => entry.path));
  for (const expected of [
    "identity/workflow-store.cjs",
    "identity/migration-database-contract.cjs",
    "identity/workflow-resolvers.cjs",
    "identity/workflow-reviewer-service-identity.cjs",
    "identity/workflow-reviewer-production-provision.cjs",
    "identity/migrations/candidates/0002-workflow-reviewer-service-identity.sql",
    "identity/migrations/candidates/0002-workflow-reviewer-service-identity.rollback.sql",
    "community/workflow-store.cjs",
    "community/workflow-persistence.cjs",
    "community/workflow-composition.cjs",
    "community/workflow-official-bootstrap.cjs",
    "community/workflow-official-source-posts.cjs",
    "identity/workflow-official-bootstrap-production.cjs",
    "community/migrations/candidates/0001-workflow-store.sql",
    "community/migrations/candidates/0001-workflow-store.rollback.sql"
  ]) assert.equal(paths.has(expected), true, expected);
  assert.equal(manifest.baseImage.includes("@sha256:"), true);
  assert.equal(manifest.files.some((entry) => /(?:\.env|\.(?:pem|key))$/i.test(entry.path)), false);
});

test("Identity deployment pins one image built from the canonical events source closure", () => {
  assert.equal((compose.match(new RegExp(`image: ${expectedIdentityImage}`, "g")) || []).length, 3);
  assert.doesNotMatch(compose, /AIHUB_IDENTITY_IMAGE/);
  assert.match(workflowCandidate, new RegExp(expectedIdentitySourceDigest));
  assert.match(workflowCandidate, new RegExp(expectedIdentityImage.replaceAll("/", "\\/")));
  assert.match(workflowCandidate, /Community inner public projection/);
  assert.match(workflowCandidate, /Identity outer wire DTO/);
});

test("Identity warms one verified catalog projection without turning liveness into authority", () => {
  assert.match(identityServer, /void activeCatalogProducts\.warm\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(identityServer, /isCanonicalDependencyReady: \(\) => activeCatalogProducts\.readiness\(\)\.ready/);
  assert.match(identityServer, /prepareCanonicalDependencies: \(\) => activeCatalogProducts\.warm\(\)/);
  assert.match(identityServer, /\/health[\s\S]*?status: "ok"/);
  assert.doesNotMatch(identityServer, /if \(!activeCatalogProducts\.readiness\(\)\.ready\)[\s\S]{0,120}\/health/);
});

test("Caddy separates public community, internal bridges, and the SSH-private CMS", () => {
  assert.match(caddy, /\{\$AIHUB_COMMUNITY_PUBLIC_HOST\}/);
  assert.match(caddy, /path \/admin \/admin\/\* \/aihub-personal-center\.php \/aihub-community-management\.php/);
  assert.match(caddy, /http:\/\/:4174/);
  assert.doesNotMatch(caddy, /header_up -X-AIHub-CMS-Secret/);
  assert.match(caddy, /header_up X-AIHub-CMS-Secret \{\$AIHUB_COMMUNITY_CMS_SECRET\}/);
  assert.match(caddy, /@cmsManagement path \/api\/community-management \/api\/community-management\/actions/);
  assert.match(caddy, /Content-Security-Policy/);
  assert.match(caddy, /@identityInternal path \/v1\/internal\/\*/);
  assert.match(caddy, /@workflowReviewer path \/v1\/community\/workflow-store\/reviewer\/\*/);
});

test("public Flarum CSP permits its inline bootstrap without weakening the private CMS", () => {
  const publicStart = caddy.indexOf("{$AIHUB_COMMUNITY_PUBLIC_HOST} {");
  const privateStart = caddy.indexOf("http://:4174 {");
  assert.notEqual(publicStart, -1);
  assert.notEqual(privateStart, -1);
  assert.match(
    caddy.slice(publicStart, privateStart),
    /script-src 'self' 'unsafe-inline'/
  );
  assert.doesNotMatch(
    caddy.slice(privateStart),
    /script-src[^;\n]*'unsafe-inline'/
  );
});

test("Caddy loads the CMS gateway secret from its mounted file before configuration adaption", () => {
  assert.equal(fs.existsSync(caddyEntrypointPath), true);
  const entrypoint = fs.readFileSync(caddyEntrypointPath, "utf8");
  assert.match(compose, /\.\/caddy-entrypoint\.sh:\/usr\/local\/bin\/aihub-caddy-entrypoint:ro/);
  assert.match(compose, /entrypoint: \["\/bin\/sh", "\/usr\/local\/bin\/aihub-caddy-entrypoint"\]/);
  assert.doesNotMatch(compose, /\$\$\(cat \/run\/secrets\/community_cms_gateway\)/);
  assert.match(entrypoint, /\/run\/aihub-caddy-secret\/community_cms_gateway/);
  assert.match(entrypoint, /AIHUB_COMMUNITY_CMS_SECRET/);
  assert.match(entrypoint, /caddy run --config \/etc\/caddy\/Caddyfile --adapter caddyfile/);
});

test("Caddy uses root only for the 0600 secret bootstrap and drops to a fixed runtime identity", () => {
  const entrypoint = fs.readFileSync(caddyEntrypointPath, "utf8");
  const caddyService = compose.slice(compose.indexOf("  caddy:"), compose.indexOf("\nsecrets:"));
  assert.match(compose, /  caddy:\s[\s\S]*?\n    user: "0:0"\n/);
  assert.doesNotMatch(caddyService, /secrets: \[community_cms_gateway\]/);
  assert.doesNotMatch(caddyService, /community_management/);
  assert.match(caddyService, /caddy_cms_secret:\/run\/aihub-caddy-secret:ro/);
  assert.match(caddyService, /cap_add: \["CHOWN", "SETGID", "SETUID", "NET_BIND_SERVICE"\]/);
  assert.match(entrypoint, /\[ "\$\(id -u\)" = "0" \]/);
  assert.match(entrypoint, /runtime_uid=65534/);
  assert.match(entrypoint, /runtime_gid=65534/);
  assert.match(entrypoint, /runtime_user=nobody/);
  assert.match(entrypoint, /exec su -p -s \/bin\/sh "\$runtime_user" -c/);
  assert.doesNotMatch(entrypoint, /chmod[^\n]*community_cms_gateway/);
  assert.doesNotMatch(entrypoint, /chown[^\n]*community_cms_gateway/);
  assert.doesNotMatch(entrypoint, /(?:cp|mv)[^\n]*community_cms_gateway/);
});

test("Caddy bootstrap owns only managed volume roots and survives private runtime state", () => {
  const entrypoint = fs.readFileSync(caddyEntrypointPath, "utf8");
  assert.doesNotMatch(entrypoint, /chown\s+-R/);
  assert.match(entrypoint, /chown "\$runtime_uid:\$runtime_gid" "\$state_dir"/);
  assert.match(entrypoint, /caddy_dir="\$state_dir\/caddy"/);
  assert.match(entrypoint, /\[ -d "\$caddy_dir" \] && \[ ! -L "\$caddy_dir" \]/);
  assert.match(entrypoint, /chown "\$runtime_uid:\$runtime_gid" "\$caddy_dir"/);
  assert.equal(fs.existsSync(caddyRuntimeOwnershipGatePath), true);
  const runtimeGate = fs.readFileSync(caddyRuntimeOwnershipGatePath, "utf8");
  assert.match(runtimeGate, /for \(let cycle = 1; cycle <= 3; cycle \+= 1\)/);
  assert.match(runtimeGate, /CapEff:\\s\+0\+/);
  assert.match(runtimeGate, /touch \/data\/caddy\/\.aihub-write-test/);
});

test("Caddy secret delivery is stdin-only, atomic, and isolated in one external volume", () => {
  assert.equal(fs.existsSync(caddySecretSeedPath), true);
  assert.equal(fs.existsSync(seedCaddySecretVolumePath), true);
  const seed = fs.readFileSync(caddySecretSeedPath, "utf8");
  const host = fs.readFileSync(seedCaddySecretVolumePath, "utf8");
  assert.match(compose, /caddy_cms_secret:\s*\n\s+external: true\s*\n\s+name: \$\{AIHUB_CADDY_CMS_SECRET_VOLUME/);
  assert.equal((compose.match(/caddy_cms_secret:\/run\/aihub-caddy-secret:ro/g) || []).length, 1);
  assert.match(seed, /cat > "\$temporary"/);
  assert.match(seed, /chmod 400 "\$temporary"/);
  assert.match(seed, /mv -f "\$temporary" "\$target"/);
  assert.match(seed, /trap cleanup EXIT HUP INT TERM/);
  assert.doesNotMatch(seed, /echo "?\$secret|export .*SECRET/);
  assert.match(host, /cat -- "\$secret_file" \|/);
  assert.match(host, /docker run --rm -i/);
  assert.match(host, /\$\{EUID:-\$\(id -u\)\}/);
  assert.match(host, /approved_owner="\$SUDO_UID:\$SUDO_GID"/);
  assert.match(host, /approved_owner="0:0"/);
  assert.match(host, /! -L "\$secret_file"/);
  assert.match(host, /source_links.*== "1"/);
  assert.match(host, /source_mode.*== "600"/);
  assert.doesNotMatch(host, /AIHUB_CADDY_SOURCE_(?:UID|GID)|approved_owner="\$[12]"/);
  assert.match(host, /trap cleanup EXIT/);
  assert.match(host, /created_volume=1/);
  assert.match(host, /docker volume rm "\$volume"/);
  assert.doesNotMatch(host, /-e .*SECRET|--env.*SECRET|\$\(cat/);
});

test("gateway authority rotation is one-argument, CSPRNG-backed, atomic, and refuses active consumers", () => {
  assert.equal(fs.existsSync(issueCaddyGatewaySecretPath), true);
  const issue = fs.readFileSync(issueCaddyGatewaySecretPath, "utf8");
  const authority = fs.readFileSync(hostSecretAuthorityPath, "utf8");
  assert.match(issue, /host-secret-authority\.sh" issue caddy-gateway/);
  assert.match(authority, /\$\{EUID:-\$\(id -u\)\}/);
  assert.match(authority, /approved_uid="\$SUDO_UID"/);
  assert.match(authority, /approved_gid="\$SUDO_GID"/);
  assert.match(authority, /! -L "\$target"/);
  assert.match(authority, /source_links.*== "1"/);
  assert.match(authority, /docker ps -q/);
  assert.match(authority, /range \.Mounts/);
  assert.match(authority, /openssl rand -hex 32/);
  assert.match(authority, /mktemp --tmpdir="\$directory"/);
  assert.match(authority, /sync -f "\$temporary"/);
  assert.match(authority, /mv -fT -- "\$temporary" "\$target"/);
  assert.doesNotMatch(authority, /(?:echo|printf).*\$secret/);
  assert.doesNotMatch(authority, /AIHUB_CADDY_SOURCE_(?:UID|GID)|approved_uid="\$[12]"|approved_gid="\$[12]"/);
  assert.match(readme, /sudo -n bash deployment\/community-production\/issue-caddy-gateway-secret\.sh/);
});

test("pre-cutover Caddy secret probe stays on an isolated network and loopback high port", () => {
  assert.equal(fs.existsSync(probeCaddySecretVolumePath), true);
  assert.equal(fs.existsSync(probeCaddyMockPath), true);
  const probe = fs.readFileSync(probeCaddySecretVolumePath, "utf8");
  assert.match(probe, /bash "\$script_dir\/seed-caddy-secret-volume\.sh"/);
  assert.match(probe, /127\.0\.0\.1:\$probe_port:4174/);
  assert.doesNotMatch(probe, /(?:80:80|443:443|4173:4173)/);
  assert.match(probe, /\[ "\$get_status" = "200" \]/);
  assert.match(probe, /\[ "\$action_status" = "200" \]/);
  assert.match(probe, /\[ "\$near_status" = "404" \]/);
  assert.match(probe, /\[ "\$write_status" = "503" \]/);
  assert.match(probe, /CapEff/);
  assert.match(probe, /docker logs --timestamps/);
  assert.match(probe, /grep -F -f "\$secret_file"/);
});

test("community deployment replaces the current gateway with one shared Caddy", () => {
  assert.equal((compose.match(/^  caddy:\s*$/gm) || []).length, 1);
  assert.match(compose, /caddy_data:\s*\n\s+external: true/);
  assert.match(compose, /caddy_config:\s*\n\s+external: true/);
  assert.match(compose, /AIHUB_CADDY_DATA_VOLUME/);
  assert.match(compose, /AIHUB_CADDY_CONFIG_VOLUME/);
  assert.match(readme, /must never run concurrently/i);
  assert.match(readme, /stop caddy admin/);
  assert.match(readme, /up -d --no-build admin caddy/);
});

test("the restored Admin-only contract does not consume the community CMS secret", () => {
  assert.doesNotMatch(adminOnlyCompose, /community_cms_gateway|AIHUB_COMMUNITY_MANAGEMENT_ENABLED|AIHUB_COMMUNITY_CMS_SECRET_FILE/);
});

test("Admin exposes one community management module and keeps catalog read-only", () => {
  assert.match(server, /require\("\.\/community-management\.cjs"\)/);
  assert.match(server, /\/api\/community-management\/actions/);
  assert.match(server, /isAdminReadOnlyWriteBlocked\(adminReadOnly, request\.method, pathname\)/);
  assert.doesNotMatch(server, /\/api\/community\/admin/);
  assert.doesNotMatch(server, /\/api\/community\/summary/);
});

test("backup and restore candidates cover both databases and Flarum files", () => {
  const backup = fs.readFileSync(path.join(deployment, "backup.sh"), "utf8");
  const restore = fs.readFileSync(path.join(deployment, "restore-drill.sh"), "utf8");
  const migration = fs.readFileSync(path.join(root, "community", "flarum", "migration-entrypoint.sh"), "utf8");
  for (const value of ["pg_dump", "mariadb-dump", "community-files.tar", "SHA256SUMS"]) {
    assert.match(backup, new RegExp(value));
  }
  for (const value of ["pg_restore", "mariadb", "community-files.tar", "sha256sum -c"]) {
    assert.match(restore, new RegExp(value));
  }
  assert.match(restore, /--tmpfs \/var\/lib\/postgresql\/data/);
  assert.match(restore, /--tmpfs \/var\/lib\/mysql/);
  assert.deepEqual(
    [...backup.matchAll(/--exclude=([^\s\\]+)/g)].map((match) => match[1]),
    ["var/www/html/storage/formatter"],
    "only the exact generated formatter cache may be excluded"
  );
  assert.match(backup, /COMMUNITY-FILES\.json/);
  assert.match(backup, /formatter path must be a real directory/);
  assert.match(backup, /community file roots must not contain symlinks/);
  assert.doesNotMatch(backup, /ignore-failed-read|warning=no-file-changed|--exclude=.*(?:assets|config|uploads)/);
  assert.match(restore, /COMMUNITY-FILES\.json/);
  assert.match(restore, /formatter cache must not be present in the archive/);
  assert.match(restore, /community files archive contains an unsafe path/);
  assert.match(restore, /community files archive contains an unsafe entry type/);
  assert.match(migration, /php flarum cache:clear\s+mkdir -p \/var\/www\/html\/storage\/formatter/);
});

test("Windows acceptance keeps MariaDB off an NTFS bind mount", () => {
  assert.equal(fs.existsSync(windowsAcceptancePath), true);
  const override = fs.readFileSync(windowsAcceptancePath, "utf8");
  assert.match(override, /community_acceptance_database:\/var\/lib\/mysql/);
  assert.match(override, /^  community_acceptance_database:\s*$/m);
  assert.doesNotMatch(override, /AIHUB_COMMUNITY_DB_DIR/);
  assert.match(readme, /Windows[\s\S]*NTFS/i);
  assert.match(readme, /compose\.windows-acceptance\.yaml/);
});

test("community production liveness probes are bounded and leave publication validation to readiness", () => {
  for (const source of [compose, adminOnlyCompose, localCompose]) {
    assert.doesNotMatch(source, /fetch\('http:\/\/127\.0\.0\.1:(4173|4180)\/ready/);
  }
  assert.match(compose, nodeHttpHealth);
  assert.match(compose, /require\('http'\)\.get\(\{host:'127\.0\.0\.1',port:4180,path:'\/health',agent:false\}/);
  assert.doesNotMatch(compose, /test: \["CMD", "node", "-e", "[^"]*path:'\/ready'/);
});

test("Identity consumes only the exact signed internal Admin catalog source", () => {
  assert.match(compose, /AIHUB_CATALOG_URL: http:\/\/admin:4173\/catalog-release\.json/);
  assert.match(compose, /AIHUB_CATALOG_SOURCE_MODE: signed-internal-admin/);
  assert.match(compose, /AIHUB_CATALOG_HIGHEST_VERSION: "72"/);
  assert.match(compose, /AIHUB_CATALOG_HIGHEST_SHA256: [a-f0-9]{64}/);
  assert.doesNotMatch(compose, /http:\/\/admin(?::(?!4173)\d+)?\/(?!catalog-release\.json)/);
  assert.match(identityDockerfile, /COPY shared\/active-catalog-products\.cjs[\s\S]*?shared\/catalog-release\.cjs[\s\S]*?shared\/signed-release\.cjs[\s\S]*?\/app\/shared\//);
  assert.doesNotMatch(identityDockerfile, /COPY shared \/app\/shared/);
  assert.match(identityDockerfile, /COPY catalog\/channel\.json \/app\/catalog\/channel\.json/);
  assert.doesNotMatch(compose, /channels\/v2\/catalog-release\.json/);
});

test("Identity image copies only its exact shared dependency closure", () => {
  const expected = new Set();
  function visit(relative) {
    if (expected.has(relative)) return;
    expected.add(relative);
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    for (const match of source.matchAll(/require\(["'](\.\/[^"']+)["']\)/g)) {
      let dependency = path.posix.join(path.posix.dirname(relative), match[1]);
      if (!path.posix.extname(dependency)) dependency += ".cjs";
      if (dependency.startsWith("shared/") && fs.existsSync(path.join(root, dependency))) {
        visit(dependency);
      }
    }
  }
  for (const entry of [
    "shared/active-catalog-products.cjs",
    "shared/avatar-image.cjs",
    "shared/identity-security.cjs"
  ]) visit(entry);

  const copied = new Set(
    [...identityDockerfile.matchAll(/shared\/[a-z0-9.-]+(?:\.cjs|\.json)/g)]
      .map((match) => match[0])
  );
  assert.deepEqual([...copied].sort(), [...expected].sort());
});
