"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { once } = require("node:events");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const catalog = require("../admin/data/catalog-v1.json");
const { getManagedDownload } = require("../shared/managed-downloads.cjs");
const { assessDownloadSpace } = require("../shared/download-space.cjs");
const {
  createResumeHeaders,
  resolveResumeResponse
} = require("../shared/download-resume.cjs");
const {
  assertDownloadCanFinalize
} = require("../shared/managed-download-reliability.cjs");

const {
  createManagedDownloadTransport,
  fetchManagedDownloadResponse,
  fetchReviewedArtifactResponse,
  isManagedDownloadSourceFallbackError,
  managedDownloadFailure,
  refreshManagedDownloadSession,
  resolveManagedResponseUrl
} = require("../shared/managed-download-network.cjs");

function mainFunctionSource(name) {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `missing ${name}`);
  const parameters = source.indexOf("(", match.index);
  let parameterDepth = 0;
  let open = -1;
  for (let index = parameters; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      open = source.indexOf("{", index);
      break;
    }
  }
  assert.ok(open >= 0, `missing body for ${name}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail(`unterminated ${name}`);
}

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

test("dedicated transport closes pooled connections only before its first request", async () => {
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
    ["wait", 100],
    ["fetch", 2]
  ]);
});

test("concurrent managed fetches share destructive session setup without aborting siblings", async () => {
  const pending = new Set();
  let fetchCount = 0;
  const networkSession = {
    async setProxy() {},
    async forceReloadProxyConfig() {},
    async closeAllConnections() {
      for (const request of [...pending]) {
        request.reject(new TypeError("Failed to fetch"));
      }
    },
    fetch() {
      fetchCount += 1;
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      const request = { resolve, reject };
      pending.add(request);
      promise.finally(() => pending.delete(request)).catch(() => {});
      return promise;
    }
  };
  const transport = createManagedDownloadTransport({
    networkSession,
    retries: 1
  });
  const waitForFetchCount = async (expected) => {
    for (let attempt = 0; attempt < 100 && fetchCount < expected; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(fetchCount, expected);
  };
  const fetchArtifact = (name) => transport.fetch({
    url: `https://downloads.example.com/${name}.exe`,
    isAllowedFinalUrl: (url) => url.startsWith("https://downloads.example.com/")
  });
  const settle = (promise) => promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason })
  );

  const first = settle(fetchArtifact("one"));
  await waitForFetchCount(1);
  const second = settle(fetchArtifact("two"));
  await waitForFetchCount(2);
  const third = settle(fetchArtifact("three"));
  await waitForFetchCount(3);
  for (const request of [...pending]) {
    request.resolve({ ok: true, redirected: false, url: "" });
  }

  const results = await Promise.all([first, second, third]);
  assert.deepEqual(results.map((result) => result.status), [
    "fulfilled",
    "fulfilled",
    "fulfilled"
  ]);
});

test("a managed retry does not close an independent in-flight transfer", async () => {
  const pending = new Set();
  let retryAttempts = 0;
  let siblingStarted = false;
  const networkSession = {
    async setProxy() {},
    async forceReloadProxyConfig() {},
    async closeAllConnections() {
      for (const request of [...pending]) {
        request.reject(new TypeError("Failed to fetch"));
      }
    },
    fetch(url) {
      if (url.endsWith("/retry.exe")) {
        retryAttempts += 1;
        if (retryAttempts === 1) {
          return Promise.reject(new TypeError("net::ERR_FAILED"));
        }
        return Promise.resolve({ ok: true, redirected: false, url: "" });
      }
      siblingStarted = true;
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      const request = { resolve, reject };
      pending.add(request);
      promise.finally(() => pending.delete(request)).catch(() => {});
      return promise;
    }
  };
  const transport = createManagedDownloadTransport({
    networkSession,
    retries: 2,
    wait: async () => {}
  });
  const settle = (promise) => promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason })
  );
  const fetchArtifact = (name) => transport.fetch({
    url: `https://downloads.example.com/${name}.exe`,
    isAllowedFinalUrl: (url) => url.startsWith("https://downloads.example.com/")
  });

  const sibling = settle(fetchArtifact("sibling"));
  for (let attempt = 0; attempt < 100 && !siblingStarted; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(siblingStarted, true);
  const retried = await fetchArtifact("retry");
  for (const request of [...pending]) {
    request.resolve({ ok: true, redirected: false, url: "" });
  }

  assert.equal(retried.finalUrl, "https://downloads.example.com/retry.exe");
  assert.equal(retryAttempts, 2);
  assert.equal((await sibling).status, "fulfilled");
});

