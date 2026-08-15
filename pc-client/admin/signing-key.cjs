"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertCatalogSigningKeyAllowed } = require("../shared/catalog-key-retirement.cjs");

function normalizePublicKeyMetadata(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, "keyId") ||
    !Object.hasOwn(value, "publicKey") ||
    typeof value.keyId !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value.keyId) ||
    typeof value.publicKey !== "string" ||
    !value.publicKey ||
    Buffer.from(value.publicKey, "base64").toString("base64") !== value.publicKey
  ) {
    throw new Error("CATALOG_SIGNING_PUBLIC_METADATA_INVALID");
  }
  return { keyId: value.keyId, publicKey: value.publicKey };
}

function publicKeyRecord(privateKey, keyIdPrefix = "catalog") {
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(keyIdPrefix)) {
    throw new Error("发布签名密钥前缀无效");
  }
  const publicKey = crypto.createPublicKey(privateKey);
  if (
    privateKey.asymmetricKeyType !== "ed25519" ||
    publicKey.asymmetricKeyType !== "ed25519"
  ) {
    throw new Error("目录发布密钥必须使用 Ed25519");
  }
  const encoded = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  const fingerprint = crypto
    .createHash("sha256")
    .update(Buffer.from(encoded, "base64"))
    .digest("hex")
    .slice(0, 16);
  return {
    keyId: `${keyIdPrefix}-${fingerprint}`,
    publicKey: encoded
  };
}

function loadSigningKey({
  dataDirectory,
  env = process.env,
  requireEnvironment = false,
  environmentVariable = "AIHUB_CATALOG_SIGNING_PRIVATE_KEY",
  keyMetadata = null,
  openPrivateKey = null,
  parsePrivateKey = crypto.createPrivateKey
}) {
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(environmentVariable)) {
    throw new Error("签名私钥环境变量名无效");
  }
  const keyIdPrefix = environmentVariable.includes("UPDATE") ? "update" : "catalog";
  const metadata = keyMetadata === null ? null : normalizePublicKeyMetadata(keyMetadata);
  if (metadata && keyIdPrefix === "catalog") {
    assertCatalogSigningKeyAllowed(metadata.keyId, "sign");
  }
  const keyPath = path.join(dataDirectory, "catalog-signing-private.pem");
  const configuredPropertyPresent = Object.prototype.hasOwnProperty.call(env, environmentVariable);
  if (keyIdPrefix === "catalog" && !metadata && (configuredPropertyPresent || fs.existsSync(keyPath))) {
    throw new Error("CATALOG_SIGNING_PUBLIC_METADATA_REQUIRED");
  }
  const configured = String(env[environmentVariable] || "").trim();
  let privateKey;
  let source;
  if (configured) {
    const material = typeof openPrivateKey === "function"
      ? openPrivateKey({ source: "environment", environmentVariable })
      : configured.replaceAll("\\n", "\n");
    privateKey = parsePrivateKey(material);
    source = "environment";
  } else {
    if (requireEnvironment) {
      throw new Error(
        `生产发布必须通过 ${environmentVariable} 注入 Ed25519 私钥`
      );
    }
    try {
      const material = typeof openPrivateKey === "function"
        ? openPrivateKey({ source: "local-development", keyPath })
        : fs.readFileSync(keyPath, "utf8");
      privateKey = parsePrivateKey(material);
      source = "local-development";
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw new Error(`无法读取目录发布密钥：${error.message}`);
      }
      const pair = crypto.generateKeyPairSync("ed25519");
      const pem = pair.privateKey.export({
        format: "pem",
        type: "pkcs8"
      });
      fs.mkdirSync(dataDirectory, { recursive: true });
      fs.writeFileSync(keyPath, pem, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600
      });
      privateKey = pair.privateKey;
      source = "local-development";
    }
  }
  const record = publicKeyRecord(privateKey, keyIdPrefix);
  if (metadata && (record.keyId !== metadata.keyId || record.publicKey !== metadata.publicKey)) {
    throw new Error("CATALOG_SIGNING_PUBLIC_METADATA_MISMATCH");
  }
  return {
    privateKey,
    source,
    ...record
  };
}

module.exports = {
  loadSigningKey,
  publicKeyRecord
};
