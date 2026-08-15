# Local Agent Bridge candidate

Status: `candidate-only`, default disabled. Desktop has a disabled fixed IPC
facade, but this candidate adapter is not enabled in Electron runtime and has no
HTTP/localhost port, MCP stdio, production state, packaging, or publication.

## Deep module interface

`shared/local-agent-bridge.cjs` exposes one factory whose returned interface has
only four asynchronous operations:

```js
createLocalAgentBridge({ enabled, readSnapshot, broker, now, makeId })
  // .search(input)
  // .get(input)
  // .plan(input)
  // .request(input)
```

The single `readSnapshot({agentId, sessionId, workflow?})` seam is
transport-neutral and read-only. `shared/local-agent-bridge-snapshot.cjs`
provides the candidate adapter: it reads a verified catalog and local
Agent/session state, then obtains planning data only through Workflow's exact
`resolvePlanningRelease({workflowId,version})` plus the frozen
`normalizeWorkflowComposition(...).agentBridgePlanInput` projection. It never
uses a public card or owner draft to plan, and it verifies that every projected
dependency is already in that immutable Release before it reaches the Broker.
The repository has MCP client configuration adapters but no reusable local MCP
server/JSON-RPC stdio foundation, so this candidate does not invent one and
does not open localhost HTTP.

## Read and privacy contract

- Anonymous `search/get` can read only enabled products from the active signed
  catalog, reviewed non-unsafe resources, and reviewed public Workflow DTOs.
- Every result is an allowlisted projection. Catalog and Workflow versions are
  explicit. Website/tutorial/evidence URLs, filesystem paths, raw database
  records, owner/reviewer/audit identities, receipts, vault references, and
  secret placeholders are never returned.
- Private Workflow views and local state require an exact local
  `agent-bridge-session`, matching Agent/session IDs, an unrevoked Agent-specific
  grant, and the operation scope. A session for one Agent cannot be reused by
  another, and revocation is rechecked on every call.
- Private owner data is a read-only projection of the existing owner wire DTO;
  it is not a second Workflow domain model and cannot be treated as a reviewed
  release.

All external input is limited to 128 KiB, plain JSON objects with bounded
nesting, exact schemas, and fixed identifiers. Unknown/prototype fields,
command/args/env/headers/credentials/token/secret/script/executable fields,
and arbitrary URL/path values are rejected. Failures use structured error
codes/message keys; raw causes never cross the interface.

## Plan and request contract

`plan` resolves an exact immutable planning release and passes it, the active
signed catalog, and local session-owned state directly to the existing Agent
Capability Broker. The only observable states are `ready`,
`confirmation-required`, and `blocked`. The Bridge does not infer missing
registry authority or reconstruct secret placeholders from the public DTO.

The Workflow candidate now supplies the required immutable resolver and
composition projection. The client still remains blocked unless the desktop
adapter can also prove the verified catalog, exact local profile, installed or
enabled state, Agent/session grant receipt, confirmation, and opaque vault
reference intersection. The Bridge does not change `community/workflow-store.cjs`
or define another composition state machine.

`request` accepts only a still-live `confirmation-required` plan and creates an
ephemeral `pending-user-confirmation` ticket bound to the exact Agent, session,
`useId`, plan, and capability. It does not approve, execute, install, connect,
write catalog/state, or persist a receipt. An actual client may later turn a
confirmed ticket into a separate local confirmation receipt and re-plan through
the Broker; that execution path is outside this candidate.

## Fixed CLI lifecycle candidate

`shared/managed-cli-lifecycle-candidate.cjs` is deliberately separate from the
Bridge and returns only `plan`, `confirm`, and `apply`. It accepts a product ID,
fixed operation, and `useId`; it resolves only an already approved
`managed-cli` registry profile and its fixed driver. `update`, `repair`, and
`uninstall` require a fresh exact AI Hub ownership receipt both during planning
and immediately before apply. Confirmation is bound to the same `useId`.

`apply({dryRun:true})` remains available for non-executing review. A real apply
now has one narrow candidate executor for `portable-binary` single-file
profiles. It accepts only a fixed registry profile, fixed plan, injected user
confirmation, injected receipt store, and injected artifact provider. It stages
the executable into the AI Hub managed directory, writes the exact marker and
receipt only after recheck, restores the prior managed executable and receipt on
failure, and uninstalls only the receipt-owned executable and marker.

