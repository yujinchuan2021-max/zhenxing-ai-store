"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createPortableDesktopLayout,
  createPortableDesktopReceipt,
  createPortableDesktopUninstallAction,
  inspectPortableDesktop,
  portableDesktopPlan,
  portableDesktopSignerForReceipt,
  portableDesktopTrustForReceipt
} = require("../shared/managed-portable-desktop.cjs");

const DOWNLOAD = Object.freeze({
  installerKind: "portable-zip",
  portable: Object.freeze({
    driver: "portable-desktop",
    kind: "zip-single-executable",
    version: "2.16.2",
    archiveEntry: "StabilityMatrix.exe",
    executableFileName: "StabilityMatrix.exe",
    expectedExecutableSha256: "a".repeat(64),
    expectedExecutableSigner: /^CN=Lykos LLC(?:,|$)/i,
    maximumExecutableBytes: 512 * 1024 * 1024
  })
});

const DIRECTORY_DOWNLOAD = Object.freeze({
  installerKind: "portable-zip",
  portable: Object.freeze({
    driver: "portable-desktop",
    kind: "zip-directory",
    version: "1.45.0",
    executableRelativePath: "dist-windows\\Goose.exe",
    expectedExecutableSha256: "f".repeat(64),
    expectedExecutableSigner: /^CN="?LF Open Source, LLC"?(?:,|$)/i,
    maximumExecutableBytes: 512 * 1024 * 1024,
    maximumArchiveEntries: 10_000,
    maximumExtractedBytes: 2 * 1024 * 1024 * 1024
  })
});

const UNSIGNED_DOWNLOAD = Object.freeze({
  installerKind: "portable-exe",
  portable: Object.freeze({
    driver: "portable-desktop",
    kind: "standalone-executable",
    version: "1.118.1",
    executableRelativePath: "koboldcpp.exe",
    expectedExecutableSha256: "9".repeat(64),
    signaturePolicy: "pinned-unsigned",
    maximumExecutableBytes: 700 * 1024 * 1024
  })
});

function fakeFileSystem(layout, marker, executableSize = 4096) {
  const executableMtimeMs = Date.parse("2026-08-04T00:00:00.000Z");
  const paths = new Set([
    layout.productRoot,
    layout.runtimeRoot,
    layout.directory,
    layout.executable,
    layout.marker
  ]);
  return {
    existsSync(value) {
      return paths.has(value);
    },
    realpathSync: {
      native(value) {
        if (!paths.has(value)) {
          const error = new Error("missing");
          error.code = "ENOENT";
          throw error;
        }
        return value;
      }
    },
    lstatSync(value) {
      if (!paths.has(value)) throw new Error("missing");
      const file = value === layout.executable || value === layout.marker;
      return {
        isFile: () => file,
        isSymbolicLink: () => false,
        size: value === layout.executable ? executableSize : 256,
        mtimeMs: value === layout.executable ? executableMtimeMs : 0
      };
    },
    readFileSync(value) {
      assert.equal(value, layout.marker);
      return JSON.stringify(marker);
    },
    writeFileSync(value, contents, options) {
      assert.equal(value, layout.marker);
      assert.equal(options.flag, "wx");
      marker = JSON.parse(contents);
      paths.add(value);
    },
    marker() {
      return marker;
    }
  };
}

test("portable desktop accepts only a fixed single executable ZIP contract", () => {
  assert.equal(portableDesktopPlan(DOWNLOAD).version, "2.16.2");
  assert.equal(
    portableDesktopPlan({
      ...DOWNLOAD,
      portable: { ...DOWNLOAD.portable, archiveEntry: "..\\evil.exe" }
    }),
    null
  );
  assert.equal(
    portableDesktopPlan({
      ...DOWNLOAD,
      portable: { ...DOWNLOAD.portable, expectedExecutableSigner: "Lykos" }
    }),
    null
  );
});

test("portable desktop layout stays under the fixed per-user managed root", () => {
  const layout = createPortableDesktopLayout({
    productId: "stability-matrix",
    download: DOWNLOAD,
    localAppData: "C:\\Users\\test\\AppData\\Local"
  });
  assert.equal(
    layout.productRoot,
    "C:\\Users\\test\\AppData\\Local\\ZhenXingAI\\ManagedDesktop\\stability-matrix"
  );
  assert.equal(path.win32.basename(layout.executable), "StabilityMatrix.exe");
  assert.match(layout.dataDirectory, /\\Data$/);
});

test("directory ZIPs and pinned unsigned executables have distinct fixed layouts", () => {
  const directory = createPortableDesktopLayout({
    productId: "goose-desktop",
    download: DIRECTORY_DOWNLOAD,
    localAppData: "C:\\Users\\test\\AppData\\Local"
  });
  assert.match(directory.directory, /\\runtime\\app$/);
  assert.match(directory.executable, /\\app\\dist-windows\\Goose\.exe$/);
  assert.equal(portableDesktopPlan(DIRECTORY_DOWNLOAD).kind, "zip-directory");

  const standalone = createPortableDesktopLayout({
    productId: "koboldcpp",
    download: UNSIGNED_DOWNLOAD,
    localAppData: "C:\\Users\\test\\AppData\\Local"
  });
  assert.equal(standalone.directory, standalone.productRoot);
  const receipt = {
    version: "1.118.1",
    executableSha256: "9".repeat(64)
  };
  assert.equal(
    portableDesktopTrustForReceipt(UNSIGNED_DOWNLOAD, receipt).signaturePolicy,
    "pinned-unsigned"
  );
  assert.equal(portableDesktopSignerForReceipt(UNSIGNED_DOWNLOAD, receipt), null);
});

