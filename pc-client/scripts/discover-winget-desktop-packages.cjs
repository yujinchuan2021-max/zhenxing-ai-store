"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "..");
const catalog = require("../admin/data/catalog-v1.json");
const outputPath = path.join(
  root,
  "output",
  "catalog-research",
  "winget-desktop-candidates.json"
);

const COMMON_WORDS = new Set([
  "ai",
  "app",
  "application",
  "client",
  "desktop",
  "editor",
  "for",
  "ide",
  "pc",
  "pro",
  "studio",
  "windows",
  "with"
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !COMMON_WORDS.has(token));
}

function parseTable(text) {
  const lines = String(text || "").split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => /^Name\s+Id\s+Version(?:\s+Match)?\s*$/.test(line.trim())
  );
  if (headerIndex < 0 || !/^[-\s]+$/.test(lines[headerIndex + 1] || "")) {
    return [];
  }
  const header = lines[headerIndex];
  const idAt = header.indexOf("Id");
  const versionAt = header.indexOf("Version");
  const matchAt = header.indexOf("Match");
  return lines
    .slice(headerIndex + 2)
    .filter((line) => line.trim())
    .map((line) => ({
      name: line.slice(0, idAt).trim(),
      packageId: line.slice(idAt, versionAt).trim(),
      version: line
        .slice(versionAt, matchAt < 0 ? undefined : matchAt)
        .trim(),
      match: matchAt < 0 ? "" : line.slice(matchAt).trim()
    }))
    .filter((row) => /^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(row.packageId));
}

function scoreCandidate(product, vendor, candidate) {
  const productName = normalize(product.name);
  const candidateName = normalize(candidate.name);
  const candidateId = normalize(candidate.packageId);
  const productTokens = new Set([
    ...tokens(product.name),
    ...tokens(product.id.replace(`${vendor.id}-`, ""))
  ]);
  const candidateTokens = new Set([
    ...tokens(candidate.name),
    ...tokens(candidate.packageId)
  ]);
  let score = 0;
  if (productName && productName === candidateName) score += 120;
  else if (
    productName &&
    (candidateName.includes(productName) || productName.includes(candidateName))
  ) {
    score += 70;
  }
  for (const token of productTokens) {
    if (candidateTokens.has(token)) score += token.length >= 5 ? 12 : 7;
  }
  const vendorTokens = tokens(`${vendor.id} ${vendor.name}`);
  if (vendorTokens.some((token) => candidateId.includes(token))) score += 18;
  if (/\b(?:cli|sdk|extension|plugin)\b/i.test(candidate.name)) score -= 50;
  if (/\b(?:insiders|beta|preview|nightly)\b/i.test(candidate.name)) score -= 20;
  return score;
}

async function findWinget() {
  const command = [
    "$package = Get-AppxPackage Microsoft.DesktopAppInstaller |",
    "Sort-Object Version -Descending | Select-Object -First 1;",
    "if ($package) { Join-Path $package.InstallLocation 'winget.exe' }"
  ].join(" ");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", windowsHide: true }
  );
  const executable = stdout.trim();
  if (!executable || !fs.existsSync(executable)) {
    throw new Error("Windows Package Manager is unavailable");
  }
  return executable;
}

function searchQueries(product) {
  const values = [product.name];
  const idWords = product.id
    .split("-")
    .filter((word) => !COMMON_WORDS.has(word) && word.length > 2);
  if (idWords.length) {
    values.push(
      idWords.join(" "),
      idWords.slice(-2).join(" "),
      idWords[0],
      idWords.at(-1)
    );
  }
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

async function searchProduct(executable, vendor, product) {
  const candidates = new Map();
  const failures = [];
  for (const query of searchQueries(product)) {
    try {
      const { stdout } = await execFileAsync(
        executable,
        [
          "search",
          "--name",
          query,
          "--source",
          "winget",
          "--count",
          "10",
          "--accept-source-agreements",
          "--disable-interactivity"
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30_000 }
      );
      for (const candidate of parseTable(stdout)) {
        const scored = {
          ...candidate,
          score: scoreCandidate(product, vendor, candidate),
          query
        };
        const previous = candidates.get(candidate.packageId);
        if (!previous || previous.score < scored.score) {
          candidates.set(candidate.packageId, scored);
        }
      }
    } catch (error) {
      failures.push({ query, error: String(error.message || error) });
    }
  }
  return {
    productId: product.id,
    productName: product.name,
    vendorId: vendor.id,
    vendorName: vendor.name,
    website: product.website,
    candidates: [...candidates.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, 8),
    failures
  };
}

function parsePackageDetails(text) {
  const details = {};
  let inInstaller = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    if (line.trim() === "Installer:") {
      inInstaller = true;
      continue;
    }
    const match = /^\s{0,2}([A-Za-z][A-Za-z ]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
    details[inInstaller ? `installer_${key}` : key] = match[2].trim();
  }
  return details;
}

async function inspectTopCandidate(executable, result) {
  const top = result.candidates[0];
  if (!top) return result;
  try {
    const { stdout } = await execFileAsync(
      executable,
      [
        "show",
        "--id",
        top.packageId,
        "--exact",
        "--source",
        "winget",
        "--accept-source-agreements",
        "--disable-interactivity"
      ],
      { encoding: "utf8", windowsHide: true, timeout: 30_000 }
    );
    return { ...result, topDetails: parsePackageDetails(stdout) };
  } catch (error) {
    return {
      ...result,
      topDetailsError: String(error.message || error)
    };
  }
}

async function mapConcurrent(values, concurrency, callback) {
  const output = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await callback(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return output;
}

async function main() {
  const executable = await findWinget();
  const products = catalog.vendors.flatMap((vendor) =>
    vendor.products
      .filter((product) => product.productType === "desktop-official")
      .map((product) => ({ vendor, product }))
  );
  const weakOnly = process.argv.includes("--weak-only");
  let previousResults = new Map();
  if (weakOnly && fs.existsSync(outputPath)) {
    const previous = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    previousResults = new Map(
      (previous.results || []).map((result) => [result.productId, result])
    );
  }
  const selectedProducts = weakOnly
    ? products.filter(({ product }) => {
        const previous = previousResults.get(product.id);
        return (previous?.candidates?.[0]?.score || 0) < 100;
      })
    : products;
  const candidates = await mapConcurrent(selectedProducts, 4, ({ vendor, product }) =>
    searchProduct(executable, vendor, product)
  );
  const inspected = await mapConcurrent(candidates, 4, (result) =>
    inspectTopCandidate(executable, result)
  );
  const refreshed = new Map(
    inspected.map((result) => [result.productId, result])
  );
  const results = products.map(({ product }) =>
    refreshed.get(product.id) || previousResults.get(product.id)
  );
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    wingetExecutable: executable,
    summary: {
      total: results.length,
      withCandidates: results.filter((result) => result.candidates.length).length,
      highConfidence: results.filter(
        (result) => (result.candidates[0]?.score || 0) >= 100
      ).length
    },
    results
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.summary));
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
