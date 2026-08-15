# Workflow cold signed-catalog readiness

Date: 2026-08-07

## Symptom and evidence

In the isolated production-shape Workflow acceptance, Identity had restarted
and Docker `/health` was healthy. The first owner draft containing a valid
active-catalog product dependency returned safe HTTP 400 after 2068 ms. The
same request returned HTTP 201 in 339 ms after the signed projection finished;
the independent cold projection took about 4-5 seconds.

Primary evidence:
`output/workflow-store-production-bb7-20260807183645820/evidence/cold-catalog-resolver-probe.result.json`.

## Root cause

Three different outcomes were collapsed into one boolean:

- a verified catalog projection that did not contain the exact tuple;
- a catalog projection that was still loading or had timed out;
- a fetch, signature, payload, validation, rollout, or high-water failure.

The Workflow ingress wrapper converted both timeout and resolver exceptions to
`false`, then reported `DEPENDENCY_NOT_FOUND`. Identity also exposed a static
enabled capability before the verified dependency projection was ready.
Docker health correctly proved only process liveness; it did not prove catalog
authority readiness.

## Disproved explanations

- The dependency tuple was not missing or malformed: the identical warm
  request returned 201.
- The catalog source was not issuing three independent cold fetches: it already
  shared an in-flight load and cleared it in `finally`.
- Caddy, Electron, Flarum, TLS, and the active release signature were not the
  observed cause; those gates passed in the same isolated run.
- Increasing one generic resolver timeout is not a complete fix. It still
  conflates network or signature failure with canonical absence and cannot
  make capability reporting truthful.

## Fix

The existing signed-catalog source now exposes one `warm()`/`readiness()` seam
over its shared in-flight projection. Identity starts warming it immediately,
while `/health` remains a lightweight liveness endpoint. Workflow owner
capability is disabled until that exact verified projection is ready; cold
owner ingress returns safe `TEMPORARILY_UNAVAILABLE`/503 and triggers the same
warm promise.

Only a completed, verified projection returning literal `false` can become a
canonical dependency 400. Dependency resolver exceptions and its bounded
ingress timeout become 503 without leaking upstream details. Network,
signature, and high-water checks remain unchanged and a failed in-flight load
is cleared so a later request can retry. License and fixed Flarum-post resolvers
retain their separate semantics and limits.

## Automated verification

- Focused source, resolver, persistence, Identity gateway, and deployment
  tests prove cold/loading/unavailable/ready states, exact missing tuples,
  capability gating, startup warmup, and safe errors.
- The immutable Identity candidate image uses the current signed v2 active6
  envelope in a real Docker fixture. Cold boot and restart each produce three
  concurrent 503 responses with one fetch, then 201 after readiness and 400 for
  a real missing tuple. Docker health records at least three consecutive exit-0
  probes. Network and tampered-signature failures return 503 and recover after
  a fresh verified load.

Evidence:
`output/identity-catalog-readiness-docker-20260807112638089-63de5278/report.json`.

## Remaining acceptance

The candidate remains `deployable=false`. The focused Docker fixture does not
replace the complete fresh isolated production-shape acceptance. Test/release
must start a different clean project and rerun migration, backup/restore,
Identity/Flarum/Caddy, owner/reviewer/public HTTP, real Electron, signature,
cold/restart/concurrency, and cleanup gates together.

## Prevention gate

Liveness is not authority readiness. Any signed-catalog consumer must expose a
single shared readiness source, distinguish unavailable from verified absence,
clear failed in-flight work for retry, and test cold boot, restart, one/three
concurrent requests, signature failure, network failure, recovery, and a true
missing tuple. A generic timeout increase must not substitute for that state
model.