test("a retry cannot close a response body already returned to another caller", async () => {
  let closeCount = 0;
  let retryAttempts = 0;
  let resolveBody;
  let rejectBody;
  const bodyCompletion = new Promise((resolve, reject) => {
    resolveBody = resolve;
    rejectBody = reject;
  });
  const bodyResult = bodyCompletion.then(
    () => "fulfilled",
    () => "rejected"
  );
  const transport = createManagedDownloadTransport({
    networkSession: {
      async setProxy() {},
      async forceReloadProxyConfig() {},
      async closeAllConnections() {
        closeCount += 1;
        if (closeCount > 1) rejectBody(new TypeError("Failed to fetch"));
      },
      async fetch(url) {
        if (url.endsWith("/stream.exe")) {
          return {
            ok: true,
            redirected: false,
            url: "",
            body: { completion: bodyCompletion }
          };
        }
        retryAttempts += 1;
        if (retryAttempts === 1) {
          throw new TypeError("net::ERR_FAILED");
        }
        return { ok: true, redirected: false, url: "" };
      }
    },
    retries: 2,
    wait: async () => {}
  });
  const fetchArtifact = (name) => transport.fetch({
    url: `https://downloads.example.com/${name}.exe`,
    isAllowedFinalUrl: (url) => url.startsWith("https://downloads.example.com/")
  });

  const streamed = await fetchArtifact("stream");
  assert.equal(streamed.response.body.completion, bodyCompletion);
  await fetchArtifact("retry");
  resolveBody();

  assert.equal(await bodyResult, "fulfilled");
  assert.equal(closeCount, 1);
  assert.equal(retryAttempts, 2);
});

test("concurrent retries share one non-destructive network refresh", async () => {
  let proxyCount = 0;
  let reloadCount = 0;
  let closeCount = 0;
  let releaseRetryRefresh;
  const retryRefreshHeld = new Promise((resolve) => {
    releaseRetryRefresh = resolve;
  });
  const attempts = new Map();
  const transport = createManagedDownloadTransport({
    networkSession: {
      async setProxy() {
        proxyCount += 1;
        if (proxyCount === 2) await retryRefreshHeld;
      },
      async forceReloadProxyConfig() {
        reloadCount += 1;
      },
      async closeAllConnections() {
        closeCount += 1;
      },
      async fetch(url) {
        const count = (attempts.get(url) || 0) + 1;
        attempts.set(url, count);
        if (count === 1) throw new TypeError("net::ERR_FAILED");
        return { ok: true, redirected: false, url: "" };
      }
    },
    retries: 2,
    wait: async () => {}
  });
  const fetchArtifact = (name) => transport.fetch({
    url: `https://downloads.example.com/${name}.exe`,
    isAllowedFinalUrl: (url) => url.startsWith("https://downloads.example.com/")
  });

  const first = fetchArtifact("one");
  const second = fetchArtifact("two");
  for (let spin = 0; spin < 100 && proxyCount < 2; spin += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(proxyCount, 2);
  releaseRetryRefresh();
  await Promise.all([first, second]);

  assert.equal(proxyCount, 2);
  assert.equal(reloadCount, 2);
  assert.equal(closeCount, 1);
});

test("a failed initial destructive refresh is retried by the next fetch", async () => {
  let proxyCount = 0;
  let closeCount = 0;
  let fetchCount = 0;
  const transport = createManagedDownloadTransport({
    networkSession: {
      async setProxy() {
        proxyCount += 1;
        if (proxyCount === 1) throw new Error("proxy refresh failed");
      },
      async forceReloadProxyConfig() {},
      async closeAllConnections() {
        closeCount += 1;
      },
      async fetch() {
        fetchCount += 1;
        return { ok: true, redirected: false, url: "" };
      }
    },
    retries: 1
  });
  const fetchArtifact = () => transport.fetch({
    url: "https://downloads.example.com/tool.exe",
    isAllowedFinalUrl: (url) => url.startsWith("https://downloads.example.com/")
  });

  await assert.rejects(fetchArtifact(), /proxy refresh failed/);
  await fetchArtifact();

  assert.equal(proxyCount, 2);
  assert.equal(closeCount, 1);
  assert.equal(fetchCount, 1);
});

test("streaming main callers do not supply a durable-task sibling hint", () => {
  const streamingCaller = mainFunctionSource("downloadManagedWslScript");
  assert.match(streamingCaller, /fetchReviewedDownload\(/);
  assert.match(streamingCaller, /response\.body/);
  const transportFactory = mainFunctionSource("managedDownloadTransport");
  assert.doesNotMatch(transportFactory, /activeDownloads/);
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
    errorCode: "DOWNLOAD_TASK_INTERNAL_ERROR",
    errorMessage: "安装包下载失败"
  });
  assert.deepEqual(
    managedDownloadFailure(
      Object.assign(new Error("https://secret.invalid/private"), {
        code: "UNREVIEWED_FAILURE"
      })
    ),
    {
      errorCode: "DOWNLOAD_TASK_INTERNAL_ERROR",
      errorMessage: "安装包下载失败"
    }
  );
  assert.deepEqual(
    managedDownloadFailure(
      Object.assign(new Error("下载服务器未返回可用安装包"), {
        code: "DOWNLOAD_HTTP_FAILED"
      })
    ),
    {
      errorCode: "DOWNLOAD_HTTP_FAILED",
      errorMessage: "下载服务器未返回可用安装包"
    }
  );
});

