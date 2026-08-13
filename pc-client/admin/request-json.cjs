"use strict";

const MIB = 1024 * 1024;
const DEFAULT_JSON_BODY_LIMIT_BYTES = MIB;
const CATALOG_JSON_BODY_LIMIT_BYTES = 4 * MIB;

function readJson(request, maximumBytes = DEFAULT_JSON_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximumBytes) {
        reject(
          new Error(`请求内容不能超过 ${maximumBytes / MIB} MB`)
        );
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON 格式无效"));
      }
    });
    request.on("error", reject);
  });
}

module.exports = {
  CATALOG_JSON_BODY_LIMIT_BYTES,
  DEFAULT_JSON_BODY_LIMIT_BYTES,
  readJson
};
