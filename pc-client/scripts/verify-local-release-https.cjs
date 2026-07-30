"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const caPath = process.argv[2];
if (!caPath || !path.isAbsolute(caPath)) {
  throw new Error("必须传入 Caddy 根证书的绝对路径");
}
const ca = fs.readFileSync(caPath);
const updateEnvelope = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "deployment",
      "local",
      "runtime",
      "current",
      "public",
      "update-release.json"
    ),
    "utf8"
  )
);
const expected = updateEnvelope.payload;

function request(relativeUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      new URL(relativeUrl, "https://localhost:4443/"),
      {
        ca,
        headers
      },
      (response) => resolve(response)
    );
    request.setTimeout(15000, () => {
      request.destroy(new Error("本地 HTTPS 请求超时"));
    });
    request.on("error", reject);
  });
}

async function collect(response, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of response) {
    total += chunk.length;
    if (total > maxBytes) {
      response.destroy();
      throw new Error("HTTPS 响应超过验证上限");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function verifyJson(pathname, expectedKind) {
  const response = await request(pathname);
  if (response.statusCode !== 200) {
    throw new Error(`${pathname} 返回 ${response.statusCode}`);
  }
  if (!String(response.headers["content-type"] || "").includes("application/json")) {
    throw new Error(`${pathname} Content-Type 无效`);
  }
  const value = JSON.parse((await collect(response, 1024 * 1024)).toString("utf8"));
  if (value.kind !== expectedKind || typeof value.signature !== "string") {
    throw new Error(`${pathname} 不是签名 ${expectedKind} 发布`);
  }
  return value;
}

async function verifyArtifact() {
  const artifact = new URL(expected.downloadUrl);
  const relative = `${artifact.pathname}${artifact.search}`;
  const partial = await request(relative, { Range: "bytes=0-1023" });
  if (
    partial.statusCode !== 206 ||
    partial.headers["content-range"] !== `bytes 0-1023/${expected.fileSize}`
  ) {
    throw new Error("安装包 Range 下载响应无效");
  }
  const partialBytes = await collect(partial, 1024);
  if (partialBytes.length !== 1024) {
    throw new Error("安装包 Range 下载长度无效");
  }

  const response = await request(relative);
  if (response.statusCode !== 200) {
    throw new Error(`安装包下载返回 ${response.statusCode}`);
  }
  const hash = crypto.createHash("sha256");
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > expected.fileSize) {
      response.destroy();
      throw new Error("安装包下载超过签名大小");
    }
    hash.update(chunk);
  }
  if (size !== expected.fileSize || hash.digest("hex") !== expected.sha256) {
    throw new Error("通过 HTTPS 下载的安装包与签名清单不一致");
  }
  return { size, sha256: expected.sha256 };
}

async function main() {
  const [catalog, update, artifact] = await Promise.all([
    verifyJson("/catalog-release.json", "catalog"),
    verifyJson("/update-release.json", "update"),
    verifyArtifact()
  ]);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        tls: "validated-with-caddy-root-ca",
        catalogVersion: catalog.payload.catalogVersion,
        updateVersion: update.payload.version,
        artifact
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
