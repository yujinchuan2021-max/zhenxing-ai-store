# Runtime task lifecycle recovery

## Symptom

After a client process exit, durable desktop-download tasks in `starting`,
`downloading`, `pausing`, or `canceling` could be restored as active work even
though no transfer process survived. The task center could therefore show a
ghost running or canceling task.

## Cause

Startup recovery only expired old `paused` and `failed` records. It did not
apply the existing partial-file evidence checks to interrupted active phases.
Desktop operation terminal snapshots also remained in the renderer task map.

## Fix and boundary

- A validated partial file from an interrupted active download becomes
  `paused` and resumable; no partial record is removed so retry preserves its
  original intent.
- An interrupted active record without partial evidence is removed, returning
  the product to a fresh download action.
- An interrupted cancellation becomes a terminal cleanup failure while its
  controlled partial file is cleaned; successful cleanup removes the task.
  Unsafe evidence is never deleted and is terminal, never active.
- Canceled and failed desktop operations are removed from the task-center map
  after their product status is projected. The product-level retry/error state
  remains available.

This changes only the common lifecycle boundary. It keeps cancellation,
controlled-path cleanup, HTTPS/source authorization, and missing-completed-file
reconciliation intact. CLI terminal deletion/retry and resource busy-state
handling already had their corresponding paths.

## Verification

Focused simulated task tests cover interrupted download recovery, cancel
cleanup, deletion, retry, completed-file loss, desktop operations, CLI/WSL,
and extension resources. `npm.cmd run build` and syntax checks pass. No
third-party package was downloaded, installed, or launched.

## Remaining device acceptance

On the next packaged candidate, exercise cancel -> task disappears -> retry
with a desktop direct download, a fixed-profile desktop download, a CLI/WSL
task, and a resource installation; also delete a completed local artifact and
confirm the product returns to its acquisition action.
