# Authoritative CLI coverage harness

## Symptom

The existing CLI review test used `admin/data/catalog-v1.json`, while the current source of truth is draft 89 in `admin/published/catalog-store/state.json`. The legacy blocker list still contained Anytype as official-only, but draft 89 correctly represents it as `cli-deploy-only`; draft 89 also contains three official-only CLI records absent from that legacy list.

## Cause

The local catalog fixture and the published draft intentionally evolved independently during the catalog P0. A static test bound to the fixture could therefore report a complete CLI set without checking the current draft. This was a source-selection drift, not permission to create executable profiles from newer catalog data.

## Fix

`shared/windows-cli-review-decisions.cjs` now retains the legacy decision set for the legacy fixture and exports a separate explicit `DRAFT89_CLI_REVIEW_BLOCKERS` set for the current authoritative draft. `scripts/validate-cli-agent-coverage.cjs` is a read-only, repeatable matrix harness: it cross-checks every independent CLI/Agent product with a fixed local profile, driver, requirements, capabilities, terminal/recheck path and receipt-owned uninstall, or with an explicit blocker. It normalizes omitted driver fields through the existing `driverIdForPlan` rule, so default npm profiles are not misreported as driverless.

## Verification

`tests/cli-agent-coverage.test.cjs` requires revision 89 and verifies the exact result: 32 managed-ready, 2 managed-partial, 1 deploy-only and 13 official-blocked products. It also verifies that every driver in the matrix is wired in Electron. The prior CLI decision and deploy-only tests remain focused regressions.

## Remaining acceptance

The harness does not download, install, log in, start a WSL distribution or service, or remove any product. The v2 active6 report is desktop-only validation and cannot be counted as CLI acceptance. Real Windows/WSL lifecycle acceptance remains required for all managed profiles, especially Auggie and OpenClaw Gateway.
