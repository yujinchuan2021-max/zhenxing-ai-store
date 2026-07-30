const path = require("node:path");

const WINDOWS_DRIVE_PATH = /^[a-z]:\\/i;
const PRODUCT_CODE = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;

function matches(pattern, value) {
  if (!(pattern instanceof RegExp)) return false;
  pattern.lastIndex = 0;
  return pattern.test(String(value || ""));
}

function normalizedWindowsPath(value) {
  const candidate = String(value || "").trim().replace(/^"|"$/g, "");
  if (!WINDOWS_DRIVE_PATH.test(candidate)) return "";
  return path.win32.resolve(candidate).replace(/[\\/]+$/, "");
}

function displayIconPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const quoted = raw.match(/^"([^"]+)"(?:\s*,\s*-?\d+)?$/);
  if (quoted) return normalizedWindowsPath(quoted[1]);
  return normalizedWindowsPath(raw.replace(/\s*,\s*-?\d+$/, ""));
}

function registryInstallLocation(entry) {
  const explicit = normalizedWindowsPath(entry?.installlocation);
  if (explicit) return explicit;
  const icon = displayIconPath(entry?.displayicon);
  return icon ? path.win32.dirname(icon) : "";
}

function pathIsInside(candidate, root) {
  const normalizedCandidate = normalizedWindowsPath(candidate).toLowerCase();
  const normalizedRoot = normalizedWindowsPath(root).toLowerCase();
  return Boolean(
    normalizedCandidate &&
      normalizedRoot &&
      (normalizedCandidate === normalizedRoot ||
        normalizedCandidate.startsWith(`${normalizedRoot}\\`))
  );
}

function parseExecutableCommand(command) {
  const raw = String(command || "").trim();
  if (!raw || raw.length > 4096 || /[\0\r\n]/.test(raw)) return null;
  const quoted = raw.match(/^"([^"]+)"(?:\s+([^"\r\n]+))?$/);
  const bare = quoted ? null : raw.match(/^(\S+)(?:\s+([^"\r\n]+))?$/);
  const executable = normalizedWindowsPath(quoted?.[1] || bare?.[1]);
  if (!executable) return null;
  const argumentText = String(quoted?.[2] || bare?.[2] || "").trim();
  return {
    executable,
    args: argumentText ? argumentText.split(/\s+/) : []
  };
}

function argumentsAllowed(args, allowedArguments) {
  const allowlist = Array.isArray(allowedArguments) ? allowedArguments : [[]];
  return allowlist.some(
    (allowed) =>
      Array.isArray(allowed) &&
      allowed.length === args.length &&
      allowed.every(
        (value, index) =>
          String(value).toLowerCase() === String(args[index]).toLowerCase()
      )
  );
}

function parseMsiProductCode(command) {
  const raw = String(command || "").trim();
  if (!raw || raw.length > 4096 || /[\0\r\n]/.test(raw)) return "";
  const match = raw.match(
    /^(?:"(?:[a-z]:\\[^"\r\n]*\\)?msiexec(?:\.exe)?"|(?:[a-z]:\\\S*\\)?msiexec(?:\.exe)?)\s+\/(?:i|x)\s*(\{[0-9a-f-]+\})$/i
  );
  return match && PRODUCT_CODE.test(match[1]) ? match[1].toUpperCase() : "";
}

function canonicalPath(value, exists, realpath) {
  const normalized = normalizedWindowsPath(value);
  if (!normalized) return "";
  if (typeof exists === "function" && !exists(normalized)) return "";
  if (typeof realpath === "function") {
    try {
      return normalizedWindowsPath(realpath(normalized));
    } catch {
      return "";
    }
  }
  return normalized;
}

function resolveTrustedUninstallAction({
  entry,
  policy,
  exists,
  realpath,
  systemRoot = "C:\\Windows"
}) {
  if (
    !entry ||
    !policy ||
    !matches(policy.displayName, entry.displayname) ||
    !matches(policy.publisher, entry.publisher)
  ) {
    return null;
  }

  const command = String(entry.uninstallstring || "");
  const productCode = policy.allowMsi ? parseMsiProductCode(command) : "";
  if (productCode) {
    const systemInstaller = canonicalPath(
      path.win32.join(systemRoot, "System32", "msiexec.exe"),
      exists,
      realpath
    );
    return systemInstaller
      ? {
          kind: "msi",
          executable: systemInstaller,
          args: ["/x", productCode]
        }
      : null;
  }

  const parsed = parseExecutableCommand(command);
  if (
    !parsed ||
    !matches(policy.executableName, path.win32.basename(parsed.executable)) ||
    !argumentsAllowed(parsed.args, policy.allowedArguments)
  ) {
    return null;
  }
  const installLocation = registryInstallLocation(entry);
  if (!installLocation) return null;
  const canonicalExecutable = canonicalPath(parsed.executable, exists, realpath);
  const canonicalLocation = canonicalPath(installLocation, exists, realpath);
  if (
    !canonicalExecutable ||
    !canonicalLocation ||
    !pathIsInside(canonicalExecutable, canonicalLocation)
  ) {
    return null;
  }
  return {
    kind: "executable",
    executable: canonicalExecutable,
    args: policy.launchWithoutArguments ? [] : parsed.args
  };
}

function findTrustedUninstallRecord({
  registry,
  policy,
  exists,
  realpath,
  systemRoot
}) {
  const candidates = [];
  for (const entry of Array.isArray(registry) ? registry : []) {
    const action = resolveTrustedUninstallAction({
      entry,
      policy,
      exists,
      realpath,
      systemRoot
    });
    if (action) {
      candidates.push({
        entry,
        action,
        location: registryInstallLocation(entry)
      });
    }
  }
  const unique = new Map();
  for (const candidate of candidates) {
    const identity = [
      candidate.action.kind,
      candidate.action.executable,
      ...candidate.action.args,
      candidate.location,
      candidate.entry.displayname,
      candidate.entry.publisher
    ]
      .join("\0")
      .toLowerCase();
    if (!unique.has(identity)) unique.set(identity, candidate);
  }
  return unique.size === 1 ? [...unique.values()][0] : null;
}

function findTrustedProductExecutable({
  entry,
  executableNames,
  exists,
  realpath
}) {
  const installLocation = registryInstallLocation(entry);
  const canonicalLocation = canonicalPath(installLocation, exists, realpath);
  if (!canonicalLocation || !Array.isArray(executableNames)) return "";
  const allowedNames = new Set(
    executableNames
      .map((value) => String(value || "").trim())
      .filter(
        (value) =>
          value &&
          path.win32.basename(value) === value &&
          path.win32.extname(value).toLowerCase() === ".exe"
      )
      .map((value) => value.toLowerCase())
  );
  if (!allowedNames.size) return "";
  const candidates = [
    displayIconPath(entry?.displayicon),
    ...[...allowedNames].map((name) => path.win32.join(installLocation, name))
  ];
  for (const candidate of candidates) {
    if (!allowedNames.has(path.win32.basename(candidate).toLowerCase())) continue;
    const canonicalCandidate = canonicalPath(candidate, exists, realpath);
    if (
      canonicalCandidate &&
      pathIsInside(canonicalCandidate, canonicalLocation)
    ) {
      return canonicalCandidate;
    }
  }
  return "";
}

module.exports = {
  displayIconPath,
  findTrustedProductExecutable,
  findTrustedUninstallRecord,
  parseMsiProductCode,
  pathIsInside,
  registryInstallLocation,
  resolveTrustedUninstallAction
};
