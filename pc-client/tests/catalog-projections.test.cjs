"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  projectVendorsByDirectory,
  resourceProductsByType,
  resourceTargetsByType
} = require("../shared/catalog-projections.cjs");

const vendors = [
  {
    id: "both",
    name: "Both",
    products: [
      { id: "ai", name: "AI", directoryKind: "ai-tool" },
      {
        id: "connectable",
        name: "Connectable",
        directoryKind: "ai-connectable"
      }
    ]
  },
  {
    id: "disabled",
    name: "Disabled",
    enabled: false,
    products: [{ id: "hidden", directoryKind: "ai-tool" }]
  }
];

test("one vendor projects into two directories without leaking products", () => {
  const original = structuredClone(vendors);
  const ai = projectVendorsByDirectory(vendors, "ai-tool");
  const connectable = projectVendorsByDirectory(vendors, "ai-connectable");
  assert.deepEqual(ai.map((vendor) => vendor.id), ["both"]);
  assert.deepEqual(ai[0].products.map((product) => product.id), ["ai"]);
  assert.deepEqual(connectable.map((vendor) => vendor.id), ["both"]);
  assert.deepEqual(
    connectable[0].products.map((product) => product.id),
    ["connectable"]
  );
  assert.deepEqual(vendors, original);
});

test("one resource record appears in every selected store and target group", () => {
  const resources = [
    {
      id: "shared",
      resourceTypes: ["skill", "mcp", "plugin"],
      targets: [{ productId: "ai", enabled: true }]
    }
  ];
  for (const type of ["skill", "mcp", "plugin"]) {
    const rows = resourceTargetsByType(resources, vendors, type);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].resource, resources[0]);
    assert.equal(rows[0].product.id, "ai");
  }
});

test("every resource store projects one scalable directory per target product", () => {
  const resources = [
    {
      id: "shared",
      name: "Shared",
      order: 0,
      resourceTypes: ["skill", "mcp", "plugin", "workflow"],
      targets: [{ productId: "ai", enabled: true }]
    },
    {
      id: "second",
      name: "Second",
      order: 1,
      resourceTypes: ["skill"],
      targets: [{ productId: "ai", enabled: true }]
    }
  ];

  const skillDirectories = resourceProductsByType(resources, vendors, "skill");
  assert.equal(skillDirectories.length, 1);
  assert.equal(skillDirectories[0].vendor.id, "both");
  assert.equal(skillDirectories[0].product.id, "ai");
  assert.deepEqual(
    skillDirectories[0].rows.map((row) => row.resource.id),
    ["shared", "second"]
  );

  for (const type of ["mcp", "plugin", "workflow"]) {
    const directories = resourceProductsByType(resources, vendors, type);
    assert.equal(directories.length, 1);
    assert.equal(directories[0].rows[0].resource.id, "shared");
  }
});
