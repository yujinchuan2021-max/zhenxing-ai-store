# Concurrent managed-download queue

## Symptom

The managed desktop download entry rejected a second product whenever one
transfer was active, so users could only acquire one reviewed artifact at a
time.

## Cause

`startManagedDownload()` treated the global `activeDownloads` map as a
single-transfer lock. The map remains the correct per-product transfer and
receipt owner, but it was also being used as scheduler policy.

## Fix and boundary

- `managed-download-queue` is the sole scheduler for complete artifacts. Its
  fixed client default is three concurrent jobs and it rejects values outside
  one through four. It does not split an HTTP file.
- The queue deduplicates a product while queued or downloading, tracks an
  attempt/task identity, and passes one AbortController to the existing
  reviewed download attempt. A target cancel therefore cannot affect another
  job; disposal cancels active and queued work and leaves no controlled
  temporary part files.
- The existing plan, catalog authorization, HTTPS/source policy, mirror
  rule, space checks, integrity verification, atomic rename, receipts and
  installer-launch confirmation remain below the queue. Download completion
  never launches an installer or CLI apply.
- The new preload facade exposes only enqueue/list/status/cancel/retry with
  product identity plus an optional pure artifact record. It rejects command,
  path, header, credential and secret fields and projects no local path.

## Verification

An isolated local HTTP fixture proves three concurrent complete-resource
transfers, a queued fourth transfer, duplicate reuse, independent progress,
single-task cancellation, retry, integrity failure without a final file or
`.part`, and shutdown disposal cleanup. Existing download network,
reliability, lifecycle, authorization, desktop-download-only, task-center and
fixed CLI lifecycle tests remain focused; no third-party artifact was fetched.

## Remaining device acceptance

The renderer must consume the new `queued` state and structured queue facade.
On the next review package, enqueue four small approved desktop artifacts,
cancel one while the other two continue, retry a failure, and confirm that
installer/CLI apply actions still require their existing separate user
confirmation.

## 2026-08-11 packaged click did not enqueue

### Symptom and packaged evidence

The user reported that the 0.1.60 Windows client download button did nothing.
A deterministic probe extracted the installed 0.1.60 `app.asar` and executed
its actual renderer/preload/main queue contract. The button sent only
`{ productId }`; `download:enqueue` returned
`{ ok:false, errorCode:"DOWNLOAD_QUEUE_REJECTED" }` with no task, while the
renderer kept the product in `ready`, where its newly stored error was not
rendered. The packaged main, preload, and renderer hashes exactly matched the
current D-drive source/build. The earlier packaged harness used the legacy
`startDownload` API and therefore did not cover the button's new queue path.

### Root cause and excluded hypotheses

The queue renderer caller omitted the product's signed catalog artifact even
though `startManagedDownloadFromRequest` deliberately rejects an absent or
invalid artifact before catalog authorization and enqueue. Active7 data was
not missing: canonical Power BI and Blender plus fixed-profile Filmora all
passed the existing fresh artifact authorization. The preload methods,
`download:enqueue` channel, main handler, plan builder, and scheduler were
present; the failure occurred before they could create a task.

### Minimal fix and boundary

The shared renderer download action now passes the current product's pure
`download` object to both enqueue and retry. Preload still permits only the
fixed HTTPS artifact fields, and main still reloads the verified catalog and
requires exact product/module/profile/artifact equality before building a
plan. No URL, path, command, headers, credentials, catalog, or server trust was
widened. A rejected request without a task now enters the existing visible
error state (or keeps an installed product installed while showing its error)
instead of remaining silently ready.

### Verification and prevention

The regression is fixed at the caller seam: both queue operations must carry
`product.download`, and a no-task rejection must select a visible terminal
state. Existing preload tests retain executable-field rejection and public
task projection. Related catalog authorization, download queue, task recovery,
network/source selection, desktop-download-only, presentation, syntax, and
build checks remain the focused gate. Future packaged acceptance must click
`enqueue-managed-download`; directly calling legacy `startDownload` cannot
substitute for the real button path.

### Remaining device acceptance

The installed user client was still running during the repair, so a second
isolated Electron instance was not launched and no third-party artifact was
downloaded. After the user exits it, Test/Release must rebuild a candidate and
use an isolated profile to click one canonical and one fixed-profile download,
observe a queued/downloading task in Task Center, then cancel without opening
the installer.

## 2026-08-11 active canonical cancel did not terminate

### Symptom and evidence

The 0.1.61 isolated review client successfully authorized and enqueued a real
Power BI canonical artifact, but a confirmed cancel remained non-terminal for
90 seconds. A deterministic in-memory body fixture reproduced the same seam in
250 milliseconds: after one non-empty chunk, a stalled `reader.read()` did not
settle when the attempt controller was aborted, and the product partial still
existed. The packaged main/preload/renderer bytes matched the current build, so
this was not an old bundle or legacy-harness observation.

### Root cause and excluded hypotheses

`downloadPackage()` passed the AbortSignal to the initial fetch but did not
explicitly interrupt the active body reader or file writer. Electron can leave
an already-open response read pending when its source stalls, so the attempt
completion, cancel IPC response, durable terminal transition, and queue slot
all waited on the same unresolved promise. The queue and active-attempt maps
held the same controller; public `canceled` to `cancelled` projection was
already correct; the IPC was awaiting the current attempt rather than returning
an old task. A second race also allowed a late successful queue result to
overwrite a requested cancellation.

### Minimal fix and boundary

The existing attempt controller now has one local abort listener that cancels
the current body reader and destroys only that attempt's output stream. The
listener is removed when the attempt settles. The queue also makes an observed
abort or internal canceled result win over a late successful completion while
preserving an explicit cleanup failure. No timeout, retry, HTTPS/source,
catalog authorization, integrity, disk, receipt, installer, or concurrency
policy changed.

### Verification and prevention

The focused red tests proved both failures before the fix: a stalled body read
remained unsettled beyond 250 milliseconds, and an active canceled job became
`downloaded` after a late result. After the fix the read settles promptly,
its controlled partial is removed, an unrelated product partial remains, a
queued cancel is terminal, an already-terminal task rejects cancel, retry gets
a fresh attempt, and an independent active task completes normally. Existing
network, queue, task recovery, reliability, main/preload/renderer, and build
checks remain the release gate.

### Remaining device acceptance

The next isolated Windows review candidate must cancel one real canonical and
one fixed-profile transfer after data begins, observe the task leave active
state promptly, verify no product partial remains, retry once, and confirm
another queued or active download is unaffected. It must not open an installer.

## 2026-08-11 managed-download confirmation moved in-app

### Symptom and evidence

Managed download cancellation was gated by `showLocalizedMessageBox()` inside
`discardManagedDownload()`. That native Windows dialog did not match the AI Hub
theme and the second destructive button could not be observed reliably by the
packaged acceptance harness. The public queue DTO already carried an opaque
`taskId` equal to the durable task's `attemptId`; legacy tasks already exposed
their `attemptId`, so no URL, path, receipt, or new identity field was needed.

### Root cause and minimum fix

Presentation and authorization were coupled in main. The renderer could not
show a themed confirmation, while the old IPC accepted only a product ID and
therefore could not prove that a later click still referred to the same
attempt. The confirmation is now an AI Hub `alertdialog` with “keep” as the
initial safe focus. Both queue and legacy cancel IPCs accept exactly
`{productId, taskId, confirmed:true}`. Main reloads the current trusted plan and
task, requires exact product/attempt equality, rejects completed, canceled,
missing, and stale attempts, then alone performs abort and product-scoped
partial cleanup. The managed-download cancel path no longer opens a native
message box; unrelated installer, uninstall, Store, and completed-record
confirmations are unchanged.

