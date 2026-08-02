"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const tls = require("node:tls");
const {
  writeLocalReleaseTrustOverlay
} = require("../admin/local-release-deployment.cjs");
const {
  localReleaseTrustFromCertificate,
  retryLocalReleaseCertificateRead
} = require("../shared/local-release-certificate.cjs");

const root = path.resolve(__dirname, "..");
const runtimeDirectory = path.join(
  root,
  "deployment",
  "local",
  "runtime"
);
const outputPath = path.join(
  runtimeDirectory,
  "current",
  "client-config",
  "local-release-trust.json"
);
const composePath = path.join(root, "deployment", "local", "compose.yaml");
const caddyRootPath = "/data/caddy/pki/authorities/local/root.crt";

function readRootCertificate() {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      composePath,
      "exec",
      "-T",
      "release-server",
      "cat",
      caddyRootPath
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      windowsHide: true
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0 || !result.stdout.includes("BEGIN CERTIFICATE")) {
    throw new Error(
      `无法读取 Caddy 本地根证书：${String(result.stderr || "").trim()}`
    );
  }
  return result.stdout;
}

function readCertificate() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = tls.connect(
      {
        host: "localhost",
        port: 4443,
        servername: "localhost",
        rejectUnauthorized: false
      },
      () => finish(null, socket.getPeerCertificate(true))
    );
    function finish(error, certificate) {
      if (settled) return;
      settled = true;
      if (error) {
        socket.destroy();
        reject(error);
      } else {
        socket.end();
        resolve(certificate);
      }
    }
    socket.setTimeout(10000, () => {
      finish(new Error("连接本地 Caddy TLS 服务超时"));
    });
    socket.once("error", (error) => finish(error));
  });
}

async function main() {
  const certificates = await retryLocalReleaseCertificateRead({
    readCertificate: async () => ({
      certificate: await readCertificate(),
      rootCertificatePem: readRootCertificate()
    })
  });
  const trust = localReleaseTrustFromCertificate(
    certificates.certificate,
    certificates.rootCertificatePem
  );
  const persisted = writeLocalReleaseTrustOverlay({
    runtimeDirectory,
    trust
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath,
        rootFingerprint256: persisted.rootFingerprint256,
        expiresAt: persisted.expiresAt,
        staleLockCleanupPending: persisted.staleLockCleanupPending,
        activationLockCleanupPending:
          persisted.activationLockCleanupPending,
        activationLockCleanupErrorCode:
          persisted.activationLockCleanupErrorCode
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
