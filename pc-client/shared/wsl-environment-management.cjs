"use strict";

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\\/;
const DISTRIBUTION_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const MANAGED_PREFIX = /^\$HOME\/[A-Za-z0-9._/-]+$/;

const DEPENDENCIES = Object.freeze({
  node: Object.freeze({
    name: "Node.js",
    scope: "product-private",
    expectedVersion: (plan) => String(plan.nodeVersion || ""),
    command: (plan) =>
      `${plan.managedPrefix}/tools/node/bin/node`,
    versionArgument: "--version"
  }),
  npm: Object.freeze({
    name: "npm",
    scope: "product-private",
    expectedVersion: () => "",
    command: (plan) => `${plan.managedPrefix}/tools/node/bin/npm`,
    versionArgument: "--version"
  }),
  git: Object.freeze({
    name: "Git",
    scope: "distribution-shared",
    expectedVersion: () => "",
    command: () => "git",
    versionArgument: "--version"
  }),
  python: Object.freeze({
    name: "Python",
    scope: "distribution-shared",
    expectedVersion: () => "",
    command: () => "python3",
    versionArgument: "--version"
  })
});

function validPlan(plan) {
  return Boolean(
    plan &&
      plan.driver === "wsl-managed" &&
      DISTRIBUTION_NAME.test(String(plan.distribution || "")) &&
      MANAGED_PREFIX.test(String(plan.managedPrefix || "")) &&
      VERSION.test(String(plan.nodeVersion || "")) &&
      Array.isArray(plan.linuxDependencies) &&
      plan.linuxDependencies.every((id) => Object.hasOwn(DEPENDENCIES, id))
  );
}

function buildWslEnvironmentDefinitions({ productId, productName, plan }) {
  if (!validPlan(plan) || !productId) return [];
  return [...new Set(plan.linuxDependencies)].map((id) => {
    const dependency = DEPENDENCIES[id];
    return {
      id,
      name: dependency.name,
      expectedVersion: dependency.expectedVersion(plan),
      ownerProductId: String(productId),
      ownerProductName: String(productName || productId),
      scope: dependency.scope
    };
  });
}

function shellLiteral(value) {
  return `'${String(value).replaceAll("'", `'\"'\"'`)}'`;
}

function createWslEnvironmentProbeAction({
  wslExecutable,
  distribution,
  dependencyId,
  plan
}) {
  if (
    !WINDOWS_ABSOLUTE_PATH.test(String(wslExecutable || "")) ||
    !validPlan(plan) ||
    distribution !== plan.distribution ||
    !plan.linuxDependencies.includes(dependencyId)
  ) {
    return null;
  }
  const dependency = DEPENDENCIES[dependencyId];
  const command = dependency.command(plan);
  const script = [
    `candidate=${shellLiteral(command)}`,
    'if [ "${candidate#\$HOME/}" != "$candidate" ]; then candidate="$HOME/${candidate#\$HOME/}"; fi',
    'if [ -x "$candidate" ]; then executable="$candidate"; elif command -v "$candidate" >/dev/null 2>&1; then executable="$(command -v "$candidate")"; else exit 44; fi',
    `"$executable" ${dependency.versionArgument}`,
    'printf "%s\\n" "$executable"'
  ].join("; ");
  return {
    executable: wslExecutable,
    args: [
      "--distribution",
      distribution,
      "--",
      "/bin/sh",
      "-lc",
      script
    ],
    options: { windowsHide: true, shell: false }
  };
}

function normalizeVersion(value) {
  const match = String(value || "").match(/\d+(?:\.\d+){1,2}/);
  return match ? match[0] : "";
}

function parseWslEnvironmentProbe({
  definition,
  distribution,
  stdout,
  installed = true
}) {
  const lines = String(stdout || "")
    .replace(/\0/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    id: definition.id,
    name: definition.name,
    installed: installed && lines.length > 0,
    version: installed ? normalizeVersion(lines[0]) : "",
    location: installed ? String(lines[1] || "") : "",
    ownerProductId: definition.ownerProductId,
    ownerProductName: definition.ownerProductName,
    scope: definition.scope,
    canRepair: true
  };
}

function createWslPlatformUninstallAction({ wslExecutable }) {
  if (!WINDOWS_ABSOLUTE_PATH.test(String(wslExecutable || ""))) return null;
  return {
    executable: wslExecutable,
    args: ["--uninstall"],
    options: { windowsHide: true, shell: false }
  };
}

function wslPlatformManagementStatus(status) {
  return status?.installed === true
    ? { ...status, canUninstall: true }
    : status;
}

module.exports = {
  buildWslEnvironmentDefinitions,
  createWslEnvironmentProbeAction,
  createWslPlatformUninstallAction,
  parseWslEnvironmentProbe,
  wslPlatformManagementStatus
};