### Verification and prevention

The initial focused run failed at all three intended seams: the shared attempt
authorizer was absent, preload rejected the bound envelope, and no renderer
dialog existed. The green gate covers exact-field rejection, stale/current
attempts, completion race fail-closed behavior, queued and active cancellation,
late abort, independent tasks, safe default/Escape/Tab/focus restoration,
bilingual copy, task-center recovery, download network/reliability, syntax,
and production renderer build. No Electron window, browser, native dialog,
third-party download, installer, catalog, server, or state was used.

### Remaining visible acceptance

When the user is no longer gaming, a new monotonically versioned isolated
candidate must visually verify light/dark themes at 1365 and 740 pixels,
keyboard focus trapping and restoration, screen-reader labels, one active and
one queued cancel, retry with a fresh attempt, and an independent download.
The existing 0.1.62 artifact predates this change and must not be published or
used as post-fix evidence.

## 2026-08-11 public queue phase and cancellation-focus P1 follow-up

### Symptom and root cause

The queue owns a short-lived internal `starting` state, but its public main
projection passed that state through even though the preload and renderer
contract is limited to `queued`, `downloading`, `downloaded`, `failed`, and
`cancelled`. The task center classified `starting` as active but only rendered
a cancel action for `queued` or `downloading`. Separately, the in-app cancel
dialog stored `document.activeElement`; programmatic or assistive activation
could therefore safely dismiss the dialog but restore focus to an unrelated
control rather than the button that opened it.

### Minimum correction and prevention

Only `publicManagedDownloadQueueTask()` now maps internal `starting` to the
existing public `queued` phase. Queue persistence, networking, authorization,
concurrency, retries, and cancellation semantics are unchanged. Each renderer
cancel and relocation button now passes its own `event.currentTarget` through
the pending-confirmation seam. Dismissal restores that exact connected button;
a detached button is a safe no-op. The IPC confirmation remains exactly
`{productId, taskId, confirmed:true}` and main remains the sole cancellation
and cleanup authority.

### Verification and remaining acceptance

The red tests first failed for both missing `starting` normalization and
ambient-focus capture. Green tests execute the public projection for all five
public states, assert the task-center trigger chain, and retain exact IPC
envelope checks. The focused queue/lifecycle/network suite passed 113 tests,
main/preload syntax and the production renderer build passed. No Electron UI,
network download, package, catalog, state, or server operation was run. A
future isolated visible candidate still needs keyboard, mouse, programmatic,
and assistive cancellation confirmation checks after CTO audit.

## 2026-08-11 managed-download contract deepening

### Symptom and root cause

The durable task state machine, main public queue projection, preload phase
allowlist, and cancellation helper carried overlapping phase and exact-attempt
rules. The main projection was the only place that normalized `starting`, while
the sandboxed preload still accepted internal states. The scheduler also
exposed a second test-only task identity, progress surface, retry operation,
and idle promise even though production uses the durable task attempt and
performs retry through a fresh authorized download request.

### Minimum correction and boundary

`shared/download-task.cjs` is now the single production module for durable
task transitions, strict five-phase public projection, presentation
(`state`, `canCancel`, `canRetry`), exact cancellation envelope validation, and
current-attempt authorization. Main resolves only the profile identity then
calls that projection; it no longer owns inline phase mapping and its IPC
handlers delegate validation to the same cancellation path. The sandboxed
preload cannot load local shared modules, so it retains a narrow defensive
copy of the fixed envelope and five public phases before main repeats trusted
task/plan/attempt authorization.

The queue now exposes only `enqueue`, `cancel`, `status`, `list`, and
`dispose`; its concurrency and target-cancel behavior are unchanged. It no
longer creates a second task ID, attempt counter, progress record, retry, or
idle interface. After Test/Release migrated its ASAR closure gate to
`shared/download-task.cjs`, the obsolete cancellation helper was deleted. The
exact cancel envelope and current-attempt authorization now have one production
implementation.

### Verification and prevention

New direct state-machine tests cover all nine internal phases projected to the
five public phases, no path/error-message leakage, presentation flags, and
exact current-attempt cancellation. The former main source-slice phase test
and redundant cancellation confirmation test were removed. Queue tests now
exercise only the production scheduler interface with local HTTP fixtures.
The follow-up gate is that every phase/cancel behavior test crosses the shared
module interface; renderer and preload tests retain their own DOM and sandbox
security seams.

### Remaining acceptance

This is source-level refactoring only. A future isolated Windows candidate
must still verify queued/active cancellation, retry with a fresh attempt,
focus restoration, and independent downloads without launching an installer.

## 2026-08-11 `download:status` command-envelope follow-up

### Symptom and root cause

The main-process `download:status` handler projected a durable task correctly
but returned that task as a bare object. The sandboxed preload accepts only the
fixed command-result envelope, so it rejected a real `failed` status as
`DOWNLOAD_QUEUE_REJECTED`. The renderer deliberately treats raw task events as
invalidation signals and waits for this status call; it therefore retained its
previous queued presentation instead of showing the terminal failure and retry
action.

### Minimum correction and prevention

`download:status` now passes the reconciled task through the existing
`publicManagedDownloadQueueResult()` command-result projection. A present task
returns `{ok:true, task}`; a missing or invalid request returns the existing
safe failure envelope and is never represented as successful `null`. The
durable phase projector, preload schema, queue, network, artifact validation,
authorization, cancellation, and renderer synchronization policy are
unchanged.

### Verification and remaining acceptance

A direct main `registerIpc()` to actual preload-VM round trip persisted a
temporary durable failed task, then proved the public bridge returns the
strict failed-task envelope with `presentation.canRetry:true`; an unknown
product returns only the safe failure envelope. The focused non-GUI
queue/network/recovery/task-center suite passed. Existing renderer coverage
continues to assert that a raw invalidation is followed by status-driven
failed/retry presentation, but this follow-up did not launch Electron or a
browser. A future isolated candidate must still exercise a real transfer that
changes from queued/downloading to failed before opening any installer.

## 2026-08-11 fixed desktop queued-status follow-up

### Symptom and root cause

A fixed `desktop-download-only` task can be durably queued before it has
started, so it intentionally has neither a partial receipt nor a completed
receipt. `download:list` projected that durable task directly, while
`download:status` reconciled by first reconstructing a plan from those receipts.
For a fixed queued task this returned no plan and therefore the safe rejected
envelope, even though the current in-memory scheduler still owned the same
queued job.

### Minimum correction and boundary

`reconcileManagedDownloadTask()` now first reads the durable task and returns
it only when the existing scheduler owns that product in `queued` or
`downloading` and the durable state is live (`queued`, `starting`,
`downloading`, or `canceling`). All other tasks still require the existing
approved-plan reconstruction and evidence checks. No plan, artifact, URL, or
receipt is retained or accepted for an old scheduler-less task; queue phases,
concurrency, network behavior, and public DTO validation are unchanged.

### Verification and remaining acceptance

