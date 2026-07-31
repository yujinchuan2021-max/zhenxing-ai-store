# Product retry was swallowed and update download exposed Chromium errors

## User-visible failure

- A failed desktop product card displayed `重新下载`, but clicking it could leave the same failed state without starting another attempt.
- An AI Hub client-update download could display the internal Chromium string `net::ERR_FAILED` instead of the short product copy.

## Root cause

The unified install recovery treated every persisted download task except `canceled` and `completed` as active. A `failed` task therefore stopped the install flow before it could call the shared `startDownload` action. The update IPC handler used the shared downloader but returned the raw exception message from its catch block.

## Fix

- Recovered `failed` tasks now resolve to `ready`, so the existing unified install rule starts a new or resumable managed-download attempt.
- Active, paused, and transitional tasks remain active; completed tasks remain downloaded; canceled tasks fall through to local-record recovery.
- Update downloads now use the same `managedDownloadFailure` mapping as product downloads and return a stable error code plus `下载连接失败` for Chromium transport failures.

## Verification

- A regression test proves that failed resumable and non-resumable tasks both re-enter the shared download action.
- A regression test proves that the update IPC handler cannot return the raw transport exception path.
- The two tests failed before the repair and passed after it.

## Prevention

Every user-visible retry action must be tested at the state-decision seam, not only at the button-presentation seam. Every path using the managed downloader must also use its shared failure mapper.
