"use strict";

const { PYTHON_CLI_LOCKS } = require("./python-cli-locks.cjs");
const PYTHON_CLI_LOCK_EXPANSION = require("./python-cli-locks-expansion.json");

const MANAGED_CAPABILITIES = Object.freeze([
  "website",
  "tutorial",
  "install",
  "open",
  "uninstall"
]);

const NPM_MANAGED_CAPABILITIES = Object.freeze([
  "website",
  "tutorial",
  "install",
  "update",
  "repair",
  "open",
  "uninstall"
]);

const RECONCILE_MANAGED_CAPABILITIES = NPM_MANAGED_CAPABILITIES;

function npmCli(entry) {
  return Object.freeze({
    ...entry,
    moduleId: "cli-managed",
    productType: "cli",
    kind: "CLI",
    capabilities: NPM_MANAGED_CAPABILITIES,
    requirements: Object.freeze(entry.requirements || ["node"]),
    cli: Object.freeze({ ...entry.cli, driver: "npm" })
  });
}

function pythonCli(entry) {
  return Object.freeze({
    ...entry,
    moduleId: "cli-managed",
    productType: "cli",
    kind: "CLI",
    capabilities: RECONCILE_MANAGED_CAPABILITIES,
    requirements: Object.freeze(entry.requirements || ["python"]),
    cli: Object.freeze({ ...entry.cli, driver: "python-venv" })
  });
}

function msiCli(entry) {
  return Object.freeze({
    ...entry,
    moduleId: "cli-managed",
    productType: "cli",
    kind: "CLI",
    capabilities: RECONCILE_MANAGED_CAPABILITIES,
    requirements: Object.freeze([]),
    cli: Object.freeze({ ...entry.cli, driver: "managed-msi" })
  });
}

function binaryCli(entry) {
  return Object.freeze({
    ...entry,
    moduleId: "cli-managed",
    productType: "cli",
    kind: "CLI",
    capabilities: RECONCILE_MANAGED_CAPABILITIES,
    requirements: Object.freeze([]),
    cli: Object.freeze({ ...entry.cli, driver: "portable-binary" })
  });
}

