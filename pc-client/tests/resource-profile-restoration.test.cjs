"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const candidate = require("../docs/resource-profile-restoration-candidate.json");
const catalog = require("../admin/data/catalog-v1.json");
const { getExtensionInstallProfile } = require("../shared/extension-install-registry.cjs");

test("OpenAI Docs Claude and Cursor restoration candidates match fixed targets", () => {
  assert.equal(candidate.sourceRevision, 81);
  assert.equal(candidate.sourceProductCount, 615);
  assert.equal(candidate.candidates.length, 2);
  assert.deepEqual(candidate.blockers, []);

  const resource = catalog.resources.find((entry) => entry.id === candidate.resourceId);
  for (const item of candidate.candidates) {
    const target = resource.targets.find((entry) => entry.installProfileId === item.targetId);
    const profile = getExtensionInstallProfile(item.installProfileId);
    assert.ok(target);
    assert.equal(target.productId, item.hostProductId);
    assert.equal(target.moduleId, candidate.moduleId);
    assert.deepEqual(target.capabilities, item.capabilities);
    assert.equal(profile.adapterId, item.adapterId);
    assert.equal(profile.serverId, item.serverId);
    assert.deepEqual(profile.entry, item.entry);
    for (const field of ["command", "args", "env", "headers", "script"]) {
      assert.equal(Object.hasOwn(item, field), false, `${item.targetId}:${field}`);
    }
  }
});
