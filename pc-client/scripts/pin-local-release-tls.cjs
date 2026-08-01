"use strict";

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
      () => finish(null, socket.getPeerCertificate())
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
  const certificate = await retryLocalReleaseCertificateRead({
    readCertificate
  });
  const trust = localReleaseTrustFromCertificate(certificate);
  const persisted = writeLocalReleaseTrustOverlay({
    runtimeDirectory,
    trust
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath,
        fingerprint256: persisted.fingerprint256,
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
