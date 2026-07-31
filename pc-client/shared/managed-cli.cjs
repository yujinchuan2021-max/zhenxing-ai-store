const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const {
  nodeVersionSatisfiesPlan,
  validSupportedNodeRanges
} = require("./node-runtime-policy.cjs");

const RECEIPT_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/;
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const MANAGEMENT_ID_PATTERN = /^[a-f0-9]{48}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MANAGEMENT_MARKER = ".aihub-managed.json";
const OFFICIAL_NPM_REGISTRY = "https://registry.npmjs.org/";

function defaultRealpath(value) {
  return fs.realpathSync.native(value);
}

function defaultReadFile(value) {
  return fs.readFileSync(value, "utf8");
}

function defaultWriteFile(value, data, options) {
  return fs.writeFileSync(value, data, options);
}

function defaultRandomBytes(size) {
  return crypto.randomBytes(size);
}

function computeNpmTreeSha256(rootDirectory) {
  const normalizedRoot = localWindowsPath(rootDirectory);
  if (!normalizedRoot) return "";
  let canonicalRoot;
  try {
    canonicalRoot = localWindowsPath(defaultRealpath(normalizedRoot));
  } catch {
    return "";
  }
  if (
    !canonicalRoot ||
    canonicalRoot.toLowerCase() !== normalizedRoot.toLowerCase()
  ) {
    return "";
  }

  const files = [];
  const visit = (directory) => {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
      );
    for (const entry of entries) {
      const absolute = path.win32.join(directory, entry.name);
      const relative = path.win32
        .relative(canonicalRoot, absolute)
        .split(path.win32.sep)
        .join("/");
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error("npm tree contains a link");
      if (stat.isDirectory()) {
        visit(absolute);
      } else if (stat.isFile()) {
        files.push({ absolute, relative });
      } else {
        throw new Error("npm tree contains an unsupported entry");
      }
    }
  };

  try {
    visit(canonicalRoot);
    const digest = crypto.createHash("sha256");
    digest.update("AIHUB_NPM_TREE_V1\0");
    for (const file of files) {
      const fileDigest = crypto
        .createHash("sha256")
        .update(fs.readFileSync(file.absolute))
        .digest("hex");
      digest.update(file.relative, "utf8");
      digest.update("\0");
      digest.update(fileDigest, "ascii");
      digest.update("\0");
    }
    return digest.digest("hex");
  } catch {
    return "";
  }
}

function isMissingError(error) {
  return error?.code === "ENOENT" || error?.code === "ENOTDIR";
}

function localWindowsPath(value, { allowRoot = false } = {}) {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = path.win32.normalize(value.trim());
  if (!/^[A-Za-z]:\\/.test(normalized) || normalized.startsWith("\\\\")) {
    return "";
  }
  const root = path.win32.parse(normalized).root;
  if (!allowRoot && normalized.toLowerCase() === root.toLowerCase()) return "";
  return normalized;
}

function pathIsInside(candidate, parent) {
  const relative = path.win32.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.win32.isAbsolute(relative))
  );
}

function validPlan(productId, plan) {
  return Boolean(
    typeof productId === "string" &&
      productId &&
      plan &&
      typeof plan.packageName === "string" &&
      PACKAGE_NAME_PATTERN.test(plan.packageName) &&
      (plan.expectedVersion === undefined ||
        (typeof plan.expectedVersion === "string" &&
          RECEIPT_VERSION_PATTERN.test(plan.expectedVersion))) &&
      (plan.installSpec === undefined ||
        plan.installSpec === `${plan.packageName}@${plan.expectedVersion}`) &&
      (plan.minimumNodeMajor === undefined ||
        (Number.isInteger(plan.minimumNodeMajor) &&
          plan.minimumNodeMajor >= 1 &&
          plan.minimumNodeMajor <= 999)) &&
      validSupportedNodeRanges(plan.supportedNodeRanges)
  );
}

function resolveCanonicalPath(value, realpath, options) {
  const normalized = localWindowsPath(value, options);
  if (!normalized) return { detection: "unknown", value: "" };
  try {
    const resolved = localWindowsPath(realpath(normalized), options);
    return resolved
      ? { detection: "installed", value: resolved }
      : { detection: "unknown", value: "" };
  } catch (error) {
    return {
      detection: isMissingError(error) ? "absent" : "unknown",
      value: ""
    };
  }
}

