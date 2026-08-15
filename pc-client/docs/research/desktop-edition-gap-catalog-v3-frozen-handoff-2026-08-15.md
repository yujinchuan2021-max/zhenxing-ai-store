# Official desktop edition gap catalog v3 frozen handoff

Status: **candidate-only; frozen for catalog-owner review; not publishable**

## Outcome

- Reused and updated seven stable Product identities: `minimax-agent`, `notion-desktop`, `replit-agent`, `gemini-web`, `baidu-comate`, `kortix-command-center`, and `github-copilot`.
- Added one distinct Product identity: `flowith-os`; `flowith-agent-neo` remains byte-equivalent.
- Final candidate: 375 vendors, 617 products, 280 resources, 866 targets, and 10 resource connections.
- All eight desktop surfaces are `desktop-official` link-only records whose `officialDownload.kind` is `download-page`.
- No direct artifact URL, download contract, install profile, managed installation, credential value, Resource, target, or connection was added.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json` | `dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8` |
| `docs/research/2026-08-15-minimax-desktop-edition-gap-audit.md` | `1cf62980e52d9f543dc7ac5af0fbc3f3367e75376400cf2a8e57e6c9aab002a2` |
| `docs/research/2026-08-15-desktop-edition-gap-audit-batch2.md` | `49c67c7adeaba18bce9968a53c148382665828da3250826b3c546ac6d15dba0c` |

## TDD and verification

- Initial batch expansion RED: the prior candidate reported only three updated products and lacked the four batch-two identities.
- GREEN: `node --test tests/desktop-edition-gap-catalog-v3-candidate.test.cjs` passes 5/5.
- `validateCatalog`, official-download resolution, product behavior, exact identity ownership, reverse equivalence, duplicate FlowithOS rejection, frozen-input drift rejection, and pure byte idempotence are covered.
- The generator writes only the named candidate artifact. It does not mutate `admin/data/catalog-v1.json`, release state, channels, signatures, or production services.

## Frozen outputs

| Output | SHA-256 |
| --- | --- |
| `docs/research/desktop-edition-gap-catalog-v3-candidate-2026-08-15.json` | `354003c55e69abded51e16858b75f654d3ee642c36b46ff42c03791660c485b8` |
| `scripts/generate-desktop-edition-gap-catalog-v3-candidate.cjs` | `779bc5b663e44250fc99e9335ec781830c4ffe37d85b1df1d2eac0fdfaa7f89e` |
| `tests/desktop-edition-gap-catalog-v3-candidate.test.cjs` | `6daeb648019e5ed93ee64b42c9a65e1c2ae20523864d23751f5f78a4b61adef2` |

## Boundary

This file freezes a local catalog candidate, not a signed catalog release. A future catalog-owner step must revalidate these bytes against the current release, review localized copy and product ordering, sign a new catalog version, and prove old-client compatibility before the entries become visible to installed users.
