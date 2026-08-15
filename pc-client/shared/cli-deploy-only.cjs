"use strict";

const {
  artifactFor,
  createManagedBinaryReceipt,
  createManagedBinaryTerminalAction,
  inspectManagedBinaryCli
} = require("./managed-binary-cli.cjs");

const MODULE_ID = "cli-deploy-only";
const CAPABILITIES = Object.freeze(["website", "tutorial", "install", "open"]);
const OPERATIONS = Object.freeze([
  "environment-check",
  "deploy",
  "recheck",
  "open-terminal"
]);
const BINDING_FIELDS = new Set(["productId", "moduleId", "installProfileId", "capabilities"]);

// This is intentionally a local, immutable execution profile.  Catalog data
// may select this identity, but can never provide its artifact or command.
const PROFILES = Object.freeze({
  "anytype-cli": Object.freeze({
    productId: "anytype-cli",
    vendorId: "anytype",
    profileId: "cli-deploy-only.anytype",
    label: "Anytype CLI",
    adapter: "portable-binary",
    requirements: Object.freeze([]),
    capabilities: CAPABILITIES,
    operations: OPERATIONS,
    cli: Object.freeze({
      name: "Anytype CLI",
      driver: "portable-binary",
      version: "0.3.6",
      commandName: "anytype",
      artifacts: Object.freeze({
        x64: Object.freeze({
          url: "https://github.com/anyproto/anytype-cli/releases/download/v0.3.6/anytype-cli-v0.3.6-windows-amd64.zip",
          fileName: "anytype-cli-v0.3.6-windows-amd64.zip",
          archiveEntry: "anytype.exe",
          sha256: "3aa8db0a02f9349164c1dacf5ede32e8a0b0cf966ced59cb37ff82e2605ab1be",
          expectedExecutableSha256: "8993ad652814450d603b6f5d3b4707fc4e3d99882d54ec9d8276e49638ef99f7",
          maximumBytes: 64 * 1024 * 1024,
          maximumExtractedBytes: 64 * 1024 * 1024,
          allowedHosts: Object.freeze(["github.com", "release-assets.githubusercontent.com"])
        })
      })
    })
  })
});

function getCliDeployOnlyProfile(productId) {
  return PROFILES[productId] || null;
}

function cliDeployOnlyPlans() {
  return Object.freeze(Object.fromEntries(Object.entries(PROFILES).map(([productId, profile]) => [
    productId,
    Object.freeze({ ...profile.cli, requirements: profile.requirements, deployOnlyProfileId: profile.profileId })
  ])));
}

function publicCliDeployOnlyProfiles() {
  return Object.freeze(Object.values(PROFILES).map((profile) => Object.freeze({
    id: profile.profileId,
    label: profile.label,
    moduleId: MODULE_ID,
    productId: profile.productId,
    vendorId: profile.vendorId,
    productType: "cli-deploy-only",
    kind: "CLI",
    mode: "managed-cli",
    requirements: profile.requirements,
    capabilities: profile.capabilities
  })));
}

function validateCliDeployOnlyBinding(binding) {
  if (!binding || typeof binding !== "object" || Array.isArray(binding) ||
      Object.keys(binding).some((key) => !BINDING_FIELDS.has(key))) return null;
  const profile = getCliDeployOnlyProfile(binding.productId);
  if (!profile || binding.moduleId !== MODULE_ID ||
      binding.installProfileId !== profile.profileId ||
      !Array.isArray(binding.capabilities) || binding.capabilities.length !== CAPABILITIES.length ||
      binding.capabilities.some((capability) => !CAPABILITIES.includes(capability))) return null;
  return Object.freeze({ productId: profile.productId, moduleId: MODULE_ID, installProfileId: profile.profileId, capabilities: CAPABILITIES });
}

function deployOnlyPlan(productId, architecture = "x64") {
  const profile = getCliDeployOnlyProfile(productId);
  return profile?.adapter === "portable-binary" && artifactFor(profile.cli, architecture)
    ? { profile, plan: { ...profile.cli, requirements: profile.requirements } }
    : null;
}

function createCliDeployOnlyReceipt({ productId, prefix, architecture, plan: _ignoredPlan, ...options }) {
  const prepared = deployOnlyPlan(productId, architecture);
  if (!prepared) return null;
  const receipt = createManagedBinaryReceipt({ productId, plan: prepared.plan, prefix, architecture, ...options });
  return receipt ? Object.freeze({ ...receipt, moduleId: MODULE_ID, installProfileId: prepared.profile.profileId }) : null;
}

function inspectCliDeployOnly({ productId, receipt, architecture, ...options }) {
  const prepared = deployOnlyPlan(productId, architecture);
  if (!prepared || receipt?.moduleId !== MODULE_ID || receipt?.installProfileId !== prepared.profile.profileId) return null;
  return inspectManagedBinaryCli({ productId, plan: prepared.plan, receipt, architecture, ...options });
}

function createCliDeployOnlyTerminalAction({ productId, receipt, architecture, ...options }) {
  const prepared = deployOnlyPlan(productId, architecture);
  const status = inspectCliDeployOnly({ productId, receipt, architecture, ...options });
  return prepared && status
    ? createManagedBinaryTerminalAction({ productId, plan: prepared.plan, status, commandExecutable: options.commandExecutable, fileSystem: options.fileSystem })
    : null;
}

module.exports = {
  CAPABILITIES,
  MODULE_ID,
  OPERATIONS,
  cliDeployOnlyPlans,
  createCliDeployOnlyReceipt,
  createCliDeployOnlyTerminalAction,
  deployOnlyPlan,
  getCliDeployOnlyProfile,
  inspectCliDeployOnly,
  publicCliDeployOnlyProfiles,
  validateCliDeployOnlyBinding
};
