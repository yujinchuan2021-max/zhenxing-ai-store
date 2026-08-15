# Resource Store Channel and Intake Contract

## Canonical catalog shape

`resources[]` remains the only canonical resource collection. A resource has one
stable `id`, can carry several `resourceTypes`, and can have several target
products. Stores are projections, never copied records.

- `sourceKind=official` projects to the official channel.
- `sourceKind=reviewed-community|community` projects to the community channel.
- The original `sourceKind` is retained so reviewed community material is never
  presented as unreviewed community material.
- `order` is the only catalog ordering input. `targets[].compatibility`,
  `requestedPermissions`, `credentialRequirements`, `provenanceEvidence`, and
  `enabled` remain the host, permission, evidence, and delisting facts.

New Admin resource drafts and resource intake candidates must explicitly set
`sourceKind`, `reviewStatus`, and `riskLevel`. Old signed releases without the
two governance fields are read as `unreviewed` and `guarded`; this is a display
compatibility default, not a retrospective review result.

`reviewStatus` and `riskLevel` are independent:

- `reviewStatus`: `unreviewed`, `automated-reviewed`, `manually-reviewed`, or
  `rejected`.
- `riskLevel`: `low`, `guarded`, or `unsafe`.
- `unsafe` and `rejected` records may remain visible as warnings with their
  source links, but every target must remain `resource-link`; they cannot have
  a managed module, fixed install profile, Agent binding, Workflow dependency,
  silent download, or execution action.
- `low` still requires the existing exact fixed profile and fresh local
  authorization before any managed action. `guarded` does not bypass the same
  rule and requires its own future per-use confirmation contract.

There is no `invoke`, endpoint, command, argument, header, credential, script,
or arbitrary code field. Skill, MCP, Plugin, Connector, and future Workflow
keep their distinct semantics and target bindings.

## Candidate intake and dedupe seam

`planCanonicalResourceIntake(resources, candidate)` is intentionally only a
planner. It accepts canonical identity and channel/governance metadata, returns
`create-canonical` or `update-canonical`, and never saves a draft or copies a
resource into another store. A matched `id` means the reviewer extends or
corrects that one canonical resource instead of creating a second record.

For future Workflow validation, the only planned resource dependency is the
read-only tuple `{kind:'resource', canonicalId, hostProductId, bindingKind}`.
`bindingKind` is one of `skill-context`, `mcp-tool`, `mcp-resource`,
`mcp-prompt`, `plugin-host-extension`, or `connector-authorized-connection`.
It must match a fixed target binding in the active signed catalog. This does not
create a Capability Broker or execute anything.

Selected lists, topics, user stars, heat, favorites, install counts, and
reports are review/intake projections, not authorization or security fields.
They must not change `reviewStatus`, `riskLevel`, a fixed profile, or a managed
target by themselves.

## CocoLoop collection boundary

CocoLoop collection is a candidate-only metadata snapshot. It may read public
sitemap/page metadata allowed by the site; it must not use `/api/`, bulk download
or execute ZIP files, or write the active catalog. Each snapshot item keeps:

```text
sourcePlatform: "cocoloop"
discoveredVia: "cocoloop"
sourcePage: canonical public HTTPS page
externalId: platform Skill ID
observedAt: ISO timestamp
licenseStatus: "unverified" until first-party verification, then "verified"
originalAuthor/licenseId/sourceRevision: required before first-party-verified
externalReference: ratingValue/ratingCount/stars/heat/favorites/installCount/CLS
provenanceStatus: "first-party-verified" | "provenance-unresolved"
canonicalSource: original-author HTTPS site/repository/registry, required when verified
```

Every external value retains its platform meaning. In particular, CLS is only
an external claim and never maps to this catalog's `riskLevel` or
`reviewStatus`. ZIP retrieval is permitted only later, for a bounded,
approved, isolated review batch with first-party provenance checks.

`discoveredVia=cocoloop` is never removed or presented as a first-party
origin. Canonical catalog text is independently summarized from the original
author's material; it does not copy third-party page copy. If the original
author, repository, package registry, or license cannot be established, keep
the candidate as `provenance-unresolved`: it is searchable only as a warning
and dedupe record, and is not eligible for managed installation, Agent binding,
or Workflow dependency.

## Single-directory capacity gate

The client hard limit remains the shared `CATALOG_RELEASE_MAX_BYTES = 2 MiB`.
Before approving a resource intake batch, release review must measure the exact
post-transform, signed envelope bytes, not the JSON source file or resource
count alone.

| Envelope utilization | Required evidence / decision |
| --- | --- |
| `<= 75%` (1,572,864 bytes) | Record exact envelope bytes and the canonical resource/target counts; one signed directory remains the design. |
| `> 75%` | Open a partition design review before accepting another bulk import. No crawler or second directory is introduced automatically. |
| `>= 85%` (1,782,579 bytes) | Stop large batch intake until CTO accepts a measured channel/partition proposal and compatibility plan. |
| `> 2 MiB` | Client contract rejects the response; publishing is not release-ready. |

Current read-only baseline on 2026-08-07: v2 active6 raw signed envelope is
897,652 bytes (42.8% of 2 MiB), with 146 canonical resources and 513 targets.
It is below the review threshold. This measurement does not authorize a
publish, save, download, or install.
