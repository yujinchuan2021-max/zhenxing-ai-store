# Local Agent Bridge Electron facade candidate

Status: `candidate-only`, default disabled. This document does not enable a
transport, execution, catalog change, session lookup, receipt write, or package.

`electron/local-agent-bridge-ipc.cjs` is the only proposed Electron boundary.
It exposes the fixed fulfilled-envelope channels:

| Channel | Preload method | Input |
| --- | --- | --- |
| `agent-bridge:capability` | `getLocalAgentBridgeCapability()` | none |
| `agent-bridge:search` | `searchLocalAgentBridge(input)` | `{kind,query,limit,visibility?,agentId?,sessionId?}` |
| `agent-bridge:get` | `getLocalAgentBridge(input)` | `{kind,id,version?,visibility?,agentId?,sessionId?}` |
| `agent-bridge:plan` | `planLocalAgentBridge(input)` | `{agentId,sessionId,agentProductId,workflowId,version,useId}` |
| `agent-bridge:request` | `requestLocalAgentBridge(input)` | `{agentId,sessionId,planId,capabilityKey,useId}` |

Every response is `{ok:true,value}` or
`{ok:false,error:{code,status,messageKey}}`; main and preload convert thrown
causes to a fixed error. There is no `execute`, `apply`, `install`, localhost
listener, generic JSON-RPC, or backend command/argument/environment/path field.
The request output is only a pending confirmation ticket; its Agent binding,
session, receipt, vault, identity and audit fields are removed before renderer.

The facade becomes available only when its future local adapter proves all four
readiness facts: a verified current catalog, the Workflow candidate's exact
`resolvePlanningRelease({workflowId,version})` resolver, an Agent+session-bound
local receipt/vault snapshot, and Bridge readiness. The resolver must provide
only the immutable reviewed Release allowlist and be injected into the Bridge
snapshot; public cards and mutable owner drafts are forbidden. Today main has
none of that adapter, so capability is always `enabled:false` and every Bridge
operation returns `BRIDGE_DISABLED` without fabricating a snapshot.

For CLI's future dry-run seam, reuse the existing fixed local profile and
driver only after a fresh Bridge plan and explicit client confirmation. The CLI
driver must re-check the exact ownership receipt and fixed profile, stage and
roll back through its existing lifecycle, and write a receipt only after a
separate confirmed apply. A Bridge ticket alone is not apply authority.

The current Auggie coverage gate remains blocked by ownership outside this
facade: draft 89 omits `repair`, while the fixed `cli.augment-auggie` profile
already declares the exact owned-prefix repair strategy. The reviewed canonical
candidate requests the catalog capability addition; backend must consume or
reject it through an explicit catalog decision. No registry or catalog file was
changed here.

Focused evidence: `tests/local-agent-bridge-ipc.test.cjs` verifies default
disablement, all-four readiness gating, fulfilled envelopes, strict output
redaction, fixed channel registration, and preload rejection handling. These
tests are not third-party Agent, Electron user-machine, package, or production
acceptance.
