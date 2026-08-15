# Catalog signing key permissions and bounded trust rotation

## Symptom and evidence

The existing local catalog signing private key has inherited Windows ACL entries that grant `Authenticated Users` modify access and `Users` read/execute access. The key contents were not read, copied, printed, or used by this work. Its ACL, owner, link, and file-type metadata were inspected read-only.

The old public key is the only trust anchor embedded by the current server-connected client channel and is also the signer of the active v7 release. Replacing it in place would make the published 0.1.81 client reject a future release signed only by the new key. Removing it before a transition client is adopted would also make a fresh 0.1.81 client unavailable if the server had already advanced beyond active7.

## Root cause

POSIX-style `0600` creation mode is not a Windows ACL boundary. The signing-key fallback created the file under an inheriting directory, so broad parent access rules remained effective. The protocol uses one signature per release, while clients verify against a bounded embedded `trustedKeys` list; therefore key rotation must be staged at the client trust boundary rather than performed as a direct public-key replacement.

## Local candidate contract

The local rotation candidate:

- generates a new Ed25519 key entirely in process memory;
- writes the private key only to a new runner-owned `output` child whose private directory and file have inheritance disabled;
- permits only the current release identity, `SYSTEM`, and local `Administrators`, each with explicit non-inherited full control;
- requires a regular, non-reparse, single-link private file;
- excludes private material from reports, command arguments, environment variables, Git, and package inputs;
- emits only public transition channels, public fingerprints, closure hashes, and an allowlisted report.

No v8 release is signed. Nothing is published, deployed, packaged, uploaded, or written to production state.

## Trust transition

1. Keep the server on the existing old-key-signed active7 release.
2. Build a 0.1.82 candidate whose embedded channel temporarily trusts both the old and new public keys. It must still verify active7 before distribution.
3. Only after an explicit adoption gate may the server activate a release signed by the new key. A 0.1.81 client will reject that remote release and can use only its previously verified active7 cache; a fresh 0.1.81 profile can become unavailable. This is an explicit compatibility boundary, not a silent fallback.
4. The next client trust set must remove the old public key. The overlap is bounded and must not become permanent.

Backend state may retain the old public key only to verify immutable historical releases. That historical verification role does not authorize new signatures and does not justify retaining the old key in future client trust channels.

## Prevention gates

- Windows private-key tests must assert protected ACL inheritance, an exact SID allowlist, regular/non-reparse file type, and link count one.
- Rotation tests must prove active7 verifies under old-only and dual trust but not new-only trust.
- A synthetic new-key release must verify under dual and new-only trust but not old-only trust.
- Package policy must verify the old-key-signed active7 release with the transition channel before any transition client is built.
- Backend publishing tests must prove a new public key can be appended without rewriting old signed history.
- Reports and public candidate files must reject private-key markers and sensitive path or key material.

## Remaining authorization

CTO approval is still required for any client build, adoption gate, new-key release signing, publication, production state change, deployment, or retirement of the old trust anchor. The unsafe old private key must never sign a new candidate.

## Audit correction: fixture cleanup and exact client behavior

Seven `catalog-key-rotation-test-*` directories from interrupted RED/GREEN runs were individually resolved and verified as direct, non-reparse `output` children with only the fixed test-candidate shape. The frozen candidate was excluded by exact path. All seven were deleted from a hard-coded allowlist and the residue count is zero; no private-key file was opened or read.

The original test cleanup used `fs.rmSync` against a Windows ACL-protected tree. A RED run proved that it could return while the fixture directory still existed. The test fixture now owns candidate creation and exact cleanup in one `try/finally`, validates the canonical direct-child boundary and non-reparse root, and uses the fixed first-party PowerShell executable with `.NET Directory.Delete`. Both normal completion and a deliberate callback failure leave zero fixture residue.

The isolated source behavior fixture now closes the current 0.1.81 trust boundary:

- the old-key active7 envelope is accepted by old-only and dual trust, and rejected by new-only trust;
- a synthetic new-key envelope is accepted by dual and new-only trust, and rejected by old-only trust;
- an already verified active7 cache remains usable after a new-key remote rejection;
- a fresh profile without verified cache resolves to unavailable rather than accepting an untrusted release.