The red main-handler to preload-VM test filled the real three-slot scheduler,
then queued Filmora with a pure fixed-profile artifact: list contained the
queued task, Filmora had no partial receipt, and status was rejected. Green
returns the exact same task ID and public queued projection. Adjacent tests
prove a scheduler-less fixed failed task remains rejected and an active
profile-less signed-catalog task retains its existing status recovery. The
focused non-GUI suite passed. A future isolated candidate must verify the
actual fourth queued fixed product remains status-addressable before any byte
arrives, then independently cancel/retry it without launching an installer.

## 0.1.68 runner TOCTOU follow-up (2026-08-11)

The 0.1.68 packaged acceptance runner exposed a test-orchestration race, not
a product cancellation defect. During the former visual/semantic overlap, a
small fixed artifact could move from queued or downloading to downloaded while
the runner was taking screenshots. The product correctly failed closed,
retained the completed file, and refused cancellation.

The Test/Release correction keeps visual attempts and semantic attempts fresh
and separate. Each queued visual attempt re-arms exactly three current support
slots, requires queued/zero-byte/same-attempt evidence, sets the viewport before
layout inspection and capture, and performs the danger action in the same open
dialog. Safe-dismiss keyboard coverage remains on a separate support fixture.

The fixed visual and independent target now come from the same signed remote
active7 catalog entry `finevoice-desktop` with its exact fixed download profile;
Filmora is no longer a required fixture. The independent guard requires the
same attempt to remain active, nondecreasing progress, and no formal file. A
terminal task or formal file is recorded through the allowlisted actual and
blocks as `INDEPENDENT_TASK_CHANGED` before any independent cancellation.

Focused Test/Release verification passed 67/67 with syntax and diff checks;
no GUI, network, download, packaging, installation, server, catalog, or state
action was performed. This is runner evidence only and is not user-machine or
production acceptance.

## 0.1.72 visual diagnostics follow-up (2026-08-11)

The single 0.1.72 packaged acceptance stopped at `visual` with the empty
placeholder actual and `ACCEPTANCE_INTERNAL_FAILURE` before any screenshot.
Control-flow evidence proves that signed remote active7 and the exact ASAR
closure had passed, but the runner discarded those completed gates when the
initial support fixture threw before its first specific checkpoint. The
product download and cancellation behavior therefore remained unverified;
the confirmed defect was Test/Release evidence loss.

The formal runner now records a fixed safe substage before every initial
support list, enqueue, rearm, slot verification, and drain sample, and before
safe-dismiss, queued-dialog, viewport, visual inspection, screenshot, and
cancel-confirm actions. Raw errors are normalized to fixed support failure
codes. Unknown failures still block, but retain the last safe substage rather
than reusing an empty visual placeholder. The allowlist contains only fixed
classes, bounded counts, booleans, and duration buckets.

Catalog and provenance summaries are retained immediately after their exact
gates pass, so FINAL preserves them even when a later action throws. CONTROL
and FINAL also record SHA-256 values computed at invocation time from the
current formal runner and CDP helper bytes; no source file embeds its own hash.
Focused non-GUI tests cover raw support list/enqueue/rearm/sample failures,
invalid slot counts, checkpoint order, retained gate evidence, UTF-8 and
unknown/sensitive evidence rejection, and runner/helper hash closure. No GUI,
network, download, packaging, installation, product source, catalog, server,
or state action was performed.

### Follow-up: support readiness waits

Review found two readiness waits after support-slot verification that could
throw before the next checkpoint: the initial task selected for drain and the
fresh task selected for safe-dismiss. Both now use the same formal CDP wait
seam. It records `support-drain-sample` or `safe-dismiss-open` before waiting
and normalizes an evaluation/list/status throw to
`PACKAGED_SUPPORT_SAMPLE_UNAVAILABLE`, which the runner records as
`SUPPORT_SAMPLE_UNAVAILABLE` without raw detail. A normal null/not-ready
result remains the existing `SAFE_DISMISS_FIXTURE_NOT_READY` contract.

Two RED cases cover the initial and fresh readiness waits independently; the
focused non-GUI suite verifies both safe checkpoints and the fixed error
normalization. No timeout, target/support selection, product behavior, GUI,
network, package, or acceptance invocation changed.

## 0.1.73 support-slot concurrency follow-up (2026-08-11)

The single 0.1.73 acceptance passed signed remote active7 and the complete
ASAR contract, then blocked at `support-slot-verify`: three supports were
expected but only one remained active. The product contract was not implicated.
The runner had been navigating the renderer and waiting for each support to
become active before enqueueing the next, allowing a real support download to
finish during serial fixture preparation.

Support-only setup now calls the existing public preload
`enqueueManagedDownload` API with the pure artifact from the current signed
catalog entry. The returned command result must be exact and safe; rejected,
extra, or malformed results become the existing fixed queued-fixture failure
without recording artifact or URL data. FineVoice and Power BI target actions
remain real renderer DOM interactions.

The shared CDP slot helper snapshots current tasks, skips already-active
supports, enqueues every inactive support before the first active wait, then
waits for each fresh attempt and performs one final exact check for three
distinct active attempts. It preserves the scheduler limit of three and all
existing timeouts. RED proved the former serial ordering waited too early;
GREEN proves batch ordering, no duplicate enqueue for an active support,
fresh replacement of terminal attempts, distinct task attempts, and strict
IPC rejection. Focused non-GUI verification passed 49/49 with syntax and diff
checks; no GUI, network, package, acceptance, product, catalog, server, or
state action was performed.

## 0.1.74 support-slot timeout attribution (2026-08-11)

The single 0.1.74 acceptance passed signed remote active7 and the exact ASAR
closure, then blocked at `support-slot-verify` with zero active supports after
about 313.8 seconds. The formal poll returned its last observed task when a
90-second predicate deadline expired. The support helper treated any truthy
fresh task identifier as a successful rearm without rechecking the active
predicate. Three fresh terminal tasks could therefore consume three serial
90-second waits and be misclassified until the final joint list correctly
reported zero active slots. The retained evidence does not identify whether
those support attempts downloaded, failed, or were cancelled, so it does not
establish a product, source, or scheduler defect.

The Test/Release helper now batches the approved support enqueues and uses one
shared 90-second deadline over joint task-list snapshots. It passes only when
the same snapshot contains three current, distinct, active support attempts.
A fresh terminal attempt fails immediately as support rearm failure; a missing
or non-active joint fixture can only reach the fixed slot-invalid timeout. The
target path also brackets its real DOM enqueue with exact pre- and post-action
checks for the same three active support attempts, so a drifted fixture cannot
click the target or claim a queued-slot result.

Safe diagnostics add only active, queued, terminal, fresh, and distinct counts;
they do not retain task identifiers, product identifiers, artifact data, URLs,
paths, or raw errors. RED covered truthy fresh downloaded, failed, and cancelled
timeout values plus the former serial-window behavior. GREEN covers the shared
joint snapshot, immediate terminal rejection, target pre-action drift, and the
existing three-active/one-queued scheduler contract. No GUI, network, download,
packaging, acceptance, product, catalog, server, or state action was performed;
0.1.74 remains blocked and non-retryable.

## 0.1.75 support failure attribution (2026-08-11)

The single 0.1.75 acceptance passed signed remote active7 and the exact ASAR
closure, then stopped before any target or dialog action. Its joint support
snapshot contained three fresh, distinct attempts: one active, one publicly
queued (which may represent internal queued or starting), and one durable
failed attempt. The aggregate evidence did not retain which fixed support
ordinal failed or the public failure category, so Blender, Cursor, and Qoder
cannot be distinguished retrospectively and no product or vendor-source defect
is established by this run.

