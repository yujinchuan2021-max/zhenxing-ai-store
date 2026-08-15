# Packaged-client acceptance runner drift

## Symptom

The 0.1.61 through 0.1.63 Windows review packages repeatedly reached a new
Test-owned failure only after a packaged client had started. The failures
included a cross-realm plain-object probe, stale renderer asset selection,
UTF-8 evidence drift, and a cancel-DOM failure that discarded the task and DOM
state needed for attribution.

## Cause

The complete packaged acceptance implementation lived only in versioned
`output` directories. The formal package command tested the build and catalog
gate, but it could not run the same ASAR, evidence, task/DOM, visual, cancel,
retry, and cleanup helpers before invoking Electron Builder. Each candidate
therefore copied and extended an implementation that was not under the normal
test seam.

## Fix and boundary

- `scripts/lib/packaged-client-acceptance.mjs` is the single deep module for
  packaged Windows acceptance. It reuses `packaged-client-cdp.mjs`; no second
  transport or test framework is introduced. Its only exported interface is
  `runServerConnectedReviewAcceptance`.
- The ASAR contract follows `dist/index.html` and validates the consolidated
  `shared/download-task.cjs` public projection and cancellation behavior in the
  module's own VM realm. The obsolete split cancel module is not a second
  required contract.
- The module writes only allowlisted `CONTROL.json`, atomic `STATUS.json`,
  `FINAL.json`, and screenshots. A controlled failure writes its checkpoint
  before throwing a fixed code.
- Package and acceptance invocations use the narrow
  `server-connected-review-receipt.mjs` module to claim an exclusive receipt.
  The formal package command runs the acceptance interface tests before
  Electron Builder; it does not reach through a test-only export.
- Product download, catalog, HTTPS, authorization, and UI semantics remain out
  of scope for this Test/Release cleanup.

## Verification gate

Before packaging, run the formal acceptance and package tests. Unit tests cross
only the acceptance runner, receipt module, and `download-task.cjs` public
interfaces. Exact ASAR renderer selection, allowlisted checkpoints, task/DOM
classification, and cleanup are verified by the formal packaged acceptance
runner itself; private helper exports are not an alternate test interface. A
later packaged acceptance remains isolated automation and is not user-machine
installation acceptance.

## Screenshot evidence directory collision (2026-08-11)

### Symptom

The first 0.1.64 packaged acceptance saved its first visual screenshot, then
failed before its second viewport with `ACCEPTANCE_INTERNAL_FAILURE`. The last
saved visual checkpoint had all eight layout and dialog booleans true, so the
failure did not establish a product modal regression.

### Cause

The acceptance module owned a local screenshot helper that used a non-recursive
`mkdirSync` for the shared `screenshots` directory on every capture. The first
capture created it; the second capture threw `EEXIST`, which the outer runner
mapped to its generic internal-failure code.

### Fix and prevention

`packaged-client-cdp.mjs` now owns the formal screenshot evidence primitive.
It accepts only a fixed safe PNG basename, creates the fixed child directory
idempotently, writes a new file exclusively with mode `0600`, and returns only
the relative path, byte count, and SHA-256. Duplicate names fail closed without
overwriting evidence; traversal input is rejected. The acceptance module now
uses this existing CDP seam rather than retaining a second screenshot writer.

The correction is covered by a fake-CDP regression that captures two distinct
screenshots in one evidence directory, checks their hashes, proves duplicate
write rejection preserves the first file, and rejects traversal. No package,
GUI acceptance, or 0.1.64 evidence report is recreated by this gate.

## Cancellation sampling drift (2026-08-11)

### Symptom

The one-shot 0.1.65 acceptance recorded a failed main task alongside a queued
Task Center row. The old runner combined those observations taken at different
times, then stopped with a generic cancellation precondition drift. That was
evidence of an unstable sample, not a completed product cancellation finding.

### Fix and prevention

The existing packaged-CDP module now takes one bounded sample in this order:
main list, `download:status` command result, renderer row, then main list
again. It permits a DOM cancel click only when the two lists and status result
refer to the same task attempt in the same queued/downloading phase and the
renderer projects that phase with an enabled button. A terminal observation
uses `TARGET_TERMINAL_BEFORE_CANCEL`; a changed attempt or phase is sampled
again only within a short deadline; a stable main/status task missing from the
renderer uses `RENDERER_PROJECTION_NOT_READY`.

Evidence contains only phase classes, envelope class, same-attempt boolean,
received-byte class, mapped failure class, partial presence, and a duration
bucket. It never retains task IDs, error text, artifact URLs, or local paths.
The active scenario starts the independent task first, then opens cancellation
as soon as the target gets its first byte.

## Support-fixture terminal drain (2026-08-11)

### Symptom

The 0.1.67 acceptance had already completed the queued Filmora dialog,
safe-dismiss, and target cancellation path when a support task naturally
reached a terminal state. The runner still treated that support task as a
target cancellation and stopped before the remaining matrix.

### Fix and prevention