function inspectPackage({ prefix, packageName, realpath, readFile }) {
  const resolvedPrefix = resolveCanonicalPath(prefix, realpath);
  if (resolvedPrefix.detection !== "installed") {
    return {
      detection: resolvedPrefix.detection,
      version: "",
      directory: localWindowsPath(prefix) || ""
    };
  }
  if (
    path.win32.normalize(prefix).toLowerCase() !==
    resolvedPrefix.value.toLowerCase()
  ) {
    return {
      detection: "unknown",
      version: "",
      directory: resolvedPrefix.value
    };
  }

  const packageDirectory = path.win32.join(
    resolvedPrefix.value,
    "node_modules",
    ...packageName.split("/")
  );
  const resolvedPackage = resolveCanonicalPath(packageDirectory, realpath);
  if (resolvedPackage.detection !== "installed") {
    return {
      detection: resolvedPackage.detection,
      version: "",
      directory: resolvedPrefix.value
    };
  }
  if (
    !pathIsInside(resolvedPackage.value, resolvedPrefix.value) ||
    resolvedPackage.value.toLowerCase() !== packageDirectory.toLowerCase()
  ) {
    return {
      detection: "unknown",
      version: "",
      directory: resolvedPrefix.value
    };
  }

  try {
    const manifestText = readFile(
      path.win32.join(resolvedPackage.value, "package.json"),
      "utf8"
    );
    const manifest = JSON.parse(manifestText);
    if (
      manifest?.name !== packageName ||
      typeof manifest?.version !== "string" ||
      !RECEIPT_VERSION_PATTERN.test(manifest.version)
    ) {
      return {
        detection: "unknown",
        version: "",
        directory: resolvedPrefix.value
      };
    }
    return {
      detection: "installed",
      version: manifest.version,
      directory: resolvedPrefix.value,
      packageDirectory: resolvedPackage.value,
      manifestSha256: crypto.createHash("sha256").update(manifestText).digest("hex")
    };
  } catch (error) {
    return {
      detection: isMissingError(error) ? "absent" : "unknown",
      version: "",
      directory: resolvedPrefix.value
    };
  }
}

function validRuntimeShape(runtime) {
  if (!runtime || typeof runtime !== "object") return false;
  const nodeExecutable = localWindowsPath(runtime.nodeExecutable);
  const npmCli = localWindowsPath(runtime.npmCli);
  if (!nodeExecutable || !npmCli) return false;
  const nodeDirectory = path.win32.dirname(nodeExecutable);
  const expectedNpmCli = path.win32.join(
    nodeDirectory,
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js"
  );
  return Boolean(
    path.win32.basename(nodeExecutable).toLowerCase() === "node.exe" &&
      npmCli.toLowerCase() === expectedNpmCli.toLowerCase() &&
      typeof runtime.nodeSha256 === "string" &&
      SHA256_PATTERN.test(runtime.nodeSha256) &&
      typeof runtime.npmCliSha256 === "string" &&
      SHA256_PATTERN.test(runtime.npmCliSha256) &&
      typeof runtime.npmTreeSha256 === "string" &&
      SHA256_PATTERN.test(runtime.npmTreeSha256) &&
      typeof runtime.npmVersion === "string" &&
      RECEIPT_VERSION_PATTERN.test(runtime.npmVersion)
  );
}

function runtimesMatch(recorded, current) {
  if (!validRuntimeShape(recorded) || !validRuntimeShape(current)) return false;
  return (
    path.win32.normalize(recorded.nodeExecutable).toLowerCase() ===
      path.win32.normalize(current.nodeExecutable).toLowerCase() &&
    path.win32.normalize(recorded.npmCli).toLowerCase() ===
      path.win32.normalize(current.npmCli).toLowerCase() &&
    recorded.nodeSha256 === current.nodeSha256 &&
    recorded.npmCliSha256 === current.npmCliSha256 &&
    recorded.npmTreeSha256 === current.npmTreeSha256 &&
    recorded.npmVersion === current.npmVersion
  );
}

function resolveRuntimePaths(runtime, realpath) {
  if (!validRuntimeShape(runtime)) return null;
  const nodePath = resolveCanonicalPath(runtime.nodeExecutable, realpath);
  const npmCliPath = resolveCanonicalPath(runtime.npmCli, realpath);
  if (
    nodePath.detection !== "installed" ||
    npmCliPath.detection !== "installed" ||
    nodePath.value.toLowerCase() !==
      path.win32.normalize(runtime.nodeExecutable).toLowerCase() ||
    npmCliPath.value.toLowerCase() !==
      path.win32.normalize(runtime.npmCli).toLowerCase() ||
    path.win32.basename(nodePath.value).toLowerCase() !== "node.exe" ||
    path.win32.basename(npmCliPath.value).toLowerCase() !== "npm-cli.js"
  ) {
    return null;
  }
  return { nodeExecutable: nodePath.value, npmCli: npmCliPath.value };
}

