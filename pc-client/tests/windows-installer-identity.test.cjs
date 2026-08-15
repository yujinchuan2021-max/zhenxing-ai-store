"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  parsePeMachineArchitecture,
  validateWindowsInstallerIdentity
} = require("../shared/windows-installer-identity.cjs");

const PE_MACHINES = {
  x86: 0x014c,
  x64: 0x8664,
  arm64: 0xaa64
};

function peFixture(machine, options = {}) {
  const peOffset = options.peOffset ?? 0x80;
  const size = options.size ?? peOffset + 24;
  const buffer = Buffer.alloc(size);
  if (options.dosSignature !== false && size >= 2) {
    buffer.write("MZ", 0, "ascii");
  }
  if (size >= 0x40) {
    buffer.writeUInt32LE(peOffset, 0x3c);
  }
  if (options.peSignature !== false && peOffset + 4 <= size) {
    buffer.write("PE\0\0", peOffset, "binary");
  }
  if (peOffset + 6 <= size) {
    buffer.writeUInt16LE(machine, peOffset + 4);
  }
  return buffer;
}

function expectedVersionInfo(overrides = {}) {
  return {
    ProductName: /^Example AI Desktop$/i,
    FileDescription: /Example AI/i,
    OriginalFilename: /^ExampleAISetup\.exe$/i,
    CompanyName: /^Example Vendor(?:, Inc\.)?$/i,
    ...overrides
  };
}

function actualVersionInfo(overrides = {}) {
  return {
    ProductName: "Example AI Desktop",
    FileDescription: "Example AI Desktop Installer",
    OriginalFilename: "ExampleAISetup.exe",
    CompanyName: "Example Vendor, Inc.",
    ...overrides
  };
}

test("parses the reviewed x86, x64, and arm64 PE machine values", () => {
  for (const [architecture, machine] of Object.entries(PE_MACHINES)) {
    assert.deepEqual(parsePeMachineArchitecture(peFixture(machine)), {
      ok: true,
      value: {
        architecture,
        machine,
        peHeaderOffset: 0x80
      }
    });
  }
});

test("rejects malformed DOS and PE headers without throwing", () => {
  const cases = [
    {
      input: "not-a-buffer",
      code: "PE_INPUT_NOT_BUFFER"
    },
    {
      input: Buffer.alloc(63),
      code: "PE_DOS_HEADER_TRUNCATED"
    },
    {
      input: peFixture(PE_MACHINES.x64, { dosSignature: false }),
      code: "PE_DOS_SIGNATURE_INVALID"
    },
    {
      input: peFixture(PE_MACHINES.x64, { peOffset: 0x20, size: 0x80 }),
      code: "PE_HEADER_OFFSET_INVALID"
    },
    {
      input: peFixture(PE_MACHINES.x64, { peSignature: false }),
      code: "PE_SIGNATURE_INVALID"
    },
    {
      input: peFixture(PE_MACHINES.x64, { size: 0x80 + 8 }),
      code: "PE_COFF_HEADER_TRUNCATED"
    }
  ];

  for (const entry of cases) {
    const result = parsePeMachineArchitecture(entry.input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, entry.code);
    assert.equal(typeof result.error.message, "string");
    assert.ok(result.error.message.length > 0);
  }
});

test("rejects an unknown PE machine rather than guessing an architecture", () => {
  const result = parsePeMachineArchitecture(peFixture(0x01c4));
  assert.equal(result.ok, false);
  assert.deepEqual(result.error, {
    code: "PE_MACHINE_UNSUPPORTED",
    message: "Unsupported PE machine type",
    details: { machine: 0x01c4 }
  });
});

