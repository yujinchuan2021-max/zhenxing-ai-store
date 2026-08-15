"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createPhase1Program, validateAbsentSystemdUnit } = require("./workflow-production-readonly-preflight.cjs");

const root = path.resolve(__dirname, "..");
const image = "aihub-workflow-durable-systemd-test:ubuntu24-r1";
const suffix = crypto.randomBytes(5).toString("hex");
const container = `aihub-readonly-systemd-${suffix}`;
const output = path.join(root, "output", `workflow-production-readonly-systemd-${suffix}`);
const reportPath = path.join(output, "report.json");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}

function docker(args, options) { return run("docker", args, options); }
function must(result, label) { assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`); return result; }
function inner(script) { return docker(["exec", container, "/bin/bash", "-lc", script]); }
function phase1(trace = false) { return docker(["exec", "-i", container, "/bin/bash", trace ? "-xs" : "-s"], { input: createPhase1Program() }); }

function installDockerFixture() {
  const program = `#!/bin/bash
set -euo pipefail
if [[ "\${1:-}" == --version ]]; then echo fixture; exit 0; fi
if [[ "\${1:-}" == version ]]; then echo fixture; exit 0; fi
if [[ "\${1:-}" == compose && "\${2:-}" == version ]]; then echo fixture; exit 0; fi
if [[ "\${1:-}" != inspect || "\${2:-}" != --format ]]; then exit 2; fi
format="$3"; name="$4"
case "$name" in
 zhenxing-community-production-admin-1) image='zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9'; id='sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2' ;;
 zhenxing-community-production-identity-database-1) image='postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193'; id=unused ;;
 zhenxing-community-production-identity-1) image='zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392'; id='sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567' ;;
 zhenxing-community-production-community-database-1) image='mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4'; id=unused ;;
 zhenxing-community-production-community-1) image='zhenxing-ai/flarum:community-candidate-8b13962a36bf'; id=unused ;;
 zhenxing-community-production-caddy-1) image='caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'; id=unused ;;
 *) exit 3 ;;
esac
case "$format" in '{{.State.Health.Status}}') echo healthy ;; '{{.Config.Image}}') echo "$image" ;; '{{.Image}}') echo "$id" ;; *) exit 4 ;; esac
`;
  const encoded = Buffer.from(program).toString("base64");
  must(inner(`printf '%s' '${encoded}' | base64 -d > /usr/bin/docker; chmod 0755 /usr/bin/docker`), "install fixed docker fixture");
  must(inner("mv /usr/bin/id /usr/bin/id.real; printf '%s\\n' '#!/bin/bash' 'case \"${1:-}\" in -u|-g) echo 1000 ;; *) exec /usr/bin/id.real \"$@\" ;; esac' > /usr/bin/id; chmod 0755 /usr/bin/id"), "install fixed deployment identity fixture");
}

(async () => {
  const report = { schema: "aihub-workflow-production-readonly-systemd-v1", status: "blocked", candidateOnly: true, checks: {}, cleanup: { completed: false } };
  try {
    must(docker(["image", "inspect", image]), "inspect fixed systemd image");
    must(docker(["run", "--detach", "--privileged", "--name", container, "--tmpfs", "/run", "--tmpfs", "/run/lock", image]), "start PID1 systemd fixture");
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && inner("systemctl is-system-running >/dev/null 2>&1 || [[ $(systemctl is-system-running) == degraded ]]").status !== 0) await new Promise((resolve) => setTimeout(resolve, 250));
    must(inner("getent passwd 1000 >/dev/null; mkdir -p /opt/zhenxing-ai/{releases,staging,shared/backups}; chown -R 1000:1000 /opt/zhenxing-ai"), "prepare phase1 roots");
    installDockerFixture();

    const cleanProperties = must(inner("systemctl show --property=LoadState --property=ActiveState --property=SubState zhenxing-ai-workflow-production-r11.service"), "read clean unit properties").stdout;
    assert.equal(validateAbsentSystemdUnit(cleanProperties), true);
    const clean = phase1();
    if (clean.status !== 0) {
      const traced = phase1(true);
      throw new Error(`clean PID1 systemd phase1 failed at ${String(traced.stderr || "").trim().split(/\r?\n/).at(-1) || "unknown"}`);
    }
    report.checks.clean = true;

    for (const target of ["status.json", "receipt.json", "request.json", "environment.sh"]) {
      must(inner(`mkdir -p /opt/zhenxing-ai/shared/workflow-production-r11; : > /opt/zhenxing-ai/shared/workflow-production-r11/${target}; chown -R 1000:1000 /opt/zhenxing-ai/shared/workflow-production-r11`), `seed ${target}`);
      assert.notEqual(phase1().status, 0, `${target} must make phase1 fail closed`);
      must(inner("rm -rf /opt/zhenxing-ai/shared/workflow-production-r11"), `remove ${target}`);
    }
    report.checks.controlTargetsRejected = 4;

    must(inner("mkdir -p /opt/zhenxing-ai/shared/workflow-production-r11; ln -s /tmp/missing-r11-environment /opt/zhenxing-ai/shared/workflow-production-r11/environment.sh; chown -h 1000:1000 /opt/zhenxing-ai/shared/workflow-production-r11/environment.sh"), "seed dangling environment symlink");
    assert.notEqual(phase1().status, 0, "dangling environment symlink must make phase1 fail closed");
    must(inner("rm -rf /opt/zhenxing-ai/shared/workflow-production-r11"), "remove dangling environment symlink fixture");
    report.checks.danglingControlSymlinkRejected = true;

    must(inner("printf '[Unit]\\nDescription=r11 dirty fixture\\n[Service]\\nType=oneshot\\nExecStart=/bin/true\\nRemainAfterExit=yes\\n' > /etc/systemd/system/zhenxing-ai-workflow-production-r11.service; systemctl daemon-reload"), "install dirty unit");
    assert.notEqual(phase1().status, 0, "loaded inactive unit must fail closed");
    must(inner("systemctl start zhenxing-ai-workflow-production-r11.service"), "start dirty unit");
    assert.notEqual(phase1().status, 0, "active unit must fail closed");
    must(inner("systemctl stop zhenxing-ai-workflow-production-r11.service; rm -f /etc/systemd/system/zhenxing-ai-workflow-production-r11.service; systemctl daemon-reload"), "remove dirty unit");
    report.checks.loadedAndActiveRejected = true;
    report.status = "pass";
  } catch (error) {
    report.failure = { code: "SYSTEMD_MATRIX_FAILED", message: String(error?.message || error).slice(-1000) };
    process.exitCode = 1;
  } finally {
    docker(["rm", "--force", container]);
    const residue = docker(["ps", "--all", "--quiet", "--filter", `name=^/${container}$`]).stdout.trim();
    report.cleanup = { completed: residue === "", containers: residue ? 1 : 0, networks: 0, volumes: 0 };
    fs.mkdirSync(output, { recursive: false });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  assert.equal(report.status, "pass", report.failure?.message || "systemd matrix blocked");
  assert.equal(report.cleanup.completed, true, "systemd fixture residue remains");
  process.stdout.write(`${JSON.stringify({ ok: true, reportPath })}\n`);
})().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
