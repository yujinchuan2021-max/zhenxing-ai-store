"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const catalog = require("../admin/data/catalog-v1.json");
const {
  evaluateDesktopSourceProbe,
  parseCurlProbeOutput
} = require("../shared/desktop-source-audit.cjs");
const { getManagedDownload } = require("../shared/managed-downloads.cjs");

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "..");
const outputPath = path.join(
  root,
  "output",
  "audits",
  "latest-desktop-source-audit.json"
);
const probeDirectory = path.dirname(outputPath);
const concurrency = 5;

function reviewedDesktopProducts() {
  return catalog.vendors.flatMap((vendor) =>
    vendor.products
      .filter((product) => product.productType === "desktop-reviewed")
      .map((product) => ({
        productId: product.id,
        productName: product.name,
        vendorId: vendor.id,
        vendorName: vendor.name,
        plan: getManagedDownload(product.id)
      }))
  );
}

function curlExitCode(error) {
  const value = Number(error?.code);
  return Number.isInteger(value) ? value : 1;
}

async function probeProduct(product) {
  if (!product.plan) {
    return {
      ...product,
      plan: null,
      probe: null,
      evaluation: {
        ok: false,
        reasons: ["client managed-download plan is missing"],
        warnings: []
      }
    };
  }

  const probePath = path.join(
    probeDirectory,
    `.source-probe-${process.pid}-${product.productId}.bin`
  );
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--range",
    "0-15",
    "--max-filesize",
    "16",
    "--connect-timeout",
    "8",
    "--max-time",
    "25",
    "--output",
    probePath,
    "--user-agent",
    "AI-Hub-PC/source-audit",
    "--write-out",
    "%{json}",
    product.plan.url
  ];

  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const result = await execFileAsync("curl.exe", args, {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true
    });
    stdout = result.stdout || "";
    stderr = result.stderr || "";
  } catch (error) {
    stdout = error?.stdout || "";
    stderr = error?.stderr || error?.message || "";
    exitCode = curlExitCode(error);
  }

  let magicHex = "";
  try {
    magicHex = fs.readFileSync(probePath).subarray(0, 16).toString("hex");
  } catch {
    magicHex = "";
  } finally {
    try {
      fs.unlinkSync(probePath);
    } catch {
      // A failed or header-only request may not create a probe file.
    }
  }

  let response;
  try {
    response = parseCurlProbeOutput(stdout);
  } catch (error) {
    response = { statusCode: 0, finalUrl: "", contentType: "" };
    stderr = [stderr, error.message].filter(Boolean).join("; ");
  }
  const probe = {
    ...response,
    magicHex,
    exitCode,
    error: stderr.trim()
  };
  return {
    productId: product.productId,
    productName: product.productName,
    vendorId: product.vendorId,
    vendorName: product.vendorName,
    plan: {
      url: product.plan.url,
      allowedHosts: product.plan.allowedHosts
    },
    probe,
    evaluation: evaluateDesktopSourceProbe({ plan: product.plan, probe })
  };
}

async function mapConcurrent(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

function statusLabel(result) {
  return result.evaluation.ok ? "PASS" : "FAIL";
}

async function main() {
  fs.mkdirSync(probeDirectory, { recursive: true });
  const products = reviewedDesktopProducts();
  const results = await mapConcurrent(products, concurrency, probeProduct);
  const passed = results.filter((result) => result.evaluation.ok).length;
  const failed = results.length - passed;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: "reviewed Windows desktop download sources",
    summary: { total: results.length, passed, failed },
    results
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  for (const result of results) {
    const details = result.evaluation.ok
      ? result.evaluation.warnings.join("; ")
      : result.evaluation.reasons.join("; ");
    console.log(
      `${statusLabel(result).padEnd(4)} ${result.productId.padEnd(34)} ${
        result.probe?.statusCode || "-"
      } ${details}`.trimEnd()
    );
  }
  console.log(`\nDesktop sources: ${passed}/${results.length} passed`);
  console.log(`Report: ${outputPath}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
