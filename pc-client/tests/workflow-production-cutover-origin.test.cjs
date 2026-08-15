"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const helper = path.join(deployment, "workflow-cutover-admin-origin.sh");
const reviewerHelper = path.join(deployment, "workflow-cutover-reviewer-origin.sh");
const composeHelper = path.join(deployment, "workflow-cutover-compose-files.sh");
const cutover = path.join(deployment, "workflow-production-cutover.sh");
const officialBootstrapWrapper = path.join(deployment, "workflow-official-bootstrap-production-wrapper.cjs");
const emergencyDisable = path.join(deployment, "workflow-production-emergency-disable.sh");
const active6State = path.join(root, "output", "community-production-finalwin-20260806134532173", "admin-published", "catalog-store", "state.json");
const bash = "C:\\Program Files\\Git\\bin\\bash.exe";
const CUTOVER_ENV_KEYS = [
  "AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES",
  "AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT",
  "AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN",
  "AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_REVIEWER_ORIGIN",
  "AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE"
];

function testEnvironment(overrides = {}) {
  const env = { ...process.env };
  for (const key of CUTOVER_ENV_KEYS) delete env[key];
  return { ...env, ...overrides };
}

function runOfficialBootstrapWrapper(files, environment = {}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-bootstrap-wrapper-"));
  const evidence = path.join(temporary, "evidence");
  const reportPath = path.join(evidence, "workflow-official-bootstrap-production-report.json");
  fs.mkdirSync(evidence);
  const result = spawnSync(
    process.execPath,
    [
      officialBootstrapWrapper,
      evidence,
      "http://127.0.0.1:99999",
      "workflow-cutover.invalid",
      ...files
    ],
    { encoding: "utf8", env: testEnvironment(environment) }
  );
  return { temporary, result, reportPath };
}

