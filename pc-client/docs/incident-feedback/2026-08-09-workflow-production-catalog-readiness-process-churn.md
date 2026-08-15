# Workflow production catalog-readiness process churn

Date: 2026-08-09

## Symptom and evidence

The one authorized r8 cutover reached temporary acceptance `ready`, then failed
closed at `catalog-readiness`. The allowlisted report attributed
`readiness-timeout`, `not-ready`, four attempts, HTTP class `2xx`, and elapsed
bucket `30-60s`. Automatic rollback restored the exact prior images, active6
catalog pointer and disabled flags. The retained official bootstrap state was
unchanged at three source posts and 9/9/9 Workflow event, idempotency and head
counts. r8 is obsolete and must not be retried.

## Root cause

The 2xx response was Identity's owner capability with `enabled=false`.
`enabled` becomes true only while the configured signed Admin catalog
projection is verified and ready and all Workflow owner gates are present. The
verified projection cache lasts 15 seconds; starting Community and Caddy after
the earlier cold-readiness check can legitimately expire it, so the full-stack
check must observe a real signed-catalog refresh. This capability does not
identify a catalog channel. The separate manifest-controlled active7
activation and official-bootstrap one-shot retain the exact signed v2
release/version/catalog-SHA gate.

The runner intended to poll every 250 ms for 30 seconds, but each attempt
started a new `docker exec` and a new Node process inside the production
Identity container. The retained report proves only that four HTTP attempts
completed; the fixed 0.35 CPU quota and full-stack contention can amplify that
process-start cost but are not a unique root cause for `enabled=false`.
Admin unavailability, network isolation, signature or high-water rejection,
configuration flags, reviewer-secret state and service-identity state retain
their own independent fail-closed gates. HTTP 2xx proves the Identity process
remained reachable; it does not make `enabled=false` ready or identify which
upstream gate was not ready.

## Fix

The runner now starts one bounded `docker exec` and performs the same real HTTP
GET repeatedly inside that one process. The endpoint remains fixed at the
Identity loopback capability route. The 30-second deadline, 250 ms interval,
10-second per-request bound, Compose CPU limit and cleanup behavior are
unchanged. Success requires the exact owner capability values HTTP `200`,
`enabled=true`, `schemaVersion=1`, `execution=false`, and
`workflowSubmissionLookup=true`. The outer exec has a 35-second kill bound so
a stuck child fails closed rather than bypassing cleanup.

Only `status`, `enabled` and `attemptCount` cross the child-process boundary.
Non-2xx responses, any exact-contract mismatch, malformed JSON, early exit,
timeout and any unexpected or extra child output fail closed without response
bodies, paths, errors or secrets entering the report.

## Automated verification

- The focused RED fixture returned four HTTP 200 responses with
  `enabled=false` and a fifth with `enabled=true`; the former host-loop process
  model had no persistent-probe seam. The replacement reaches the fifth real
  response in one child process without changing the deadline.
- Focused tests cover non-2xx, continuously false, malformed response, each
  exact owner-capability field drifting, early exit, stuck-exec timeout,
  extra-field redaction, exact process count and failure cleanup reachability.
- A fixed-resource Docker readiness probe, true-Linux release preparation,
  durable systemd/HUP acceptance and all four fresh production-shaped cutover
  scenarios are required in the r9 freeze.
- The frozen r9 evidence satisfies those gates without server access:
  `identity-catalog-readiness-docker-20260809160544771-4456c023/report.json`
  (SHA-256 `bf3b7c68725856a078f3b67d4955049ea8deca9a4a2ae0981950a5ef3c107775`)
  proves the 0.35 CPU old-process model (four exact not-ready responses, then
  exact ready) and the single-process replacement (17 real HTTP attempts),
  including network, signature, high-water rollback and same-version SHA
  mismatch recovery. The true-Linux bundle/preparer report SHA-256 is
  `6c7d977662103348e16bba057ed0c9423fb662b4df92e725897cfb6e12a6c386`,
  the durable systemd/HUP report SHA-256 is
  `81797b8459e04c41cf76817bb7db73d4358700feca6bd6f5cead1722e3836411`,
  and the empty/retained success/failure aggregate report SHA-256 is
  `53036be2903d93f670c97851b039a71aed3a4185b4bb58d48d0043df4f2cf14f`.
  Every report remains `candidateOnly=true`, `deployable=false`, and records
  zero matching container/network/volume/private-root residue.

## Prevention gate

A bounded poll that crosses a container/process boundary must not create one
container process per interval. Attempt counts must describe real bounded HTTP
requests, readiness must remain tied to the signed authority result and exact
owner capability contract, v2 identity must remain a separate signed tuple
gate, failure evidence must stay allowlisted, and the unchanged production
resource limit must be represented in acceptance.

## Test-fixture deadline-edge regression (2026-08-10)

The independent A readiness gate initially reported two negative fixture leaves
as transport status `0` rather than their expected HTTP `200`: continuously
`enabled=false` and `schemaVersion` drift. This was not a production probe
regression. The fixture already waited for the loopback server's `listening`
event, but its test-only `80 ms` deadline, `5 ms` interval and `25 ms`
request bound repeatedly polled a response which was intentionally never
ready. A reproduced failure recorded 73 completed fixture requests before a
deadline-edge abort returned status `0` and replaced the previous HTTP result.

The test fixture now asserts the exact IPv4 loopback listener before the
probe, and uses only its own `1000 ms` deadline, `250 ms` interval and `100
ms` request bound. The runner also keeps the most recent successfully observed
HTTP status when a final deadline-edge transport abort follows it. Readiness
still tests the current response against the exact contract and only stops on
that response being ready, so the change cannot turn a false, malformed or
drifting response into `enabled=true`. It still requires HTTP `503` for
non-2xx and HTTP `200` with `enabled=false` for continuous false or any
exact-contract field drift. The production 30-second deadline, 250 ms
interval, 10-second request bound, CPU limit, signed-catalog validation and
exact DTO gate are unchanged.

Focused acceptance is 37/37, each previously flaky leaf family is stable for
10 consecutive runs, and the combined local deployment/Identity readiness
command is 133/133. The runner's changed source is frozen in a regenerated
deployment manifest; the test-harness SHA is frozen in the corresponding local
stability report.
