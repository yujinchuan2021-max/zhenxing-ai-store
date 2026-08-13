"use strict";

const RETRYABLE_TRANSPORT_ERROR =
  /(?:net::)?ERR_(?:FAILED|CONNECTION_(?:ABORTED|CLOSED|REFUSED|RESET|TIMED_OUT)|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_CHANGED|PROXY_CONNECTION_FAILED|TIMED_OUT)/i;

const SAFE_MANAGED_DOWNLOAD_FAILURES = Object.freeze({
  DOWNLOAD_FETCH_FAILED: "下载连接失败",
  DOWNLOAD_HTTP_FAILED: "下载服务器未返回可用安装包",
  DOWNLOAD_HTTP_BODY_MISSING: "下载服务器未返回安装包内容",
  DOWNLOAD_POLICY_REJECTED: "安装包下载未通过客户端安全策略",
  DOWNLOAD_SOURCE_NO_DATA: "下载源未返回安装包数据",
  INSUFFICIENT_DISK_SPACE: "磁盘空间不足，已停止下载",
  PARTIAL_PROMOTION_INVALID: "下载断点无效",
  DOWNLOAD_SIZE_INVALID: "安装包大小无效",
  DOWNLOAD_INCOMPLETE: "安装包下载不完整",
  DOWNLOAD_ATTEMPT_INTERRUPTED: "下载任务已中断",
  DOWNLOAD_START_FAILED: "下载任务启动失败",
  DOWNLOAD_QUEUE_REJECTED: "下载任务未能进入队列"
});

function isRetryableManagedDownloadError(error) {
  if (!error || error.name === "AbortError") return false;
  const code = typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_TRANSPORT_ERROR.test(`${code} ${message}`);
}

function isManagedDownloadSourceFallbackError(error) {
  return (
    isRetryableManagedDownloadError(error) ||
    String(error?.code || "") === "DOWNLOAD_SOURCE_NO_DATA"
  );
}

function managedDownloadFetchError(error) {
  if (
    isRetryableManagedDownloadError(error) ||
    (typeof error?.code === "string" && error.code)
  ) {
    return error;
  }
  return Object.assign(new Error("下载连接失败"), {
    code: "DOWNLOAD_FETCH_FAILED"
  });
}

function waitForRetry(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchManagedDownloadResponse({
  fetchResponse,
  refreshNetwork,
  retries = 3,
  wait = waitForRetry
}) {
  if (typeof fetchResponse !== "function") {
    throw new TypeError("fetchResponse must be a function");
  }
  const attempts = Math.max(1, Number.isSafeInteger(retries) ? retries : 3);
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchResponse();
    } catch (error) {
      lastError = error;
      if (!isRetryableManagedDownloadError(error) || attempt === attempts) {
        throw managedDownloadFetchError(error);
      }
      if (typeof refreshNetwork === "function") {
        try {
          await refreshNetwork({ retryNumber: attempt, error });
        } catch {
          // A refresh failure must not hide the original transport failure.
        }
      }
      if (typeof wait === "function") {
        await wait(Math.min(1_000, 100 * 2 ** (attempt - 1)), {
          retryNumber: attempt,
          error
        });
      }
    }
  }
  throw lastError;
}

function downloadPolicyError(message) {
  const error = new Error(message);
  error.code = "DOWNLOAD_POLICY_REJECTED";
  return error;
}

function resolveManagedResponseUrl({ requestedUrl, response }) {
  if (typeof requestedUrl !== "string" || !requestedUrl) {
    throw downloadPolicyError("下载请求地址无效");
  }
  const responseUrl =
    typeof response?.url === "string" ? response.url.trim() : "";
  if (responseUrl) return responseUrl;
  // Chromium and test transports may omit response.url when no redirect was
  // followed. In that case the reviewed request URL remains the final URL.
  if (response?.redirected !== true) return requestedUrl;
  throw downloadPolicyError("下载发生跳转，但无法确认最终地址");
}

async function fetchReviewedArtifactResponse({
  requestedUrl,
  fetchResponse,
  refreshNetwork,
  isAllowedFinalUrl,
  retries = 3,
  wait = waitForRetry
}) {
  if (typeof isAllowedFinalUrl !== "function") {
    throw new TypeError("isAllowedFinalUrl must be a function");
  }
  const response = await fetchManagedDownloadResponse({
    fetchResponse,
    refreshNetwork,
    retries,
    wait
  });
  const finalUrl = resolveManagedResponseUrl({ requestedUrl, response });
  if (!isAllowedFinalUrl(finalUrl)) {
    throw downloadPolicyError("安装包最终下载地址未通过客户端安全策略");
  }
  return { response, finalUrl };
}

function createManagedDownloadTransport({
  networkSession,
  retries = 3,
  wait = waitForRetry
}) {
  if (
    !networkSession ||
    typeof networkSession.fetch !== "function" ||
    typeof networkSession.setProxy !== "function" ||
    typeof networkSession.forceReloadProxyConfig !== "function" ||
    typeof networkSession.closeAllConnections !== "function"
  ) {
    throw new TypeError("managed download network session is invalid");
  }
  let initialRefresh = null;
  let retryRefresh = null;
  const ensureInitialRefresh = () => {
    if (!initialRefresh) {
      initialRefresh = refreshManagedDownloadSession({ networkSession }).catch(
        (error) => {
          initialRefresh = null;
          throw error;
        }
      );
    }
    return initialRefresh;
  };
  const refreshForRetry = () => {
    if (!retryRefresh) {
      retryRefresh = (async () => {
        await networkSession.setProxy({ mode: "system" });
        await networkSession.forceReloadProxyConfig();
      })().finally(() => {
        retryRefresh = null;
      });
    }
    return retryRefresh;
  };
  return Object.freeze({
    async fetch({ url, options, isAllowedFinalUrl }) {
      // Refresh before the first attempt so a system-proxy switch cannot reuse
      // the managed transport's stale proxy route or pooled connection.
      await ensureInitialRefresh();
      return fetchReviewedArtifactResponse({
        requestedUrl: url,
        fetchResponse: () => networkSession.fetch(url, options),
        refreshNetwork: refreshForRetry,
        isAllowedFinalUrl,
        retries,
        wait
      });
    }
  });
}

function managedDownloadFailure(error) {
  if (isRetryableManagedDownloadError(error)) {
    return {
      errorCode: "DOWNLOAD_CONNECTION_FAILED",
      errorMessage: "下载连接失败"
    };
  }
  const safeCode = String(error?.code || "");
  if (Object.hasOwn(SAFE_MANAGED_DOWNLOAD_FAILURES, safeCode)) {
    return {
      errorCode: safeCode,
      errorMessage: SAFE_MANAGED_DOWNLOAD_FAILURES[safeCode]
    };
  }
  return {
    errorCode: "DOWNLOAD_TASK_INTERNAL_ERROR",
    errorMessage: "安装包下载失败"
  };
}

async function refreshManagedDownloadSession({ networkSession }) {
  await networkSession.setProxy({ mode: "system" });
  await networkSession.forceReloadProxyConfig();
  await networkSession.closeAllConnections();
}

module.exports = {
  createManagedDownloadTransport,
  fetchManagedDownloadResponse,
  fetchReviewedArtifactResponse,
  isManagedDownloadSourceFallbackError,
  isRetryableManagedDownloadError,
  managedDownloadFailure,
  refreshManagedDownloadSession,
  resolveManagedResponseUrl
};
