"use strict";

const crypto = require("node:crypto");

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("签名内容包含无效数字");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (!isPlainObject(value)) {
    throw new TypeError("签名内容必须是普通 JSON 数据");
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}

function validKeyId(value) {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)
  );
}

function decodeCanonicalBase64(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label}无效`);
  }
  const decoded = Buffer.from(value, "base64");
  if (!decoded.length || decoded.toString("base64") !== value) {
    throw new Error(`${label}无效`);
  }
  return decoded;
}

function unsignedEnvelope(envelope) {
  return {
    schemaVersion: 1,
    kind: envelope.kind,
    keyId: envelope.keyId,
    payload: envelope.payload
  };
}

function createSignedEnvelope({ kind, keyId, payload, privateKey }) {
  if (
    !["catalog", "update"].includes(kind) ||
    !validKeyId(keyId) ||
    !isPlainObject(payload)
  ) {
    throw new TypeError("签名发布参数无效");
  }
  const envelope = {
    schemaVersion: 1,
    kind,
    keyId,
    payload
  };
  const signature = crypto.sign(
    null,
    Buffer.from(canonicalize(envelope), "utf8"),
    privateKey
  );
  return {
    ...envelope,
    signature: signature.toString("base64")
  };
}

function normalizeTrustedKeys(trustedKeys) {
  if (
    !Array.isArray(trustedKeys) ||
    trustedKeys.length < 1 ||
    trustedKeys.length > 4
  ) {
    throw new Error("可信发布密钥配置无效");
  }
  const result = new Map();
  for (const entry of trustedKeys) {
    if (
      !isPlainObject(entry) ||
      !validKeyId(entry.keyId) ||
      result.has(entry.keyId)
    ) {
      throw new Error("可信发布密钥配置无效");
    }
    const der = decodeCanonicalBase64(entry.publicKey, "发布公钥");
    let key;
    try {
      key = crypto.createPublicKey({
        key: der,
        format: "der",
        type: "spki"
      });
    } catch {
      throw new Error("发布公钥无效");
    }
    if (key.asymmetricKeyType !== "ed25519") {
      throw new Error("发布公钥必须使用 Ed25519");
    }
    result.set(entry.keyId, key);
  }
  return result;
}

function verifySignedEnvelope(envelope, { kind, trustedKeys }) {
  const fields = new Set([
    "schemaVersion",
    "kind",
    "keyId",
    "payload",
    "signature"
  ]);
  if (
    !isPlainObject(envelope) ||
    Object.keys(envelope).length !== fields.size ||
    Object.keys(envelope).some((field) => !fields.has(field)) ||
    envelope.schemaVersion !== 1 ||
    envelope.kind !== kind ||
    !validKeyId(envelope.keyId) ||
    !isPlainObject(envelope.payload)
  ) {
    throw new Error("签名发布结构无效");
  }
  const keys = normalizeTrustedKeys(trustedKeys);
  const publicKey = keys.get(envelope.keyId);
  if (!publicKey) throw new Error("发布密钥未受客户端信任");
  const signature = decodeCanonicalBase64(envelope.signature, "发布签名");
  const valid = crypto.verify(
    null,
    Buffer.from(canonicalize(unsignedEnvelope(envelope)), "utf8"),
    publicKey,
    signature
  );
  if (!valid) throw new Error("发布签名验证失败");
  return envelope.payload;
}

function validateRollout(value) {
  if (
    !isPlainObject(value) ||
    !Number.isInteger(value.percentage) ||
    value.percentage < 0 ||
    value.percentage > 100 ||
    typeof value.salt !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{7,63}$/i.test(value.salt)
  ) {
    throw new Error("灰度发布配置无效");
  }
  return {
    percentage: value.percentage,
    salt: value.salt
  };
}

function rolloutBucket(clientId, salt) {
  if (
    typeof clientId !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{7,127}$/i.test(clientId)
  ) {
    throw new Error("客户端灰度身份无效");
  }
  const rollout = validateRollout({ percentage: 0, salt });
  const digest = crypto
    .createHash("sha256")
    .update(`${rollout.salt}\0${clientId}`, "utf8")
    .digest();
  return (digest.readUInt32BE(0) / 0x100000000) * 100;
}

function isRolloutEligible(clientId, rollout) {
  const normalized = validateRollout(rollout);
  return (
    normalized.percentage === 100 ||
    (normalized.percentage > 0 &&
      rolloutBucket(clientId, normalized.salt) < normalized.percentage)
  );
}

module.exports = {
  canonicalize,
  createSignedEnvelope,
  isRolloutEligible,
  normalizeTrustedKeys,
  rolloutBucket,
  validateRollout,
  verifySignedEnvelope
};
