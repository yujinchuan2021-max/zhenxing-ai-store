"use strict";

const DOS_HEADER_SIZE = 0x40;
const PE_SIGNATURE_SIZE = 4;
const COFF_HEADER_SIZE = 20;
const PE_HEADER_POINTER_OFFSET = 0x3c;

const MACHINE_ARCHITECTURES = new Map([
  [0x014c, "x86"],
  [0x8664, "x64"],
  [0xaa64, "arm64"]
]);

const SUPPORTED_ARCHITECTURES = new Set(MACHINE_ARCHITECTURES.values());
const VERSION_INFO_FIELDS = Object.freeze([
  "ProductName",
  "FileDescription",
  "OriginalFilename",
  "CompanyName"
]);
const VERSION_INFO_FIELD_SET = new Set(VERSION_INFO_FIELDS);

function success(value) {
  return { ok: true, value };
}

function failure(code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { ok: false, error };
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePeMachineArchitecture(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return failure("PE_INPUT_NOT_BUFFER", "PE input must be a Buffer");
  }
  if (buffer.length < DOS_HEADER_SIZE) {
    return failure(
      "PE_DOS_HEADER_TRUNCATED",
      "PE input does not contain a complete DOS header",
      { minimumBytes: DOS_HEADER_SIZE, actualBytes: buffer.length }
    );
  }
  if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    return failure(
      "PE_DOS_SIGNATURE_INVALID",
      "PE input does not start with the MZ signature"
    );
  }

  const peHeaderOffset = buffer.readUInt32LE(PE_HEADER_POINTER_OFFSET);
  if (
    peHeaderOffset < DOS_HEADER_SIZE ||
    peHeaderOffset > buffer.length - PE_SIGNATURE_SIZE
  ) {
    return failure(
      "PE_HEADER_OFFSET_INVALID",
      "PE header offset is outside the input",
      { peHeaderOffset, inputBytes: buffer.length }
    );
  }
  if (
    buffer[peHeaderOffset] !== 0x50 ||
    buffer[peHeaderOffset + 1] !== 0x45 ||
    buffer[peHeaderOffset + 2] !== 0x00 ||
    buffer[peHeaderOffset + 3] !== 0x00
  ) {
    return failure(
      "PE_SIGNATURE_INVALID",
      "PE header does not contain the PE signature",
      { peHeaderOffset }
    );
  }

  const requiredBytes = peHeaderOffset + PE_SIGNATURE_SIZE + COFF_HEADER_SIZE;
  if (buffer.length < requiredBytes) {
    return failure(
      "PE_COFF_HEADER_TRUNCATED",
      "PE input does not contain a complete COFF header",
      { minimumBytes: requiredBytes, actualBytes: buffer.length }
    );
  }

  const machine = buffer.readUInt16LE(peHeaderOffset + PE_SIGNATURE_SIZE);
  const architecture = MACHINE_ARCHITECTURES.get(machine);
  if (!architecture) {
    return failure(
      "PE_MACHINE_UNSUPPORTED",
      "Unsupported PE machine type",
      { machine }
    );
  }

  return success({ architecture, machine, peHeaderOffset });
}

