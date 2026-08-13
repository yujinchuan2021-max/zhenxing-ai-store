function createResumeHeaders(partialBytes) {
  return Number.isSafeInteger(partialBytes) && partialBytes > 0
    ? { Range: `bytes=${partialBytes}-` }
    : {};
}

function parseContentRange(value) {
  const match =
    typeof value === "string"
      ? /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(value.trim())
      : null;
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? 0 : Number(match[3])
  };
}

function resolveResumeResponse({
  requestedBytes,
  status,
  contentLength,
  contentRange
}) {
  const requested =
    Number.isSafeInteger(requestedBytes) && requestedBytes > 0
      ? requestedBytes
      : 0;
  const length = Number(contentLength || 0);
  const range = parseContentRange(contentRange);

  if (status === 206) {
    if (
      !range ||
      range.start !== requested ||
      range.end < range.start ||
      (range.total > 0 && range.total <= range.end) ||
      (length > 0 && length !== range.end - range.start + 1)
    ) {
      throw new Error("下载服务器返回的断点位置不一致");
    }
    return {
      append: requested > 0,
      receivedBytes: requested,
      totalBytes: range.total || requested + length
    };
  }
  if (status === 200) {
    return {
      append: false,
      receivedBytes: 0,
      totalBytes: length
    };
  }
  throw new Error(`下载服务器不支持当前断点请求（${status}）`);
}

module.exports = {
  createResumeHeaders,
  resolveResumeResponse
};
