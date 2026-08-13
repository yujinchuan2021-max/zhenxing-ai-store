"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createWindowsPackageManagerReceipt,
  WINDOWS_PACKAGE_MANAGER_OPERATIONS,
  WINDOWS_PACKAGE_MANAGER_SOURCES,
  findWingetListEntry,
  parseWingetListOutput,
  parseWindowsPackageManagerReceiptJson,
  validateWindowsPackageManagerPlan,
  windowsPackageManagerReceiptMatches,
  wingetArgsFor,
  wingetListAllArgs
} = require("../shared/windows-package-manager.cjs");
const {
  APPROVED_ROWS_SHA256,
  WINDOWS_PACKAGE_MANAGER_PRODUCTS,
  getWindowsPackageManagerProduct,
  rowsAreApproved,
  rowsSha256
} = require("../shared/windows-package-manager-catalog.cjs");

const plan = {
  driver: "winget",
  source: "winget",
  packageId: "Microsoft.VisualStudioCode",
  command: "powershell.exe",
  args: ["--override", "hostile"]
};

test("the reviewed Windows package-manager catalog is pinned", () => {
  assert.equal(Object.keys(WINDOWS_PACKAGE_MANAGER_PRODUCTS).length, 132);
  assert.equal(rowsSha256(), APPROVED_ROWS_SHA256);
  assert.equal(rowsAreApproved(), true);
  assert.equal(
    getWindowsPackageManagerProduct("windsurf-editor")?.packageManager.packageId,
    "Codeium.Windsurf"
  );
  assert.deepEqual(
    {
      packageId:
        getWindowsPackageManagerProduct("raycast-windows")?.packageManager
          .packageId,
      source:
        getWindowsPackageManagerProduct("raycast-windows")?.packageManager
          .source
    },
    { packageId: "9PFXXSHC64H3", source: "msstore" }
  );
});

test("plans accept only the fixed winget driver, source and a safe package ID", () => {
  assert.deepEqual(validateWindowsPackageManagerPlan(plan), {
    driver: "winget",
    source: "winget",
    packageId: "Microsoft.VisualStudioCode"
  });
  for (const invalidPlan of [
    null,
    { ...plan, driver: "shell" },
    { ...plan, source: "attacker" },
    { ...plan, packageId: "Microsoft.VisualStudioCode --override hostile" },
    { ...plan, packageId: " Microsoft.VisualStudioCode" }
  ]) {
    assert.throws(() => validateWindowsPackageManagerPlan(invalidPlan));
  }
  assert.deepEqual(WINDOWS_PACKAGE_MANAGER_SOURCES, ["winget", "msstore"]);
  assert.deepEqual(
    validateWindowsPackageManagerPlan({
      driver: "winget",
      source: "msstore",
      packageId: "9NHT9RB2F4HD"
    }),
    {
      driver: "winget",
      source: "msstore",
      packageId: "9NHT9RB2F4HD"
    }
  );
});

test("winget arguments are generated from a closed operation set", () => {
  const expected = {
    list: [
      "list", "--id", plan.packageId, "--exact", "--source", "winget",
      "--accept-source-agreements", "--disable-interactivity"
    ],
    install: [
      "install", "--id", plan.packageId, "--exact", "--source", "winget",
      "--interactive", "--accept-package-agreements",
      "--accept-source-agreements", "--disable-interactivity"
    ],
    reinstall: [
      "install", "--id", plan.packageId, "--exact", "--source", "winget",
      "--force", "--interactive", "--accept-package-agreements",
      "--accept-source-agreements", "--disable-interactivity"
    ],
    upgrade: [
      "upgrade", "--id", plan.packageId, "--exact", "--source", "winget",
      "--interactive", "--accept-package-agreements",
      "--accept-source-agreements", "--disable-interactivity"
    ],
    uninstall: [
      "uninstall", "--id", plan.packageId, "--exact", "--source", "winget",
      "--interactive", "--disable-interactivity"
    ]
  };

  assert.deepEqual(WINDOWS_PACKAGE_MANAGER_OPERATIONS, Object.keys(expected));
  assert.deepEqual(wingetListAllArgs(), [
    "list", "--accept-source-agreements", "--disable-interactivity"
  ]);
  for (const operation of WINDOWS_PACKAGE_MANAGER_OPERATIONS) {
    const args = wingetArgsFor(operation, plan);
    assert.deepEqual(args, expected[operation]);
    assert.equal(args.includes("powershell.exe"), false);
    assert.equal(args.includes("--override"), false);
  }
  assert.throws(() => wingetArgsFor("run", plan), /Unsupported winget operation/);
});

