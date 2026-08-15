const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveRegisteredEnvironmentExecutable,
  resolveEnvironmentEvidence,
  resolveEnvironmentOperationStatus,
  resolveEnvironmentUpdateOffer,
  resolveTrustedEnvironmentExecutableProbe
} = require("../shared/environment-detection.cjs");

test("accepts a PATH executable only after canonical signature verification", async () => {
  const raw = "C:\\Program Files\\Git\\cmd\\git.exe";
  const canonical = "C:\\Program Files\\Git\\cmd\\git.exe";

  assert.deepEqual(
    await resolveTrustedEnvironmentExecutableProbe({
      probe: { ok: true, location: raw },
      canonicalize: (candidate) => candidate === raw ? canonical : "",
      verify: async (candidate) => candidate === canonical
    }),
    { ok: true, location: canonical }
  );
});

test("turns an unsigned PATH executable into an unknown probe", async () => {
  assert.deepEqual(
    await resolveTrustedEnvironmentExecutableProbe({
      probe: { ok: true, location: "C:\\Temp\\git.exe" },
      canonicalize: (candidate) => candidate,
      verify: async () => false
    }),
    { ok: false, location: "" }
  );
});

test("preserves a confirmed empty PATH lookup without requesting a signature", async () => {
  let verifyCalls = 0;

  assert.deepEqual(
    await resolveTrustedEnvironmentExecutableProbe({
      probe: { ok: true, location: "" },
      canonicalize: () => {
        throw new Error("must not canonicalize an empty result");
      },
      verify: async () => {
        verifyCalls += 1;
        return true;
      }
    }),
    { ok: true, location: "" }
  );
  assert.equal(verifyCalls, 0);
});

test("detects Python from its official registry executable when it is absent from PATH", () => {
  const python = "C:\\Users\\tester\\AppData\\Local\\Programs\\Python\\Python313\\python.exe";

  assert.deepEqual(
    resolveEnvironmentEvidence({
      pathLocation: "",
      registeredLocation: python,
      exists: (candidate) => candidate === python
    }),
    {
      installed: true,
      location: python
    }
  );
});

test("does not trust a stale registered executable path", () => {
  assert.deepEqual(
    resolveEnvironmentEvidence({
      pathLocation: "",
      registeredLocation: "C:\\Missing\\python.exe",
      exists: () => false
    }),
    {
      installed: false,
      location: ""
    }
  );
});

test("uses a reviewed Windows uninstall entry when PATH has not refreshed", () => {
  const node = "C:\\Program Files\\nodejs\\node.exe";
  assert.deepEqual(
    resolveEnvironmentOperationStatus({
      evidence: { installed: true, location: node },
      registryScanOk: true,
      registryEntry: {
        displayversion: "24.18.0",
        installlocation: "C:\\Program Files\\nodejs"
      },
      uninstallAction: {
        executable: "msiexec.exe",
        args: ["/x", "{00000000-0000-0000-0000-000000000000}"]
      }
    }),
    {
      installed: true,
      version: "24.18.0",
      location: node,
      executable: node,
      appId: "",
      canOpen: true,
      canUninstall: true,
      detection: "installed"
    }
  );
});

test("resolves Node and Git executables from reviewed install locations", () => {
  const existing = new Set([
    "C:\\Program Files\\nodejs\\node.exe",
    "C:\\Program Files\\Git\\cmd\\git.exe"
  ]);
  assert.equal(
    resolveRegisteredEnvironmentExecutable({
      environmentId: "node",
      installLocation: "C:\\Program Files\\nodejs",
      exists: (candidate) => existing.has(candidate)
    }),
    "C:\\Program Files\\nodejs\\node.exe"
  );
  assert.equal(
    resolveRegisteredEnvironmentExecutable({
      environmentId: "git",
      installLocation: "C:\\Program Files\\Git",
      exists: (candidate) => existing.has(candidate)
    }),
    "C:\\Program Files\\Git\\cmd\\git.exe"
  );
});

test("resolves the dedicated Python 3.12 environment from its reviewed install location", () => {
  assert.equal(
    resolveRegisteredEnvironmentExecutable({
      environmentId: "python312",
      installLocation:
        "C:\\Users\\tester\\AppData\\Local\\Programs\\Python\\Python312",
      exists: (candidate) => candidate.endsWith("\\Python312\\python.exe")
    }),
    "C:\\Users\\tester\\AppData\\Local\\Programs\\Python\\Python312\\python.exe"
  );
});

test("rejects stale and relative registry install locations", () => {
  assert.equal(
    resolveRegisteredEnvironmentExecutable({
      environmentId: "node",
      installLocation: "nodejs",
      exists: () => true
    }),
    ""
  );
  assert.equal(
    resolveRegisteredEnvironmentExecutable({
      environmentId: "git",
      installLocation: "C:\\Missing\\Git",
      exists: () => false
    }),
    ""
  );
});

test("keeps missing evidence unknown when the Windows registry scan fails", () => {
  assert.equal(
    resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: false,
      registryEntry: null,
      uninstallAction: null
    }).detection,
    "unknown"
  );
});

test("keeps a matching registry entry unknown until its executable is gone and the entry is removed", () => {
  assert.equal(
    resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: true,
      evidenceProbeOk: true,
      registryEntry: {
        displayname: "Node.js",
        publisher: "Node.js Foundation"
      },
      registryEvidencePresent: true,
      uninstallAction: null
    }).detection,
    "unknown"
  );
});

test("does not confirm absence when the executable probe failed", () => {
  assert.equal(
    resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: true,
      evidenceProbeOk: false,
      registryEntry: null,
      registryEvidencePresent: false,
      uninstallAction: null
    }).detection,
    "unknown"
  );
});

test("confirms absence only after a complete registry scan", () => {
  assert.deepEqual(
    resolveEnvironmentOperationStatus({
      evidence: { installed: false, location: "" },
      registryScanOk: true,
      evidenceProbeOk: true,
      registryEntry: null,
      registryEvidencePresent: false,
      uninstallAction: null
    }),
    {
      installed: false,
      version: "",
      location: "",
      executable: "",
      appId: "",
      canOpen: false,
      canUninstall: false,
      detection: "absent"
    }
  );
});

test("offers an update only for a trusted installed version below the reviewed version", () => {
  assert.deepEqual(
    resolveEnvironmentUpdateOffer({
      detection: "installed",
      installedVersion: "3.12.9",
      recommendedVersion: "3.12.10"
    }),
    { recommendedVersion: "3.12.10", canUpdate: true }
  );
  for (const installedVersion of ["3.12.10", "3.13.0", "3.12", "v3.12.9", "3.12.9rc1", ""]) {
    assert.equal(
      resolveEnvironmentUpdateOffer({
        detection: "installed",
        installedVersion,
        recommendedVersion: "3.12.10"
      }).canUpdate,
      false
    );
  }
  assert.equal(
    resolveEnvironmentUpdateOffer({
      detection: "unknown",
      installedVersion: "3.12.9",
      recommendedVersion: "3.12.10"
    }).canUpdate,
    false
  );
});