test("an unencoded fetch rejection receives a fixed transport error code", async () => {
  await assert.rejects(
    fetchManagedDownloadResponse({
      fetchResponse: async () => {
        throw new TypeError("Failed to fetch");
      },
      retries: 1
    }),
    (error) =>
      error?.code === "DOWNLOAD_FETCH_FAILED" &&
      error?.message === "下载连接失败"
  );
});

test("HTTP rejection and a missing response body receive fixed safe codes", async (t) => {
  const cases = [
    {
      name: "http",
      response: new Response("unavailable", { status: 503 }),
      expectedCode: "DOWNLOAD_HTTP_FAILED"
    },
    {
      name: "body",
      response: {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: null
      },
      expectedCode: "DOWNLOAD_HTTP_BODY_MISSING"
    }
  ];
  for (const item of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `aihub-${item.name}-failure-`));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const downloadPackage = vm.runInNewContext(
      `(${mainFunctionSource("downloadPackage")})`,
      {
        AbortController,
        Buffer,
        DOWNLOAD_USER_AGENT: "AIHub-Test",
        URL,
        assertDownloadCanFinalize,
        assessDownloadSpace,
        app: { getPath: () => root },
        availableDiskBytes: () => 2 * 1024 ** 3,
        clearTimeout,
        createResumeHeaders,
        crypto,
        fetchReviewedDownload: async () => ({ response: item.response }),
        fs,
        insufficientDownloadSpaceError: () => new Error("insufficient disk space"),
        isAllowedManagedDownloadUrl: () => false,
        once,
        path,
        resolveResumeResponse,
        setTimeout,
        updateHashFromFile: async () => {}
      }
    );
    await assert.rejects(
      downloadPackage(
        { send() {} },
        {
          productId: "safe-product",
          url: "https://downloads.example.com/tool.exe",
          allowedFinalHosts: ["downloads.example.com"]
        },
        path.join(root, "tool.exe"),
        { keepPartial: false, isCurrentAttempt: () => true }
      ),
      (error) => error?.code === item.expectedCode,
      item.name
    );
  }
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

