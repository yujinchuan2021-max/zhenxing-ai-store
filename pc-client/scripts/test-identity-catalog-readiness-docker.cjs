"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  catalogReadinessProbeProgram
} = require("../deployment/community-production/workflow-production-temporary-acceptance.cjs");

const root = path.resolve(__dirname, "..");
const image = process.argv[2];
if (!image || !/^zhenxing-ai\/identity:[a-z0-9][a-z0-9._-]{0,127}$/i.test(image)) {
  throw new Error("usage: node scripts/test-identity-catalog-readiness-docker.cjs <candidate-image>");
}

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(port, method, pathname, value) {
  return new Promise((resolve, reject) => {
    const encoded = value === undefined ? null : Buffer.from(JSON.stringify(value));
    const req = http.request({
      host: "127.0.0.1",
      port,
      path: pathname,
      method,
      agent: false,
      headers: encoded ? { "content-type": "application/json", "content-length": encoded.length } : {}
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: response.statusCode, body: text ? JSON.parse(text) : {} });
      });
    });
    req.setTimeout(2_500, () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (encoded) req.end(encoded);
    else req.end();
  });
}

async function waitFor(check, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await check();
      if (last) return last;
    } catch (error) {
      last = error.message;
    }
    await sleep(200);
  }
  throw new Error(`${message}: ${JSON.stringify(last)}`);
}

function hostPort(name) {
  const output = run(["port", name, "4180/tcp"]).stdout.trim();
  const match = output.match(/127\.0\.0\.1:(\d+)$/m);
  if (!match) throw new Error(`unable to resolve fixture port: ${output}`);
  return Number(match[1]);
}

async function start(name, mode, releasePath, fixturePath, highestCatalogVersion, highestCatalogSha256 = "") {
  run([
    "run", "-d", "--name", name,
    "--cpus", "0.35",
    "-e", `FIXTURE_CATALOG_MODE=${mode}`,
    "-e", `FIXTURE_HIGHEST_CATALOG_VERSION=${highestCatalogVersion}`,
    "-e", `FIXTURE_HIGHEST_CATALOG_SHA256=${highestCatalogSha256}`,
    "-v", `${releasePath}:/fixture/release.json:ro`,
    "-v", `${fixturePath}:/fixture/readiness-fixture.cjs:ro`,
    "-p", "127.0.0.1::4180",
    "--health-cmd", "node -e \"const r=require('http').get({host:'127.0.0.1',port:4180,path:'/health',agent:false},x=>{x.resume();process.exit(x.statusCode===200?0:1)});r.setTimeout(1000,()=>{r.destroy();process.exit(1)});r.on('error',()=>process.exit(1))\"",
    "--health-interval", "1s", "--health-timeout", "2s", "--health-retries", "10",
    "--entrypoint", "node", image, "/fixture/readiness-fixture.cjs"
  ]);
  const port = hostPort(name);
  await waitFor(async () => (await request(port, "GET", "/health")).status === 200, 10_000, "fixture health");
  return port;
}

function exactCapability(value, enabled) {
  assert.deepEqual(value, {
    enabled,
    schemaVersion: 1,
    execution: false,
    workflowSubmissionLookup: enabled
  });
}

function execCapability(name) {
  const program = "fetch('http://127.0.0.1:4180/v1/community/workflow-store/capability',{headers:{accept:'application/json'}}).then(async r=>process.stdout.write(JSON.stringify({status:r.status,body:await r.json()}))).catch(()=>process.exit(2))";
  const result = run(["exec", name, "node", "-e", program]);
  return JSON.parse(result.stdout);
}

async function assertLegacyThenPersistentProcessModel(legacyName, persistentName, releasePath, fixturePath, version) {
  await start(legacyName, "fail", releasePath, fixturePath, version - 1);
  const legacy = [];
  for (let index = 0; index < 3; index += 1) legacy.push(execCapability(legacyName));
  await request(hostPort(legacyName), "POST", "/mode/success");
  legacy.push(execCapability(legacyName));
  await waitFor(async () => (await request(hostPort(legacyName), "GET", "/metrics")).body.readiness.ready === true, 8_000, "legacy fifth process readiness");
  legacy.push(execCapability(legacyName));
  legacy.slice(0, 4).forEach((entry) => {
    assert.equal(entry.status, 200);
    exactCapability(entry.body, false);
  });
  assert.equal(legacy[4].status, 200);
  exactCapability(legacy[4].body, true);

  await start(persistentName, "manual", releasePath, fixturePath, version - 1);
  const persistent = JSON.parse(run([
    "exec", "-i", persistentName, "node", "-e", catalogReadinessProbeProgram()
  ]).stdout);
  assert.equal(persistent.status, 200);
  assert.equal(persistent.enabled, true);
  assert.ok(persistent.attemptCount >= 5);
  assert.deepEqual(Object.keys(persistent).sort(), ["attemptCount", "enabled", "status"]);
  return {
    legacy: { processCount: 5, firstFourExactNotReady: true, fifthExactReady: true },
    persistent: { processCount: 1, exactReady: true, attemptCount: persistent.attemptCount }
  };
}

