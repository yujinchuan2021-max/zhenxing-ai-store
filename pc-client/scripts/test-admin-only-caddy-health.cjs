"use strict";

const { execFileSync } = require("node:child_process");
const tls = require("node:tls");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const image = process.env.AIHUB_ADMIN_IMAGE || "zhenxing-ai/admin:0.1.40-src-54f084a49b74";
const caddyImage = "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
const suffix = `${process.pid}-${Date.now()}`;
const network = `aihub-caddy-health-${suffix}`;
const admin = `aihub-admin-health-${suffix}`;
const caddy = `aihub-caddy-health-${suffix}`;
const published = path.join(root, "admin", "published");
const caddyfile = path.join(root, "deployment", "admin-only", "Caddyfile");

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

function succeeds(command) {
  try {
    docker(["exec", caddy, "sh", "-c", command]);
    return true;
  } catch {
    return false;
  }
}

function request(port, host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: "127.0.0.1",
      port,
      servername: host,
      rejectUnauthorized: false
    }, () => {
      socket.write(`GET /health HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
    });
    let response = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => { response += chunk; });
    socket.once("end", () => {
      const status = /^HTTP\/1\.1 (\d{3})\b/.exec(response)?.[1];
      if (!status) reject(new Error("Caddy returned no HTTP status"));
      else resolve(Number(status));
    });
    socket.once("error", reject);
  });
}

async function main() {
  try {
  docker(["network", "create", network]);
  docker(["run", "-d", "--rm", "--name", admin, "--network", network, "--network-alias", "admin", "--read-only", "--tmpfs", "/tmp", "-e", "AIHUB_ADMIN_READ_ONLY=1", "-e", "AIHUB_ADMIN_HOST=0.0.0.0", "-e", "AIHUB_ADMIN_PORT=4173", "--mount", `type=bind,src=${published},dst=/app/admin/published,readonly`, image]);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (succeeds("node -e \"fetch('http://127.0.0.1:4173/ready').then(r=>process.exit(r.ok?0:1))\"")) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  docker(["run", "-d", "--rm", "--name", caddy, "--network", network, "-e", "AIHUB_PUBLIC_HOST=localhost", "--mount", `type=bind,src=${caddyfile},dst=/etc/caddy/Caddyfile,readonly`, "-p", "127.0.0.1::443", caddyImage]);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (succeeds("wget -q -O /dev/null http://127.0.0.1:2015/health")) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  const port = Number(docker(["port", caddy, "443/tcp"]).split(":").at(-1));
  let mismatchedPassed = false;
  try {
    mismatchedPassed = String(await request(port, "wrong.example")).startsWith("2");
  } catch {}
  if (mismatchedPassed) {
    throw new Error("mismatched Caddy health Host/SNI unexpectedly passed");
  }
  if (await request(port, "localhost") !== 200) {
    throw new Error("configured Caddy health Host did not pass");
  }
  if (!succeeds("wget -q -O /dev/null http://127.0.0.1:2015/health")) {
    throw new Error("private Caddy health listener did not pass");
  }
  process.stdout.write("admin-only Caddy health contract passed\n");
  } finally {
    for (const name of [caddy, admin]) {
      try { docker(["rm", "-f", name]); } catch {}
    }
    try { docker(["network", "rm", network]); } catch {}
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
