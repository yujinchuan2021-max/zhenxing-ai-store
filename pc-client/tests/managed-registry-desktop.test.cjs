"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createPendingBaseline,
  createReceiptFromTransition,
  inspectReceipt,
  isManagedRegistryPending,
  isManagedRegistryReceipt,
  parseManagedRegistryPendingJson,
  parseManagedRegistryReceiptJson
} = require("../shared/managed-registry-desktop.cjs");

const ROOT = "C:\\Apps\\Example";
const APP = `${ROOT}\\Example.exe`;
const UNINSTALLER = `${ROOT}\\unins000.exe`;
const OLD_KEY =
  "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Old";
const NEW_KEY =
  "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Example";
const HASH = "a".repeat(64);
const ADAPTER = Object.freeze({
  signer: /^CN=Example Corp(?:,|$)/i,
  executableNames: Object.freeze(["Example.exe"]),
  uninstall: Object.freeze({
    displayName: /^Example Desktop$/,
    publisher: /^Example Corp$/,
    executableName: /^unins000\.exe$/i,
    allowedArguments: Object.freeze([Object.freeze([])]),
    allowMsi: false
  })
});

function entry(key = NEW_KEY, overrides = {}) {
  return {
    key,
    displayname: "Example Desktop",
    displayversion: "1.2.3",
    publisher: "Example Corp",
    installlocation: ROOT,
    displayicon: `${APP},0`,
    uninstallstring: `"${UNINSTALLER}"`,
    ...overrides
  };
}

function fakeFileSystem(extra = []) {
  const paths = new Map(
    [ROOT, APP, UNINSTALLER, ...extra].map((value) => [
      value.toLowerCase(),
      value
    ])
  );
  return {
    exists: (value) => paths.has(value.toLowerCase()),
    realpath: (value) => {
      const result = paths.get(value.toLowerCase());
      if (!result) throw new Error("missing");
      return result;
    }
  };
}

function context(overrides = {}) {
  return {
    productId: "example-desktop",
    adapterId: "nsis.example-desktop",
    executionContractSha256: HASH,
    operationId: "install-20260804-0001",
    ...overrides
  };
}

function pending(registry = [{ key: OLD_KEY }], overrides = {}) {
  return createPendingBaseline({
    ...context(),
    startedAt: "2026-08-04T00:00:00.000Z",
    deadlineAt: "2026-08-04T00:10:00.000Z",
    registry,
    ...overrides
  });
}

async function createReceipt(overrides = {}) {
  return createReceiptFromTransition({
    pending: pending(),
    ...context(),
    adapter: ADAPTER,
    registry: [{ key: OLD_KEY }, entry()],
    ...fakeFileSystem(),
    verifySignature: async () => ({ ok: true }),
    now: () => "2026-08-04T00:01:00.000Z",
    randomBytes: () => Buffer.from("b".repeat(48), "hex"),
    ...overrides
  });
}

test("pending baseline captures every uninstall key sorted and de-duplicated", () => {
  const value = pending([
    { key: NEW_KEY.toLowerCase() },
    { key: OLD_KEY },
    { key: NEW_KEY }
  ]);
  assert.deepEqual(value.registryKeys, [NEW_KEY.toUpperCase(), OLD_KEY.toUpperCase()]);
  assert.equal(isManagedRegistryPending(value), true);
  assert.deepEqual(parseManagedRegistryPendingJson(JSON.stringify(value)), value);
  assert.equal(isManagedRegistryPending({ ...value, extra: true }), false);
});

test("unique trusted new key creates an exact double-signed receipt", async () => {
  const signatures = [];
  const receipt = await createReceipt({
    verifySignature: async (file, signer) => {
      signatures.push([file, signer]);
      return { ok: true };
    }
  });
  assert.equal(receipt.registryKey, NEW_KEY.toUpperCase());
  assert.equal(receipt.installLocation, ROOT);
  assert.equal(receipt.executable, APP);
  assert.deepEqual(receipt.uninstall, {
    kind: "executable",
    executable: UNINSTALLER,
    args: []
  });
  assert.equal(receipt.managementId, "b".repeat(48));
  assert.deepEqual(signatures.map(([file]) => file), [APP, UNINSTALLER]);
  assert.ok(signatures.every(([, signer]) => signer === ADAPTER.signer));
  assert.equal(isManagedRegistryReceipt(receipt), true);
  assert.deepEqual(parseManagedRegistryReceiptJson(JSON.stringify(receipt)), receipt);
});

test("an expired pending operation or mismatched operation id never binds", async () => {
  assert.equal(
    await createReceipt({ now: () => "2026-08-04T00:10:00.001Z" }),
    null
  );
  assert.equal(
    await createReceipt({ operationId: "install-20260804-other" }),
    null
  );
});

test("an old key remains ineligible even when all of its values change", async () => {
  assert.equal(
    await createReceipt({
      registry: [entry(OLD_KEY, { displayversion: "99.0.0" })]
    }),
    null
  );
});

test("two new trusted candidates are ambiguous and rejected", async () => {
  const secondKey = NEW_KEY.replace("Example", "Example2");
  assert.equal(
    await createReceipt({ registry: [entry(), entry(secondKey)] }),
    null
  );
});

