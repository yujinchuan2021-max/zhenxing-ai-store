"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createResourceMarketplace } = require("../shared/resource-marketplace.cjs");
const activeCatalog = require("../admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json").payload.catalog;

const vendors = [
  {
    id: "publisher-vendor",
    name: "Publisher Vendor",
    enabled: true,
    order: 9,
    products: []
  },
  {
    id: "host-vendor",
    name: "Host Vendor",
    enabled: true,
    order: 1,
    products: [
      { id: "host-b", name: "Host B", enabled: true, order: 2, directoryKind: "ai-tool" },
      { id: "host-a", name: "Host A", enabled: true, order: 1, directoryKind: "ai-tool" },
      { id: "hidden-host", name: "Hidden", enabled: false, order: 0, directoryKind: "ai-tool" },
      { id: "connectable", name: "Connectable", enabled: true, order: 0, directoryKind: "ai-connectable" }
    ]
  }
];

const resources = [
  {
    id: "later",
    enabled: true,
    order: 20,
    name: "Later",
    resourceTypes: ["skill"],
    sourceKind: "official",
    scenarioTags: ["办公"],
    publisher: "Independent Publisher",
    sourceProductIds: [],
    targets: [{ productId: "host-a", enabled: true, compatibility: "official" }]
  },
  {
    id: "shared",
    enabled: true,
    order: 10,
    name: "Shared",
    resourceTypes: ["skill", "mcp"],
    sourceKind: "reviewed-community",
    scenarioTags: ["编程", "办公"],
    publisherVendorId: "publisher-vendor",
    sourceProductIds: [],
    targets: [
      { productId: "host-b", enabled: true, compatibility: "verified" },
      { productId: "host-a", enabled: true, compatibility: "official" },
      { productId: "host-a", enabled: true },
      { productId: "hidden-host", enabled: true },
      { productId: "connectable", enabled: true },
      { productId: "missing-host", enabled: true },
      { productId: "host-b", enabled: false }
    ]
  },
  {
    id: "hidden-resource",
    enabled: false,
    order: 0,
    name: "Hidden",
    resourceTypes: ["skill"],
    sourceKind: "official",
    sourceProductIds: [],
    targets: [{ productId: "host-a", enabled: true }]
  }
];

test("resource marketplace keeps canonical resources unique behind browse and detail", () => {
  const marketplace = createResourceMarketplace({ resources, vendors });
  assert.deepEqual(Object.keys(marketplace), ["browse", "detail", "facets"]);

  const all = marketplace.browse({});
  assert.deepEqual(all.map((entry) => entry.resource.id), ["shared", "later"]);
  assert.equal(all.filter((entry) => entry.resource.id === "shared").length, 1);
  assert.deepEqual(all[0].hosts.map((host) => host.product.id), ["host-a", "host-b"]);
  assert.deepEqual(all[0].publisher, {
    id: "publisher-vendor",
    name: "Publisher Vendor"
  });

  assert.deepEqual(
    marketplace.browse({ store: "mcp" }).map((entry) => entry.resource.id),
    ["shared"]
  );
  assert.deepEqual(
    marketplace.browse({ category: "办公" }).map((entry) => entry.resource.id),
    ["shared", "later"]
  );
  assert.deepEqual(
    marketplace.browse({ category: "编程", hostId: "host-b", source: "community" }).map((entry) => entry.resource.id),
    ["shared"]
  );
  assert.deepEqual(marketplace.browse({ source: "official" }).map((entry) => entry.resource.id), ["later"]);
  assert.deepEqual(
    marketplace.browse({ compatibility: "verified" }).map((entry) => entry.resource.id),
    ["shared"]
  );
  assert.deepEqual(
    marketplace.browse({ hostId: "host-a", compatibility: "verified" }).map((entry) => entry.resource.id),
    [],
    "host and compatibility filters must match the same target"
  );
  assert.deepEqual(marketplace.facets({ store: "skill", source: "community" }), {
    scenarios: { "programming-development": 1, "office-collaboration": 1 },
    compatibility: { official: 1, verified: 1, "protocol-compatible": 0 }
  });
  assert.deepEqual(marketplace.facets({ store: "skill", source: "official" }), {
    scenarios: { "office-collaboration": 1 },
    compatibility: { official: 1, verified: 0, "protocol-compatible": 0 }
  });

  assert.deepEqual(marketplace.detail("shared"), all[0]);
  assert.equal(marketplace.detail("hidden-resource"), null);
  assert.equal(marketplace.detail("missing"), null);
  assert.throws(() => marketplace.browse({ store: "workflow" }), /store/i);
  assert.throws(() => marketplace.browse({ category: "unknown" }), /category/i);
  assert.throws(() => marketplace.browse({ source: "unsafe" }), /source/i);
  assert.throws(() => marketplace.browse({ compatibility: "unsafe" }), /compatibility/i);
});

test("resource marketplace rejects duplicate canonical resource ids", () => {
  assert.throws(
    () => createResourceMarketplace({
      vendors,
      resources: [
        resources[0],
        { ...resources[0], name: "Duplicate Later" }
      ]
    }),
    {
      name: "Error",
      message: "resource marketplace duplicate resource id"
    }
  );
});

