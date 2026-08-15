"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { resourceTargetPresentation } = require("../shared/resource-store.cjs");

const active6 = JSON.parse(fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "admin",
    "published",
    "catalog-store",
    "releases",
    "catalog-v00000006-567e671621f1-3dcee587.json"
  ),
  "utf8"
)).payload.catalog;

function targets() {
  return active6.resources.flatMap((resource) =>
    resource.targets.map((target) => ({ resource, target }))
  );
}

test("active6 resource-store presentation keeps link-only targets external and gates managed targets", () => {
  const rows = targets();
  const linkOnly = rows.filter(({ target }) => target.moduleId === "resource-link");
  const managed = rows.filter(({ target }) => target.moduleId !== "resource-link");

  assert.equal(rows.length, 513);
  assert.equal(linkOnly.length, 505);
  assert.equal(managed.length, 8);

  for (const { resource, target } of linkOnly) {
    const presentation = resourceTargetPresentation(resource, target);
    assert.equal(presentation.managed, false, `${resource.id}/${target.productId}`);
    assert.equal(target.installProfileId, "", `${resource.id}/${target.productId}`);
    assert.deepEqual(
      presentation.links.map((link) => link.kind),
      resource.tutorial && resource.tutorial !== resource.website
        ? ["website", "tutorial"]
        : ["website"],
      `${resource.id}/${target.productId}`
    );
  }

  for (const { resource, target } of managed) {
    const presentation = resourceTargetPresentation(resource, target);
    assert.equal(presentation.managed, true, `${resource.id}/${target.productId}`);
    assert.ok(target.installProfileId, `${resource.id}/${target.productId}`);
  }
});

test("ResourceRow maps external resource links to direct DOM actions and inspects only managed targets", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");

  assert.match(app, /data-aihub-action=\{`open-resource-\$\{link\.kind\}`\}/);
  assert.match(app, /window\.open\(link\.href\)/);
  assert.match(app, /managed && !status/);
});

test("official-link-only remains a direct external action even when a catalog target supplies no fixed profile", () => {
  const presentation = resourceTargetPresentation(
    {
      id: "link-only-fixture",
      website: "https://example.com",
      tutorial: "https://example.com/tutorial"
    },
    {
      productId: "host-fixture",
      moduleId: "official-link-only",
      installProfileId: "",
      capabilities: ["website"]
    }
  );

  assert.equal(presentation.managed, false);
  assert.deepEqual(
    presentation.links.map((link) => [link.kind, link.href]),
    [
      ["website", "https://example.com"],
      ["tutorial", "https://example.com/tutorial"]
    ]
  );
});