const WINDOWS_CLI_PRODUCTS = Object.freeze({
  "bytedance-agent-tars-cli": npmCli({
    label: "Agent TARS CLI",
    profileId: "cli.agent-tars",
    vendorId: "bytedance",
    requirements: ["node"],
    cli: {
      name: "Agent TARS CLI",
      packageName: "@agent-tars/cli",
      expectedVersion: "0.3.0",
      installSpec: "@agent-tars/cli@0.3.0",
      supportedNodeRanges: [
        { minimum: "22.15.0", maximumExclusive: "999.0.0" }
      ],
      commandName: "agent-tars"
    }
  }),
  "alibaba-qwen-code": npmCli({
    label: "Qwen Code",
    profileId: "cli.qwen-code",
    vendorId: "alibaba",
    requirements: ["node"],
    cli: {
      name: "Qwen Code",
      packageName: "@qwen-code/qwen-code",
      expectedVersion: "0.21.2",
      installSpec: "@qwen-code/qwen-code@0.21.2",
      minimumNodeMajor: 22,
      commandName: "qwen"
    }
  }),
  "github-copilot-cli": npmCli({
    label: "GitHub Copilot CLI",
    profileId: "cli.github-copilot",
    vendorId: "github",
    requirements: ["node"],
    cli: {
      name: "GitHub Copilot CLI",
      packageName: "@github/copilot",
      expectedVersion: "1.0.77",
      installSpec: "@github/copilot@1.0.77",
      minimumNodeMajor: 22,
      commandName: "copilot"
    }
  }),
  "minimax-cli": npmCli({
    label: "MiniMax CLI",
    profileId: "cli.minimax",
    vendorId: "minimax",
    requirements: ["node"],
    cli: {
      name: "MiniMax CLI",
      packageName: "mmx-cli",
      expectedVersion: "1.0.18",
      installSpec: "mmx-cli@1.0.18",
      minimumNodeMajor: 18,
      commandName: "mmx"
    }
  }),
  "promptfoo-cli": npmCli({
    label: "Promptfoo CLI",
    profileId: "cli.promptfoo",
    vendorId: "promptfoo",
    requirements: ["node"],
    cli: {
      name: "Promptfoo CLI",
      packageName: "promptfoo",
      expectedVersion: "0.121.20",
      installSpec: "promptfoo@0.121.20",
      supportedNodeRanges: [
        { minimum: "22.22.0", maximumExclusive: "999.0.0" }
      ],
      commandName: "promptfoo"
    }
  }),
  "continue-cli": npmCli({
    label: "Continue CLI",
    profileId: "cli.continue",
    vendorId: "continue",
    requirements: ["node"],
    cli: {
      name: "Continue CLI",
      packageName: "@continuedev/cli",
      expectedVersion: "1.5.47",
      installSpec: "@continuedev/cli@1.5.47",
      minimumNodeMajor: 20,
      commandName: "cn"
    }
  }),
  "ruflo-cli": npmCli({
    label: "Ruflo CLI",
    profileId: "cli.ruflo",
    vendorId: "ruvnet",
    requirements: ["node", "git"],
    cli: {
      name: "Ruflo CLI",
      packageName: "ruflo",
      expectedVersion: "3.34.0",
      installSpec: "ruflo@3.34.0",
      minimumNodeMajor: 20,
      commandName: "ruflo"
    }
  }),
  "factory-cli": npmCli({
    label: "Factory CLI",
    profileId: "cli.factory",
    vendorId: "factory-ai",
    requirements: ["node"],
    cli: {
      name: "Factory CLI",
      packageName: "droid",
      expectedVersion: "0.186.0",
      installSpec: "droid@0.186.0",
      minimumNodeMajor: 20,
      commandName: "droid"
    }
  }),
  "kilo-code-cli": npmCli({
    label: "Kilo Code CLI",
    profileId: "cli.kilo-code",
    vendorId: "kilo",
    requirements: ["node"],
    cli: {
      name: "Kilo Code CLI",
      packageName: "@kilocode/cli",
      expectedVersion: "7.4.17",
      installSpec: "@kilocode/cli@7.4.17",
      minimumNodeMajor: 20,
      commandName: "kilo"
    }
  }),
  "letta-code-cli": npmCli({
    label: "Letta Code CLI",
    profileId: "cli.letta-code",
    vendorId: "letta",
    requirements: ["node"],
    cli: {
      name: "Letta Code CLI",
      packageName: "@letta-ai/letta-code",
      expectedVersion: "0.30.3",
      installSpec: "@letta-ai/letta-code@0.30.3",
      supportedNodeRanges: [
        { minimum: "22.19.0", maximumExclusive: "999.0.0" }
      ],
      commandName: "letta"
    }
  }),
  "pixverse-cli": npmCli({
    label: "PixVerse CLI",
    profileId: "cli.pixverse",
    vendorId: "pixverse",
    requirements: ["node"],
    cli: {
      name: "PixVerse CLI",
      packageName: "pixverse",
      expectedVersion: "1.2.12",
      installSpec: "pixverse@1.2.12",
      minimumNodeMajor: 20,
      commandName: "pixverse"
    }
  }),
  "alibaba-qoder-cn-cli": npmCli({
    label: "Qoder CN CLI",
    profileId: "cli.qoder-cn",
    vendorId: "alibaba",
    requirements: ["node"],
    cli: {
      name: "Qoder CN CLI",
      packageName: "@qodercn-ai/qoderclicn",
      expectedVersion: "1.1.12",
      installSpec: "@qodercn-ai/qoderclicn@1.1.12",
      minimumNodeMajor: 20,
      commandName: "qoderclicn",
      managedSettings: {
        relativePath: [".qoder-cn.json"],
        values: { autoUpdates: false }
      }
    }
  }),
  "amp-cli": binaryCli({
    label: "Amp CLI",
    profileId: "cli.amp",
    vendorId: "amp",
    cli: {
      name: "Amp CLI",
      version: "0.0.1785761938-g468e20",
      commandName: "amp",
      artifacts: {
        x64: {
          url: "https://static.ampcode.com/cli/0.0.1785761938-g468e20/amp-windows-x64-baseline.exe",
          fileName: "amp.exe",
          sha256: "a99983db7f49190ae0fa08b6bb939476175127b82ecc0c4d3ea96301109644ea",
          maximumBytes: 512 * 1024 * 1024,
          allowedHosts: ["static.ampcode.com"]
        }
      }
    }
  }),
  "daytona-cli": binaryCli({
    label: "Daytona CLI",
    profileId: "cli.daytona",
    vendorId: "daytona",
    cli: {
      name: "Daytona CLI",
      version: "0.190.0",
      commandName: "daytona",
      artifacts: {
        x64: {
          url: "https://github.com/daytonaio/daytona/releases/download/v0.190.0/daytona-windows-amd64.exe",
          fileName: "daytona.exe",
          sha256: "2ce3fb2d87e99a279bd61a383472db612c81747bb75a17a4c06deef45a3830f1",
          maximumBytes: 512 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        },
        arm64: {
          url: "https://github.com/daytonaio/daytona/releases/download/v0.190.0/daytona-windows-arm64.exe",
          fileName: "daytona.exe",
          sha256: "2438760ea4008262db65d003639e182b5882fdb875e51a9089a39a6b078a87bf",
          maximumBytes: 512 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        }
      }
    }
  }),
  "openfang-cli": binaryCli({
    label: "OpenFang",
    profileId: "cli.openfang",
    vendorId: "rightnow-ai",
    cli: {
      name: "OpenFang",
      version: "0.6.9",
      commandName: "openfang",
      launchArgs: ["init"],
      artifacts: {
        x64: {
          url: "https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-x86_64-pc-windows-msvc.zip",
          fileName: "openfang-x86_64-pc-windows-msvc.zip",
          archiveEntry: "openfang.exe",
          sha256: "18f5a8f6b563304749ce07444de8ca901fccb45e06a2e5a074fbbfbec037dc9f",
          expectedExecutableSha256: "3104389ca4809431b0fd6e6aaf1bcef6a8774bea5ac0e598bc707bf6daee214d",
          maximumBytes: 64 * 1024 * 1024,
          maximumExtractedBytes: 96 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        },
        arm64: {
          url: "https://github.com/RightNow-AI/openfang/releases/download/v0.6.9/openfang-aarch64-pc-windows-msvc.zip",
          fileName: "openfang-aarch64-pc-windows-msvc.zip",
          archiveEntry: "openfang.exe",
          sha256: "0c9b59460e94202583af973cd21be8d2ec864f94d90b05d0ab1fc948b3cd7f63",
          expectedExecutableSha256: "a4141d75f773413b23f6e8974e02eb68b25c1e449adbc70c25ca8ab1ad16d71c",
          maximumBytes: 64 * 1024 * 1024,
          maximumExtractedBytes: 96 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        }
      }
    }
  }),
  "zeroclaw-cli": binaryCli({
    label: "ZeroClaw",
    profileId: "cli.zeroclaw",
    vendorId: "zeroclaw-labs",
    cli: {
      name: "ZeroClaw",
      version: "0.8.4",
      commandName: "zeroclaw",
      launchArgs: ["quickstart"],
      artifacts: {
        x64: {
          url: "https://github.com/zeroclaw-labs/zeroclaw/releases/download/v0.8.4/zeroclaw-x86_64-pc-windows-msvc.zip",
          fileName: "zeroclaw-x86_64-pc-windows-msvc.zip",
          archiveKind: "directory",
          executableRelativePath: "zeroclaw.exe",
          sha256: "de17681f981b4bd7e1fa2c493924e2a9df60825932ec0f99a3fb647f2a3242c3",
          expectedExecutableSha256: "5d59b2e603daf1ff2430d5f94cce2a57a82487e6d64b60c0bdd9dcc03cdeb62a",
          maximumBytes: 64 * 1024 * 1024,
          maximumArchiveEntries: 100,
          maximumExtractedBytes: 256 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        }
      }
    }
  }),
  "open-interpreter-cli": binaryCli({
    label: "Open Interpreter CLI",
    profileId: "cli.open-interpreter",
    vendorId: "open-interpreter",
    cli: {
      name: "Open Interpreter CLI",
      version: "0.0.34",
      commandName: "interpreter",
      launchArgs: ["-c", "check_for_update_on_startup=false"],
      artifacts: {
        x64: {
          url: "https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-x86_64-pc-windows-msvc.tar.gz",
          fileName: "open-interpreter-package-x86_64-pc-windows-msvc.tar.gz",
          archiveKind: "directory",
          executableRelativePath: "bin\\interpreter.exe",
          sha256: "c87adf4f85ef6a2eb36135ce8f583257a590a6e7e460de5ab9832cdde3187e4e",
          expectedExecutableSha256: "9cd0f4714c1e5f73012dc53f516fe473c5da05914c26b5e1c41a9a2a0cee2cb7",
          maximumBytes: 320 * 1024 * 1024,
          maximumArchiveEntries: 16,
          maximumExtractedBytes: 896 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        },
        arm64: {
          url: "https://github.com/openinterpreter/openinterpreter/releases/download/rust-v0.0.34/open-interpreter-package-aarch64-pc-windows-msvc.tar.gz",
          fileName: "open-interpreter-package-aarch64-pc-windows-msvc.tar.gz",
          archiveKind: "directory",
          executableRelativePath: "bin\\interpreter.exe",
          sha256: "9e9f3a016cbfb627552291ea6e2900bc3b94859add976295edb62a452236abc1",
          expectedExecutableSha256: "9eb92382748d59976b963f2ef9df1e3a54b18a0d7cdf6cefd1e91231701a512",
          maximumBytes: 320 * 1024 * 1024,
          maximumArchiveEntries: 16,
          maximumExtractedBytes: 896 * 1024 * 1024,
          allowedHosts: ["github.com", "release-assets.githubusercontent.com"]
        }
      }
    }
  }),
  "deepgram-cli": pythonCli({
    label: "Deepgram CLI",
    profileId: "cli.deepgram",
    vendorId: "deepgram",
    requirements: ["python"],
    cli: {
      name: "Deepgram CLI",
      distributionName: "deepctl",
      version: "0.2.26",
      commandName: "dg",
      minimumPythonMinor: 13,
      maximumPythonMinor: 13,
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCK_EXPANSION.deepgram,
      wheel: {
        url: "https://files.pythonhosted.org/packages/8d/c4/84e7bd0e872468ab132ed5315af39cedc79591cd1ee51b50d21126c4cd43/deepctl-0.2.26-py3-none-any.whl",
        sha256: "3ab011df5650e558fe99657420258de352052627b46ccb813dd4b53162bdfdd9"
      }
    }
  }),
  "hkuds-nanobot-cli": pythonCli({
    label: "nanobot",
    profileId: "cli.nanobot",
    vendorId: "hkuds",
    requirements: ["python"],
    cli: {
      name: "nanobot",
      distributionName: "nanobot-ai",
      version: "0.3.0",
      commandName: "nanobot",
      minimumPythonMinor: 13,
      maximumPythonMinor: 13,
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCK_EXPANSION.nanobot,
      wheel: {
        url: "https://files.pythonhosted.org/packages/f6/66/27c946147a2e9d0f2e00507e475edcb19a73d09e3061dbd4ef05059f7cdf/nanobot_ai-0.3.0-py3-none-any.whl",
        sha256: "fb24fa5754661a2704d3b04f592ca7536be83caff062ef2b47989e867129cbe0"
      }
    }
  }),
  "praisonai-cli": pythonCli({
    label: "PraisonAI CLI",
    profileId: "cli.praisonai",
    vendorId: "praisonai",
    requirements: ["python"],
    cli: {
      name: "PraisonAI CLI",
      distributionName: "praisonai",
      version: "4.6.159",
      commandName: "praisonai",
      minimumPythonMinor: 13,
      maximumPythonMinor: 13,
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCK_EXPANSION.praisonai,
      wheel: {
        url: "https://files.pythonhosted.org/packages/66/31/6e9addd898dcd699851f63ad9358a39abda442de92a9e0e314e5ad1bc49d/praisonai-4.6.159-py3-none-any.whl",
        sha256: "767fa303f71bc4a34a08f99c619769c701a893e32406791dd09d1ca782841e95"
      }
    }
  }),
  "aider-cli": pythonCli({
    label: "Aider CLI",
    profileId: "cli.aider",
    vendorId: "aider",
    requirements: ["python312", "git"],
    cli: {
      name: "Aider CLI",
      distributionName: "aider-chat",
      version: "0.86.2",
      commandName: "aider",
      minimumPythonMinor: 12,
      maximumPythonMinor: 12,
      pythonEnvironmentId: "python312",
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCK_EXPANSION.aider,
      wheel: {
        url: "https://files.pythonhosted.org/packages/75/f7/e20749d9a510673e7adf910b005e3efe4ceaf9c194f1dd40d6931a3f34b9/aider_chat-0.86.2-py3-none-any.whl",
        sha256: "64f6a0c66c9f4633ad9f479bca3e64ebcba02b9da03c6b604b74a44736b2416e"
      }
    }
  }),
  "comfy-cli": pythonCli({
    label: "Comfy CLI",
    profileId: "cli.comfy",
    vendorId: "comfy",
    requirements: ["python"],
    cli: {
      name: "Comfy CLI",
      distributionName: "comfy-cli",
      version: "1.13.0",
      commandName: "comfy",
      minimumPythonMinor: 13,
      maximumPythonMinor: 13,
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCKS.comfy,
      wheel: {
        url: "https://files.pythonhosted.org/packages/99/94/a26ecdbae09270083b53ef6cfd94329a247bba3ec78ba03bc17794a5f4fc/comfy_cli-1.13.0-py3-none-any.whl",
        sha256: "190108e4fa4fba44916f12eedbaca9ea685c2f9924c4370210092ccd17e6e5a8"
      }
    }
  }),
  "hf-cli": pythonCli({
    label: "Hugging Face CLI",
    profileId: "cli.hugging-face",
    vendorId: "huggingface",
    requirements: ["python"],
    cli: {
      name: "Hugging Face CLI",
      distributionName: "huggingface-hub",
      version: "1.26.0",
      commandName: "hf",
      minimumPythonMinor: 13,
      maximumPythonMinor: 13,
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCKS.huggingFace,
      wheel: {
        url: "https://files.pythonhosted.org/packages/97/bb/63a644c75b545f3ff394b822e9bd1c4a9586489c618b77a4d8a44a33a23b/huggingface_hub-1.26.0-py3-none-any.whl",
        sha256: "e8cca670caa5d8dfa7e45bf45e86b466698198cd8150c021bcdb4a86b9252364"
      },
      managedEnvironment: {
        HF_HUB_DISABLE_UPDATE_CHECK: "1"
      }
    }
  }),
  "mistral-vibe-code-cli": pythonCli({
    label: "Mistral Vibe CLI",
    profileId: "cli.mistral-vibe",
    vendorId: "mistral",
    requirements: ["python"],
    cli: {
      name: "Mistral Vibe CLI",
      distributionName: "mistral-vibe",
      version: "2.23.2",
      commandName: "vibe",
      minimumPythonMinor: 13,
      maximumPythonMinor: 13,
      architecture: "x64",
      lockedRequirements: PYTHON_CLI_LOCKS.mistralVibe,
      wheel: {
        url: "https://files.pythonhosted.org/packages/0c/a0/a0d3917565a3e9146563764432307d59c6cf2611876db9ac195160ab9143/mistral_vibe-2.23.2-py3-none-any.whl",
        sha256: "84e5dce6c405d9e0ce0d38dede1565c792ff573225fc6d864a3366048f05261f"
      }
    }
  }),
  "ironclaw-cli": msiCli({
    label: "IronClaw",
    profileId: "cli.ironclaw",
    vendorId: "near-ai",
    cli: {
      name: "IronClaw",
      version: "1.0.0",
      commandName: "ironclaw",
      architecture: "x64",
      productCode: "{EA0E6381-0636-4283-8842-704A4312588F}",
      installDirectory: "%PROGRAMFILES%\\ironclaw",
      executableFile: "bin\\ironclaw.exe",
      installUi: "interactive",
      uninstallUi: "interactive",
      launchArgs: ["onboard"],
      artifact: {
        url: "https://github.com/nearai/ironclaw/releases/download/ironclaw-v1.0.0/ironclaw-x86_64-pc-windows-msvc.msi",
        fileName: "ironclaw-x86_64-pc-windows-msvc.msi",
        sha256: "a1b9af9ae890ae2c5b6875ddd4a8267129abc7a8803a6d315482f28e109a64dd",
        maximumBytes: 96 * 1024 * 1024,
        allowedHosts: ["github.com", "release-assets.githubusercontent.com"],
        signaturePolicy: "pinned-unsigned"
      }
    }
  }),
  "amazon-kiro-cli": msiCli({
    label: "Kiro CLI",
    profileId: "cli.kiro",
    vendorId: "amazon",
    cli: {
      name: "Kiro CLI",
      version: "2.16.0",
      commandName: "kiro-cli",
      architecture: "x64",
      productCode: "{836D0F5A-6C4F-455C-8181-8C225DF6C1F7}",
      installDirectory: "%LOCALAPPDATA%\\Kiro-Cli",
      executableFile: "kiro-cli.exe",
      artifact: {
        url: "https://prod.download.cli.kiro.dev/stable/2.16.0/kiro-cli-x86_64-pc-windows-msvc.msi",
        fileName: "kiro-cli-2.16.0-x64.msi",
        sha256: "923ae05cf3ca93abc26b27d35e10f272c5aad57aa895ab18855865b1fec874d5",
        maximumBytes: 300 * 1024 * 1024,
        allowedHosts: ["prod.download.cli.kiro.dev"],
        expectedSigner: "Amazon Web Services, Inc."
      },
      postInstallArgs: ["settings", "app.disableAutoupdates", "true"]
    }
  })
});

module.exports = { WINDOWS_CLI_PRODUCTS };
