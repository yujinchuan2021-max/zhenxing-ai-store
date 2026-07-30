"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

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
  environmentVariable = "AIHUB_CATALOG_SIGNING_PRIVATE_KEY"
}) {
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(environmentVariable)) {
    throw new Error("签名私钥环境变量名无效");
  }
  const configured = String(env[environmentVariable] || "").trim();
  let privateKey;
  let source;
  if (configured) {
    privateKey = crypto.createPrivateKey(configured.replaceAll("\\n", "\n"));
    source = "environment";
  } else {
    if (requireEnvironment) {
      throw new Error(
        `生产发布必须通过 ${environmentVariable} 注入 Ed25519 私钥`
      );
    }
    const keyPath = path.join(dataDirectory, "catalog-signing-private.pem");
    try {
      privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, "utf8"));
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
  return {
    privateKey,
    source,
    ...publicKeyRecord(privateKey)
  };
}

module.exports = {
  loadSigningKey,
  publicKeyRecord
};
