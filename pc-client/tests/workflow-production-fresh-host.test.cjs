"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const contractPath = path.join(deployment, "workflow-production-fresh-host-contract.cjs");
const stage0Path = path.join(deployment, "workflow-production-fresh-host-stage0.sh");
const envPath = path.join(deployment, "workflow-production-fresh-host.env.template");
const secretsPath = path.join(deployment, "workflow-production-fresh-secret-authority.sh");
const caddySecretSeederPath = path.join(deployment, "seed-caddy-secret-volume.sh");
const catalogPath = path.join(deployment, "catalog-active7-fresh-install.cjs");
const preflightPath = path.join(deployment, "workflow-production-fresh-host-preflight.cjs");
const runnerPath = path.join(deployment, "workflow-production-fresh-host-runner.sh");
const launcherPath = path.join(deployment, "workflow-production-fresh-host-launcher.sh");
const terminalPath = path.join(deployment, "workflow-production-fresh-host-terminal.cjs");

function read(file) { return fs.readFileSync(file, "utf8"); }

test("fresh-host candidate files exist before the deployment manifest can be frozen", () => {
  for (const file of [contractPath, stage0Path, envPath, secretsPath, catalogPath, preflightPath, runnerPath, launcherPath, terminalPath]) {
    assert.equal(fs.existsSync(file), true, path.basename(file));
  }
});

test("fresh-host preflight rejects private-mode Admin data directories before any production write", () => {
  const { assertEmptyDirectory } = require(preflightPath);
  const directory = "/opt/zhenxing-ai/shared/admin/published";
  const fixture = (mode) => ({
    lstatSync(value) {
      assert.equal(value, directory);
      return {
        isDirectory: () => true,
        isSymbolicLink: () => false,
        uid: 1000,
        gid: 1000,
        mode,
        nlink: 2
      };
    },
    readdirSync(value) { assert.equal(value, directory); return []; },
    realpathSync(value) { return value; }
  });
  assert.doesNotThrow(() => assertEmptyDirectory(directory, fixture(0o40755)));
  assert.throws(
    () => assertEmptyDirectory(directory, fixture(0o40700)),
    (error) => error?.code === "FRESH_HOST_DIRECTORY_CONFLICT"
  );
});

test("fresh-host preflight reuses only the exact R24 Caddy certificate volume", () => {
  const { validateReusableCaddyDataVolume } = require(preflightPath);
  const name = "zhenxing-ai-community-production-caddy-data";
  const mount = `/var/lib/docker/volumes/${name}/_data`;
  const regular = new Set([
    `${mount}/caddy/certificates/acme.zerossl.com-v2-dv90/zhenxingai.com/zhenxingai.com.crt`,
    `${mount}/caddy/certificates/acme.zerossl.com-v2-dv90/zhenxingai.com/zhenxingai.com.key`,
    `${mount}/caddy/certificates/acme.zerossl.com-v2-dv90/zhenxingai.com/zhenxingai.com.json`,
    `${mount}/caddy/certificates/acme.zerossl.com-v2-dv90/community.zhenxingai.com/community.zhenxingai.com.crt`,
    `${mount}/caddy/certificates/acme.zerossl.com-v2-dv90/community.zhenxingai.com/community.zhenxingai.com.key`,
    `${mount}/caddy/certificates/acme.zerossl.com-v2-dv90/community.zhenxingai.com/community.zhenxingai.com.json`
  ]);
  const fileSystem = {
    lstatSync(value) {
      const file = regular.has(value);
      return {
        isDirectory: () => !file,
        isFile: () => file,
        isSymbolicLink: () => false,
        uid: 65534,
        gid: 65534,
        mode: file ? 0o100600 : 0o40755,
        nlink: file ? 1 : 2,
        size: file ? 512 : 0
      };
    },
    readFileSync(value) { assert.match(value, /\.crt$/); return Buffer.from("certificate"); },
    realpathSync(value) { return value; }
  };
  const inspection = [{ CreatedAt: "fixed", Driver: "local", Labels: null, Mountpoint: mount, Name: name, Options: null, Scope: "local" }];
  assert.equal(validateReusableCaddyDataVolume(inspection, {
    fs: fileSystem,
    parseCertificate: (_bytes, host) => ({ checkHost: (value) => value === host ? host : undefined })
  }), true);
  assert.throws(() => validateReusableCaddyDataVolume([{ ...inspection[0], Name: "other" }], { fs: fileSystem }), (error) => error?.code === "FRESH_HOST_CADDY_DATA_VOLUME_CONFLICT");
  assert.throws(() => validateReusableCaddyDataVolume(inspection, {
    fs: fileSystem,
    parseCertificate: () => ({ checkHost: () => undefined })
  }), (error) => error?.code === "FRESH_HOST_CADDY_DATA_VOLUME_CONFLICT");
});

