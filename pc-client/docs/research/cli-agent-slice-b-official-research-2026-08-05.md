# CLI agent slice-b official research

Research date: 2026-08-05. Scope: only `slice-b` entries whose candidate status was `research-pending`: `nous-hermes-agent`, `tabnine-cli`, `browser-use-cli`, `openmanus-cli`, `metagpt-framework`, and `nanoclaw-cli`. Sources were limited to first-party documentation, official repositories, and official GitHub releases. Dynamic remote-script execution, third-party tutorials, and inferred values were rejected.

## Outcome summary

None of the six entries is eligible for a managed Windows install profile from this review. The evidence is still useful for future manual/research-only handling, but no catalog, binding, state, or code change is implied.

| Entry | Official Windows form | Version/package evidence | Artifact/download | Terminal launch | Decision and blockers |
|---|---|---|---|---|---|
| `nous-hermes-agent` | Native PowerShell early-beta installer; WSL2 is described as the more battle-tested path | Installer supports `-Commit` and `-Tag`, but the documented quick path uses `main`; no fixed release artifact was established | GitHub source and raw installer are first-party, but the prescribed `iex (irm ...)` is dynamic remote script execution and is rejected | `hermes`, `hermes --version` | Reject for managed profile: unsafe dynamic installer, mutable branch default, early-beta Windows support, and no verified pinned Windows artifact/hash |
| `tabnine-cli` | Windows PowerShell/CMD installer from the configured Tabnine host; installer should add PATH | Requires Node.js 22+ per prerequisites; installer self-updates and the docs do not expose a pinned CLI package version | No stable first-party artifact URL/version/hash was exposed; installer endpoint is host-dependent and dynamically fetched | `tabnine --version`, then `tabnine` | Reject: dynamic `irm`/Node installer, tenant/host dependency, authentication required, no pinned package or hash |
| `browser-use-cli` | Official README shows a shell installer; Windows section is not a verified native fixed artifact path | Official release page showed `0.12.9`; CLI 2.0 content is associated with `0.12.3`, but no Windows binary/package pin was established | Official installer is `curl ... install.sh | bash`; rejected. No verified Windows artifact/hash found | `browser-use open ...` after install | Reject: dynamic installer, Chrome/Chromium-only dependency, no verified Windows artifact/hash, cloud mode additionally needs an API key |
| `openmanus-cli` | Windows virtualenv activation is documented; source checkout is required | Official README requires Python 3.12 and installs `requirements.txt`; no release/package pin was established | Repository source is first-party; no Windows release artifact or official hash was found | `python main.py` (or `python run_mcp.py` / `python run_flow.py`) | Reject for managed profile: source install, unpinned dependency resolution, API configuration required, optional Playwright browser install, no fixed artifact/hash |
| `metagpt-framework` | Official docs list Windows 11 support; Python 3.9 and `<3.12` are required; pip install is documented | Package install is `metagpt` but the reviewed docs do not pin a version; development install points at GitHub source | No verified Windows artifact/hash; package/source install only | `metagpt --init-config`, then `metagpt "Create a 2048 game"` | Reject: unpinned package, Node.js and pnpm required, API configuration required, no fixed artifact/hash |
| `nanoclaw-cli` | Official repository says Windows is via WSL2; Docker is the default runtime | Official GitHub Releases page showed latest `v2.1.17` on review date; release is a source/project rollup, not a Windows binary | No verified Windows artifact/hash; official release page showed assets loading without a usable fixed installer artifact | Setup is driven through Claude Code `/setup`, with project scripts/services afterward | Reject: WSL2 plus Docker prerequisite, Claude Code dependency, interactive setup, provider/gateway coupling, no native Windows artifact |

## Per-entry evidence

### Nous Hermes Agent

The official native-Windows guide says Windows 10/11 native support is early beta and documents PowerShell execution of the installer fetched from the repository. It describes installation under `%LOCALAPPDATA%\\hermes`, Python 3.11, Node.js 22, PortableGit, ffmpeg, ripgrep, a virtual environment, and a User PATH shim. The same guide documents `-Commit` and `-Tag`, but the quick install defaults to the mutable `main` branch. The required remote PowerShell form is rejected by this research policy. Official sources: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/windows-native.md and https://github.com/NousResearch/hermes-agent/releases.

### Tabnine CLI

Tabnine’s official installation page requires Node.js 22+, access to a Tabnine host, and enabled Tabnine Agents. Its Windows instructions pipe a dynamically fetched `installer.mjs` through Node via PowerShell `irm` or CMD `curl`; it says the installer adds the CLI to PATH, verifies with `tabnine --version`, and launches with `tabnine`, followed by browser authentication. The host URL is supplied by the customer, so there is no single verified artifact domain or fixed package URL. Official sources: https://docs.tabnine.com/main/getting-started/tabnine-cli/getting-started/installation and https://docs.tabnine.com/main/getting-started/tabnine-cli/getting-started/quickstart.

### Browser Use CLI

The official repository’s CLI documentation presents a shell installer fetched from `browser-use.com` and a command-line workflow beginning with `browser-use open`. The official releases page showed release `0.12.9`; the CLI 2.0 material appears under `0.12.3`. The documentation states Chrome/Chromium CDP is required and Safari/Firefox are unsupported; cloud browser mode needs `BROWSER_USE_API_KEY`. Because the prescribed installer is a dynamic `curl | bash` flow and no fixed Windows artifact/hash was verified, it is rejected. Official sources: https://github.com/browser-use/browser-use/releases, https://github.com/browser-use/browser-use/blob/main/browser_use/skill_cli/README.md, and https://github.com/browser-use/browser-use.

### OpenManus

The official README offers Conda or uv source installation. It specifies Python 3.12, a repository clone, dependency installation from `requirements.txt`, Windows virtualenv activation syntax, and optional `playwright install`; terminal launch is `python main.py`, with MCP and flow alternatives. It requires an LLM configuration file containing provider/model/base URL/API key. The uv bootstrap example is itself a dynamic shell installer and was not accepted. No fixed Windows release artifact or official hash was found. Official source: https://github.com/FoundationAgents/OpenManus/blob/main/README.md.

### MetaGPT

The official documentation lists Windows 11 as supported with Python 3.9 and less than 3.12. It documents `pip install metagpt`, a GitHub development install, and required Node.js and pnpm before use. It exposes the `metagpt` terminal command and requires configuration under `~/.metagpt/config2.yaml`; the official example includes an LLM API key. The reviewed materials did not provide a pinned package version, Windows binary, or official hash. Official sources: https://docs.deepwisdom.ai/main/en/guide/get_started/installation.html and https://github.com/FoundationAgents/MetaGPT.

### NanoClaw

The official repository describes macOS, Linux, and Windows via WSL2, with Docker as the default runtime. The documented quick start uses a fork/clone and Claude Code, then runs the interactive `/setup` skill. The official releases page showed `v2.1.17` as latest on 2026-08-05, with a source rollup and no verified Windows installer artifact/hash. This is not a native Windows CLI install surface suitable for the managed profile. Official sources: https://github.com/qwibitai/nanoclaw/blob/main/README.md and https://github.com/nanocoai/nanoclaw/releases.

## Policy checks

- No dynamic `curl|bash`, `irm|iex`, or equivalent remote-script installer is accepted.
- No third-party tutorial or aggregator evidence was used.
- No version, package, artifact, domain, dependency, launch command, or hash was guessed where the official source did not establish it.
- No credentials or secret values are recorded.
- This document records research only; it does not authorize installation or alter catalog/state.
