"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { shouldSyncDiskCatalogDraft } = require("../admin/draft-sync.cjs");

test("same-schema disk drafts only replace the revision store when explicitly newer", () => {
  const stateDraft = {
    updatedAt: "2026-08-05T10:00:00.000Z",
    catalog: { schemaVersion: 2 }
  };

  assert.equal(
    shouldSyncDiskCatalogDraft(
      { schemaVersion: 2, updatedAt: "2026-08-05T09:00:00.000Z", changed: true },
      stateDraft
    ),
    false
  );
  assert.equal(
    shouldSyncDiskCatalogDraft(
      { schemaVersion: 2, updatedAt: "2026-08-05T11:00:00.000Z" },
      stateDraft
    ),
    true
  );
  assert.equal(
    shouldSyncDiskCatalogDraft({ schemaVersion: 3 }, stateDraft),
    true
  );
});
