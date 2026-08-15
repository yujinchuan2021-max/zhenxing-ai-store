# Agent Capability Broker candidate

Status: `candidate-only`. This module is not wired to Electron IPC, a public
port, Agent execution, catalog persistence, or publication.

## Deep module seam

`shared/agent-capability-broker.cjs` exposes one factory and one operation:

```js
createAgentCapabilityBroker({ registry, now, platformRequest }).planWorkflow(input)
```

The caller supplies an already verified remote catalog result, one immutable
WorkflowRelease, local extension/connector states, local authorization
receipts, optional per-use confirmations, opaque local vault references, and a
platform/runtime/architecture request fixed by the future client runtime rather
than catalog content. Platform eligibility is delegated to
`shared/resource-platform-availability.cjs`; the Broker contains no duplicate
platform matching logic.
The result is a frozen `ready`, `confirmation-required`, or `blocked` plan plus
redacted audit events. There is deliberately no `invoke`, `execute`, endpoint,
command, or adapter dispatch interface.

## Availability and semantics

A resource capability becomes `available` only when all of these agree:

1. the active remote signed catalog has one enabled reviewed resource, enabled
   target, enabled AI-tool host, and matching profile/module;
2. the client registry has one exact profile whose fixed `agentBindingKinds`
   includes the Workflow dependency `bindingKind` and whose fixed
   `agentEffects` declares its effects; `agentContractVersion` pins grants to
   that exact local contract;
3. the resource, host product and fixed profile have one fresh, supported
   intersection for the requested platform/runtime/architecture; local native,
   WSL and container profiles are platform-specific;
4. the local managed resource is installed/connected, enabled, host-ready, and
   has an unrevoked local Agent capability grant receipt;
5. all Workflow secret placeholders resolve to opaque `vault:<uuid>` local
   references; reference values are never returned or audited;
6. guarded resources/workflows, write/network/secret permissions, or fixed
   write/external/paid/destructive effects have a fresh confirmation matching
   the current `useId` and capability key.

The binding vocabulary is imported directly from
`community/workflow-store.cjs`: Skill is a controlled context package; MCP
keeps tool/resource/prompt distinct; Plugin is a fixed host extension;
Connector is an authorized remote connection. Product dependencies remain
canonical `reference-only` records. Workflow is orchestration over these
references and never becomes executable text.

## Fail-closed state

Current fixed extension profiles do not yet declare `agentBindingKinds`,
`agentEffects`, `agentContractVersion`, or platform support, and current legacy resources without governance fields resolve
to `unreviewed + guarded`. Therefore this candidate does not silently grant an
existing Skill, MCP, Plugin, or Connector to an Agent. Each resource owner must
review and add the exact local profile and first-party platform evidence fields
before any future client wiring.
Connector has no approved managed profile today and remains unavailable.

The broker rejects fallback/packaged catalogs, ambiguous identities, unknown
bindings, unreviewed/rejected/unsafe records, missing local ownership, disabled
state, missing/revoked grants, stale confirmations, executable fields, and
arbitrary Workflow URL/path text. Catalog `website`/`tutorial` evidence remains
display-only and is never copied into a capability plan.

## Receipt and audit seam

Grant receipts and per-use confirmation receipts use exact, versioned local
schemas. Unknown fields are rejected, so secrets cannot be smuggled into them.
The returned audit record contains only time, use ID, capability key, decision,
grant receipt ID, and confirmation ID. Persistence, retention, revocation UI,
vault storage, and real Agent execution are intentionally outside this round.

## Verification and remaining work

`tests/agent-capability-broker.test.cjs` and
`tests/resource-platform-availability.test.cjs` cover the catalog/profile/local/
receipt intersection plus the shared platform intersection, all six exact
binding kinds, per-use confirmation, unsafe and
rejected denial, forbidden execution/location fields, vault non-disclosure,
and reference-only product dependencies. These tests are contract evidence,
not real Agent, account, Connector authorization, paid action, or destructive
operation acceptance.