test("Stage0 freezes one Ubuntu LTS host contract and rejects caller-controlled login identity", () => {
  const contract = require(contractPath);
  assert.deepEqual(contract.STAGE0.allowedUbuntuVersions, ["24.04"]);
  assert.equal(contract.STAGE0.host, "47.236.62.189");
  assert.equal(contract.STAGE0.hostKeyFingerprint, "SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6nn7aM+gLDrI");
  assert.equal(contract.STAGE0.keyPairName, "zhenxingai-deploy");
  assert.equal(contract.STAGE0.loginUser, "admin");
  assert.equal(contract.STAGE0.architecture, "x86_64");
  assert.equal(contract.STAGE0.adminUser, "admin");
  assert.equal(contract.STAGE0.adminUid, 1000);
  assert.equal(contract.STAGE0.adminGid, 1000);
  assert.equal(contract.STAGE0.cpuMinimum, 2);
  assert.equal(Object.hasOwn(contract.STAGE0, "memoryMinimumBytes"), false);
  assert.equal(Object.hasOwn(contract.BLOCK_CODES, "memory"), false);
  assert.equal(contract.STAGE0.diskTotalMinimumBytes, 48318382080);
  assert.equal(contract.STAGE0.diskAvailableMinimumBytes, 32212254720);
  assert.deepEqual(contract.STAGE0.aptPackages, [
    "bash", "ca-certificates", "coreutils", "docker-compose-v2", "docker.io", "iproute2", "openssl", "util-linux"
  ]);
  assert.deepEqual(contract.STAGE0.publicPorts, [80, 443]);
  assert.deepEqual(contract.STAGE0.loopbackPorts, [4173, 4174]);
  assert.throws(() => contract.validateLoginIdentity("", "admin"), /login identity/);
  assert.throws(() => contract.validateLoginIdentity("root", "admin"), /not frozen/);
  assert.throws(() => contract.validateLoginIdentity("$(id)", "admin"), /login identity/);
  assert.equal(contract.validateLoginIdentity("admin", "admin"), "admin");
});

test("Stage0 memory inventory does not gate a legal fresh host", () => {
  const { validateStage0Observation } = require(contractPath);
  const clean = {
    loginUser: "admin", osId: "ubuntu", osVersion: "24.04", architecture: "x86_64",
    systemdPid1: true, systemdState: "running", kernel: "6.8.0", glibc: "2.39",
    cpuCount: 2, memoryBytes: 4294967296, diskTotalBytes: 53687091200,
    diskAvailableBytes: 37580963840, adminState: "absent", uid1000State: "absent",
    directoryState: "absent", packageState: "absent", dockerState: "absent",
    composeState: "absent", occupiedPorts: [], dnsHostsExact: true
  };
  assert.equal(validateStage0Observation(clean, { phase: "preflight", loginUser: "admin" }).status, "pass");
  assert.equal(validateStage0Observation({ ...clean, memoryBytes: 3758096383 }, { phase: "preflight", loginUser: "admin" }).status, "pass");
  assert.equal(validateStage0Observation({ ...clean, memoryBytes: 1 }, { phase: "preflight", loginUser: "admin" }).status, "pass");
  for (const [field, value, code] of [
    ["cpuCount", 1, "FRESH_HOST_CPU_UNDERSIZED"],
    ["diskTotalBytes", 48318382079, "FRESH_HOST_DISK_UNDERSIZED"],
    ["diskAvailableBytes", 32212254719, "FRESH_HOST_DISK_UNDERSIZED"],
    ["adminState", "conflict", "FRESH_HOST_IDENTITY_CONFLICT"],
    ["directoryState", "partial", "FRESH_HOST_DIRECTORY_CONFLICT"],
    ["packageState", "partial", "FRESH_HOST_PACKAGE_CONFLICT"],
    ["occupiedPorts", [443], "FRESH_HOST_PORT_CONFLICT"],
    ["dnsHostsExact", false, "FRESH_HOST_DNS_DRIFT"]
  ]) {
    assert.equal(validateStage0Observation({ ...clean, [field]: value }, { phase: "preflight", loginUser: "admin" }).code, code, field);
  }
  const installed = { ...clean, adminState: "exact", uid1000State: "admin", directoryState: "exact", packageState: "exact", dockerState: "ready", composeState: "ready" };
  assert.equal(validateStage0Observation(installed, { phase: "verify", loginUser: "admin" }).repeatSafe, true);
  assert.equal(validateStage0Observation({ ...installed, packageState: "partial" }, { phase: "verify", loginUser: "admin" }).status, "blocked");
});

