"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const caddyImage = "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
const adminImage = "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9";
const nodeImage = "node:22-alpine";

function docker(args, { input, allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    input,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

function uniqueName(suffix) {
  return `aihub-caddy-secret-${process.pid}-${Date.now()}-${suffix}`.toLowerCase();
}

function waitFor(check, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = check();
    if (last.ok) return last.value;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`timeout: ${last?.value || "condition not met"}`);
}

test("Caddy consumes a stdin-seeded managed-volume secret, drops privileges, and preserves the exact CMS gate", { timeout: 120_000 }, async () => {
  const names = {
    network: uniqueName("net"),
    caddy: uniqueName("caddy"),
    admin: uniqueName("admin"),
    community: uniqueName("community"),
    rootSecrets: uniqueName("root-secrets"),
    caddySecret: uniqueName("caddy-secret"),
    adminSecrets: uniqueName("admin-secrets"),
    caddyData: uniqueName("data"),
    caddyConfig: uniqueName("config")
  };
  const gatewaySecret = "test-cms-gateway-0123456789abcdef0123456789";
  const managementSecret = "test-community-management-0123456789abcdef";
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-caddy-secret-"));
  const mockPath = path.join(temp, "community-mock.cjs");
  const clientPath = path.join(temp, "client.cjs");
  const createdContainers = [];
  const createdVolumes = [];
  let createdNetwork = false;

  fs.writeFileSync(mockPath, `
const http = require("node:http");
const expected = process.env.TEST_MANAGEMENT_SECRET;
const summary = {
  status: "ready", health: "ready",
  users: { status: "ready", total: 1 }, posts: { status: "ready", total: 1 },
  pending: { status: "unavailable", total: null, reason: "moderation-extension-not-configured" },
  reports: { status: "unavailable", total: null, reason: "moderation-extension-not-configured" },
  targets: { discussions: [], posts: [] },
  capabilities: { setDiscussionHidden: true, setPostHidden: true, nativeAdmin: false }
};
http.createServer((request, response) => {
  const chunks = [];
  request.on("data", chunk => chunks.push(chunk));
  request.on("end", () => {
    if (request.url !== "/aihub-community-management.php" || request.method !== "POST" || request.headers["x-aihub-community-management-secret"] !== expected) {
      response.writeHead(404, { "Content-Type": "application/json" }).end('{"error":"not found"}');
      return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const value = body.action === "list" ? summary : {
      ok: true,
      action: body.action,
      target: { type: body.action === "set-discussion-hidden" ? "discussion" : "post", id: body.discussionId || body.postId },
      hidden: body.hidden
    };
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(value));
  });
}).listen(80, "0.0.0.0");
`, "utf8");
  fs.writeFileSync(clientPath, `
const origin = "http://127.0.0.1:4174";
async function status(path, options) {
  return (await fetch("http://caddy:4174" + path, options)).status;
}
Promise.all([
  status("/api/community-management"),
  status("/api/community-management/actions", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "X-AIHub-CSRF": "1" },
    body: JSON.stringify({ action: "set-post-hidden", postId: "42", hidden: true })
  }),
  status("/api/community-management-extra"),
  status("/api/catalog", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" })
]).then(values => process.stdout.write(JSON.stringify(values)));
`, "utf8");

  try {
    docker(["network", "create", names.network]);
    createdNetwork = true;
    for (const volume of [names.rootSecrets, names.caddySecret, names.adminSecrets, names.caddyData, names.caddyConfig]) {
      docker(["volume", "create", volume]);
      createdVolumes.push(volume);
    }

    docker([
      "run", "--rm", "-i", "--user", "0:0", "-v", `${names.rootSecrets}:/seed`,
      "--entrypoint", "/bin/sh", caddyImage, "-ec",
      'umask 077; IFS= read -r value; printf "%s" "$value" > /seed/community_cms_gateway; chown 0:0 /seed/community_cms_gateway; chmod 600 /seed/community_cms_gateway'
    ], { input: `${gatewaySecret}\n` });
    const sourceSecret = docker([
      "run", "--rm", "--user", "0:0", "-v", `${names.rootSecrets}:/source:ro`,
      "--entrypoint", "/bin/sh", caddyImage, "-ec", "cat /source/community_cms_gateway"
    ]).stdout;
    const seedArgs = [
      "run", "--rm", "-i", "--user", "0:0", "-v", `${names.caddySecret}:/target`,
      "-v", `${path.join(root, "deployment", "community-production", "caddy-secret-seed.sh")}:/usr/local/bin/aihub-caddy-secret-seed:ro`,
      "--entrypoint", "/bin/sh", caddyImage, "/usr/local/bin/aihub-caddy-secret-seed"
    ];
    docker(seedArgs, { input: sourceSecret });
    const seededHash = docker(["run", "--rm", "--user", "0:0", "-v", `${names.caddySecret}:/target:ro`, "--entrypoint", "/bin/sh", caddyImage, "-ec", "sha256sum /target/community_cms_gateway | cut -d ' ' -f 1"]).stdout.trim();
    assert.notEqual(docker(seedArgs, { input: "too-short", allowFailure: true }).status, 0);
    const preservedHash = docker(["run", "--rm", "--user", "0:0", "-v", `${names.caddySecret}:/target:ro`, "--entrypoint", "/bin/sh", caddyImage, "-ec", "sha256sum /target/community_cms_gateway | cut -d ' ' -f 1; ! find /target -maxdepth 1 -name '.community_cms_gateway.tmp.*' | grep -q ."]).stdout.trim();
    assert.equal(preservedHash, seededHash);
    docker(seedArgs, { input: sourceSecret });
    assert.equal(docker(["run", "--rm", "--user", "65534:65534", "-v", `${names.rootSecrets}:/source:ro`, "--entrypoint", "/bin/sh", caddyImage, "-ec", "test ! -r /source/community_cms_gateway"]).status, 0);
    docker([
      "run", "--rm", "-i", "--user", "0:0", "-v", `${names.adminSecrets}:/seed`,
      "--entrypoint", "/bin/sh", caddyImage, "-ec",
      'umask 077; IFS= read -r gateway; IFS= read -r management; printf "%s" "$gateway" > /seed/community_cms_gateway; printf "%s" "$management" > /seed/community_management; chown 1000:1000 /seed/community_cms_gateway /seed/community_management; chmod 600 /seed/community_cms_gateway /seed/community_management'
    ], { input: `${gatewaySecret}\n${managementSecret}\n` });

    docker([
      "run", "-d", "--name", names.community, "--network", names.network, "--network-alias", "community",
      "--read-only", "--tmpfs", "/tmp", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
      "-e", `TEST_MANAGEMENT_SECRET=${managementSecret}`, "-v", `${mockPath}:/app/mock.cjs:ro`,
      nodeImage, "node", "/app/mock.cjs"
    ]);
    createdContainers.push(names.community);

    docker([
      "run", "-d", "--name", names.admin, "--network", names.network, "--network-alias", "admin",
      "--read-only", "--tmpfs", "/tmp", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
      "-e", "AIHUB_ADMIN_HOST=0.0.0.0", "-e", "AIHUB_ADMIN_PORT=4173", "-e", "AIHUB_ADMIN_READ_ONLY=1",
      "-e", "AIHUB_DISCOVERY_SCAN_INTERVAL_HOURS=0", "-e", "AIHUB_COMMUNITY_MANAGEMENT_ENABLED=1",
      "-e", "AIHUB_COMMUNITY_CMS_ORIGIN=http://127.0.0.1:4174",
      "-e", "AIHUB_COMMUNITY_CMS_SECRET_FILE=/run/secrets/community_cms_gateway",
      "-e", "AIHUB_COMMUNITY_MANAGEMENT_ORIGIN=http://community",
      "-e", "AIHUB_COMMUNITY_MANAGEMENT_SECRET_FILE=/run/secrets/community_management",
      "-v", `${names.adminSecrets}:/run/secrets:ro`, adminImage
    ]);
    createdContainers.push(names.admin);

    waitFor(() => {
      const result = docker(["run", "--rm", "--network", names.network, nodeImage, "node", "-e", "fetch('http://admin:4173/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"], { allowFailure: true });
      return { ok: result.status === 0, value: result.stderr };
    });

    docker([
      "run", "-d", "--name", names.caddy, "--network", names.network, "--network-alias", "caddy",
      "--user", "0:0", "--read-only", "--tmpfs", "/tmp", "--cap-drop", "ALL",
      "--cap-add", "CHOWN", "--cap-add", "SETGID", "--cap-add", "SETUID", "--cap-add", "NET_BIND_SERVICE",
      "--security-opt", "no-new-privileges:true",
      "--health-cmd", "wget -q -O /dev/null http://127.0.0.1:2015/health", "--health-interval", "1s", "--health-timeout", "3s", "--health-retries", "10",
      "-p", "127.0.0.1::4174",
      "-e", "AIHUB_PUBLIC_HOST=root.acceptance.test", "-e", "AIHUB_COMMUNITY_PUBLIC_HOST=community.acceptance.test",
      "-v", `${path.join(root, "deployment", "community-production", "Caddyfile")}:/etc/caddy/Caddyfile:ro`,
      "-v", `${path.join(root, "deployment", "community-production", "caddy-entrypoint.sh")}:/usr/local/bin/aihub-caddy-entrypoint:ro`,
      "-v", `${names.caddySecret}:/run/aihub-caddy-secret:ro`, "-v", `${names.caddyData}:/data`, "-v", `${names.caddyConfig}:/config`,
      "--entrypoint", "/bin/sh", caddyImage, "/usr/local/bin/aihub-caddy-entrypoint"
    ]);
    createdContainers.push(names.caddy);

    waitFor(() => {
      const result = docker(["inspect", names.caddy, "--format", "{{.State.Health.Status}}"], { allowFailure: true });
      return { ok: result.status === 0 && result.stdout.trim() === "healthy", value: result.stdout || result.stderr };
    });
    const mappedPort = Number(docker(["port", names.caddy, "4174/tcp"]).stdout.trim().split(":").at(-1));
    assert.equal(Number.isSafeInteger(mappedPort) && mappedPort > 1024 && ![4173, 4174, 80, 443].includes(mappedPort), true);
    assert.equal((await fetch(`http://127.0.0.1:${mappedPort}/api/community-management`)).status, 200);
    waitFor(() => {
      const logs = JSON.parse(docker(["inspect", names.caddy, "--format", "{{json .State.Health.Log}}"] ).stdout);
      const passing = logs.filter(entry => entry.ExitCode === 0).length;
      return { ok: passing >= 3, value: `passing healthchecks=${passing}` };
    });

    const statuses = JSON.parse(docker([
      "run", "--rm", "--network", names.network, "-v", `${clientPath}:/app/client.cjs:ro`, nodeImage, "node", "/app/client.cjs"
    ]).stdout);
    assert.deepEqual(statuses, [200, 200, 404, 503]);

    const processStatus = docker(["exec", "--user", "0:0", names.caddy, "sh", "-ec", "awk '/^Uid:|^Gid:|^CapEff:/{print}' /proc/1/status"]).stdout;
    assert.match(processStatus, /^Uid:\s+65534\s+65534\s+65534\s+65534$/m);
    assert.match(processStatus, /^Gid:\s+65534\s+65534\s+65534\s+65534$/m);
    assert.match(processStatus, /^CapEff:\s+0+$/m);

    const secretStat = docker(["exec", "--user", "0:0", names.caddy, "stat", "-c", "%u:%g:%a", "/run/aihub-caddy-secret/community_cms_gateway"]).stdout.trim();
    assert.equal(secretStat, "0:0:400");
    assert.equal(docker(["exec", "--user", "65534:65534", names.caddy, "sh", "-ec", "test ! -r /run/aihub-caddy-secret/community_cms_gateway"]).status, 0);
    docker(["exec", "--user", "0:0", names.caddy, "sh", "-ec", "test ! -e /tmp/community_cms_gateway; test ! -e /run/community_cms_gateway; test ! -e /run/aihub-community-cms-secret; ! find /run/aihub-caddy-secret -maxdepth 1 -name '.community_cms_gateway.tmp.*' | grep -q ."]);

    const inspect = docker(["inspect", names.caddy]).stdout;
    const logs = docker(["logs", "--timestamps", names.caddy]).stdout + docker(["logs", "--timestamps", names.caddy]).stderr;
    assert.equal(inspect.includes(gatewaySecret), false);
    assert.equal(inspect.includes(names.rootSecrets), false);
    assert.equal(inspect.includes(names.caddySecret), true);
    assert.equal(logs.includes(gatewaySecret), false);
  } finally {
    for (const container of createdContainers.reverse()) {
      docker(["rm", "-f", container], { allowFailure: true });
    }
    if (createdNetwork) docker(["network", "rm", names.network], { allowFailure: true });
    for (const volume of createdVolumes) docker(["volume", "rm", volume], { allowFailure: true });
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