test("Microsoft Store arguments use only the fixed Store source and package ID", () => {
  const storePlan = {
    driver: "winget",
    source: "msstore",
    packageId: "9NHT9RB2F4HD"
  };
  assert.deepEqual(wingetArgsFor("install", storePlan), [
    "install", "--id", storePlan.packageId, "--exact", "--source", "msstore",
    "--interactive", "--accept-package-agreements",
    "--accept-source-agreements", "--disable-interactivity"
  ]);
});

test("package-manager receipts bind ownership to one fixed product and package", () => {
  const receipt = createWindowsPackageManagerReceipt({
    productId: "audacity-desktop",
    plan: {
      driver: "winget",
      source: "winget",
      packageId: "Audacity.Audacity"
    },
    installedVersion: "3.7.8",
    installedAt: "2026-08-04T10:00:00.000Z"
  });
  assert.deepEqual(parseWindowsPackageManagerReceiptJson(JSON.stringify(receipt)), receipt);
  assert.equal(
    windowsPackageManagerReceiptMatches(receipt, "audacity-desktop", {
      driver: "winget",
      source: "winget",
      packageId: "audacity.audacity"
    }),
    true
  );
  assert.equal(
    windowsPackageManagerReceiptMatches(receipt, "audacity-desktop", {
      driver: "winget",
      source: "msstore",
      packageId: "Audacity.Audacity"
    }),
    false
  );
  assert.equal(
    windowsPackageManagerReceiptMatches(receipt, "other-product", {
      driver: "winget",
      source: "winget",
      packageId: "Audacity.Audacity"
    }),
    false
  );
  assert.throws(() =>
    parseWindowsPackageManagerReceiptJson(
      JSON.stringify({ ...receipt, productId: "../audacity" })
    )
  );
});

test("winget list parsing handles an exact result and a complete table", () => {
  const output = [
    "Name                                Id                         Version Available Source",
    "---------------------------------------------------------------------------------------",
    "Microsoft Visual Studio Code (User) Microsoft.VisualStudioCode 1.127.0 1.130.0   winget",
    "夸克                               Alibaba.Quark               7.8.0              winget",
    "Microsoft Copilot                  9NHT9RB2F4HD                 1.0.0              msstore",
    "ima.copilot                        XP9CKMX1L8WXW7               Unknown            msstore"
  ].join("\r\n");

  assert.deepEqual(parseWingetListOutput(output), [
    {
      name: "Microsoft Visual Studio Code (User)",
      packageId: "Microsoft.VisualStudioCode",
      version: "1.127.0",
      availableVersion: "1.130.0",
      source: "winget"
    },
    {
      name: "夸克",
      packageId: "Alibaba.Quark",
      version: "7.8.0",
      availableVersion: "",
      source: "winget"
    },
    {
      name: "Microsoft Copilot",
      packageId: "9NHT9RB2F4HD",
      version: "1.0.0",
      availableVersion: "",
      source: "msstore"
    },
    {
      name: "ima.copilot",
      packageId: "XP9CKMX1L8WXW7",
      version: "Unknown",
      availableVersion: "",
      source: "msstore"
    }
  ]);
  assert.equal(
    findWingetListEntry(output, "microsoft.visualstudiocode")?.version,
    "1.127.0"
  );
  assert.equal(findWingetListEntry(output, "Zoom.Zoom"), null);
});

test("winget list parsing treats no-match and unrelated output as empty", () => {
  for (const output of [
    "No installed package found matching input criteria.",
    "没有找到符合输入条件的已安装程序包。",
    "",
    "Downloading source index..."
  ]) {
    assert.deepEqual(parseWingetListOutput(output), []);
  }
});
