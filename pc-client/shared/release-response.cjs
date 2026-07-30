"use strict";

function resolveReleaseResponseUrl(response, requestedUrl) {
  if (!response || typeof requestedUrl !== "string") {
    throw new TypeError("发布响应地址参数无效");
  }
  if (typeof response.url === "string" && response.url) {
    return new URL(response.url);
  }
  if (response.redirected) {
    throw new Error("发布响应发生了无法验证目标的重定向");
  }
  return new URL(requestedUrl);
}

module.exports = {
  resolveReleaseResponseUrl
};
