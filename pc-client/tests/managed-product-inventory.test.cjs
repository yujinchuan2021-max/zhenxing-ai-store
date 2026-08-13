"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  scanManagedDesktopInventory
} = require("../shared/managed-product-inventory.cjs");

test("one machine snapshot is shared by every approved desktop probe", async () => {
  let scans = 0;
  const snapshot = { registry: ["one"], appx: ["two"] };
  const receivedSnapshots = [];
  const statuses = await scanManagedDesktopInventory({
    productIds: ["alpha", "beta", "alpha"],
    createSnapshot: async () => {
      scans += 1;
      return snapshot;
    },
    detectProduct: async (productId, received) => {
      receivedSnapshots.push(received);
      return { installed: productId === "alpha" };
    }
  });

  assert.equal(scans, 1);
  assert.deepEqual(receivedSnapshots, [snapshot, snapshot]);
  assert.deepEqual(statuses, {
    alpha: { installed: true },
    beta: { installed: false }
  });
});

test("an empty inventory does not scan the machine", async () => {
  let scans = 0;
  assert.deepEqual(
    await scanManagedDesktopInventory({
      productIds: [],
      createSnapshot: async () => {
        scans += 1;
        return {};
      },
      detectProduct: async () => ({})
    }),
    {}
  );
  assert.equal(scans, 0);
});
