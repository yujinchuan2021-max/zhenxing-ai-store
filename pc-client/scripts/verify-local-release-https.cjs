"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const {
  verifyReleaseBundle
} = require("../admin/release-bundle-verifier.cjs");
const {
  canonicalize,
  verifySignedEnvelope
} = require("../shared/signed-release.cjs");
const {
  validateCatalogReleasePayload
} = require("../shared/catalog-release.cjs");

const root = path.resolve(__dirname, "..");
const caPath = process.argv[2];
const bundleDirectory = path.join(
  root,
  "deployment",
  "local",
  "runtime",
  "current"
);
const publicDirectory = path.join(bundleDirectory, "public");
function readLocalEnvelope(name) {
  return JSON.parse(fs.readFileSync(path.join(publicDirectory, name), "utf8"));
}
let ca;
let updateEnvelope;
let buildEnvelope;
let expected;
let releaseManifest;

function loadVerifiedLocalContext() {
  if (!caPath || !path.isAbsolute(caPath)) {
    throw new Error("必须传入 Caddy 根证书的绝对路径");
  }
  verifyReleaseBundle({ bundleDirectory, allowLocalRuntimeTrust: true });
  ca = fs.readFileSync(caPath);
  updateEnvelope = readLocalEnvelope("update-release.json");
  buildEnvelope = readLocalEnvelope("build-provenance.json");
  expected = updateEnvelope.payload;
  releaseManifest = JSON.parse(
    fs.readFileSync(path.join(publicDirectory, "release-manifest.json"), "utf8")
  );
}

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

function verifyRemoteEnvelope(
  value,
  { pathname, expectedKind, trustedKeys, expectedEnvelope }
) {
  verifySignedEnvelope(value, { kind: expectedKind, trustedKeys });
  if (
    expectedEnvelope &&
    canonicalize(value) !== canonicalize(expectedEnvelope)
  ) {
    throw new Error(`${pathname} 与本地已验证发布内容不一致`);
  }
  return value;
}

async function verifyJson(
  pathname,
  expectedKind,
  trustedKeys,
  expectedEnvelope
) {
  const response = await request(pathname);
  if (response.statusCode !== 200) {
    throw new Error(`${pathname} 返回 ${response.statusCode}`);
  }
  if (!String(response.headers["content-type"] || "").includes("application/json")) {
    throw new Error(`${pathname} Content-Type 无效`);
  }
  const value = JSON.parse((await collect(response, 1024 * 1024)).toString("utf8"));
  return verifyRemoteEnvelope(value, {
    pathname,
    expectedKind,
    trustedKeys,
    expectedEnvelope
  });
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
  loadVerifiedLocalContext();
  const [catalog, update, build, artifact] = await Promise.all([
    verifyJson(
      "/catalog-release.json",
      "catalog",
      [releaseManifest.signingKeys.catalog],
      null
    ),
    verifyJson(
      "/update-release.json",
      "update",
      [releaseManifest.signingKeys.update],
      updateEnvelope
    ),
    verifyJson(
      "/build-provenance.json",
      "build-provenance",
      [releaseManifest.signingKeys.update],
      buildEnvelope
    ),
    verifyArtifact()
  ]);
  const catalogPayload = validateCatalogReleasePayload(catalog.payload);
  if (catalogPayload.catalogVersion < releaseManifest.catalog.catalogVersion) {
    throw new Error("HTTPS 后台目录版本低于发布包基线");
  }
  if (
    build.payload?.version !== update.payload.version ||
    build.payload?.source?.revision !== releaseManifest.build?.source?.revision
  ) {
    throw new Error("HTTPS 构建来源证明与发布清单不一致");
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        tls: "validated-with-caddy-root-ca",
        catalogVersion: catalogPayload.catalogVersion,
        updateVersion: update.payload.version,
        sourceRevision: build.payload.source.revision,
        artifact
      },
      null,
      2
    )}\n`
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  verifyRemoteEnvelope
};