function resolveExecutionContext(executionContext, realpath) {
  if (!executionContext || typeof executionContext !== "object") return null;
  const directory = resolveCanonicalPath(executionContext.directory, realpath);
  const userConfig = resolveCanonicalPath(
    executionContext.userConfigPath,
    realpath
  );
  const globalConfig = resolveCanonicalPath(
    executionContext.globalConfigPath,
    realpath
  );
  if (
    directory.detection !== "installed" ||
    userConfig.detection !== "installed" ||
    globalConfig.detection !== "installed" ||
    directory.value.toLowerCase() !==
      path.win32.normalize(executionContext.directory || "").toLowerCase() ||
    userConfig.value.toLowerCase() !==
      path.win32.normalize(executionContext.userConfigPath || "").toLowerCase() ||
    globalConfig.value.toLowerCase() !==
      path.win32.normalize(executionContext.globalConfigPath || "").toLowerCase() ||
    userConfig.value.toLowerCase() !==
      path.win32.join(directory.value, "user.npmrc").toLowerCase() ||
    globalConfig.value.toLowerCase() !==
      path.win32.join(directory.value, "global.npmrc").toLowerCase()
  ) {
    return null;
  }
  return {
    directory: directory.value,
    userConfigPath: userConfig.value,
    globalConfigPath: globalConfig.value
  };
}

function inspectManagementMarker(packageStatus, receipt, readFile) {
  if (!packageStatus.packageDirectory) return "unknown";
  try {
    const marker = JSON.parse(
      readFile(
        path.win32.join(packageStatus.packageDirectory, MANAGEMENT_MARKER),
        "utf8"
      )
    );
    return marker?.managementId === receipt.managementId &&
      marker?.productId === receipt.productId &&
      marker?.packageName === receipt.packageName &&
      marker?.version === receipt.version &&
      marker?.manifestSha256 === receipt.manifestSha256
      ? "matched"
      : "mismatch";
  } catch (error) {
    return isMissingError(error) ? "missing" : "unknown";
  }
}

function validReceiptShape(receipt, productId, plan) {
  return Boolean(
    receipt &&
      typeof receipt === "object" &&
      receipt.productId === productId &&
      receipt.packageName === plan.packageName &&
      localWindowsPath(receipt.prefix) &&
      typeof receipt.version === "string" &&
      RECEIPT_VERSION_PATTERN.test(receipt.version) &&
      (!plan.expectedVersion || receipt.version === plan.expectedVersion) &&
      typeof receipt.managementId === "string" &&
      MANAGEMENT_ID_PATTERN.test(receipt.managementId) &&
      typeof receipt.manifestSha256 === "string" &&
      SHA256_PATTERN.test(receipt.manifestSha256) &&
      validRuntimeShape(receipt.runtime) &&
      typeof receipt.installedAt === "string" &&
      Number.isFinite(Date.parse(receipt.installedAt))
  );
}

function statusFromPackage(packageStatus, ownership) {
  const managed = ownership === "managed" || ownership === "adopted";
  return {
    installed: packageStatus.detection === "installed",
    version: packageStatus.version,
    directory: packageStatus.directory,
    detection: packageStatus.detection,
    managed,
    canUninstall: managed,
    ownership
  };
}

function adoptablePackage(plan, packageStatus) {
  return Boolean(
    packageStatus?.detection === "installed" &&
      typeof plan?.expectedVersion === "string" &&
      plan.expectedVersion &&
      packageStatus.version === plan.expectedVersion &&
      plan.installSpec === `${plan.packageName}@${plan.expectedVersion}` &&
      SHA256_PATTERN.test(String(packageStatus.manifestSha256 || ""))
  );
}