test("InstallLocation may be derived from a trusted DisplayIcon", async () => {
  const receipt = await createReceipt({
    registry: [
      entry(NEW_KEY, {
        installlocation: "",
        displayicon: `"${APP}",0`
      })
    ]
  });
  assert.equal(receipt.installLocation, ROOT);

  assert.equal(
    await createReceipt({
      registry: [entry(NEW_KEY, { installlocation: "", displayicon: "" })]
    }),
    null
  );
});

test("path escape and either failed signature are rejected", async () => {
  const outside = "C:\\Temp\\unins000.exe";
  assert.equal(
    await createReceipt({
      registry: [entry(NEW_KEY, { uninstallstring: `"${outside}"` })],
      ...fakeFileSystem([outside])
    }),
    null
  );
  assert.equal(
    await createReceipt({
      verifySignature: async (file) => ({ ok: file !== APP })
    }),
    null
  );
  assert.equal(
    await createReceipt({
      verifySignature: async (file) => ({ ok: file !== UNINSTALLER })
    }),
    null
  );
  assert.equal(
    await createReceipt({
      verifySignature: async () => {
        throw new Error("signature inspection failed");
      }
    }),
    null
  );
});

test("inspection follows only the receipt registry key and rechecks both signatures", async () => {
  const receipt = await createReceipt();
  const signatures = [];
  const status = await inspectReceipt({
    receipt,
    ...context(),
    adapter: ADAPTER,
    registry: [entry(), entry(NEW_KEY.replace("Example", "Lookalike"))],
    ...fakeFileSystem(),
    verifySignature: async (file) => {
      signatures.push(file);
      return true;
    }
  });
  assert.equal(status.installed, true);
  assert.equal(status.ownership, "managed");
  assert.deepEqual(status.uninstallAction, receipt.uninstall);
  assert.deepEqual(signatures, [APP, UNINSTALLER]);

  const missingExact = await inspectReceipt({
    receipt,
    ...context(),
    adapter: ADAPTER,
    registry: [entry(NEW_KEY.replace("Example", "Lookalike"))],
    ...fakeFileSystem(),
    verifySignature: async () => true
  });
  assert.equal(missingExact.ownership, "managed-removal-pending");
  assert.equal(missingExact.installed, false);
  assert.equal(missingExact.detection, "unknown");

  const removed = await inspectReceipt({
    receipt,
    ...context(),
    adapter: ADAPTER,
    registry: [],
    ...fakeFileSystem(),
    exists: (filePath) => filePath !== APP && fakeFileSystem().exists(filePath),
    verifySignature: async () => true
  });
  assert.equal(removed.ownership, "managed-missing");
  assert.equal(removed.installed, false);
  assert.equal(removed.detection, "absent");
});

test("inspection rejects receipt, registry action, identity and signature tampering", async () => {
  const receipt = await createReceipt();
  const base = {
    ...context(),
    adapter: ADAPTER,
    registry: [entry()],
    ...fakeFileSystem(),
    verifySignature: async () => true
  };
  for (const changed of [
    { ...receipt, executable: "C:\\Apps\\Other\\Example.exe" },
    { ...receipt, displayVersion: "9.9.9" },
    { ...receipt, uninstall: { ...receipt.uninstall, args: ["/S"] } },
    { ...receipt, productId: "other-desktop" },
    { ...receipt, extra: true }
  ]) {
    assert.equal((await inspectReceipt({ ...base, receipt: changed })).ownership, "mismatch");
  }
  assert.equal(
    (
      await inspectReceipt({
        ...base,
        receipt,
        registry: [entry(NEW_KEY, { uninstallstring: `"${UNINSTALLER}" /S` })]
      })
    ).ownership,
    "mismatch"
  );
  assert.equal(
    (
      await inspectReceipt({
        ...base,
        receipt,
        verifySignature: async (file) => file === APP
      })
    ).ownership,
    "mismatch"
  );
  assert.equal(
    (
      await inspectReceipt({
        ...base,
        receipt,
        verifySignature: async () => {
          throw new Error("signature inspection failed");
        }
      })
    ).ownership,
    "mismatch"
  );
});

test("JSON validators reject malformed and unknown fields", async () => {
  const receipt = await createReceipt();
  assert.equal(parseManagedRegistryPendingJson("{"), null);
  assert.equal(parseManagedRegistryReceiptJson(JSON.stringify({ ...receipt, extra: 1 })), null);
  assert.equal(isManagedRegistryReceipt({ ...receipt, registryKey: "HKCU\\bad" }), false);
});

test("Electron no longer creates install monitoring receipts but keeps exact uninstall ownership", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  assert.match(source, /checkProduct: detectDesktopProductForOperation/);
  assert.match(
    source,
    /registry: registryScan\.keys\.map\(\(key\) => \(\{ key \}\)\)/
  );
  const launch = source.match(
    /ipcMain\.handle\("installer:launch"[\s\S]*?ipcMain\.handle\("desktop:operation-get"/
  )?.[0] || "";
  assert.doesNotMatch(launch, /prepareManagedRegistryDesktopPending|operationController\.begin\(/);
  assert.match(launch, /shell\.openPath\(resolvedFile\)/);
  assert.match(
    source,
    /command: record\.action\.executable,[\s\S]*?: record\.action\.args/
  );
  assert.match(
    source,
    /hadReceipt && status\.detection === "absent"[\s\S]*?removeManagedRegistryDesktopReceiptStrict/
  );
});
