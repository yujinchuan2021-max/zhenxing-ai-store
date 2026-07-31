"use strict";

const RETRYABLE_TRANSPORT_ERROR =
  /(?:net::)?ERR_(?:FAILED|CONNECTION_(?:ABORTED|CLOSED|REFUSED|RESET|TIMED_OUT)|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_CHANGED|PROXY_CONNECTION_FAILED|TIMED_OUT)/i;

function isRetryableManagedDownloadError(error) {
  if (!error || error.name === "AbortError") return false;
  const code = typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_TRANSPORT_ERROR.test(`${code} ${message}`);
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
        throw error;
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
  return Object.freeze({
    async fetch({ url, options, isAllowedFinalUrl }) {
      // Refresh before the first attempt so a system-proxy switch cannot reuse
      // the managed transport's stale proxy route or pooled connection.
      await refreshManagedDownloadSession({ networkSession });
      return fetchReviewedArtifactResponse({
        requestedUrl: url,
        fetchResponse: () => networkSession.fetch(url, options),
        refreshNetwork: () =>
          refreshManagedDownloadSession({ networkSession }),
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
  return {
    errorCode: String(error?.code || "DOWNLOAD_FAILED"),
    errorMessage: error instanceof Error ? error.message : "安装包下载失败"
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
  isRetryableManagedDownloadError,
  managedDownloadFailure,
  refreshManagedDownloadSession,
  resolveManagedResponseUrl
};
