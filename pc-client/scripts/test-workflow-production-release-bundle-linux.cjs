"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  createWorkflowProductionReleaseBundle
} = require("../deployment/community-production/workflow-production-release-bundle.cjs");

const root = path.resolve(__dirname, "..");
const testImage = "aihub-workflow-release-prepare-test:ubuntu24-dind";
const ubuntu = "ubuntu@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea";
const suffix = crypto.randomBytes(5).toString("hex");
const container = `aihub-release-prepare-${suffix}`;
const dockerVolume = `${container}-docker`;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-release-bundle-"));
const providedBundle = process.argv[2] ? path.resolve(process.argv[2]) : null;
const localBundle = providedBundle || path.join(temporary, "community-production-base000.bundle");
const outputDirectory = path.join(root, "output", `workflow-production-release-bundle-linux-${suffix}`);
const reportPath = path.join(outputDirectory, "report.json");

function run(command, args, options = {}) {
  const value = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...options
  });
  if (value.error) throw value.error;
  return value;
}

function must(value, label) {
  assert.equal(value.status, 0, `${label}: ${value.stderr || value.stdout}`);
  return value;
}

function docker(args, options) {
  return run("docker", args, options);
}

function inner(script, environment = {}) {
  const args = ["exec"];
  for (const [key, value] of Object.entries(environment)) args.push("-e", `${key}=${value}`);
  args.push(container, "bash", "-lc", script);
  return docker(args);
}

function prepare(name, environment = {}) {
  return inner(
    `SUDO_UID=1000 SUDO_GID=1000 bash /opt/zhenxing-ai/staging/${name}.bundle/payload/deployment/community-production/prepare-workflow-production-release.sh /opt/zhenxing-ai/staging/${name}.bundle /opt/zhenxing-ai/releases/${name}`,
    environment
  );
}

function removeExactInner(target) {
  must(inner(`case '${target}' in /opt/zhenxing-ai/staging/community-production-*|/opt/zhenxing-ai/releases/community-production-*) find -P '${target}' -depth -delete ;; *) exit 2 ;; esac`), "remove exact fixture");
}

function buildTestImage() {
  if (docker(["image", "inspect", testImage]).status === 0) return;
  const dockerfile = [
    `FROM ${ubuntu}`,
    "ENV DEBIAN_FRONTEND=noninteractive",
    "RUN apt-get update && apt-get install -y --no-install-recommends docker.io docker-compose-v2 ca-certificates && rm -rf /var/lib/apt/lists/*",
    ""
  ].join("\n");
  must(run("docker", ["build", "-t", testImage, "-f", "-", "."], { input: dockerfile }), "build Linux DinD test image");
}

function clone(name) {
  must(inner(`cp -a /opt/zhenxing-ai/staging/community-production-base000.bundle /opt/zhenxing-ai/staging/${name}.bundle`), `clone ${name}`);
}

function noTemporaryTarget(name) {
  const value = must(inner(`find /opt/zhenxing-ai/releases -maxdepth 1 -name '${name}.tmp.*' -print`), `inspect ${name} temp`).stdout.trim();
  assert.equal(value, "", `${name} left a temporary release`);
}

function assertImageClosure(inspect, expected) {
  assert.equal(inspect.Id, expected.imageId, `${expected.name} image ID drifted`);
  assert.equal(inspect.Config?.Labels?.["com.aihub.source-content-sha256"], expected.sourceDigest, `${expected.name} source label drifted`);
  assert.equal(inspect.Config?.Labels?.["com.aihub.release-version"], expected.releaseLabel, `${expected.name} release label drifted`);
  assert.equal(inspect.Config?.User || "", expected.user, `${expected.name} user drifted`);
  return {
    imageId: inspect.Id,
    sourceDigest: inspect.Config.Labels["com.aihub.source-content-sha256"],
    releaseLabel: inspect.Config.Labels["com.aihub.release-version"],
    user: inspect.Config.User || ""
  };
}

function failCase(name, mutate, options = {}) {
  clone(name);
  if (mutate) must(inner(mutate), `mutate ${name}`);
  if (options.existingTarget) {
    must(inner(`install -d -m 0755 -o 1000 -g 1000 /opt/zhenxing-ai/releases/${name}; printf sentinel > /opt/zhenxing-ai/releases/${name}/sentinel`), `seed ${name} target`);
  }
  const result = prepare(name, options.environment || {});
  assert.notEqual(result.status, 0, `${name} unexpectedly prepared`);
  noTemporaryTarget(name);
  if (options.existingTarget) {
    assert.equal(must(inner(`cat /opt/zhenxing-ai/releases/${name}/sentinel`), `inspect ${name} sentinel`).stdout.trim(), "sentinel");
    removeExactInner(`/opt/zhenxing-ai/releases/${name}`);
  } else {
    assert.notEqual(inner(`test -e /opt/zhenxing-ai/releases/${name}`).status, 0, `${name} published a release`);
  }
  return String(result.stderr || result.stdout).trim().split(/\r?\n/).slice(-1)[0];
}