The public task DTO already exposes an optional fixed error code, and the
formal helper already maps it to safe categories. The support diagnostic now
records `supportFailureOrdinal` (0 through 2) and
`supportFailureClass` only when exactly one support is failed. It reuses the
existing fixed categories and never records a product identifier, task
identifier, error code, artifact, URL, path, or raw error. Multiple failed
supports remain deliberately unattributed. Batch enqueue, the shared joint
snapshot deadline, fresh/distinct checks, terminal fail-fast behavior, signed
artifact authorization, and the remote/ASAR gates are unchanged.

The historical active5 Blender entry produced a small HTML response instead
of the expected installer, but the current signed active7 contract uses the
corrected vendor download form and matches active6. The historical active5
incident and a later external-network timeout do not prove current active7
unreachability and are not sufficient to remove or replace Blender as a
support fixture. Current reachability remains unverified because this work did
not use the network.

RED covered a unique failed support at each fixed ordinal and showed that the
old diagnostic lost both attribution fields. GREEN covers the existing safe
failure mapping plus deliberately ambiguous multiple failures. No GUI,
network, download, packaging, acceptance, product, catalog, server, or state
action was performed; 0.1.75 remains blocked and non-retryable.

### Follow-up: attribution freshness

Review found that the first attribution implementation selected its unique
failed support from every exact task, even though `supportFreshCount` used a
separate freshness predicate. An inactive failed attempt left unchanged by a
rejected or ineffective rearm could therefore be reported as this run's
failure. This does not change the retained 0.1.75 evidence, whose three
attempts were all fresh, but it blocked the diagnostic freeze.

The helper now derives one `freshEntries` collection and uses it for both the
fresh count and unique failed-support attribution. An unchanged inactive
failure remains visible in aggregate terminal counts but receives no ordinal
or failure class. A support that was active when setup began still has no
required replacement identifier, so if that same attempt fails during this
fixture run it remains safely attributable. RED reproduced the stale failed
attempt attribution; GREEN locks stale omission, current active-to-failed
attribution, all three unique fresh ordinals, and ambiguous multi-failure
omission. No timeout, joint snapshot, product, network, GUI, packaging, or
acceptance behavior changed.

## 0.1.76 complete support snapshot observability (2026-08-11)

The single 0.1.76 acceptance retained three fresh, distinct support attempts
but stopped with no active supports, one public queued-or-starting support,
and two failed supports. The prior unique-only failure fields deliberately
omitted attribution when more than one support failed, leaving the fixed
three-position fixture incompletely observable.

The Test/Release diagnostic now replaces those unique-only fields with three
aligned vectors in the fixed support order. `supportPhaseClasses` always has
exactly three values from the public safe phase vocabulary, with queued and
starting deliberately combined as `queued-or-starting` and absent tasks
reported as `missing`. `supportFreshMask` contains exactly three booleans.
`supportFailureClasses` contains a fixed safe failure category only where the
same position is both fresh and currently failed; every other position is
`none`. An unchanged historical failed attempt therefore remains visible as a
current failed phase but cannot be attributed to this run.

The formal checkpoint validates exact vector length, enums, booleans, field
set, and the phase/freshness/failure relationship before writing evidence.
Identifiers, public error codes, artifacts, URLs, paths, and raw errors remain
excluded. RED covered the 0.1.76 two-failure shape, all single failure
positions, missing support, stale old failure, malformed vectors, and unknown
fields. GREEN retains the joint snapshot, terminal fail-fast behavior,
aggregate counts, signed artifact authorization, and existing timeouts. No
GUI, network, download, packaging, acceptance, product, catalog, server, or
state action was performed; 0.1.76 remains blocked and non-retryable.

## 0.1.77 internal failure refinement (2026-08-11)

The single 0.1.77 acceptance retained two fresh failed supports and one
queued-or-starting support. Both failures were reported only as `internal`,
so the frozen evidence cannot distinguish a managed attempt start failure,
queue rejection, task-internal completion failure, or an uncoded generic
download failure. Product attribution remains unverified and 0.1.77 remains
blocked and non-retryable.

The Test/Release classifier now replaces the coarse `internal` category in
the existing `supportFailureClasses` vector. Exact public codes map to the
fixed classes `start`, `queue`, `task-internal`, and
`generic-download-failed`. Similar but unknown codes that merely contain
`INTERNAL`, `START_FAILED`, or `QUEUE_` map to `other`; the raw code is never
written. No additional evidence field was added, and the former `internal`
enum is rejected by the snapshot validator.

RED covered the old generic result and acceptance of the obsolete enum.
GREEN uses a table-driven exact mapping, retains all existing safe failure
classes, and preserves aligned phase/failure/freshness vectors, stale failure
suppression, and pre-enqueue rejection semantics. No GUI, network, download,
packaging, acceptance, product, catalog, server, or state action was
performed.

## 0.1.77 shared managed-download session interference (2026-08-11)

The frozen 0.1.77 support snapshot recorded two fresh failed attempts followed
by one queued-or-starting attempt. Read-only diagnosis found a deterministic
shared-session defect: every first request and every retry refreshed the
singleton `aihub-managed-downloads` Electron Session by calling `setProxy`,
`forceReloadProxyConfig`, and `closeAllConnections`. With queue concurrency
three, a later attempt could therefore terminate already in-flight sibling
requests. Uncoded fetch failures were also collapsed into an internal task
failure, obscuring the transport origin.

The managed transport now shares one initial refresh across concurrent first
requests. That initial refresh remains destructive, happens before any
Session fetch, and is cleared after failure so the next request can retry it.
Retry refreshes are single-flight but only apply `setProxy` and
`forceReloadProxyConfig`; they never call `closeAllConnections`. This is
Session-wide rather than inferred from the durable desktop task map, because
WSL scripts, portable CLI binaries, fixed MSI downloads, environment probes,
and updater downloads also keep response bodies in flight after the transport
has returned their headers. The change does not serialize downloads, reduce
the queue limit, or alter URL, HTTPS, signed artifact, disk, integrity,
receipt, cancellation, or final-host policy.

Transport errors now remain within fixed safe classes. An uncoded final fetch
rejection becomes `DOWNLOAD_FETCH_FAILED`; a non-success HTTP response becomes
`DOWNLOAD_HTTP_FAILED`; a response without a body becomes
`DOWNLOAD_HTTP_BODY_MISSING`; and only uncoded failures outside the transport
boundary fall back to `DOWNLOAD_TASK_INTERNAL_ERROR`. No raw status, response
body, URL, path, or exception text is added to the public task contract.

RED reproduced both forms of interference through the real transport
interface: three overlapping first fetches caused the first two to reject,
and a retry refresh aborted both a held fetch and a response body already
returned to a non-durable caller. GREEN proves one shared destructive initial
refresh, recovery after an initial refresh failure, one shared non-destructive
retry refresh, safe error classification, a real streaming main callsite with
no durable-task sibling hint, and three approved fixed desktop plans entering
the real main scheduler on the same fake Session without cross-task failure.
All fixtures are local and deterministic. No GUI, real network, third-party
download, packaging, catalog/state/server change, installation, or release
acceptance was performed. A later candidate still requires isolated Windows
evidence that three real approved downloads can overlap and that one retry
does not stop either a durable or streaming sibling; 0.1.77 remains blocked
and non-retryable.

## 0.1.78 live queued-support fixture was nondeterministic (2026-08-11)

