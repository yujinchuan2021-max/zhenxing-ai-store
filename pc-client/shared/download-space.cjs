function validBytes(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function assessDownloadSpace({
  availableBytes,
  totalBytes,
  receivedBytes,
  safetyReserveBytes
}) {
  if (!validBytes(totalBytes) || totalBytes < 1) {
    const error = new Error("无法确认安装包大小，已停止下载");
    error.code = "SIZE_UNKNOWN";
    throw error;
  }
  if (
    !validBytes(availableBytes) ||
    !validBytes(receivedBytes) ||
    !validBytes(safetyReserveBytes)
  ) {
    throw new Error("磁盘空间检测结果无效");
  }
  const remainingBytes = Math.max(0, totalBytes - receivedBytes);
  const requiredBytes = remainingBytes + safetyReserveBytes;
  return {
    ok: availableBytes >= requiredBytes,
    availableBytes,
    requiredBytes,
    shortfallBytes: Math.max(0, requiredBytes - availableBytes),
    remainingBytes,
    reserveBytes: safetyReserveBytes
  };
}

module.exports = { assessDownloadSpace };
