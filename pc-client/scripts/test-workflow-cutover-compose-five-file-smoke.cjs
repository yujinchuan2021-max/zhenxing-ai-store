"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const composeHelper = path.join(deployment, "workflow-cutover-compose-files.sh");
const emergencyDisable = path.join(deployment, "workflow-production-emergency-disable.sh");
const bash = "C:\\Program Files\\Git\\bin\\bash.exe";
const suffix = crypto.randomBytes(5).toString("hex");
const project = `aihub-wf-cutover-${suffix}`;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-wf-cutover-compose-"));
const reportDirectory = path.join(
  root,
  "output",
  `workflow-cutover-compose-five-file-smoke-${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${suffix}`
);
const report = { candidateOnly: true, deployable: false, project, checks: {} };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, ...options });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function docker(args, options = {}) {
  return run("docker", args, options);
}

function writeFile(filename, source) {
  fs.writeFileSync(filename, source, "utf8");
  fs.chmodSync(filename, 0o644);
}

function toBashPath(filename) {
  const result = run(bash, ["-lc", 'cygpath -u "$1"', "bash", filename]);
  return result.stdout.trim();
}

async function reserveLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHttp(port, expectedStatus = 200) {
  const deadline = Date.now() + 30_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const status = await new Promise((resolve, reject) => {
        const request = http.get(
          { host: "127.0.0.1", port, path: "/health", timeout: 2000, agent: false },
          (response) => {
            response.resume();
            response.on("end", () => resolve(response.statusCode));
          }
        );
        request.on("timeout", () => request.destroy(new Error("timeout")));
        request.on("error", reject);
      });
      if (status === expectedStatus) return;
      lastError = new Error(`status ${status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error("HTTP probe timed out");
}

function composeArgs(files) {
  return ["compose", "-p", project, ...files.flatMap((file) => ["-f", file])];
}

function inspectService(files) {
  const id = docker([...composeArgs(files), "ps", "-q", "identity"]).stdout.trim();
  assert.notEqual(id, "", "identity container is missing");
  return JSON.parse(docker(["inspect", id]).stdout)[0];
}

function assertLoopbackPort(inspect, port) {
  const hostConfig = inspect.HostConfig.PortBindings["8080/tcp"];
  const network = inspect.NetworkSettings.Ports["8080/tcp"];
  assert.equal(hostConfig.length, 1);
  assert.equal(network.length, 1);
  assert.equal(hostConfig[0].HostIp, "127.0.0.1");
  assert.equal(network[0].HostIp, "127.0.0.1");
  assert.equal(hostConfig[0].HostPort, String(port));
  assert.equal(network[0].HostPort, String(port));
}

function assertEventVolume(inspect, expectedSource) {
  const mount = inspect.Mounts.find((candidate) => candidate.Destination === "/state");
  assert.ok(mount, "identity event volume is missing");
  assert.equal(mount.Type, "volume");
  assert.equal(mount.Name.endsWith("_community_acceptance_database"), true);
  if (expectedSource) assert.equal(mount.Source, expectedSource);
  return mount.Source;
}

function assertIdentityMode(inspect, enabled) {
  assert.equal(
    inspect.Config.Env.includes(`AIHUB_WORKFLOW_STORE_ENABLED:${enabled ? "1" : "0"}`),
    false,
    "compose must pass normal environment entries"
  );
  assert.equal(inspect.Config.Env.includes(`AIHUB_WORKFLOW_STORE_ENABLED=${enabled ? "1" : "0"}`), true);
}

function writeComposeFiles(port) {
  const acceptanceRoot = path.join(scratch, "acceptance");
  fs.mkdirSync(acceptanceRoot);
  const files = {
    base: path.join(scratch, "compose.server.yaml"),
    production: path.join(scratch, "compose.workflow-production.yaml"),
    windows: path.join(acceptanceRoot, "compose.windows-acceptance.yaml"),
    ports: path.join(acceptanceRoot, "ports.override.yaml"),
    caddy: path.join(acceptanceRoot, "caddy.override.yaml"),
    rollback: path.join(scratch, "rollback-identity.yaml"),
    list: path.join(scratch, "compose-files.list"),
    acceptanceRoot
  };
  writeFile(files.base, `services:
  identity:
    image: node:24-alpine
    volumes:
      - community_acceptance_database:/state
    command:
      - node
      - -e
      - |
        const http = require('http');
        http.createServer((request, response) => {
          response.writeHead(request.url === '/health' ? 200 : 404);
          response.end(request.url === '/health' ? 'ok' : 'not found');
        }).listen(8080, '0.0.0.0');
    healthcheck:
      test: ["CMD", "node", "-e", "const req=require('http').get({host:'127.0.0.1',port:8080,path:'/health',agent:false},res=>{res.resume();process.exit(res.statusCode===200?0:1)});req.setTimeout(2000,()=>{req.destroy();process.exit(1)});req.on('error',()=>process.exit(1))"]
      interval: 1s
      timeout: 3s
      retries: 30
`);
  writeFile(files.production, `services:
  identity:
    environment:
      AIHUB_WORKFLOW_PRODUCTION_OVERLAY: "1"
      AIHUB_WORKFLOW_STORE_ENABLED: "1"
`);
  writeFile(files.windows, `services:
  identity:
    labels:
      aihub.workflow.windows-acceptance: "1"
volumes:
  community_acceptance_database:
    name: ${project}_community_acceptance_database
`);
  writeFile(files.ports, `services:
  identity:
    ports:
      - "127.0.0.1:${port}:8080"
`);
  writeFile(files.caddy, `services:
  identity:
    labels:
      aihub.workflow.caddy-acceptance: "1"
`);
  writeFile(files.rollback, `services:
  identity:
    environment:
      AIHUB_WORKFLOW_PRODUCTION_OVERLAY: "0"
      AIHUB_WORKFLOW_ROLLBACK: "1"
`);
  const bashPaths = {
    base: toBashPath(files.base),
    production: toBashPath(files.production),
    windows: toBashPath(files.windows),
    ports: toBashPath(files.ports),
    caddy: toBashPath(files.caddy),
    list: toBashPath(files.list),
    acceptanceRoot: toBashPath(files.acceptanceRoot)
  };
  fs.writeFileSync(
    files.list,
    `${bashPaths.base}\n${bashPaths.production}\n${bashPaths.windows}\n${bashPaths.ports}\n${bashPaths.caddy}\n`,
    "utf8"
  );
  fs.chmodSync(files.list, 0o644);
  return { files, bashPaths };
}

function runEmergencyDisable(bashPaths, evidence) {
  return run(
    bash,
    [
      toBashPath(emergencyDisable),
      bashPaths.base,
      bashPaths.production,
      toBashPath(evidence)
    ],
    {
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: project,
        AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
        AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: bashPaths.list,
        AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: bashPaths.acceptanceRoot
      }
    }
  );
}

function verifyHelperAcceptsList(bashPaths) {
  const result = run(
    bash,
    [
      "-lc",
      'source "$1"; resolve_workflow_cutover_compose_files "$2" "$3"; printf "%s\\n" "${workflow_cutover_compose_files[@]}"',
      "bash",
      composeHelper,
      bashPaths.base,
      bashPaths.production
    ],
    {
      env: {
        ...process.env,
        AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1",
        AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_FILES: bashPaths.list,
        AIHUB_WORKFLOW_PRODUCTION_ACCEPTANCE_COMPOSE_ROOT: bashPaths.acceptanceRoot
      }
    }
  );
  assert.deepEqual(
    result.stdout.trim().split(/\r?\n/),
    [bashPaths.base, bashPaths.production, bashPaths.windows, bashPaths.ports, bashPaths.caddy]
  );
}

async function main() {
  fs.mkdirSync(reportDirectory, { recursive: true });
  try {
    docker(["image", "inspect", "node:24-alpine"]);
    const port = await reserveLoopbackPort();
    const { files, bashPaths } = writeComposeFiles(port);
    verifyHelperAcceptsList(bashPaths);
    report.checks.helper = "pass";

    const activeFiles = [files.base, files.production, files.windows, files.ports, files.caddy];
    const rollbackFiles = [files.base, files.rollback, files.windows, files.ports, files.caddy];
    docker([...composeArgs(activeFiles), "config"], { allowFailure: false });
    docker([...composeArgs(activeFiles), "up", "-d", "--wait"]);
    await waitForHttp(port);
    const initialInspect = inspectService(activeFiles);
    assertLoopbackPort(initialInspect, port);
    assertIdentityMode(initialInspect, true);
    const eventVolumeSource = assertEventVolume(initialInspect);
    docker([...composeArgs(activeFiles), "exec", "-T", "identity", "sh", "-ec", "printf '%s' workflow-event > /state/events.json"]);
    report.checks.initial = "pass";

    docker([...composeArgs(activeFiles), "restart", "identity"]);
    await waitForHttp(port);
    assertLoopbackPort(inspectService(activeFiles), port);
    report.checks.restart = "pass";

    docker([...composeArgs(activeFiles), "up", "-d", "--force-recreate", "--no-deps", "identity"]);
    await waitForHttp(port);
    assertLoopbackPort(inspectService(activeFiles), port);
    report.checks.recreate = "pass";

    docker([...composeArgs(rollbackFiles), "up", "-d", "--no-build", "identity"]);
    await waitForHttp(port);
    const rollbackInspect = inspectService(rollbackFiles);
    assertLoopbackPort(rollbackInspect, port);
    assert.equal(rollbackInspect.Config.Env.includes("AIHUB_WORKFLOW_ROLLBACK=1"), true);
    report.checks.rollback = "pass";

    const disableEvidence = path.join(scratch, "emergency-disable-evidence");
    runEmergencyDisable(bashPaths, disableEvidence);
    await waitForHttp(port);
    const disabledInspect = inspectService(activeFiles);
    assertLoopbackPort(disabledInspect, port);
    assertIdentityMode(disabledInspect, false);
    assert.equal(assertEventVolume(disabledInspect, eventVolumeSource), eventVolumeSource);
    const retainedEvent = docker([...composeArgs(activeFiles), "exec", "-T", "identity", "cat", "/state/events.json"]).stdout;
    assert.equal(retainedEvent, "workflow-event");
    report.checks.emergencyDisable = "pass";

    docker([...composeArgs(activeFiles), "up", "-d", "--no-build", "--force-recreate", "identity"]);
    await waitForHttp(port);
    const reenabedInspect = inspectService(activeFiles);
    assertLoopbackPort(reenabedInspect, port);
    assertIdentityMode(reenabedInspect, true);
    assert.equal(assertEventVolume(reenabedInspect, eventVolumeSource), eventVolumeSource);
    const reenabledEvent = docker([...composeArgs(activeFiles), "exec", "-T", "identity", "cat", "/state/events.json"]).stdout;
    assert.equal(reenabledEvent, "workflow-event");
    report.checks.reenable = "pass";
    report.port = port;
    report.ok = true;
  } finally {
    docker(["compose", "-p", project, "down", "--remove-orphans", "--volumes"], { allowFailure: true });
    const ps = docker(["ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}"], { allowFailure: true }).stdout.trim();
    report.cleaned = ps === "";
    const encoded = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(path.join(reportDirectory, "report.json"), encoded);
    fs.writeFileSync(
      path.join(reportDirectory, "report.sha256"),
      `${crypto.createHash("sha256").update(encoded).digest("hex")}  report.json\n`
    );
    fs.rmSync(scratch, { recursive: true, force: true });
    process.stdout.write(`${reportDirectory}\n`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