The only 0.1.78 packaged acceptance stopped before its target scenario with
three fresh and distinct support attempts projected as one queued-or-starting
and two downloaded. The two terminal attempts were successful downloads.
Requiring three real third-party downloads to remain active at one instant so
a fourth real download would queue made the release gate depend on artifact
size, bandwidth, and completion timing. It did not prove a product scheduler,
modal, or cancellation defect; 0.1.78 remains blocked and non-retryable.

The formal packaged runner now replaces that live support constructor with an
active-task chain. A signed remote artifact is enqueued only through its real
DOM action, must become the exact current downloading attempt with positive
received bytes, and is re-sampled through list, status, and renderer state
before the same open application dialog confirms cancellation. Visual,
keyboard, safe-dismiss, retry, independent-task, target-file, and physical
cleanup gates remain in place. A task that reaches terminal state before the
action is classified as `ACTIVE_FIXTURE_EXHAUSTED`, a Test fixture exhaustion,
and is never reported as a product cancellation failure. An independent task
may finish naturally only when the same attempt has nondecreasing progress and
its expected formal file exists.

Queued semantics are now owned by deterministic local fixtures instead of the
packaged network run. Held start promises prove three active slots and a fourth
zero-byte queued task; the main/preload status boundary, renderer modal safe
focus and Escape behavior, exact dangerous-confirmation envelope, independent
task isolation, and fresh retry attempt are checked without third-party timing.
The retired live-support constructor and its error codes have no source or test
callers. RED recorded five exact contract failures before the replacement;
GREEN covers the formal active flow and the deterministic queue, IPC, and
renderer fixtures. No GUI, network, download, packaging, acceptance, product,
catalog, server, state, or output action was performed.

### Destructive recheck correction

The first active-runner freeze still had one contradictory terminal branch.
When a dialog was already open, the destructive recheck bypassed the dialog
open helper and hard-coded `TARGET_TERMINAL_BEFORE_CANCEL` if the exact task
became terminal after the screenshot. This ignored the caller's
`terminalFailureCode`, so the active visual path could still misattribute a
fixture timing exhaustion as a product cancellation failure.

RED locked the formal `dialogAlreadyOpen` branch and the `cancel` checkpoint:
the old line used the hard-coded product-facing code. GREEN uses the caller's
fixed terminal code with the same allowlisted action snapshot. The default
remains `TARGET_TERMINAL_BEFORE_CANCEL`; active visual, retry, independent, and
safe-cleanup callers explicitly use `ACTIVE_FIXTURE_EXHAUSTED`. No terminal is
treated as a successful cancellation, and exact attempt, list/status/renderer,
partial-file, and completed-file protections are unchanged.

The retired live-support evidence state also had no consumer outside the
runner itself. Its zero-valued state, terminal fields, error attachment, and
FINAL field were removed instead of retained as a compatibility layer. Final
evidence now reports active-target scenarios and physical cleanup only. The
repair was verified without GUI, network, download, packaging, acceptance,
product, catalog, server, state, or output activity.

The final Test-only cleanup removed the unused legacy download-terminal code
after confirming it had no real caller. All three cancellation helpers now default to
`TARGET_TERMINAL_BEFORE_CANCEL`, while active fixture callers continue to pass
`ACTIVE_FIXTURE_EXHAUSTED` explicitly. The formal in-memory destructive probe
now creates the exact completed file before the task becomes terminal and
proves the danger action was not delivered, the checkpoint reports one formal
file, and the file remains byte-exact until fixture-only cleanup.

## 0.1.79 first downloading notification convergence (2026-08-12)

The only 0.1.79 packaged acceptance observed one exact main task as
`downloading` through list/status/list with positive bytes and a partial file,
while the task-center row remained `queued` for the full readiness window.
The package matched the frozen main, preload, renderer, task projector, and
task contract. Cancellation was not invoked and 0.1.79 remains blocked and
non-retryable.

The main process updated the durable task on every progress event but applied
the 100ms progress broadcast throttle immediately after the `begin` event.
The first `starting` to `downloading` transition could therefore be suppressed
when it occurred inside that window; if no later chunk arrived, there was no
trailing notification to invalidate the queued renderer projection.

The minimum correction reuses the existing public task projector before the
progress transition. A progress update whose current public phase is not yet
`downloading` bypasses the progress-only throttle exactly once. Later progress
within the same public phase remains limited to the existing 100ms boundary;
failure and cancellation transitions continue through the unchanged durable
task broadcaster. No timer, polling loop, new state map, public DTO, download,
network, queue, authorization, or cleanup behavior was added.

A fake-clock RED first broadcast `queued` and `starting`, then proved that the
only progress event inside 100ms produced no `downloading` invalidation. GREEN
requires that transition notification, preserves the 99ms suppression and
100ms broadcast boundary, and retains failure plus canceling/canceled
notifications. Verification is local only; a later candidate still needs
isolated Windows evidence that the real task center advances from queued to
downloading without focus/list refresh before cancellation is attempted.

### Frontend same-attempt convergence correction

The renderer had an independent liveness gap. Its per-product sync version
treated both an attempt replacement and a newer revision of the same attempt
as the same reason to reject an in-flight status response. A continuous stream
of valid same-attempt invalidations could therefore discard every valid public
`downloading` status and leave both the product card and task center at
`queued` indefinitely.

The minimum frontend correction separates attempt identity from dirtiness:
`generation` plus `taskId` guard the accepted attempt, while `dirtyRevision`
only requests another status read. A validated public status for the current
task ID is committed even when another revision arrived during its await; the
reader then continues until clean. A different or older attempt still fails
closed, and startup/focus list snapshots retain their request-start
generation-and-dirty guard. Raw event phase, path, and error fields only
invalidate the public status read and never drive UI presentation. No polling,
phase ordering, cancellation rule, DTO, or queue behavior was added.

The renderer RED used a real enqueue result for queued task A, delayed status
responses that always returned A as public `downloading` with positive bytes,
and monotonically newer raw A invalidations during every await. The old
renderer remained queued. GREEN requires the product card and task-center row
to converge to the same single cancellable `downloading` row while those
invalidations continue, then to stop status reads after the stream is clean.
It also keeps stale-status and stale-snapshot attempt guards, and asserts in
both views that injected raw `RAW_QUEUE_SECRET` and
`raw-queue-secret.exe` tokens never appear in the DOM.

This is local, no-output fixture evidence only. A future isolated packaged
Windows candidate must still exercise a canonical and a fixed task through
queued-to-downloading convergence without focus/list refresh, then cancel
without opening an installer; it does not reuse 0.1.79 as acceptance evidence.

## 0.1.80 Test evidence convergence follow-up (2026-08-12)

The Test/Release production-order fixture previously reduced list activity to
`zero|one|many`; once the baseline was already `many`, one extra focus/list
refresh was invisible. It also reported a hard-coded status-apply claim rather
than an observed value. The fixture now compares exact in-process list and
old-attempt status call counts, emits only fixed booleans/count classes, and
the renderer-only deferred fixture compares its exact unfiltered list counts.
The production-order fixture remains the authoritative current-main IPC to
current-preload to current-dist/App chain; the deferred fixture is only causal
renderer evidence and is not described as end-to-end.