This is exact shared verifier/cache policy behavior, not a packaged 0.1.81 or user-machine acceptance. The backend append test remains isolated under the OS temporary directory; production state stays at history count seven, active version seven, and one trusted public key. Approval of the production release-identity SID remains a separate explicit gate.

## Final evidence runner

The fixed local evidence runner captures child test stdout and stderr only in memory. It removes recognized terminal control sequences, rejects unknown ANSI, redacts private-key markers, credentials, URLs, absolute paths, and raw error details, and validates the resulting streams before exclusive creation of `stdout.redacted.txt` and `stderr.redacted.txt`. Raw streams are never persisted.

The immutable PASS manifest binds the exact Node executable and argv, the eight-test allowlist, a recursively resolved local dependency closure with path/bytes/SHA-256, the execution interval and result counts, both redacted stream and file hashes, the three frozen candidate public artifacts, production state, and active7. A dependency byte change changes the closure digest. A nonzero exit, count mismatch, closure drift, residue, or redaction failure cannot create a PASS manifest.

The exact path of one additional RED cleanup fixture was not retained before deletion and cannot be reconstructed. Evidence records `canonicalPathAvailable=false` with a P2 evidence-gap classification rather than fabricating a path. This does not alter the verified final residue count of zero.

## c800 candidate operational retirement

The local `catalog-c800e177147d63ec` candidate has no evidence of cryptographic compromise and was never used to sign v8, package a client, publish, deploy, or write production state. Its chain of custody nevertheless became invalid when a read-only inventory incorrectly included the protected private file in a hashing operation. The candidate is therefore operationally tainted and permanently retired before use.

Retirement is additive and public-only. Immutable `RETIRED.json` and `KEY-DENYLIST.json` records bind the key ID, public fingerprint, prior public candidate hashes, `RETIRED_BEFORE_USE`, and `PRIVATE_READ_BOUNDARY_VIOLATION`. They contain no private digest or private path. Existing dual-trust and new-only public candidates remain byte-for-byte available as obsolete denied evidence; they are not package, publish, upload, deploy, state-write, or signing inputs.

After the tombstone and denylist were atomically created and independently verified, the exact protected private file was deleted without reading or hashing its contents. The now-empty private directory was then deleted non-recursively. The candidate root and all public evidence remain. The old production key, active7, backend state, server, and all unrelated output were untouched.

All retirement evidence and dependency closure reads now pass through an exact allowlist before file content access. Case-insensitive protected path segments and `.pem`, `.key`, `.p12`, `.pfx`, `.jwk`, and `.env` extensions are rejected before reading; unknown, non-regular, symlink, reparse, and out-of-boundary inputs also fail closed. Package and publish signing validation reject the retired key ID before private material is accessed. A fresh replacement key remains prohibited until CTO audit of this retirement and collector closure passes.

## c800 retirement full-chain gate

The first retirement freeze denied signing, packaging, publishing, upload, deployment, and state writes, but runtime trusted-key parsing still accepted the retired public key and the admin signing loader could inspect private input before learning the public key ID. That gap made the freeze incomplete even though the retired private file was already absent.

The single `catalog-key-retirement` module now owns the exact operation vocabulary, including `trust`, and the only retired key ID. Runtime channel parsing and signature verification reject that ID through the shared trusted-key normalizer. The release store, release bundle producer, package policy, signing loader, and signing envelope path call the same validator rather than carrying copied denylist literals.

For an existing catalog private key or environment-injected catalog key, the loader now requires validated public key metadata. It rejects a retired key ID before observing the environment value, opening or reading a file, parsing key material, deriving a public key, or invoking a private getter. After opening an allowed key, the derived key ID and public key must exactly match the public metadata. Synthetic spies prove the retired path has zero open, read, hash, parse, and getter calls.

The public denylist keeps its key ID, fingerprint, retirement time, source bindings, and obsolete candidate hashes unchanged while adding the `trust` operation. The evidence runner validates both public retirement records with exact schemas before PASS, derives protected-content read count from its read spy, and binds the runtime trust, signing loader, server, release store, release bundle, verifier, and package-policy source bytes. The old active7 envelope remains valid under the old non-retired key. No new key was generated and no private content, signing, packaging, publication, deployment, server start, or state write occurred.