async function assertColdThenReady(port, prefix) {
  const capability = await request(port, "GET", "/capability");
  assert.equal(capability.status, 200);
  exactCapability(capability.body, false);

  const cold = await Promise.all([1, 2, 3].map((index) => request(port, "POST", "/create", {
    canonicalId: "comfy-desktop",
    idempotencyKey: `${prefix}-cold-${index}`
  })));
  assert.deepEqual(cold.map((entry) => entry.status), [503, 503, 503]);
  assert.equal(cold.every((entry) => entry.body.error.code === "TEMPORARILY_UNAVAILABLE"), true);
  const loading = await request(port, "GET", "/metrics");
  assert.equal(loading.body.fetchCount, 1);
  assert.equal(["loading", "ready"].includes(loading.body.readiness.status), true);

  await waitFor(async () => {
    const result = await request(port, "GET", "/metrics");
    return result.body.readiness.ready === true ? result : null;
  }, 8_000, "signed projection readiness");
  const missing = await request(port, "POST", "/create", {
    canonicalId: "does-not-exist",
    idempotencyKey: `${prefix}-missing`
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, "INVALID_INPUT");
  const ready = await request(port, "POST", "/create", {
    canonicalId: "comfy-desktop",
    idempotencyKey: `${prefix}-ready`
  });
  assert.equal(ready.status, 201, JSON.stringify(ready));
  const metrics = await request(port, "GET", "/metrics");
  assert.equal(metrics.body.fetchCount, 1);
  return {
    capabilityEnabledBeforeReady: capability.body.enabled,
    concurrentColdStatuses: cold.map((entry) => entry.status),
    fetchCount: metrics.body.fetchCount,
    readyStatus: ready.status,
    missingStatus: missing.status
  };
}

async function assertFailureRecovery(port, prefix) {
  const capability = await request(port, "GET", "/capability");
  assert.equal(capability.status, 200);
  exactCapability(capability.body, false);
  const unavailable = await request(port, "POST", "/create", {
    canonicalId: "comfy-desktop",
    idempotencyKey: `${prefix}-cold`
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error.code, "TEMPORARILY_UNAVAILABLE");
  await request(port, "POST", "/mode/success");
  const metrics = await waitFor(async () => {
    const result = await request(port, "GET", "/metrics");
    return result.body.readiness.ready === true ? result : null;
  }, 8_000, `${prefix} recovery readiness`);
  const recovered = await request(port, "POST", "/create", {
    canonicalId: "comfy-desktop",
    idempotencyKey: `${prefix}-recovered`
  });
  assert.equal(recovered.status, 201);
  const readyCapability = await request(port, "GET", "/capability");
  exactCapability(readyCapability.body, true);
  return { unavailableStatus: unavailable.status, recoveredStatus: recovered.status, fetchCount: metrics.body.fetchCount, exactRecovered: true };
}

async function assertPermanentFailure(port, prefix) {
  const capability = await request(port, "GET", "/capability");
  assert.equal(capability.status, 200);
  exactCapability(capability.body, false);
  const unavailable = await request(port, "POST", "/create", {
    canonicalId: "comfy-desktop",
    idempotencyKey: `${prefix}-cold`
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error.code, "TEMPORARILY_UNAVAILABLE");
  const metrics = await request(port, "GET", "/metrics");
  assert.equal(metrics.body.fetchCount >= 1, true);
  return { capabilityExactNotReady: true, ownerStatus: 503, fetchCount: metrics.body.fetchCount };
}

async function main() {
  const state = JSON.parse(fs.readFileSync(path.join(root, "admin", "published", "catalog-store", "state.json"), "utf8"));
  const releaseEntry = state.history.find((entry) => entry.releaseId === state.activeReleaseId);
  if (!releaseEntry) throw new Error("active signed Admin release is missing");
  const releasePath = path.join(root, "admin", "published", "catalog-store", "releases", releaseEntry.fileName);
  const fixturePath = path.join(root, "scripts", "fixtures", "identity-catalog-readiness-docker.cjs");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const suffix = crypto.randomBytes(4).toString("hex");
  const evidenceDir = path.join(root, "output", `identity-catalog-readiness-docker-${stamp}-${suffix}`);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const names = [
    `aihub-readiness-${suffix}`,
    `aihub-readiness-network-${suffix}`,
    `aihub-readiness-signature-${suffix}`,
    `aihub-readiness-highwater-${suffix}`,
    `aihub-readiness-sha-${suffix}`,
    `aihub-readiness-legacy-${suffix}`,
    `aihub-readiness-persistent-${suffix}`
  ];
  const imageInspect = JSON.parse(run(["image", "inspect", image]).stdout)[0];
  const report = {
    candidateOnly: true,
    deployable: false,
    cpuLimit: "0.35",
    imageId: imageInspect.Id,
    sourceDigest: imageInspect.Config.Labels["com.aihub.source-content-sha256"],
    releaseSha256: crypto.createHash("sha256").update(fs.readFileSync(releasePath)).digest("hex"),
    scenarios: {}
  };
  try {
    let port = await start(names[0], "delayed", releasePath, fixturePath, releaseEntry.catalogVersion - 1);
    const coldResult = await assertColdThenReady(port, "boot");
    await sleep(3_200);
    let inspect = JSON.parse(run(["inspect", names[0]]).stdout)[0];
    assert.equal(inspect.State.Health.Status, "healthy");
    assert.equal(inspect.State.Health.Log.filter((entry) => entry.ExitCode === 0).length >= 3, true);
    report.scenarios.coldAndConcurrent = {
      pass: true,
      ...coldResult,
      healthStatus: inspect.State.Health.Status,
      successfulHealthChecks: inspect.State.Health.Log.filter((entry) => entry.ExitCode === 0).length
    };

    run(["restart", names[0]]);
    port = hostPort(names[0]);
    await waitFor(async () => (await request(port, "GET", "/health")).status === 200, 10_000, "restart health");
    const restartResult = await assertColdThenReady(port, "restart");
    inspect = JSON.parse(run(["inspect", names[0]]).stdout)[0];
    report.scenarios.restart = {
      pass: true,
      ...restartResult,
      healthStatus: inspect.State.Health.Status,
      successfulHealthChecks: inspect.State.Health.Log.filter((entry) => entry.ExitCode === 0).length
    };

    const failurePort = await start(names[1], "fail", releasePath, fixturePath, releaseEntry.catalogVersion - 1);
    report.scenarios.networkFailureRecovery = {
      pass: true,
      ...(await assertFailureRecovery(failurePort, "network"))
    };
    const signaturePort = await start(names[2], "bad-signature", releasePath, fixturePath, releaseEntry.catalogVersion - 1);
    report.scenarios.signatureFailureRecovery = {
      pass: true,
      ...(await assertFailureRecovery(signaturePort, "signature"))
    };
    const highWaterPort = await start(names[3], "delayed", releasePath, fixturePath, releaseEntry.catalogVersion + 1);
    report.scenarios.highWaterRollback = { pass: true, ...(await assertPermanentFailure(highWaterPort, "high-water")) };
    const shaPort = await start(names[4], "delayed", releasePath, fixturePath, releaseEntry.catalogVersion, "0".repeat(64));
    report.scenarios.sameVersionShaMismatch = { pass: true, ...(await assertPermanentFailure(shaPort, "same-version-sha")) };
    report.scenarios.processModel = {
      pass: true,
      ...(await assertLegacyThenPersistentProcessModel(names[5], names[6], releasePath, fixturePath, releaseEntry.catalogVersion))
    };

    report.ok = true;
  } finally {
    for (const name of names) run(["rm", "-f", name], { allowFailure: true });
    report.cleaned = names.every((name) => run(["inspect", name], { allowFailure: true }).status !== 0);
    const encoded = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(path.join(evidenceDir, "report.json"), encoded);
    fs.writeFileSync(path.join(evidenceDir, "report.sha256"), `${crypto.createHash("sha256").update(encoded).digest("hex")}  report.json\n`);
    process.stdout.write(`${evidenceDir}\n`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
