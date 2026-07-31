"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SAFE_SEGMENT = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_SETTINGS_BYTES = 1024 * 1024;

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
  );
}

function validJsonObject(value, depth = 0) {
  if (!isPlainObject(value) || depth > 8) return false;
  return Object.entries(value).every(([key, child]) => {
    if (!SAFE_SEGMENT.test(key) || ["__proto__", "prototype", "constructor"].includes(key)) {
      return false;
    }
    if (isPlainObject(child)) return validJsonObject(child, depth + 1);
    return (
      child === null ||
      typeof child === "string" ||
      typeof child === "boolean" ||
      (typeof child === "number" && Number.isFinite(child))
    );
  });
}

function mergeObjects(current, enforced) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(enforced)) {
    merged[key] = isPlainObject(value)
      ? mergeObjects(isPlainObject(current[key]) ? current[key] : {}, value)
      : value;
  }
  return merged;
}

function validTomlValues(value) {
  return Boolean(
    isPlainObject(value) &&
      Object.keys(value).length > 0 &&
      Object.entries(value).every(
        ([section, settings]) =>
          SAFE_SEGMENT.test(section) &&
          isPlainObject(settings) &&
          Object.keys(settings).length > 0 &&
          Object.entries(settings).every(
            ([key, child]) =>
              SAFE_SEGMENT.test(key) &&
              (typeof child === "string" ||
                typeof child === "boolean" ||
                (typeof child === "number" && Number.isFinite(child)))
          )
      )
  );
}

function serializeTomlScalar(value) {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function mergeTomlSettings(currentText, enforced) {
  if (
    typeof currentText !== "string" ||
    currentText.includes("\0") ||
    !validTomlValues(enforced)
  ) {
    throw new SyntaxError("invalid TOML settings");
  }
  const newline = currentText.includes("\r\n") ? "\r\n" : "\n";
  const lines = currentText ? currentText.replace(/\r\n/g, "\n").split("\n") : [];
  const sectionPattern = /^\s*\[\s*([A-Za-z0-9._-]{1,64})\s*\]\s*(?:#.*)?$/;
  const keyPattern = /^\s*([A-Za-z0-9._-]{1,64})\s*=/;

  for (const [section, settings] of Object.entries(enforced)) {
    const sectionIndexes = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (sectionPattern.exec(lines[index])?.[1] === section) {
        sectionIndexes.push(index);
      }
    }
    if (sectionIndexes.length > 1) {
      throw new SyntaxError("duplicate TOML section");
    }
    if (sectionIndexes.length === 0) {
      if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
      lines.push(`[${section}]`);
      for (const [key, value] of Object.entries(settings)) {
        lines.push(`${key} = ${serializeTomlScalar(value)}`);
      }
      continue;
    }

    const sectionStart = sectionIndexes[0];
    let sectionEnd = lines.length;
    for (let index = sectionStart + 1; index < lines.length; index += 1) {
      if (sectionPattern.test(lines[index])) {
        sectionEnd = index;
        break;
      }
    }
    for (const [key, value] of Object.entries(settings)) {
      const matches = [];
      for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const keyMatch = keyPattern.exec(line);
        if (!keyMatch && line.includes("=")) {
          throw new SyntaxError("unsupported TOML key");
        }
        if (keyMatch?.[1] === key) matches.push(index);
      }
      if (matches.length > 1) throw new SyntaxError("duplicate TOML key");
      const rendered = `${key} = ${serializeTomlScalar(value)}`;
      if (matches.length === 1) {
        lines[matches[0]] = rendered;
      } else {
        lines.splice(sectionEnd, 0, rendered);
        sectionEnd += 1;
      }
    }
  }
  return lines.join(newline);
}

function pathIsInside(candidate, parent) {
  const relative = path.win32.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.win32.isAbsolute(relative))
  );
}

function applyManagedCliSettings({
  homeDirectory,
  policy,
  fileSystem = fs,
  randomBytes = crypto.randomBytes
}) {
  const format = policy?.format || "json";
  const extension = format === "json" ? ".json" : format === "toml" ? ".toml" : "";
  if (
    typeof homeDirectory !== "string" ||
    !/^[A-Za-z]:\\/.test(homeDirectory) ||
    !policy ||
    !Array.isArray(policy.relativePath) ||
    policy.relativePath.length < 2 ||
    policy.relativePath.length > 5 ||
    policy.relativePath.some(
      (segment) =>
        typeof segment !== "string" ||
        !SAFE_SEGMENT.test(segment) ||
        segment === "." ||
        segment === ".."
    ) ||
    !extension ||
    !policy.relativePath.at(-1).toLowerCase().endsWith(extension) ||
    (format === "json"
      ? !validJsonObject(policy.values)
      : !validTomlValues(policy.values))
  ) {
    return { ok: false, error: "受管 CLI 设置策略无效" };
  }

  let temporaryPath = "";
  try {
    const canonicalHome = path.win32.normalize(
      fileSystem.realpathSync.native(homeDirectory)
    );
    const directory = path.win32.join(
      canonicalHome,
      ...policy.relativePath.slice(0, -1)
    );
    fileSystem.mkdirSync(directory, { recursive: true });
    const canonicalDirectory = path.win32.normalize(
      fileSystem.realpathSync.native(directory)
    );
    if (!pathIsInside(canonicalDirectory, canonicalHome)) {
      return { ok: false, error: "受管 CLI 设置目录越过用户目录" };
    }

    const targetPath = path.win32.join(
      canonicalDirectory,
      policy.relativePath.at(-1)
    );
    let current = format === "json" ? {} : "";
    if (fileSystem.existsSync(targetPath)) {
      const stat = fileSystem.lstatSync(targetPath);
      const canonicalTarget = path.win32.normalize(
        fileSystem.realpathSync.native(targetPath)
      );
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        canonicalTarget.toLowerCase() !== targetPath.toLowerCase() ||
        stat.size > MAX_SETTINGS_BYTES
      ) {
        return { ok: false, error: "受管 CLI 设置文件不是普通文件" };
      }
      const currentText = fileSystem.readFileSync(targetPath, "utf8");
      if (format === "json") {
        current = JSON.parse(currentText);
        if (!isPlainObject(current)) {
          return { ok: false, error: "受管 CLI 设置文件不是 JSON 对象" };
        }
      } else {
        current = currentText;
      }
    }

    const rendered =
      format === "json"
        ? JSON.stringify(mergeObjects(current, policy.values), null, 2)
        : mergeTomlSettings(current, policy.values);
    const currentRendered =
      format === "json" ? JSON.stringify(current, null, 2) : current;
    if (rendered === currentRendered) {
      return { ok: true, changed: false, path: targetPath };
    }
    temporaryPath = path.win32.join(
      canonicalDirectory,
      `.aihub-${randomBytes(8).toString("hex")}.tmp`
    );
    fileSystem.writeFileSync(temporaryPath, rendered, {
      encoding: "utf8",
      flag: "wx"
    });
    fileSystem.renameSync(temporaryPath, targetPath);
    temporaryPath = "";
    return { ok: true, changed: true, path: targetPath };
  } catch (error) {
    if (temporaryPath) {
      try {
        fileSystem.unlinkSync(temporaryPath);
      } catch {
        // Only the exact temporary file created above is eligible for cleanup.
      }
    }
    return {
      ok: false,
      error:
        error instanceof SyntaxError
          ? `受管 CLI 设置文件包含无效 ${format === "json" ? "JSON" : "TOML"}`
          : "无法写入受管 CLI 设置"
    };
  }
}

module.exports = { applyManagedCliSettings };
