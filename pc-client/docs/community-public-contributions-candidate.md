# Community public contributions candidate

Status: candidate-only, disabled by default. This is a pure community read model; it creates no HTTP route, database table, Flarum extension, catalog write, or workflow execution path.

## Module boundary

`community/public-contributions.cjs` exports:

```js
createPublicContributionReadModel({ isPubliclyAllowed, resolvePublicIdentity }).build(records)
```

It consumes canonical submission records from the existing Admin state machine and returns only:

- public contribution cards;
- an immutable-identity keyed public-contribution profile summary; and
- a safe revision timeline.

The module calls `resourceSubmissionCatalogMergeCandidate(record)` rather than reproducing submission status, review-status, or risk-level rules. A card requires all of: accepted/non-unsafe candidate status, canonical `record.publicEligibility === true`, an exact matching `record.publicEligibilitySourceRevision`, and external `isPubliclyAllowed(record) === true`. `isPubliclyAllowed` is the backend-owned dispute/visibility decision; missing data, exceptions, or any other return value hide the record.

`resolvePublicIdentity(identityId, fallbackDisplayName)` is Identity-owned. It may change the public display name, but must preserve the supplied immutable `identityId`; a nickname is never a key.

## Public allowlist

Every card contains only the public submission identifier, kind, title, summary, current submitter attribution, original-author display attribution/organization, canonical HTTPS source, license, exact `{ submissionId, revision }` source revision reference, reviewed status/time, risk level, exact workflow `{ workflowId, version }` reference, contributor attributions plus their source revision references, and proposal-intent labels.

The only proposal intents are `claim-original-authorship`, `propose-correction`, `propose-evidence`, and `report`. They are labels for a future new-proposal flow, not mutation routes and not client actions.

The read model never emits drafts, submitted/triaged/needs-evidence/rejected/withdrawn records, reviewer notes, evidence references, ownership claims, discovery channel, abuse signals, audit detail, email/phone/token data, commands, scripts, headers, credentials, arbitrary URLs, or execute/invoke/install actions. `unsafe` and rejected candidates cannot enter this projection, so cannot become Agent or Workflow dependencies through it.

## Merge and revision semantics

Only the accepted merge target can produce a card. Merged-away submissions are represented exclusively as contributor entries on that target; the module fails closed unless every target contributor has a recorded, validated source snapshot. A temporary dispute hold simply makes `isPubliclyAllowed` false, so the public card disappears without modifying the source record or its audit trail. Removing the hold and rebuilding restores the same read-only projection.

`history()` reads only append-only `sourceSnapshots`, never reconstructs provenance from the current proposal or audit. Every snapshot and nested reference must match the Admin exact field allowlist; an unknown field or `command`, `args`, `env`, `headers`, `credentials`, `script`, `endpoint`, `path`, secret, or malformed revision reference makes the public card fail closed. The public history emits only its allowlist: source revision reference, time, canonical source, original-author attribution/organization, license, and exact workflow reference. Evidence and `discoveredVia` remain storage/audit-only and are never emitted. Old otherwise-public records without valid snapshots return only `availability: unavailable, reason: source-snapshots-missing-or-invalid` with no card or source fields.

## Integration contracts

| Owner | Required input / responsibility |
| --- | --- |
| Admin | Canonical records, append-only `sourceSnapshots`, exact `sourceRevisionRef`, merge target/contributor facts, canonical `publicEligibility`, and external dispute-hide eligibility. |
| Identity | `resolvePublicIdentity` returning only `{ identityId, displayName }`; display changes must not alter ownership. |
| Community / Flarum | Render these data-only cards or post references. A `CommunityPost` remains discussion/display only; workflow cards contain only `workflowId`, version, and release reference. |
| PC client | Consume the allowlist only. Show proposal intent without local persistence, install, invocation, or catalog mutation. |

No ADR is added: this is reversible candidate seam work, uses existing source-of-truth boundaries, and introduces no production migration or irreversible product decision.

## Acceptance still required

- Identity's current workflow-release lookup deliberately fails closed, so workflow proposals cannot yet become accepted; the workflow fixture only verifies this read-model contract and is not a runnable store listing.
- Candidate migrations remain unexecuted; any future HTTP/DB/Flarum integration needs separately approved migration and privacy review.
- Browser, real-account, and production acceptance have not been run or claimed.