The no-output renderer fixture previously printed its complete call capture,
including approved artifact fields such as URL and file name. `NO_OUTPUT=1`
is now silent, and the non-silent diagnostic is restricted to aggregate
booleans/counts. Before its runner-owned temporary root is removed, the
lifecycle wrapper verifies the exact child process has exited and both target
formal and `.part` counts are zero. A forced formal-residue RED proves the
check occurs before cleanup.

The formal packaged-acceptance helper now has a read-only delivery probe that
only appends its own `onDownloadTask` listener. It neither replaces nor wraps
the frozen context bridge, retains at most eight attempt identities per target
in renderer memory, and disposes only its own listener. Persistent evidence is
limited to fixed delivery/count/error classes and an armed-before-enqueue
boolean; task/product identity, phase sequence, URL, file name, path, raw
error, message, stack, and secret data never leave the renderer. Every
task/DOM readiness sample carries this projection, and observer unavailability
fails closed.

During the same Test-only slice, the production-order fixture exposed a
lifecycle RED: current `main.cjs` now registers IPC inside `app.whenReady()`,
while the old fixture used a never-resolving ready stub and therefore had not
executed the current handlers. The in-memory loader was corrected to invoke
the current `registerIpc()` while suppressing the product-owned second window,
but the hidden fixture did not reach process termination inside 120 seconds.
Runner-owned processes and temporary profiles were removed exactly; no
network, package, packaged acceptance, server, catalog, state, or product file
was used or changed. This fixture remains BLOCKED pending a bounded safe-stage
lifecycle checkpoint that identifies the first incomplete current-main step;
the raw-event probe and pure Node evidence are not promoted to an end-to-end
PASS.

### 0.1.80 raw-event identity and bounded fixture lifecycle freeze

The first delivery-probe draft read `taskId` from a raw `download:task`
notification even though the durable task and current renderer consume
`attemptId`. That shape would have classified every real same-attempt event as
not observed. The Test-only probe now accepts `attemptId` exclusively; a
`taskId`-only raw event is ignored. When main list/status/list report the same
downloading attempt, failure to observe its raw attempt is a fixed Test block,
while a preceding renderer listener error is reported separately. The probe
keeps normal EventEmitter interruption semantics: if the App listener throws,
the later probe is not credited with receiving that event.

Formal acceptance now proves disposal of its own additive listener. Disposal
failure is a fixed Test block with only `disposed:false`; it is no longer
swallowed. The FINAL allowlist carries the resulting disposal boolean, and no
raw event identity, error text, URL, path, artifact, or secret is persisted.

The production-order fixture lifecycle is now bounded by a narrow Test-owned
standard-library module. It provides only an exact atomic checkpoint schema,
per-operation hard timeout, bounded stderr capture, and exact child/profile
cleanup. The runner has a 60-second wall clock, bounds renderer load and every
renderer evaluation, writes only `{schemaVersion,sequence,stage,boundary}` in
its runner-owned profile, and verifies both target `.part` and formal-file
counts before cleanup. Its outer 120-second deadline is last insurance: it
terminates only the spawned child tree, reads the safe checkpoint, removes
only the canonical runner-owned profile, and verifies absence. Standard output
is ignored and standard error is bounded to a fixed failure code.

This source transform is described only as current handler semantics under a
Test facade, not the exact production lifecycle. Pure Node tests cover exact
schema rejection, a never-settling Promise, bounded capture, owned-profile
cleanup, raw-event identity, EventEmitter interruption, and formal disposal.
The hidden Electron fixture remains independently BLOCKED and was not run in
this slice; GUI, network, packaging, packaged acceptance, output evidence, and
product files were not touched.

### 0.1.80 hidden lifecycle evidence hardening follow-up

The first bounded outer runner still had three evidence defects. Exit and
spawn-error paths could delete the profile without first projecting the last
checkpoint; timeout retained only checkpoint presence; and bounded stderr
bytes were still used as assertion text. Its task-tree terminator also treated
every `taskkill` result as success. Separately, a delivery-probe disposal
failure could replace an already recorded acceptance failure.

The Test-only lifecycle module now owns one exact child lifecycle. Exit,
spawn-error, and timeout all read the strict checkpoint before cleanup and
return only fixed stage, boundary, validity, child/profile absence, exit, and
stderr classes. Stderr is compared incrementally with the one fixed runner
code and is never retained. Timeout resolves `%SystemRoot%\System32\taskkill.exe`
as an exact regular file, invokes it with an argv array and `shell:false`, and
accepts tree termination only when `/T` succeeds and the root is absent.
Error, nonzero status, signal, timeout, and a still-live root remain distinct
fixed classes. A live child or cleanup/reparse failure preserves the exact
owned profile and reports cleanup blocked.

Checkpoint creation now requires a direct, non-reparse OS-temp child and
enforces the complete entered/completed stage order. The two former `gates`
stages are `order-gates` and `evidence-gates`; the Electron registration stage
is `ipc-bridge-register`; and `exit-request-ready` records readiness to request
exit without claiming that the process has exited. The outer child close is
the independent exit fact. Recursive cleanup rejects any internal symlink or
junction before deletion.

When acceptance already has a primary blocked stage/code, probe disposal
failure now preserves that primary evidence and records only
`observerDisposed:false` plus the fixed observer cleanup code. With no primary
failure, the same disposal failure remains the blocking Test code. Pure Node
behavior tests cover exit 1, exit 2, spawn error, a never-settling child,
sensitive unexpected stderr, taskkill success/error/status/signal/timeout/live
root, transition misuse, reparse preservation, and primary-failure retention.
The hidden Electron fixture was not run; product, GUI, network, package,
acceptance, server, catalog, state, and output files remained untouched.

### 0.1.80 child-tree proof and total-settlement follow-up

The first lifecycle collector set its one-shot settlement guard before reading
the checkpoint and removing the owned profile. If the profile had already been
deleted, renamed, or made invalid, cleanup could throw after the guard was set
and leave the Promise permanently pending. It also allowed profile deletion on
root-process absence alone, even when `/T` had failed or a descendant remained.
Finally, every `process.kill(pid, 0)` error was treated as absence, so an access
denial could be misreported as a safe cleanup condition.

The Test-only collector now converts checkpoint and cleanup exceptions to the
same fixed unavailable/`CLEANUP_BLOCKED` projection and always resolves. Profile
deletion requires `treeAbsent:true`; root absence alone is insufficient. Exact
`taskkill /T` success plus root `ESRCH` proves timeout cleanup. Normal close uses
an exact first-party process-tree snapshot and preserves the profile if an
owned descendant remains or the snapshot is unavailable. Only `ESRCH` means
absent; permission and unknown errors remain `process-state-unknown` and block
cleanup. Child error uses the same exact ChildProcess handle and tree terminator
before settlement, while invalid taskkill directory, symlink, or canonical-path
resolution is rejected before invocation.

Pure Node behavior tests cover deleted and renamed profiles, nonsettling child
termination, taskkill failure with an absent root, a normal root exit with a
live descendant, live-child error termination, permission uncertainty, and
taskkill directory/symlink/realpath drift. The outer hidden fixture now requires
both child and tree absence before accepting cleanup. Hidden Electron, GUI,
network, packaging, packaged acceptance, server, catalog, state, and product
files were not run or changed.

### 0.1.80 controlled child-tree teardown correction

The post-exit process snapshot used by the preceding follow-up was not a valid
tree-absence proof. A root could start an intermediate, the intermediate could
start a held grandchild and exit, and then the root could exit. The surviving
grandchild retained the exited intermediate as its parent, so a single snapshot
starting from the root PID could miss it and incorrectly remove the profile.

