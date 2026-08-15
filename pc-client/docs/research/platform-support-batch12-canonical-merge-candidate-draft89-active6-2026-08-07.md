# Platform Support Batch 1+2 canonical merge candidate (superseded)

Status: **candidate only**. It is not publishable and does not modify a draft,
active catalog, signing history, profiles, artifacts, lifecycle, receipts, or
actions.

## Historical input

Do not consume this candidate. Use
[`platform-support-batch123-canonical-merge-candidate-draft89-active6-2026-08-07.json`](platform-support-batch123-canonical-merge-candidate-draft89-active6-2026-08-07.json)
as the sole combined input. Batch 1 and Batch 2 remain independent immutable
evidence sources; this marker does not delete or rewrite either source.

| evidence batch | products | claims | result |
| --- | ---: | ---: | --- |
| 1 | 20 | 60 | 53 supported, 7 unknown |
| 2 | 30 | 90 | 71 supported, 15 unknown, 4 unsupported |
| combined | 50 | 150 | 124 supported, 22 unknown, 4 unsupported |

The 50 canonical product IDs are disjoint. Only their `platformSupport`
product field is proposed; the other 565 products, all 146 resources, 513
targets, and four stores must be deep-equal before any authorized save.

## Consumption and rollback gates

Re-read both evidence files and the authoritative state; require the recorded
source hashes, counts, revision, active release identity, vendor/product
matches, exact enums, first-party HTTPS evidence, and observed dates to match.
Run the shared candidate adapter before copying each claim. Unknown and
unsupported are display/filter evidence with no execution authority. Supported
also does not mean managed, installable, or Agent-bindable.

The active schema remains unbound. A separate explicit authorization is needed
before any save or publication. Until then rollback is simply discarding this
candidate. After a future authorized consumption, rollback may remove only the
50 recorded `platformSupport` fields after rechecking both evidence sources.