function readWrapperReport(fixture) {
  assert.notEqual(fixture.result.status, 0);
  assert.equal(fs.existsSync(fixture.reportPath), true, fixture.result.stderr);
  const raw = fs.readFileSync(fixture.reportPath, "utf8");
  assert.doesNotMatch(raw, /https?:\/\/|secret|token|password|\\Users\\|\/home\//i);
  return JSON.parse(raw);
}

function resolveOrigin(environment = {}) {
  const result = spawnSync(
    bash,
    ["-lc", 'source "$1"; resolve_workflow_cutover_admin_origin', "bash", helper],
    {
      encoding: "utf8",
      env: testEnvironment(environment)
    }
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function resolveReviewerOrigin(environment = {}) {
  const result = spawnSync(
    bash,
    ["-lc", 'source "$1"; resolve_workflow_cutover_reviewer_origin', "bash", reviewerHelper],
    { encoding: "utf8", env: testEnvironment(environment) }
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function resolveComposeFiles(base, overlay, environment = {}) {
  const result = spawnSync(
    bash,
    [
      "-lc",
      'if [ -n "${AIHUB_TEST_PATH_PREPEND:-}" ]; then PATH="$AIHUB_TEST_PATH_PREPEND:$PATH"; fi; source "$1"; resolve_workflow_cutover_compose_files "$2" "$3" || exit $?; printf "%s\\n" "${workflow_cutover_compose_files[@]}"',
      "bash",
      composeHelper,
      base,
      overlay
    ],
    { encoding: "utf8", env: testEnvironment(environment) }
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function writeExecutable(filename, source) {
  fs.writeFileSync(filename, source, "utf8");
  fs.chmodSync(filename, 0o755);
}

function toBashPath(filename) {
  const result = spawnSync(bash, ["-lc", 'cygpath -u "$1"', "bash", filename], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function writeComposeFile(filename) {
  fs.writeFileSync(filename, "services: {}\n", "utf8");
  fs.chmodSync(filename, 0o644);
}

function makeComposeFileSet() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-compose-set-"));
  const acceptanceRoot = path.join(temporary, "acceptance");
  fs.mkdirSync(acceptanceRoot);
  const native = {
    temporary,
    base: path.join(temporary, "compose.server.yaml"),
    overlay: path.join(temporary, "compose.workflow-production.yaml"),
    windows: path.join(acceptanceRoot, "compose.windows-acceptance.yaml"),
    ports: path.join(acceptanceRoot, "ports.override.yaml"),
    caddy: path.join(acceptanceRoot, "caddy.override.yaml"),
    list: path.join(temporary, "compose-files.list"),
    acceptanceRoot
  };
  for (const filename of [native.base, native.overlay, native.windows, native.ports, native.caddy]) {
    writeComposeFile(filename);
  }
  const bashPaths = Object.fromEntries(
    Object.entries(native).map(([key, value]) => [key, key === "temporary" ? value : toBashPath(value)])
  );
  fs.writeFileSync(
    native.list,
    `${bashPaths.base}\n${bashPaths.overlay}\n${bashPaths.windows}\n${bashPaths.ports}\n${bashPaths.caddy}\n`,
    "utf8"
  );
  fs.chmodSync(native.list, 0o644);
  bashPaths.list = toBashPath(native.list);
  return { native, bashPaths };
}

function runCutoverFixture({ runnerStatus, bootstrapStatus = 0 }) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-cutover-"));
  const scriptDirectory = path.join(temporary, "deployment", "community-production");
  const bin = path.join(temporary, "bin");
  const evidence = path.join(temporary, "evidence");
  const backup = path.join(temporary, "backup");
  const dockerLog = path.join(temporary, "docker.log");
  const curlLog = path.join(temporary, "curl.log");
  const nodeLog = path.join(temporary, "node.log");
  const acceptanceRoot = path.join(temporary, "acceptance");
  const adminPublished = path.join(temporary, "admin-published");
  fs.mkdirSync(scriptDirectory, { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(backup);
  fs.mkdirSync(acceptanceRoot);
  fs.mkdirSync(path.join(adminPublished, "catalog-store"), { recursive: true });
  fs.copyFileSync(active6State, path.join(adminPublished, "catalog-store", "state.json"));
  fs.mkdirSync(path.join(temporary, "artifacts"));
  fs.writeFileSync(path.join(temporary, "artifacts", "admin-active7-image.tar"), "fixture-admin-image\n");
  fs.writeFileSync(path.join(temporary, "artifacts", "identity-r11-image.tar"), "fixture-identity-image\n");
  fs.writeFileSync(path.join(temporary, "artifacts", "identity-19a-rollback-image.tar"), "fixture-rollback-identity-image\n");
  fs.writeFileSync(path.join(temporary, "artifacts", "admin-old-b6ea4c5bd0e9.tar"), "fixture-rollback-admin-image\n");
  const base = path.join(temporary, "compose.server.yaml");
  const overlay = path.join(temporary, "compose.workflow-production.yaml");
  const windowsOverride = path.join(acceptanceRoot, "compose.windows-acceptance.yaml");
  const portsOverride = path.join(acceptanceRoot, "ports.override.yaml");
  const caddyOverride = path.join(acceptanceRoot, "caddy.override.yaml");
  const composeList = path.join(temporary, "compose-files.list");
  for (const filename of [base, overlay, windowsOverride, portsOverride, caddyOverride]) {
    writeComposeFile(filename);
  }
  const bashBase = toBashPath(base);
  const bashOverlay = toBashPath(overlay);
  const bashWindows = toBashPath(windowsOverride);
  const bashPorts = toBashPath(portsOverride);
  const bashCaddy = toBashPath(caddyOverride);
  fs.writeFileSync(
    composeList,
    `${bashBase}\n${bashOverlay}\n${bashWindows}\n${bashPorts}\n${bashCaddy}\n`,
    "utf8"
  );
  fs.chmodSync(composeList, 0o644);
  for (const filename of [
    "workflow-production-cutover.sh",
    "workflow-cutover-admin-origin.sh",
    "workflow-cutover-reviewer-origin.sh",
    "workflow-cutover-compose-files.sh",
    "workflow-production-emergency-disable.sh"
  ]) {
    fs.copyFileSync(path.join(deployment, filename), path.join(scriptDirectory, filename));
    fs.chmodSync(path.join(scriptDirectory, filename), 0o755);
  }
  writeExecutable(
    path.join(scriptDirectory, "workflow-node-runtime.sh"),
    "#!/bin/bash\npreflight_workflow_node_runtime() { :; }\nprepare_workflow_node_runtime() { printf '%s\\n' \"$MOCK_BIN/node\"; }\n"
  );
  writeExecutable(path.join(bin, "node"), `#!/bin/sh
printf '%s\n' "$*" >> "$MOCK_NODE_LOG"
case "$*" in
  *identity-source-manifest.cjs*) printf '{}'; exit 0 ;;
  *workflow-production-temporary-acceptance.cjs*) exit "$MOCK_RUNNER_STATUS" ;;
  *workflow-official-bootstrap-production-wrapper.cjs*) exit "$MOCK_BOOTSTRAP_STATUS" ;;
  *catalog-store/state.json*) printf 'abffc088a113160ee85fb0efaead8ddff0230021992c9252df82453e396490a9'; exit 0 ;;
  *identity-before.json*) printf 'enabled-online-empty\n'; exit 0 ;;
esac
exit 0
`);
  writeExecutable(path.join(bin, "bash"), "#!/bin/sh\ncase \"$1\" in *backup.sh) printf '%s\\n' \"$MOCK_BACKUP\"; exit 0 ;; *run-workflow-production-migration.sh) exit 0 ;; esac\nexec /usr/bin/bash \"$@\"\n");
  writeExecutable(path.join(bin, "curl"), "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$MOCK_CURL_LOG\"\ncase \"$*\" in *'%{http_code}'*) printf '404' ;; *) printf 'catalog' ;; esac\n");
  writeExecutable(path.join(bin, "sha256sum"), "#!/bin/sh\ncount=0\nif [ -f \"$MOCK_SHA_COUNT\" ]; then count=$(cat \"$MOCK_SHA_COUNT\"); fi\ncount=$((count+1)); printf '%s' \"$count\" > \"$MOCK_SHA_COUNT\"\nif [ \"$count\" -ge 4 ]; then printf 'facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4  -\\n'; else printf 'c1ea9b76d1e134be1e565cf5018a77013a2387fe59452f3ebdc1f0e96f49e139  -\\n'; fi\n");
  writeExecutable(path.join(bin, "docker"), "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$MOCK_DOCKER_LOG\"\ncase \"$*\" in *'AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=preflight'*) printf '{\"phase\":\"preflight\",\"provisionable\":true,\"identityMigrationPresent\":false,\"identityPresent\":false,\"workflowMigrationPresent\":false}\\n' ;; *'run --rm -T workflow-reviewer-provision'*) printf '{\"phase\":\"ready\",\"identityCreated\":true,\"identityMigrationCreated\":true,\"workflowMigrationCreated\":true}\\n'; IFS= read -r control; case \"$control\" in commit) printf '{\"phase\":\"committed\"}\\n' ;; rollback) printf '{\"phase\":\"rolled-back\"}\\n' ;; *) exit 1 ;; esac ;; *'ps -q identity'*) printf 'identity-old' ;; *'ps -q admin'*) printf 'admin-old' ;; *'ps -q caddy'*) printf 'caddy-new' ;; *'.Config.Image'*) printf 'identity-before' ;; *'image inspect'*) printf '{\"Id\":\"sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd\"}\\n' ;; *'.State.Health.Status'*) printf 'healthy' ;; *'/proc/1/status'*) printf 'Uid:\\t65534\\t65534\\t65534\\t65534\\nGid:\\t65534\\t65534\\t65534\\t65534\\nCapEff:\\t0000000000000000\\n' ;; esac\n");
  writeExecutable(path.join(bin, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
case "$*" in
  *'AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=preflight'*) printf '{"phase":"preflight","provisionable":true,"identityMigrationPresent":false,"identityPresent":false,"workflowMigrationPresent":false}\\n' ;;
  *'run --rm -T workflow-reviewer-provision'*) printf '{"phase":"ready","identityCreated":true,"identityMigrationCreated":true,"workflowMigrationCreated":true}\\n'; IFS= read -r control; [ "$control" = commit ] && printf '{"phase":"committed"}\\n' || printf '{"phase":"rolled-back"}\\n' ;;
  *'psql -X -v ON_ERROR_STOP=1 -U aihub -d aihub -At -c'*'to_regclass'*) printf 'present|present|present\\n' ;;
  *'psql -X -v ON_ERROR_STOP=1 -U aihub -d aihub -At -F'* ) printf '0|0|0|1|1|0|1\\n' ;;
  *'exec -T community-database sh -ec'*'mariadb -u aihub_forum -N -B aihub_forum'*) printf '0\\n' ;;
  *'ps -q identity-database'*) printf 'identity-database' ;;
  *'ps -q community-database'*) printf 'community-database' ;;
  *'ps -q community'*) printf 'community' ;;
  *'ps -q identity'*) printf 'identity-old' ;;
  *'ps -q admin'*) printf 'admin-old' ;;
  *'ps -q caddy'*) printf 'caddy-new' ;;
  *'image inspect --format {{.Id}}'*'workflow-readiness-candidate-19a223a18392'*) printf 'sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567\\n' ;;
  *'image inspect --format {{.Id}}'*'community-candidate-b6ea4c5bd0e9'*) printf 'sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2\\n' ;;
  *'com.aihub.source-content-sha256'*'workflow-readiness-candidate-19a223a18392'*) printf '19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c\\n' ;;
  *'com.aihub.release-version'*'workflow-readiness-candidate-19a223a18392'*) printf 'workflow-reviewer-service-identity-candidate-2026-08-08\\n' ;;
  *'com.aihub.source-content-sha256'*'community-candidate-b6ea4c5bd0e9'*) printf 'b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de\\n' ;;
  *'com.aihub.release-version'*'community-candidate-b6ea4c5bd0e9'*) printf '0.1.40\\n' ;;
  *'image inspect --format {{.Id}}'*'zhenxing-ai/identity:'*) printf 'sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748\\n' ;;
  *'com.aihub.source-content-sha256'*) printf '2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7\\n' ;;
  *'image inspect --format {{.Config.User}}'*'zhenxing-ai/identity:'*) printf 'node\\n' ;;
  *'image inspect --format {{.Config.User}}'*'zhenxing-ai/admin:'*) printf 'node\\n' ;;
  *'image inspect zhenxing-ai/identity:'*) printf '{"Id":"sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748"}\\n' ;;
  *'image inspect zhenxing-ai/admin:'*) printf '{"Id":"sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd"}\\n' ;;
  *'inspect --format {{.Config.Image}} identity-old'*) printf 'zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392\\n' ;;
  *'inspect --format {{.Config.Image}} admin-old'*) printf 'zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9\\n' ;;
  *'inspect --format {{.Image}} identity-old'*) printf 'sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567\\n' ;;
  *'inspect --format {{.Image}} admin-old'*) printf 'sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2\\n' ;;
  *'inspect --format {{.State.Status}}'*) printf 'running\\n' ;;
  *'.State.Health.Status'*) printf 'healthy' ;;
  *'inspect identity-old'*) printf '[{"Config":{"Env":["AIHUB_RESOURCE_SUBMISSIONS_ENABLED=1","AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION=1","AIHUB_WORKFLOW_STORE_ENABLED=1","AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED=1","AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED=1","AIHUB_WORKFLOW_STORE_SCHEMA_VERSION=1"]}}]\\n' ;;
  *'inspect admin-old'*) printf '[{"Config":{"Image":"zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9"}}]\\n' ;;
  *'/proc/1/status'*) printf 'Uid:\\t65534\\t65534\\t65534\\t65534\\nGid:\\t65534\\t65534\\t65534\\t65534\\nCapEff:\\t0000000000000000\\n' ;;
