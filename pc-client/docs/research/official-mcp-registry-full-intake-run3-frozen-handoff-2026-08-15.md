# Official MCP Registry full-intake run3 frozen handoff

Date: 2026-08-15 (Asia/Shanghai)

Status: `READY_FOR_EXPLICIT_RUN3_AUTHORIZATION`

This is a discovery-only rolling enumeration contract. It is not a transactional snapshot, catalog candidate, review verdict, install profile, release, signature, or publication authority. Run3 has not been executed.

## Prior attempts preserved

- run1 marker: `output/research/official-mcp-registry-intake-2026-08-15/stopped.json`, SHA-256 `5a99f3e55528d4156f3432f9bb95179a0aab22853bc1e10f0fbf2350e777f335`, exact class `validation-stop`, page 1, null cursor
- run2 marker: `output/research/official-mcp-registry-intake-2026-08-15-run2/stopped.json`, SHA-256 `bc964616738fd3eaaa24d80066befe373395de7ac663b47ad336d5c2f0d79677`, exact class `validation-repository`, page 1, null cursor
- both attempts persisted zero normalized pages, checkpoints, indexes, summaries, raw responses, or temporary artifacts
- run2's one-run authorization was consumed and was not retried

The run2 category proves repository normalization rejected page 1. It does not prove which field or value was rejected because raw responses and remote error text were intentionally not persisted.

## Frozen input and implementation bytes

| Path | SHA-256 | Bytes |
|---|---|---:|
| `docs/incident-feedback/2026-08-15-official-mcp-registry-intake-validation-stop.md` | `603ff904be710127571ca904adbde12d1de15432a71d107ab6f07faa10ee8441` | 5,478 |
| `docs/research/official-mcp-registry-full-enumeration-plan-2026-08-15.md` | `f1c253de505fa3c179020856308f5cef8b62492a53dc0c35083b93a38f418045` | 21,795 |
| `scripts/official-mcp-registry-intake.mjs` | `d034eacef4e58455f8d064728ce3fa781ad2b1c1ae1a40b74c80766b72023116` | 1,354 |
| `shared/limited-response.cjs` | `394f5d2ed3d4a3e714d29ab848f27fb1987bd5f90132670fb8c630575bab449a` | 1,517 |
| `shared/official-mcp-registry-intake.cjs` | `afb78728f8789f577d15f4f29daaa4ba56f508087b6d37864a001f159c8f140e` | 31,630 |
| `tests/official-mcp-registry-intake.test.cjs` | `b942bf1e749432cd4580fe1a99662efec3c0496dc482d9b4c9e6368f7e8b69e7` | 23,003 |

The fixed output path is `output/research/official-mcp-registry-intake-2026-08-15-run3`. The CLI accepts no arguments.

## Contract

- starts at the current first page: anonymous `GET /v0.1/servers?limit=100&version=latest`
- serial concurrency 1, at least 2 seconds between pages, manual redirect handling, 30-second request timeout, 32 MiB streaming byte cap
- stops without retry on 401, 403, 429, redirects, non-200, URL/content-type drift, stream/JSON failure, core page or identity drift, duplicate identity/name, or cursor cycle
- retains canonical `name@version`, latest lifecycle status, safe public links, minimal package references, counts, and fixed provenance only
- malformed non-identity metadata is omitted with a fixed enum in `normalizationWarnings`; it never copies the rejected value
- persists no raw body, raw header, remote URL, command, arguments, environment values, credentials, tokens, secrets, endpoint, runtime configuration, or publisher-provided metadata
- each page, checkpoint, final NDJSON, and summary is atomic and hash-bound; one durable orphan page may be promoted only after full validation
- completed reruns are byte- and mtime-idempotent and perform zero fetches
- summary states `fullEnumeration=true` and `snapshotIsolation=false`; the public preview API exposes no snapshot token

## TDD and local verification

- RED: a valid Registry identity with malformed non-identity metadata failed at `official timestamps are required`
- GREEN: the identity survives, unsafe package/remote/display/timestamp values are absent, and only fixed warnings persist
- RED: summary asserted a transactional `fullSnapshot` claim
- GREEN: the claim was replaced by explicit rolling-enumeration semantics
- final focused command: `node --test tests/official-mcp-registry-intake.test.cjs tests/limited-response.test.cjs` -> 17/17 PASS
- `node --check` passed for module, CLI, and test
- implementation, CLI, test, and incident have UTF-8 without BOM, final newline, and zero trailing whitespace matches

## Final local preflight

- run3 target absent
- parent directory is a normal directory, not a reparse point
- matching intake Node processes: 0
- D: free space observed: 684,066,611,200 bytes
- run1 and run2 marker hashes remain unchanged

## Authority boundary

Do not start run3 without a new explicit one-run authorization such as `执行 run3` or `提前执行 run3`. Any authorization permits one invocation only. A failure consumes that invocation and must stop without retry. Success authorizes only local validation and review-queue work; it does not authorize catalog mutation, signing, release, package, installation, endpoint invocation, or publication.
