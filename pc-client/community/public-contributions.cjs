const {
  resourceSubmissionCatalogMergeCandidate
} = require("../admin/resource-submissions.cjs");

const MAX_DISPLAY_NAME_LENGTH = 160;
const SOURCE_SNAPSHOT_FIELDS = new Set([
  "revision",
  "at",
  "actorIdentityId",
  "canonicalSource",
  "originalAuthorIdentityId",
  "originalAuthor",
  "organization",
  "licenseId",
  "evidenceRefs",
  "discoveredVia",
  "workflowRef",
  "catalogReferences",
  "hostTuples"
]);
const PROPOSAL_ACTIONS = Object.freeze([
  Object.freeze({ kind: "claim-original-authorship" }),
  Object.freeze({ kind: "propose-correction" }),
  Object.freeze({ kind: "propose-evidence" }),
  Object.freeze({ kind: "report" })
]);

function hasText(value, maxLength = MAX_DISPLAY_NAME_LENGTH) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function publicText(value, maxLength = MAX_DISPLAY_NAME_LENGTH) {
  return hasText(value, maxLength) ? value.trim() : null;
}

function publicUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.toString() !== value) return null;
    return value;
  } catch {
    return null;
  }
}

function publicTimestamp(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function publicIdentity(resolvePublicIdentity, identityId, fallbackDisplayName) {
  if (!hasText(identityId)) return null;
  let resolved;
  try {
    resolved = resolvePublicIdentity(identityId, fallbackDisplayName);
  } catch {
    resolved = null;
  }
  const displayName = publicText(resolved?.displayName);
  if (!displayName) return null;
  return deepFreeze({ identityId, displayName });
}

function createdAt(record) {
  if (!Array.isArray(record?.audit)) return null;
  const event = record.audit.find((entry) => entry?.action === "created");
  return publicTimestamp(event?.at);
}

function acceptedAt(record) {
  if (!Array.isArray(record?.audit)) return null;
  const event = record.audit.find((entry) => entry?.action === "accept");
  return publicTimestamp(event?.at);
}

function externallyAllowed(record, isPubliclyAllowed) {
  try {
    return isPubliclyAllowed(record) === true;
  } catch {
    return false;
  }
}

function exact(value, fields) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.size &&
    Object.keys(value).every((key) => fields.has(key))
  );
}

function nullableText(value, maxLength = MAX_DISPLAY_NAME_LENGTH) {
  return value === null ? null : publicText(value, maxLength);
}

function validUrlList(value) {
  return Array.isArray(value) && value.length <= 21 && value.every((entry) => publicUrl(entry));
}

function validReferences(value) {
  return (
    Array.isArray(value) &&
    value.length <= 21 &&
    value.every(
      (entry) =>
        exact(entry, new Set(["kind", "canonicalId", "hostProductId"])) &&
        ["product", "resource"].includes(entry.kind) &&
        hasText(entry.canonicalId) &&
        (entry.hostProductId === null || hasText(entry.hostProductId))
    )
  );
}

function validHostTuples(value) {
  return (
    Array.isArray(value) &&
    value.length <= 21 &&
    value.every(
      (entry) =>
        exact(entry, new Set(["kind", "canonicalId", "hostProductId", "bindingKind"])) &&
        entry.kind === "resource" &&
        hasText(entry.canonicalId) &&
        hasText(entry.hostProductId) &&
        [
          "skill-context",
          "mcp-tool",
          "mcp-resource",
          "mcp-prompt",
          "plugin-host-extension",
          "connector-authorized-connection"
        ].includes(entry.bindingKind)
    )
  );
}