esac
`);
  const environment = testEnvironment({
    MOCK_BACKUP: toBashPath(backup),
    MOCK_CURL_LOG: toBashPath(curlLog),
    MOCK_NODE_LOG: toBashPath(nodeLog),
    MOCK_DOCKER_LOG: toBashPath(dockerLog),
    MOCK_SHA_COUNT: toBashPath(path.join(temporary, "sha-count")),
    MOCK_BIN: toBashPath(bin),
    CUTOVER: toBashPath(path.join(scriptDirectory, "workflow-production-cutover.sh")),
    BASE: toBashPath(base),
    OVERLAY: toBashPath(overlay),
    BACKUP: toBashPath(backup),
    EVIDENCE: toBashPath(evidence),
    MOCK_RUNNER_STATUS: String(runnerStatus),
    MOCK_BOOTSTRAP_STATUS: String(bootstrapStatus),
    AIHUB_WORKFLOW_PRODUCTION_TEMPORARY_ACCEPTANCE: "1",
    AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN: "http://127.0.0.1:14417",
    AIHUB_PUBLIC_HOST: "workflow-cutover.invalid",
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_REVIEWER_ORIGIN: "http://127.0.0.1:14418",
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: toBashPath(composeList),
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: toBashPath(acceptanceRoot),
    AIHUB_ADMIN_PUBLISHED_DIR: toBashPath(adminPublished)
  });
  const result = spawnSync(
    bash,
    ["-lc", 'PATH="$MOCK_BIN:$PATH"; exec "$CUTOVER" "$BASE" "$OVERLAY" "$BACKUP" "$EVIDENCE" -'],
    { encoding: "utf8", env: environment }
  );
  return {
    temporary,
    result,
    dockerLog: fs.existsSync(dockerLog) ? fs.readFileSync(dockerLog, "utf8") : "",
    curlLog: fs.existsSync(curlLog) ? fs.readFileSync(curlLog, "utf8") : ""
    , nodeLog: fs.existsSync(nodeLog) ? fs.readFileSync(nodeLog, "utf8") : ""
  };
}

function runEmergencyDisableFixture(environment = {}) {
  const { native, bashPaths } = makeComposeFileSet();
  const bin = path.join(native.temporary, "bin");
  const evidence = path.join(native.temporary, "evidence");
  const dockerLog = path.join(native.temporary, "docker.log");
  fs.mkdirSync(bin);
  writeExecutable(path.join(bin, "docker"), "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$MOCK_DOCKER_LOG\"\n");
  const requestedEnvironment = { ...environment };
  if (requestedEnvironment.AIHUB_TEST_AUTO_ISOLATED === "1") {
    delete requestedEnvironment.AIHUB_TEST_AUTO_ISOLATED;
    Object.assign(requestedEnvironment, {
      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: bashPaths.list,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: bashPaths.acceptanceRoot
    });
  }
  const result = spawnSync(
    bash,
    ["-lc", 'PATH="$MOCK_BIN:$PATH"; exec "$EMERGENCY" "$BASE" "$OVERLAY" "$EVIDENCE"'],
    {
      encoding: "utf8",
      env: testEnvironment({
        MOCK_BIN: toBashPath(bin),
        MOCK_DOCKER_LOG: toBashPath(dockerLog),
        EMERGENCY: toBashPath(emergencyDisable),
        BASE: bashPaths.base,
        OVERLAY: bashPaths.overlay,
        EVIDENCE: toBashPath(evidence),
        ...requestedEnvironment
      })
    }
  );
  return {
    native,
    bashPaths,
    result,
    dockerLog: fs.existsSync(dockerLog) ? fs.readFileSync(dockerLog, "utf8") : ""
  };
}

test("cutover admin origin is production-locked unless explicit isolated acceptance is complete", () => {
  assert.equal(fs.existsSync(helper), true);
  assert.deepEqual(resolveOrigin(), {
    status: 0,
    stdout: "http://127.0.0.1:4173\n",
    stderr: ""
  });
  assert.equal(
    resolveOrigin({ AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN: "http://127.0.0.1:14417" }).status,
    1
  );
  assert.equal(resolveOrigin({ AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1" }).status, 1);
  assert.equal(resolveOrigin({ AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "2" }).status, 1);
  assert.deepEqual(
    resolveOrigin({
      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN: "http://127.0.0.1:14417"
    }),
    { status: 0, stdout: "http://127.0.0.1:14417\n", stderr: "" }
  );
});

test("cutover isolated acceptance rejects SSRF-shaped or malformed origins", () => {
  for (const origin of [
    "http://localhost:14417",
    "http://0.0.0.0:14417",
    "http://[::1]:14417",
    "https://127.0.0.1:14417",
    "http://user:pass@127.0.0.1:14417",
    "http://127.0.0.1:1023",
    "http://127.0.0.1:65536",
    "http://127.0.0.1:14417/",
    "http://127.0.0.1:14417/catalog-release.json",
    "http://127.0.0.1:14417?x=1",
    "http://127.0.0.1:14417#fragment",
    "http://127.0.0.1:14417\n"
  ]) {
    const result = resolveOrigin({
      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_ORIGIN: origin
    });
    assert.equal(result.status, 1, origin);
    assert.equal(result.stdout, "", origin);
  }
});

test("reviewer origin remains production-locked and has an independent isolated acceptance seam", () => {
  assert.equal(fs.existsSync(reviewerHelper), true);
  assert.deepEqual(resolveReviewerOrigin(), {
    status: 0,
    stdout: "http://127.0.0.1:4174\n",
    stderr: ""
  });
  assert.equal(
    resolveReviewerOrigin({ AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_REVIEWER_ORIGIN: "http://127.0.0.1:14418" }).status,
    1
  );
  assert.deepEqual(
    resolveReviewerOrigin({
      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_REVIEWER_ORIGIN: "http://127.0.0.1:14418"
    }),
    { status: 0, stdout: "http://127.0.0.1:14418\n", stderr: "" }
  );
});

test("cutover requires one approved list file for isolated Compose argv", () => {
  assert.equal(fs.existsSync(composeHelper), true);
  const source = fs.readFileSync(cutover, "utf8");
  assert.match(source, /source "\$script_dir\/workflow-cutover-compose-files\.sh"/);
  assert.match(source, /resolve_workflow_cutover_compose_files "\$base" "\$overlay"/);
  assert.match(source, /docker compose "\$\{compose_args\[@\]\}"/);
  assert.match(source, /docker compose "\$\{rollback_args\[@\]\}"/);
});

test("isolated Compose list accepts only the canonical five-file set", () => {
  const { native, bashPaths } = makeComposeFileSet();
  try {
    const isolatedEnv = {
      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: bashPaths.list,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: bashPaths.acceptanceRoot
    };
    assert.deepEqual(resolveComposeFiles(bashPaths.base, bashPaths.overlay), {
      status: 0,
      stdout: `${bashPaths.base}\n${bashPaths.overlay}\n`,
      stderr: ""
    });
    assert.equal(
      resolveComposeFiles(bashPaths.base, bashPaths.overlay, {
        AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: bashPaths.list
      }).status,
      1
    );
    assert.deepEqual(resolveComposeFiles(bashPaths.base, bashPaths.overlay, isolatedEnv), {
      status: 0,
      stdout: `${bashPaths.base}\n${bashPaths.overlay}\n${bashPaths.windows}\n${bashPaths.ports}\n${bashPaths.caddy}\n`,
      stderr: ""
    });

    const duplicateList = path.join(native.temporary, "duplicate.list");
    fs.writeFileSync(
      duplicateList,
      `${bashPaths.base}\n${bashPaths.overlay}\n${bashPaths.windows}\n${bashPaths.ports}\n${bashPaths.ports}\n`,
      "utf8"
    );
    fs.chmodSync(duplicateList, 0o644);
    assert.equal(resolveComposeFiles(bashPaths.base, bashPaths.overlay, {
      ...isolatedEnv,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: toBashPath(duplicateList)
    }).status, 1);

    const orderDriftList = path.join(native.temporary, "order-drift.list");
    fs.writeFileSync(
      orderDriftList,
      `${bashPaths.base}\n${bashPaths.overlay}\n${bashPaths.ports}\n${bashPaths.windows}\n${bashPaths.caddy}\n`,
      "utf8"
    );
    fs.chmodSync(orderDriftList, 0o644);
    assert.equal(resolveComposeFiles(bashPaths.base, bashPaths.overlay, {
      ...isolatedEnv,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: toBashPath(orderDriftList)
    }).status, 1);

    const external = path.join(native.temporary, "ports.override.yaml");
    writeComposeFile(external);
    const externalList = path.join(native.temporary, "external.list");
    fs.writeFileSync(
      externalList,
      `${bashPaths.base}\n${bashPaths.overlay}\n${bashPaths.windows}\n${toBashPath(external)}\n${bashPaths.caddy}\n`,
      "utf8"
    );
    fs.chmodSync(externalList, 0o644);
    assert.equal(resolveComposeFiles(bashPaths.base, bashPaths.overlay, {
      ...isolatedEnv,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: toBashPath(externalList)
    }).status, 1);

    const writableList = path.join(native.temporary, "writable.list");
    fs.copyFileSync(native.list, writableList);
    const statBin = path.join(native.temporary, "bin");
    fs.mkdirSync(statBin);
    writeExecutable(path.join(statBin, "stat"), `#!/bin/sh
