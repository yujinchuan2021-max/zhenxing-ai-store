"use strict";

const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const {
  localReleaseTrustFromCertificate,
  retryLocalReleaseCertificateRead
} = require("../shared/local-release-certificate.cjs");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(
  root,
  "deployment",
  "local",
  "runtime",
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
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(trust, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath,
        fingerprint256: trust.fingerprint256,
        expiresAt: trust.expiresAt
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