function validateExpectedPolicy(expected) {
  // Architecture is the PE Machine of the downloaded executable that AI Hub
  // launches, not the architecture advertised for its eventual app payload.
  const issues = [];
  if (!plainObject(expected)) {
    issues.push({
      code: "EXPECTED_POLICY_INVALID",
      field: "expected",
      message: "Expected installer identity policy must be an object"
    });
    return issues;
  }

  if (!SUPPORTED_ARCHITECTURES.has(expected.architecture)) {
    issues.push({
      code: "EXPECTED_ARCHITECTURE_UNSUPPORTED",
      field: "architecture",
      expected: [...SUPPORTED_ARCHITECTURES],
      actual: expected.architecture,
      message: "Expected architecture is unsupported"
    });
  }

  const versionInfoUnavailable =
    typeof expected.versionInfoUnavailable === "string" &&
    expected.versionInfoUnavailable.length > 0;

  if (!plainObject(expected.versionInfo) && !versionInfoUnavailable) {
    issues.push({
      code: "VERSION_INFO_EXPECTATIONS_REQUIRED",
      field: "versionInfo",
      message: "At least one Windows VersionInfo expectation is required"
    });
    return issues;
  }

  if (versionInfoUnavailable) {
    if (expected.versionInfo !== undefined) {
      issues.push({
        code: "VERSION_INFO_POLICY_CONFLICT",
        field: "versionInfo",
        message: "Unavailable VersionInfo cannot also define field expectations"
      });
    }
    return issues;
  }

  const fields = Object.keys(expected.versionInfo);
  if (fields.length === 0) {
    issues.push({
      code: "VERSION_INFO_EXPECTATIONS_REQUIRED",
      field: "versionInfo",
      message: "At least one Windows VersionInfo expectation is required"
    });
    return issues;
  }

  for (const field of fields) {
    if (!VERSION_INFO_FIELD_SET.has(field)) {
      issues.push({
        code: "VERSION_INFO_FIELD_UNSUPPORTED",
        field,
        expected: VERSION_INFO_FIELDS,
        message: "Windows VersionInfo field is unsupported"
      });
      continue;
    }
    const pattern = expected.versionInfo[field];
    if (
      !(pattern instanceof RegExp) &&
      !(typeof pattern === "string" && pattern.length > 0)
    ) {
      issues.push({
        code: "VERSION_INFO_PATTERN_INVALID",
        field,
        message: "VersionInfo expectation must be a RegExp or non-empty string"
      });
    }
  }
  return issues;
}

function patternMatches(pattern, actual) {
  if (typeof pattern === "string") return actual === pattern;
  // Lifecycle contracts are deeply frozen. Clone RegExp values so validation
  // never mutates their lastIndex (and remains safe for global expressions).
  return new RegExp(pattern.source, pattern.flags).test(actual);
}

function normalizedVersionInfo(versionInfo) {
  const normalized = {};
  if (!plainObject(versionInfo)) return normalized;
  for (const field of VERSION_INFO_FIELDS) {
    if (typeof versionInfo[field] === "string") {
      normalized[field] = versionInfo[field];
    }
  }
  return normalized;
}

function validateWindowsInstallerIdentity({ buffer, versionInfo, expected } = {}) {
  const policyIssues = validateExpectedPolicy(expected);
  if (policyIssues.length > 0) {
    return {
      ok: false,
      error: {
        code: "INSTALLER_IDENTITY_POLICY_INVALID",
        message: "Windows installer identity policy is invalid",
        issues: policyIssues
      }
    };
  }

  const parsed = parsePeMachineArchitecture(buffer);
  if (!parsed.ok) return parsed;

  const actualVersionInfo = normalizedVersionInfo(versionInfo);
  const issues = [];
  if (parsed.value.architecture !== expected.architecture) {
    issues.push({
      code: "ARCHITECTURE_MISMATCH",
      field: "architecture",
      expected: expected.architecture,
      actual: parsed.value.architecture,
      message: "PE architecture does not match the approved product policy"
    });
  }

  if (!expected.versionInfoUnavailable) {
    for (const field of VERSION_INFO_FIELDS) {
      if (!Object.hasOwn(expected.versionInfo, field)) continue;
      const actual = actualVersionInfo[field];
      if (typeof actual !== "string" || actual.trim().length === 0) {
        issues.push({
          code: "VERSION_INFO_MISSING",
          field,
          expected: String(expected.versionInfo[field]),
          actual: actual ?? null,
          message: "Required Windows VersionInfo field is missing"
        });
        continue;
      }
      if (!patternMatches(expected.versionInfo[field], actual)) {
        issues.push({
          code: "VERSION_INFO_MISMATCH",
          field,
          expected: String(expected.versionInfo[field]),
          actual,
          message: "Windows VersionInfo field does not match the approved pattern"
        });
      }
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: "INSTALLER_IDENTITY_MISMATCH",
        message: "Windows installer identity does not match the approved policy",
        issues
      }
    };
  }

  return success({
    ...parsed.value,
    versionInfo: actualVersionInfo
  });
}

module.exports = {
  parsePeMachineArchitecture,
  validateWindowsInstallerIdentity
};