function inspectManagedCli({
  productId,
  plan,
  receipt,
  configuredPrefix = "",
  realpath = defaultRealpath,
  readFile = defaultReadFile
}) {
  if (!validPlan(productId, plan)) {
    return {
      installed: false,
      version: "",
      directory: "",
      detection: "unknown",
      managed: false,
      canUninstall: false,
      ownership: "unknown"
    };
  }

  if (receipt) {
    if (!validReceiptShape(receipt, productId, plan)) {
      if (configuredPrefix) {
        const configured = inspectPackage({
          prefix: configuredPrefix,
          packageName: plan.packageName,
          realpath,
          readFile
        });
        if (configured.detection === "installed") {
          return statusFromPackage(configured, "external");
        }
      }
      return {
        installed: false,
        version: "",
        directory: "",
        detection: "unknown",
        managed: false,
        canUninstall: false,
        ownership: "unknown"
      };
    }

    const recorded = inspectPackage({
      prefix: receipt.prefix,
      packageName: plan.packageName,
      realpath,
      readFile
    });
    if (recorded.detection === "installed") {
      if (
        recorded.version !== receipt.version ||
        recorded.manifestSha256 !== receipt.manifestSha256
      ) {
        return statusFromPackage(recorded, "mismatch");
      }
      const marker = inspectManagementMarker(recorded, receipt, readFile);
      return statusFromPackage(
        recorded,
        marker === "matched"
          ? "managed"
          : marker === "unknown"
            ? "unknown"
            : "mismatch"
      );
    }
    if (recorded.detection === "unknown") {
      return statusFromPackage(recorded, "unknown");
    }
    if (
      configuredPrefix &&
      path.win32.normalize(configuredPrefix).toLowerCase() !==
        path.win32.normalize(receipt.prefix).toLowerCase()
    ) {
      const configured = inspectPackage({
        prefix: configuredPrefix,
        packageName: plan.packageName,
        realpath,
        readFile
      });
      if (configured.detection === "installed") {
        return statusFromPackage(
          configured,
          adoptablePackage(plan, configured) ? "adopted" : "external"
        );
      }
      if (configured.detection === "unknown") {
        return statusFromPackage(configured, "unknown");
      }
    }
    return statusFromPackage(recorded, "stale");
  }

  if (!configuredPrefix) {
    return {
      installed: false,
      version: "",
      directory: "",
      detection: "absent",
      managed: false,
      canUninstall: false,
      ownership: "none"
    };
  }
  const configured = inspectPackage({
    prefix: configuredPrefix,
    packageName: plan.packageName,
    realpath,
    readFile
  });
  return statusFromPackage(
    configured,
    configured.detection === "installed"
      ? adoptablePackage(plan, configured)
        ? "adopted"
        : "external"
      : configured.detection === "unknown"
        ? "unknown"
        : "none"
  );
}

function createManagedCliReceipt({
  productId,
  plan,
  prefix,
  runtime,
  now = () => new Date().toISOString(),
  realpath = defaultRealpath,
  readFile = defaultReadFile,
  writeFile = defaultWriteFile,
  randomBytes = defaultRandomBytes
}) {
  if (!validPlan(productId, plan) || !validRuntimeShape(runtime)) return null;
  const installed = inspectPackage({
    prefix,
    packageName: plan.packageName,
    realpath,
    readFile
  });
  if (installed.detection !== "installed") return null;
  if (plan.expectedVersion && installed.version !== plan.expectedVersion) return null;
  const installedAt = now();
  if (
    typeof installedAt !== "string" ||
    !Number.isFinite(Date.parse(installedAt))
  ) {
    return null;
  }
  let managementId;
  try {
    managementId = randomBytes(24).toString("hex");
  } catch {
    return null;
  }
  if (!MANAGEMENT_ID_PATTERN.test(managementId)) return null;
  const receipt = {
    productId,
    packageName: plan.packageName,
    prefix: installed.directory,
    version: installed.version,
    managementId,
    manifestSha256: installed.manifestSha256,
    runtime: {
      nodeExecutable: path.win32.normalize(runtime.nodeExecutable),
      npmCli: path.win32.normalize(runtime.npmCli),
      nodeSha256: runtime.nodeSha256,
      npmCliSha256: runtime.npmCliSha256,
      npmTreeSha256: runtime.npmTreeSha256,
      npmVersion: runtime.npmVersion
    },
    installedAt
  };
  try {
    const markerPath = path.win32.join(
      installed.packageDirectory,
      MANAGEMENT_MARKER
    );
    writeFile(
      markerPath,
      JSON.stringify(
        {
          managementId,
          productId,
          packageName: plan.packageName,
          version: installed.version,
          manifestSha256: installed.manifestSha256
        },
        null,
        2
      ),
      { encoding: "utf8", flag: "wx" }
    );
    if (inspectManagementMarker(installed, receipt, readFile) !== "matched") {
      return null;
    }
  } catch {
    return null;
  }
  return receipt;
}