The current executable candidate surface is intentionally small: the draft 89
registry contains seven `portable-binary` CLI profiles, but only these four are
single-file executable profiles that match this executor contract:
`google-antigravity-cli`, `moonshot-kimi-code-cli`, `amp-cli`, and
`daytona-cli`. `openfang-cli`, `zeroclaw-cli`, and `open-interpreter-cli` are
zip or directory artifact profiles and stay on the existing Electron shared
driver until a matching fixed executor is wired. npm, Python, MSI, WSL, and
companion-runtime profiles are also outside this candidate executor.

There is still no generic command runner and no external input field for
command, arguments, environment, headers, URLs, paths, scripts, or credentials.

## Exact review scope now

In the current candidate, a reviewer can run the focused test gate and observe
the desktop facade report `capability.enabled=false`. The lifecycle module can
be exercised through an isolated fixture-backed `portable-binary`
`plan -> confirm -> apply(dryRun:false)` path that writes and removes files only
under a temporary root. This proves the candidate executor's receipt, recheck,
rollback, and uninstall behavior without downloading or installing a third-party
package. Existing approved CLI one-click actions remain their existing
fixed-driver behavior and are not replaced by this candidate. A user cannot yet
connect a third-party Agent or turn a Bridge confirmation ticket into
deployment.

## Commercialization reservation

No payment SDK, price, order, split, refund, tax, settlement, payment credential,
or paid UI claim exists here. Payment eligibility is not inferred from Workflow
risk/review fields. If commercialization is added, an independent client-owned
entitlement check belongs after user confirmation and before any future
execution adapter; it must consume only a local entitlement receipt. It is not
an Agent input and is not added as an unused Bridge field or interface today.

## Verification and remaining acceptance

`tests/local-agent-bridge.test.cjs` covers default disablement, the four-operation
interface, public allowlists, private/local scope isolation, cross-Agent denial,
revocation, hostile fields/prototypes/locations/oversize input, secret and error
redaction, Broker delegation/fail-closed behavior, and a non-executing per-use
ticket. These are automated contract tests, not real third-party Agent, MCP
stdio, account, Connector authorization, entitlement, or production acceptance.

## Windows review-package gate

Run the reusable focused gate from `pc-client`:

```powershell
node scripts/test-cli-agent-bridge-review.cjs
```

It exercises the Bridge/Broker plus the existing CLI coverage, deploy-only,
shared binary/Python/MSI/WSL drivers, receipt-owned portable files, product
entry points, and installed-product projection. On the current unmodified
draft 89 it intentionally exits non-zero: the fixed Auggie registry includes
the candidate `repair` capability while draft 89 still omits it. The focused
run currently reports 111 passing and fails the two coverage assertions at that
same catalog/registry mismatch. Backend must consume the already reviewed
canonical Auggie candidate (or explicitly reject it and restore one contract)
before a Windows review package can be called internally consistent.

For the isolated CLI lifecycle executor alone, run:

```powershell
node scripts/test-managed-cli-lifecycle-candidate-e2e.cjs
```

This script does a real local apply, update-failure rollback, receipt recheck,
and uninstall against a temporary fixture executable. It does not perform a
network download, launch a real third-party CLI, mutate user configuration, or
write the production receipt store.

For supported CLI profiles, the user action remains: choose the independent
“命令行工具” product, review fixed dependencies and target location, click
one-click deploy, wait for environment check → deploy → recheck, then use the
opened independent terminal. The client selects only a fixed local
module/profile. Managed drivers stage or isolate changes, write an AI Hub
ownership receipt, preserve prior managed state on supported update/repair
failure, and restrict uninstall to receipt-owned files/prefixes. A failure or
cancel remains a visible failed/canceled task with bounded temporary cleanup;
it is never converted to success. Anytype remains deploy-only (no update,
repair, or uninstall claim), OpenClaw Gateway remains vendor-managed partial,
and official-only blocked products remain website/tutorial records. No backend
command, args, environment, header, URL, or script becomes “one-click deploy.”

Before packaging, the frontend must add truthful disabled/available/error and
confirmation-ticket presentation without implying payment or execution. Desktop
has defined the fixed fulfilled-envelope facade
`agent-bridge:capability|search|get|plan|request`; it must wire this candidate
adapter only after all four readiness facts are available. The future CLI UI
must present the separate fixed lifecycle confirmation and only show executable
apply for the fixed single-file portable profiles above. It must not treat a
Bridge ticket as apply authority. Test/release must resolve the Auggie catalog
candidate, add isolated Electron IPC and third-party Agent transport tests, and
only then build a user review package.
This employee does not package, upload, install, or enable the Bridge.
