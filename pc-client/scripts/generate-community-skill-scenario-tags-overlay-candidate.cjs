"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  isCanonicalScenarioTags,
  SCENARIO_TAGS
} = require("../shared/catalog-taxonomy.cjs");

const root = path.join(__dirname, "..");
const activePath = "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json";
const outputPath = "docs/research/community-skill-scenario-tags-overlay-candidate-active7-2026-08-13.json";
const ledgers = [
  {
    batch: "B1",
    path: "docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json",
    rows(value) { return value.readyResources; }
  },
  {
    batch: "B2",
    path: "docs/research/community-skill-store-batch2-canonical-merge-candidate-draft89-active6-2026-08-09.json",
    rows(value) { return value.reviewLedger; }
  },
  {
    batch: "B3",
    path: "docs/research/community-skill-store-batch3-canonical-merge-candidate-draft89-active6-2026-08-09.json",
    rows(value) { return value.reviewLedger; }
  }
];

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(bytes(relativePath).toString("utf8"));
}

function sha256(relativePath) {
  return crypto.createHash("sha256").update(bytes(relativePath)).digest("hex");
}

function fail(message) {
  throw new Error(`Skill scenario overlay rejected: ${message}`);
}

const activeEnvelope = readJson(activePath);
const active = activeEnvelope.payload?.catalog;
if (!active || active.schemaVersion !== 2 || activeEnvelope.payload.catalogVersion !== 7) {
  fail("active7 catalog identity mismatch");
}
const skills = active.resources.filter((resource) => resource.resourceTypes.includes("skill"));
const community = skills.filter((resource) => resource.sourceKind === "reviewed-community");
const official = skills.filter((resource) => resource.sourceKind === "official");
if (skills.length !== 120 || community.length !== 104 || official.length !== 16) {
  fail("active7 Skill counts mismatch");
}
if (skills.some((resource) => resource.scenarioTags !== undefined)) {
  fail("active7 already contains scenarioTags");
}

const activeSkillIds = new Set(skills.map((resource) => resource.id));
const communityIds = new Set(community.map((resource) => resource.id));
const seen = new Set();
const overlays = [];
const reviewedLedgers = [];
for (const ledger of ledgers) {
  const value = readJson(ledger.path);
  const rows = ledger.rows(value);
  reviewedLedgers.push({ batch: ledger.batch, path: ledger.path, sha256: sha256(ledger.path) });
  for (const row of rows) {
    if (!activeSkillIds.has(row.resourceId) || !communityIds.has(row.resourceId)) {
      fail(`${ledger.batch} identity is not an active7 community Skill: ${row.resourceId}`);
    }
    if (seen.has(row.resourceId)) fail(`duplicate resourceId: ${row.resourceId}`);
    if (!/^github:[^#]+#[^#]+$/.test(row.canonicalKey || "")) {
      fail(`canonicalKey invalid: ${row.resourceId}`);
    }
    if (!isCanonicalScenarioTags(row.normalizedTags) || row.normalizedTags.length < 1) {
      fail(`normalizedTags invalid: ${row.resourceId}`);
    }
    if (
      row.mappingEvidence &&
      (row.mappingEvidence.length !== row.normalizedTags.length ||
        row.mappingEvidence.some((item, index) => item.canonicalTag !== row.normalizedTags[index]))
    ) {
      fail(`mappingEvidence mismatch: ${row.resourceId}`);
    }
    seen.add(row.resourceId);
    overlays.push({
      resourceId: row.resourceId,
      batch: ledger.batch,
      sourceLedger: ledger.path,
      canonicalKey: row.canonicalKey,
      scenarioTags: [...row.normalizedTags],
      evidenceMode: row.mappingEvidence
        ? "per-tag-first-party-evidence"
        : "frozen-normalized-tags",
      ...(row.mappingEvidence ? { mappingEvidence: structuredClone(row.mappingEvidence) } : {})
    });
  }
}
if (seen.size !== communityIds.size || [...communityIds].some((id) => !seen.has(id))) {
  fail("reviewed ledgers do not exactly cover active7 community Skills");
}

const categoryCounts = Object.fromEntries(SCENARIO_TAGS.map((tag) => [tag.id, 0]));
for (const row of overlays) {
  for (const tag of row.scenarioTags) categoryCounts[tag] += 1;
}

const candidate = {
  schemaVersion: 1,
  candidateOnly: true,
  publishable: false,
  generatedAt: "2026-08-13T00:00:00.000Z",
  title: "active7 Skill scenarioTags evidence overlay candidate",
  source: {
    activeReleaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    activeCatalogVersion: 7,
    activeCatalogPath: activePath,
    activeCatalogSha256: sha256(activePath),
    reviewedLedgers,
    officialReview: {
      path: "docs/research/skill-store-first-party-review-2026-08-06.json",
      sha256: sha256("docs/research/skill-store-first-party-review-2026-08-06.json"),
      result: "no frozen per-resource scenario classification fields"
    }
  },
  taxonomy: {
    source: "shared/catalog-taxonomy.cjs",
    sha256: sha256("shared/catalog-taxonomy.cjs"),
    ids: SCENARIO_TAGS.map((tag) => tag.id)
  },
  overlays,
  unclassified: official.map((resource) => ({
    resourceId: resource.id,
    sourceKind: "official",
    scenarioTags: [],
    reason: "no frozen per-resource scenario classification evidence"
  })),
  summary: {
    skillCount: skills.length,
    taggedCount: overlays.length,
    unclassifiedCount: official.length,
    batchCounts: Object.fromEntries(ledgers.map((ledger) => [
      ledger.batch,
      overlays.filter((row) => row.batch === ledger.batch).length
    ])),
    categoryCounts
  },
  preservation: {
    apply: "add each overlay scenarioTags to the exact matching active7 resourceId",
    reverse: "delete resources[].scenarioTags",
    stripScenarioTagsEqualsActive7: true
  },
  safety: {
    skillOnly: true,
    changesOnly: ["resources[].scenarioTags"],
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  },
  consumptionPrerequisites: [
    "Catalog schema owner must independently add and validate optional canonical resources[].scenarioTags.",
    "Frontend must consume resource scenarioTags; target product tags are not Skill categories.",
    "Re-run exact active release identity, strip equivalence, signed-catalog validation, and UI category matrix before any save/sign/publish."
  ],
  rollback: "Delete this candidate, generator, focused test, and handoff; active catalog and state were never changed."
};

fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  outputPath,
  taggedCount: candidate.summary.taggedCount,
  unclassifiedCount: candidate.summary.unclassifiedCount,
  categoryCounts
})}\n`);
