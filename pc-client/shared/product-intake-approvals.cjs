"use strict";

// This file is deliberately independent from the execution registries. A
// product contract change invalidates its fingerprint until a reviewer checks
// the product dossier and updates this explicit approval record.
const REVIEW_REFERENCES = Object.freeze({
  desktop: "docs/audits/2026-08-01-reviewed-windows-desktop-sources.md",
  reviewedDesktop: "docs/research/2026-07-31-reviewed-desktop-products.md",
  firstCli: "docs/research/2026-07-31-cli-managed-install-audit.md",
  nextCli: "docs/research/2026-07-31-next-cli-managed-install-audit.md",
  openclaw: "docs/research/2026-07-31-kimi-openclaw-second-pass.md",
  openclawIma: "docs/research/2026-08-01-openclaw-ima-windows-product-model.md"
});
const REVIEWED_AT = "2026-08-01T00:00:00.000Z";

const APPROVAL_ROWS = Object.freeze([
  ["alibaba-qoder-cn-ide", "e04d8e58ca6e80271093930d7574bd371e8834c19a936afd555b0eee2901f1d1", "desktop"],
  ["alibaba-qoderwork-cn", "9533e229f7331ec429ecb88cc8e5106a6b6d8be1e95032251756e2aaacb40398", "desktop"],
  ["alibaba-qwen-code", "6e3612394d9cbcc5c2d4a40a5a65c76ee48736035e95cedca077b349fa387a40", "nextCli"],
  ["alibaba-qwen-studio", "e48308a127ff07092a14f70e4b15f65abdd3812e2efd4d5055d5ee70822683f7", "desktop"],
  ["amazon-kiro-cli", "97452f20faf8847c3b87cbe05794543b1167845a147aee4df1ea3b2296505e61", "nextCli"],
  ["amazon-kiro-ide", "aef8e9efdf18d046207339fb5fcb3a4227120bc44786c384cee427f578f7e2e1", "desktop"],
  ["anythingllm-desktop", "0d9a47ad526ccd2a36abf7b64a1b7c7940fb70433ad95d1311bead9e596e17b7", "desktop"],
  ["bytedance-doubao", "7fcd594653e50835df72a00ac2d4f17786e725a670e36cab46bf175e2fa31811", "desktop"],
  ["chatgpt-desktop", "cf95e224961ae2c894d56908bd5ed6ef01dba3b041fb2c34c9da18fb82a2d28c", "reviewedDesktop"],
  ["claude-code", "1b32de14178673c8314cdd304dc879349ad4f2be82e72033d3f7b65e6024ec80", "firstCli"],
  ["claude-desktop", "0be338ef1973784626562e73842d2db0e50f3504e5780faeabc70aecfb2df249", "reviewedDesktop"],
  ["codex-cli", "4663825949daa8f0a17e393c51e54c358c5ed1f384e0dd204daa1807300bc913", "firstCli"],
  ["comfy-cli", "1158c4872d9357f4da5df94690118b46cc36617f48b7c72999e6636b0c91f6f5", "nextCli"],
  ["comfy-desktop", "c31525ad5a30c015af364c3de0f88cfb41f6d8a471009ec9a152516ef002d8f8", "reviewedDesktop"],
  ["cursor-desktop", "3554f07b02bd6b7e50f45c8fc4c55debcf7a957be394eafb7c206e95e0482d74", "desktop"],
  ["gemini-cli", "c64ea7fcce28fb4652a114f2a681245225403a0ca202e99edc60cf61e936dbff", "firstCli"],
  ["github-copilot-cli", "3a803fabf8a4266704ae9ed2c6023c16272c94492364ce19e5e7097787079526", "nextCli"],
  ["google-antigravity-cli", "2642992e2e05c689876e9a46b31b5111c8903bbf7342823f6c05e5eacad98ebc", "nextCli"],
  ["google-antigravity-desktop", "1e942e322e199e20361745adf5523026177cb88f46b85cba400bfd51bf88f8ef", "desktop"],
  ["gpt4all-desktop", "2e77ca80808b4a8ea614b5ac076bf0c390389da567be7d4e1dcc311ddec756dc", "desktop"],
  ["hf-cli", "e308f661f2fa734f474b2c3c97d66e2e342d361f1a536e7315f75b9884a088d8", "nextCli"],
  ["jianying", "1cbb9b19414cb1af97ac2e1400f574599311c4f734624915c97b64bd33bfeec3", "desktop"],
  ["kimi-work-desktop", "8ceed4c4acf1080890dff97cac7505953f2fa8890e7e58aa46e8884d086092fa", "desktop"],
  ["lm-studio-desktop", "1ece6c37ae81f14e952163954cbe3704748c4cf554e124d120c8ed784c4a0582", "desktop"],
  ["minimax-cli", "94755c3ebab1e13037af0454fd8be5a9ba6086a8538dd72526ad9f80e66b888c", "nextCli"],
  ["mistral-vibe-code-cli", "5573b7b238bc2e5a60e895405562dc64169b209bb87b030f6a4a5d479aaadf3e", "nextCli"],
  ["moonshot-kimi-code-cli", "030106a3fbf52cea74024abfeaddb37fa96a93d46612453f30e7954c75d3ca21", "nextCli"],
  ["nvidia-ai-workbench", "061e22ecb2c23d773d6e755b1f3e90d90550a58e40ffc54469bbb76ece6c0d3e", "desktop"],
  ["ollama-cli", "3f455f4d842fcce67171a1cdbe4a6c40af8691a1e60cdc25d899e7889afb7c03", "reviewedDesktop"],
  ["openclaw-agent", "dc2a4c7632b5a3ed3538025dcc0600ca2c99e82bfbc01b7f1abf2060be8cd533", "openclaw"],
  ["openclaw-windows-hub", "afcacd9da3b0f35c34f95fca1b719c1b3a1500e8aca581d1b6322c5641852dc1", "openclawIma"],
  ["openclaw-wsl-gateway", "d4a8c9dea88d1e035dcb00c771e4183fb7f816f369667bb3b6ad1043a671e734", "openclawIma"],
  ["opencode", "ae369996dd47e86160c75a53fe1cb23a4f263f16628b960c22074c3ab2c654f9", "desktop"],
  ["perplexity-comet", "cdb22a256a568ce3ccf69169d934ed2733e197118d20498a159af7db93af3947", "desktop"],
  ["tencent-codebuddy", "d538c6d1b9c5ff98316f6005fc3e9aa0238afd4700a41ec55f4f7a0c80de1a2e", "desktop"],
  ["tencent-ima", "44939dcbb5614533773623bfd16e2d81c6eb836ecacde97cc53bcb065be108b1", "openclawIma"],
  ["tencent-qclaw", "439ef7f2655314d343e1e83b4470a53bf6ff32bd17591b984384b2c2c04b4439", "desktop"],
  ["tencent-workbuddy", "116c4184e39caa8607a43a37a8bb57203eb72fcc1acd71c91cd34175506597fc", "desktop"],
  ["tencent-yuanbao-desktop", "16ec681bf172a3df888edf05d78c5e0de287c123f4a1b4d8b292f210d22db6f8", "desktop"],
  ["trae-desktop", "28ae0477cf774ca8f0bac37866cbef2602e9b4176e6227b6669cdc5f0a8ece4f", "desktop"],
  ["trae-solo-cn", "aa40525af771b7b0b822fac7be91f2d1aa298f37cec2b66bf59d311660163f73", "desktop"]
]);

module.exports = Object.freeze(
  Object.fromEntries(
    APPROVAL_ROWS.map(([productId, executionContractSha256, reference]) => [
      productId,
      Object.freeze({
        executionContractSha256,
        reviewReference: REVIEW_REFERENCES[reference],
        reviewedAt: REVIEWED_AT
      })
    ])
  )
);
