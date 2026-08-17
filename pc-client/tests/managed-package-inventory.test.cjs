"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  discoverManagedPackages,
  reviewedManagedPackagePlan
} = require("../shared/managed-package-inventory.cjs");

test("vendor-controlled local packages require an explicit reviewed signer", () => {
  const basePlan = {
    fileName: "Vendor Setup.exe",
    url: "https://vendor.example/Vendor%20Setup.exe"
  };
  assert.match(
    reviewedManagedPackagePlan("canva-windows", basePlan).expectedSigner.source,
    /Canva/
  );
  assert.match(
    reviewedManagedPackagePlan("nous-hermes-desktop", basePlan).expectedSigner.source,
    /Nous Research/
  );
  assert.equal(reviewedManagedPackagePlan("unknown-desktop", basePlan), null);
});

test("first package inventory discovers only reviewed direct-child installers", async (t) => {
  const downloadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-package-inventory-"));
  t.after(() => fs.rmSync(downloadRoot, { recursive: true, force: true }));
  const alphaPath = path.join(downloadRoot, "Alpha Setup.exe");
  const betaPath = path.join(downloadRoot, "Beta Setup (1).exe");
  const ignoredPath = path.join(downloadRoot, "Unknown Setup.exe");
  fs.writeFileSync(alphaPath, "alpha-installer");
  fs.writeFileSync(betaPath, "beta-installer");
  fs.writeFileSync(ignoredPath, "unknown-installer");

  const inspected = [];
  const hashed = [];
  const records = await discoverManagedPackages({
    downloadRoot,
    plans: [
      {
        productId: "alpha-desktop",
        fileName: "Alpha Setup.exe",
        url: "https://alpha.example/Alpha%20Setup.exe",
        artifactKind: "exe",
        expectedSigner: /^CN=Alpha Publisher(?:,|$)/i
      },
      {
        productId: "beta-desktop",
        fileName: "Beta Setup.exe",
        url: "https://beta.example/Beta%20Setup.exe",
        artifactKind: "exe",
        expectedSigner: /^CN=Beta Publisher(?:,|$)/i
      }
    ],
    inspectSignature: async (filePath) => {
      inspected.push(path.basename(filePath));
      return {
        status: "Valid",
        signer: filePath === alphaPath
          ? "CN=Alpha Publisher, O=Alpha"
          : "CN=Beta Publisher, O=Beta"
      };
    },
    hashFile: async (filePath) => {
      hashed.push(path.basename(filePath));
      return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    },
    now: () => "2026-08-17T00:00:00.000Z"
  });

  assert.deepEqual(records.map((record) => record.productId), [
    "alpha-desktop",
    "beta-desktop"
  ]);
  assert.deepEqual(inspected, ["Alpha Setup.exe", "Beta Setup (1).exe"]);
  assert.deepEqual(hashed, ["Alpha Setup.exe", "Beta Setup (1).exe"]);
  assert.deepEqual(records.map((record) => ({
    productId: record.productId,
    fileName: record.fileName,
    filePath: record.filePath,
    source: record.source,
    downloadedAt: record.downloadedAt
  })), [
    {
      productId: "alpha-desktop",
      fileName: "Alpha Setup.exe",
      filePath: alphaPath,
      source: "本地已验证安装包",
      downloadedAt: "2026-08-17T00:00:00.000Z"
    },
    {
      productId: "beta-desktop",
      fileName: "Beta Setup.exe",
      filePath: betaPath,
      source: "本地已验证安装包",
      downloadedAt: "2026-08-17T00:00:00.000Z"
    }
  ]);
  assert.equal(records.every((record) => /^[a-f0-9]{64}$/.test(record.sha256)), true);
  assert.equal(records[0].fileSize, Buffer.byteLength("alpha-installer"));
  assert.equal(records[1].fileSize, Buffer.byteLength("beta-installer"));
  assert.equal(fs.existsSync(ignoredPath), true);
});
