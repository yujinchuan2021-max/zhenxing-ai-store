# v2 active6 265 Windows desktop live validation

- Generated: 2026-08-05T19:29:22.264Z
- Catalog: v6; 375 vendors; 615 products; 1 desktop-acquisition rows.
- Result: {"BLOCKED":1}.
- Direct item ceiling: 8388608 bytes; cumulative ceiling: 536870912 bytes.
- Direct items used the real Electron IPC authorization/download path, received data, paused and retried. Native discard confirmation is deliberately not auto-accepted; that user-dialog action is separately recorded as BLOCKED rather than treated as cancellation success.
- External acquisition actions were captured by the renderer before a bounded range probe; no browser windows, third-party installation, or full installer download was performed.

See the adjacent CSV for one evidence row per product.
