# Active7 English catalog content A — frozen candidate

Status: **candidate only / not publishable**. Candidate label: `0.1.82-localized-en-content-a`.

## Source and scope

- Source channel: `v2`
- Source release: `catalog-v00000007-8c49e1972186-0cec5335`
- Source envelope SHA-256: `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`
- Coverage: 1 brand, 1 community block, 2 banners, 3 carousel slides, 5 carousel actions, 375 vendors, and 615 products
- Localized records: 1,002
- Localized string values: 2,005

All 375 vendor descriptions and 615 product descriptions are fixed, per-ID authored English strings. The former description word-splicing dictionaries and runtime translation function were removed. The generator now fails closed unless the authored vendor and product ID sets exactly match active7. This is an authoring declaration, not an independent editorial approval.

## Name handling

Existing Latin names or Latin aliases already present in the catalog are used where applicable. Fifty-two localized names retain Chinese text under the `properNamePreserved` classification. This is a conservative preservation decision only and does not claim that no official English name exists.

## Quality and integrity gates

- Authoring declaration coverage: 375/375 vendors and 615/615 products
- Known bad strings, including `Mongolian edition`, `requires must`, `people objects`, and `language audio`: 0
- Repeated English helper words: 0
- Untranslated description fragments: 0
- Empty values: 0
- Overlong values: 0
- Extra localized fields: 0
- Primary and non-display drift: 0
- `stripLocalized(candidate.catalog)` equals the active7 source catalog
- v1 contains no localized content

The integrity manifest maps all 1,002 candidate records by `objectType` and `objectId` to `localizedContentSha256`. It proves completeness and content identity only; it contains no reviewer, review class, approval, or independent editorial sign-off. Tests recompute every SHA against the generated localized record.

## Frozen hashes and verification

- Candidate SHA-256: `affa8c2d307037509d5f7a57b55535a146505a27e2635dd7d641eaec5d8d8e15`
- Integrity manifest SHA-256: `b0ac668bd3b22fcd6d1b5ebc68be4c6127afb067d3e20f7beccdc35247f6978c`
- Two consecutive generation runs produced identical candidate and integrity manifest hashes.
- State SHA-256 remained `cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012`.
- Active7 envelope SHA-256 remained `facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4`.
- `node --test tests/catalog-english-content-a-active7-candidate.test.cjs tests/catalog-localization-contract.test.cjs`: 6 passed, 0 failed.

No state save, signing, publication, packaging, upload, runtime/schema change, or production write was performed. STOP: this frozen candidate awaits CTO read-only audit and is not publication authority.
