# Official MCP Registry run3 full-review completion contract

Date: 2026-08-15 (Asia/Shanghai)

Status: FROZEN CONTRACT / CANDIDATE-ONLY / NOT EXECUTED

This contract defines a bounded, auditable final disposition for the 21,622 run3 identities that remain after the two frozen ten-item primary-source reviews. It does not claim that 21,622 publisher sites were visited. It closes every row through deterministic local reconciliation, small primary-source work units, and fail-closed deferral when evidence is absent, contradictory, inaccessible, or outside the fixed review budget.

Nothing in this document authorizes an MCP call, endpoint invocation, login, OAuth grant, package download or install, catalog mutation, candidate generation, signing, release, packaging, recommendation, or publication.

## Contract result

Completion means:

1. exactly 21,622 distinct input publication identities each have one terminal disposition;
2. the only terminal dispositions are ready-link-only, deferred, blocked, and duplicate;
3. there is no pending, unknown, implicitly trusted, or silently overwritten row;
4. every result is bound to the frozen input hashes, a stable server identity, a pinned publication or hosted-service observation, and an evidence-manifest SHA-256;
5. all output arithmetic, manifests, checkpoints, and canonical bytes are independently reproducible;
6. a ready-link-only result is only eligible for a separate candidate review and never mutates the active catalog by itself.

The completion path is deliberately finite. Missing evidence is a final deferred result for this review revision, not a reason to crawl indefinitely.

## Frozen local inputs

Every path and SHA-256 below is a precondition. A future executor must read and hash every byte before selecting any row. Any mismatch stops before output mutation.

| Input | SHA-256 | Bytes | Contract use |
| --- | --- | ---: | --- |
| output/research/official-mcp-registry-intake-2026-08-15-run3/checkpoint.json | 955910bb1b580e9cbe6b60487d2219b3ad08e7c962a09d1b17208b716255d634 | 60,760 | Completed rolling-enumeration lineage |
| output/research/official-mcp-registry-intake-2026-08-15-run3/registry-index.ndjson | a0ac7fe2e126b7c65eb4b6ff700ea71a5fb95c17b2db57518d9fd1fb5606ba7a | 20,711,984 | 21,698 normalized Registry rows |
| output/research/official-mcp-registry-intake-2026-08-15-run3/summary.json | f1891db11db3e4ef1afd139b776a9120bae6a359df751766c2f49e393b6eada0 | 498 | Enumeration totals and rolling-snapshot boundary |
| output/research/official-mcp-registry-triage-2026-08-15-run3/ledger.ndjson | e9c1ac9931bb97ca87826e726eaeaaa09a9705c1804982450c5cac125516757d | 5,445,085 | One triage row per Registry identity |
| output/research/official-mcp-registry-triage-2026-08-15-run3/namespace-clusters.json | ecd9cdc40858b429b2b90f7f8189b1f454549012fcbc51262b96d8f31f938466 | 2,225,485 | 13,911 namespace clusters |
| output/research/official-mcp-registry-triage-2026-08-15-run3/prior-evidence.json | 8f3bd80be42280f0110f194e2abc474a2f52c28d534ade8b6e9efe5a42b01a1b | 6,360 | Exact 15-file prior-evidence lineage used by triage |
| output/research/official-mcp-registry-triage-2026-08-15-run3/summary.json | 7f3360d0008137161fae4f0abce50c01dae96737fbc6f56c14b29060bcc188e3 | 1,729 | Triage arithmetic and evidence lanes |
| docs/research/official-mcp-registry-run3-complete-triage-handoff-2026-08-15.md | 627dae3b82e749c451925a21bd9812055443de0814aa99ca98bae94f6a40cddc | 6,749 | Frozen triage interpretation |
| docs/research/official-mcp-registry-run3-first10-primary-review-2026-08-15.md | b46d323dcecd3e3814da3fa4726bc6c32e5ed4db201aa156c14f8caeeb4c7125 | 24,677 | First ten terminal reviews |
| docs/research/official-mcp-registry-run3-next10-primary-review-2026-08-15.md | c9cea0f78dc2c9d98c8487e4c91cd11743bbaaff507d58abd06b1a148676838a | 25,862 | Next ten terminal reviews |
| docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json | dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8 | 1,790,395 | Latest candidate baseline: 375 vendors, 616 products, 280 Resources, 866 targets, 10 connections |
| docs/research/auralogs-mcp-catalog-v3-frozen-handoff-2026-08-15.md | 4c637ee4613357e48b5482febcee38e8c05b58c6bcf3b7ce635503449ab80049 | 5,476 | Candidate lineage and protected boundary |

