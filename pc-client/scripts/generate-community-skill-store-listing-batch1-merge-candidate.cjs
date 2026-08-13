"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { createCommunitySkillListingBatch1Candidate } = require("../admin/community-skill-listing-candidate.cjs");

const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "admin/published/catalog-store/state.json");
const batchPath = path.join(root, "docs/research/community-skill-store-listing-batch1-candidate-draft89-active6-2026-08-08.json");
const outputJsonPath = path.join(root, "docs/research/community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.json");
const outputMarkdownPath = path.join(root, "docs/research/community-skill-store-listing-batch1-canonical-merge-candidate-draft89-active6-2026-08-08.md");

function markdown(candidate) {
  const source = candidate.source;
  const summary = candidate.summary;
  return `# Community Skill Store Batch 1 canonical merge staging candidate

Candidate only. This file is not a draft save, signature, publication, package, upload, download, or installation authorization.

## Exact inputs

- Draft revision: ${source.draftRevision}
- v2 active release: ${source.v2ActiveReleaseId} (version ${source.v2ActiveCatalogVersion})
- State SHA-256: ${source.stateSha256}
- Source candidate SHA-256: ${source.sourceCandidateSha256}
- Baseline catalog canonical SHA-256: ${source.baselineCatalogCanonicalSha256}

## Staged delta

- ${summary.resourceDelta} new canonical Skill resources; ${summary.targetDelta} new resource-link targets.
- Candidate totals: ${summary.candidateResourceCount} resources; ${summary.candidateTargetCount} targets; Skill official/community: ${summary.candidateSkillStats.official}/${summary.candidateSkillStats.community}.
- Managed targets, Agent bindings, and Workflow dependencies: 0 / 0 / 0.
- Candidate catalog canonical SHA-256: ${summary.candidateCatalogCanonicalSha256}

## Provenance preservation

Each proposed resource retains its strict data-only metadataSnapshot: source platform and discovery channel, source page, canonical source, original author, license, pinned source revision, provenance status, external ID, observation time, license status, and the optional scalar external-reference fields. The catalog validator and Admin editor reject unknown, execution, or secret fields. These metadata fields do not grant managed installation, Agent binding, or Workflow dependency authority.

## Proposed resource IDs

${candidate.proposedChanges.map((change) => "- " + change.resourceId + " -- " + change.resourceJsonSha256).join("\n")}

## Consumption and rollback

${candidate.consumptionPrerequisites.map((entry) => `- ${entry}`).join("\n")}

${candidate.rollback}
`;
}

function build() {
  const stateRaw = fs.readFileSync(statePath, "utf8");
  const batchRaw = fs.readFileSync(batchPath, "utf8");
  return createCommunitySkillListingBatch1Candidate({
    state: JSON.parse(stateRaw),
    stateRaw,
    batch: JSON.parse(batchRaw),
    batchRaw
  });
}

const candidate = build();
if (process.argv.includes("--write")) {
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputMarkdownPath, markdown(candidate), "utf8");
  process.stdout.write(`${outputJsonPath}\n${outputMarkdownPath}\n`);
} else {
  process.stdout.write(`${JSON.stringify(candidate, null, 2)}\n`);
}
