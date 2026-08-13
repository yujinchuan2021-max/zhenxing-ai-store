"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  CHECK_FIELDS,
  createProductCertification
} = require("../admin/product-certification.cjs");

function completedChecks() {
  return Object.fromEntries(CHECK_FIELDS.map((field) => [field, true]));
}

function enabledCatalog(productId = "chatgpt-desktop") {
  return {
    vendors: [{
      enabled: true,
      products: [{
        id: productId,
        name: productId,
        enabled: true,
        capabilities: ["install"]
      }]
    }]
  };
}

test("desktop certification preserves history and follows the reviewed contract", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-certification-"));
  const filePath = path.join(directory, "acceptance.json");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const certification = createProductCertification({
    filePath,
    clock: () => "2026-08-01T12:00:00.000Z"
  });

  const initial = certification.snapshot();
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.summary, {
    total: 38,
    pending: 0,
    reviewed: 38,
    accepted: 0
  });

  const acceptedState = certification.update({
    productId: "chatgpt-desktop",
    status: "accepted",
    expectedRevision: 0,
    changedBy: "验收用户",
    clientVersion: "0.1.25",
    windowsVersion: "Windows 11 24H2",
    evidenceReference: "docs/user-acceptance-checklist.md",
    notes: "安装、打开和卸载通过",
    checks: completedChecks()
  });
  const accepted = acceptedState.products.find(
    (item) => item.productId === "chatgpt-desktop"
  );
  assert.equal(acceptedState.revision, 1);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.acceptance.acceptedAt, "2026-08-01T12:00:00.000Z");
  assert.equal(
    accepted.acceptance.executionContractSha256,
    accepted.review.executionContractSha256
  );

  const reviewedState = certification.update({
    productId: "chatgpt-desktop",
    status: "reviewed",
    expectedRevision: 1,
    changedBy: "验收用户",
    notes: "准备重新验收"
  });
  const reviewed = reviewedState.products.find(
    (item) => item.productId === "chatgpt-desktop"
  );
  assert.equal(reviewed.status, "reviewed");
  assert.equal(reviewed.historyCount, 2);
  const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(stored.records["chatgpt-desktop"].history[0].status, "accepted");

  const pendingState = certification.update({
    productId: "chatgpt-desktop",
    status: "pending",
    expectedRevision: 2,
    changedBy: "验收用户",
    notes: "官方安装流程待复核"
  });
  assert.equal(
    pendingState.products.find((item) => item.productId === "chatgpt-desktop").status,
    "pending"
  );
  assert.throws(
    () => certification.validateCatalog(enabledCatalog()),
    /待审核产品不能发布安装能力/
  );

  assert.throws(
    () => certification.update({
      productId: "chatgpt-desktop",
      status: "reviewed",
      expectedRevision: 2,
      changedBy: "验收用户",
      notes: "旧页面覆盖"
    }),
    /已变化/
  );
  assert.throws(
    () => certification.update({
      productId: "chatgpt-desktop",
      status: "accepted",
      expectedRevision: 3,
      changedBy: "验收用户",
      clientVersion: "0.1.25",
      windowsVersion: "Windows 11",
      evidenceReference: "记录",
      notes: "",
      checks: completedChecks(),
      command: "powershell.exe"
    }),
    /验收操作无效/
  );
});

test("a changed execution hash makes the latest device acceptance stale", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-certification-"));
  const filePath = path.join(directory, "acceptance.json");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const certification = createProductCertification({ filePath });
  certification.update({
    productId: "chatgpt-desktop",
    status: "accepted",
    expectedRevision: 0,
    changedBy: "验收用户",
    clientVersion: "0.1.25",
    windowsVersion: "Windows 11",
    evidenceReference: "记录",
    notes: "",
    checks: completedChecks()
  });
  const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
  stored.records["chatgpt-desktop"].history.at(-1).executionContractSha256 =
    "0".repeat(64);
  fs.writeFileSync(filePath, JSON.stringify(stored), "utf8");
  const stale = certification.snapshot().products.find(
    (item) => item.productId === "chatgpt-desktop"
  );
  assert.equal(stale.status, "reviewed");
  assert.equal(stale.staleAcceptance, true);
  assert.equal(stale.acceptance, null);
});
