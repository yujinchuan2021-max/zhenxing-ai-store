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
  cliExpansion: "docs/research/2026-08-03-windows-cli-managed-expansion.md",
  cliClosure: "docs/research/2026-08-03-windows-cli-catalog-closure.md",
  aiderPython312:
    "docs/research/2026-08-04-aider-python312-windows-plan.md",
  auggieWsl:
    "docs/research/2026-08-04-remaining-cli-blockers-classification.md",
  auggieWslRepair:
    "docs/incident-feedback/2026-08-06-auggie-owned-prefix-repair.md",
  openFang: "docs/research/2026-08-04-openfang-windows-cli.md",
  openInterpreter:
    "docs/research/2026-08-04-open-interpreter-windows-artifact.md",
  zeroIronClaw:
    "docs/research/2026-08-04-zeroclaw-ironclaw-windows-cli.md",
  wisprFlow: "docs/research/2026-08-03-wispr-flow-windows-managed-install.md",
  desktopBatchOne: "docs/research/2026-08-03-managed-desktop-batch-1.md",
  existingDesktopLifecycle:
    "docs/research/2026-08-04-existing-managed-desktop-lifecycle-audit.md",
  desktopIdentityBatchA:
    "docs/research/2026-08-04-existing-desktop-identities-batch-a.md",
  desktopIdentityBatchB:
    "docs/research/2026-08-04-existing-desktop-identities-batch-b.md",
  desktopIdentityBatchC:
    "docs/research/2026-08-04-existing-desktop-identities-batch-c.md",
  publicDesktopArtifactBatchB:
    "docs/research/2026-08-04-direct-desktop-artifact-audit-b.md",
  publicDesktopArtifactBatchA:
    "docs/research/2026-08-04-direct-desktop-artifact-audit-a.md",
  managedRegistryDesktopOwnership:
    "docs/research/2026-08-04-managed-registry-desktop-ownership.md",
  openclaw: "docs/research/2026-07-31-kimi-openclaw-second-pass.md",
  openclawIma: "docs/research/2026-08-01-openclaw-ima-windows-product-model.md"
});
const REVIEWED_AT = "2026-08-01T00:00:00.000Z";
const LIFECYCLE_REVIEWED_AT = "2026-08-03T20:00:00.000Z";
const EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT = "2026-08-04T00:00:00.000Z";
const CLI_ARTIFACT_REVIEWED_AT = "2026-08-04T00:00:00.000Z";