function safeSourceSnapshots(record) {
  if (
    !Number.isSafeInteger(record?.revision) ||
    record.revision < 1 ||
    !Array.isArray(record.sourceSnapshots) ||
    !record.sourceSnapshots.length
  ) return null;
  let priorRevision = 0;
  let priorAt = "";
  const snapshots = [];
  for (const snapshot of record.sourceSnapshots) {
    if (!exact(snapshot, SOURCE_SNAPSHOT_FIELDS)) return null;
    const at = publicTimestamp(snapshot.at);
    const canonicalSource = publicUrl(snapshot.canonicalSource);
    const licenseId = publicText(snapshot.licenseId, 100);
    const workflow = snapshot.workflowRef === null
      ? null
      : exact(snapshot.workflowRef, new Set(["workflowId", "version"])) &&
          hasText(snapshot.workflowRef.workflowId) &&
          Number.isSafeInteger(snapshot.workflowRef.version) &&
          snapshot.workflowRef.version > 0
        ? { workflowId: snapshot.workflowRef.workflowId, version: snapshot.workflowRef.version }
        : null;
    if (
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision <= priorRevision ||
      snapshot.revision > record.revision ||
      !at ||
      at < priorAt ||
      !hasText(snapshot.actorIdentityId) ||
      !canonicalSource ||
      !licenseId ||
      (snapshot.originalAuthorIdentityId !== null && !publicText(snapshot.originalAuthorIdentityId, 160)) ||
      (snapshot.originalAuthor !== null && !publicText(snapshot.originalAuthor)) ||
      (snapshot.organization !== null && !publicText(snapshot.organization)) ||
      !validUrlList(snapshot.evidenceRefs) ||
      (snapshot.discoveredVia !== null && !publicText(snapshot.discoveredVia)) ||
      (snapshot.workflowRef !== null && !workflow) ||
      !validReferences(snapshot.catalogReferences) ||
      !validHostTuples(snapshot.hostTuples)
    ) {
      return null;
    }
    snapshots.push({
      sourceRevisionRef: { submissionId: record.submissionId, revision: snapshot.revision },
      at,
      canonicalSource,
      originalAuthor: {
        displayName: nullableText(snapshot.originalAuthor),
        organization: nullableText(snapshot.organization)
      },
      licenseId,
      workflow
    });
    priorRevision = snapshot.revision;
    priorAt = at;
  }
  return snapshots;
}

function eligibleCandidate(record, isPubliclyAllowed) {
  let candidate;
  try {
    candidate = resourceSubmissionCatalogMergeCandidate(record);
  } catch {
    return null;
  }
  const publiclyAllowed = externallyAllowed(record, isPubliclyAllowed);
  if (!candidate || record.publicEligibility !== true || !publiclyAllowed) return null;
  const sources = safeSourceSnapshots(record);
  const source = sources?.at(-1);
  if (
    !source ||
    !exact(candidate.sourceRevisionRef, new Set(["submissionId", "revision"])) ||
    candidate.sourceRevisionRef.submissionId !== record.submissionId ||
    candidate.sourceRevisionRef.revision !== source.sourceRevisionRef.revision ||
    record.publicEligibilitySourceRevision !== source.sourceRevisionRef.revision
  ) {
    return null;
  }
  const reviewedAt = acceptedAt(record);
  if (!reviewedAt) return null;
  return { candidate, source, reviewedAt };
}

function legacyHistoryUnavailable(record, isPubliclyAllowed) {
  return (
    record?.status === "accepted" &&
    record.publicEligibility === true &&
    ["automated-reviewed", "manually-reviewed"].includes(record.reviewStatus) &&
    ["low", "guarded"].includes(record.riskLevel) &&
    externallyAllowed(record, isPubliclyAllowed)
  );
}

function rootId(record, recordsById) {
  let current = record;
  const seen = new Set();
  while (current?.status === "merged") {
    if (seen.has(current.submissionId) || !hasText(current.mergeIntoSubmissionId)) return null;
    seen.add(current.submissionId);
    current = recordsById.get(current.mergeIntoSubmissionId);
  }
  return hasText(current?.submissionId) ? current.submissionId : null;
}

function safeRevisionHistory(sources) {
  return sources
    .flatMap((entries) => entries)
    .sort((left, right) => left.at.localeCompare(right.at) || left.sourceRevisionRef.submissionId.localeCompare(right.sourceRevisionRef.submissionId));
}