test("portable desktop presence requires matching receipt, marker and executable", () => {
  const layout = createPortableDesktopLayout({
    productId: "stability-matrix",
    download: DOWNLOAD,
    localAppData: "C:\\Users\\test\\AppData\\Local"
  });
  const receipt = {
    driver: "portable-desktop",
    productId: "stability-matrix",
    version: "2.16.2",
    productRoot: layout.productRoot,
    directory: layout.directory,
    executable: layout.executable,
    executableSha256: "a".repeat(64),
    executableBytes: 4096,
    executableMtimeMs: Date.parse("2026-08-04T00:00:00.000Z"),
    managementId: "b".repeat(48),
    installedAt: "2026-08-04T00:00:00.000Z"
  };
  const fileSystem = fakeFileSystem(layout, {
    driver: "portable-desktop",
    productId: "stability-matrix",
    version: "2.16.2",
    executableSha256: "a".repeat(64),
    executableBytes: 4096,
    executableMtimeMs: Date.parse("2026-08-04T00:00:00.000Z"),
    managementId: "b".repeat(48)
  });
  const status = inspectPortableDesktop({
    productId: "stability-matrix",
    download: DOWNLOAD,
    receipt,
    localAppData: "C:\\Users\\test\\AppData\\Local",
    verifyIntegrity: true,
    fileSystem,
    hashFile: () => "a".repeat(64)
  });
  assert.equal(status.installed, true);
  assert.equal(status.canOpen, true);
  assert.equal(status.canUninstall, true);
  assert.equal(status.uninstallMode, "automatic");

  assert.equal(
    inspectPortableDesktop({
      productId: "stability-matrix",
      download: DOWNLOAD,
      receipt: { ...receipt, managementId: "c".repeat(48) },
      localAppData: "C:\\Users\\test\\AppData\\Local",
      fileSystem
    }).detection,
    "unknown"
  );
});

test("an explicitly approved prior version remains manageable for upgrade", () => {
  const oldSha256 = "c".repeat(64);
  const download = {
    ...DOWNLOAD,
    portable: {
      ...DOWNLOAD.portable,
      approvedPreviousExecutables: [
        {
          version: "2.16.1",
          sha256: oldSha256,
          expectedExecutableSigner: /^CN=Lykos LLC(?:,|$)/i
        }
      ]
    }
  };
  const layout = createPortableDesktopLayout({
    productId: "stability-matrix",
    download,
    localAppData: "C:\\Users\\test\\AppData\\Local"
  });
  const receipt = {
    driver: "portable-desktop",
    productId: "stability-matrix",
    version: "2.16.1",
    productRoot: layout.productRoot,
    directory: layout.directory,
    executable: layout.executable,
    executableSha256: oldSha256,
    executableBytes: 4096,
    executableMtimeMs: Date.parse("2026-08-04T00:00:00.000Z"),
    managementId: "d".repeat(48),
    installedAt: "2026-08-04T00:00:00.000Z"
  };
  const fileSystem = fakeFileSystem(layout, receipt);
  const status = inspectPortableDesktop({
    productId: "stability-matrix",
    download,
    receipt,
    localAppData: "C:\\Users\\test\\AppData\\Local",
    verifyIntegrity: true,
    fileSystem,
    hashFile: () => oldSha256
  });
  assert.equal(status.installed, true);
  assert.equal(status.version, "2.16.1");
  assert.equal(status.availableVersion, "2.16.2");
  assert.ok(portableDesktopSignerForReceipt(download, receipt) instanceof RegExp);

  assert.equal(
    inspectPortableDesktop({
      productId: "stability-matrix",
      download,
      receipt: { ...receipt, executableSha256: "e".repeat(64) },
      localAppData: "C:\\Users\\test\\AppData\\Local",
      fileSystem
    }).detection,
    "unknown"
  );
});

test("portable desktop receipt and uninstall action own only fixed runtime files", () => {
  const layout = createPortableDesktopLayout({
    productId: "stability-matrix",
    download: DOWNLOAD,
    localAppData: "C:\\Users\\test\\AppData\\Local"
  });
  const fileSystem = fakeFileSystem(layout, null);
  const receipt = createPortableDesktopReceipt({
    productId: "stability-matrix",
    download: DOWNLOAD,
    localAppData: "C:\\Users\\test\\AppData\\Local",
    fileSystem,
    hashFile: () => "a".repeat(64),
    now: () => "2026-08-04T00:00:00.000Z",
    randomBytes: () => Buffer.from("b".repeat(48), "hex")
  });
  assert.equal(receipt.managementId, "b".repeat(48));
  assert.equal(receipt.executableBytes, 4096);
  const action = createPortableDesktopUninstallAction({
    productId: "stability-matrix",
    download: DOWNLOAD,
    receipt,
    localAppData: "C:\\Users\\test\\AppData\\Local",
    fileSystem,
    hashFile: () => "a".repeat(64)
  });
  assert.equal(action.executable, layout.executable);
  assert.equal(action.marker, layout.marker);
  assert.equal(action.dataDirectory, layout.dataDirectory);
  assert.equal(Object.hasOwn(action, "recursiveDelete"), false);
});

test("desktop EXE, MSI, MSIX and ZIP packages are opened directly", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../electron/main.cjs"),
    "utf8"
  );
  const launch = source.match(
    /ipcMain\.handle\("installer:launch"[\s\S]*?ipcMain\.handle\("desktop:operation-get"/
  )?.[0];
  assert.ok(launch);
  assert.match(launch, /\(exe\|msi\|msix\|zip\)/);
  assert.match(launch, /await shell\.openPath\(resolvedFile\)/);
  assert.match(launch, /verificationMode: "manual-installer"/);
  assert.doesNotMatch(
    launch,
    /installPortableDesktopProduct|prepareInstallerLaunchArtifact|operationController\.begin\(/
  );
});
