"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { searchCatalog } = require("../shared/catalog-projections.cjs");

const catalog = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
    "utf8"
  )
);

function search(query, source = catalog) {
  return searchCatalog({
    vendors: source.vendors,
    resources: source.resources || [],
    resourceStores: source.resourceStores || [],
    query
  });
}

test("catalog search matches identities without leaking description mentions", () => {
  const results = search("openclaw");
  assert.deepEqual(
    results.vendors.map(({ vendor }) => vendor.id),
    ["openclaw"]
  );
  assert.equal(
    results.vendors.some(({ vendor }) =>
      ["moonshot", "tencent"].includes(vendor.id)
    ),
    false
  );
});

test("catalog search keeps only directly matched products when vendor does not match", () => {
  const results = search("Codex CLI");
  const openai = results.vendors.find(({ vendor }) => vendor.id === "openai");
  assert.ok(openai);
  assert.deepEqual(openai.products.map((product) => product.id), ["codex-cli"]);
});

test("catalog search accepts Chinese product identities", () => {
  const results = search("向日葵");
  const oray = results.vendors.find(({ vendor }) => vendor.id === "oray");
  assert.ok(oray);
  assert.equal(oray.directoryKind, "ai-connectable");
  assert.deepEqual(oray.products.map((product) => product.id), [
    "sunlogin-windows"
  ]);
});

test("catalog search does not match text hidden inside another identity", () => {
  const craft = search("Craft");
  assert.deepEqual(
    craft.vendors.map(({ vendor }) => vendor.id),
    ["craft"]
  );

  const dash = search("Dash");
  assert.deepEqual(
    dash.vendors.map(({ vendor }) => vendor.id),
    ["dropbox"]
  );
});

test("catalog search finds popular agents by their own identity only", () => {
  const expected = {
    Hermes: ["nousresearch"],
    OpenHands: ["openhands"],
    "UI-TARS": ["bytedance"],
    DeerFlow: ["bytedance"],
    Letta: ["letta"]
  };

  for (const [query, vendorIds] of Object.entries(expected)) {
    assert.deepEqual(
      search(query).vendors.map(({ vendor }) => vendor.id),
      vendorIds,
      query
    );
  }
});

test("catalog search finds the new industry products without unrelated vendors", () => {
  const expected = {
    AutoCAD: ["autodesk"],
    "Scopus with AI": ["elsevier"],
    CoCounsel: ["thomson-reuters"],
    Spotter: ["thoughtspot"],
    Navicat: ["navicat"]
  };

  for (const [query, vendorIds] of Object.entries(expected)) {
    assert.deepEqual(
      search(query).vendors.map(({ vendor }) => vendor.id),
      vendorIds,
      query
    );
  }
});

test("catalog search finds the next agent and connectable products by identity", () => {
  const expected = {
    "Amp CLI": ["amp"],
    "GitHub Spark": ["github"],
    "LangSmith": ["langchain"],
    "Rovo": ["atlassian"],
    "PlayCanvas Editor": ["playcanvas"],
    "PandaDoc Workspace": ["pandadoc"]
  };

  for (const [query, vendorIds] of Object.entries(expected)) {
    assert.deepEqual(
      search(query).vendors.map(({ vendor }) => vendor.id),
      vendorIds,
      query
    );
  }
});

test("catalog search finds the next reviewed Windows products by identity", () => {
  const expected = {
    Superwhisper: ["superwhisper"],
    PDFgear: ["pdfgear"],
    "Voice.ai": ["voiceai"],
    AFFiNE: ["affine"],
    "DuckDuckGo Browser": ["duckduckgo"],
    "CorelDRAW Graphics Suite": ["corel"]
  };

  for (const [query, vendorIds] of Object.entries(expected)) {
    assert.deepEqual(
      search(query).vendors.map(({ vendor }) => vendor.id),
      vendorIds,
      query
    );
  }
});

test("catalog search finds the next observability and connectable products", () => {
  const expected = {
    Braintrust: ["braintrust"],
    AgentOps: ["agentops"],
    Helicone: ["helicone"],
    "AnyDesk": ["anydesk"],
    "Tripo OpenAPI": ["tripo"],
    Docling: ["docling-project"],
    "Tailscale Aperture": ["tailscale"]
  };

  for (const [query, vendorIds] of Object.entries(expected)) {
    assert.deepEqual(
      search(query).vendors.map(({ vendor }) => vendor.id),
      vendorIds,
      query
    );
  }
});

test("catalog search projects resources into every enabled current or future store", () => {
  const source = {
    vendors: [
      {
        id: "example",
        enabled: true,
        order: 0,
        name: "Example",
        initial: "E",
        products: [
          {
            id: "example-cli",
            enabled: true,
            order: 0,
            directoryKind: "ai-tool",
            name: "Example CLI"
          }
        ]
      }
    ],
    resourceStores: [
      { id: "skill", label: "Skill 商店", enabled: true, order: 0 },
      { id: "workflow", label: "工作流商店", enabled: true, order: 1 },
      { id: "disabled", label: "停用商店", enabled: false, order: 2 }
    ],
    resources: [
      {
        id: "example-workflow",
        enabled: true,
        order: 0,
        name: "Example Workflow",
        resourceTypes: ["skill", "workflow", "disabled"],
        targets: [{ productId: "example-cli", enabled: true }]
      }
    ]
  };

  const results = search("Example Workflow", source);
  assert.deepEqual(
    results.resources.map(({ store }) => store.id),
    ["skill", "workflow"]
  );
});

test("empty catalog search has no implicit directory results", () => {
  assert.deepEqual(search("   "), { query: "", vendors: [], resources: [] });
});