test("resource marketplace joins connection modes without duplicating a canonical resource", () => {
  const resource = {
    ...resources[0],
    id: "connected",
    name: "Connected",
    resourceTypes: ["mcp", "connector"],
    targets: [{ productId: "host-a", enabled: true }]
  };
  const connections = [
    {
      resourceId: "connected",
      hostProductId: "host-a",
      connectionMode: "remote-mcp",
      bindingKind: "mcp-tool"
    },
    {
      resourceId: "connected",
      hostProductId: "host-a",
      connectionMode: "chatgpt-app",
      bindingKind: "connector-authorized-connection"
    }
  ];
  const marketplace = createResourceMarketplace({
    resources: [resource],
    vendors,
    connections
  });

  assert.deepEqual(marketplace.browse().map((entry) => entry.resource.id), [
    "connected"
  ]);
  assert.deepEqual(marketplace.detail("connected").connections, connections);
});

test("resource marketplace rejects invalid connection joins at its public seam", () => {
  const connected = {
    ...resources[0],
    id: "connected",
    resourceTypes: ["mcp", "connector"],
    targets: [{ productId: "host-a", enabled: true }]
  };
  const valid = {
    resourceId: "connected",
    hostProductId: "host-a",
    connectionMode: "remote-mcp",
    bindingKind: "mcp-tool"
  };
  const invalid = [
    {
      label: "non-array",
      input: { resources: [connected], vendors, connections: {} },
      message: "resource marketplace connections invalid"
    },
    {
      label: "extra field",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, command: "never" }]
      },
      message: "resource marketplace connection fields invalid"
    },
    {
      label: "unknown mode",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, connectionMode: "custom" }]
      },
      message: "resource marketplace connection mode invalid"
    },
    {
      label: "unknown binding",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, bindingKind: "custom" }]
      },
      message: "resource marketplace connection binding invalid"
    },
    {
      label: "type mismatch",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, bindingKind: "skill-context" }]
      },
      message: "resource marketplace connection resource type invalid"
    },
    {
      label: "unknown resource",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, resourceId: "missing" }]
      },
      message: "resource marketplace connection resource invalid"
    },
    {
      label: "disabled resource",
      input: {
        resources: [{ ...connected, enabled: false }],
        vendors,
        connections: [valid]
      },
      message: "resource marketplace connection resource invalid"
    },
    {
      label: "unknown host",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, hostProductId: "missing" }]
      },
      message: "resource marketplace connection host invalid"
    },
    {
      label: "disabled host",
      input: {
        resources: [
          {
            ...connected,
            targets: [{ productId: "hidden-host", enabled: true }]
          }
        ],
        vendors,
        connections: [{ ...valid, hostProductId: "hidden-host" }]
      },
      message: "resource marketplace connection host invalid"
    },
    {
      label: "wrong resource target",
      input: {
        resources: [connected],
        vendors,
        connections: [{ ...valid, hostProductId: "host-b" }]
      },
      message: "resource marketplace connection target invalid"
    },
    {
      label: "disabled resource target",
      input: {
        resources: [
          {
            ...connected,
            targets: [{ productId: "host-a", enabled: false }]
          }
        ],
        vendors,
        connections: [valid]
      },
      message: "resource marketplace connection target invalid"
    },
    {
      label: "duplicate tuple",
      input: {
        resources: [connected],
        vendors,
        connections: [valid, { ...valid }]
      },
      message: "resource marketplace duplicate connection"
    }
  ];

  for (const item of invalid) {
    assert.throws(
      () => createResourceMarketplace(item.input),
      { name: "Error", message: item.message },
      item.label
    );
  }
});

test("resource marketplace rejects connection modes paired with the wrong binding kind", () => {
  const connected = {
    ...resources[0],
    id: "connected",
    resourceTypes: ["mcp", "connector"],
    targets: [{ productId: "host-a", enabled: true }]
  };
  for (const connection of [
    {
      resourceId: "connected",
      hostProductId: "host-a",
      connectionMode: "chatgpt-app",
      bindingKind: "mcp-tool"
    },
    {
      resourceId: "connected",
      hostProductId: "host-a",
      connectionMode: "remote-mcp",
      bindingKind: "connector-authorized-connection"
    }
  ]) {
    assert.throws(
      () => createResourceMarketplace({
        resources: [connected],
        vendors,
        connections: [connection]
      }),
      {
        name: "Error",
        message: "resource marketplace connection mode binding invalid"
      }
    );
  }
});

test("active7 projects through the marketplace without changing catalog identity", () => {
  const marketplace = createResourceMarketplace(activeCatalog);
  const all = marketplace.browse();

  assert.equal(all.length, 250);
  assert.equal(new Set(all.map(({ resource }) => resource.id)).size, 250);
  assert.deepEqual(
    ["skill", "mcp", "plugin", "connector"].map(
      (store) => marketplace.browse({ store }).length
    ),
    [120, 123, 8, 3]
  );
  assert.ok(all.some(({ hosts }) => hosts.length > 1));
  assert.strictEqual(marketplace.detail(all[0].resource.id), all[0]);
  assert.equal(activeCatalog.resources.length, 250);
  assert.equal(activeCatalog.resources.reduce((count, resource) => count + resource.targets.length, 0), 777);
});
