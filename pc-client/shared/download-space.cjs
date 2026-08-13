function validBytes(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function assessDownloadSpace({
  availableBytes,
  totalBytes,
  receivedBytes,
  safetyReserveBytes,
  nextWriteBytes = 0
}) {
  if (
    !validBytes(availableBytes) ||
    !validBytes(totalBytes) ||
    !validBytes(receivedBytes) ||
    !validBytes(safetyReserveBytes) ||
    !validBytes(nextWriteBytes)
  ) {
    throw new Error("磁盘空间检测结果无效");
  }
  const sizeKnown = totalBytes > 0;
  const remainingBytes = sizeKnown
    ? Math.max(0, totalBytes - receivedBytes)
    : nextWriteBytes;
  const requiredBytes = remainingBytes + safetyReserveBytes;
  return {
    ok: availableBytes >= requiredBytes,
    ...(sizeKnown ? {} : { sizeKnown: false }),
    availableBytes,
    requiredBytes,
    shortfallBytes: Math.max(0, requiredBytes - availableBytes),
    remainingBytes,
    reserveBytes: safetyReserveBytes
  };
}

module.exports = { assessDownloadSpace };