function createPublicContributionReadModel({ isPubliclyAllowed, resolvePublicIdentity } = {}) {
  if (typeof isPubliclyAllowed !== "function") {
    throw new TypeError("isPubliclyAllowed must be a function that defaults to deny");
  }
  if (typeof resolvePublicIdentity !== "function") {
    throw new TypeError("resolvePublicIdentity must be a function");
  }

  function build(records) {
    if (!Array.isArray(records)) throw new TypeError("records must be an array");
    const duplicateIds = new Set();
    const recordsById = new Map();
    for (const record of records) {
      if (!hasText(record?.submissionId)) continue;
      if (recordsById.has(record.submissionId)) duplicateIds.add(record.submissionId);
      recordsById.set(record.submissionId, record);
    }

    const cardsById = new Map();
    const historiesById = new Map();
    for (const root of recordsById.values()) {
      if (root.status !== "accepted" || duplicateIds.has(root.submissionId)) continue;
      const eligible = eligibleCandidate(root, isPubliclyAllowed);
      if (!eligible) {
        if (legacyHistoryUnavailable(root, isPubliclyAllowed)) {
          historiesById.set(
            root.submissionId,
            deepFreeze({
              contributionId: root.submissionId,
              availability: { status: "unavailable", reason: "source-snapshots-missing-or-invalid" },
              entries: []
            })
          );
        }
        continue;
      }

      const contributionRecords = [...recordsById.values()].filter(
        (record) => !duplicateIds.has(record.submissionId) && rootId(record, recordsById) === root.submissionId
      );
      const sourceLists = contributionRecords.map((record) => safeSourceSnapshots(record));
      const contributorIds = Array.isArray(root.contributors) ? new Set(root.contributors.filter((id) => hasText(id))) : null;
      const sourceIdentityIds = new Set(contributionRecords.map((record) => record.submittedByIdentityId));
      if (
        !contributorIds ||
        contributorIds.size === 0 ||
        contributorIds.size !== (Array.isArray(root.contributors) ? root.contributors.length : 0) ||
        [...contributorIds].some((id) => !sourceIdentityIds.has(id)) ||
        sourceLists.some((sources) => !sources)
      ) {
        historiesById.set(
          root.submissionId,
          deepFreeze({
            contributionId: root.submissionId,
            availability: { status: "unavailable", reason: "source-snapshots-missing-or-invalid" },
            entries: []
          })
        );
        continue;
      }

      const submittedBy = publicIdentity(
        resolvePublicIdentity,
        root.submittedByIdentityId,
        root.submittedByDisplayName
      );
      if (!submittedBy) continue;
      const contributions = contributionRecords
        .map((record, index) => ({
          submissionId: record.submissionId,
          submittedBy: publicIdentity(resolvePublicIdentity, record.submittedByIdentityId, record.submittedByDisplayName),
          submittedAt: sourceLists[index][0].at,
          sourceRevisionRef: sourceLists[index].at(-1).sourceRevisionRef
        }))
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt) || left.submissionId.localeCompare(right.submissionId));
      if (contributions.some((entry) => !entry.submittedBy)) continue;

      const proposal = eligible.candidate.proposal;
      const workflow = proposal.submissionKind === "workflow" ? eligible.source.workflow : null;
      const card = deepFreeze({
        contributionId: root.submissionId,
        kind: proposal.submissionKind,
        title: publicText(proposal.title),
        summary: publicText(proposal.summary, 2000),
        submittedBy,
        originalAuthor: eligible.source.originalAuthor,
        canonicalSource: eligible.source.canonicalSource,
        licenseId: eligible.source.licenseId,
        sourceRevisionRef: eligible.source.sourceRevisionRef,
        reviewed: {
          status: eligible.candidate.reviewStatus,
          at: eligible.reviewedAt
        },
        riskLevel: eligible.candidate.riskLevel,
        workflow,
        contributions,
        actions: PROPOSAL_ACTIONS
      });
      cardsById.set(root.submissionId, card);
      historiesById.set(
        root.submissionId,
        deepFreeze({ contributionId: root.submissionId, availability: { status: "ready" }, entries: safeRevisionHistory(sourceLists) })
      );
    }

    const cards = deepFreeze([...cardsById.values()].sort((left, right) => left.contributionId.localeCompare(right.contributionId)));
    return Object.freeze({
      list() {
        return cards;
      },
      get(contributionId) {
        return cardsById.get(contributionId) || null;
      },
      history(contributionId) {
        return historiesById.get(contributionId) || null;
      },
      profile(identityId) {
        const contributions = cards.filter((card) => card.contributions.some((entry) => entry.submittedBy.identityId === identityId));
        const statusSummary = contributions.reduce(
          (summary, card) => {
            summary.accepted += 1;
            if (card.riskLevel === "low") summary.low += 1;
            if (card.riskLevel === "guarded") summary.guarded += 1;
            return summary;
          },
          { accepted: 0, low: 0, guarded: 0 }
        );
        return deepFreeze({ identityId, statusSummary, contributions });
      }
    });
  }

  return Object.freeze({ build });
}

module.exports = { createPublicContributionReadModel };