Support tasks are now sampled through the same packaged-CDP seam before any
DOM action. A queued or downloading support task follows the existing real DOM
cancel path. A failed, cancelled, or downloaded support task is recorded as a
terminal fixture and is never clicked. Targets remain strict: terminal before
cancel still blocks acceptance.

Before closing the isolated client, the runner rejects any non-support task,
active support task, target artifact residue, or filename outside the exact
support file and `.part` allowlist. Evidence retains only fixed support counts
and terminal classes; client/profile deletion must still leave zero residue.

## Support history versus final physical cleanup (2026-08-11)

### Symptom

A terminal support fixture can legitimately contribute a historical terminal
count and pre-profile allowed residue. The outer final cleanup record previously
mixed those historical fields with post-profile physical counts, so a clean
profile could be incorrectly converted to `CLEANUP_RESIDUE`.

### Fix and prevention

The packaged-CDP module now builds the final cleanup record from only physical
post-profile fields: product process, profile, temporary profile, download,
partial, formal-file, and installer counts. Support history remains only in the
terminal checkpoint and `FINAL.support`. The pre-close closure remains strict:
active support, a non-support task, an unknown file, or target residue blocks
before profile removal. The formal result regression proves that terminal
support history cannot contaminate clean physical cleanup, while every physical
residue counter still blocks.

## Queued-cancel time of check versus time of use (2026-08-11)

### Symptom

The one-shot 0.1.68 review opened a queued Filmora cancellation dialog for
visual screenshots, safely dismissed it, then reopened the same task for the
semantic cancellation. During that extra window the task completed. The
application correctly retained its completed file and rejected cancellation,
but the runner collapsed this into `CANCEL_TERMINAL_TIMEOUT`.

### Fix and prevention

The former proposal still reused the visual task after dismissal, so it was
not sufficient. Each viewport now owns a fresh queued target attempt: the
runner re-arms and verifies exactly three current support attempts, queues a
new target, opens its dialog, captures one screenshot, and confirms the
danger action inside that same open dialog. It never dismisses and reopens a
visual target. A separate support-only safe-dismiss fixture is drained under
the existing support rules and is never credited as a target cancellation.
Terminal supports are re-enqueued with fresh task IDs before every queued
target attempt.

Before a dangerous DOM click, one renderer evaluation samples list, status,
renderer projection, and list again; it only clicks when all reference the
expected queued/downloading attempt and the enabled cancellation button. A
changed attempt records
`TARGET_ATTEMPT_DRIFT`; a terminal task before the action records
`TARGET_TERMINAL_BEFORE_CANCEL`; a completed file during the action records
`TARGET_COMPLETED_DURING_CANCEL`. None is treated as a successful cancel.

The orchestration regression covers a terminal support re-arm, two fresh
visual target IDs, and the strict `open → screenshot → confirm` order. The
stale-attempt regression uses completed attempt A and cancellable attempt B to
prove that A's pending confirmation cannot action B. No artifact URL, network
behavior, product policy, or support-drain exception was broadened.

## Queued proof, viewport ordering, and safe dismissal (2026-08-11)

The first fresh-attempt correction still allowed a queued target to become
downloading between preparation and the dialog action, and layout assertions
ran before the CDP viewport command used for the corresponding screenshot.
It also allowed a terminal support to skip the safe-dismiss fixture.

The shared CDP orchestration seam now requires the same attempt to remain
queued in both task lists, status, and renderer projection, with zero received
bytes, an enabled button, and no partial or formal file, before opening and
again inside the renderer evaluation that delivers the danger action. Any
drift is `TARGET_PRECONDITION_DRIFT`; active cancellation remains a separate
downloading scenario.

Each viewport follows `set viewport -> inspect layout -> capture ->
same-dialog confirm`, so the recorded layout booleans describe the screenshot
dimensions. The separate support fixture must use a fresh current attempt and
complete safe initial focus, Tab to danger, Shift+Tab back to safe, Escape
without task mutation, then reopen and use the safe button without task
mutation. A terminal or replaced support is
`SAFE_DISMISS_FIXTURE_NOT_READY` and cannot satisfy that gate. Regression tests
cover both fixed failure codes, host file residue, viewport call order, fresh
target attempts, support re-arm, and the complete keyboard sequence without
starting Electron or changing download sources.

## Independent target lifetime (2026-08-11)

The active-cancellation independence check still reused the small Filmora
artifact and accepted any same-attempt task whose byte count did not decrease.
It could therefore record independence before discovering that Filmora had
already completed while Power BI was being cancelled.

The formal runner now requires the fixed-profile `finevoice-desktop` entry from
the same signed remote catalog used by the acceptance. FineVoice supplies both
the queued visual target and the longer-lived independent target; Filmora is no
longer a required fixture. The shared packaged-CDP seam reports only whether the
attempt is unchanged, whether its phase remains active, whether progress is
nondecreasing, and whether the formal file is absent. A terminal task or formal
file blocks with `INDEPENDENT_TASK_CHANGED` before any cancellation attempt.
