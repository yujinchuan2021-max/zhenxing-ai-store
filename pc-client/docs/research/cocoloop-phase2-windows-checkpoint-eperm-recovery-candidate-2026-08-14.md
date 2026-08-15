# CocoLoop Phase 2 Windows checkpoint EPERM recovery candidate

Status: **candidate-only, network stopped, recovery not executed**.

## Confirmed defect and seam

At cumulative input 4013, the outcome append and `fsync` completed, then `atomicJson()` failed at `fs.renameSync(temp, checkpoint)` with Windows `EPERM`. The process exited and released its owner lock. The durable files now form a one-commit split:

- live checkpoint: `nextIndex=4012`, SHA `b7e62a2e1504d139b0565795b579071368e9437734764f4879133d2eb26111fe`;
- temporary checkpoint: `nextIndex=4013`, SHA `c055c1f00527ba0f4eb03a76b6edd699f3c877c72e23052b72631e99b75709f9`;
- metadata: 3975 lines, SHA `ad8e490075c0a018a3e7a41317d058392dc778dda833edf881e0ac5c0e4bddf6`;
- failures: 38 lines, SHA `fd9d1579dfe97412aa6a03f75c02147037c419d00e6718a51aab2538929c448d`;
- related process count 0; owner lock absent; stop marker absent.

The live checkpoint's recorded metadata/failure byte prefixes still hash exactly to its recorded SHAs. There is exactly one suffix outcome. Its `externalId=13474` and exact page URL match Phase 1 input index 4012. The temporary checkpoint's artifact states and counter increments match that suffix outcome exactly. The pure reconcile planner therefore returns only `promote-tmp` to `nextIndex=4013`.

## RED and minimal repair candidate

The focused test was first run with the new assertions and failed 2 tests because `replaceAtomicWithRetry` and `planPhase2CheckpointReconcile` did not exist. Current focused state is 24 passed, 0 failed.

The minimal runtime change retries only `EPERM`/`EBUSY` checkpoint replacement five bounded times (50, 100, 150, 200 ms). It never deletes or truncates the destination and leaves both files intact if retries exhaust. All other errors fail immediately.

The recovery planner is pure and does not write. It accepts only this general transaction shape:

1. checkpoint, tmp, parser, Phase 1 index, ordered input manifest, target and schema bindings are exact;
2. the current NDJSON files are regular/non-reparse, newline-complete, and match tmp bytes/lines/SHA;
3. the old checkpoint bytes are exact prefixes of the current outcome files;
4. tmp is exactly one index ahead and exactly one outcome exists after the old prefixes;
5. that outcome ID and page URL equal Phase 1 input at the old `nextIndex`, with no duplicate ID or URL among the prefix;
6. artifact and counter deltas match exactly one successful metadata outcome (`records +1`, `http2xx +1`, `parsed +1`, failure counters unchanged); a failure-class suffix is rejected by this minimal candidate;
7. no owner process/lock or stop marker exists.

Any mismatch is a hard refusal. Recovery must not fetch, parse, append, compact, delete, or automatically resume.

## Recovery decision

Use the durable outcome as fact and promote the already-fsynced tmp checkpoint after the exact rules above pass. Rolling back would delete a valid, uniquely identified, already-fsynced outcome and is therefore the more destructive option. Promotion advances only the transaction commit point; it does not create or reinterpret metadata.

Promotion is **not authorized or executed by this handoff**. A later exact authorization may write only the live checkpoint path by replacing it with the named tmp file, then verify the checkpoint SHA/content and remove no other file. Network resume requires separate authorization after a fresh read-only audit.

## Write allowlist for a future authorized recovery

- `output/research/cocoloop-skill-intake/phase2-first1000/checkpoint.json` — exact atomic promotion target only.
- `output/research/cocoloop-skill-intake/phase2-first1000/checkpoint.json.78024.tmp` — exact promotion source; no independent deletion.

Current candidate work writes only:

- `shared/cocoloop-skill-intake.cjs`;
- `scripts/cocoloop-skill-intake.mjs`;
- `tests/cocoloop-skill-intake.test.cjs`;
- this research handoff.

Metadata, failures, live checkpoint, tmp checkpoint, summary, stop marker, active catalog/state/channel/release/package/App/server are outside the current write scope.
