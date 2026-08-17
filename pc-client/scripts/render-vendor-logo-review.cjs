"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const root = path.join(__dirname, "..");
const repositoryRoot = path.join(root, "..");
const catalogPath = path.join(root, "admin", "data", "catalog-v1.json");
const iconRoot = path.join(root, "admin", "data");
const outputDirectory = path.join(root, "output", "catalog-research", "vendor-logo-review");
const baseRef = process.argv[2] || "HEAD";

function readBaseCatalog() {
  try {
    return JSON.parse(
      execFileSync(
        "git",
        ["show", `${baseRef}:pc-client/admin/data/catalog-v1.json`],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 32 * 1024 * 1024
        }
      )
    );
  } catch (error) {
    process.stderr.write(
      `无法读取 ${baseRef} 的基线目录，将审阅全部当前 Logo：${error.message}\n`
    );
    return { vendors: [] };
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageFileUrl(vendor) {
  return pathToFileURL(path.join(iconRoot, vendor.iconAsset.path)).href;
}

function pageHtml(vendors, manifest, pageNumber, pageCount) {
  const cards = vendors
    .map((vendor) => {
      const source = manifest.assets[vendor.iconAsset.sha256];
      return `<article>
        <div class="icon"><img src="${imageFileUrl(vendor)}" alt="${escapeHtml(vendor.name)}"></div>
        <strong>${escapeHtml(vendor.name)}</strong>
        <code>${escapeHtml(vendor.id)}</code>
        <small>${escapeHtml(source?.sourceUrl || "source missing")}</small>
      </article>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#eef4f0;color:#10251d;font:14px/1.35 "Segoe UI",sans-serif}
    header{height:52px;display:flex;align-items:flex-start;justify-content:space-between}h1{font-size:22px;margin:0}p{margin:4px 0;color:#53645d}
    main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}article{height:132px;min-width:0;padding:12px;border:1px solid #cad8d1;border-radius:14px;background:white;display:grid;grid-template-columns:58px 1fr;grid-template-rows:24px 22px 1fr;column-gap:10px;overflow:hidden}
    .icon{grid-row:1/4;width:58px;height:58px;border-radius:12px;background:repeating-conic-gradient(#edf2ef 0 25%,#fff 0 50%) 50%/12px 12px;display:grid;place-items:center;overflow:hidden}.icon img{width:50px;height:50px;object-fit:contain}
    strong,code,small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}strong{font-size:15px}code{color:#476057}small{font-size:10px;color:#718179;align-self:end}
  </style><body><header><div><h1>枕星AI助手 · 官方 Logo 变更审阅</h1><p>检查错品牌、透明低对比、裁切与过度留白</p></div><b>${pageNumber}/${pageCount}</b></header><main>${cards}</main></body>`;
}

async function main() {
  const current = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const base = readBaseCatalog();
  const baseHashes = new Map(
    base.vendors.map((vendor) => [vendor.id, vendor.iconAsset?.sha256 || ""])
  );
  const changed = current.vendors.filter(
    (vendor) =>
      vendor.iconAsset && baseHashes.get(vendor.id) !== vendor.iconAsset.sha256
  );
  if (!changed.length) throw new Error(`相对 ${baseRef} 没有待审阅的 Logo 变更`);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "admin", "data", "vendor-icon-sources.json"), "utf8")
  );
  fs.mkdirSync(outputDirectory, { recursive: true });
  const pages = Array.from(
    { length: Math.ceil(changed.length / 30) },
    (_, index) => changed.slice(index * 30, index * 30 + 30)
  );

  const window = new BrowserWindow({
    width: 1100,
    height: 1040,
    show: false,
    webPreferences: { sandbox: true }
  });
  for (const [index, vendors] of pages.entries()) {
    const htmlPath = path.join(
      outputDirectory,
      `vendor-logo-review-${String(index + 1).padStart(2, "0")}.html`
    );
    fs.writeFileSync(
      htmlPath,
      pageHtml(vendors, manifest, index + 1, pages.length),
      "utf8"
    );
    await window.loadFile(htmlPath);
    const image = await window.webContents.capturePage();
    const outputPath = path.join(
      outputDirectory,
      `vendor-logo-review-${String(index + 1).padStart(2, "0")}.png`
    );
    fs.writeFileSync(outputPath, image.toPNG());
    process.stdout.write(`${outputPath}\n`);
  }
  window.destroy();
}

app.whenReady().then(main).then(() => app.quit()).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  app.exit(1);
});
