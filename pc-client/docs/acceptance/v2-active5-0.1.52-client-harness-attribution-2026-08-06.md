# 0.1.52 active5 client/harness attribution

This is a correction of the 15 client/harness rows in the full-discovery report, not user-machine acceptance.

| Product(s) | Contract | Inventory/result | Expected button | Attribution |
| --- | --- | --- | --- | --- |
| DeepL, Canva, Xmind, Craft, Evernote, Taskade, TeamViewer, Audacity | fixed `desktop-download-only` profile | Discovery read the row before desktop detection settled; no AI Hub receipt was created. | `install-product` | harness FAIL |
| Filmora | fixed `desktop-download-only.wondershare-filmora` | The later isolated live smoke recorded `install-product`, authorized bytes, pause and retry. | `install-product` | harness FAIL |
| EdrawMax, EdrawMind, PDFelement | fixed `desktop-download-only` profile | An externally installed product may correctly render `refresh-product`/reinstall; it is not an AI Hub receipt. The raw harness captured neither terminal action. | `install-product` or `refresh-product` | harness FAIL |
| Docker Desktop | fixed `desktop-download-only.docker-desktop` | Current Winget inventory contains external Docker Desktop 4.83.0 and no AI Hub receipt. | `refresh-product` | harness FAIL |
| Asana | canonical `desktop-download-only.signed-catalog` | Its product is `ai-connectable`; the search helper opened the first same-vendor `ai-tool` projection. | `install-product` | harness FAIL |
| ClickUp | `desktop-official` / `download-page` | Its product is `ai-connectable`; the search helper opened the first same-vendor `ai-tool` projection. | official external action | harness FAIL |

The harness now waits for either terminal managed-download action (`install-product` or `refresh-product`) and carries the product directory kind when opening a searched vendor. No product ID exception, catalog correction, or renderer change is required. The prior canonical-first detection, legacy detection, Wondershare source normalization, and unknown-content-length streaming behavior are untouched.