test("production env template has an exact non-secret allowlist and the workflow-only profile", () => {
  const { ENVIRONMENT, parseEnvironmentTemplate } = require(contractPath);
  const values = parseEnvironmentTemplate(read(envPath));
  assert.deepEqual(Object.keys(values).sort(), [...ENVIRONMENT.keys].sort());
  assert.equal(values.AIHUB_FRESH_HOST_LOGIN_USER, "admin");
  assert.equal(values.COMPOSE_PROJECT_NAME, "zhenxing-community-production");
  assert.equal(values.AIHUB_ADMIN_CMS_IMAGE, "zhenxing-ai/admin:0.1.40-src-186ff057efd3");
  assert.equal(values.AIHUB_PUBLIC_HOST, "zhenxingai.com");
  assert.equal(values.AIHUB_COMMUNITY_PUBLIC_HOST, "community.zhenxingai.com");
  assert.equal(values.AIHUB_RESOURCE_SUBMISSIONS_ENABLED, "0");
  assert.equal(values.AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION, "0");
  assert.equal(values.AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED, "0");
  assert.equal(values.AIHUB_WORKFLOW_STORE_ENABLED, "1");
  assert.equal(values.AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED, "1");
  assert.equal(values.AIHUB_WORKFLOW_STORE_SCHEMA_VERSION, "1");
  assert.equal(Object.keys(values).some((key) => /PASSWORD|TOKEN|SECRET_VALUE|PRIVATE_KEY/.test(key)), false);
  assert.doesNotMatch(read(envPath), /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|password\s*=|token\s*=/i);
  assert.throws(() => parseEnvironmentTemplate(`${read(envPath)}\nAIHUB_PUBLIC_HOST=evil.example\n`), /duplicated/);
  assert.throws(() => parseEnvironmentTemplate(`${read(envPath)}\nAIHUB_SECRET_VALUE=evil\n`), /not allowlisted/);
  assert.throws(() => parseEnvironmentTemplate(read(envPath).replace("AIHUB_PUBLIC_HOST=zhenxingai.com", "AIHUB_PUBLIC_HOST=$(id)")), /unsafe/);
});