test("every published direct-installer desktop enters the managed download seam", () => {
  const desktops = catalog.vendors.flatMap((vendor) =>
    vendor.products
      .filter(
        (product) =>
          product.productType === "desktop-reviewed" &&
          product.downloadPolicy === "client-managed"
      )
      .map((product) => ({ vendorId: vendor.id, product }))
  );
  assert.equal(desktops.length, 37);
  for (const { product } of desktops) {
    assert.equal(product.moduleId, "desktop-managed", product.id);
    assert.ok(getManagedDownload(product.id), product.id);
  }

  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const managedDownloadEntry = main.match(
    /ipcMain\.handle\("download:start"[\s\S]*?ipcMain\.handle\("download:refresh"/
  )?.[0];
  const managedDownloadRequest = main.match(
    /async function startManagedDownloadFromRequest[\s\S]*?async function clearCompletedDownloadHistory/
  )?.[0];
  assert.ok(managedDownloadEntry);
  assert.ok(managedDownloadRequest);
  assert.match(
    managedDownloadEntry,
    /await authorizeCurrentCatalogProduct\(productId\)/
  );
  assert.match(
    managedDownloadRequest,
    /return startManagedDownload\(productId, plan\)/
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

test("mirror fallback accepts only connection failures or an official source with no first byte", () => {
  assert.equal(
    isManagedDownloadSourceFallbackError(new TypeError("net::ERR_FAILED")),
    true
  );
  assert.equal(
    isManagedDownloadSourceFallbackError(
      Object.assign(new Error("official source sent no data"), {
        code: "DOWNLOAD_SOURCE_NO_DATA"
      })
    ),
    true
  );

  for (const code of [
    "DOWNLOAD_POLICY_REJECTED",
    "INSUFFICIENT_DISK_SPACE",
    "ENOSPC",
    "DOWNLOAD_FAILED"
  ]) {
    assert.equal(
      isManagedDownloadSourceFallbackError(
        Object.assign(new Error(code), { code })
      ),
      false,
      code
    );
  }
});

test("desktop mirror switching is gated by the shared pre-data failure policy", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const fallback = main.match(
    /const fallbackPlan =[^;]+;[\s\S]*?if \(fallbackPlan/
  )?.[0];

  assert.ok(fallback, "managed download fallback block was not found");
  assert.match(fallback, /!partial/);
  assert.match(fallback, /isManagedDownloadSourceFallbackError\(error\)/);
  assert.match(fallback, /nextManagedDownloadPlan\(plan\)/);
  assert.doesNotMatch(fallback, /nextEnvironmentDownloadPlan\(plan\)/);
});

test("once a non-empty chunk arrives, later reads have no timeout or source switch", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const readLoop = main.match(
    /let receivedNetworkData = false;[\s\S]*?if \(chunk\.done\) break;/
  )?.[0];

  assert.ok(readLoop, "managed download body reader loop was not found");
  assert.match(
    readLoop,
    /if \(receivedNetworkData\) {\s*chunk = await reader\.read\(\);\s*} else {/
  );
  assert.match(readLoop, /Promise\.race\([\s\S]*?DOWNLOAD_SOURCE_NO_DATA/);
  assert.doesNotMatch(
    readLoop.match(
      /if \(receivedNetworkData\) {([\s\S]*?)} else {/
    )?.[1] || "",
    /Promise\.race|setTimeout|DOWNLOAD_SOURCE_NO_DATA|nextManagedDownloadPlan/
  );
  assert.match(
    main,
    /if \(buffer\.length > 0\) receivedNetworkData = true;/
  );
});

test("the managed stream rechecks disk space before every body write", () => {
  const main = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const loop = main.match(
    /while \(true\) \{[\s\S]*?if \(!output\.write\(buffer\)\) await once\(output, "drain"\);/
  )?.[0];

  assert.ok(loop, "managed download body loop was not found");
  assert.match(loop, /assessDownloadSpace\(\{[\s\S]*?nextWriteBytes:\s*buffer\.length/);
  assert.match(loop, /availableDiskBytes\(target\)/);
});

test("Blender-shaped HEAD and GET without Content-Length still stream through downloadPackage", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-unknown-size-"));
  const target = path.join(root, "blender-5.2.0-windows-x64.msi");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const headResponse = new Response(null, { status: 200 });
  const getResponse = new Response(
    new Blob([Buffer.from("blender-stream-fixture")]).stream(),
    { status: 200 }
  );
  assert.equal(headResponse.headers.get("content-length"), null);
  assert.equal(getResponse.headers.get("content-length"), null);

  const downloadPackage = vm.runInNewContext(
    `(${mainFunctionSource("downloadPackage")})`,
    {
      AbortController,
      Buffer,
      DOWNLOAD_USER_AGENT: "AIHub-Test",
      URL,
      assertDownloadCanFinalize,
      assessDownloadSpace,
      app: { getPath: () => root },
      availableDiskBytes: () => 2 * 1024 ** 3,
      clearTimeout,
      createResumeHeaders,
      crypto,
      fetchReviewedDownload: async () => ({ response: getResponse }),
      fs,
      insufficientDownloadSpaceError(space) {
        const error = new Error("insufficient disk space");
        error.code = "INSUFFICIENT_DISK_SPACE";
        Object.assign(error, space);
        return error;
      },
      isAllowedManagedDownloadUrl: () => false,
      once,
      path,
      resolveResumeResponse,
      setTimeout,
      updateHashFromFile: async () => {}
    }
  );
  const progress = [];
  const result = await downloadPackage(
    { send: (_channel, value) => progress.push(value) },
    {
      productId: "blender",
      url: "https://www.blender.org/download/release/Blender5.2/blender-5.2.0-windows-x64.msi",
      allowedFinalHosts: ["www.blender.org"]
    },
    target,
    {
      keepPartial: true,
      safetyReserveBytes: 512 * 1024 * 1024,
      isCurrentAttempt: () => true
    }
  );

  assert.equal(result.fileSize, Buffer.byteLength("blender-stream-fixture"));
  assert.equal(fs.readFileSync(target, "utf8"), "blender-stream-fixture");
  assert.equal(progress.some((entry) => entry.totalBytes === 0), true);
});

test("cancel interrupts a stalled active body read and closes its partial promptly", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-cancel-"));
  const target = path.join(root, "artifact.exe");
  const unrelatedPartial = path.join(root, "other-product.exe.part");
  fs.writeFileSync(unrelatedPartial, "keep");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  let secondReadStarted = false;
  let resolveSecondRead;
  let cancelCalls = 0;
  let reads = 0;
  const stalledRead = new Promise((resolve) => {
    resolveSecondRead = resolve;
  });
  const reader = {
    read() {
      reads += 1;
      if (reads === 1) {
        return Promise.resolve({ done: false, value: Buffer.from("x") });
      }
      secondReadStarted = true;
      return stalledRead;
    },
    cancel() {
      cancelCalls += 1;
      resolveSecondRead({ done: true });
      return Promise.resolve();
    }
  };
  const response = {
    ok: true,
    status: 200,
    headers: { get: () => null },
    body: { getReader: () => reader }
  };
  const downloadPackage = vm.runInNewContext(
    `(${mainFunctionSource("downloadPackage")})`,
    {
      AbortController,
      Buffer,
      DOWNLOAD_USER_AGENT: "AIHub-Test",
      URL,
      assertDownloadCanFinalize,
      assessDownloadSpace,
      app: { getPath: () => root },
      availableDiskBytes: () => 2 * 1024 ** 3,
      clearTimeout,
      createResumeHeaders,
      crypto,
      fetchReviewedDownload: async () => ({ response }),
      fs,
      insufficientDownloadSpaceError: () => new Error("insufficient disk space"),
      isAllowedManagedDownloadUrl: () => false,
      once,
      path,
      resolveResumeResponse,
      setTimeout,
      updateHashFromFile: async () => {}
    }
  );
  const controller = new AbortController();
  let outcome = "pending";
  const work = downloadPackage(
    { send() {} },
    {
      productId: "canonical-product",
      url: "https://official.example/artifact.exe",
      allowedFinalHosts: ["official.example"]
    },
    target,
    {
      controller,
      keepPartial: false,
      isCurrentAttempt: () => true
    }
  ).then(
    () => { outcome = "resolved"; },
    () => { outcome = "rejected"; }
  );
  for (let attempt = 0; attempt < 100 && !secondReadStarted; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.equal(secondReadStarted, true);

  controller.abort();
  const settled = await Promise.race([
    work.then(() => true, () => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 250))
  ]);
  if (!settled) {
    resolveSecondRead({ done: true });
    await work;
  }

  assert.equal(settled, true, "cancel must settle a stalled active read within 250ms");
  assert.equal(outcome, "rejected");
  assert.ok(cancelCalls >= 1);
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.existsSync(`${target}.part`), false);
  assert.equal(fs.readFileSync(unrelatedPartial, "utf8"), "keep");
});
