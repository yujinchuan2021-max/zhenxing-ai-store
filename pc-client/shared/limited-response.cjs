"use strict";

async function readResponseTextWithLimit(response, maxBytes) {
  if (
    !response ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    typeof response.headers?.get !== "function"
  ) {
    throw new TypeError("响应读取参数无效");
  }
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > maxBytes)
  ) {
    throw new Error("远程响应超过大小限制");
  }
  const contentType = String(response.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    contentType &&
    contentType !== "application/json" &&
    contentType !== "text/json"
  ) {
    throw new Error("远程响应类型不是 JSON");
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("远程响应正文不可读取");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      received += chunk.length;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error("远程响应超过大小限制");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }
  return Buffer.concat(chunks, received).toString("utf8");
}

module.exports = {
  readResponseTextWithLimit
};