The Test runner now finishes its assertions, verifies formal and partial
residue, destroys its window, writes the final `exit-request-ready/completed`
checkpoint, and keeps the root alive. The outer collector observes that exact
checkpoint while the original ChildProcess handle is live and performs the
already validated `System32\\taskkill.exe /T /F` teardown. Only taskkill success
plus root absence becomes `controlled-success` and permits profile removal. A
fixed runner failure is handled through the same live-root teardown and keeps
the complete safe stage/boundary projection as `controlled-failure`.

Post-exit PID/PPID inference is no longer a success path. Any natural close is
`unexpected-close`, has `treeAbsent:false`, and preserves the exact profile with
`CLEANUP_BLOCKED`, including the root-to-exited-intermediate-to-live-grandchild
case. The hidden outer assertion now compares one complete fixed allowlisted
result so an unexpected terminal exposes stage and boundary without PID, path,
stderr body, or other raw data. Pure Node tests cover controlled success,
controlled failure, unexpected close, and the real orphan-grandchild shape.
Hidden Electron, GUI, network, packaging, acceptance, and product execution
remain unrun.

### 0.1.80 production-order cancel cross-realm fixture correction

The retained hidden diagnostic reached `cancel/entered`, while the current main
handler had already completed the abort, reader/output settlement, durable task
removal, partial-receipt cleanup, and formal/download-receipt cleanup. The
Test-only production-order preload wrapped enqueue, list, and status in its host
realm, but directly re-exported `actual.cancelManagedDownload` from the nested
VM that loads the current production preload. That asymmetry allowed the main
side effect to finish without giving the outer renderer fixture a reliably
observable host-realm return.

A pure Node RED loads the real production-order bridge and current nested
preload. The old bridge returned a nested-realm Promise even though its safe
payload was `{ok:true}`. The bridge now uses one explicit host-realm async
wrapper and returns the current preload's result unchanged. Reject and malformed
IPC results remain the current preload's fixed fail-closed queue rejection; no
product validation or envelope was copied into the fixture.

The former broad `cancel` checkpoint is replaced by `cancel-status`,
`cancel-request`, `cancel-settle`, and `cancel-list-cleared`. The outer IPC
bridge records only whether the current main cancel handler settled and its
safe result class. The renderer path separately proves the status envelope,
main settlement, renderer return, and exact task/partial/formal clearance.
Allowlisted evidence contains only envelope classes, absence/count classes,
and the response boolean. Pure Node behavior tests cover status rejection,
main settlement with no renderer return, safe `ok:false`, malformed response,
and uncleared task/residue. Hidden Electron was not rerun, and the retained
profile was not modified or removed. Product, GUI, network, packaging,
packaged acceptance, catalog, state, server, and output files remain untouched.

### 0.1.81 packaged extraction ownership and cleanup correction

The successful package-time catalog gate left two process-owned Portable
extraction roots in the shared Windows temporary directory. Both contained the
exact 0.1.81 `app.asar` but totalled 836,086,970 bytes. The formal cleanup only
counted its named isolated profile, so it could report `tempCount:0` while these
package roots remained.

The Test-owned CDP launcher now receives the expected packaged ASAR closure,
captures only its spawned process tree, and binds extraction roots only from
those processes' executable locations. A bound root must be a canonical direct
temporary child, non-reparse, contain a regular fixed-location `app.asar`, and
match the caller's SHA-256. Close first proves the tracked tree and every
process under a bound root are absent, revalidates every root, then removes only
those exact roots. Unknown, unowned, reparse, changed-SHA, or live-tree roots
are preserved and fail closed.

Formal physical cleanup now includes `treeAbsent`, `extractionRootCount`, and
`extractionCleanupSucceeded`; any false or nonzero value blocks acceptance.
The package gate records the built ASAR closure and passes it to the same
launcher. Pure Node RED/GREEN covers the former false-pass, exact cleanup,
unowned preservation, wrong-SHA and reparse rejection, live-tree refusal, and
strict formal result wiring. The two authorized 0.1.81 roots were independently
verified and removed; the two retained production-order profiles were not read,
changed, or deleted. No Electron, GUI, network, package, or formal acceptance
was run in this correction. The separate Electron lifecycle probe remains an
unavailable P1 Test-infrastructure gate and is not represented as passing.

### 0.1.81 reviewed environment package cleanup identity correction

**Symptom.** Deleting an already verified Python 3.12 installer reported
`Managed download cleanup product is invalid`, although the package was in the
AI Hub download record and had passed the environment receipt checks.

**Root cause.** The completed-package deletion path correctly re-read and
verified the exact environment record before deleting it, but then called the
superseded-package cleanup helper. That helper accepted only ordinary catalog
product IDs and rejected the reviewed environment identity
`environment:python312` because of its colon. This was an identity-contract
mismatch, not a path, catalog, or ownership bypass.

**Fix.** The shared cleanup boundary now accepts either the existing ordinary
product-ID grammar or an exact reviewed environment ID from
`environment-download.cjs`. Unknown and extended `environment:` namespaces
remain rejected. The deletion IPC still receives only a product ID and never a
caller path. Main re-reads the current completed task and requires its product,
formal file, hash, and size to match the verified receipt before deletion; it
then rechecks the file type, exact current record, checksum, environment
signature, and user confirmation before it can unlink a file.

**Verification.** RED reproduced the exact rejection for
`environment:python312`. GREEN proves that reviewed environment cleanup remains
product-scoped, rejects unreviewed/extended namespaces, and drives the real
preload `deleteDownloadedPackage` to the main handler for an owned temporary
Python 3.12 receipt. The same test confirms the public queue status is
`downloaded`, the legacy completed task/record retain the local package
evidence, deletion removes only that owned file and record, and an unowned
manual file remains untouched. Fixed desktop controls prove a mismatched
completed task cannot authorize a receipt deletion, while an exact completed
task deletes only its own package; independent completed and partial packages,
missing products, and invalid environment identities remain untouched.

**Frontend handoff / remaining acceptance.** No public DTO change is needed:
the public queue task exposes `downloaded` plus completed presentation, and
installed-product management already projects reviewed `environment:*`
completed records as `canInstall`. The separate missing-install-button report
therefore remains a renderer/projection investigation. A future isolated
Windows candidate must manually verify Python 3.12 package deletion on a
non-default download root; this local test did not start an installer or read
user inventory.

### 0.1.82 package-time process snapshot correction

The only 0.1.82 package invocation built its temporary Portable and Setup but
stopped before the packaged catalog gate with
`PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_INVALID`. The candidate remains blocked
and non-retryable; no formal acceptance was run.

The Windows CIM response was valid JSON and every creation date and parent PID
was parseable. Its one legitimate System Idle entry used process ID zero, while
the Test-owned snapshot normalizer incorrectly required every snapshot PID to
be positive. Because the first snapshot is captured immediately after launch,
this deterministic parser rejection occurred before CDP readiness or any
startup timing race.

The snapshot decoder now accepts non-negative Windows process IDs while the
launcher ownership boundary still requires its root PID to be positive. Spawn
failure remains `PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_UNAVAILABLE`; malformed
JSON or records remain `PACKAGED_EXTRACTION_PROCESS_SNAPSHOT_INVALID`. A pure
Node regression fixture covers a normal PID-zero snapshot, empty output,
malformed output, access denial, immediate binding of an exact process-owned
temporary extraction root, exact ASAR hash validation, owned cleanup, and
preservation of an unowned same-hash root. No sleep, Temp enumeration, age
heuristic, GUI, network, package, acceptance, key, catalog, or product change
was introduced.

