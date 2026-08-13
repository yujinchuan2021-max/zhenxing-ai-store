import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createIsolatedAcceptanceProfile,
  launchPackagedClientCdp,
  openPackagedCatalogProduct,
  removeIsolatedAcceptanceProfile,
  waitForPackagedManagedDownloadAction
} from "./lib/packaged-client-cdp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const requestedProduct = process.argv.find((value) => value.startsWith("--product="))
  ?.slice("--product=".length) || "";
const requestedCatalogVersion = Number.parseInt(
  process.argv.find((value) => value.startsWith("--catalog-version="))
    ?.slice("--catalog-version=".length) || "5",
  10
);
const resumeFrom = process.argv.find((value) => value.startsWith("--resume-from="))
  ?.slice("--resume-from=".length) || "";
const development = args.has("--development");
const executable = development
  ? path.join(root, "node_modules", "electron", "dist", "electron.exe")
  : path.resolve(process.argv.find((value) => value.startsWith("--executable="))
    ?.slice("--executable=".length) || "");
const reportStem = process.argv.find((value) => value.startsWith("--report-stem="))
  ?.slice("--report-stem=".length) || path.join(
    root,
    "docs",
    "acceptance",
    `v2-active${requestedCatalogVersion}-265-live-validation-2026-08-06`
  );
const perItemLimit = 8 * 1024 * 1024;
const totalLimit = 512 * 1024 * 1024;

if (!fs.existsSync(executable)) {
  throw new Error(`Acceptance executable is missing: ${executable}`);
}
if (!Number.isSafeInteger(requestedCatalogVersion) || requestedCatalogVersion < 1) {
  throw new Error("--catalog-version must be a positive integer");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function quoteCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function readCsvRows(file) {
  if (!file) return [];
  const text = fs.readFileSync(file, "utf8");
  const records = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { field += character; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(field); field = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); if (row.length > 1) records.push(row); row = []; field = "";
    } else field += character;
  }
  if (field || row.length) { row.push(field); records.push(row); }
  const [header, ...body] = records;
  const columns = Object.fromEntries(header.map((value, index) => [value, index]));
  return body.map((entry) => ({
    id: entry[columns.productId], name: entry[columns.productName], strategy: entry[columns.strategy],
    uiAction: entry[columns.uiAction], initialUrl: entry[columns.initialUrl],
    finalUrlOrHost: entry[columns.finalUrlOrHost], networkOrFirstData: entry[columns.networkOrFirstData],
    cancelOrRecovery: entry[columns.cancelOrRecovery], status: entry[columns.status], reason: entry[columns.reason]
  }));
}

function externalActionSnapshot(productId) {
  return `(() => {
    const root = document.querySelector('[data-aihub-product-id=${JSON.stringify(productId)}]');
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll('.productActions > button'));
    return {
      buttons: buttons.map((button) => ({
        label: button.innerText.trim(), action: button.getAttribute('data-aihub-action') || '',
        disabled: button.disabled, className: button.className
      })),
      hint: root.querySelector('.acquisitionHint')?.textContent?.trim() || '',
      hasInstall: Boolean(root.querySelector('[data-aihub-action="install-product"]'))
    };
  })()`;
}

async function waitForDesktopRow(evaluate, vendor, product) {
  await openPackagedCatalogProduct({
    evaluate,
    vendorId: vendor.id,
    productId: product.id,
    searchText: product.name,
    directoryKind: product.directoryKind || "ai-tool",
    timeoutMs: 15_000
  });
  const snapshot = await evaluate(externalActionSnapshot(product.id));
  if (!snapshot) throw new Error("product row did not render");
  return snapshot;
}