test("fresh secret authority is CSPRNG-only, metadata-exact, and application provision keeps the forum credential", () => {
  const source = read(secretsPath);
  const seeder = read(caddySecretSeederPath);
  const runner = read(runnerPath);
  for (const name of [
    "identity_db_password", "forum_db_password", "forum_db_root_password", "forum_admin_password",
    "forum_api_key", "forum_password_token", "community_internal", "community_management",
    "community_cms_gateway", "workflow_review_secret"
  ]) assert.match(source, new RegExp(`\\b${name}\\b`));
  assert.match(source, /openssl rand -hex 32/);
  assert.match(source, /forum_api_key[\s\S]*printf '\\n'/);
  assert.match(source, /chmod 0600/);
  assert.match(source, /chown 1000:1000/);
  assert.match(source, /stat -c '%u:%g:%a:%h:%s'/);
  assert.doesNotMatch(source, /(?:echo|printf).*\$(?:secret|value)|--env.*(?:PASSWORD|TOKEN|SECRET)/i);
  assert.match(seeder, /if \[\[ -v SUDO_UID \|\| -v SUDO_GID \]\]/);
  assert.match(seeder, /-v SUDO_UID && -v SUDO_GID/);
  assert.match(seeder, /approved_owner="\$SUDO_UID:\$SUDO_GID"/);
  assert.match(seeder, /approved_owner="0:0"/);
  assert.match(seeder, /"\$source_uid:\$source_gid" == "\$approved_owner"/);
  assert.match(runner, /SUDO_UID=1000 SUDO_GID=1000 \/bin\/bash "\$script_dir\/seed-caddy-secret-volume\.sh"/);
  assert.doesNotMatch(runner, /SUDO_UID="?\$|SUDO_GID="?\$/);
  assert.match(read(runnerPath), /community-migrate/);
  assert.match(read(runnerPath), /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.doesNotMatch(read(runnerPath), /INSERT\s+INTO\s+api_keys|resource_submissions/i);
});

test("fresh catalog install accepts only an empty store and frozen signed public artifacts", async () => {
  const { catalogActivationArtifacts, catalogFreshInstallArtifacts, createWorkflowProductionReleaseBundleManifest } = require(path.join(deployment, "workflow-production-release-bundle.cjs"));
  const { installFreshCatalog } = require(catalogPath);
  const source = read(catalogPath);
  assert.equal(catalogActivationArtifacts.state.path, "artifacts/catalog-active7-state.json");
  assert.equal(catalogActivationArtifacts.release.path, "artifacts/catalog-active7-release.json");
  assert.equal(catalogFreshInstallArtifacts.active6.path, "artifacts/catalog-active6-release.json");
  assert.equal(catalogFreshInstallArtifacts.active72.path, "artifacts/catalog-active72-v1-release.json");
  assert.match(source, /catalogActivationArtifacts/);
  assert.match(source, /catalogFreshInstallArtifacts/);
  assert.match(source, /catalog-signing-private\.pem/);
  assert.match(source, /directory is not empty/);
  assert.doesNotMatch(source, /signingKeyProvider|PRIVATE KEY/);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-r13-catalog-"));
  const artifacts = path.join(temporary, "artifacts");
  const published = path.join(temporary, "published");
  const data = path.join(temporary, "data");
  fs.mkdirSync(artifacts);
  try {
    for (const artifact of [
      catalogActivationArtifacts.state,
      catalogActivationArtifacts.release,
      catalogFreshInstallArtifacts.active6,
      catalogFreshInstallArtifacts.active72
    ]) fs.copyFileSync(path.join(root, artifact.source), path.join(temporary, artifact.path));
    const iconEntries = createWorkflowProductionReleaseBundleManifest().files.filter((entry) => entry.path.startsWith("artifacts/catalog-vendor-icons/"));
    for (const entry of iconEntries) {
      const target = path.join(temporary, entry.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, "admin", "data", "vendor-icons", path.basename(entry.path)), target);
    }
    const receipt = await installFreshCatalog({ publishedDirectory: published, artifactDirectory: temporary, dataDirectory: data });
    assert.deepEqual(receipt, { status: "pass", activeV1: 72, activeV2: 7, vendorIcons: 204, signingKeyPresent: false });
    assert.equal(fs.readdirSync(path.join(data, "vendor-icons")).length, 204);
    await assert.rejects(installFreshCatalog({ publishedDirectory: published, artifactDirectory: temporary, dataDirectory: data }), (error) => {
      assert.deepEqual(error.catalogFailure, { stage: "catalog-published-store", code: "R16_FRESH_CATALOG_PUBLISHED_STORE_FAILED" });
      return true;
    });
    fs.rmSync(published, { recursive: true });
    const target = path.join(temporary, catalogFreshInstallArtifacts.active6.path);
    fs.appendFileSync(target, "\n");
    fs.rmSync(data, { recursive: true });
    await assert.rejects(installFreshCatalog({ publishedDirectory: published, artifactDirectory: temporary, dataDirectory: data }), (error) => {
      assert.deepEqual(error.catalogFailure, { stage: "catalog-artifact-active6", code: "R16_FRESH_CATALOG_ACTIVE6_ARTIFACT_FAILED" });
      return true;
    });
    assert.deepEqual(fs.existsSync(published) ? fs.readdirSync(published) : [], []);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("fresh catalog installer assigns one safe failure pair to every first-fault seam", () => {
  const {
    CATALOG_FAILURE_CODES_BY_STAGE,
    catalogFailureTerminal,
    catalogStep,
    preserveCatalogFailure
  } = require(catalogPath);
  const expected = {
    "catalog-release-root": "R16_FRESH_CATALOG_RELEASE_ROOT_FAILED",
    "catalog-published-store": "R16_FRESH_CATALOG_PUBLISHED_STORE_FAILED",
    "catalog-artifact-state": "R16_FRESH_CATALOG_STATE_ARTIFACT_FAILED",
    "catalog-artifact-active7": "R16_FRESH_CATALOG_ACTIVE7_ARTIFACT_FAILED",
    "catalog-artifact-active6": "R16_FRESH_CATALOG_ACTIVE6_ARTIFACT_FAILED",
    "catalog-artifact-active72": "R16_FRESH_CATALOG_ACTIVE72_ARTIFACT_FAILED",
    "catalog-state-contract": "R16_FRESH_CATALOG_STATE_CONTRACT_FAILED",
    "catalog-vendor-icon-directory": "R16_FRESH_CATALOG_VENDOR_ICON_DIRECTORY_FAILED",
    "catalog-artifact-vendor-icons": "R16_FRESH_CATALOG_VENDOR_ICON_ARTIFACTS_FAILED",
    "catalog-install-vendor-icons": "R16_FRESH_CATALOG_VENDOR_ICON_INSTALL_FAILED",
    "catalog-release-directory": "R16_FRESH_CATALOG_RELEASE_DIRECTORY_FAILED",
    "catalog-install-active6": "R16_FRESH_CATALOG_INSTALL_ACTIVE6_FAILED",
    "catalog-install-active72": "R16_FRESH_CATALOG_INSTALL_ACTIVE72_FAILED",
    "catalog-install-active7": "R16_FRESH_CATALOG_INSTALL_ACTIVE7_FAILED",
    "catalog-install-state": "R16_FRESH_CATALOG_INSTALL_STATE_FAILED",
    "catalog-verify-v1": "R16_FRESH_CATALOG_VERIFY_V1_FAILED",
    "catalog-verify-v2": "R16_FRESH_CATALOG_VERIFY_V2_FAILED",
    "catalog-unknown": "R16_FRESH_CATALOG_UNKNOWN_FAILED"
  };
  assert.deepEqual(CATALOG_FAILURE_CODES_BY_STAGE, expected);
  assert.equal(new Set(Object.values(expected)).size, Object.keys(expected).length);
  for (const [stage, code] of Object.entries(expected)) {
    assert.throws(() => catalogStep(stage, () => { throw new Error("/secret/raw/path"); }), (error) => {
      assert.deepEqual(error.catalogFailure, { stage, code });
      assert.deepEqual(catalogFailureTerminal(error), {
        schema: "aihub-catalog-active7-fresh-install-v1",
        status: "blocked",
        failure: { stage, code }
      });
      assert.doesNotMatch(JSON.stringify(catalogFailureTerminal(error)), /secret|raw|path|stack|message/i);
      return true;
    });
  }
  assert.throws(() => preserveCatalogFailure(
    Object.assign(new Error("primary raw"), { catalogFailure: { stage: "catalog-install-active7", code: expected["catalog-install-active7"] } }),
    () => { throw new Error("cleanup raw"); }
  ), (error) => {
    assert.deepEqual(error.catalogFailure, { stage: "catalog-install-active7", code: expected["catalog-install-active7"] });
    assert.doesNotMatch(JSON.stringify(error.catalogFailure), /primary|cleanup|raw/i);
    return true;
  });
  const cli = spawnSync(process.execPath, [catalogPath, "unexpected"], { encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.equal(cli.stderr, "");
  assert.equal(cli.stdout.endsWith("\n"), true);
  assert.equal(cli.stdout.slice(0, -1).includes("\n"), false);
  assert.deepEqual(JSON.parse(cli.stdout), {
    schema: "aihub-catalog-active7-fresh-install-v1",
    status: "blocked",
    failure: { stage: "catalog-release-root", code: expected["catalog-release-root"] }
  });
});

test("Stage0 remains separate while r25 exposes one durable production initialize-and-launch", () => {
  const stage0 = read(stage0Path);
  const runner = read(runnerPath);
  assert.match(stage0, /preflight\|apply\|verify/);
  assert.match(stage0, /apt-get update/);
  assert.match(stage0, /apt-get install -y --no-install-recommends/);
  assert.doesNotMatch(stage0, /curl|wget|add-apt-repository|deb \[|https?:\/\//);
  assert.match(stage0, /useradd[^\n]*--uid 1000[^\n]*--gid 1000[^\n]*admin/);
  assert.match(stage0, /\/proc\/net\/tcp \/proc\/net\/tcp6/);
  assert.match(stage0, /systemctl enable --now docker/);
  assert.match(stage0, /docker version --format/);
  assert.match(stage0, /docker compose version --short/);
  assert.match(stage0, /name=rootless/);
  assert.doesNotMatch(stage0, /docker (?:pull|build|load)|docker compose (?:up|run|create|start)/);
  assert.doesNotMatch(runner, /preflight\|initialize\|verify/);
  assert.match(runner, /\[\[ \$# -eq 1 && "\$1" == __run \]\]/);
  assert.match(read(launcherPath), /zhenxing-ai-workflow-production-r25\.service/);
  assert.doesNotMatch(read(preflightPath), /workflow-production-fresh-host-stage0\.sh/);
  assert.match(runner, /verify-prepared/);
  assert.match(runner, /NODE_PATH\+x/);
  assert.match(runner, /DOCKER_HOST\+x/);
  assert.match(runner, /\.workflow-runtime\/node-v24\.18\.1-linux-x64\/bin\/node/);
  assert.doesNotMatch(runner, /(?:^|\n)\s*(?:\/usr\/bin\/)?node(?:\s|$)|(?:^|\n)\s*(?:export\s+)?NODE_(?:PATH|OPTIONS)=/);
  assert.match(runner, /--profile migration run --rm --no-deps identity-migrate/);
  assert.match(runner, /--profile migration run --rm --no-deps community-migrate/);
  assert.match(runner, /AIHUB_WORKFLOW_REVIEWER_PROVISION_MODE=hold/);
  assert.match(runner, /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.match(read(path.join(deployment, "workflow-official-bootstrap-production-wrapper.cjs")), /\["--profile", "workflow-official-bootstrap", "run", "--no-deps", "--rm"/);
  assert.doesNotMatch(runner, /docker compose (?:down|build)|--volumes|\bprune\b|0001-resource-submissions|CREATE DATABASE/i);
  assert.doesNotMatch(`${stage0}\n${runner}`, /scp|sftp|base64|caller.*(?:url|path|command)/i);
});

test("Stage0 requires both frozen public hosts to resolve to the frozen server IP", () => {
  const stage0 = read(stage0Path);
  assert.match(stage0, /for host in zhenxingai\.com community\.zhenxingai\.com/);
  assert.match(stage0, /getent ahostsv4 "\$host"/);
  assert.match(stage0, /-v ip="\$HOST"/);
  assert.match(stage0, /\$1 == ip/);
  assert.doesNotMatch(stage0, /getent ahostsv4 "\$host" >\/dev\/null/);
});

test("r25 fresh target reuses the fixed collector under the r25 durable namespace", () => {
  const collector = require(path.join(deployment, "workflow-production-r12-fixed-collector.cjs"));
  assert.doesNotThrow(() => collector.createR12FixedCollector({
    releaseRoot: "/opt/zhenxing-ai/releases/community-production-r25-fixed01",
    executeFile() { throw new Error("not executed while constructing the fixed collector"); }
  }));
  const execute = (file, args) => {
    if (file === "/usr/bin/systemctl") return { status: 0, stdout: args.at(-1).includes("r25") ? "LoadState=loaded\nActiveState=active\nSubState=running\n" : "LoadState=not-found\nActiveState=inactive\nSubState=dead\n", stderr: "" };
    if (file === "/usr/bin/pgrep") return args.at(-1).includes("fresh-host-preflight") ? { status: 0, stdout: `${process.pid}\n`, stderr: "" } : { status: 1, stdout: "", stderr: "" };
    if (file === "/usr/bin/docker") return { status: 0, stdout: `${require(path.join(deployment, "workflow-production-service-contract.cjs")).SERVICES.map((service) => service.composeService).join("\n")}\n`, stderr: "" };
    throw new Error("unexpected fixed command");
  };
  assert.equal(collector.assertNoConcurrentR25Run(execute), 0);
});

test("fresh-host target blocked output preserves only a validated target failure pair", () => {
  const { targetBlockedOutput } = require(preflightPath);
  const { TARGET_FAILURE_CODES } = require(path.join(deployment, "workflow-production-r12-fixed-collector.cjs"));
  const output = targetBlockedOutput(Object.assign(new Error("/raw/secret/message"), {
    targetFailure: {
      stage: "workflow-capability",
      code: TARGET_FAILURE_CODES["workflow-capability"]
    }
  }));
  assert.deepEqual(output, {
    schema: "aihub-workflow-production-fresh-host-preflight-v1",
    status: "blocked",
    phase: "target",
    failure: {
      stage: "workflow-capability",
      code: "FRESH_HOST_WORKFLOW_CAPABILITY_NOT_READY"
    },
    secretValuesEmitted: false,
    initializeAuthorized: false,
    launchAuthorized: false
  });
  const unknown = targetBlockedOutput(new Error("/raw/secret/message"));
  assert.deepEqual(unknown.failure, {
    stage: "target-unknown",
    code: TARGET_FAILURE_CODES["target-unknown"]
  });
  assert.doesNotMatch(JSON.stringify(unknown), /\/raw\/|message|stack|path/i);
});