test("validates architecture and all approved Windows VersionInfo fields", () => {
  const productPattern = /^Example AI Desktop$/gi;
  productPattern.lastIndex = 7;

  const result = validateWindowsInstallerIdentity({
    buffer: peFixture(PE_MACHINES.x64),
    versionInfo: actualVersionInfo(),
    expected: {
      architecture: "x64",
      versionInfo: expectedVersionInfo({ ProductName: productPattern })
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    architecture: "x64",
    machine: PE_MACHINES.x64,
    peHeaderOffset: 0x80,
    versionInfo: actualVersionInfo()
  });
  assert.equal(productPattern.lastIndex, 7);
});

test("accepts exact string expectations as a JSON-friendly policy form", () => {
  const result = validateWindowsInstallerIdentity({
    buffer: peFixture(PE_MACHINES.arm64),
    versionInfo: actualVersionInfo(),
    expected: {
      architecture: "arm64",
      versionInfo: {
        ProductName: "Example AI Desktop",
        OriginalFilename: "ExampleAISetup.exe"
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.architecture, "arm64");
});

test("returns all architecture and VersionInfo mismatches as structured issues", () => {
  const result = validateWindowsInstallerIdentity({
    buffer: peFixture(PE_MACHINES.x86),
    versionInfo: actualVersionInfo({
      ProductName: "Lookalike",
      OriginalFilename: "",
      CompanyName: undefined
    }),
    expected: {
      architecture: "x64",
      versionInfo: expectedVersionInfo()
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INSTALLER_IDENTITY_MISMATCH");
  assert.deepEqual(
    result.error.issues.map((issue) => [issue.code, issue.field]),
    [
      ["ARCHITECTURE_MISMATCH", "architecture"],
      ["VERSION_INFO_MISMATCH", "ProductName"],
      ["VERSION_INFO_MISSING", "OriginalFilename"],
      ["VERSION_INFO_MISSING", "CompanyName"]
    ]
  );
  assert.equal(result.error.issues[0].expected, "x64");
  assert.equal(result.error.issues[0].actual, "x86");
  assert.equal(result.error.issues[1].actual, "Lookalike");
});

test("rejects invalid or typoed product policies before inspecting the payload", () => {
  const cases = [
    {
      expected: null,
      issue: "EXPECTED_POLICY_INVALID"
    },
    {
      expected: {
        architecture: "ia64",
        versionInfo: { ProductName: /Example/ }
      },
      issue: "EXPECTED_ARCHITECTURE_UNSUPPORTED"
    },
    {
      expected: { architecture: "x64", versionInfo: {} },
      issue: "VERSION_INFO_EXPECTATIONS_REQUIRED"
    },
    {
      expected: {
        architecture: "x64",
        versionInfo: { Productname: /typo/ }
      },
      issue: "VERSION_INFO_FIELD_UNSUPPORTED"
    },
    {
      expected: {
        architecture: "x64",
        versionInfo: { ProductName: { contains: "Example" } }
      },
      issue: "VERSION_INFO_PATTERN_INVALID"
    }
  ];

  for (const entry of cases) {
    const result = validateWindowsInstallerIdentity({
      buffer: Buffer.alloc(0),
      versionInfo: {},
      expected: entry.expected
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INSTALLER_IDENTITY_POLICY_INVALID");
    assert.equal(result.error.issues[0].code, entry.issue);
  }
});

test("propagates a structured PE parsing failure through the validation seam", () => {
  const result = validateWindowsInstallerIdentity({
    buffer: Buffer.from("not a PE"),
    versionInfo: actualVersionInfo(),
    expected: {
      architecture: "x64",
      versionInfo: expectedVersionInfo()
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PE_DOS_HEADER_TRUNCATED");
});

test("allows a pinned signed installer that has no usable VersionInfo resource", () => {
  const result = validateWindowsInstallerIdentity({
    buffer: peFixture(0x8664),
    versionInfo: {},
    expected: {
      architecture: "x64",
      versionInfoUnavailable: "qt-installer-framework-empty-version-resource"
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.versionInfo, {});
});

test("the identity module is in-process only and cannot execute platform commands", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../shared/windows-installer-identity.cjs"),
    "utf8"
  );
  assert.doesNotMatch(source, /powershell/i);
  assert.doesNotMatch(source, /child_process|execFile|spawn\s*\(/);
  assert.doesNotMatch(source, /require\(["']node:(?:fs|path|os)["']\)/);
});
