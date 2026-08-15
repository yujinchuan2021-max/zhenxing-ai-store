# Workflow production bootstrap rejected a terminal-LF forum API key

## Symptom and retained production evidence

The one authorized r6 durable unit passed the active7 catalog activation and
entered the fixed official bootstrap one-shot, then exited before source-post or
Workflow database writes. The production `forum_api_key` file was 65 bytes with
one LF, no CR and no NUL. The fixed parser rejected every CR or LF byte. The
unchanged cutover trap restored exact active6, the prior Admin and Identity
images, the preexisting Workflow schema/reviewer service identity, zero
events/idempotency/event-head, disabled Workflow flags and six healthy services.
The retained r6 status SHA-256 prefix is `ac3bc329`, official report prefix
`55eac08e`, evidence-tree prefix `0d40a2f0`, and backup-control prefix
`1bf89d`. r6 is obsolete and must not be retried. No server was connected or
written while preparing r7.

## Root cause and excluded hypotheses

`identity/workflow-official-bootstrap-production.cjs` read the fixed secret file
as UTF-8 and rejected any `\r` or `\n` before constructing the fixed local
Flarum transport. The catalog, public-host, two-file wrapper, durable systemd
unit, rollback and d6 v2 one-shot contracts were not the cause. The earlier
local fixture wrote a newline-free key, so it did not reproduce the production
file shape.

## Fix

The r7 parser removes only one terminal LF. It does not call `trim()` and does
not accept CRLF because no forum-key host or cross-platform authority requires
that representation. It rejects bare or internal CR/LF, repeated newlines,
leading/trailing whitespace, semicolon header delimiters, NUL/C0/DEL/Unicode
format controls, non-string values and normalized lengths outside 32..512.
After validation, the exact remaining value is passed only to the fixed
`http://127.0.0.1` Flarum transport's Authorization header. Error and report
boundaries retain fixed messages and never record the value.

Because the parser is in the Identity Docker COPY closure, r7 uses source
digest `f18ec9d51b4e30bb01323e0d1c752d94a4b9e32556ef1e7dd845e3bfcdc358ee`,
image `zhenxing-ai/identity:workflow-readiness-candidate-f18ec9d51b4e`, image ID
`sha256:e76979a8c827eb4feb6e1f14026d8813f487535df654838299d139817b856731`
and a new immutable image archive. The fixed durable run is
`workflow-production-r7` / `zhenxing-ai-workflow-production-r7.service`.

## Automated verification and remaining gate

TDD first reproduced the exact 64-byte value plus terminal LF as a 65-byte file
and observed the old rejection. The green matrix covers both accepted forms and
all rejected line-ending/control/whitespace/length variants, then captures the
exact fixed Flarum header without exposing the credential in the URL. Both the
standalone full-stack bootstrap runner and the independent production-shaped C
harness now create the observed terminal-LF secret file; the latter must execute
the real canonical two-file wrapper and prove 3 official Workflows plus 9/9
events/idempotency.

Local candidate evidence is not production acceptance. Test/Release must
independently rerun the frozen r7 static/Node, true-Linux preparation, true
systemd caller-HUP and fresh disabled-baseline C success/failure gates before a
new production launch can be considered.

## Prevention gate

Every production secret-file consumer must test the exact file metadata and
line-ending shape actually provisioned, not only an in-memory secret value.
Normalization must enumerate allowed terminal sequences, never use `trim()`,
and must be followed by validation before the value reaches its fixed authority
header. Any COPY-closed parser change requires a new source manifest, immutable
image, archive, deployment manifest, durable run ID and fresh A-E evidence.
