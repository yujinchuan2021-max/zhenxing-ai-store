"use strict";

async function runDownloadedPackageAction({
  productId,
  getDownloadRecord,
  install,
  download
}) {
  if (
    typeof productId !== "string" ||
    typeof getDownloadRecord !== "function" ||
    typeof install !== "function" ||
    typeof download !== "function"
  ) {
    throw new TypeError("已下载安装包操作参数无效");
  }
  const record = await getDownloadRecord(productId);
  return record ? install(record) : download();
}

module.exports = {
  runDownloadedPackageAction
};
