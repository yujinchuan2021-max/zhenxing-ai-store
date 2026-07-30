"use strict";

const crypto = require("node:crypto");

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("邮箱格式无效");
  }
  return email;
}

function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (
    username.length < 2 ||
    username.length > 32 ||
    !/^[\p{L}\p{N}_-]+$/u.test(username)
  ) {
    throw new Error("用户名必须为 2-32 个字母、数字、下划线或短横线");
  }
  return { username, normalized: username.toLocaleLowerCase("en-US") };
}

function validatePassword(value) {
  const password = String(value || "");
  if (
    password.length < 10 ||
    password.length > 128 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error("密码至少 10 位，并同时包含字母和数字");
  }
  return password;
}

function hashPassword(password, salt = crypto.randomBytes(16)) {
  const checked = validatePassword(password);
  const digest = crypto.scryptSync(checked, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${digest.toString(
    "base64"
  )}`;
}

function verifyPassword(password, encoded) {
  try {
    const [kind, n, r, p, saltValue, digestValue] = String(encoded).split("$");
    if (
      kind !== "scrypt" ||
      n !== "16384" ||
      r !== "8" ||
      p !== "1" ||
      !saltValue ||
      !digestValue
    ) {
      return false;
    }
    const salt = Buffer.from(saltValue, "base64");
    const expected = Buffer.from(digestValue, "base64");
    const actual = crypto.scryptSync(String(password || ""), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024
    });
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

function randomCredential(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function digestCredential(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""), "utf8")
    .digest("hex");
}

function verificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

module.exports = {
  digestCredential,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  randomCredential,
  validatePassword,
  verificationCode,
  verifyPassword
};
