"use strict";

const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");

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

const socket = tls.connect(
  {
    host: "localhost",
    port: 4443,
    servername: "localhost",
    rejectUnauthorized: false
  },
  () => {
    try {
      const certificate = socket.getPeerCertificate();
      if (
        !certificate?.raw ||
        certificate.subjectaltname !== "DNS:localhost" ||
        !/Caddy Local Authority/.test(String(certificate.issuer?.CN || "")) ||
        !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(
          certificate.fingerprint256
        )
      ) {
        throw new Error("Caddy 返回的 localhost 证书结构无效");
      }
      const now = Date.now();
      const certificateExpiry = Date.parse(certificate.valid_to);
      const expiresAt = new Date(
        Math.min(now + 7 * 24 * 60 * 60 * 1000, certificateExpiry - 60_000)
      ).toISOString();
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            origin: "https://localhost:4443",
            fingerprint256: certificate.fingerprint256,
            expiresAt
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: true,
            outputPath,
            fingerprint256: certificate.fingerprint256,
            expiresAt
          },
          null,
          2
        )}\n`
      );
    } finally {
      socket.end();
    }
  }
);
socket.setTimeout(10000, () => {
  socket.destroy(new Error("连接本地 Caddy TLS 服务超时"));
});
socket.on("error", (error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
