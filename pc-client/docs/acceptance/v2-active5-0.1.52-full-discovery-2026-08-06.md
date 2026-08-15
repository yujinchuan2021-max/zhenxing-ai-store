# v2 active5 265 Windows desktop live validation

- Generated: 2026-08-05T17:30:32.988Z
- Catalog: v5; 375 vendors; 615 products; 265 desktop-acquisition rows.
- Result: {"BLOCKED":100,"PASS":146,"FAIL":19}.
- Direct item ceiling: 8388608 bytes; cumulative ceiling: 536870912 bytes.
- Direct items used the real Electron IPC authorization/download path, received data, paused and retried. Native discard confirmation is deliberately not auto-accepted; that user-dialog action is separately recorded as BLOCKED rather than treated as cancellation success.
- External acquisition actions were captured by the renderer before a bounded range probe; no browser windows, third-party installation, or full installer download was performed.

See the adjacent CSV for one evidence row per product.
