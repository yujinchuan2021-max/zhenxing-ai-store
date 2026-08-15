"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HASHED_BUNDLE = /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:css|js)$/;
const ASSET_REFERENCE = /(?:src|href)=["']\.\/(assets\/[^"']+)["']/g;

function normalizedFiles(files) {
  if (!Array.isArray(files)) throw new TypeError("Renderer dist files are invalid");
  return files.map((file) => String(file).replace(/\\/g, "/").replace(/^\/+/, ""));
}

function clearRendererDistBundles(root) {
  if (!path.isAbsolute(root)) throw new TypeError("Renderer dist root is invalid");
  const rootEntry = fs.lstatSync(root);
  const assets = path.join(root, "assets");
  const assetsEntry = fs.lstatSync(assets);
  if (
    !rootEntry.isDirectory() ||
    rootEntry.isSymbolicLink() ||
    !assetsEntry.isDirectory() ||
    assetsEntry.isSymbolicLink()
  ) {
    throw new Error("Renderer dist root is unsafe");
  }
  let removedBundleCount = 0;
  for (const entry of fs.readdirSync(assets, { withFileTypes: true })) {
    const relative = `assets/${entry.name}`;
    if (!HASHED_BUNDLE.test(relative)) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error("Renderer bundle entry is unsafe");
    }
    fs.unlinkSync(path.join(assets, entry.name));
    removedBundleCount += 1;
  }
  return { removedBundleCount };
}

function assertRendererDistClosure({ files, indexHtml }) {
  if (typeof indexHtml !== "string") throw new TypeError("Renderer index is invalid");
  const entries = normalizedFiles(files);
  const referenced = new Set(
    [...indexHtml.matchAll(ASSET_REFERENCE)]
      .map((match) => match[1])
      .filter((file) => HASHED_BUNDLE.test(file))
  );
  const scripts = [...referenced].filter((file) => file.endsWith(".js"));
  const styles = [...referenced].filter((file) => file.endsWith(".css"));
  if (scripts.length !== 1 || styles.length !== 1) {
    throw new Error("Renderer index must reference one hashed script and stylesheet");
  }
  const unreferenced = entries.filter(
    (file) => HASHED_BUNDLE.test(file) && !referenced.has(file)
  );
  if (unreferenced.length > 0) {
    throw new Error("Renderer dist contains an unreferenced hashed bundle");
  }
  for (const file of referenced) {
    if (!entries.includes(file)) throw new Error("Renderer index references a missing bundle");
  }
  return { referencedBundleCount: referenced.size };
}

function directoryFiles(root, current = root) {
  const result = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...directoryFiles(root, absolute));
    else if (entry.isFile()) result.push(path.relative(root, absolute));
    else throw new Error("Renderer dist contains a non-file entry");
  }
  return result;
}

function assertRendererDistDirectory(root) {
  return assertRendererDistClosure({
    files: directoryFiles(root),
    indexHtml: fs.readFileSync(path.join(root, "index.html"), "utf8")
  });
}

function assertRendererDistAsar(asarPath) {
  const asar = require("@electron/asar");
  const files = asar
    .listPackage(asarPath)
    .map((entry) => String(entry).replace(/\\/g, "/").replace(/^\/+/, ""))
    .filter((entry) => entry.startsWith("dist/"))
    .map((entry) => entry.slice("dist/".length));
  return assertRendererDistClosure({
    files,
    indexHtml: asar.extractFile(asarPath, "dist/index.html").toString("utf8")
  });
}

module.exports = {
  assertRendererDistAsar,
  assertRendererDistClosure,
  assertRendererDistDirectory,
  clearRendererDistBundles
};
