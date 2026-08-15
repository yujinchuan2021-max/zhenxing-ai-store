# CLI agent slice A official research (2026-08-05)

Scope: only the `research-pending` entries in slice-a: `cursor-cli` and `nvidia-nemoclaw-cli`. No managed-ready entries were re-researched. Sources are vendor documentation or official repositories only.

## cursor-cli (Anysphere / Cursor)

- Official Windows support: Cursor’s CLI installation page lists “macOS, Linux and Windows (WSL)”; this is WSL, not a native Windows executable or native PowerShell install. Source: https://docs.cursor.com/en/cli/installation
- Install shape: the official method is a hosted shell pipeline (`curl https://cursor.com/install -fsS | bash`). This is a dynamic script install and is explicitly rejected for the controlled Windows installer policy.
- Version/package: the official page documents auto-update and `cursor-agent update`/`upgrade`, but does not publish a fixed Windows package, stable versioned artifact, or official hash suitable for a pinned Windows install record.
- Dependencies: WSL with a bash-compatible environment; the documented post-install path is `~/.local/bin`. The official page does not establish a native Windows dependency/runtime contract.
- Start: `cursor-agent`; verification is `cursor-agent --version`. These are documented terminal entry points, but the Windows route remains WSL-only.
- Artifact/domain: no acceptable fixed artifact URL was verified. The installer host is `cursor.com`, but the dynamic installer is not accepted as a downloadable artifact.
- Decision: **blocked / not eligible for managed Windows CLI automation**. Blockers are WSL-only Windows support, dynamic curl-piped installer, auto-updating behavior, and no official fixed package/hash.

## nvidia-nemoclaw-cli (NVIDIA / NemoClaw)

- Official Windows support: NVIDIA’s official quickstart says to prepare a Windows machine first and identifies Windows WSL as a supported-with-limitations path; the official repository’s platform table says Windows WSL2 requires Docker Desktop with the WSL backend. Sources: https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/quickstart and https://github.com/NVIDIA/NemoClaw/blob/main/README.md
- Install shape: the official path is the hosted installer `https://www.nvidia.com/nemoclaw.sh` piped to bash. The installer installs Node.js when needed and NemoClaw through npm, and onboarding provisions the OpenShell/Docker sandbox. This dynamic script path is rejected for controlled Windows automation.
- Version/package: the official docs state that the hosted installer follows a maintained last-known-good release by default. They document an optional release tag or full reviewed commit reference, but do not provide a single stable Windows package artifact with a published hash for this catalog entry.
- Dependencies: WSL2, Docker Desktop using the WSL backend, Node.js (installer may install it), Docker running, and the OpenShell runtime/sandbox flow. Windows-native PowerShell execution is not the documented install/runtime shape.
- Start: after onboarding, official terminal operation is `nemoclaw <sandbox-name> connect`, followed by `openclaw tui`; status is `nemoclaw <sandbox-name> status`. Source: https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/quickstart
- Artifact/domain: `https://www.nvidia.com/nemoclaw.sh` and the official `github.com/NVIDIA/NemoClaw` repository are authoritative sources, but the installer is mutable/dynamic and is not accepted as a fixed artifact URL. No official hash for a Windows package was verified.
- Decision: **blocked / not eligible for managed native Windows CLI automation**. A future WSL2-specific deploy-only integration would require a separately approved execution model and pinned upstream reference; this research does not authorize one.

## Summary

Neither pending entry has an eligible fixed, hash-verifiable official Windows artifact and native Windows installation contract. Both remain blocked and must not be promoted to managed-ready from this slice.
