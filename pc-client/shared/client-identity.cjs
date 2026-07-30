"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CLIENT_ID_PATTERN = /^client-[0-9a-f]{32}$/;

function clientIdToDeviceId(clientId) {
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error("客户端身份无效");
  }
  const hex = clientId.slice("client-".length);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function readOrCreateClientId(filePath, createId = () => crypto.randomBytes(16)) {
  try {
    const existing = fs.readFileSync(filePath, "utf8").trim();
    if (CLIENT_ID_PATTERN.test(existing)) return existing;
  } catch {
    // Missing or damaged identity is replaced atomically below.
  }
  const bytes = createId();
  if (!Buffer.isBuffer(bytes) || bytes.length !== 16) {
    throw new Error("客户端身份生成器无效");
  }
  const clientId = `client-${bytes.toString("hex")}`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${clientId}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  try {
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try {
      const winner = fs.readFileSync(filePath, "utf8").trim();
      if (CLIENT_ID_PATTERN.test(winner)) return winner;
    } catch {
      // Surface the original atomic replacement error.
    }
    throw error;
  } finally {
    try {
      fs.rmSync(temporary);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return clientId;
}

module.exports = {
  CLIENT_ID_PATTERN,
  clientIdToDeviceId,
  readOrCreateClientId
};