(async () => {
  const report = {
    schema: "aihub-workflow-production-release-bundle-linux-v1",
    candidateOnly: true,
    deployable: false,
    checks: {},
    failures: {},
    cleanup: { completed: false }
  };
  try {
    buildTestImage();
    const manifest = providedBundle
      ? JSON.parse(fs.readFileSync(path.join(localBundle, ".aihub-workflow-release-bundle.json"), "utf8"))
      : createWorkflowProductionReleaseBundle(localBundle);
    assert.equal(fs.statSync(localBundle).isDirectory(), true, "provided release bundle is unavailable");
    report.bundle = {
      deploymentSetDigest: manifest.deployment.setDigest,
      deploymentManifestSha256: manifest.deployment.manifestSha256,
      identitySourceDigest: manifest.identity.sourceDigest,
      identitySourceManifestSha256: manifest.identity.sourceManifestSha256,
      identityImage: manifest.identityImage,
      payloadDigest: manifest.payload.digest,
      fileCount: manifest.payload.fileCount,
      directoryCount: manifest.payload.directoryCount
    };
    fs.mkdirSync(outputDirectory, { recursive: false });
    must(docker(["volume", "create", dockerVolume]), "create Linux DinD data volume");
    must(docker(["run", "-d", "--privileged", "--name", container, "--mount", `type=volume,src=${dockerVolume},dst=/var/lib/docker`, testImage, "dockerd", "--host=unix:///var/run/docker.sock", "--feature", "containerd-snapshotter=true"]), "start Linux DinD");
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (docker(["exec", container, "docker", "info"]).status === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    must(docker(["exec", container, "docker", "info"]), "wait Linux DinD");
    must(inner("mkdir -p /opt/zhenxing-ai/staging /opt/zhenxing-ai/releases"), "create fixed roots");
    must(docker(["cp", localBundle, `${container}:/opt/zhenxing-ai/staging/community-production-base000.bundle`]), "transfer bundle");
    must(inner("chown -R 1000:1000 /opt/zhenxing-ai/staging/community-production-base000.bundle; find /opt/zhenxing-ai/staging/community-production-base000.bundle -type d -exec chmod 700 {} +; find /opt/zhenxing-ai/staging/community-production-base000.bundle -type f -exec chmod 600 {} +"), "simulate umask 077 transfer");
    const oldMode = must(inner("stat -c '%a' /opt/zhenxing-ai/staging/community-production-base000.bundle/payload/deployment/community-production/caddy-entrypoint.sh"), "read red mode").stdout.trim();
    assert.equal(oldMode, "600");
    report.checks.oldFlowCaddyEntrypointMode = oldMode;

    clone("community-production-success01");
    must(prepare("community-production-success01"), "prepare umask 077 release");
    const activationModuleClosure = JSON.parse(must(inner(
      `/opt/zhenxing-ai/releases/community-production-success01/.workflow-runtime/node-v24.18.1-linux-x64/bin/node -e 'const m=require("/opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/catalog-active7-state-activation.cjs");process.stdout.write(JSON.stringify(Object.keys(m).sort()))'`
    ), "load prepared catalog activation closure").stdout);
    assert.deepEqual(activationModuleClosure, ["activateCatalogState", "readActiveRelease", "rollbackCatalogState"]);
    must(inner(
      "bash -n /opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/workflow-production-fresh-host-stage0.sh " +
      "/opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/workflow-production-fresh-host-launcher.sh " +
      "/opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/workflow-production-fresh-secret-authority.sh " +
      "/opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/workflow-production-fresh-host-runner.sh"
    ), "parse prepared fresh-host shells");
    const freshHostModuleClosure = JSON.parse(must(inner(
      `/opt/zhenxing-ai/releases/community-production-success01/.workflow-runtime/node-v24.18.1-linux-x64/bin/node -e 'const root="/opt/zhenxing-ai/releases/community-production-success01/deployment/community-production";const values=["workflow-production-fresh-host-contract.cjs","workflow-production-fresh-host-preflight.cjs","workflow-production-fresh-host-terminal.cjs","catalog-active7-fresh-install.cjs"].map(name=>Object.keys(require(root+"/"+name)).sort());process.stdout.write(JSON.stringify(values))'`
    ), "load prepared fresh-host module closure").stdout);
    assert.deepEqual(freshHostModuleClosure, [
      ["BLOCK_CODES", "ENVIRONMENT", "STAGE0", "parseEnvironmentTemplate", "validateLoginIdentity", "validateStage0Observation", "versionAtLeast"],
      ["DATA_DIRECTORIES", "REQUIRED_ENVIRONMENT", "assertEmptyDirectory", "createFreshHostPreflight", "exactEnvironment", "targetBlockedOutput"],
      ["validateFreshHostTerminal"],
      ["CATALOG_FAILURE_CODES_BY_STAGE", "PUBLISHED_DIRECTORY", "catalogFailureTerminal", "catalogStep", "installFreshCatalog", "preserveCatalogFailure"]
    ]);
    const imageContracts = [
      { name: "candidateIdentity", artifact: "identity-r11-image.tar", image: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e", imageId: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748", sourceDigest: "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7", releaseLabel: "candidate-only-2a1147346c5e", user: "node" },
      { name: "rollbackIdentity", artifact: "identity-19a-rollback-image.tar", image: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392", imageId: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567", sourceDigest: "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c", releaseLabel: "workflow-reviewer-service-identity-candidate-2026-08-08", user: "node" },
      { name: "active7Admin", artifact: "admin-active7-image.tar", image: "zhenxing-ai/admin:0.1.40-src-186ff057efd3", imageId: "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd", sourceDigest: "186ff057efd317b5b54af564e22c7cf3e3eac0f8af62b18dd48defc2d719f6e9", releaseLabel: "0.1.40", user: "node" },
      { name: "rollbackAdmin", artifact: "admin-old-b6ea4c5bd0e9.tar", image: "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9", imageId: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2", sourceDigest: "b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de", releaseLabel: "0.1.40", user: "node" },
      { name: "flarum", artifact: "flarum-8b13962a36bf.tar", image: "zhenxing-ai/flarum:community-candidate-8b13962a36bf", imageId: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12", sourceDigest: "8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6", releaseLabel: "0.1.40", user: "" }
    ];
    const imageArchiveClosures = {};
    for (const contract of imageContracts) {
      assert.notEqual(inner(`docker image inspect '${contract.image}' >/dev/null 2>&1`).status, 0, `${contract.name} unexpectedly existed before its archive load`);
      must(inner(`docker load -i '/opt/zhenxing-ai/releases/community-production-success01/artifacts/${contract.artifact}'`), `load ${contract.name} image archive`);
      const inspect = JSON.parse(must(inner(`docker image inspect --format '{{json .}}' '${contract.image}'`), `inspect ${contract.name} image`).stdout);
      imageArchiveClosures[contract.name] = assertImageClosure(inspect, contract);
    }
    assert.throws(() => assertImageClosure(
      JSON.parse(must(inner("docker image inspect --format '{{json .}}' 'zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392'"), "read rollback Identity for malicious expectation").stdout),
      { ...imageContracts[1], imageId: `sha256:${"0".repeat(64)}` }
    ), /image ID drifted/);
    const modes = must(inner("stat -c '%a|%u:%g|%h|%s|%n' /opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/caddy-entrypoint.sh /opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/Caddyfile /opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/runtime/SHASUMS256.txt /opt/zhenxing-ai/releases/community-production-success01/deployment/community-production/runtime/node-v24.18.1-linux-x64.tar.gz /opt/zhenxing-ai/releases/community-production-success01/.aihub-workflow-release-prepared.json"), "inspect prepared modes").stdout.trim().split(/\r?\n/);
    assert.match(modes[0], /^755\|1000:1000\|1\|/);
    for (const row of modes.slice(1)) assert.match(row, /^644\|1000:1000\|1\|/);
    const runtimeModes = must(inner("stat -c '%u:%g|%a|%F|%h|%s|%n' /opt/zhenxing-ai/releases/community-production-success01/.workflow-runtime /opt/zhenxing-ai/releases/community-production-success01/.workflow-runtime/node-v24.18.1-linux-x64 /opt/zhenxing-ai/releases/community-production-success01/.workflow-runtime/node-v24.18.1-linux-x64/bin /opt/zhenxing-ai/releases/community-production-success01/.workflow-runtime/node-v24.18.1-linux-x64/bin/node"), "inspect prepared runtime owner").stdout.trim().split(/\r?\n/);
    for (const row of runtimeModes.slice(0, 3)) assert.match(row, /^1000:1000\|755\|directory\|/);
    assert.match(runtimeModes[3], /^1000:1000\|555\|regular file\|1\|123656816\|/);
    report.checks.umask077Prepared = true;
    report.checks.modeEvidence = modes;
    report.checks.runtimeOwnerEvidence = runtimeModes;
    report.checks.manifestRuntimeComposeCaddy = true;
    report.checks.activationModuleClosure = activationModuleClosure;
    report.checks.freshHostShellSyntax = true;
    report.checks.freshHostModuleClosure = freshHostModuleClosure;
    report.checks.imageArchiveClosures = imageArchiveClosures;
    report.checks.wrongImageIdRejected = true;
    must(docker(["cp", `${container}:/opt/zhenxing-ai/releases/community-production-success01`, path.join(outputDirectory, "prepared-release")]), "export prepared release evidence");
    report.checks.preparedReleaseExported = true;

    report.failures.missingControl = failCase("community-production-missingcontrol01", "rm -f /opt/zhenxing-ai/staging/community-production-missingcontrol01.bundle/.aihub-workflow-release-bundle.json");
    report.failures.missingManifest = failCase("community-production-missingmanifest01", "rm -f /opt/zhenxing-ai/staging/community-production-missingmanifest01.bundle/payload/deployment/community-production/manifest.json");
    report.failures.wrongMode = failCase("community-production-wrongmode01", "sed -i 's#F\\t0755\\t1238\\t#F\\t0644\\t1238\\t#' /opt/zhenxing-ai/staging/community-production-wrongmode01.bundle/.aihub-workflow-release-bundle.tsv; chown 1000:1000 /opt/zhenxing-ai/staging/community-production-wrongmode01.bundle/.aihub-workflow-release-bundle.tsv; chmod 600 /opt/zhenxing-ai/staging/community-production-wrongmode01.bundle/.aihub-workflow-release-bundle.tsv");
    report.failures.extra = failCase("community-production-extraentry01", "printf x > /opt/zhenxing-ai/staging/community-production-extraentry01.bundle/payload/extra; chown 1000:1000 /opt/zhenxing-ai/staging/community-production-extraentry01.bundle/payload/extra; chmod 600 /opt/zhenxing-ai/staging/community-production-extraentry01.bundle/payload/extra");
    report.failures.symlink = failCase("community-production-symlink01", "rm -f /opt/zhenxing-ai/staging/community-production-symlink01.bundle/payload/deployment/community-production/Caddyfile; ln -s README.md /opt/zhenxing-ai/staging/community-production-symlink01.bundle/payload/deployment/community-production/Caddyfile");
    report.failures.hardlink = failCase("community-production-hardlink01", "ln /opt/zhenxing-ai/staging/community-production-hardlink01.bundle/payload/deployment/community-production/Caddyfile /opt/zhenxing-ai/staging/community-production-hardlink01.bundle/payload/deployment/community-production/Caddyfile.link");
    report.failures.traversal = failCase("community-production-traversal01", "printf 'F\\t0644\\t1\\t0000000000000000000000000000000000000000000000000000000000000000\\t../escape\\n' >> /opt/zhenxing-ai/staging/community-production-traversal01.bundle/.aihub-workflow-release-bundle.tsv");
    report.failures.corrupt = failCase("community-production-corrupt01", "printf x >> /opt/zhenxing-ai/staging/community-production-corrupt01.bundle/payload/deployment/community-production/Caddyfile");
    report.failures.owner = failCase("community-production-owner01", "chown 1001:1001 /opt/zhenxing-ai/staging/community-production-owner01.bundle/payload/deployment/community-production/Caddyfile");
    report.failures.existingTarget = failCase("community-production-existing01", "", { existingTarget: true });
    report.failures.rename = failCase("community-production-renamefail01", "", {
      environment: {
        AIHUB_WORKFLOW_RELEASE_PREPARE_ISOLATED_ACCEPTANCE: "1",
        AIHUB_WORKFLOW_RELEASE_PREPARE_TEST_FAIL_AT: "rename"
      }
    });
    report.checks.failureMatrix = Object.keys(report.failures).length;
    report.status = "pass";
  } catch (error) {
    report.status = "blocked";
    report.failure = { name: error?.name || "Error", message: String(error?.message || error).slice(-3000) };
    process.exitCode = 1;
  } finally {
    docker(["rm", "-f", container]);
    docker(["volume", "rm", dockerVolume]);
    fs.rmSync(temporary, { recursive: true, force: true });
    const containerRemoved = docker(["ps", "-aq", "--filter", `name=^/${container}$`]).stdout.trim() === "";
    const volumeRemoved = docker(["volume", "inspect", dockerVolume]).status !== 0;
    report.cleanup = {
      completed: containerRemoved && volumeRemoved,
      container: 0,
      volume: 0,
      serverTouched: false,
      catalogStateTouched: false
    };
    if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory, { recursive: false });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  assert.equal(report.status, "pass", report.failure?.message || "Linux release bundle gate blocked");
  process.stdout.write(`${JSON.stringify({ ok: true, reportPath, report })}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
