"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createReleaseStore } = require("../admin/release-store.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");
const { buildCandidate } = require("./fixtures/resource-store-localized-en-content-active7.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(
  root,
  "docs",
  "research",
  "resource-store-localized-en-content-candidate-active7-2026-08-12.json"
);

async function readActive7() {
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin", "published", "catalog-store"),
    signingKeyProvider: async () => {
      throw new Error("read-only test");
    }
  });
  const channel = await store.readChannel("v2");
  const release = await store.readRelease(channel.activeRelease.releaseId, {
    channel: "v2"
  });
  assert.equal(release.release.releaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  return release;
}

function withoutLocalized(value) {
  const copy = structuredClone(value);
  delete copy.localized;
  return copy;
}

test("active7 resource and store English candidate is exact and non-executable", async () => {
  const release = await readActive7();
  const catalog = release.envelope.payload.catalog;
  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));

  assert.deepEqual(candidate, buildCandidate(catalog, {
    releaseId: release.release.releaseId,
    catalogVersion: release.release.catalogVersion,
    releaseSha256: release.release.sha256
  }));

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.candidateLabel, "0.1.82-localized-en-content-b");
  assert.equal(candidate.source.releaseId, "catalog-v00000007-8c49e1972186-0cec5335");
  assert.equal(candidate.resources.length, 250);
  assert.equal(candidate.resourceStores.length, 4);
  assert.equal(new Set(candidate.resources.map(({ resourceId }) => resourceId)).size, 250);
  assert.equal(new Set(candidate.resourceStores.map(({ storeId }) => storeId)).size, 4);
  assert.equal(
    candidate.resources.filter(({ localized }) =>
      /^Community Agent Skill: .*Review the pinned original source before using its guidance\.$/.test(
        localized.en.description
      )
    ).length,
    0,
    "generic Community Agent Skill descriptions are not reviewed English content"
  );
  const repeatedDescriptions = Map.groupBy(
    candidate.resources,
    ({ localized }) => localized.en.description
  );
  assert.equal(
    [...repeatedDescriptions.values()].filter((entries) => entries.length >= 3).length,
    0,
    "no high-repeat description group may hide generic content"
  );
  for (const entry of candidate.resources) {
    assert.match(entry.sourceClass, /^(official-primary|reviewed-community-pinned-primary)$/);
    assert.match(entry.reviewClass, /^(manual-translation|pinned-identity-conservative-summary|source-body-conservative-summary|pinned-identity-honest-fallback)$/);
    assert.equal(
      entry.translationSha256,
      crypto.createHash("sha256").update(JSON.stringify(entry.localized)).digest("hex"),
      `${entry.resourceId} translation hash`
    );
    assert.doesNotMatch(
      `${entry.localized.en.name}\n${entry.localized.en.description}`,
      /\p{Script=Han}|\uFFFD|Ã.|â.|ð./u,
      `${entry.resourceId} contains untranslated or damaged text`
    );
  }
  assert.equal(candidate.resources.filter(({ sourceClass }) =>
    sourceClass === "official-primary").length, 140);
  assert.equal(candidate.resources.filter(({ sourceClass }) =>
    sourceClass === "reviewed-community-pinned-primary").length, 110);
  assert.equal(candidate.resources.filter(({ reviewClass }) =>
    reviewClass === "manual-translation").length, 160);
  assert.equal(candidate.resources.filter(({ reviewClass }) =>
    reviewClass === "pinned-identity-conservative-summary").length, 3);
  assert.equal(candidate.resources.filter(({ reviewClass }) =>
    reviewClass === "source-body-conservative-summary").length, 86);
  assert.equal(candidate.resources.filter(({ reviewClass }) =>
    reviewClass === "pinned-identity-honest-fallback").length, 1);
  const firstPartyReviewed = candidate.resources.filter(({ sourceEvidence }) => sourceEvidence);
  assert.equal(firstPartyReviewed.length, 87);
  for (const entry of firstPartyReviewed) {
    assert.equal(entry.sourceKind, "reviewed-community");
    assert.equal(entry.sourceEvidence.finalHostClass, "github-raw-pinned");
    if (entry.reviewClass === "pinned-identity-honest-fallback") {
      assert.equal(entry.sourceEvidence.documentClass, "unreadable");
      assert.equal(entry.sourceEvidence.contentSha256, "unavailable");
    } else {
      assert.equal(entry.sourceEvidence.documentClass, "skill-md");
      assert.match(entry.sourceEvidence.contentSha256, /^[a-f0-9]{64}$/);
    }
    assert.doesNotMatch(
      entry.localized.en.description,
      /\bpinned\b.*\b(?:Skill )?provides guidance\b/i,
      `${entry.resourceId} retains the normalized mechanical sentence frame`
    );
  }
  const normalizedPrefixes = Map.groupBy(firstPartyReviewed, ({ localized }) =>
    localized.en.description
      .toLowerCase()
      .replace(/['’]s/g, "")
      .replace(/\b(?:anthropic|sentry|dkeken|databricks|copilotkit|swyx|alem tuzlak|denis sergeevitch)\b/g, "<source>")
      .split(/\s+/)
      .slice(0, 6)
      .join(" ")
  );
  assert.equal(
    [...normalizedPrefixes.values()].filter((entries) => entries.length >= 3).length,
    0,
    "normalized description prefixes must not form a mechanical cluster"
  );
  const keywordSamples = {
    "anthropic-skills-algorithmic-art": "p5.js",
    "sentry-skills-django-access-review": "IDOR",
    "dkeken-codex-skills-alternative-design-image-to-code": "screenshot comparison",
    "alemtuzlak-skills-rfc": "RFC",
    "swyxio-skills-web-perf": "Core Web Vitals",
    "copilotkit-skills-copilotkit-agui": "AG-UI",
    "databricks-agent-skills-databricks-dabs": "Declarative Automation Bundles"
  };
  for (const [resourceId, keyword] of Object.entries(keywordSamples)) {
    const entry = candidate.resources.find((resource) => resource.resourceId === resourceId);
    assert.ok(entry.localized.en.description.toLowerCase().includes(keyword.toLowerCase()));
    assert.ok(entry.sourceEvidence.supportedKeywords.some((value) =>
      value.toLowerCase() === keyword.toLowerCase()
    ));
  }

  const localized = structuredClone(catalog);
  const resources = new Map(candidate.resources.map((entry) => [entry.resourceId, entry.localized]));
  const stores = new Map(candidate.resourceStores.map((entry) => [entry.storeId, entry.localized]));
  for (const resource of localized.resources) {
    assert.ok(resources.has(resource.id), `missing resource ${resource.id}`);
    resource.localized = resources.get(resource.id);
  }
  for (const store of localized.resourceStores) {
    assert.ok(stores.has(store.id), `missing store ${store.id}`);
    store.localized = stores.get(store.id);
  }
  assert.doesNotThrow(() => validateCatalog(localized));

  assert.deepEqual(
    localized.resources.map(withoutLocalized),
    catalog.resources,
    "resource identity, links, metadata, policies, targets, and capabilities must not drift"
  );
  assert.deepEqual(
    localized.resourceStores.map(withoutLocalized),
    catalog.resourceStores,
    "resource store identity and policy must not drift"
  );

  const skills = localized.resources.filter((resource) => resource.resourceTypes.includes("skill"));
  assert.equal(skills.length, 120);
  assert.equal(skills.filter(({ sourceKind }) => sourceKind === "official").length, 16);
  assert.equal(skills.filter(({ sourceKind }) => sourceKind === "reviewed-community").length, 104);
  const communityTargets = skills
    .filter(({ sourceKind }) => sourceKind === "reviewed-community")
    .flatMap(({ targets }) => targets);
  assert.equal(communityTargets.length, 264);
  assert.ok(communityTargets.every((target) => target.moduleId === "resource-link"));
  assert.ok(communityTargets.every((target) => target.installProfileId === ""));
  assert.ok(communityTargets.every((target) =>
    target.capabilities.length === 1 && target.capabilities[0] === "website"
  ));
});