function createManagedCliInstallAction({
  productId,
  plan,
  prefix,
  runtime,
  executionContext,
  realpath = defaultRealpath
}) {
  if (!validPlan(productId, plan)) return null;
  const prefixPath = resolveCanonicalPath(prefix, realpath);
  const runtimePaths = resolveRuntimePaths(runtime, realpath);
  const context = resolveExecutionContext(executionContext, realpath);
  if (
    prefixPath.detection !== "installed" ||
    prefixPath.value.toLowerCase() !== path.win32.normalize(prefix).toLowerCase() ||
    !runtimePaths ||
    !context ||
    !nodeVersionSatisfiesPlan(runtime.nodeVersion, plan)
  ) {
    return null;
  }
  return {
    executable: runtimePaths.nodeExecutable,
    args: [
      runtimePaths.npmCli,
      "install",
      "--global",
      "--prefix",
      prefixPath.value,
      "--registry",
      OFFICIAL_NPM_REGISTRY,
      "--userconfig",
      context.userConfigPath,
      "--globalconfig",
      context.globalConfigPath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      plan.installSpec || plan.packageName
    ],
    options: {
      cwd: context.directory,
      windowsHide: true,
      shell: false
    },
    productId,
    packageName: plan.packageName,
    prefix: prefixPath.value
  };
}

function createManagedCliPostInstallAction({
  productId,
  plan,
  prefix,
  runtime,
  realpath = defaultRealpath,
  readFile = defaultReadFile
}) {
  const policy = plan?.postInstall;
  if (
    !validPlan(productId, plan) ||
    !policy ||
    typeof policy.manifestCommand !== "string" ||
    typeof policy.scriptFile !== "string" ||
    typeof policy.executableFile !== "string" ||
    (policy.verificationWithNode !== undefined &&
      typeof policy.verificationWithNode !== "boolean") ||
    !Array.isArray(policy.verificationArgs) ||
    policy.verificationArgs.some((value) => typeof value !== "string")
  ) {
    return null;
  }
  const runtimePaths = resolveRuntimePaths(runtime, realpath);
  const installed = inspectPackage({
    prefix,
    packageName: plan.packageName,
    realpath,
    readFile
  });
  if (!runtimePaths || installed.detection !== "installed") return null;
  if (plan.expectedVersion && installed.version !== plan.expectedVersion) return null;

  const scriptCandidate = path.win32.join(
    installed.packageDirectory,
    policy.scriptFile
  );
  const scriptPath = resolveCanonicalPath(scriptCandidate, realpath);
  const expectedExecutable = path.win32.normalize(
    path.win32.join(installed.packageDirectory, policy.executableFile)
  );
  if (
    scriptPath.detection !== "installed" ||
    scriptPath.value.toLowerCase() !== scriptCandidate.toLowerCase() ||
    !pathIsInside(scriptPath.value, installed.packageDirectory) ||
    !pathIsInside(expectedExecutable, installed.packageDirectory)
  ) {
    return null;
  }
  try {
    const manifest = JSON.parse(
      readFile(
        path.win32.join(installed.packageDirectory, "package.json"),
        "utf8"
      )
    );
    if (manifest?.scripts?.postinstall !== policy.manifestCommand) return null;
  } catch {
    return null;
  }
  return {
    executable: runtimePaths.nodeExecutable,
    args: [scriptPath.value],
    options: {
      cwd: installed.packageDirectory,
      windowsHide: true,
      shell: false
    },
    productId,
    packageName: plan.packageName,
    version: installed.version,
    expectedExecutable,
    verificationWithNode: policy.verificationWithNode === true,
    verificationArgs: [...policy.verificationArgs]
  };
}

