const assert = require("node:assert/strict");
const test = require("node:test");
const {
  collectVendorSources,
  discoveryDisposition,
  extractHtmlPage,
  inferProductType,
  isWithinScopes,
  matchExistingProduct,
  parseSitemapXml,
  scoreDiscoveryLink
} = require("../shared/catalog-discovery.cjs");

const vendor = {
  website: "https://vendor.example/",
  tutorial: "https://docs.vendor.example/start",
  products: [
    {
      id: "known-desktop",
      name: "Known Desktop",
      website: "https://vendor.example/download",
      productType: "desktop-official"
    },
    {
      id: "known-cli",
      name: "Known CLI",
      website: "https://github.com/acme/known-cli",
      productType: "cli-official"
    },
    {
      id: "known-agent",
      name: "Known Agents",
      description: "AI agent platform",
      website: "https://vendor.example/agents",
      productType: "web"
    }
  ]
};

test("derives official crawl scopes from backend vendor and product data", () => {
  const sources = collectVendorSources(vendor);
  assert.ok(sources.urls.includes("https://vendor.example/"));
  assert.ok(sources.scopes.some((scope) => scope.hostname === "vendor.example"));
  assert.deepEqual(
    sources.scopes.find((scope) => scope.hostname === "github.com"),
    { hostname: "github.com", pathPrefix: "/acme/known-cli" }
  );
  assert.equal(
    isWithinScopes("https://github.com/acme/known-cli/releases", sources.scopes),
    true
  );
  assert.equal(
    isWithinScopes("https://github.com/attacker/tool", sources.scopes),
    false
  );
});

test("extracts only in-scope official links and scores product surfaces", () => {
  const sources = collectVendorSources(vendor);
  const page = extractHtmlPage(
    `<html><head><title>Products - Vendor</title></head><body>
      <a href="/products/new-agent">New Agent</a>
      <a href="/legal/privacy">Privacy</a>
      <a href="https://third-party.example/download">Unofficial download</a>
    </body></html>`,
    "https://vendor.example/",
    sources.scopes
  );
  assert.equal(page.links.length, 2);
  assert.deepEqual(page.externalLinks, [
    {
      url: "https://third-party.example/download",
      text: "Unofficial download"
    }
  ]);
  const agent = page.links.find((link) => link.text === "New Agent");
  assert.ok(scoreDiscoveryLink(agent, page) >= 5);
  assert.ok(scoreDiscoveryLink(page.links.find((link) => link.text === "Privacy"), page) < 0);
  assert.equal(inferProductType(agent), "agent");
  assert.equal(discoveryDisposition(agent), "candidate");
  assert.equal(
    discoveryDisposition({
      url: "https://vendor.example/solutions/finance",
      text: "Financial services"
    }),
    "lead"
  );
  assert.equal(
    discoveryDisposition({
      url: "https://vendor.example/products/games",
      text: "Games"
    }),
    "lead"
  );
  assert.equal(
    discoveryDisposition({
      url: "https://docs.vendor.example/cli/agent",
      text: "CLI agent reference"
    }),
    "lead"
  );
  assert.equal(
    discoveryDisposition({
      url: "https://vendor.example/docs/app/model",
      text: "Model settings"
    }),
    "lead"
  );
  assert.equal(
    discoveryDisposition({
      url: "https://blog.vendor.example/products/new-agent",
      text: "New Agent announcement"
    }),
    "lead"
  );
  assert.equal(
    discoveryDisposition({
      url: "https://vendor.example/api/desktop/win32/x64/setup/latest/redirect",
      text: "Download for Windows"
    }),
    "lead"
  );
});

test("sitemap parsing, existing matching, and type hints stay review-only", () => {
  const sources = collectVendorSources(vendor);
  assert.deepEqual(
    parseSitemapXml(
      `<urlset><url><loc>https://vendor.example/download</loc></url><url><loc>https://evil.example/app</loc></url></urlset>`,
      "https://vendor.example/sitemap.xml",
      sources.scopes
    ),
    ["https://vendor.example/download"]
  );
  assert.equal(
    matchExistingProduct(
      { url: "https://vendor.example/download", text: "Download" },
      vendor.products
    ),
    "known-desktop"
  );
  assert.equal(
    matchExistingProduct(
      { url: "https://vendor.example/en-US/download", text: "Download" },
      vendor.products
    ),
    "known-desktop"
  );
  assert.equal(
    matchExistingProduct(
      { url: "https://github.com/acme/known-cli/docs", text: "CLI" },
      vendor.products
    ),
    "known-cli"
  );
  assert.equal(
    matchExistingProduct(
      { url: "https://vendor.example/app/agents", text: "Create an AI agent" },
      vendor.products
    ),
    "known-agent"
  );
  assert.equal(
    inferProductType({ url: "https://vendor.example/new-cli", text: "Command line" }),
    "cli"
  );
  assert.equal(
    matchExistingProduct(
      { url: "https://download.vendor.example/windows", text: "Download app" },
      [
        ...vendor.products,
        {
          id: "cowork",
          name: "Known Cowork",
          website: "https://vendor.example/cowork",
          productType: "desktop-official"
        }
      ]
    ),
    "known-desktop"
  );
});