last=''
for arg do last="$arg"; done
if [ "$1" = "-c" ] && [ "$2" = "%a" ]; then
  case "$last" in
    */writable.list) printf '666\\n'; exit 0 ;;
  esac
fi
exec /usr/bin/stat "$@"
`);
    assert.equal(resolveComposeFiles(bashPaths.base, bashPaths.overlay, {
      ...isolatedEnv,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: toBashPath(writableList),
      AIHUB_TEST_PATH_PREPEND: toBashPath(statBin)
    }).status, 1);

    const source = fs.readFileSync(composeHelper, "utf8");
    assert.match(source, /! -L "\$candidate"/);
    assert.match(source, /! -L "\$root"/);
    assert.match(source, /basename is not approved/);
  } finally {
    fs.rmSync(native.temporary, { recursive: true, force: true });
  }
});

test("cutover consumes only the normalized origin for every local read-only probe", () => {
  const source = fs.readFileSync(cutover, "utf8");
  assert.match(source, /source "\$script_dir\/workflow-cutover-admin-origin\.sh"/);
  assert.match(source, /source "\$script_dir\/workflow-cutover-reviewer-origin\.sh"/);
  assert.match(source, /admin_origin="\$\(resolve_workflow_cutover_admin_origin\)"/);
  assert.match(source, /reviewer_origin="\$\(resolve_workflow_cutover_reviewer_origin\)"/);
  assert.match(source, /catalog_endpoint="\$admin_origin\/catalog-release\.json"/);
  assert.match(source, /reviewer_probe_endpoint="\$reviewer_origin\/v1\/community\/workflow-store\/reviewer\/probe"/);
  assert.doesNotMatch(source, /http:\/\/127\.0\.0\.1:4173/);
  assert.doesNotMatch(source, /http:\/\/127\.0\.0\.1:4174/);
});

test("cutover has a fixed, post-health official bootstrap stage and no arbitrary runner seam", () => {
  const source = fs.readFileSync(cutover, "utf8");
  assert.equal(fs.existsSync(officialBootstrapWrapper), true);
  assert.match(source, /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.match(source, /admin-active7-image\.tar/);
  assert.match(source, /docker load -i "\$admin_archive"/);
  assert.match(source, /AIHUB_ADMIN_CMS_IMAGE="\$admin_image"/);
  assert.match(source, /catalog_v2_endpoint="\$admin_origin\/channels\/v2\/catalog-release\.json"/);
  assert.match(source, /workflow-official-bootstrap-production-wrapper\.cjs" \\\n+  "\$evidence" "\$admin_origin" "\$AIHUB_PUBLIC_HOST"/);
  assert.match(source, /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.doesNotMatch(source, /WORKFLOW_OFFICIAL_BOOTSTRAP_RUNNER|OFFICIAL_BOOTSTRAP_RUNNER_PATH/);
  const wrapper = fs.readFileSync(officialBootstrapWrapper, "utf8");
  assert.match(wrapper, /channels\/v2\/catalog-release\.json/);
  assert.match(wrapper, /function readFixedV2Release\(adminOrigin\)/);
  assert.match(wrapper, /agent:false/);
  assert.match(wrapper, /catalogChannel:'v2'/);
  assert.match(wrapper, /failureStage/);
  assert.match(wrapper, /OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE/);
  assert.doesNotMatch(wrapper, /execFileSync\(["']curl["']/);
  assert.match(wrapper, /headers:\{host:p\.publicHost\}/);
  assert.doesNotMatch(wrapper, /workflow-bootstrap\.invalid/);
  assert.match(wrapper, /workflow-official-bootstrap/);
  assert.match(wrapper, /\["--profile", "workflow-official-bootstrap", "run", "--no-deps", "--rm"/);
  assert.match(wrapper, /sourcePostKeys/);
  assert.match(wrapper, /workflowReferenceHashes/);
  assert.doesNotMatch(wrapper, /INSERT INTO|DELETE FROM community_workflow|DROP TABLE/);
});

test("official bootstrap production wrapper accepts the resolver canonical two-file argv", () => {
  const fixture = runOfficialBootstrapWrapper([
    path.join(deployment, "compose.server.yaml"),
    path.join(deployment, "compose.workflow-production.yaml")
  ]);
  try {
    assert.notEqual(fixture.result.status, 0);
    assert.equal(fs.existsSync(fixture.reportPath), true, fixture.result.stderr);
    const report = JSON.parse(fs.readFileSync(fixture.reportPath, "utf8"));
    assert.equal(report.schema, "aihub-workflow-official-bootstrap-production-v1");
    assert.notEqual(report.failureStage, "arguments");
  } finally {
    fs.rmSync(fixture.temporary, { recursive: true, force: true });
  }
});

test("official bootstrap wrapper requires the resolver-controlled isolated five-file list", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-bootstrap-compose-"));
  const acceptanceRoot = path.join(temporary, "acceptance");
  fs.mkdirSync(acceptanceRoot);
  const base = path.join(deployment, "compose.server.yaml");
  const overlay = path.join(deployment, "compose.workflow-production.yaml");
  const extras = ["compose.windows-acceptance.yaml", "ports.override.yaml", "caddy.override.yaml"]
    .map((name) => path.join(acceptanceRoot, name));
  for (const filename of extras) writeComposeFile(filename);
  const list = path.join(temporary, "compose-files.list");
  fs.writeFileSync(list, [base, overlay, ...extras].join("\n") + "\n", "utf8");
  fs.chmodSync(list, 0o644);
  const environment = {
    AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: list,
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: acceptanceRoot
  };
  const accepted = runOfficialBootstrapWrapper([base, overlay, ...extras], environment);
  const missingList = runOfficialBootstrapWrapper([base, overlay, ...extras], {
    ...environment,
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: path.join(temporary, "missing.list")
  });
  try {
    assert.notEqual(readWrapperReport(accepted).failureStage, "arguments");
    assert.equal(readWrapperReport(missingList).failureStage, "arguments");
  } finally {
    fs.rmSync(accepted.temporary, { recursive: true, force: true });
    fs.rmSync(missingList.temporary, { recursive: true, force: true });
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("official bootstrap wrapper rejects missing, unknown, duplicate, and order-drifted Compose argv", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-bootstrap-rejections-"));
  const base = path.join(deployment, "compose.server.yaml");
  const overlay = path.join(deployment, "compose.workflow-production.yaml");
  const unknown = path.join(temporary, "unknown.yaml");
  writeComposeFile(unknown);
  const productionCases = [
    [],
    [base],
    [base, overlay, unknown],
    [base, overlay, overlay],
    [overlay, base]
  ].map((files) => runOfficialBootstrapWrapper(files));

  const acceptanceRoot = path.join(temporary, "acceptance");
  fs.mkdirSync(acceptanceRoot);
  const windows = path.join(acceptanceRoot, "compose.windows-acceptance.yaml");
  const ports = path.join(acceptanceRoot, "ports.override.yaml");
  const caddy = path.join(acceptanceRoot, "caddy.override.yaml");
  for (const filename of [windows, ports, caddy]) writeComposeFile(filename);
  function isolatedCase(extras) {
    const list = path.join(temporary, `compose-files-${crypto.randomBytes(4).toString("hex")}.list`);
    fs.writeFileSync(list, [base, overlay, ...extras].join("\n") + "\n", "utf8");
    fs.chmodSync(list, 0o644);
    return runOfficialBootstrapWrapper([base, overlay, ...extras], {
      AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: list,
      AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: acceptanceRoot
    });
  }
  const isolatedCases = [
    isolatedCase([windows, ports, unknown]),
    isolatedCase([windows, ports, ports]),
    isolatedCase([ports, windows, caddy])
  ];
  try {
    for (const fixture of [...productionCases, ...isolatedCases]) {
      assert.equal(readWrapperReport(fixture).failureStage, "arguments");
    }
  } finally {
    for (const fixture of [...productionCases, ...isolatedCases]) {
      fs.rmSync(fixture.temporary, { recursive: true, force: true });
    }
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("official bootstrap Caddy probes bind only the configured public host and report safe public status classes", () => {
  const wrapper = require(officialBootstrapWrapper);
  assert.equal(wrapper.normalizePublicHost("workflow-cutover.invalid"), "workflow-cutover.invalid");
  assert.throws(() => wrapper.normalizePublicHost("http://workflow-cutover.invalid"), /public host/i);
  assert.throws(() => wrapper.normalizePublicHost("workflow-cutover.invalid/path"), /public host/i);
  assert.deepEqual(wrapper.publicProbeSummary(
    { status: 200, body: { items: [{}, {}, {}] } },
    { status: 404, body: null }
  ), {
    identityStatusClass: "2xx", identityItemCount: 3,
    caddyStatusClass: "4xx", caddyItemCount: null
  });
});

test("cutover fixture drives an isolated origin and restores the disabled base after a nonzero acceptance failure", () => {
  const success = runCutoverFixture({ runnerStatus: 0 });
  const failed = runCutoverFixture({ runnerStatus: 19 });
  try {
    assert.equal(success.result.status, 0, success.result.stderr);
    assert.match(success.curlLog, /http:\/\/127\.0\.0\.1:14417\/catalog-release\.json/);
    assert.match(success.curlLog, /http:\/\/127\.0\.0\.1:14418\/v1\/community\/workflow-store\/reviewer\/probe/);
    assert.doesNotMatch(success.curlLog, /127\.0\.0\.1:4173/);
    assert.doesNotMatch(success.curlLog, /127\.0\.0\.1:4174/);
    assert.match(success.dockerLog, /compose\.windows-acceptance\.yaml/);
    assert.match(success.dockerLog, /ports\.override\.yaml/);
    assert.match(success.dockerLog, /caddy\.override\.yaml/);
    assert.match(success.nodeLog, /workflow-official-bootstrap-production-wrapper\.cjs/);
    assert.equal(failed.result.status, 19, failed.result.stderr);
    assert.match(failed.dockerLog, /rollback-identity\.yaml/);
    assert.match(failed.dockerLog, /compose\.windows-acceptance\.yaml/);
    assert.match(failed.dockerLog, /ports\.override\.yaml/);
    assert.match(failed.dockerLog, /caddy\.override\.yaml/);
  } finally {
    fs.rmSync(success.temporary, { recursive: true, force: true });
    fs.rmSync(failed.temporary, { recursive: true, force: true });
  }
});

test("cutover fails closed and emergency-disables when the fixed official bootstrap wrapper fails", () => {
  const failed = runCutoverFixture({ runnerStatus: 0, bootstrapStatus: 23 });
  try {
    assert.equal(failed.result.status, 23, failed.result.stderr);
    assert.match(failed.nodeLog, /workflow-official-bootstrap-production-wrapper\.cjs/);
    assert.match(failed.dockerLog, /workflow-disabled-identity\.yaml/);
  } finally {
    fs.rmSync(failed.temporary, { recursive: true, force: true });
  }
});

test("emergency disable rejects production overrides before Docker and keeps the canonical isolated five-file argv", () => {
  const productionOverride = runEmergencyDisableFixture({
    AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: "/forbidden/list"
  });
  const isolated = runEmergencyDisableFixture({ AIHUB_TEST_AUTO_ISOLATED: "1" });
  try {
    assert.notEqual(productionOverride.result.status, 0);
    assert.equal(productionOverride.dockerLog, "");

    assert.equal(isolated.result.status, 0, isolated.result.stderr);
    assert.match(isolated.dockerLog, /compose\.windows-acceptance\.yaml/);
    assert.match(isolated.dockerLog, /ports\.override\.yaml/);
    assert.match(isolated.dockerLog, /caddy\.override\.yaml/);
    assert.match(isolated.dockerLog, /workflow-disabled-identity\.yaml/);
    assert.doesNotMatch(isolated.dockerLog, /--volumes|\bprune\b|\bdown\b/);
  } finally {
    fs.rmSync(productionOverride.native.temporary, { recursive: true, force: true });
    fs.rmSync(isolated.native.temporary, { recursive: true, force: true });
  }
});
