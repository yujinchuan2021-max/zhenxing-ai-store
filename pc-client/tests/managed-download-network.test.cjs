"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const { getManagedDownload } = require("../shared/managed-downloads.cjs");

const {
  createManagedDownloadTransport,
  fetchManagedDownloadResponse,
  fetchReviewedArtifactResponse,
  managedDownloadFailure,
  refreshManagedDownloadSession,
  resolveManagedResponseUrl
} = require("../shared/managed-download-network.cjs");

test("refreshes the Electron network session and retries an initial ERR_FAILED", async () => {
  const calls = [];
  const response = { ok: true, status: 200 };
  const result = await fetchManagedDownloadResponse({
    fetchResponse: async () => {
      calls.push("fetch");
      if (calls.filter((entry) => entry === "fetch").length === 1) {
        throw new TypeError("net::ERR_FAILED");
      }
      return response;
    },
    refreshNetwork: async () => calls.push("refresh"),
    wait: async (milliseconds) => calls.push(`wait:${milliseconds}`),
    retries: 2
  });

  assert.equal(result, response);
  assert.deepEqual(calls, ["fetch", "refresh", "wait:100", "fetch"]);
});

test("uses the reviewed request URL when an unredirected response omits response.url", () => {
  assert.equal(
    resolveManagedResponseUrl({
      requestedUrl: "https://downloads.example.com/tool.exe",
      response: { ok: true, redirected: false, url: "" }
    }),
    "https://downloads.example.com/tool.exe"
  );
  assert.throws(
    () =>
      resolveManagedResponseUrl({
        requestedUrl: "https://downloads.example.com/tool.exe",
        response: { ok: true, redirected: true, url: "" }
      }),
    (error) => error.code === "DOWNLOAD_POLICY_REJECTED"
  );
});

test("validates a redirect's final URL through the caller's reviewed policy", async () => {
  const accepted = await fetchReviewedArtifactResponse({
    requestedUrl: "https://downloads.example.com/tool.exe",
    fetchResponse: async () => ({
      ok: true,
      redirected: true,
      url: "https://cdn.example.com/tool.exe"
    }),
    isAllowedFinalUrl: (url) => new URL(url).hostname === "cdn.example.com",
    wait: async () => {}
  });
  assert.equal(accepted.finalUrl, "https://cdn.example.com/tool.exe");

  await assert.rejects(
    fetchReviewedArtifactResponse({
      requestedUrl: "https://downloads.example.com/tool.exe",
      fetchResponse: async () => ({
        ok: true,
        redirected: true,
        url: "https://unreviewed.example.net/tool.exe"
      }),
      isAllowedFinalUrl: (url) => new URL(url).hostname === "cdn.example.com",
      wait: async () => {}
    }),
    (error) => error.code === "DOWNLOAD_POLICY_REJECTED"
  );
});

test("dedicated transport refreshes the system proxy before the first request and on retry", async () => {
  const calls = [];
  let fetches = 0;
  const transport = createManagedDownloadTransport({
    networkSession: {
      async setProxy(value) {
        calls.push(["proxy", value.mode]);
      },
      async forceReloadProxyConfig() {
        calls.push(["reload"]);
      },
      async closeAllConnections() {
        calls.push(["close"]);
      },
      async fetch() {
        fetches += 1;
        calls.push(["fetch", fetches]);
        if (fetches === 1) throw new TypeError("net::ERR_NETWORK_CHANGED");
        return { ok: true, redirected: false, url: "" };
      }
    },
    retries: 2,
    wait: async (milliseconds) => calls.push(["wait", milliseconds])
  });
  const result = await transport.fetch({
    url: "https://downloads.example.com/tool.exe",
    isAllowedFinalUrl: (url) => url.startsWith("https://downloads.example.com/")
  });
  assert.equal(result.finalUrl, "https://downloads.example.com/tool.exe");
  assert.deepEqual(calls, [
    ["proxy", "system"],
    ["reload"],
    ["close"],
    ["fetch", 1],
    ["proxy", "system"],
    ["reload"],
    ["close"],
    ["wait", 100],
    ["fetch", 2]
  ]);
});

test("does not retry policy, disk, or integrity failures", async () => {
  let refreshes = 0;
  await assert.rejects(
    fetchManagedDownloadResponse({
      fetchResponse: async () => {
        const error = new Error("安装包最终下载域名未通过客户端安全策略");
        error.code = "DOWNLOAD_POLICY_REJECTED";
        throw error;
      },
      refreshNetwork: async () => refreshes++,
      retries: 2
    }),
    /安全策略/
  );
  assert.equal(refreshes, 0);
});

test("maps Chromium transport errors to short user-facing download failures", () => {
  assert.deepEqual(managedDownloadFailure(new TypeError("net::ERR_FAILED")), {
    errorCode: "DOWNLOAD_CONNECTION_FAILED",
    errorMessage: "下载连接失败"
  });
  assert.deepEqual(managedDownloadFailure(new Error("校验失败")), {
    errorCode: "DOWNLOAD_FAILED",
    errorMessage: "校验失败"
  });
});

test("always refreshes the Windows system network configuration", async () => {
  const calls = [];
  const networkSession = {
    async setProxy(config) {
      calls.push(["setProxy", config]);
    },
    async forceReloadProxyConfig() {
      calls.push(["reload"]);
    },
    async closeAllConnections() {
      calls.push(["close"]);
    }
  };
  await refreshManagedDownloadSession({ networkSession });

  assert.deepEqual(calls, [
    ["setProxy", { mode: "system" }],
    ["reload"],
    ["close"]
  ]);
});

test("every published reviewed desktop enters the shared managed download seam", () => {
  const desktops = catalog.vendors.flatMap((vendor) =>
    vendor.products
      .filter((product) => product.productType === "desktop-reviewed")
      .map((product) => ({ vendorId: vendor.id, product }))
  );
  assert.equal(desktops.length, 26);
  for (const { product } of desktops) {
    assert.equal(product.moduleId, "desktop-managed", product.id);
    assert.ok(getManagedDownload(product.id), product.id);
  }

  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  assert.match(
    main,
    /ipcMain\.handle\("download:start"[\s\S]*?return startManagedDownload\(productId\)/
  );
  assert.match(
    main,
    /async function downloadPackage[\s\S]*?fetchReviewedDownload\(\{/
  );
  for (const functionName of [
    "downloadManagedWslScript",
    "downloadManagedBinaryCli",
    "downloadFixedMsi"
  ]) {
    const body = main.match(
      new RegExp(`async function ${functionName}[\\s\\S]*?\\n}`)
    )?.[0];
    assert.ok(body, `${functionName} was not found`);
    assert.match(body, /fetchReviewedDownload\(\{/);
    assert.doesNotMatch(body, /net\.fetch\(/);
  }
});

test("client update downloads map transport failures through the shared error seam", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const handler = main.match(
    /ipcMain\.handle\("update:open-download"[\s\S]*?ipcMain\.handle\("settings:get"/
  )?.[0];
  assert.ok(handler, "update download IPC handler was not found");
  assert.match(handler, /managedDownloadFailure\(error\)/);
  assert.match(handler, /errorCode:\s*failure\.errorCode/);
  assert.match(handler, /error:\s*failure\.errorMessage/);
  assert.doesNotMatch(
    handler,
    /error instanceof Error \? error\.message : "更新安装包下载失败"/
  );
});
