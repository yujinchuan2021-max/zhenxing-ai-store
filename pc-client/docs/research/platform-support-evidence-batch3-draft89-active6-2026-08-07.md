# Product platform support evidence Batch 3 (draft89 / v2 active6)

Candidate-only (`candidateOnly=true`, `publishable=false`); observedAt 2026-08-07T00:00:00.000Z. No catalog/state/schema/profile/artifact changes.

## Scope and statistics

Selected **40** canonical products not present in Batch 1 or Batch 2, with **120** claims: {"supported":84,"unknown":36,"unsupported":0,"blocked":0}. Resources (146) and targets (513) are excluded.

## Evidence rules

Only first-party HTTPS product/docs/release pages are cited. `unknown` is deliberate when the page does not explicitly establish native support for that platform; no inference from requirements, labels, package reachability, browser access or Windows profiles. No downloads or execution occurred.

### TRAE (`bytedance/trae-desktop`)

Selection: AI IDE with official platform download center

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.trae.ai/download (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://www.trae.ai/download (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://www.trae.ai/download (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### CapCut (`bytedance/bytedance-capcut-desktop`)

Selection: Video editor with official Windows/macOS desktop pages

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.capcut.com/tools/desktop-video-editor (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://www.capcut.com/tools/desktop-video-editor (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://www.capcut.com/tools/desktop-video-editor (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### UI TARS (`bytedance/bytedance-ui-tars-desktop`)

Selection: GUI agent desktop and official repository release identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://github.com/bytedance/ui-tars-desktop (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://github.com/bytedance/ui-tars-desktop (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/bytedance/ui-tars-desktop (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### 飞书 (`bytedance/bytedance-feishu`)

Selection: Enterprise collaboration desktop with explicit multi-platform downloads

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.feishu.cn/download?lang=zh-CN (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://www.feishu.cn/download?lang=zh-CN (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://www.feishu.cn/download?lang=zh-CN (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Google Chrome (`google/google-chrome-devtools`)

Selection: Browser desktop representative with official OS download pages

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.google.com/chrome/download-chrome/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://www.google.com/chrome/download-chrome/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://www.google.com/chrome/download-chrome/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Android Studio (`google/google-android-studio`)

Selection: Developer IDE with official Windows/macOS/Linux install docs

- windows: **supported**, runtime=native, architectures=unknown; evidence https://developer.android.com/studio/install (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://developer.android.com/studio/install (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://developer.android.com/studio/install (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Microsoft Copilot (`microsoft/microsoft-copilot-desktop`)

Selection: AI desktop identity; Windows official, other native evidence absent

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/get-copilot (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Microsoft 365 Copilot (`microsoft/microsoft-365-copilot`)

Selection: Enterprise AI desktop entry; Windows evidence is explicit

- windows: **supported**, runtime=native, architectures=unknown; evidence https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://support.microsoft.com/en-us/microsoft-365-copilot/access-microsoft-365-copilot-on-windows (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Visual Studio (`microsoft/microsoft-visual-studio`)

Selection: Windows IDE representative; macOS/Linux native identity unresolved

- windows: **supported**, runtime=native, architectures=unknown; evidence https://visualstudio.microsoft.com/downloads/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://visualstudio.microsoft.com/downloads/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://visualstudio.microsoft.com/downloads/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### GitHub Copilot CLI (`github/github-copilot-cli`)

Selection: Official CLI documentation and package identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-in-the-cli (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-in-the-cli (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-in-the-cli (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Cursor CLI (`anysphere/cursor-cli`)

Selection: Independent CLI identity distinct from Cursor desktop

- windows: **supported**, runtime=native, architectures=unknown; evidence https://cursor.com/cli (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://cursor.com/cli (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://cursor.com/cli (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### 千问桌面版 (`alibaba/alibaba-qwen-studio`)

Selection: AI desktop candidate from Alibaba official entry

- windows: **supported**, runtime=native, architectures=unknown; evidence https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6 (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6 (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://b.qianwen.com/apps/qkhomepage_twofoufeb/routes/l5Utxkrh6 (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Qwen Code (`alibaba/alibaba-qwen-code`)

Selection: Official CLI docs/repository with Windows and Unix guidance

- windows: **supported**, runtime=native, architectures=unknown; evidence https://qwenlm.github.io/qwen-code-docs/en/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://qwenlm.github.io/qwen-code-docs/en/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://qwenlm.github.io/qwen-code-docs/en/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### 夸克 AI 浏览器 (`alibaba/alibaba-quark-ai-browser`)

Selection: Windows browser identity; native non-Windows evidence absent

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.quark.cn/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://www.quark.cn/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://www.quark.cn/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### 钉钉 (`alibaba/alibaba-dingtalk-ai`)

Selection: Official download page lists Windows/macOS/Linux clients

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.dingtalk.com/download?isLite=0 (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://www.dingtalk.com/download?isLite=0 (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://www.dingtalk.com/download?isLite=0 (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### CodeBuddy (`tencent/tencent-codebuddy`)

Selection: Tencent AI coding desktop identity; platform claims need follow-up

- windows: **unknown**, runtime=native, architectures=unknown; evidence https://www.codebuddy.ai/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://www.codebuddy.ai/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://www.codebuddy.ai/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### 腾讯元宝电脑版 (`tencent/tencent-yuanbao-desktop`)

Selection: Windows desktop download identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://yuanbao.tencent.com/evt/dl (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://yuanbao.tencent.com/evt/dl (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://yuanbao.tencent.com/evt/dl (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### GPT4All Desktop (`nomic/gpt4all-desktop`)

Selection: Local-model desktop with official download identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://gpt4all.io/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://gpt4all.io/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://gpt4all.io/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### AnythingLLM Desktop (`mintplex/anythingllm-desktop`)

Selection: Local/hosted agent desktop with official desktop page

- windows: **supported**, runtime=native, architectures=unknown; evidence https://anythingllm.com/desktop (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://anythingllm.com/desktop (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://anythingllm.com/desktop (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Kiro IDE (`amazon/amazon-kiro-ide`)

Selection: Agentic IDE official product/download identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://kiro.dev/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://kiro.dev/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://kiro.dev/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Kiro CLI (`amazon/amazon-kiro-cli`)

Selection: Independent CLI identity and official CLI docs

- windows: **supported**, runtime=native, architectures=unknown; evidence https://kiro.dev/docs/cli/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://kiro.dev/docs/cli/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://kiro.dev/docs/cli/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Vibe Code CLI (`mistral/mistral-vibe-code-cli`)

Selection: Official CLI documentation and package identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://docs.mistral.ai/vibe/code/overview (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://docs.mistral.ai/vibe/code/overview (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://docs.mistral.ai/vibe/code/overview (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Hugging Face CLI (`huggingface/hf-cli`)

Selection: Official CLI docs and package registry identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://huggingface.co/docs/huggingface_hub/en/guides/cli (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://huggingface.co/docs/huggingface_hub/en/guides/cli (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://huggingface.co/docs/huggingface_hub/en/guides/cli (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### NVIDIA AI Workbench (`nvidia/nvidia-ai-workbench`)

Selection: Desktop environment officially documented for Windows/Linux

- windows: **supported**, runtime=native, architectures=unknown; evidence https://developer.nvidia.com/ai-workbench (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://developer.nvidia.com/ai-workbench (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://developer.nvidia.com/ai-workbench (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### NVIDIA Broadcast (`nvidia/nvidia-broadcast`)

Selection: GPU desktop utility with Windows-only official requirements

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### NVIDIA NemoClaw CLI (`nvidia/nvidia-nemoclaw-cli`)

Selection: CLI/agent identity; Windows native support is not established

- windows: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/NVIDIA/NemoClaw (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/NVIDIA/NemoClaw (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/NVIDIA/NemoClaw (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### OpenClaw Windows Hub (`openclaw/openclaw-windows-hub`)

Selection: Windows companion product with official Windows docs

- windows: **supported**, runtime=native, architectures=unknown; evidence https://docs.openclaw.ai/windows (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://docs.openclaw.ai/windows (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://docs.openclaw.ai/windows (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Hermes Desktop (`nousresearch/nous-hermes-desktop`)

Selection: Official Windows installer identity; other native platforms unresolved

- windows: **supported**, runtime=native, architectures=unknown; evidence https://hermes-agent.nousresearch.com/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://hermes-agent.nousresearch.com/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://hermes-agent.nousresearch.com/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Cline (`cline/cline-agent`)

Selection: Agent product identity; host/platform support requires official verification

- windows: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/cline/cline (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/cline/cline (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/cline/cline (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Cherry Studio (`cherryhq/cherry-studio`)

Selection: AI desktop application with official download page

- windows: **supported**, runtime=native, architectures=unknown; evidence https://cherry-ai.com/download (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://cherry-ai.com/download (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://cherry-ai.com/download (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Chatbox (`chatboxai/chatbox-desktop`)

Selection: AI desktop application with official install page

- windows: **supported**, runtime=native, architectures=unknown; evidence https://chatboxai.app/en/install (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://chatboxai.app/en/install (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://chatboxai.app/en/install (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Msty Studio (`msty/msty-studio`)

Selection: Local-model desktop line; platform claims require page-level verification

- windows: **unknown**, runtime=native, architectures=unknown; evidence https://msty.ai/products/studio/ (observed 2026-08-07T00:00:00.000Z)
- macos: **unknown**, runtime=native, architectures=unknown; evidence https://msty.ai/products/studio/ (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://msty.ai/products/studio/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### LobeHub (`lobehub/lobehub-desktop`)

Selection: Desktop release identity from official repository

- windows: **supported**, runtime=native, architectures=unknown; evidence https://github.com/lobehub/lobehub/releases/latest (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://github.com/lobehub/lobehub/releases/latest (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://github.com/lobehub/lobehub/releases/latest (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Windsurf (`windsurf/windsurf-editor`)

Selection: AI coding desktop representative

- windows: **supported**, runtime=native, architectures=unknown; evidence https://windsurf.com/ (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://windsurf.com/ (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://windsurf.com/ (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Warp (`warp/warp-windows`)

Selection: Terminal desktop with Windows product page and cross-platform docs

- windows: **supported**, runtime=native, architectures=unknown; evidence https://www.warp.dev/windows-terminal (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://www.warp.dev/windows-terminal (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://www.warp.dev/windows-terminal (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Manus (`manus/manus-desktop`)

Selection: Agent desktop identity; official Windows/macOS entry, Linux unresolved

- windows: **supported**, runtime=native, architectures=unknown; evidence https://manus.im/desktop (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://manus.im/desktop (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://manus.im/desktop (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Pinokio (`pinokio/pinokio-ai-browser`)

Selection: Local AI browser desktop release identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://github.com/pinokiocomputer/pinokio/releases/latest (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://github.com/pinokiocomputer/pinokio/releases/latest (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://github.com/pinokiocomputer/pinokio/releases/latest (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### Stability Matrix (`lykos-ai/stability-matrix`)

Selection: Local model manager desktop release identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://github.com/LykosAI/StabilityMatrix/releases/latest (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://github.com/LykosAI/StabilityMatrix/releases/latest (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://github.com/LykosAI/StabilityMatrix/releases/latest (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

### GAIA (`amd/amd-gaia`)

Selection: AMD local AI desktop/release representative

- windows: **supported**, runtime=native, architectures=unknown; evidence https://github.com/amd/gaia/releases/latest (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://github.com/amd/gaia/releases/latest (observed 2026-08-07T00:00:00.000Z)
- linux: **unknown**, runtime=native, architectures=unknown; evidence https://github.com/amd/gaia/releases/latest (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Official per-platform evidence remains incomplete; keep unknown until a first-party statement is verified.

### Goose Desktop (`aaif/goose-desktop`)

Selection: Open-source agent desktop release identity

- windows: **supported**, runtime=native, architectures=unknown; evidence https://github.com/aaif-goose/goose/releases/latest (observed 2026-08-07T00:00:00.000Z)
- macos: **supported**, runtime=native, architectures=unknown; evidence https://github.com/aaif-goose/goose/releases/latest (observed 2026-08-07T00:00:00.000Z)
- linux: **supported**, runtime=native, architectures=unknown; evidence https://github.com/aaif-goose/goose/releases/latest (observed 2026-08-07T00:00:00.000Z)
- Follow-up: Independent platform profile/artifact review required; do not reuse Windows approvals.

## Validation and handoff

- Verify every productId→vendorId against `state.draft.catalog` before downstream use.
- Validate claims with `shared/resource-platform-availability.cjs`; ensure HTTPS evidence, fresh observedAt, no duplicate IDs and no forbidden execution/profile keys.
- This batch does not authorize saveDraft, publish, sign, package, upload, download or install.