function createManagedCliUninstallAction({
  productId,
  plan,
  receipt,
  configuredPrefix = "",
  runtime,
  executionContext,
  realpath = defaultRealpath,
  readFile = defaultReadFile
}) {
  const status = inspectManagedCli({
    productId,
    plan,
    receipt,
    configuredPrefix,
    realpath,
    readFile
  });
  const runtimePaths = resolveRuntimePaths(runtime, realpath);
  const context = resolveExecutionContext(executionContext, realpath);
  const adopted = status.ownership === "adopted";
  const observed = status.canUninstall
    ? inspectPackage({
        prefix: status.directory,
        packageName: plan.packageName,
        realpath,
        readFile
      })
    : null;
  if (
    !status.canUninstall ||
    (!adopted &&
      !runtimesMatch(receipt?.runtime, runtime) &&
      !adoptablePackage(plan, observed)) ||
    (adopted && !adoptablePackage(plan, observed)) ||
    !nodeVersionSatisfiesPlan(runtime?.nodeVersion, plan) ||
    !runtimePaths ||
    !context
  ) {
    return null;
  }

  return {
    executable: runtimePaths.nodeExecutable,
    args: [
      runtimePaths.npmCli,
      "uninstall",
      "--global",
      "--prefix",
      status.directory,
      "--registry",
      OFFICIAL_NPM_REGISTRY,
      "--userconfig",
      context.userConfigPath,
      "--globalconfig",
      context.globalConfigPath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      plan.packageName
    ],
    options: {
      cwd: context.directory,
      windowsHide: true,
      shell: false
    },
    productId,
    packageName: plan.packageName,
    prefix: status.directory,
    version: status.version,
    managementId: adopted ? "" : receipt.managementId,
    ...(adopted
      ? { ownership: "adopted", manifestSha256: observed.manifestSha256 }
      : !runtimesMatch(receipt?.runtime, runtime)
        ? { ownership: "managed", manifestSha256: observed.manifestSha256 }
        : {})
  };
}

function createManagedCliBeforeUninstallAction({
  productId,
  plan,
  receipt,
  configuredPrefix = "",
  runtime,
  realpath = defaultRealpath,
  readFile = defaultReadFile
}) {
  const policy = plan?.beforeUninstall;
  if (!policy) return null;
  if (
    !validPlan(productId, plan) ||
    typeof policy.executableFile !== "string" ||
    !Array.isArray(policy.args) ||
    policy.args.length > 12 ||
    policy.args.some(
      (value) =>
        typeof value !== "string" ||
        !/^(?:--?[a-z0-9][a-z0-9-]{0,63}|[a-z0-9][a-z0-9._:-]{0,63})$/i.test(value)
    )
  ) {
    return null;
  }
  const status = inspectManagedCli({
    productId,
    plan,
    receipt,
    configuredPrefix,
    realpath,
    readFile
  });
  const runtimePaths = resolveRuntimePaths(runtime, realpath);
  const adopted = status.ownership === "adopted";
  const observed = status.canUninstall
    ? inspectPackage({
        prefix: status.directory,
        packageName: plan.packageName,
        realpath,
        readFile
      })
    : null;
  if (
    !status.canUninstall ||
    (!adopted &&
      !runtimesMatch(receipt?.runtime, runtime) &&
      !adoptablePackage(plan, observed)) ||
    (adopted && !adoptablePackage(plan, observed)) ||
    !nodeVersionSatisfiesPlan(runtime?.nodeVersion, plan) ||
    !runtimePaths
  ) {
    return null;
  }
  const packageDirectory = path.win32.join(
    status.directory,
    "node_modules",
    ...plan.packageName.split("/")
  );
  const executableCandidate = path.win32.join(
    packageDirectory,
    policy.executableFile
  );
  const executablePath = resolveCanonicalPath(executableCandidate, realpath);
  if (
    executablePath.detection !== "installed" ||
    executablePath.value.toLowerCase() !== executableCandidate.toLowerCase() ||
    !pathIsInside(executablePath.value, packageDirectory)
  ) {
    return null;
  }
  try {
    const manifest = JSON.parse(
      readFile(path.win32.join(packageDirectory, "package.json"), "utf8")
    );
    if (
      manifest?.name !== plan.packageName ||
      manifest?.version !== status.version ||
      manifest?.bin?.[plan.commandName] !== policy.executableFile
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return {
    executable: runtimePaths.nodeExecutable,
    args: [executablePath.value, ...policy.args],
    options: {
      cwd: packageDirectory,
      windowsHide: true,
      shell: false
    },
    productId,
    packageName: plan.packageName,
    prefix: status.directory,
    version: status.version,
    managementId: adopted ? "" : receipt.managementId,
    ...(adopted
      ? { ownership: "adopted", manifestSha256: observed.manifestSha256 }
      : !runtimesMatch(receipt?.runtime, runtime)
        ? { ownership: "managed", manifestSha256: observed.manifestSha256 }
        : {})
  };
}

module.exports = {
  computeNpmTreeSha256,
  createManagedCliBeforeUninstallAction,
  createManagedCliInstallAction,
  createManagedCliPostInstallAction,
  createManagedCliReceipt,
  createManagedCliUninstallAction,
  inspectManagedCli
};