async function probeExternalUrl(initialUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(initialUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Range: "bytes=0-0", "User-Agent": "AIHub acceptance probe" },
      signal: controller.signal
    });
    const finalUrl = response.url || initialUrl;
    let firstBytes = 0;
    try {
      const reader = response.body?.getReader();
      if (reader) {
        const first = await reader.read();
        firstBytes = first.value?.byteLength || 0;
        await reader.cancel();
      }
    } catch {
      // A redirect/page probe only needs the transport result and final URL.
    }
    return {
      status: response.status,
      transport: `HTTP ${response.status}`,
      finalUrl,
      finalHost: new URL(finalUrl).host,
      firstBytes
    };
  } catch (error) {
    return {
      transport: "BLOCKED",
      finalUrl: "",
      finalHost: "",
      firstBytes: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function firstDataThenPause(evaluate, product, totalReceived) {
  const encodedId = JSON.stringify(product.id);
  const encodedArtifact = JSON.stringify(product.download);
  const started = await evaluate(
    `window.aihubPC.startDownload(${encodedId}, ${encodedArtifact})`
  );
  if (!started?.ok) {
    throw new Error(`authorization/start rejected: ${started?.error || JSON.stringify(started)}`);
  }
  const deadline = Date.now() + 45_000;
  let task = started.task || null;
  while (Date.now() < deadline) {
    task = await evaluate(`window.aihubPC.getDownloadTask(${encodedId})`);
    if (task?.phase === "failed") {
      throw new Error(`download failed before first data: ${task.errorCode || ""} ${task.errorMessage || ""}`.trim());
    }
    const received = task?.progress?.receivedBytes || 0;
    if (received > perItemLimit || totalReceived.value + received > totalLimit) {
      await evaluate(`window.aihubPC.pauseDownload(${encodedId})`);
      throw new Error(`download safety limit reached at ${received} bytes`);
    }
    if (task?.phase === "completed" && received > 0) {
      totalReceived.value += received;
      return { started, completed: task };
    }
    if (received > 0) {
      const paused = await evaluate(`window.aihubPC.pauseDownload(${encodedId})`);
      if (paused?.ok !== true || paused?.task?.phase !== "paused") {
        throw new Error(`pause rejected: ${JSON.stringify(paused)}`);
      }
      totalReceived.value += paused.task.progress?.receivedBytes || 0;
      return { started, paused };
    }
    await delay(20);
  }
  throw new Error("no first data within 45 seconds");
}

async function retryThenPause(evaluate, product, totalReceived) {
  const encodedId = JSON.stringify(product.id);
  const encodedArtifact = JSON.stringify(product.download);
  const retried = await evaluate(
    `window.aihubPC.refreshDownload(${encodedId}, ${encodedArtifact})`
  );
  if (!retried?.ok) throw new Error(`retry rejected: ${retried?.error || JSON.stringify(retried)}`);
  const deadline = Date.now() + 45_000;
  let task = retried.task || null;
  while (Date.now() < deadline) {
    task = await evaluate(`window.aihubPC.getDownloadTask(${encodedId})`);
    if (task?.phase === "failed") {
      throw new Error(`retry failed: ${task.errorCode || ""} ${task.errorMessage || ""}`.trim());
    }
    const received = task?.progress?.receivedBytes || 0;
    if (received > perItemLimit || totalReceived.value + received > totalLimit) {
      await evaluate(`window.aihubPC.pauseDownload(${encodedId})`);
      throw new Error(`retry safety limit reached at ${received} bytes`);
    }
    if (task?.phase === "completed" && received > 0) {
      totalReceived.value += received;
      return { retried, completed: task };
    }
    if (received > 0) {
      const paused = await evaluate(`window.aihubPC.pauseDownload(${encodedId})`);
      if (paused?.ok !== true || paused?.task?.phase !== "paused") {
        throw new Error(`retry pause rejected: ${JSON.stringify(paused)}`);
      }
      totalReceived.value += paused.task.progress?.receivedBytes || 0;
      return { retried, paused };
    }
    await delay(20);
  }
  throw new Error("retry did not receive data within 45 seconds");
}

function writeReports(rows, meta) {
  const csv = [
    ["productId", "productName", "strategy", "uiAction", "initialUrl", "finalUrlOrHost", "networkOrFirstData", "cancelOrRecovery", "status", "reason"],
    ...rows.map((row) => [row.id, row.name, row.strategy, row.uiAction, row.initialUrl,
      row.finalUrlOrHost, row.networkOrFirstData, row.cancelOrRecovery, row.status, row.reason])
  ].map((row) => row.map(quoteCsv).join(",")).join("\r\n") + "\r\n";
  fs.writeFileSync(`${reportStem}.csv`, csv, "utf8");
  const totals = rows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  const markdown = [
    `# v2 active${meta.catalogVersion} 265 Windows desktop live validation`,
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Catalog: v${meta.catalogVersion}; ${meta.vendors} vendors; ${meta.products} products; ${meta.desktopCount} desktop-acquisition rows.`,
    `- Result: ${JSON.stringify(totals)}.`,
    `- Direct item ceiling: ${perItemLimit} bytes; cumulative ceiling: ${totalLimit} bytes.`,
    "- Direct items used the real Electron IPC authorization/download path, received data, paused and retried. Native discard confirmation is deliberately not auto-accepted; that user-dialog action is separately recorded as BLOCKED rather than treated as cancellation success.",
    "- External acquisition actions were captured by the renderer before a bounded range probe; no browser windows, third-party installation, or full installer download was performed.",
    "",
    "See the adjacent CSV for one evidence row per product."
  ].join("\n") + "\n";
  fs.writeFileSync(`${reportStem}.md`, markdown, "utf8");
}

function classifyDirectFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b404\b|DOWNLOAD_POLICY_REJECTED|artifact.*(?:invalid|rejected)/i.test(message)) {
    return { status: "FAIL", reason: `catalog/artifact FAIL: ${message}` };
  }
  if (/\b403\b|fetch failed|timeout|timed out|ERR_CERT|TLS|network/i.test(message)) {
    return { status: "BLOCKED", reason: `external network BLOCKED: ${message}` };
  }
  return { status: "FAIL", reason: `client FAIL: ${message}` };
}

const profile = createIsolatedAcceptanceProfile(`aihub-active${requestedCatalogVersion}-live-`);
const rows = readCsvRows(resumeFrom);
const totalReceived = { value: 0 };
let reportMeta = null;
let client;
try {
  client = await launchPackagedClientCdp({
    executable,
    profile,
    appArguments: development ? [root] : [],
    extraEnvironment: { AIHUB_CATALOG_CHANNEL: "v2" }
  });
  const { evaluate } = client;
  const readyDeadline = Date.now() + 30_000;
  while (Date.now() < readyDeadline && !(await evaluate("Boolean(window.aihubPC?.getCatalog)"))) {
    await delay(200);
  }
  const catalogResult = await evaluate("window.aihubPC.getCatalog()");
  if (catalogResult?.source !== "remote" || catalogResult?.catalogVersion !== requestedCatalogVersion) {
    throw new Error(`active${requestedCatalogVersion} remote catalog was not loaded: ${JSON.stringify(catalogResult)}`);
  }
  const catalog = catalogResult.catalog;
  const desktopProductTypes = new Set([
    "desktop-reviewed", "desktop-official", "desktop-download-only"
  ]);
  const items = catalog.vendors.flatMap((vendor) => (vendor.products || []).map((product) => ({ vendor, product })))
    .filter(({ product }) => desktopProductTypes.has(product.productType) ||
      (product.productType === "web" && product.officialDownload?.kind === "no-windows"))
    .filter(({ product }) => !requestedProduct || product.id === requestedProduct);
  const counts = items.reduce((result, { product }) => {
    const key = product.download ? "direct-artifact" : product.officialDownload?.kind || "missing";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const knownStrategies = new Set([
    "direct-artifact", "vendor-bootstrap", "download-page", "login-required",
    "manual-selector", "store", "stable-redirect", "fixed-redirect", "no-windows"
  ]);
  if (!requestedProduct && (items.length !== 265 || Object.keys(counts).some((key) => !knownStrategies.has(key)))) {
    throw new Error(`active${requestedCatalogVersion} desktop acquisition matrix drifted: ${JSON.stringify({ count: items.length, counts })}`);
  }
  reportMeta = {
    catalogVersion: catalogResult.catalogVersion,
    vendors: catalog.vendors.length,
    products: catalog.vendors.flatMap((vendor) => vendor.products || []).length,
    desktopCount: items.length
  };
  const seen = new Set(rows.map((row) => row.id));
  if (seen.size !== rows.length || [...seen].some((id) => !items.some(({ product }) => product.id === id))) {
    throw new Error("resume report has duplicate or non-current product IDs");
  }
  await evaluate("window.__aihubAcceptanceOpenedUrls = []; window.open = (url) => { window.__aihubAcceptanceOpenedUrls.push(String(url)); return null; };");
  for (const { vendor, product } of items) {
    if (seen.has(product.id)) continue;
    const strategy = product.download ? "direct-artifact" : product.officialDownload.kind;
    const base = {
      id: product.id, name: product.name, strategy, uiAction: "", initialUrl: "",
      finalUrlOrHost: "", networkOrFirstData: "", cancelOrRecovery: "", status: "PASS", reason: ""
    };
    try {
      const ui = await waitForDesktopRow(evaluate, vendor, product);
      if (product.download) {
        const downloadAction = await waitForPackagedManagedDownloadAction({
          evaluate,
          productId: product.id,
          timeoutMs: 15_000
        });
        const first = await firstDataThenPause(evaluate, product, totalReceived);
        const retry = await retryThenPause(evaluate, product, totalReceived);
        const firstTask = first.paused?.task || first.completed;
        const retryTask = retry.paused?.task || retry.completed;
        const firstBytes = firstTask.progress?.receivedBytes || 0;
        const retryBytes = retryTask.progress?.receivedBytes || 0;
        base.uiAction = downloadAction.label || downloadAction.action;
        base.initialUrl = product.download.url;
        base.finalUrlOrHost = new URL(product.download.url).host;
        base.networkOrFirstData = `Electron authorized first data ${firstBytes} bytes; total=${firstTask.progress?.totalBytes || 0}`;
        base.cancelOrRecovery = first.paused && retry.paused
          ? `paused then refresh/retry data ${retryBytes} bytes; native discard confirmation BLOCKED (manual dialog)`
          : `completed before pause; refresh/retry completed at ${retryBytes} bytes; no cancellation dialog was auto-accepted`;
        if (product.id === "blender" && firstTask.progress?.totalBytes === 0) {
          base.networkOrFirstData += "; live response has no Content-Length";
        }
      } else {
        const expectedUrl = product.officialDownload.url;
        const before = await evaluate("window.__aihubAcceptanceOpenedUrls.length");
        const clicked = await evaluate(`(() => {
          const root = document.querySelector('[data-aihub-product-id=${JSON.stringify(product.id)}]');
          const buttons = Array.from(root?.querySelectorAll('.productActions > button') || []);
          const button = buttons.filter((candidate) => !candidate.getAttribute('data-aihub-action')).at(-1);
          if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
          button.click(); return true;
        })()`);
        if (!clicked) throw new Error("official acquisition action is not clickable");
        const opened = await evaluate(`window.__aihubAcceptanceOpenedUrls.slice(${before})`);
        if (product.officialDownload.kind === "no-windows") {
          if (ui.hasInstall) throw new Error("no-windows product exposed desktop install action");
        } else if (!opened.includes(expectedUrl)) {
          throw new Error(`external action mismatch: ${JSON.stringify({ expectedUrl, opened })}`);
        }
        const probe = await probeExternalUrl(expectedUrl);
        base.uiAction = ui.buttons.filter((button) => !button.action).at(-1)?.label || "official external action";
        base.initialUrl = expectedUrl;
        base.finalUrlOrHost = probe.finalUrl || probe.finalHost;
        base.networkOrFirstData = probe.error ? `${probe.transport}: ${probe.error}` : `${probe.transport}; first=${probe.firstBytes} bytes`;
        base.cancelOrRecovery = product.officialDownload.kind === "no-windows" ? "no desktop downloader exposed" : "external entry only; no login/install";
        if (probe.transport === "BLOCKED") {
          base.status = "BLOCKED";
          base.reason = "external site/network probe unavailable";
        } else if (probe.status === 404 && product.officialDownload.kind !== "login-required") {
          base.status = "FAIL";
          base.reason = "catalog/artifact FAIL: configured official external URL returned HTTP 404";
        } else if (probe.status >= 400 && product.officialDownload.kind !== "login-required") {
          base.status = "BLOCKED";
          base.reason = `external network BLOCKED: configured official external URL returned HTTP ${probe.status}`;
        }
      }
    } catch (error) {
      Object.assign(base, classifyDirectFailure(error));
    }
    if (base.strategy === "direct-artifact" && base.status === "PASS") {
      base.status = "BLOCKED";
      base.reason = base.cancelOrRecovery.startsWith("completed before pause")
        ? "small artifact completed before the bounded pause; no automatic cancellation claim"
        : "native discard confirmation requires a real Windows user decision; automation did not auto-accept it";
    }
    rows.push(base);
    if (reportMeta) writeReports(rows, reportMeta);
    process.stdout.write(`${JSON.stringify(base)}\n`);
  }
  writeReports(rows, reportMeta);
  const failed = rows.filter((row) => row.status === "FAIL");
  if (failed.length) process.exitCode = 1;
} finally {
  try {
    await client?.close();
  } finally {
    await removeIsolatedAcceptanceProfile(profile);
  }
}
