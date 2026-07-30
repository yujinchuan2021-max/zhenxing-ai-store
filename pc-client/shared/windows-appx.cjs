"use strict";

const SAFE_PACKAGE_FULL_NAME = /^[A-Za-z0-9._-]{1,300}$/;
const SAFE_IDENTITY_NAME = /^[A-Za-z0-9.]{1,120}$/;

function matches(pattern, value) {
  if (!(pattern instanceof RegExp)) return false;
  pattern.lastIndex = 0;
  return pattern.test(String(value || ""));
}

function trustedAppxPackage(packages, policy) {
  if (
    !policy ||
    !SAFE_IDENTITY_NAME.test(String(policy.identityName || "")) ||
    !(policy.publisher instanceof RegExp)
  ) {
    return null;
  }
  const name = policy.identityName;
  const packagePrefix = `${name}_`;
  const candidates = (Array.isArray(packages) ? packages : []).filter(
    (entry) =>
      entry &&
      entry.Name === name &&
      matches(policy.publisher, entry.Publisher) &&
      SAFE_PACKAGE_FULL_NAME.test(String(entry.PackageFullName || "")) &&
      String(entry.PackageFullName).startsWith(packagePrefix) &&
      String(entry.PackageFullName).toLowerCase().includes("_x64__")
  );
  const unique = new Map(
    candidates.map((entry) => [entry.PackageFullName.toLowerCase(), entry])
  );
  return unique.size === 1 ? [...unique.values()][0] : null;
}

function createAppxUninstallAction(entry, policy) {
  const trusted = trustedAppxPackage([entry], policy);
  if (!trusted) return null;
  const packageFullName = trusted.PackageFullName;
  const script = [
    "$ErrorActionPreference='Stop'",
    `Remove-AppxPackage -Package '${packageFullName}' -ErrorAction Stop`
  ].join(";");
  return {
    executable: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command", script],
    packageFullName
  };
}

module.exports = {
  createAppxUninstallAction,
  trustedAppxPackage
};
