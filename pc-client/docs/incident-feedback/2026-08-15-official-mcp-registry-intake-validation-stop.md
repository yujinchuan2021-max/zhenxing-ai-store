# Official MCP Registry full-intake page-1 validation stop

Date: 2026-08-15 (Asia/Shanghai)
Scope: discovery-only metadata intake; no catalog, state, release, package, install, sign, or publish authority

## Outcome

The first coherent full-census run started from the documented first page and stopped before committing page 1. The only persisted runtime artifact is:

- `output/research/official-mcp-registry-intake-2026-08-15/stopped.json`
- SHA-256 `5a99f3e55528d4156f3432f9bb95179a0aab22853bc1e10f0fbf2350e777f335`
- exact state: `validation-stop`, page `1`, cursor `null`
- observed write time: `2026-08-14T22:01:19.7542351Z`

There are zero normalized page files, zero checkpoint/index/summary files, zero raw response files, zero temporary files, and zero remaining matching intake processes. The run was not retried.

## Second authorized attempt

The explicitly authorized run2 used a fresh fixed output directory and also stopped before committing page 1. Its only persisted artifact is:

- `output/research/official-mcp-registry-intake-2026-08-15-run2/stopped.json`
- SHA-256 `bc964616738fd3eaaa24d80066befe373395de7ac663b47ad336d5c2f0d79677`
- exact state: `validation-repository`, page `1`, cursor `null`
- observed write time: `2026-08-14T22:17:40.1932944Z`

Run2 also produced zero normalized page files, zero checkpoint/index/summary files, zero raw response files, zero temporary files, and zero remaining matching intake processes. Its one-run authorization was consumed; it was not retried.

## Frozen preflight evidence

- intake module `2bdc255f7f643523262123e3c36db1a57538b2a6d48d734a908a41b4ae8c03ff`
- fixed-path CLI `7cf5999fb8487116284b9200896df0a729cda653237c817964428a89f95b76d2`
- focused test `fa082ea232ea2e79cf43326258c4f97c7af6adb9c4da4c6d28d0ef6b67286f53`
- limited-response dependency `394f5d2ed3d4a3e714d29ab848f27fb1987bd5f90132670fb8c630575bab449a`
- research contract `f1c253de505fa3c179020856308f5cef8b62492a53dc0c35083b93a38f418045`
- target absent before invocation; parent was a normal non-link directory; no matching process; free space was 684,066,705,408 bytes

## Diagnosis boundary

The first implementation intentionally persisted only the generic validation class, so the exact rejected field cannot be independently reconstructed without fetching the page again. It would be false to claim that a specific field caused the stop.

Local contract review nevertheless found two over-constraints compared with the official response contract and historical rows: `$schema` is not a safe discovery identity requirement, and `updatedAt` may be absent. A new synthetic RED reproduced that these omissions were rejected. The projection now accepts them as optional while still requiring canonical server identity, latest status metadata, safe package/transport structure, and exact normalized output fields.

Run2's fixed `validation-repository` category proves that repository normalization rejected the page, but the exact rejected field and value were intentionally not persisted and cannot be claimed. The official Registry Go model at commit `a25f166b4b5bee06eeecb75e4f37b2a44a8aa5be` marks repository `url`, `source`, `id`, and `subfolder` with `omitempty`, and its URL format is a general URI rather than an HTTPS-only identity. The intake had treated repository metadata as a required, trusted HTTPS projection. That was stricter than the current implementation contract.

The corrected boundary keeps only safe optional repository facts and records fixed normalization-warning enums when a value is absent or unsafe. It applies the same rule to other non-identity metadata: malformed display text, package references, remote transport hints, status messages, and timestamps are omitted rather than copied or allowed to stop a full page. A synthetic RED first failed with `official timestamps are required`; the revised focused suite proves that canonical name/version/status/latest identity survives while secret-bearing package and remote values do not persist. Core page shape, cursor, identity, status, latest marker, duplicate, and cycle failures remain fail-closed.

The stop classification was also made granular without persisting response values. Future markers use fixed enums such as `validation-schema-url`, `validation-package`, and `validation-identity`; remote error text is never written.

## Snapshot decision

The earlier 45 records were collected across multiple observation times. They remain continuity and comparison evidence only. A current complete census must begin at the first page in one coherent rolling run; it must not splice those 45 records onto a later cursor and call the result a current full snapshot.

## Prevention gate

Before a new public run:

1. preserve both failed-run markers as evidence;
2. freeze the revised module, CLI, test, and dependency hashes;
3. rerun the full focused suite and syntax/diff checks;
4. use the fresh exact run3 output directory with no links, processes, temporary files, or prior artifacts;
5. start from the first page, serial concurrency 1, two-second delay, manual redirects, 32 MiB streaming cap;
6. stop without retry on any 401/403/429, network error, schema drift, duplicate identity, or cursor cycle;
7. persist normalized discovery metadata only—never raw bodies, headers, remote endpoints, command arguments, environment variables, or credentials.

This incident does not authorize removal of the stop marker or another public run by itself.
