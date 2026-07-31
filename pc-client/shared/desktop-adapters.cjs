"use strict";

const DESKTOP_ADAPTERS = Object.freeze({
  "appx.openai-codex": Object.freeze({
    names: Object.freeze(["ChatGPT", "OpenAI ChatGPT", "OpenAI.Codex"]),
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "automatic",
    signer: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i,
    appx: Object.freeze({
      identityName: "OpenAI.Codex",
      publisher: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i
    })
  }),
  "squirrel.anthropic-claude": Object.freeze({
    names: Object.freeze(["Claude", "Claude Desktop"]),
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "automatic",
    signer: /^CN="?Anthropic, PBC"?(?:,|$)/i,
    executableNames: Object.freeze(["Claude.exe"]),
    uninstall: Object.freeze({
      displayName:
        /^Claude(?:\s+\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
      publisher: /^Anthropic(?:,?\s+PBC)?$/i,
      executableName: /^Update\.exe$/i,
      allowedArguments: Object.freeze([
        Object.freeze(["--uninstall"]),
        Object.freeze(["--uninstall", "-s"])
      ]),
      allowMsi: false
    }),
    appx: Object.freeze({
      identityName: "Claude",
      publisher: /^CN="?Anthropic, PBC"?(?:,|$)/i
    })
  }),
  "nsis.comfy-desktop": Object.freeze({
    names: Object.freeze(["Comfy Desktop", "ComfyUI Desktop"]),
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "interactive",
    signer: /^CN=Drip Artificial Inc(?:,|$)/i,
    executableNames: Object.freeze([
      "Comfy Desktop.exe",
      "ComfyUI Desktop.exe",
      "ComfyUI.exe"
    ]),
    uninstall: Object.freeze({
      displayName:
        /^(?:ComfyUI|ComfyUI Desktop|Comfy Desktop)(?:\s+\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
      publisher: /^(?:Comfy Org|Drip Artificial(?: Intelligence, Inc\.)?)$/i,
      executableName:
        /^Uninstall (?:ComfyUI|ComfyUI Desktop|Comfy Desktop)\.exe$/i,
      allowedArguments: Object.freeze([
        Object.freeze([]),
        Object.freeze(["/currentuser"]),
        Object.freeze(["/allusers"])
      ]),
      allowMsi: false
    })
  }),
  "inno.ollama": Object.freeze({
    names: Object.freeze(["Ollama"]),
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "interactive",
    signer: /^CN=Ollama Inc\.(?:,|$)/i,
    executableNames: Object.freeze(["ollama app.exe"]),
    uninstall: Object.freeze({
      displayName:
        /^Ollama(?:\s+(?:version\s+)?\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
      publisher: /^Ollama(?:,? Inc\.?)?$/i,
      executableName: /^unins\d{3}\.exe$/i,
      allowedArguments: Object.freeze([
        Object.freeze([]),
        Object.freeze(["/SILENT"])
      ]),
      launchWithoutArguments: true,
      allowMsi: false
    })
  }),
  "registry.jianying": Object.freeze({
    names: Object.freeze(["剪映专业版", "CapCut"]),
    presenceEvidence: "discovery",
    uninstallMode: "interactive"
  })
});

const OFFICIAL_DESKTOP_ADAPTERS = Object.freeze({
  jianying: "registry.jianying"
});

function productDesktopAdapters() {
  const { INSTALL_REGISTRY } = require("./install-registry.cjs");
  return Object.freeze({
    ...Object.fromEntries(
      Object.entries(INSTALL_REGISTRY)
        .filter(([, registration]) => registration.desktopAdapterId)
        .map(([productId, registration]) => [
          productId,
          registration.desktopAdapterId
        ])
    ),
    ...OFFICIAL_DESKTOP_ADAPTERS
  });
}

function getDesktopAdapter(adapterId) {
  return DESKTOP_ADAPTERS[adapterId] || null;
}

function getDesktopAdapterForProduct(productId) {
  return getDesktopAdapter(productDesktopAdapters()[productId]);
}

function desktopProbes() {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(productDesktopAdapters()).map(([productId, adapterId]) => [
        productId,
        DESKTOP_ADAPTERS[adapterId]
      ])
    )
  );
}

module.exports = {
  DESKTOP_ADAPTERS,
  desktopProbes,
  getDesktopAdapter,
  getDesktopAdapterForProduct
};
