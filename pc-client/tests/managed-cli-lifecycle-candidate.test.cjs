"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createManagedCliLifecycleCandidate,
  createPortableBinaryLifecycleExecutor,
  receiptOwnsPortableBinaryPlan
} = require("../shared/managed-cli-lifecycle-candidate.cjs");

const NOW = "2026-08-08T01:00:00.000Z";

function registration(capabilities = ["install", "update", "repair", "uninstall"]) {
  return {
    "demo-cli": {
      profileId: "cli.demo",
      moduleId: "cli-managed",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      requirements: ["node"],
      capabilities
    }
  };
}

function plans() {
  return { "demo-cli": { driver: "npm", packageName: "fixed-package", installSpec: "fixed-package@1.0.0" } };
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function portablePlan(digest) {
  return {
    driver: "portable-binary",
    name: "Demo Portable CLI",
    version: "1.0.0",
    commandName: "demo",
    artifacts: {
      x64: {
        url: "https://example.com/demo-cli/demo.exe",
        fileName: "demo.exe",
        sha256: digest,
        maximumBytes: 4096,
        allowedHosts: ["example.com"]
      }
    }
  };
}

function lifecycle({ receipt = null, confirm = true, executor = null } = {}) {
  let currentReceipt = receipt;
  let sequence = 0;
  return {
    setReceipt(value) { currentReceipt = value; },
    client: createManagedCliLifecycleCandidate({
      registrations: registration(),
      plans: plans(),
      readReceipt: async () => currentReceipt,
      receiptOwnsPlan: ({ receipt: value }) => value?.profileId === "cli.demo",
      verifyUserConfirmation: async (input) => confirm === true && input.useId === "use-1",
      executor,
      now: () => NOW,
      makeId: () => `plan-${++sequence}`
    })
  };
}

test("fixed CLI lifecycle exposes only plan/confirm/apply and dry-run never deploys", async () => {
  const { client } = lifecycle();
  assert.deepEqual(Object.keys(client), ["plan", "confirm", "apply"]);
  const planned = await client.plan({ productId: "demo-cli", operation: "install", useId: "use-1" });
  assert.equal(planned.value.state, "confirmation-required");
  assert.equal(planned.value.profileId, "cli.demo");
  assert.equal(JSON.stringify(planned).includes("fixed-package"), false);
  assert.equal((await client.confirm({ planId: "plan-1", useId: "other-use", confirmationId: "confirm-1" })).error, "CONFIRMATION_NOT_ALLOWED");
  assert.equal((await client.confirm({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1" })).value.state, "confirmed");
  const dryRun = await client.apply({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1", dryRun: true });
  assert.deepEqual(dryRun.value, {
    planId: "plan-1",
    state: "dry-run",
    receipt: { ownership: "aihub", action: "install", persisted: false, receiptId: null, version: "" },
    rollback: { required: true, executed: false }
  });
  assert.equal((await client.apply({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1", dryRun: false })).error, "FIXED_EXECUTOR_UNAVAILABLE");
});

test("update/repair require an unrevoked receipt and recheck it immediately before apply", async () => {
  const owned = { receiptId: "receipt-1", profileId: "cli.demo", revokedAt: null };
  const subject = lifecycle({ receipt: owned });
  const planned = await subject.client.plan({ productId: "demo-cli", operation: "repair", useId: "use-1" });
  assert.equal(planned.ok, true);
  await subject.client.confirm({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1" });
  subject.setReceipt({ ...owned, revokedAt: NOW });
  assert.equal((await subject.client.apply({
    planId: "plan-1", useId: "use-1", confirmationId: "confirm-1", dryRun: true
  })).error, "OWNED_RECEIPT_REVOKED");
  assert.equal((await lifecycle({ receipt: { ...owned, revokedAt: NOW } }).client.plan({
    productId: "demo-cli", operation: "update", useId: "use-1"
  })).error, "OWNED_RECEIPT_REQUIRED");
});

test("only a fixed executor can apply and its failed rollback remains explicit", async () => {
  let seen = null;
  const { client } = lifecycle({
    executor: {
      applyFixedPlan: async (input) => {
        seen = input;
        return { ok: false, rollback: { restored: true } };
      }
    }
  });
  await client.plan({ productId: "demo-cli", operation: "install", useId: "use-1" });
  await client.confirm({ planId: "plan-1", useId: "use-1", confirmationId: "confirm-1" });
  assert.equal((await client.apply({
    planId: "plan-1", useId: "use-1", confirmationId: "confirm-1", dryRun: false
  })).error, "APPLY_FAILED_ROLLED_BACK");
  assert.deepEqual(Object.keys(seen).sort(), ["moduleId", "operation", "plan", "productId", "profileId", "receipt"]);
  assert.equal(seen.productId, "demo-cli");
  assert.equal(seen.plan.installSpec, "fixed-package@1.0.0");
});

test("portable-binary executor applies, rechecks, writes receipt, rolls back failure, and uninstalls in isolation", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cli-lifecycle-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source.exe");
  const badSource = path.join(root, "bad.exe");
  fs.writeFileSync(source, Buffer.concat([Buffer.from("MZ"), Buffer.alloc(2046, 1)]));
  fs.writeFileSync(badSource, Buffer.concat([Buffer.from("MZ"), Buffer.alloc(2046, 2)]));
  const digest = sha256(source);
  const registry = {
    "demo-portable-cli": {
      profileId: "cli.demo-portable",
      moduleId: "cli-managed",
      productType: "cli",
      kind: "CLI",
      mode: "managed-cli",
      requirements: [],
      capabilities: ["install", "update", "repair", "uninstall"]
    }
  };
  const plan = portablePlan(digest);
  let receipt = null;
  let artifactPath = source;
  let sequence = 0;
  const store = {
    read: () => receipt,
    write: async (productId, next) => {
      assert.equal(productId, "demo-portable-cli");
      receipt = next;
    },
    remove: async () => {
      receipt = null;
    }
  };
  const client = createManagedCliLifecycleCandidate({
    registrations: registry,
    plans: { "demo-portable-cli": plan },
    readReceipt: async () => receipt,
    receiptOwnsPlan: ({ productId, plan: fixedPlan, receipt: candidate }) => receiptOwnsPortableBinaryPlan({
      productId,
      plan: fixedPlan,
      receipt: candidate,
      installRoot: root,
      architecture: "x64",
      hashFile: sha256
    }),
    verifyUserConfirmation: async ({ useId }) => useId === "use-1",
    executor: createPortableBinaryLifecycleExecutor({
      installRoot: root,
      architecture: "x64",
      receiptStore: store,
      artifactProvider: async () => ({ filePath: artifactPath }),
      hashFile: sha256,
      now: () => NOW,
      randomBytes: () => Buffer.alloc(24, 3),
      randomId: () => `tx-${++sequence}`,
      makeReceiptId: () => `receipt-${sequence + 1}`
    }),
    now: () => NOW,
    makeId: () => `plan-${++sequence}`
  });

  const installPlan = await client.plan({ productId: "demo-portable-cli", operation: "install", useId: "use-1" });
  assert.equal(installPlan.ok, true);
  assert.equal((await client.confirm({ planId: installPlan.value.planId, useId: "use-1", confirmationId: "confirm-1" })).ok, true);
  const applied = await client.apply({ planId: installPlan.value.planId, useId: "use-1", confirmationId: "confirm-1", dryRun: false });
  assert.equal(applied.ok, true);
  assert.equal(applied.value.state, "applied");
  assert.equal(applied.value.receipt.persisted, true);
  assert.equal(applied.value.status.installed, true);
  const installedExe = receipt.executable;
  const installedReceipt = receipt;
  assert.equal(sha256(installedExe), digest);

  artifactPath = badSource;
  const updatePlan = await client.plan({ productId: "demo-portable-cli", operation: "update", useId: "use-1" });
  assert.equal(updatePlan.ok, true);
  assert.equal((await client.confirm({ planId: updatePlan.value.planId, useId: "use-1", confirmationId: "confirm-2" })).ok, true);
  assert.equal((await client.apply({
    planId: updatePlan.value.planId, useId: "use-1", confirmationId: "confirm-2", dryRun: false
  })).error, "APPLY_FAILED_ROLLED_BACK");
  assert.deepEqual(receipt, installedReceipt);
  assert.equal(sha256(installedExe), digest);

  artifactPath = source;
  const uninstallPlan = await client.plan({ productId: "demo-portable-cli", operation: "uninstall", useId: "use-1" });
  assert.equal(uninstallPlan.ok, true);
  assert.equal((await client.confirm({ planId: uninstallPlan.value.planId, useId: "use-1", confirmationId: "confirm-3" })).ok, true);
  const removed = await client.apply({ planId: uninstallPlan.value.planId, useId: "use-1", confirmationId: "confirm-3", dryRun: false });
  assert.equal(removed.ok, true);
  assert.equal(removed.value.receipt.persisted, false);
  assert.equal(removed.value.status.installed, false);
  assert.equal(receipt, null);
  assert.equal(fs.existsSync(installedExe), false);
});

test("unknown capabilities and hostile execution fields fail closed", async () => {
  const { client } = lifecycle();
  assert.equal((await client.plan({ productId: "demo-cli", operation: "install", useId: "use-1", command: "whoami" })).error, "INPUT_INVALID");
  assert.equal((await createManagedCliLifecycleCandidate({
    registrations: registration(["install"]), plans: plans(), now: () => NOW, makeId: () => "plan-1"
  }).plan({ productId: "demo-cli", operation: "repair", useId: "use-1" })).error, "FIXED_PROFILE_UNAVAILABLE");
});