const APPROVAL_ROWS = Object.freeze([
  ["alibaba-qoder-cn-ide", "9faf0696a8150bdfad56e907da2ad307c1f77204c1ee652dbe09013c9cd8a131", "desktopIdentityBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["alibaba-qoder-cn-cli", "8b0612adcf7de4dd54a12d84f968a9b8e58765ebf9095cbf55d6a1c7358c83eb", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["alibaba-qoderwork-cn", "fe4638ec27607ef3b8fc5ca1d74ef87b531f58a3edc85dc1b52f195c1eac8fd0", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["alibaba-qwen-code", "0740e1baa9b123d3ed2e79781d93a4fb68f4d60dd23d2f405f104db5a4e9ce63", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["alibaba-qwen-studio", "7a31183a1a8d219768e6184dfc08f0b00e9a2fe0077115a2b4927217ef279e3c", "existingDesktopLifecycle", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["amazon-kiro-cli", "e921e4bd9b1b7103979a2d583f03eb4ba1d3976477f0863a4b01ea78b0cafa87", "nextCli"],
  ["amazon-kiro-ide", "1a9efd3b85b0c54d9295a355851c072db9c9854a7c0f215251569ab6aa63b83f", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["aider-cli", "6d204a5b486e5e49fb86945739166f20efedacc7e6c13453a908a620dd45ca0c", "aiderPython312", CLI_ARTIFACT_REVIEWED_AT],
  ["augment-auggie-cli", "2b0e8a2e31f8be56784e1153b536a78fc872a99524bc0ef4352ca93e1574165d", "auggieWslRepair", CLI_ARTIFACT_REVIEWED_AT],
  ["anythingllm-desktop", "ea3a3d12ba785350b7795d2f1f549fbf5c283eb07a2bf528013d8107935fa0a7", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["amp-cli", "6c9f9870cb90e0725b6ddaeb0da1799498f57e915eec65f7f4b2c60900df2cd6", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["bytedance-agent-tars-cli", "6e485affc42acf8cafafea5635b6f46f2168eac8276ec786e2cdf02eab3cb313", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["bytedance-doubao", "a17c1d57642c7004c56153953010812c5f64c639694da2d42313992e7654ddd3", "desktopIdentityBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["chatgpt-desktop", "a6f6cb396e54e442fa13cb2098f228d467b36860cadd55d727f069fad6354286", "coreDesktop"],
  ["claude-code", "3cfacff276347cb91b875e4e779706060245c385f9dc15ec739f2b025a40ab8e", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["claude-desktop", "5df0aac39455fa06bc51432a2497c372fc3d5364725c96841ed1dbf67f7c18d1", "coreDesktop"],
  ["codex-cli", "75557384a2f3f055d3b0f733ced5ad1336c20721ba235ec876da2ffd3ab4e068", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["comfy-cli", "cd88b78d25255f8766292eaad603b47048da6ca3f3dd16f1ff3c0ae88821150f", "nextCli"],
  ["continue-cli", "12d67b17d0c46c17bd639f7f789d11ff75a3568a1cb26305c524db2c9b835aaa", "cliExpansion", LIFECYCLE_REVIEWED_AT],
  ["daytona-cli", "7837855e5de68d6c225fb555b2b220376d39b6958f8c1727915e0a85b30469cc", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["deepgram-cli", "0fc180d2dcdce22a62e805440f36081ebcc480faf9d58067fe86d8bc983df234", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["comfy-desktop", "faa3f37cc30f7a07cee192a479531d954ffd0ff338b47c27bf130f33c13a0091", "coreDesktop"],
  ["cursor-desktop", "9f09bee3eac6199c931508047f4e0833ba379ee35fc39a77a87fa9eb424c8758", "desktopIdentityBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["gemini-cli", "5b6cf22da87d52d296aa1713cb164cd3bfd1fa348bf43a88e4d9bb831271c7dd", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["github-copilot-cli", "daeb0720f59eea0d14adc986d32aa1424feab330e10f4148cb757f015d0d4e31", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["google-antigravity-cli", "5571780c993821c966743ee4ca371aba7cf4a662452c59d2d5d7d6e65fbe8c64", "nextCli"],
  ["google-antigravity-desktop", "c1a7631d1e31e1fec358dd48b7d49f5bc40dfe075ba6c5236b0d17b143c7f461", "desktopIdentityBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["goose-desktop", "73f383801af83909935b639b951ade7a768b83f0a428257262264d06c5e7d8b2", "publicDesktopArtifactBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["gpt4all-desktop", "7627c147f8e64e954240970ce9e44c3a9a0325d119d15f5dff24446318ece9a5", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["factory-cli", "7799fb619d667d8bed0137faa054d811bedf41af958e95b4b4cb5faacf9e5b2d", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["hf-cli", "977ccee35a067d81840b0b2254bfc20173f89f7e5eb73a542ea60e1aff060d1e", "nextCli"],
  ["hkuds-nanobot-cli", "9bf2e6f955ac65bc517cb04a96b86be94dbdc9ec438eae5afd0a39c0667d2d3b", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["intel-ai-playground", "fdd2bf7f905b959da771c4ffe58b5d5ccf7f2141b1e4adc9b176c6da84e0101d", "publicDesktopArtifactBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["ironclaw-cli", "de59bcd52f952a39bbdbfeaa88b617632b1f39b1af15ca85546c4e4fae608144", "zeroIronClaw", CLI_ARTIFACT_REVIEWED_AT],
  ["invokeai-community-edition", "1f984fb3a24171836081880c7314f025e8f93510559d478f87c4a29ac75898c3", "publicDesktopArtifactBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["jianying", "d9a1dc0e2dfdd49005aa26200263f96b8260e707780f57f811787b29a7075b46", "desktopIdentityBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["jan-desktop", "92acf66edc4aaa52c0d65455b6afed35181c08bad3cce9704106f7b29312c07c", "desktopBatchOne", LIFECYCLE_REVIEWED_AT],
  ["kimi-work-desktop", "25b18f9b81f305f63780965947820e93d228d36ea83b5932f2a072c82d49955a", "desktopIdentityBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["koboldcpp", "d4557649c4a9f3032a2194a42683d5b63bf7c15de3afccc5662ec40ddcd7f60e", "publicDesktopArtifactBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["kilo-code-cli", "61ecfa6395af85ff15971923efe5fd6e36e49511bebf03d379508b0c609cb392", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["letta-code-cli", "28ce3acab4b04fea98facbf865877d93ca72fbf9110d388b75ec4b43ec9f7c8b", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["letta-agent", "049ac9e46b6f8e74ad0c162b14e4b181cc278830e805109eac1b4cc8fe0b3dd2", "managedRegistryDesktopOwnership", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["lm-studio-desktop", "afd895c02dbe0c24072542b15d44c6049ed11637c23e806e84cd6c9ad7f4fbaf", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["minimax-cli", "1fe8f871c4849c2ca9cf10ff091fc233bbbe5e7c70329b91e8abaaef7de00e7a", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["msty-go", "dbda9ff919fb719217f95b87fc25be36a0e56c255e9fd3560216e862b714d273", "managedRegistryDesktopOwnership", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["microsoft-vscode", "2e12c20009f37268d76466b78633d2cc532656b0cf005027bd7850265c1d1165", "desktopBatchOne", LIFECYCLE_REVIEWED_AT],
  ["mistral-vibe-code-cli", "e608e541b7e4a57b42c5bb49a1937fd251ec08a56b814f19f03bd8d2668cfe7f", "nextCli"],
  ["moonshot-kimi-code-cli", "5e7f8398489ecfac0bfed73007aea434910ad363d677bfb70b293fa53845f5f7", "nextCli"],
  ["nvidia-ai-workbench", "06ac262c5b56f48d370aa5d831db3ce082fb3de8d015b7e03bbaf5be73c1b4c7", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["ollama-cli", "c35b1809152b4fc49d611e6a36890b101974c4ceac9f07d3af4f55d4c93829ad", "coreDesktop"],
  ["openfang-cli", "4e44aa11fca4e54383103739a9e27d31ab85b6b716551abbcb310efabf9b08eb", "openFang", CLI_ARTIFACT_REVIEWED_AT],
  ["open-interpreter-cli", "bd509fa74171db210affbf80e07be1f9c031eee276d2c50dfa910192988afb3b", "openInterpreter", CLI_ARTIFACT_REVIEWED_AT],
  ["openclaw-agent", "7d53688e5bb7de698383113cc61482f9af24cb3e548fe4e5c3763d719776d564", "lifecycle", LIFECYCLE_REVIEWED_AT],
  ["openclaw-windows-hub", "10bc14ff94db403559d7cfe0a74672ff6bdda7a510c121cff840b0ec08a4fd71", "existingDesktopLifecycle", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["openclaw-wsl-gateway", "d4a8c9dea88d1e035dcb00c771e4183fb7f816f369667bb3b6ad1043a671e734", "openclawIma"],
  ["promptfoo-cli", "686f4f1567e080a0c777ab4772f7dd68f6c2aee4b6ce261bd7d8b36bc20c79e6", "cliExpansion", LIFECYCLE_REVIEWED_AT],
  ["ruflo-cli", "0dff4fa8496b4e084369b2127f1771bcbc455025e0e654292b500737e63d7b92", "cliExpansion", LIFECYCLE_REVIEWED_AT],
  ["rowboat-desktop", "fd0bf28a34b9e343dcebbfee3b60171c52b9709401cacfdc676b625d21c7a97c", "publicDesktopArtifactBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["stability-matrix", "5217454f22adb7015dc40f1d27dba36dea88ff9f49a59b236eedb837a834ea06", "publicDesktopArtifactBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["opencode", "846490329adb96587efc589924806f00a5c7aa4ce8c008f8c27febc5ac5d59d6", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["pixverse-cli", "68098186eba1553edc760ede44ae7c49152f6890c8590fbd0aa21dca4685a306", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["praisonai-cli", "1b9f714066ac18a38154657dab7bfbc93acd239cc782e55aa3498963539a4edd", "cliClosure", LIFECYCLE_REVIEWED_AT],
  ["tencent-codebuddy", "6ad755ad993612faf59d1beb5977edc81f01428fd97d2193ca8dfeefa007b33d", "desktopIdentityBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["tencent-ima", "51a914cb7e533d9ab669ab53898fd823e07e0fb40cb91c1659230291711ed013", "desktopIdentityBatchC", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["tencent-qclaw", "ef67effb7e65d24dc91d1448b214ef39f994ae764cf61c6a2207cb56262fe0e3", "desktopIdentityBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["tencent-workbuddy", "68dc01cb99cfb7e3993b20d1e8589a8aff07b59a4d96785fbdb6d6e908385eac", "desktopIdentityBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["tencent-yuanbao-desktop", "ddb9fc46273a400ceb633328fbf8a888f2bbaeca759655f12be60827b363cd4c", "desktopIdentityBatchB", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["trae-desktop", "7466ce97d539028bc3e7d98b8afda0c5403582beeb1f98f0c45a83fdf0397334", "desktopIdentityBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["trae-solo-cn", "2ac3e5492bae066ec495cac4a912f9cda3b14d43f92b643c64531079747d1e6f", "desktopIdentityBatchA", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["wispr-flow-desktop", "fa24a0d9ab42862396106ec36001da60f8b275383dc0effb032eb950d08bf9ed", "existingDesktopLifecycle", EXISTING_DESKTOP_LIFECYCLE_REVIEWED_AT],
  ["zed-editor", "4202d8f67b2f6b8bd90c523154f178d2dc83cbda3d0ab2601f92f6ce8373eeaf", "desktopBatchOne", LIFECYCLE_REVIEWED_AT],
  ["zeroclaw-cli", "92d175c1a3c5a7ab42668e436848de264b7ebbb9ef85b408db6c501785134246", "zeroIronClaw", CLI_ARTIFACT_REVIEWED_AT]
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
