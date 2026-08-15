# Connector platform-support evidence — draft89 / v2 active6

Status: `candidate-only`; `publishable=false`; no catalog, state, schema,
profile, authorization, login, connection, installation, package, or upload
action was performed.

## Result

The signed `v2` envelope contains exactly three Connector resources and three
targets. Every target is `claude-desktop` + `official` + `resource-link` + an
empty profile + `[website]`. The target has no platform field. The current
Connector managed-eligibility count is therefore **0**.

The candidate uses `pc-client/shared/resource-platform-availability.cjs` as
the only validation/projection seam. It models authorization as `remote` and
keeps Claude Desktop's local host identity (`native`) separate. A web setup or
remote service claim is not a native Connector claim.

## Official evidence and claims

| resource | official fact | Windows | macOS | Linux |
| --- | --- | --- | --- | --- |
| Adobe for creativity | Adobe documents Claude web and Claude Desktop (macOS, Windows), with browser requirements and connection steps | remote supported | remote supported | remote unknown |
| SketchUp Connector for Claude | Trimble documents Claude connector setup and Trimble ID; no OS-specific native claim | remote unknown | remote unknown | remote unknown |
| Affinity AI Connector | Canva announces the Affinity–Claude connection and reusable scripting workflow; no OS-specific claim | remote unknown | remote unknown | remote unknown |

Sources were observed on 2026-08-07: [Adobe getting started](https://developer.adobe.com/adobe-for-creativity/getting-started/), [SketchUp Connector](https://help.sketchup.com/hu/sketchup-claude-connector), [Canva Create 2026](https://www.canva.com/newsroom/news/canva-create-2026-launches/), and [Claude connector documentation](https://claude.com/docs/connectors/getting-started).

## Resource × host × requestedPlatform preview

The requested runtime is `remote`, architecture `universal`, with no runtime
dependency. For each of the 3 resources × 1 host × 3 platforms, the shared
adapter returns `PROFILE_PLATFORM_CLAIMS_MISSING`; all 9 rows are unavailable
and `managedEligible=false` because the fixed local Connector profile registry
has no Connector profile. The platform claims do not relax the existing gates:
no-secret status, fixed permissions plus user confirmation, exact revoke and
post-check, transaction attribution, and a fixed local profile.

| platform | target rows | available | managedEligible | result |
| --- | ---: | ---: | ---: | --- |
| Windows | 3 | 0 | 0 | fixed profile missing |
| macOS | 3 | 0 | 0 | fixed profile missing |
| Linux | 3 | 0 | 0 | fixed profile missing; native host claim unknown |

## Dedupe and forbidden surface

Dedupe key: `resourceId | hostProductId | compatibility | moduleId |
installProfileId | capabilities`. Do not copy platform data onto targets or
create a second vendor/product record. The candidate carries only controlled
platform, runtime, status, architecture and first-party HTTPS evidence fields.
It does not add or infer `command`, `args`, `env`, `headers`, `credentials`,
`script`, arbitrary `endpoint`, `path`, or target overrides. OAuth tokens,
API keys, passwords and other credentials are never collected or stored.

## Handoff

Backend/admin: keep this as an unbound review artifact; no CRUD or publication.
Frontend/resource store: display only explicit evidence/status and preserve
link-only behavior. Desktop: do not implement a Connector profile from this
candidate; any future profile requires a separate fixed lifecycle and receipt
review. Agent Capability Broker: consume only the shared projection after a
future fixed profile exists; do not infer capability from platform claims.

Machine-readable details are in
`connector-platform-support-evidence-draft89-active6-2026-08-07.json`.
