"use strict";

const path = require("node:path");

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const VERSION = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/;
const COMMAND = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const DISTRIBUTION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SAFE_ARGUMENT = /^(?:--?[A-Za-z0-9][A-Za-z0-9-]*|[A-Za-z0-9][A-Za-z0-9._+@/:-]{0,127})$/;
const MANAGED_PREFIX = /^\$HOME\/\.[a-z0-9][a-z0-9._-]{0,63}$/i;
const NPM_PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const SCRIPT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.sh$/;
const PACKAGED_SCRIPT = /^managed-wsl-scripts\/[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.sh$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MANAGEMENT_ID = /^[a-f0-9]{48}$/;
const OWNERSHIP_MARKER = ".aihub-owner";
const REBUILD_OWNED_PREFIX = "rebuild-owned-prefix";
const BOOTSTRAP_PACKAGES = new Set(["ca-certificates", "curl", "git", "xz-utils"]);

function localWindowsExecutable(value, expectedName) {
  if (typeof value !== "string" || !path.win32.isAbsolute(value) || value.startsWith("\\\\")) return "";
  const normalized = path.win32.normalize(value);
  return path.win32.basename(normalized).toLowerCase() === expectedName.toLowerCase()
    ? normalized
    : "";
}

function validArguments(value) {
  return Array.isArray(value) && value.every((argument) => SAFE_ARGUMENT.test(String(argument || "")));
}

function validBootstrapPackages(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= BOOTSTRAP_PACKAGES.size &&
    new Set(value).size === value.length &&
    value.every((packageName) => BOOTSTRAP_PACKAGES.has(packageName))
  );
}

function validPlan(plan) {
  if (
    plan?.driver !== "wsl-managed" ||
    !DISTRIBUTION.test(String(plan.distribution || "")) ||
    !VERSION.test(String(plan.version || "")) ||
    !VERSION.test(String(plan.nodeVersion || "")) ||
    !COMMAND.test(String(plan.commandName || "")) ||
    !MANAGED_PREFIX.test(String(plan.managedPrefix || "")) ||
    !NPM_PACKAGE.test(String(plan.packageName || "")) ||
    !validBootstrapPackages(plan.bootstrapPackages) ||
    !validArguments(plan.installArguments) ||
    !validArguments(plan.launchArguments || []) ||
    !validArguments(plan.serviceUninstallArguments || [])
  ) return false;
  return Boolean(managedWslArtifactUnchecked(plan));
}

function managedWslArtifactUnchecked(plan) {
  const artifact = plan?.installScript;
  if (
    !artifact ||
    !SCRIPT_NAME.test(String(artifact.fileName || "")) ||
    !SHA256.test(String(artifact.sha256 || "")) ||
    !Number.isSafeInteger(artifact.maximumBytes) ||
    artifact.maximumBytes < 1024 ||
    artifact.maximumBytes > 4 * 1024 * 1024
  ) return null;
  if (artifact.source === "packaged") {
    if (
      typeof artifact.relativePath !== "string" ||
      !PACKAGED_SCRIPT.test(artifact.relativePath) ||
      path.posix.basename(artifact.relativePath) !== artifact.fileName ||
      artifact.url !== undefined ||
      artifact.allowedHosts !== undefined
    ) return null;
    return {
      source: "packaged",
      relativePath: artifact.relativePath,
      fileName: artifact.fileName,
      sha256: artifact.sha256,
      maximumBytes: artifact.maximumBytes
    };
  }
  if (
    (artifact.source !== undefined && artifact.source !== "remote") ||
    !Array.isArray(artifact.allowedHosts) ||
    !artifact.allowedHosts.length ||
    artifact.allowedHosts.some((host) => typeof host !== "string" || host !== host.toLowerCase())
  ) return null;
  try {
    const url = new URL(artifact.url);
    if (
      url.protocol !== "https:" || url.username || url.password || url.hash ||
      !artifact.allowedHosts.includes(url.hostname.toLowerCase())
    ) return null;
  } catch {
    return null;
  }
  return {
    url: artifact.url,
    fileName: artifact.fileName,
    sha256: artifact.sha256,
    maximumBytes: artifact.maximumBytes,
    allowedHosts: [...artifact.allowedHosts]
  };
}

