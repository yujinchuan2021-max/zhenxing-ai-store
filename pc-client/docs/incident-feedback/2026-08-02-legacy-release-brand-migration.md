# Legacy release brand blocked the 0.1.27 local switch

## User-visible failure

`npm run release:local:prepare` rejected the existing local runtime with `旧版发布包清单结构无效`, so the verified 0.1.27 candidate could not replace 0.1.26.

## Reproduction evidence

- `deployment/local/runtime/current` was a complete schema-v2 release for 0.1.26.
- Its signed installer was named `AI-Hub-Local-0.1.26-Windows-x64-Setup.exe`.
- Direct v2 verification reported `发布包安装包文件名与版本不一致`.
- The migration path then retried every v2 failure as schema v1 and replaced that useful error with `旧版发布包清单结构无效`.

## Root cause

The brand migration made new artifacts use `ZhenXing-AI-*`, but the bundle verifier stopped recognizing already-issued `AI-Hub-*` artifacts. The release builder and verifier had accidentally been given the same naming policy even though their responsibilities differ: builders must emit only the current brand, while upgrade verification must continue to authenticate historical signed releases.

## Fix

- New release generation remains restricted to `ZhenXing-AI-*` names.
- Historical verification accepts both `ZhenXing-AI-*` and `AI-Hub-*` Setup names while still checking the declared version, signed metadata, hash, size and exact file tree.
- Migration now selects the v1 verifier only when the safely-read manifest actually declares schema version 1.
- A damaged schema-v2 release retains its original verification error and is never treated as a legacy-v1 candidate.

## Verification

- The historical 0.1.26 runtime verifies as schema v2 without changing or re-signing it.
- Focused bundle and deployment tests cover the old brand name and error-preservation paths.
- The final release workflow must still pass prepare, bundle verification, local HTTPS server verification and packaged-client catalog verification before acceptance.

