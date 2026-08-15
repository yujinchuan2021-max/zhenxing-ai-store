"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildSoftwareUpdateInventory,
  createSoftwareUpdateCenter
} = require("../admin/software-update-center.cjs");
const {
  verifySoftwareUpdateRelease
} = require("../shared/software-update-release.cjs");
const { INSTALL_REGISTRY } = require("../shared/install-registry.cjs");
const {
  EXTENSION_INSTALL_REGISTRY
} = require("../shared/extension-install-registry.cjs");

test("scans every locally reviewed software profile and classifies publishability", () => {
  const entries = buildSoftwareUpdateInventory({
    scannedAt: "2026-08-15T00:00:00.000Z",
    catalog: {
      vendors: [{
        id: "future-vendor",
        name: "未来厂商",
        products: [{
          id: "future-desktop",
          name: "未来桌面软件",
          enabled: true
        }]
      }]
    }
  });
  const ids = new Set(entries.map((entry) => entry.id));
  assert.equal(ids.size, entries.length);
  assert.ok(entries.length >=
    Object.keys(INSTALL_REGISTRY).length +
    Object.keys(EXTENSION_INSTALL_REGISTRY).length + 4
  );
  assert.equal(
    entries.find((entry) => entry.id === "environment:python")?.detectedVersion,
    "3.13.14"
  );
  assert.equal(
    entries.find((entry) => entry.id === "product:docker-desktop")?.status,
    "delegated"
  );
  assert.equal(
    entries.find((entry) => entry.id === "product:codex-cli")?.status,
    "ready"
  );
  assert.equal(
    entries.find((entry) => entry.id === "extension:skill.codex.chatgpt-apps")
      ?.detectedVersion,
    "49f948faa9258a0c61caceaf225e179651397431"
  );
  assert.ok(entries.some((entry) => entry.status === "manual-review"));
  assert.deepEqual(
    entries.find((entry) => entry.id === "product:future-desktop"),
    {
      id: "product:future-desktop",
      kind: "product",
      subjectId: "future-desktop",
      label: "未来厂商 · 未来桌面软件",
      mode: "managed-installer",
      detectedVersion: null,
      status: "manual-review",
      selected: false
    }
  );
});

test("requires scan, review revision, and explicit signed publication", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-software-"));
  const statePath = path.join(directory, "state.json");
  const releasePath = path.join(directory, "software-update-release.json");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const trustedKeys = [{
    keyId: "software-admin-2026",
    publicKey: publicKey
      .export({ format: "der", type: "spki" })
      .toString("base64")
  }];
  let now = "2026-08-15T01:00:00.000Z";
  const center = createSoftwareUpdateCenter({
    statePath,
    releasePath,
    keyId: "software-admin-2026",
    privateKey,
    now: () => now,
    scan: () => [
      {
        id: "environment:python",
        kind: "environment",
        subjectId: "python",
        label: "Python",
        mode: "environment-download",
        detectedVersion: "3.13.14",
        status: "ready",
        selected: true
      },
      {
        id: "product:docker-desktop",
        kind: "product",
        subjectId: "docker-desktop",
        label: "Docker Desktop",
        mode: "package-manager",
        detectedVersion: null,
        status: "delegated",
        selected: true
      },
      {
        id: "product:chatgpt-desktop",
        kind: "product",
        subjectId: "chatgpt-desktop",
        label: "ChatGPT Desktop",
        mode: "managed-installer",
        detectedVersion: null,
        status: "vendor-managed",
        selected: false
      }
    ]
  });

  assert.equal(center.snapshot().revision, 0);
  const scanned = center.scan({ expectedRevision: 0 });
  assert.equal(scanned.revision, 1);
  assert.equal(scanned.entries.length, 3);
  assert.throws(
    () => center.saveReview({ expectedRevision: 0, selectedIds: [] }),
    /修订|刷新/
  );

  const reviewed = center.saveReview({
    expectedRevision: 1,
    selectedIds: ["environment:python", "product:docker-desktop"]
  });
  assert.equal(reviewed.revision, 2);
  now = "2026-08-15T02:00:00.000Z";
  const published = center.publish({
    expectedRevision: 2,
    rollout: { percentage: 100, salt: "software-stable-2026" }
  });
  assert.equal(published.activeReleaseVersion, 1);
  assert.equal(fs.existsSync(releasePath), true);

  const verified = verifySoftwareUpdateRelease(
    JSON.parse(fs.readFileSync(releasePath, "utf8")),
    {
      trustedKeys,
      clientId: "client-software-1234"
    }
  );
  assert.deepEqual(verified.entries.map((entry) => entry.id), [
    "environment:python",
    "product:docker-desktop"
  ]);
  assert.equal(JSON.stringify(verified).includes("cmd.exe"), false);
  assert.equal(JSON.stringify(verified).includes("downloadUrl"), false);

  const clearedReview = center.saveReview({
    expectedRevision: published.revision,
    selectedIds: []
  });
  now = "2026-08-15T03:00:00.000Z";
  const cleared = center.publish({
    expectedRevision: clearedReview.revision,
    rollout: { percentage: 100, salt: "software-stable-2026" }
  });
  assert.equal(cleared.activeReleaseVersion, 2);
  const clearedRelease = verifySoftwareUpdateRelease(
    JSON.parse(fs.readFileSync(releasePath, "utf8")),
    { trustedKeys, clientId: "client-software-1234" }
  );
  assert.deepEqual(clearedRelease.entries, []);
});
