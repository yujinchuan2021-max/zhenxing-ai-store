"use strict";

const { PYTHON_CLI_LOCKS } = require("./python-cli-locks.cjs");

const MANAGED_CAPABILITIES = Object.freeze([
  "website",
  "tutorial",
  "install",
  "open",
  "uninstall"
]);

function npmCli(entry) {
  return Object.freeze({
    ...entry,
    moduleId: "cli-managed",
    productType: "cli",
    kind: "CLI",
    capabilities: MANAGED_CAPABILITIES,
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
    capabilities: MANAGED_CAPABILITIES,
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
    capabilities: MANAGED_CAPABILITIES,
    requirements: Object.freeze([]),
    cli: Object.freeze({ ...entry.cli, driver: "managed-msi" })
  });
}

const WINDOWS_CLI_PRODUCTS = Object.freeze({
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
