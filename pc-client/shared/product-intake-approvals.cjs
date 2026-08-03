"use strict";

// This file is deliberately independent from the execution registries. A
// product contract change invalidates its fingerprint until a reviewer checks
// the product dossier and updates this explicit approval record.
const REVIEW_REFERENCES = Object.freeze({
  desktop: "docs/audits/2026-08-01-reviewed-windows-desktop-sources.md",
  reviewedDesktop: "docs/research/2026-07-31-reviewed-desktop-products.md",
  coreDesktop: "docs/research/2026-08-01-core-windows-desktop-lifecycle.md",
  firstCli: "docs/research/2026-07-31-cli-managed-install-audit.md",
  nextCli: "docs/research/2026-07-31-next-cli-managed-install-audit.md",
  lifecycle: "docs/research/2026-08-03-cli-resource-install-closure.md",
  openclaw: "docs/research/2026-07-31-kimi-openclaw-second-pass.md",
  openclawIma: "docs/research/2026-08-01-openclaw-ima-windows-product-model.md"
});
const REVIEWED_AT = "2026-08-01T00:00:00.000Z";
const LIFECYCLE_REVIEWED_AT = "2026-08-03T20:00:00.000Z";

const APPROVAL_ROWS = Object.freeze([
  ["alibaba-qoder-cn-ide", "08a9a6a625f5ce07c14045e12640b912b343aeb8c966871206c9c093b1f44897", "desktop"],
  ["alibaba-qoderwork-cn", "22cb9e006f407d386552b4651996be2a5effe11eeac2efa3c7929e375511530e", "desktop"],
  ["alibaba-qwen-code", "0740e1baa9b123d3ed2e79781d93a4fb68f4d60dd23d2f405f104db5a4e9ce63", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["alibaba-qwen-studio", "16941e9c8ecbc4c52ef72de1afed32aa3651428e2e4ec1dd78ba353e1a624348", "desktop"],
  ["amazon-kiro-cli", "97452f20faf8847c3b87cbe05794543b1167845a147aee4df1ea3b2296505e61", "nextCli"],
  ["amazon-kiro-ide", "1e6f43f6a7926336ae10a486a985935ad313c1e80bac89fe77a43432af8459df", "desktop"],
  ["anythingllm-desktop", "8feaaeb4abc0a524cb7f9eb7f1664be1bb9d59f3ee075de17c27e5169b3216b2", "desktop"],
  ["bytedance-doubao", "905f329d98d5d009f56a5e8a5240628a5869e5e2cef47c46b4232b82c7fd26d4", "desktop"],
  ["chatgpt-desktop", "a6f6cb396e54e442fa13cb2098f228d467b36860cadd55d727f069fad6354286", "coreDesktop"],
  ["claude-code", "3cfacff276347cb91b875e4e779706060245c385f9dc15ec739f2b025a40ab8e", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["claude-desktop", "5df0aac39455fa06bc51432a2497c372fc3d5364725c96841ed1dbf67f7c18d1", "coreDesktop"],
  ["codex-cli", "75557384a2f3f055d3b0f733ced5ad1336c20721ba235ec876da2ffd3ab4e068", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["comfy-cli", "1158c4872d9357f4da5df94690118b46cc36617f48b7c72999e6636b0c91f6f5", "nextCli"],
  ["comfy-desktop", "faa3f37cc30f7a07cee192a479531d954ffd0ff338b47c27bf130f33c13a0091", "coreDesktop"],
  ["cursor-desktop", "80adc31e0e4cc1d6cd231db47318c6c2bfa94621fad3d4aff4c115e109b0b245", "desktop"],
  ["gemini-cli", "5b6cf22da87d52d296aa1713cb164cd3bfd1fa348bf43a88e4d9bb831271c7dd", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["github-copilot-cli", "daeb0720f59eea0d14adc986d32aa1424feab330e10f4148cb757f015d0d4e31", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["google-antigravity-cli", "2642992e2e05c689876e9a46b31b5111c8903bbf7342823f6c05e5eacad98ebc", "nextCli"],
  ["google-antigravity-desktop", "9560fd098cc6f190fe01e4549a334eef3076d502a8ed0782a97127774b8e61b8", "desktop"],
  ["gpt4all-desktop", "094cfb00eb7fc5b6c959f93322bd74585e92b79d23e7e37afb306af77d14d5e2", "desktop"],
  ["hf-cli", "e308f661f2fa734f474b2c3c97d66e2e342d361f1a536e7315f75b9884a088d8", "nextCli"],
  ["jianying", "4b10735c89b10b861375d708672c81c68c7b32861dd664371f703cb506f6f688", "desktop"],
  ["kimi-work-desktop", "261739294e2e93425efa7bae9b1c98a2601faed9f57066672cc91378429d6d62", "desktop"],
  ["lm-studio-desktop", "38637c339abb777e759c020da384d71f48f14c86fb76de0e60cc2dbf01963377", "desktop"],
  ["minimax-cli", "1fe8f871c4849c2ca9cf10ff091fc233bbbe5e7c70329b91e8abaaef7de00e7a", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["mistral-vibe-code-cli", "5573b7b238bc2e5a60e895405562dc64169b209bb87b030f6a4a5d479aaadf3e", "nextCli"],
  ["moonshot-kimi-code-cli", "030106a3fbf52cea74024abfeaddb37fa96a93d46612453f30e7954c75d3ca21", "nextCli"],
  ["nvidia-ai-workbench", "ac2d1bf2b3926e0efd564d8c5248093d5540be263530817969571d097ccd6d89", "desktop"],
  ["ollama-cli", "c35b1809152b4fc49d611e6a36890b101974c4ceac9f07d3af4f55d4c93829ad", "coreDesktop"],
  ["openclaw-agent", "7d53688e5bb7de698383113cc61482f9af24cb3e548fe4e5c3763d719776d564", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["openclaw-windows-hub", "98d42438465ff9de086c43785121e8aee54a32eb04fe7ab6f0a22537a43438c1", "openclawIma"],
  ["openclaw-wsl-gateway", "d4a8c9dea88d1e035dcb00c771e4183fb7f816f369667bb3b6ad1043a671e734", "openclawIma"],
  ["opencode", "d06a4901fcbcea949a74e1482950c962b6775cd564761f916d73fe89f7905237", "desktop"],
  ["perplexity-comet", "a0f464833664e1d380dfdbcac3c6a29dd17b679f4b4df8196ebae1ddc6788b5a", "desktop"],
  ["tencent-codebuddy", "b3372a3bd31642834287a730ed216e02e441ccec6d011b9851d3eb95abd2f4e5", "desktop"],
  ["tencent-ima", "0d53a0c6ec9f675bf1aee13d9a0be129b9b1d580dd88bd134b8629c1763ef422", "openclawIma"],
  ["tencent-qclaw", "bff31dcdf7b6e8db35a182f7d0f5cfb8f3af27e3bf6d394ebed242f40ddb7636", "desktop"],
  ["tencent-workbuddy", "045d7264bca0b594831306dfda448a7754a638f186a415b075932af71510723a", "desktop"],
  ["tencent-yuanbao-desktop", "134d40314a00604fe4ca896c457d3352d5ca85bb2e2d7a942d86e50d13c1b43e", "desktop"],
  ["trae-desktop", "043387a14e995c899b59feab5a50c43d7499564748fdec1717cdc64fe3dc6a56", "desktop"],
  ["trae-solo-cn", "f80d5ac5e40a8f1f99643e966e77467d43b928df8aedc2a9efc84eaaf5911888", "desktop"]
]);

module.exports = Object.freeze(
  Object.fromEntries(
    APPROVAL_ROWS.map(([productId, executionContractSha256, reference, reviewedAt]) => [
      productId,
      Object.freeze({
        executionContractSha256,
        reviewReference: REVIEW_REFERENCES[reference],
        reviewedAt: reviewedAt || REVIEWED_AT
      })
    ])
  )
);