function managedWslArtifact(plan) {
  const artifact = managedWslArtifactUnchecked(plan);
  return artifact && validPlanWithoutArtifactRecursion(plan) ? artifact : null;
}

function validPlanWithoutArtifactRecursion(plan) {
  return Boolean(
    plan?.driver === "wsl-managed" &&
    DISTRIBUTION.test(String(plan.distribution || "")) &&
    VERSION.test(String(plan.version || "")) &&
    VERSION.test(String(plan.nodeVersion || "")) &&
    COMMAND.test(String(plan.commandName || "")) &&
    MANAGED_PREFIX.test(String(plan.managedPrefix || "")) &&
    NPM_PACKAGE.test(String(plan.packageName || "")) &&
    validBootstrapPackages(plan.bootstrapPackages) &&
    validArguments(plan.installArguments) &&
    validArguments(plan.launchArguments || []) &&
    validArguments(plan.serviceUninstallArguments || [])
  );
}

function windowsPathToWslMount(value) {
  if (typeof value !== "string" || value.startsWith("\\\\")) return "";
  const normalized = path.win32.normalize(value);
  const match = /^([A-Za-z]):\\(.+)$/.exec(normalized);
  if (!match || normalized.split("\\").includes("..")) return "";
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function shellArguments(values) {
  return values.map((value) => String(value)).join(" ");
}

function createManagedWslDistributionAction({ plan, wslExecutable }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  if (!validPlan(plan) || !executable) return null;
  return {
    executable,
    args: ["--install", "--distribution", plan.distribution, "--no-launch"],
    options: { windowsHide: false, shell: false }
  };
}

function createManagedWslBootstrapAction({ plan, wslExecutable }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  if (!validPlan(plan) || !executable) return null;
  const packages = plan.bootstrapPackages.join(" ");
  const script = [
    "set -eu",
    "command -v apt-get >/dev/null 2>&1",
    "export DEBIAN_FRONTEND=noninteractive",
    "apt-get update -y",
    `apt-get install -y --no-install-recommends ${packages}`
  ].join(" && ");
  return {
    executable,
    args: [
      "--distribution",
      plan.distribution,
      "--user",
      "root",
      "--exec",
      "/bin/sh",
      "-lc",
      script
    ],
    options: { windowsHide: true, shell: false }
  };
}

function createManagedWslInstallPreflightAction({ plan, wslExecutable }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  if (!validPlan(plan) || !executable) return null;
  return {
    executable,
    args: [
      "--distribution", plan.distribution, "--exec", "bash", "-lc",
      `prefix="${plan.managedPrefix}" && [ ! -e "$prefix" ] && [ ! -L "$prefix" ]`
    ],
    options: { windowsHide: true, shell: false }
  };
}

function createManagedWslDeployAction({ productId, plan, wslExecutable, scriptWindowsPath, managementId }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  const script = windowsPathToWslMount(scriptWindowsPath);
  if (
    !PRODUCT_ID.test(String(productId || "")) ||
    !validPlan(plan) ||
    !executable ||
    !script ||
    !MANAGEMENT_ID.test(String(managementId || ""))
  ) return null;
  return {
    executable,
    args: [
      "--distribution", plan.distribution, "--exec", "bash", script,
      ...plan.installArguments,
      "--management-id", managementId
    ],
    options: { windowsHide: true, shell: false }
  };
}

function createManagedWslUpdateAction({ productId, plan, receipt, wslExecutable, scriptWindowsPath }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  const script = windowsPathToWslMount(scriptWindowsPath);
  if (!validPlan(plan) || !executable || !script || !managedWslReceiptOwnsPrefix(receipt, productId, plan)) return null;
  return {
    executable,
    args: [
      "--distribution", plan.distribution, "--exec", "bash", script,
      ...plan.installArguments,
      "--update", "--management-id", receipt.managementId
    ],
    options: { windowsHide: true, shell: false }
  };
}

function createManagedWslRepairAction({ productId, plan, receipt, wslExecutable, scriptWindowsPath }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  const script = windowsPathToWslMount(scriptWindowsPath);
  if (
    !validPlan(plan) ||
    plan.repairStrategy !== REBUILD_OWNED_PREFIX ||
    !executable ||
    !script ||
    !receiptMatches(receipt, productId, plan)
  ) return null;
  return {
    executable,
    args: [
      "--distribution", plan.distribution, "--exec", "bash", script,
      ...plan.installArguments,
      "--repair", "--management-id", receipt.managementId
    ],
    options: { windowsHide: true, shell: false }
  };
}

function managedOwnershipGuard(productId, plan, receipt, requireCommand = true) {
  if (!managedWslReceiptOwnsPrefix(receipt, productId, plan)) return "";
  const suffix = plan.managedPrefix.slice("$HOME/".length);
  const checks = [
    "set -eu",
    `prefix="${plan.managedPrefix}"`,
    `marker="$prefix/${OWNERSHIP_MARKER}"`,
    `command="$prefix/bin/${plan.commandName}"`,
    'home_real="$(realpath -e -- "$HOME")"',
    '[ -d "$prefix" ]',
    '[ ! -L "$prefix" ]',
    'prefix_real="$(realpath -e -- "$prefix")"',
    `[ "$prefix_real" = "$home_real/${suffix}" ]`,
    '[ -f "$marker" ]',
    '[ ! -L "$marker" ]',
    'marker_real="$(realpath -e -- "$marker")"',
    `[ "$marker_real" = "$prefix_real/${OWNERSHIP_MARKER}" ]`,
    `[ "$(cat -- "$marker")" = "${receipt.managementId}" ]`
  ];
  if (requireCommand) checks.push(
    '[ -f "$command" ]',
    '[ -x "$command" ]',
    '[ ! -L "$command" ]',
    'command_real="$(realpath -e -- "$command")"',
    `[ "$command_real" = "$prefix_real/bin/${plan.commandName}" ]`
  );
  return checks.join(" && ");
}

function createManagedWslProbeAction({ productId, plan, receipt, wslExecutable }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  const guard = managedOwnershipGuard(productId, plan, receipt);
  if (!validPlan(plan) || !executable || !guard) return null;
  return {
    executable,
    args: [
      "--distribution", plan.distribution, "--exec", "bash", "-lc",
      `${guard} && "$command" --version`
    ],
    options: { windowsHide: true, shell: false }
  };
}

function createManagedWslRepairProbeAction({ productId, plan, receipt, wslExecutable }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  const guard = managedOwnershipGuard(productId, plan, receipt, false);
  if (
    !validPlan(plan) ||
    plan.repairStrategy !== REBUILD_OWNED_PREFIX ||
    !executable ||
    !guard ||
    !receiptMatches(receipt, productId, plan)
  ) return null;
  return {
    executable,
    args: ["--distribution", plan.distribution, "--exec", "bash", "-lc", guard],
    options: { windowsHide: true, shell: false }
  };
}

function createManagedWslOpenAction({ productId, plan, receipt, status, wslExecutable, commandExecutable }) {
  const wsl = localWindowsExecutable(wslExecutable, "wsl.exe");
  const command = localWindowsExecutable(commandExecutable, "cmd.exe");
  const guard = managedOwnershipGuard(productId, plan, receipt);
  if (!validPlan(plan) || !status?.installed || !status?.managed || !wsl || !command || !guard) return null;
  const launch = `${guard} && exec "$command"${plan.launchArguments.length ? ` ${shellArguments(plan.launchArguments)}` : ""}`;
  return {
    executable: command,
    args: ["/d", "/k", wsl, "--distribution", plan.distribution, "--exec", "bash", "-lc", launch],
    options: { detached: true, stdio: "ignore", windowsHide: false, shell: false }
  };
}

function createManagedWslReceipt({ productId, plan, distributionIdentity, managementId, now = () => new Date().toISOString() }) {
  if (!PRODUCT_ID.test(String(productId || "")) || !validPlan(plan) || distributionIdentity !== plan.distribution) return null;
  const installedAt = now();
  if (!Number.isFinite(Date.parse(installedAt)) || !MANAGEMENT_ID.test(managementId)) return null;
  return {
    driver: "wsl-managed",
    productId,
    version: plan.version,
    distribution: plan.distribution,
    managedPrefix: plan.managedPrefix,
    installScriptSha256: plan.installScript.sha256,
    managementId,
    installedAt
  };
}

function receiptMatches(receipt, productId, plan) {
  return Boolean(
    receipt && receipt.driver === "wsl-managed" && receipt.productId === productId &&
    receipt.version === plan.version && receipt.distribution === plan.distribution &&
    receipt.managedPrefix === plan.managedPrefix &&
    receipt.installScriptSha256 === plan.installScript.sha256 &&
    MANAGEMENT_ID.test(String(receipt.managementId || "")) &&
    Number.isFinite(Date.parse(receipt.installedAt))
  );
}

function managedWslReceiptOwnsPrefix(receipt, productId, plan) {
  return Boolean(
    receipt && receipt.driver === "wsl-managed" && receipt.productId === productId &&
    receipt.distribution === plan?.distribution && receipt.managedPrefix === plan?.managedPrefix &&
    MANAGEMENT_ID.test(String(receipt.managementId || "")) &&
    Number.isFinite(Date.parse(receipt.installedAt))
  );
}

function managedWslReceiptMatchesPlan(receipt, productId, plan) {
  return receiptMatches(receipt, productId, plan);
}

function inspectManagedWslCli({ productId, plan, receipt, probe }) {
  if (!validPlan(plan) || !PRODUCT_ID.test(String(productId || "")) || !probe || probe.unknown) {
    return { installed: false, version: "", directory: plan?.managedPrefix || "", detection: "unknown", managed: false, canUninstall: false, ownership: "unknown" };
  }
  if (!probe.ok) {
    return { installed: false, version: "", directory: plan.managedPrefix, detection: "absent", managed: false, canUninstall: false, ownership: "none" };
  }
  const exactVersion = String(probe.version || "").trim() === plan.version;
  const exactReceipt = receiptMatches(receipt, productId, plan);
  return {
    installed: true,
    version: String(probe.version || "").trim(),
    directory: `${plan.distribution}:${plan.managedPrefix}`,
    detection: exactVersion ? "installed" : "unknown",
    managed: exactVersion && exactReceipt,
    canUninstall: exactVersion && exactReceipt,
    ownership: exactVersion ? (exactReceipt ? "managed" : "untracked") : "mismatch"
  };
}

function createManagedWslUninstallActions({ productId, plan, receipt, wslExecutable }) {
  const executable = localWindowsExecutable(wslExecutable, "wsl.exe");
  const guard = managedOwnershipGuard(productId, plan, receipt);
  if (!validPlan(plan) || !executable || !guard) return null;
  const actions = [];
  if (plan.serviceUninstallArguments.length) {
    actions.push({
      executable,
      args: [
        "--distribution", plan.distribution, "--exec", "bash", "-lc",
        `${guard} && "$command" ${shellArguments(plan.serviceUninstallArguments)}`
      ],
      options: { windowsHide: true, shell: false }
    });
  }
  actions.push({
    executable,
    args: [
      "--distribution", plan.distribution, "--exec", "bash", "-lc",
      `${guard} && rm -rf -- "$prefix"`
    ],
    options: { windowsHide: true, shell: false }
  });
  return actions;
}

module.exports = {
  createManagedWslBootstrapAction,
  createManagedWslDeployAction,
  createManagedWslRepairAction,
  createManagedWslRepairProbeAction,
  createManagedWslUpdateAction,
  createManagedWslDistributionAction,
  createManagedWslInstallPreflightAction,
  createManagedWslOpenAction,
  createManagedWslProbeAction,
  createManagedWslReceipt,
  createManagedWslUninstallActions,
  inspectManagedWslCli,
  managedWslReceiptOwnsPrefix,
  managedWslReceiptMatchesPlan,
  managedWslArtifact,
  windowsPathToWslMount
};