### 0.1.88 packaged active-fixture exhaustion and acceptance split

The single 0.1.88 formal acceptance reached the packaged managed-download
gate, but the live target had already entered `failed` before the visual and
cancel scenarios began. Main list/status/list agreed on the same failed
attempt, with positive received bytes and an owned `.part` file, while the DOM
still showed `queued`. The runner correctly stopped with
`ACTIVE_FIXTURE_EXHAUSTED`; this did not prove a frontend, download, cancel, or
retry defect. The invocation is consumed and must not be rerun or reused.

The next-version Test/Release gate separates the two kinds of evidence. One
packaged live attempt proves the remote signed catalog, exact packaged runtime
closure, same-attempt raw delivery, positive progress, and joint
list/status/list/product-card/Task-Center convergence to `downloading`.
Deterministic renderer fixtures then prove visual, modal, keyboard, dangerous
cancel, retry, and independent-task behavior without repeatedly depending on
third-party download timing. The deterministic fixture contract is hashed into
CONTROL and FINAL, runs only after packaged renderer provenance passes, emits
no raw output, and fails closed on owned temporary residue.

The packaged live scenario is not marked complete unless all four public
phases are exactly `downloading`; positive bytes alone are insufficient. After
that proof, a task that naturally becomes terminal or absent is treated only
as cleanup, while physical process/profile/temp/download/partial/formal and
Portable extraction residue remain strict release blockers. This correction
changes Test/Release code only; product App, main, preload, shared queue,
network, catalog, and CDP behavior remain unchanged. It is eligible only for a
new candidate and new single formal invocation.

### 0.1.89 deterministic renderer no-output false negative

The only 0.1.89 formal invocation passed remote catalog v7 and packaged ASAR
provenance, then stopped at the deterministic renderer gate before any live
download attempt. The formal evidence retained only the fixed
`DETERMINISTIC_RENDERER_FIXTURE_FAILED` code and completed physical cleanup;
it did not prove a product or renderer assertion failure. The invocation is
consumed and remains permanently blocked.

A separate hidden, no-network diagnostic of the identical frozen fixture
completed successfully with exit status zero, no stderr, and no temporary
residue. Its captured stdout contained only one CRLF pair. The layout launcher
had inherited the Electron child's stdout even in `NO_OUTPUT` mode, while the
outer gate correctly rejected every output byte. That mismatch made a healthy
fixture fail the release gate.

The Test-only correction leaves the outer output rule strict: CRLF and all
other stdout remain failures. Instead, only `NO_OUTPUT` launches now discard
the Electron child's stdout at its source while continuing to inherit stderr;
ordinary preview runs retain inherited stdio. Gate failures also carry one
fixed allowlisted class (`pre-residue`, `spawn-error`, `timeout`, `nonzero`,
`signal`, `stdout`, `stderr`, or `post-residue`) into safe STATUS evidence,
without raw output, paths, process identities, or errors. Post-run residue is
still checked on every branch. Product and CDP files remain unchanged, and the
correction is eligible only for a new package and new single formal invocation.

### 0.1.90 installed-management queue projection and immediate feedback

**Symptom and root cause.** A completed managed package could disappear from
Installed management even though the durable queue record, verified legacy
download task, and local package evidence still existed. The renderer removed
the legacy task after accepting the queue projection, while its installed
management call supplied only the legacy map. The same surface also left
high-frequency product and package actions looking idle until their promises
settled, so repeated clicks were possible before React received a result.

**Minimal frontend correction.** Installed management now receives the public
queue snapshot and a separately revalidated task map. On refresh the renderer
asks `getDownloadTask` for the exact union of legacy task IDs and queue products
whose public phase is `downloaded`; the shared installed-product projection
remains solely responsible for requiring the same product, `completed`, and a
non-empty trusted file path. No directory scan, executable inference, receipt
rule, or install authorization was copied into App. Product open/close/files/
uninstall and package folder/delete actions use per-row promise-scoped busy
labels and guards, while unrelated rows remain usable. Submission and Workflow
refresh use their existing surface busy state. Environment updates consume the
fixed `canUpdate`/`recommendedVersion` contract and the two explicit
`updateEnvironment` then `openEnvironmentUpdater` actions; opening an updater
does not claim that the environment was updated and retains the required
recheck message.

**RED/GREEN and remaining acceptance.** The installed-management Electron
fixture first failed because an exact queue `downloaded` plus verified
`completed` package was absent. A deferred action fixture separately failed
because the clicked row did not enter an immediate busy presentation. After
the correction, the exact package appears, queue-only/unverified/wrong-product
evidence remains absent, clicked controls disable and relabel immediately,
resolve/reject restores them, and other rows remain usable. Submission,
Workflow, environment update/open-updater, 1365/740 layout, focused lifecycle,
language, and production build gates pass locally. This is isolated automation,
not real-user acceptance: a future Windows candidate must still verify a real
downloaded package in Installed management, folder/delete rejection recovery,
and an older trusted environment through download, explicit updater launch,
cancel or completion, and version recheck.

### 0.1.92 deterministic renderer stale Resource Store hierarchy

The only 0.1.92 formal invocation passed remote catalog v7, package ASAR
provenance, secret scanning, and physical cleanup, then stopped before the live
download scenario because the deterministic renderer fixture still expected a
retired `store -> host -> resource` hierarchy. The current Resource Store
correctly renders `store -> resources -> detail`; its detail page owns the
compatible-host facts. The consumed 0.1.92 invocation remains permanently
blocked and is not retried.

The Test-only correction replaces every stale host-level selector with the
current direct resource card, then verifies the same `codex-cli` relationship
on the resource detail page. It changes no App, catalog, marketplace, download,
network, or package code. The original hidden no-output command now exits zero
with no output, and the renderer and packaged fixture-gate suites pass when run
serially. These two suites share a deliberate global temporary-prefix residue
gate, so running their files concurrently is not a valid combined invocation.
Only a new package version may consume a new formal acceptance invocation.

### 0.1.93 successor package and formal closure

The successor was packaged exactly once after an empty target/evidence,
process, and temporary-residue preflight. Its seven-file package directory is
bound by `PACKAGE-CONTROL.json`, BUILD, SHA256, and PACKAGE-FREEZE records. The
independent freeze inspection matched the packaged version, main, preload,
renderer, identity login, downloaded-package action, download task, managed
download network, and managed download queue; it scanned 247 text files with
zero secret findings and observed the signed remote catalog at v7 with 375
vendors and 615 products.

The only 0.1.93 formal invocation then reached terminal PASS. Both the fixed
deterministic renderer and packaged live-convergence scenarios passed;
observer disposal succeeded; product processes, isolated profiles, temporary
files, downloads, part files, and extraction roots all closed at zero. The
evidence FINAL SHA-256 is
`bbeb5ac54aa1178ba5395d8898a2c378a41543dfb0d5a3be828a7ac0cfa6081b`,
and the accepted Portable SHA-256 is
`aec1c11cd9c23002a0e5e6f7a81f64d6152eebbbf7c8f32fb40e3b75648be0fc`.
The package and acceptance invocations are both consumed and must not be
repeated. Both Windows executables remain unsigned, and this isolated packaged
PASS is not installation, user-machine acceptance, signing, upload, or
publication authority.
