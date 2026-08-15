# Workflow production Caddy public probe used the redirecting HTTP listener

## Symptom and retained production evidence

The one authorized r7 durable unit completed the official Workflow one-shot.
Identity's direct public list returned 2xx with exactly three items, and the
append-only store retained 9 events, 9 idempotency rows and event-head 9. The
wrapper then called Caddy at its HTTP listener and received a 308 redirect to
the public HTTPS hostname. Redirects are correctly not followed, so the wrapper
failed closed and the unchanged cutover trap restored active6, the prior Admin
and Identity images, and all Workflow flags disabled.

The retained official report SHA-256 prefix is `7d6f9e`, evidence-tree prefix
`6c787a`, terminal-status prefix `153f1e`, and backup-control prefix `ff437f`.
The append-only writes and successfully committed Flarum/bootstrap ownership
are preexisting production data after rollback: exact 9/9/9 Workflow history,
one disabled official publisher with no login relations, and three fixed source
posts. r7 is obsolete and must not be retried. No server was connected or
written while preparing r8.

## Root cause and excluded hypotheses

`workflow-official-bootstrap-production-wrapper.cjs` used fixed
`http://caddy:80` semantics for its Caddy readback. Production Caddy correctly
redirects that listener to HTTPS. The one-shot, Identity direct list, d6 v2
catalog, terminal-LF secret parser, durable systemd unit and rollback all
behaved as designed; the failure was the wrapper's stale transport choice.

## Fix

The Caddy readback is now fixed to internal `caddy:443` using Node HTTPS. TLS
SNI and the HTTP `Host` header are both the separately validated public host,
the request uses `agent:false`, normal certificate verification remains on,
and no URL or redirect-following option is accepted. The response must still
be exact 200 with three public-safe items. Its report contains only the direct
Identity and Caddy status classes and item counts.

Cutover preflight also recognizes the production state created by the failed
r7 attempt, but only as one third, exact baseline. It requires old images,
active6, all six flags disabled, the preexisting schema/reviewer, exact
manifest-bound 9/9/9 operations, actors, workflow references and idempotency
hashes, one relation-free disabled publisher, exact GET-verified source keys,
and exactly three marker-shaped official source discussions. Both former empty
baselines remain exact; partial, extra, mixed-flag and unknown states fail.
Retained replay must make no append and rollback must not delete any of those
preexisting resources.

The change is entirely in manifest-controlled deployment/runner code. Identity
source digest `f18ec9d51b4e30bb01323e0d1c752d94a4b9e32556ef1e7dd845e3bfcdc358ee`
and immutable image ID
`sha256:e76979a8c827eb4feb6e1f14026d8813f487535df654838299d139817b856731`
remain unchanged, so the already frozen r7 Identity image archive is reused.
The new durable run is `workflow-production-r8` with unit
`zhenxing-ai-workflow-production-r8.service`.

## Automated verification and remaining gate

TDD reproduces the old HTTP 308 before proving HTTPS 200 with exact SNI and
Host. It rejects an untrusted certificate, hostname mismatch and redirect, and
checks that only safe status-class/item-count evidence is retained. Pure state
tests cover both empty baselines, exact retained idempotent replay, and rejection
of 8, 10, bad operations/actors/references/hashes, publisher/source/flag drift,
and a fourth official marker discussion.

The frozen deployment set is
`cd7464b24547576408caa3c35c07e67ba0e303bacf4dd17f61da291d5739892e`.
Fresh true-Linux preparation passed in
`output/workflow-production-release-bundle-linux-723c4f27ec/report.json`
(`d7db3e4c6140b489c55ea76a3192fda6574704c0cf189ae567bb011d70b26375`),
and the real systemd PID1 caller-HUP gate passed in
`output/workflow-production-durable-cutover-linux-9f8446dfc1/report.json`
(`32d5366146b794578e8cce6032bda7b635113cd38f5ac7602ea6d8d4d6e6ea00`).

The Windows disposable runner required two runner-only corrections before its
final evidence was accepted. Identity now receives Caddy's locally issued root
through a fresh, dedicated read-only trust volume; a no-network helper with all
capabilities dropped except `DAC_READ_SEARCH` copies the fixed root from the
Caddy-owned data volume, then Identity UID 1000 proves it readable. Also, after
seeding the retained fixture, the old Admin is restored with `--no-deps` so the
normal enabled overlay cannot recreate Identity through Caddy's dependency
tree after the canonical emergency-disable has set all six flags to zero.
Neither correction changes the production Caddyfile, Compose set, cutover,
launcher, bundle, or deployment manifest.

The final fresh four-scenario production-shaped C report is
`output/workflow-production-release-bundle-cutover-31a22e3f67/report.json`
(`d0630d7200213a561668ed08c8f69bc1f11e8e6eb6c758c0cdf3e52b76bcf18c`).
Empty success, empty deliberate failure, retained success and retained
deliberate failure all passed with exact rollback/readback, zero secret hits,
and zero runner-owned container, network or volume residue. These local gates
are candidate evidence for independent Test/Release; they are not production
acceptance or deployment authorization.

## Prevention gate

Every public ingress probe must test the production listener/protocol pair,
including redirect behavior and certificate/hostname validation. A rollback
that leaves append-only committed data must produce a separately enumerated,
manifest-bound recovery baseline; it may never be treated as empty, inferred
from counts alone, or cleaned by a later run.