The run3 index was fully parsed in this research pass: 21,698 rows, 21,451 active, 247 deprecated, zero deleted, and 334 rows with one normalization warning. The triage ledger and all 13,911 namespace clusters were likewise fully parsed rather than sampled.

## Exact 21,622 arithmetic

The frozen triage partition is:

~~~text
21,698 total
= 4 catalog-exact-identity
+ 12 catalog-source-signal
+ 40 prior-research-observed
+ 21,642 unreviewed
~~~

The two frozen primary-source documents each consume ten distinct rows that were active, warning-free, repository-lane members of the 21,642:

Their 20 exact publication keys, sorted by raw UTF-8 bytes and serialized as one `<publicationKey><LF>` record each, form a 523-byte manifest with SHA-256 `39341c46fa4fc1064f726dbcbe322f478976c382e9bf743e101f858309da7d20`. A future executor must reproduce this manifest from the two frozen review documents before subtracting any row.

~~~text
21,642 unreviewed
- 10 first review
- 10 next review
= 21,622 completion-contract rows
~~~

The whole census therefore remains accountable:

~~~text
21,698
= 4 catalog exact
+ 12 source signals
+ 40 prior evidence
+ 20 frozen primary reviews
+ 21,622 rows governed here
~~~

The 21,622 rows have these frozen characteristics:

| Axis | Count |
| --- | ---: |
| active | 21,376 |
| deprecated | 246 |
| repository evidence lane | 17,181 |
| website evidence lane | 2,790 |
| insufficient-evidence lane | 1,280 |
| package-only lane | 371 |
| warning-free | 21,288 |
| one normalization warning | 334 |
| rows in a namespace with more than one remaining record | 9,235 |
| rows in a singleton remaining namespace | 12,387 |
| distinct remaining namespaces | 13,854 |
| normalized repository URLs present | 17,181 |
| distinct normalized repository URLs | 15,555 |
| repository URLs reused by more than one remaining row | 407 |
| rows covered by those reused repository URLs | 2,033 |

The repository URL counts use the exact normalized `repository.url` field emitted by the frozen index. They intentionally group rows that share a URL, including distinct subfolders, and are therefore routing-only; `repositoryStableKey`, defined below, preserves the stricter source, repository ID, owner/repo, and subfolder identity. These are routing facts, not trust facts. A namespace, repository, package, website, or shared monorepo never bulk-approves its rows.

## Official Registry boundary

