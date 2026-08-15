"use strict";

function blocked(reason, reviewUrls) {
  return Object.freeze({
    verdict: "blocked",
    reason,
    reviewUrls: Object.freeze(reviewUrls)
  });
}

const CLI_REVIEW_BLOCKERS = Object.freeze({
  "cursor-cli": blocked(
    "官方 Windows 路径依赖 WSL 和动态安装脚本，尚无固定 Windows 产物摘要与完整卸载契约。",
    ["https://docs.cursor.com/en/cli/installation"]
  ),
  "nvidia-nemoclaw-cli": blocked(
    "需要 WSL2、Docker、容器和服务编排，现有单产品收据无法完整拥有其生命周期。",
    ["https://github.com/NVIDIA/NemoClaw"]
  ),
  "nous-hermes-agent": blocked(
    "Windows 原生支持仍为早期测试，安装还会引入多运行时、懒下载和网关服务。",
    ["https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/windows-native.md"]
  ),
  "tabnine-cli": blocked(
    "安装器由团队 Host 动态返回代码和版本，官方未提供可固定校验的通用 Windows 产物。",
    ["https://docs.tabnine.com/main/getting-started/tabnine-cli/getting-started/installation"]
  ),
  "browser-use-cli": blocked(
    "后续 Chromium、profile-use 和 daemon 下载尚未被固定版本、收据和卸载流程覆盖。",
    ["https://docs.browser-use.com/open-source/browser-use-cli"]
  ),
  "metagpt-framework": blocked(
    "需要 Python 3.11、Node 和 pnpm 的多运行时组合，现有 Python 3.13 模块不适配。",
    ["https://github.com/FoundationAgents/MetaGPT"]
  ),
  "kortix-cli": blocked(
    "官方仅支持 Linux/WSL，尚无经过真实验收的受控 WSL 安装模块。",
    ["https://github.com/kortix-ai/suna"]
  ),
  "mini-swe-agent-cli": blocked(
    "官方工具执行契约是 Bash，原生 Windows CMD 与其行为不一致。",
    ["https://mini-swe-agent.com/latest/"]
  ),
  "simular-agent-s-cli": blocked(
    "需要全机 GUI 控制、OCR 和额外模型服务，权限与外部依赖尚无完整收据边界。",
    ["https://github.com/simular-ai/Agent-S"]
  ),
  "anytype-cli": blocked(
    "固定 Windows ZIP 已核验，但用户服务的可执行路径归属尚未进入收据；不能盲目注销用户手动安装的同名服务。",
    [
      "https://github.com/anyproto/anytype-cli/releases/tag/v0.3.6",
      "https://developers.anytype.io/docs/examples/featured/cli/"
    ]
  ),
  "plandex-cli": blocked(
    "官方 Windows 仅通过 WSL 使用，尚无经过真实验收的受控 WSL 模块。",
    ["https://github.com/plandex-ai/plandex"]
  )
});

// catalog-v1 is intentionally retained as a historical local fixture while
// draft 89 is the current authoritative catalog. Keep its reviewed blockers
// explicit rather than allowing either catalog to manufacture an executable
// profile from a product label.
const DRAFT89_CLI_REVIEW_BLOCKERS = Object.freeze({
  ...Object.fromEntries(
    Object.entries(CLI_REVIEW_BLOCKERS).filter(
      ([productId]) => productId !== "anytype-cli"
    )
  ),
  "openmanus-cli": blocked(
    "官方路径是源码检出、Python 环境、配置和可选浏览器依赖，不是具有完整 Windows 收据生命周期的独立发行 CLI。",
    ["https://github.com/FoundationAgents/OpenManus"]
  ),
  "nanoclaw-cli": blocked(
    "Windows 路径依赖 WSL2、Docker、容器和服务状态，现有单产品收据不能安全拥有或卸载该复合部署。",
    ["https://github.com/qwibitai/nanoclaw"]
  ),
  "agenticseek-cli": blocked(
    "官方 CLI 模式依赖源码、Python、Docker 和服务栈；当前没有固定 Windows 制品及完整受管生命周期。",
    ["https://github.com/Fosowl/agenticSeek"]
  )
});

const DRAFT89_CLI_PROFILE_CAPABILITY_EXCLUSIONS = Object.freeze({
  "augment-auggie-cli": Object.freeze({
    capabilities: Object.freeze(["repair"]),
    reason: "draft89 has not consumed the candidate-only Auggie repair catalog binding"
  })
});

module.exports = {
  CLI_REVIEW_BLOCKERS,
  DRAFT89_CLI_PROFILE_CAPABILITY_EXCLUSIONS,
  DRAFT89_CLI_REVIEW_BLOCKERS
};
