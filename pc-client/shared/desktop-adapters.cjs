"use strict";

const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("./windows-desktop-catalog.cjs");
const { getDesktopLifecycle } = require("./desktop-lifecycle.cjs");

const CHATGPT_LIFECYCLE = getDesktopLifecycle("chatgpt-desktop");
const CLAUDE_LIFECYCLE = getDesktopLifecycle("claude-desktop");
const COMFY_LIFECYCLE = getDesktopLifecycle("comfy-desktop");
const OLLAMA_LIFECYCLE = getDesktopLifecycle("ollama-cli");

const DESKTOP_ADAPTERS = Object.freeze({
  "appx.openai-codex": Object.freeze({
    names: Object.freeze(["ChatGPT", "OpenAI ChatGPT", "OpenAI.Codex"]),
    installerIdentity: CHATGPT_LIFECYCLE.installerIdentity,
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "automatic",
    signer: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i,
    closeProcessNames: Object.freeze(["ChatGPT.exe"]),
    appx: Object.freeze({
      identityName: CHATGPT_LIFECYCLE.installerIdentity.packageIdentityName,
      packageFamilyName:
        CHATGPT_LIFECYCLE.installerIdentity.packageFamilyName,
      storeProductId: CHATGPT_LIFECYCLE.installerIdentity.storeProductId,
      publisher: /^CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B$/i
    })
  }),
  "squirrel.anthropic-claude": Object.freeze({
    names: Object.freeze(["Claude", "Claude Desktop"]),
    installerIdentity: CLAUDE_LIFECYCLE.installerIdentity,
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "interactive",
    signer: /^CN="?Anthropic, PBC"?(?:,|$)/i,
    closeProcessNames: Object.freeze(["Claude.exe"]),
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
      launchArguments: Object.freeze(["--uninstall"]),
      allowMsi: false
    }),
    appx: Object.freeze({
      identityName: CLAUDE_LIFECYCLE.installerIdentity.appxIdentityName,
      uninstallStrategy: "windows-settings",
      publisher: /^CN="?Anthropic, PBC"?(?:,|$)/i
    })
  }),
  "nsis.comfy-desktop": Object.freeze({
    names: Object.freeze(["Comfy Desktop"]),
    installerIdentity: COMFY_LIFECYCLE.installerIdentity,
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "interactive",
    signer: /^CN=Drip Artificial Inc(?:,|$)/i,
    closeProcessNames: Object.freeze(["Comfy Desktop.exe"]),
    executableNames: Object.freeze(["Comfy Desktop.exe"]),
    uninstall: Object.freeze({
      displayName:
        /^Comfy Desktop(?:\s+\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
      publisher: /^(?:Comfy Org|Drip Artificial(?: Intelligence, Inc\.)?)$/i,
      executableName: /^Uninstall Comfy Desktop\.exe$/i,
      allowedArguments: Object.freeze([
        Object.freeze([]),
        Object.freeze(["/currentuser"]),
        Object.freeze(["/allusers"])
      ]),
      allowMsi: false
    }),
    legacyInstall: Object.freeze({
      id: "comfy-desktop-v1",
      names: Object.freeze(["ComfyUI Desktop", "ComfyUI Desktop V1"]),
      executableNames: Object.freeze([
        "ComfyUI Desktop.exe",
        "ComfyUI.exe"
      ]),
      uninstall: Object.freeze({
        displayName:
          /^(?:ComfyUI|ComfyUI Desktop(?: V1)?|Comfy Desktop)(?:\s+\d+(?:\.\d+){1,3}(?:[-+][0-9a-z.-]+)?)?$/i,
        publisher: /^(?:Comfy Org|Drip Artificial(?: Intelligence, Inc\.)?)$/i,
        executableName: /^Uninstall (?:ComfyUI|ComfyUI Desktop)\.exe$/i,
        allowedArguments: Object.freeze([
          Object.freeze([]),
          Object.freeze(["/currentuser"]),
          Object.freeze(["/allusers"])
        ]),
        allowMsi: false
      })
    })
  }),
  "inno.ollama": Object.freeze({
    names: Object.freeze(["Ollama"]),
    installerIdentity: OLLAMA_LIFECYCLE.installerIdentity,
    presenceEvidence: "trusted-install-identity",
    uninstallMode: "interactive",
    signer: /^CN=Ollama Inc\.(?:,|$)/i,
    closeProcessNames: Object.freeze(["ollama app.exe"]),
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
  ...Object.fromEntries(
    Object.values(WINDOWS_DESKTOP_PRODUCTS).map((product) => [
      product.adapterId,
      product.adapter
    ])
  )
});

const OFFICIAL_DESKTOP_ADAPTERS = Object.freeze({});

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