The [official aggregator guide](https://modelcontextprotocol.io/registry/registry-aggregators) describes an unauthenticated read-only REST API, cursor pagination, regular but infrequent downstream synchronization, local persistence, updated-since filtering, and no uptime or durability guarantee. It also says status should be kept current. Run3 is therefore a complete rolling enumeration with snapshotIsolation=false, not a transactional database snapshot.

The Registry remains in preview. The [official API documentation at the locally reviewed source revision](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/docs/reference/api/official-registry-api.md) defines version=latest, updated_since, include_deleted, and active, deprecated, and deleted lifecycle states. The [response types](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/pkg/api/v0/types.go) distinguish server metadata from Registry-managed status, timestamps, and isLatest.

The [official versioning guide](https://modelcontextprotocol.io/registry/versioning) says each publication has a unique version and recommends alignment with the package or remote API version. AI Hub therefore treats server.name as lineage identity and server.name@server.version as publication identity. A changed latest version is a review event, not a new independent Resource and not an automatic upgrade.

The [official about page](https://modelcontextprotocol.io/registry/about#trust-and-security) says the Registry authenticates namespaces and hosts metadata, while code scanning and additional curation are delegated to package registries and downstream aggregators. Namespace control is not proof of code safety, source authorship, legal operator identity, license, host compatibility, authentication quality, or acceptable tool behavior.

The [Registry Terms](https://modelcontextprotocol.io/registry/terms-of-service) dedicate Registry Data metadata to CC0 and expressly exclude packages in third-party registries. CC0 therefore does not transfer or imply:

- copyright or redistribution rights for source, packages, binaries, icons, datasets, documentation, or hosted service code;
- a license for customer content or data returned by a server;
- publisher identity, safety, endorsement, affiliation, compatibility, or AI Hub review;
- permission to invoke an endpoint, install a package, authenticate, or store credentials.

The official repository's [LICENSE](https://github.com/modelcontextprotocol/registry/blob/a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be/LICENSE) governs that repository's implementation and documentation under their own scopes. It does not license third-party Registry entries.

The [moderation policy](https://modelcontextprotocol.io/registry/moderation-policy) describes minimal moderation and uses deleted status for removal, including malware, illegal content, spam, or non-functioning servers. Absence of deleted status is not a safety approval. An explicit deleted event is a stop-recommending signal, not permission to erase the local audit chain.

## Stable identity and approved revision

The following terms are exact:

| Term | Definition |
| --- | --- |
| stableServerKey | exact Registry server.name; stable lineage key across versions |
| publicationKey | exact server.name + "@" + server.version |
| namespaceKey | exact substring of server.name before its single slash |
| repositoryStableKey | normalized repository source + immutable repository ID when available + owner/repo + exact subfolder; URL alone is only a fallback signal |
| aihubResourceId | stable AI Hub Resource ID assigned only by a later approved candidate; never derived from a version string |
| snapshotId | SHA-256 of the canonical normalized snapshot manifest, not a wall-clock label |
| evidenceManifestSha256 | SHA-256 of the exact first-party source records and normalized claim facts used by one review |
| approvedRevision | publicationKey, publisher revision, evidence manifest SHA, review document SHA, and the candidate/catalog baseline SHA against which the review was deduplicated |

An approved revision must have this exact conceptual shape:

~~~json
{
  "publicationKey": "namespace/server@version",
  "publisherRevision": {
    "kind": "commit|tag|package-release|hosted-observation",
    "value": "immutable-revision-or-observed-at"
  },
  "evidenceManifestSha256": "64-lowercase-hex",
  "reviewDocumentSha256": "64-lowercase-hex",
  "candidateBaselineSha256": "64-lowercase-hex"
}
~~~

For a rolling hosted service with no public source revision, kind=hosted-observation is allowed only for link-only review. Its value is the frozen observation timestamp plus a publisher-controlled service identity fingerprint. It is never represented as an installable source revision.

The stable AI Hub Resource ID does not change when Registry version changes. Instead, the current approved revision remains pinned and the new observation enters reviewQueue. Active facts are never overwritten from Registry metadata.

## Deterministic selection and routing

### Remaining-set construction

1. Read the frozen index and ledger in full.
2. Require exactly 21,698 unique registryId values and a one-to-one index/ledger join.
3. Select ledger disposition=unreviewed.
4. Remove the exact 20 publication keys named by the two frozen primary-review documents.
5. Require exactly 21,622 unique publication keys.
6. Join namespace cluster and index facts without inventing absent fields.
7. Sort by the routing priority below, then namespaceKey, repositoryStableKey or empty string, stableServerKey, and publicationKey using raw UTF-8 byte order.

### Pre-dedupe routing partition

Priority is applied in this order so the four cohorts are disjoint:

| Route | Predicate | Frozen count | External fetch |
| --- | --- | ---: | --- |
| lifecycle | status=deprecated | 246 | none |
| metadata-drift | status=active and warningCount greater than zero | 332 | none |
| metadata-only-light | status=active, warningCount=0, evidenceLane is package-only or insufficient-evidence | 1,623 | none |
| manual-primary | status=active, warningCount=0, evidenceLane is repository or website | 19,421 | bounded first-party review |
| total | disjoint union | 21,622 | |

The 1,623 metadata-only-light rows are 1,261 insufficient-evidence plus 362 package-only rows. Registry metadata and a package pointer alone cannot close publisher, exact source revision, service boundary, authentication, revocation, retention, exact host, permissions, or risk. After the local duplicate pass, each remaining member receives deferred with reason METADATA_ONLY unless a later rolling snapshot supplies a publisher-controlled repository or website and moves it into a new review revision. No search-engine expansion is performed for this lane.

The 19,421 manual-primary rows are 16,655 repository-lane plus 2,766 website-lane rows before duplicate resolution. This is the exact set requiring bounded human first-party review under this contract. It may shrink only when a row is proven duplicate. It may not grow by substituting adjacent Registry rows.

### Structured duplicate pass

All 21,622 rows first undergo a local, network-free duplicate comparison against:

- the latest 280-Resource candidate and its path-and-SHA-verified ancestors;
- active catalog and all frozen candidate/history Resource identities;
- Registry publication and stable server keys;
- external IDs;
- normalized Resource ID and name plus publisher;
- repositoryStableKey and exact subfolder;
- package registry plus identifier;
- canonical publisher-controlled service domain;
- documented successor/deprecation lineage.

Exact or same-server lineage proof yields duplicate and a canonical resource reference. A shared namespace, repository, monorepo, package owner, domain parent, display name, host, transport, or generic purpose is only a review signal. It cannot merge rows by itself. Every losing observation remains in the audit ledger.

Duplicate has priority over the ordinary routing outcome, but it never suppresses an independent security alert against the canonical Resource.

## Bounded primary-source work units

Manual work is scheduled by namespace cluster and repositoryStableKey to reuse public evidence without bulk trust:

- one batch contains at most 10 exact publication keys;
- a repository or namespace with more than 10 rows is deterministically split by publicationKey;
- one publisher host has concurrency 1;
- one identity may inspect at most eight distinct publisher-controlled URLs in one review revision;
- at most two distinct URLs may be used for any single evidence category;
- a URL is requested at most once per review revision;
- link following is limited to one publisher-controlled hop from a frozen Registry, repository, package, docs, or legal pointer;
- evidence may cover multiple identities only when the first-party source names every exact identity/version or an explicit common service revision;
- search results, snippets, third-party directories, mirrors, copied README text, and Registry descriptions can locate a source but cannot close a fact.

Allowed primary sources are publisher-controlled repositories at fixed revisions, package releases with publisher or trusted-publishing provenance, publisher-controlled docs/service/legal pages, and the Official MCP Registry only for Registry identity/status metadata.

The reviewer never calls the MCP endpoint, enumerates tools through protocol traffic, downloads or executes a package, logs in, starts OAuth, creates an account, submits data, or tests a write. Tool and permission facts come from publisher-controlled static documentation or fixed source.

When the eight-URL budget is exhausted, the row terminates as deferred with REVIEW_BUDGET_EXHAUSTED. A later revision may reopen it only with a new source observation and a new evidence manifest; the old terminal result remains immutable.

## Evidence requirements

Each manual-primary identity is evaluated independently. A cluster-level fact may be reused only through its exact source SHA and claim mapping.

| Evidence category | Required closure | Fail-closed result |
| --- | --- | --- |
| namespace and cluster | exact stableServerKey, namespaceKey, cluster size, and per-identity purpose; no bulk publisher inference | ambiguous identity or cluster collision: deferred; proven impersonation: blocked |
| publisher | publisher-controlled source plus code maintainer and hosted-service legal operator where applicable | absent or contradictory operator/ownership: deferred |
| repository | canonical repository, immutable ID when available, exact subfolder, fixed commit/tag/release, and publisher relation | dead, rolling-only, unrelated, or unpinned source: deferred |
| version | exact Registry publication mapped to source/package revision or explicitly bounded hosted-service observation | Registry/package/source/service version drift: deferred |
| license | same-revision SPDX/license file and exact scope, or explicit proprietary service/link boundary and applicable terms | unknown license or license applied outside its scope: deferred |
| authentication | no-auth, API key, OAuth, service account, or other exact mode; scopes and user initiation; AI Hub never-collect boundary | unknown mode/scopes or implied credential handling: deferred |
| revocation | publisher-controlled key disable/rotate/delete or OAuth disconnect/revoke path, expected effect, and timing | material auth without revocation evidence: deferred |
| retention | inputs, outputs, content, logs, account data, backups, processors, deletion path, and material time windows | material data with unknown retention/deletion: deferred |
| hosts | exact publisher documentation naming the exact product/mode mapped to an existing AI Hub host ID | generic brand, protocol compatibility, or community setup only: deferred |
| permissions and tools | complete bounded read/write/delete/external-action surface from fixed source/docs, including costs and irreversible effects | partial, contradictory, dynamic, or open-world surface not bounded: deferred or blocked if affirmatively unacceptable |
| endpoint | transport kind plus SHA-256 fingerprint of canonical endpoint identity; never persist or invoke the endpoint value | missing or changed endpoint fingerprint: reviewQueue and deferred until reapproved |
| risk | data sensitivity, code/browser/network reach, credentials, health/finance/legal impact, payment, deletion, irreversibility, and human confirmation | unknown material risk: deferred; affirmative prohibited risk: blocked |

Ready-link-only does not mean low risk. An unsafe server may be ready-link-only only when the evidence is closed and the later card accurately warns about the risk while exposing no execution or connection capability.

License scope is never inherited:

- Registry CC0 covers Registry Data metadata only;
- a repository license covers only the files/revision named by that license;
- a package license does not automatically cover a hosted service;
- a metadata/client repository license does not cover private server code;
- service terms do not license third-party datasets or customer content;
- one monorepo license or publisher identity does not automatically cover every server/subfolder.

## Terminal disposition priority

Emergency security handling is an independent overlay evaluated first; it is not a fifth disposition and cannot silently rewrite catalog data.

The normal terminal disposition priority is:

1. duplicate — exact identity or documented same-server/successor lineage is proven against a canonical Resource;
2. blocked — affirmative first-party or independently verified evidence proves impersonation, malware/illegal behavior, a non-functioning or intentionally misleading server, or an AI Hub policy-prohibited risk that cannot be represented safely even as a link;
3. deferred — lifecycle is non-active, metadata normalized with warnings, metadata-only evidence is insufficient, any required evidence is missing or contradictory, a source is unavailable, or the bounded review budget closes without proof;
4. ready-link-only — every material evidence category required for the exact identity is closed, no blocker exists, exact hosts are proven, and the only proposed behavior is to open approved first-party information.

Deferred is the universal fail-closed fallback. Blocked requires an affirmative reason; lack of evidence alone is deferred under this completion contract. A row cannot be ready merely because it is active, latest, namespace-authenticated, popular, open source, or present in an official Registry.

Fixed reasonCode values are:

~~~text
DUPLICATE_EXACT
DUPLICATE_LINEAGE
LIFECYCLE_DEPRECATED
LIFECYCLE_DELETED
NORMALIZATION_WARNING
METADATA_ONLY
PUBLISHER_UNCLOSED
REPOSITORY_UNCLOSED
VERSION_UNCLOSED
LICENSE_UNCLOSED
AUTH_UNCLOSED
REVOKE_UNCLOSED
RETENTION_UNCLOSED
HOST_UNCLOSED
PERMISSIONS_UNCLOSED
TOOLS_UNCLOSED
ENDPOINT_DRIFT
RISK_UNBOUNDED
PRIMARY_SOURCE_UNAVAILABLE
REVIEW_BUDGET_EXHAUSTED
IMPERSONATION
MALICIOUS_OR_ILLEGAL
NON_FUNCTIONING
POLICY_BLOCK
READY_LINK_ONLY
~~~

Reason arrays are unique and sorted by this declared enum order, not locale order.

## Exact completion-ledger schema

The future completion output is one canonical JSON object per line. Each object has exactly these keys in this order:

~~~json
{
  "schema": "official-mcp-registry-run3-final-disposition-v1",
  "stableServerKey": "namespace/server",
  "publicationKey": "namespace/server@version",
  "namespaceKey": "namespace",
  "sourceSnapshotSha256": "64-lowercase-hex",
  "status": "active|deprecated|deleted",
  "initialRoute": "lifecycle|metadata-drift|metadata-only-light|manual-primary",
  "disposition": "ready-link-only|deferred|blocked|duplicate",
  "reasonCodes": ["fixed-enum"],
  "canonicalResourceId": null,
  "approvedRevision": null,
  "evidenceClosure": {
    "publisher": "closed|gap|not-applicable",
    "repository": "closed|gap|not-applicable",
    "version": "closed|gap",
    "license": "closed|service-boundary|gap",
    "auth": "closed|none|gap",
    "revoke": "closed|not-applicable|gap",
    "retention": "closed|not-applicable|gap",
    "hosts": "closed|gap",
    "permissions": "closed|gap",
    "tools": "closed|gap",
    "endpoint": "fingerprinted|not-applicable|gap",
    "risk": "low|guarded|unsafe|unknown"
  },
  "factFingerprints": {
    "version": "64-lowercase-hex",
    "repository": "64-lowercase-hex",
    "license": "64-lowercase-hex",
    "publisher": "64-lowercase-hex",
    "auth": "64-lowercase-hex",
    "permissions": "64-lowercase-hex",
    "tools": "64-lowercase-hex",
    "hosts": "64-lowercase-hex",
    "endpoint": "64-lowercase-hex"
  },
  "compatibleHostIds": [],
  "publicEvidenceUrls": [],
  "evidenceManifestSha256": "64-lowercase-hex",
  "evidenceObservedAt": "RFC3339",
  "reviewBatchId": "sha256-derived-id",
  "candidateEligible": false,
  "recommendation": "eligible-for-separate-candidate|do-not-recommend|stop-recommending|canonical-only"
}
~~~

Rules:

- canonicalResourceId is non-null only for duplicate.
- approvedRevision is non-null only for ready-link-only and has the exact shape defined earlier. candidateBaselineSha256 is the frozen input baseline, not a future candidate; a later candidate cites this immutable ledger row rather than rewriting it.
- fact fingerprints are SHA-256 of canonical normalized values. Missing values use the SHA-256 of the exact token ABSENT, so absence is drift-detectable.
- endpoint is never persisted; only its transport kind and fingerprint contribute to the endpoint fact hash.
- publicEvidenceUrls contain only publisher-controlled public documentation/source/legal/package pages, never MCP endpoints, private APIs, authorization endpoints, dashboard URLs requiring login, credential-bearing URLs, or raw query secrets.
- candidateEligible is true if and only if disposition=ready-link-only.
- recommendation is eligible-for-separate-candidate only for ready-link-only, canonical-only for duplicate, stop-recommending for deprecated/deleted, and do-not-recommend otherwise.
- metadata-only and local duplicate rows still receive a deterministic evidence manifest containing their frozen local source references and absence/gap facts.

## Evidence-manifest schema

Each ledger row points to one canonical evidence record:

~~~json
{
  "schema": "official-mcp-registry-primary-evidence-v1",
  "stableServerKey": "namespace/server",
  "publicationKey": "namespace/server@version",
  "inputManifestSha256": "64-lowercase-hex",
  "sources": [
    {
      "kind": "registry|repository|package|docs|service|terms|privacy",
      "url": "public-https-url",
      "observedAt": "RFC3339",
      "revision": "fixed-revision-or-hosted-observation",
      "contentSha256": "64-lowercase-hex",
      "claimIds": ["fixed-claim-id"]
    }
  ],
  "factFingerprints": {
    "version": "64-lowercase-hex",
    "repository": "64-lowercase-hex",
    "license": "64-lowercase-hex",
    "publisher": "64-lowercase-hex",
    "auth": "64-lowercase-hex",
    "permissions": "64-lowercase-hex",
    "tools": "64-lowercase-hex",
    "hosts": "64-lowercase-hex",
    "endpoint": "64-lowercase-hex"
  },
  "reviewDocumentPath": "repo-relative-path",
  "reviewDocumentSha256": "64-lowercase-hex"
}
~~~

No raw response body, response header, command, argument, environment value, credential, token, secret, cookie, endpoint, private content, or publisher-provided opaque metadata is persisted.

## Rolling snapshots and drift reconciliation

### Snapshot diff

Every later Registry synchronization remains a rolling snapshot and must have its own input manifest and snapshotIsolation=false. Use version=latest for baseline plus an overlapping updated_since reconciliation that includes explicit deleted rows. Absence from a rolling current snapshot is not deletion; only an explicit deleted status or an independently authorized tombstone can establish deletion.

Diff by stableServerKey:

- added: present only in current snapshot;
- changed: present in both but publicationKey or a controlled fact fingerprint changed;
- deprecated: current explicit status is deprecated;
- deleted: current explicit status is deleted;
- unchanged: publicationKey, status, and all controlled fact fingerprints are byte-equal.

Each stableServerKey contributes to exactly one diff count using the precedence deleted, deprecated, added, changed, unchanged. A deprecated/deleted entry still lists every other changed controlled field. An added entry lists every non-ABSENT controlled field in controlled-field order, followed by status.

The controlled fields are exactly version, repository, license, publisher, auth, permissions, tools, hosts, and endpoint. A change in any one enters reviewQueue. A new latest version is changed, not an automatic replacement. Unknown fields, missing approved-revision bindings, or incompatible schema changes fail closed.

### Deep interface

The only reconciliation seam is:

~~~text
reconcile(previousSnapshot, currentSnapshot, approvedCatalog) -> reviewQueue
~~~

The function is pure. It performs no fetch, write, catalog mutation, recommendation change, or clock read.

Inputs:

- previousSnapshot: canonical Registry/evidence observation manifest and records from the last accepted reconciliation;
- currentSnapshot: canonical rolling Registry/evidence observation manifest and records for the new reconciliation;
- approvedCatalog: read-only active or frozen candidate catalog plus each Resource's stableServerKey and approvedRevision.

The exact reviewQueue result is:

~~~json
{
  "schema": "official-mcp-registry-review-queue-v1",
  "previousSnapshotSha256": "64-lowercase-hex",
  "currentSnapshotSha256": "64-lowercase-hex",
  "approvedCatalogSha256": "64-lowercase-hex",
  "diff": {
    "added": 0,
    "changed": 0,
    "deprecated": 0,
    "deleted": 0,
    "unchanged": 0
  },
  "entries": [
    {
      "stableServerKey": "namespace/server",
      "previousPublicationKey": null,
      "currentPublicationKey": null,
      "changeKind": "added|changed|deprecated|deleted",
      "changedFields": ["version|repository|license|publisher|auth|permissions|tools|hosts|endpoint|status"],
      "approvedResourceId": null,
      "approvedRevisionSha256": null,
      "action": "manual-review|stop-recommending",
      "priority": "P0|P1|P2"
    }
  ]
}
~~~

Entries are unique by stableServerKey and sorted P0, P1, P2, then raw UTF-8 stableServerKey. changedFields follow the controlled-field order above. unchanged appears only in the diff count and never creates a queue entry.

Priority:

- P0: explicit deleted, identity/publisher/repository/endpoint conflict, known malicious signal, or approved revision missing;
- P1: version, license, auth, permissions, tools, hosts, or status=deprecated drift for an approved Resource;
- P2: newly added unapproved identity or non-security repository/publisher metadata drift.

The output never modifies approvedCatalog. Every queued active Resource remains pinned to its approved revision. Version, repository, license, publisher, auth, permissions, tools, hosts, and endpoint changes are review-required and cannot overwrite active values.

### Deprecated, deleted, and emergency disable

- deprecated preserves the Resource and all evidence history but changes recommendation intent to stop-recommending after the separate candidate/state review;
- deleted preserves a tombstone and full audit chain, stops new recommendation, and enters P0 review;
- neither status automatically deletes a catalog object, local installation, receipt, or user data;
- a later reactivation creates a new reviewQueue event and does not revive recommendation automatically.

An emergency malicious-disable path is separate from normal reconciliation. It requires an incident record, exact affected Resource/revision, evidence SHA, reversible disable action, owner, independent security/CTO review, and recovery criteria. It may immediately suppress recommendation when authorized, but it may not erase history, rewrite provenance, silently uninstall anything, or turn a Registry moderation action into an AI Hub malware verdict without review.

## Checkpoint, manifest, and byte idempotence

### Future output set

A compliant executor may create only this isolated future output set after separate authorization:

~~~text
output/research/official-mcp-registry-run3-final-disposition/
  input-manifest.json
  batch-plan.json
  completion-ledger.ndjson
  evidence-manifest.ndjson
  checkpoint.json
  summary.json
  MANIFEST.sha256
~~~

This document does not create those files.

### Canonical bytes

- UTF-8 without BOM;
- LF only and one final LF;
- fixed schema key order exactly as shown;
- JSON strings use standard JSON escaping;
- NDJSON has one compact object per line;
- ledger rows sort by raw UTF-8 publicationKey;
- evidence rows sort by raw UTF-8 publicationKey;
- source arrays sort by kind in the exact order registry, repository, package, docs, service, terms, privacy, then URL bytes and revision bytes;
- set-like arrays are unique and use their declared enum or raw UTF-8 order;
- no generated timestamp reads the current clock during rebuild; observed timestamps come from frozen evidence;
- rerunning with identical inputs and evidence must reproduce identical bytes;
- if target bytes already match, the executor performs no rewrite, preserving mtime.

### Batch checkpoint

Each batch has at most ten identities. It is built completely in memory, validated, then atomically appended/replaced as a new whole-file candidate. checkpoint.json binds:

~~~json
{
  "schema": "official-mcp-registry-run3-completion-checkpoint-v1",
  "inputManifestSha256": "64-lowercase-hex",
  "batchPlanSha256": "64-lowercase-hex",
  "completedBatchIndex": 0,
  "completedRows": 0,
  "counts": {
    "ready-link-only": 0,
    "deferred": 0,
    "blocked": 0,
    "duplicate": 0
  },
  "lastPublicationKey": null,
  "ledgerSha256": "64-lowercase-hex",
  "evidenceManifestSha256": "64-lowercase-hex",
  "previousCheckpointSha256": null,
  "stopReason": null
}
~~~

The checkpoint advances only after the whole batch, ledger, evidence manifest, arithmetic, secret scan, and hashes validate. An incomplete work unit never advances lastPublicationKey. Resume requires the exact input manifest, batch plan, output hashes, checkpoint chain, and no concurrent writer. Any drift starts a new review revision; it never edits an old checkpoint in place.

MANIFEST.sha256 covers exactly the six data outputs above it, from `input-manifest.json` through `summary.json`; it excludes `MANIFEST.sha256` itself. It lists their repository-relative forward-slash paths sorted by raw UTF-8 bytes, each line exactly:

~~~text
<sha256><two spaces><relative-path><LF>
~~~

`summary.json` records input count, terminal counts, route counts, diff counts, bytes, line counts, candidateEligible count, network stop count, and candidateOnly=true/publishable=false. It does not contain its own SHA or the MANIFEST SHA. The MANIFEST SHA is computed after `summary.json` is frozen and is reported only by a separately authorized frozen handoff, preventing a hash cycle.

## Stop conditions

### Whole-run fail-closed stops

Stop before advancing the checkpoint when any of these occurs:

- any frozen input path, byte length, or SHA differs;
- index/ledger join, uniqueness, 21,698, 21,642, 20, or 21,622 arithmetic fails;
- schema, enum, key order, normalization, sort order, or namespace parsing drifts;
- a publicationKey or stableServerKey has conflicting canonical bytes;
- candidate ancestry, path, or SHA verification fails;
- an unknown controlled fact or output field appears;
- an endpoint value, command, argument, environment value, header, credential, token, secret, cookie, private data, or raw body would be persisted;
- manifest, checkpoint chain, summary, byte idempotence, final LF, BOM, or trailing-whitespace validation fails;
- the output path is a link/reparse point, a temp file is orphaned, or another writer/process holds the same run;
- a finished row would remain pending or have more than one terminal disposition.

### External-source stops

On any 401, 403, or 429, issue no further network request in that batch and do not retry, log in, change identity, bypass access control, rotate IPs, or switch to a private API. The affected row may be finalized deferred with PRIMARY_SOURCE_UNAVAILABLE using only the public URL and fixed status class; no response body/header is persisted. The remaining unfinished unit stays behind the last committed checkpoint for a separately authorized later batch.

Redirect drift, other 4xx/5xx, DNS/TLS/timeout/stream failure, content-type drift, or response-cap failure also stops the current external batch without retry. A stable 404/410 or unavailable publisher page is a bounded evidence gap and final deferred result, not an invitation to scrape mirrors.

If the fixed eight-URL limit is reached without closure, finalize deferred and advance only after full row validation. This is how the contract remains finite.

## Completion definition

The run is complete only when all conditions below pass:

- 21,622 output rows and 21,622 unique publicationKey values;
- every input row appears exactly once;
- terminal counts sum exactly to 21,622;
- route counts reconcile to the frozen pre-dedupe partition, with duplicate overrides separately reported;
- every duplicate points to one existing canonical Resource;
- every ready-link-only row has non-null approvedRevision, exact CompatibleHost IDs, closed material evidence, candidateEligible=true, and no endpoint/profile/connection;
- every non-ready row has candidateEligible=false and at least one deterministic reasonCode;
- deprecated/deleted rows preserve audit history and are not recommended;
- completion ledger, evidence manifest, checkpoint, summary, and MANIFEST hashes all verify;
- two pure rebuilds are byte-identical and equal the frozen output;
- secret/endpoint/raw-response scan finds zero prohibited values;
- no catalog, state, channel, release, App, shared schema, package, server, signing, installation, connection, or production system was changed.

Completion is evidence that every run3 remainder row received an auditable review disposition under this contract. It is not evidence that every server works, is safe, is still online, supports a user's real account, or has passed production or real-device acceptance.

## Candidate gate

The latest local baseline is the frozen 280-Resource Auralogs candidate at SHA-256 dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8. It remains candidateOnly=true, freezeOnly=true, and publishable=false.

Only ready-link-only ledger rows may be considered by a later, separately authorized candidate generator. That generator must:

1. revalidate the completion manifest and latest candidate/history ancestry;
2. rerun exact and semantic duplicate checks at object level;
3. bind the stable AI Hub Resource ID to one approvedRevision and evidence manifest SHA;
4. add only official + resource-link + website targets with exact existing host IDs, empty installProfileId, and explicit risk/never-collect wording;
5. add no endpoint, command, arguments, environment, headers, credentials, token, secret, package/runtime execution, OAuth initiation, managed profile, connection edge, publisher/product relation, or local action unless separately researched and approved;
6. prove deep reversal to the frozen base, schema validation, negative collision tests, deterministic generator bytes, and a new frozen handoff;
7. stop at candidate-only handoff for independent CTO audit.

No ready result auto-overwrites an active Resource. No changed or deprecated result auto-updates or removes one. Publication, signing, catalog save, release, package, install, connection, and production actions each require their own explicit authority and acceptance.

## Research scope and exclusions

- The complete frozen run3 index, triage ledger, namespace clusters, summaries, both ten-item reviews, and latest 280-Resource candidate/handoff were read locally.
- Official sources were limited to the MCP Registry aggregator guide, API/schema/repository documentation, Terms, versioning, trust/security, moderation, and repository license.
- No Registry list/detail API, MCP endpoint, publisher MCP endpoint, private API, package, OAuth flow, login, install, or external write was called.
- No 401, 403, or 429 was encountered in this research pass.
- Only this Markdown is added. No future completion output, script, test, candidate, catalog, state, channel, release, App, schema, package, or server file is created or modified.
- This file's SHA-256, byte count, LF line count, BOM state, final newline, trailing whitespace, and diff scope are calculated after the final write and reported externally to avoid self-reference.
