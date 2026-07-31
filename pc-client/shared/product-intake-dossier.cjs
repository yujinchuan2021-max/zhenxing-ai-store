"use strict";

const { sha256Hex } = require("./sha256-portable.cjs");

function uniqueHttpsSources(values) {
  return [...new Set(values.filter((value) => {
    if (typeof value !== "string") return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }))];
}

function packageSource(packageName) {
  return typeof packageName === "string" && packageName
    ? `https://www.npmjs.com/package/${packageName}`
    : "";
}

function normalizeExecutionContractValue(value) {
  if (value === undefined) return null;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof RegExp) {
    return { source: value.source, flags: value.flags };
  }
  if (Array.isArray(value)) {
    return value.map(normalizeExecutionContractValue);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeExecutionContractValue(value[key])])
    );
  }
  throw new TypeError("产品执行契约包含不可审核的值");
}

function executionContractSha256(productId, registration, download = null) {
  if (!registration || typeof registration !== "object") return "";
  const contract = normalizeExecutionContractValue({
    productId,
    registration,
    download
  });
  return sha256Hex(JSON.stringify(contract));
}

function validApproval(approval, contractSha256) {
  return Boolean(
    approval &&
      typeof approval === "object" &&
      approval.executionContractSha256 === contractSha256 &&
      typeof approval.reviewReference === "string" &&
      approval.reviewReference.length > 0 &&
      typeof approval.reviewedAt === "string" &&
      !Number.isNaN(Date.parse(approval.reviewedAt))
  );
}

function buildProductIntakeDossier(
  productId,
  registration,
  download = null,
  approval = null
) {
  if (!registration || typeof registration !== "object") return null;
  const contractSha256 = executionContractSha256(
    productId,
    registration,
    download
  );
  if (!validApproval(approval, contractSha256)) return null;
  const cli = registration.cli || null;
  const driver = cli?.driver || (registration.mode === "managed-cli" ? "npm" : "");
  const architecture =
    registration.mode === "managed-installer"
      ? "windows-desktop"
      : driver === "companion-runtime"
        ? "desktop-companion-runtime"
        : driver === "wsl-managed"
          ? "wsl-cli-runtime"
          : "windows-cli";
  const sources = uniqueHttpsSources([
    download?.url,
    cli?.installScript?.url,
    cli?.artifact?.url,
    cli?.wheel?.url,
    ...(Array.isArray(cli?.lockedRequirements)
      ? cli.lockedRequirements.map((requirement) => requirement?.url)
      : []),
    ...Object.values(cli?.artifacts || {}).map((artifact) => artifact?.url),
    packageSource(cli?.packageName),
    ...(Array.isArray(cli?.officialSources) ? cli.officialSources : [])
  ]);
  const components =
    driver === "companion-runtime"
      ? ["windows-hub", "dedicated-wsl-distribution", "gateway-service", "pairing"]
      : registration.mode === "managed-installer"
        ? ["windows-desktop"]
        : driver === "wsl-managed"
          ? ["wsl-distribution", "runtime", "cli"]
          : ["runtime", "cli"];
  const completionEvidence =
    driver === "companion-runtime"
      ? [
          "hub-installed",
          "dedicated-distribution-present",
          "cli-version",
          "gateway-rpc-ready",
          "hub-paired"
        ]
      : registration.mode === "managed-installer"
        ? ["trusted-install-identity", "signed-main-executable"]
        : ["exact-version", "owned-install-location", "executable-integrity"];
  return {
    schemaVersion: 1,
    productId,
    reviewStatus: "approved",
    reviewBasis: "explicit-reviewed-execution-contract",
    reviewReference: approval.reviewReference,
    reviewedAt: approval.reviewedAt,
    executionContractSha256: contractSha256,
    architecture,
    components,
    officialSources: sources,
    completionEvidence,
    operations: {
      install: registration.capabilities?.includes("install") === true,
      open: registration.capabilities?.includes("open") === true,
      uninstall: registration.capabilities?.includes("uninstall") === true
    }
  };
}

function validateProductIntakeDossier(dossier) {
  if (
    !dossier ||
    dossier.schemaVersion !== 1 ||
    dossier.reviewStatus !== "approved" ||
    dossier.reviewBasis !== "explicit-reviewed-execution-contract" ||
    typeof dossier.reviewReference !== "string" ||
    dossier.reviewReference.length < 1 ||
    typeof dossier.reviewedAt !== "string" ||
    Number.isNaN(Date.parse(dossier.reviewedAt)) ||
    typeof dossier.executionContractSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(dossier.executionContractSha256) ||
    typeof dossier.productId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,99}$/.test(dossier.productId) ||
    ![
      "windows-desktop",
      "desktop-companion-runtime",
      "wsl-cli-runtime",
      "windows-cli"
    ].includes(dossier.architecture) ||
    !Array.isArray(dossier.components) ||
    dossier.components.length < 1 ||
    new Set(dossier.components).size !== dossier.components.length ||
    !Array.isArray(dossier.officialSources) ||
    dossier.officialSources.length < 1 ||
    dossier.officialSources.some((source) => {
      try {
        return new URL(source).protocol !== "https:";
      } catch {
        return true;
      }
    }) ||
    !Array.isArray(dossier.completionEvidence) ||
    dossier.completionEvidence.length < 1 ||
    !dossier.operations ||
    Object.values(dossier.operations).some((value) => typeof value !== "boolean")
  ) {
    return "产品缺少完整的客户端审核资料卡";
  }
  if (
    dossier.architecture === "desktop-companion-runtime" &&
    ![
      "windows-hub",
      "dedicated-wsl-distribution",
      "gateway-service",
      "pairing"
    ].every((component) => dossier.components.includes(component))
  ) {
    return "伴侣型产品未拆分运行组件";
  }
  return "";
}

module.exports = {
  buildProductIntakeDossier,
  executionContractSha256,
  normalizeExecutionContractValue,
  validateProductIntakeDossier
};
