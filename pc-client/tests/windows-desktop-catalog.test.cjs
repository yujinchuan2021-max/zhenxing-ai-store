"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { cliInstallPlans } = require("../shared/install-registry.cjs");
const catalog = require("../admin/data/catalog-v1.json");
const {
  WINDOWS_DESKTOP_PRODUCTS
} = require("../shared/windows-desktop-catalog.cjs");
const {
  getProductIntakeDossier,
  getInstallRegistration,
  INSTALL_MODES
} = require("../shared/install-registry.cjs");
const {
  getManagedDownload,
  matchesManagedDownload
} = require("../shared/managed-downloads.cjs");
const {
  validateWindowsInstallerIdentity
} = require("../shared/windows-installer-identity.cjs");

function peFixture(machine) {
  const peOffset = 0x80;
  const buffer = Buffer.alloc(peOffset + 24);
  buffer.write("MZ", 0, "ascii");
  buffer.writeUInt32LE(peOffset, 0x3c);
  buffer.write("PE\0\0", peOffset, "binary");
  buffer.writeUInt16LE(machine, peOffset + 4);
  return buffer;
}

test("only fully approved Windows desktops enter the local execution whitelist", () => {
  const productIds = Object.keys(WINDOWS_DESKTOP_PRODUCTS);
  const approvedProductIds = productIds.filter((productId) =>
    getProductIntakeDossier(productId)
  );
  assert.equal(productIds.length, 35);
  assert.equal(approvedProductIds.length, 35);
  assert.deepEqual(
    productIds.filter((productId) => !approvedProductIds.includes(productId)),
    []
  );
  for (const productId of ["msty-go", "letta-agent"]) {
    assert.equal(
      WINDOWS_DESKTOP_PRODUCTS[productId].adapter.ownershipPolicy,
      "post-install-registry-receipt",
      productId
    );
    assert.ok(getProductIntakeDossier(productId), productId);
  }
  assert.equal(
    WINDOWS_DESKTOP_PRODUCTS["msty-go"].adapter.installerLifecycle,
    "foreground"
  );
  const products = new Map(
    catalog.vendors.flatMap((vendor) =>
      vendor.products.map((product) => [product.id, { vendor, product }])
    )
  );
  for (const [productId, definition] of Object.entries(
    WINDOWS_DESKTOP_PRODUCTS
  )) {
    const catalogEntry = products.get(productId);
    assert.ok(catalogEntry, productId);
    assert.equal(catalogEntry.vendor.id, definition.vendorId, productId);
    const approved = Boolean(getProductIntakeDossier(productId));
    assert.equal(
      catalogEntry.product.productType,
      approved ? "desktop-reviewed" : "desktop-official",
      productId
    );
    assert.equal(
      catalogEntry.product.moduleId,
      approved ? "desktop-managed" : "desktop-official",
      productId
    );
    if (approved) {
      const registration = getInstallRegistration(productId);
      assert.equal(
        catalogEntry.product.installProfileId,
        registration.profileId,
        productId
      );
      if (registration.mode === INSTALL_MODES.MANAGED_INSTALLER) {
        assert.equal(
          matchesManagedDownload(productId, catalogEntry.product.download),
          true,
          productId
        );
      } else {
        assert.equal(
          registration.mode,
          INSTALL_MODES.MANAGED_PACKAGE_MANAGER,
          productId
        );
        assert.equal(catalogEntry.product.downloadPolicy, "package-manager");
        assert.equal(Object.hasOwn(catalogEntry.product, "download"), false);
      }
      assert.equal(
        registration.vendorId,
        definition.vendorId,
        productId
      );
    } else {
      assert.equal(catalogEntry.product.installProfileId, "", productId);
      assert.equal(Object.hasOwn(catalogEntry.product, "download"), false, productId);
    }
    if (definition.download.portable) {
      const portable = getManagedDownload(productId)?.portable;
      if ((portable?.signaturePolicy || "signed") === "signed") {
        assert.ok(portable.expectedExecutableSigner instanceof RegExp);
      } else {
        assert.equal(portable.signaturePolicy, "pinned-unsigned");
        assert.equal(portable.expectedExecutableSigner, undefined);
      }
    } else {
      assert.ok(getManagedDownload(productId)?.expectedSigner instanceof RegExp);
    }
    assert.match(definition.download.url, /^https:\/\//);
    if (definition.download.installerKind === "portable-zip") {
      assert.match(definition.download.fileName, /Windows-x64\.zip$/i);
    } else if (productId === "tencent-qclaw") {
      assert.equal(definition.download.fileName, "QClaw-0.2.35-Windows.exe");
    } else {
      assert.match(definition.download.fileName, /Windows-x64\.exe$/i);
    }
    if (definition.download.expectedSha256) {
      assert.match(definition.download.expectedSha256, /^[a-f0-9]{64}$/);
    }
  }
});

test("Wispr Flow keeps its rolling official download behind signer and PE identity gates", () => {
  const download = getManagedDownload("wispr-flow-desktop");
  assert.equal(download.url, "https://dl.wisprflow.ai/windows/latest");
  assert.deepEqual(download.allowedHosts, [
    "dl.wisprflow.ai",
    "dl.wisprflow.com"
  ]);
  assert.match(download.expectedSigner.source, /Wispr AI/);
  assert.equal(download.expectedInstallerIdentity.architecture, "x86");
  assert.equal(
    download.expectedInstallerIdentity.versionInfo.CompanyName,
    "Wispr Flow"
  );
  assert.equal(
    WINDOWS_DESKTOP_PRODUCTS["wispr-flow-desktop"].adapter.uninstall.allowMsi,
    false
  );
  assert.equal(
    WINDOWS_DESKTOP_PRODUCTS["wispr-flow-desktop"].adapter.uninstall.executableName.source,
    "^Update\\.exe$"
  );
  assert.deepEqual(
    WINDOWS_DESKTOP_PRODUCTS["wispr-flow-desktop"].adapter.uninstall.allowedArguments,
    [["--uninstall"], ["--uninstall", "-s"]]
  );
  assert.deepEqual(
    WINDOWS_DESKTOP_PRODUCTS["wispr-flow-desktop"].adapter.uninstall.launchArguments,
    ["--uninstall"]
  );
  const product = catalog.vendors
    .flatMap((vendor) => vendor.products)
    .find((candidate) => candidate.id === "wispr-flow-desktop");
  assert.equal(product.website, "https://wisprflow.ai/");
  assert.equal(
    product.entryPoints.find((entry) => entry.type === "desktop").url,
    undefined
  );
});

test("the first managed desktop expansion keeps sources, identity and lifecycle client-owned", () => {
  const expected = {
    "jan-desktop": {
      host: "github.com",
      signer: /Jan AI/,
      updateOwner: "jan"
    },
    "microsoft-vscode": {
      host: "update.code.visualstudio.com",
      signer: /Microsoft Corporation/,
      updateOwner: "visual-studio-code"
    },
    "zed-editor": {
      host: "zed.dev",
      signer: /Zed Industries/,
      updateOwner: "zed"
    }
  };
  for (const [productId, policy] of Object.entries(expected)) {
    const download = getManagedDownload(productId);
    const registration = getInstallRegistration(productId);
    assert.equal(new URL(download.url).hostname, policy.host, productId);
    assert.match(download.expectedSigner.source, policy.signer, productId);
    assert.ok(download.expectedInstallerIdentity, productId);
    assert.equal(
      registration.desktopAdapterId,
      WINDOWS_DESKTOP_PRODUCTS[productId].adapterId,
      productId
    );
    assert.equal(
      require("../shared/desktop-lifecycle.cjs").getDesktopLifecycle(productId)
        .updateOwner,
      policy.updateOwner,
      productId
    );
  }
});

test("x64 desktop payloads accept their observed x86 installer bootstrappers", () => {
  const versionInfoByProduct = {
    "jan-desktop": {
      ProductName: "Jan",
      FileDescription: "Jan"
    },
    "microsoft-vscode": {
      ProductName: "Visual Studio Code",
      FileDescription: "Visual Studio Code Setup",
      CompanyName: "Microsoft Corporation"
    },
    "zed-editor": {
      ProductName: "Zed",
      FileDescription: "Zed Setup",
      CompanyName: "Zed Industries"
    },
    "intel-ai-playground": {
      ProductName: "AI Playground",
      CompanyName: "Intel"
    },
    "invokeai-community-edition": {}
  };
  for (const [productId, versionInfo] of Object.entries(versionInfoByProduct)) {
    const expected = getManagedDownload(productId).expectedInstallerIdentity;
    const result = validateWindowsInstallerIdentity({
      buffer: peFixture(0x014c),
      versionInfo,
      expected
    });
    assert.equal(result.ok, true, `${productId}: ${JSON.stringify(result)}`);
    assert.equal(
      require("../shared/desktop-lifecycle.cjs").getDesktopLifecycle(productId)
        .installerIdentity.downloadedFile.architecture,
      "x86",
      productId
    );
  }
});

test("sampled desktop artifacts match their localized signer and PE contracts", () => {
  const observed = {
    jianying: {
      machine: 0x8664,
      signer: "CN=深圳市脸萌科技有限公司, O=深圳市脸萌科技有限公司, L=深圳市, S=广东省, C=CN",
      versionInfo: {
        ProductName: "剪映专业版",
        FileDescription: "JianyingPro",
        CompanyName: "ByteDance"
      }
    },
    "trae-desktop": {
      machine: 0x014c,
      signer: "CN=北京引力弹弓科技有限公司, O=北京引力弹弓科技有限公司, S=北京市, C=CN",
      versionInfo: {
        ProductName: "Trae CN",
        FileDescription: "Trae CN Setup",
        CompanyName: "Beijing Yinli Catapult Technology Co., Ltd."
      }
    },
    "trae-solo-cn": {
      machine: 0x014c,
      signer: "CN=北京引力弹弓科技有限公司, O=北京引力弹弓科技有限公司, S=北京市, C=CN",
      versionInfo: {
        ProductName: "TRAE Work CN",
        FileDescription: "TRAE Work CN Setup",
        CompanyName: "Beijing Yinli Catapult Technology Co., Ltd."
      }
    },
    "bytedance-doubao": {
      machine: 0x8664,
      signer: "CN=北京春田知韵科技有限公司, O=北京春田知韵科技有限公司, S=北京市, C=CN",
      versionInfo: {
        ProductName: "Doubao Installer",
        FileDescription: "Doubao Installer",
        OriginalFilename: "Doubao Installer.exe",
        CompanyName: "Beijing Chuntian Zhiyun Technology Co., Ltd."
      }
    },
    "google-antigravity-desktop": {
      machine: 0x014c,
      signer: "CN=Google LLC, O=Google LLC, L=Mountain View, S=California, C=US",
      versionInfo: {
        ProductName: "Antigravity",
        FileDescription: "Antigravity - Agentic Desktop Application",
        CompanyName: "Google"
      }
    },
    "cursor-desktop": {
      machine: 0x014c,
      signer: 'CN="Anysphere, Inc.", O="Anysphere, Inc.", L=San Francisco, S=California, C=US',
      versionInfo: {
        ProductName: "Cursor",
        FileDescription: "Cursor Setup",
        CompanyName: "Anysphere"
      }
    }
  };
  for (const [productId, sample] of Object.entries(observed)) {
    const download = getManagedDownload(productId);
    download.expectedSigner.lastIndex = 0;
    assert.equal(download.expectedSigner.test(sample.signer), true, productId);
    assert.equal(
      validateWindowsInstallerIdentity({
        buffer: peFixture(sample.machine),
        versionInfo: sample.versionInfo,
        expected: download.expectedInstallerIdentity
      }).ok,
      true,
      productId
    );
  }
});

test("second sampled batch matches its fixed installer identities", () => {
  const observed = {
    "kimi-work-desktop": {
      machine: 0x014c,
      signer: "CN=北京月之暗面科技有限公司, O=北京月之暗面科技有限公司, S=北京市, C=CN",
      versionInfo: { ProductName: "Kimi" }
    },
    "alibaba-qoder-cn-ide": {
      machine: 0x014c,
      signer: "CN=BRIGHT ZENITH PRIVATE LIMITED, O=BRIGHT ZENITH PRIVATE LIMITED, L=Singapore, S=Singapore, C=SG",
      versionInfo: {
        ProductName: "Qoder                                                       ",
        FileDescription: "Qoder Setup                                                 ",
        CompanyName: "Qoder                                                       "
      }
    },
    "tencent-yuanbao-desktop": {
      machine: 0x014c,
      signer: "CN=Tencent Technology (Shenzhen) Company Limited, O=Tencent Technology (Shenzhen) Company Limited, C=CN",
      versionInfo: {
        ProductName: "元宝",
        FileDescription: "腾讯元宝",
        CompanyName: "Tencent"
      }
    },
    "tencent-codebuddy": {
      machine: 0x8664,
      signer: "CN=Tencent Technology (Shenzhen) Company Limited, O=Tencent Technology (Shenzhen) Company Limited, C=CN",
      versionInfo: {
        ProductName: "CodeBuddy                                                   ",
        FileDescription: "CodeBuddy Setup                                             ",
        CompanyName: "Tencent Technology (Shenzhen) Company Limited               "
      }
    },
    "tencent-workbuddy": {
      machine: 0x014c,
      signer: "CN=Tencent Technology (Shenzhen) Company Limited, O=Tencent Technology (Shenzhen) Company Limited, C=CN",
      versionInfo: {
        ProductName: "WorkBuddy",
        FileDescription: "WorkBuddy Desktop - AI Agent Desktop Application",
        CompanyName: "Tencent Technology (Shenzhen) Company Limited"
      }
    },
    "tencent-qclaw": {
      machine: 0x014c,
      signer: "CN=Tencent Technology (Shenzhen) Company Limited, O=Tencent Technology (Shenzhen) Company Limited, C=CN",
      versionInfo: {
        ProductName: "腾讯 QClaw",
        FileDescription: "腾讯 QClaw",
        OriginalFilename: "QClawDownload.exe",
        CompanyName: "Tencent"
      }
    }
  };
  for (const [productId, sample] of Object.entries(observed)) {
    const download = getManagedDownload(productId);
    download.expectedSigner.lastIndex = 0;
    assert.equal(download.expectedSigner.test(sample.signer), true, productId);
    assert.equal(
      validateWindowsInstallerIdentity({
        buffer: peFixture(sample.machine),
        versionInfo: sample.versionInfo,
        expected: download.expectedInstallerIdentity
      }).ok,
      true,
      productId
    );
  }
});

test("final existing desktop batch matches its sampled installer identities", () => {
  const observed = {
    "alibaba-qoderwork-cn": {
      machine: 0x014c,
      signer: "CN=BRIGHT ZENITH PRIVATE LIMITED, O=BRIGHT ZENITH PRIVATE LIMITED, C=SG",
      versionInfo: {
        ProductName: "QoderWork",
        FileDescription: "QoderWork - Beyond chat, get it done",
        CompanyName: "Qoder"
      }
    },
    "tencent-ima": {
      machine: 0x8664,
      signer: "CN=Tencent Technology (Shenzhen) Company Limited, O=Tencent Technology (Shenzhen) Company Limited, C=CN",
      versionInfo: {
        ProductName: "ima installer",
        FileDescription: "ima installer",
        OriginalFilename: "ima_installer.exe",
        CompanyName: "Tencent"
      }
    },
    "lm-studio-desktop": {
      machine: 0x014c,
      signer: "CN=Element Labs Inc., O=Element Labs Inc., C=US",
      versionInfo: {
        ProductName: "LM Studio",
        FileDescription: "Discover, download, and run LLMs locally",
        CompanyName: "LM Studio"
      }
    },
    "gpt4all-desktop": {
      machine: 0x8664,
      signer: 'CN="Nomic, Inc", O="Nomic, Inc", C=US',
      versionInfo: {}
    },
    "anythingllm-desktop": {
      machine: 0x014c,
      signer: "CN=Mintplex Labs Inc, O=Mintplex Labs Inc, C=US",
      versionInfo: {
        ProductName: "AnythingLLM",
        FileDescription: "AnythingLLM | Stop Renting Intelligence. Own It.",
        CompanyName: "Mintplex Labs Inc"
      }
    },
    "amazon-kiro-ide": {
      machine: 0x014c,
      signer: 'CN="Amazon.com, Inc.", OU=AWS Kiro, O="Amazon.com, Inc.", C=US',
      versionInfo: {
        ProductName: "Kiro                                                        ",
        FileDescription: "Kiro Setup                                                  ",
        CompanyName: "Amazon Web Services                                         "
      }
    },
    "nvidia-ai-workbench": {
      machine: 0x014c,
      signer: "CN=NVIDIA Corporation, O=NVIDIA Corporation, C=US",
      versionInfo: {
        ProductName: "NVIDIA AI Workbench",
        FileDescription: "NVIDIA AI Workbench",
        CompanyName: "NVIDIA Corporation"
      }
    },
    opencode: {
      machine: 0x014c,
      signer: 'CN="Anomaly Innovations, Inc https://anoma.ly/", O="Anomaly Innovations, Inc https://anoma.ly/", C=US',
      versionInfo: {
        ProductName: "OpenCode",
        CompanyName: "OpenCode"
      }
    }
  };
  for (const [productId, sample] of Object.entries(observed)) {
    const download = getManagedDownload(productId);
    download.expectedSigner.lastIndex = 0;
    assert.equal(download.expectedSigner.test(sample.signer), true, productId);
    assert.equal(
      validateWindowsInstallerIdentity({
        buffer: peFixture(sample.machine),
        versionInfo: sample.versionInfo,
        expected: download.expectedInstallerIdentity
      }).ok,
      true,
      productId
    );
  }
});

test("Comet uses the exact reviewed package-manager identity instead of its unstable public entrypoint", () => {
  assert.deepEqual(getManagedDownload("perplexity-comet").allowedHosts, [
    "www.perplexity.ai",
    "pplx-browser-binaries.a0adf9b772aecba4fa8883581f3c9180.r2.cloudflarestorage.com"
  ]);
  const registration = getInstallRegistration("perplexity-comet");
  assert.equal(registration.mode, INSTALL_MODES.MANAGED_PACKAGE_MANAGER);
  assert.equal(registration.packageManager.packageId, "Perplexity.Comet");
  assert.ok(getProductIntakeDossier("perplexity-comet"));
  const product = catalog.vendors
    .flatMap((vendor) => vendor.products)
    .find((candidate) => candidate.id === "perplexity-comet");
  assert.equal(product.downloadPolicy, "package-manager");
  assert.equal(Object.hasOwn(product, "download"), false);
});

test("WSL stays an optional environment instead of a standalone product", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.some((product) => product.id === "wsl"), false);
  assert.deepEqual(
    products.find((product) => product.id === "nvidia-ai-workbench")
      .requirements,
    []
  );
});

test("non-desktop features and extensions are not advertised as installers", () => {
  const types = Object.fromEntries(
    catalog.vendors
      .flatMap((vendor) => vendor.products)
      .filter((product) =>
        [
          "claude-cowork",
          "kimi-claw-desktop",
          "baidu-comate",
          "nous-hermes-agent",
          "cline-agent"
        ].includes(product.id)
      )
      .map((product) => [product.id, product.productType])
  );
  assert.deepEqual(types, {
    "claude-cowork": "web",
    "kimi-claw-desktop": "tutorial",
    "baidu-comate": "web",
    "nous-hermes-agent": "cli-official",
    "cline-agent": "tutorial"
  });
});

test("OpenClaw exposes native Windows Hub and a managed WSL deployment", () => {
  const products = new Map(
    catalog.vendors
      .flatMap((vendor) => vendor.products)
      .map((product) => [product.id, product])
  );
  const windowsHub = products.get("openclaw-windows-hub");
  const wslGateway = products.get("openclaw-wsl-gateway");

  assert.equal(windowsHub?.productType, "desktop-reviewed");
  assert.equal(windowsHub?.moduleId, "desktop-managed");
  assert.equal(windowsHub?.installProfileId, "desktop.openclaw-windows-hub.windows");
  assert.deepEqual(windowsHub?.requirements, []);

  assert.equal(wslGateway?.productType, "cli");
  assert.equal(wslGateway?.moduleId, "cli-managed");
  assert.equal(wslGateway?.installProfileId, "cli.openclaw-wsl");
  assert.deepEqual(wslGateway?.requirements, ["wsl"]);
  assert.equal(
    cliInstallPlans()["openclaw-wsl-gateway"].driver,
    "companion-runtime"
  );
  assert.equal(
    cliInstallPlans()["openclaw-wsl-gateway"].distribution,
    "OpenClawGateway"
  );
  assert.equal(
    cliInstallPlans()["openclaw-wsl-gateway"].requiresInstallDirectory,
    false
  );

  const openClawAdapter = WINDOWS_DESKTOP_PRODUCTS["openclaw-windows-hub"].adapter;
  assert.equal(openClawAdapter.uninstallMode, "interactive");
  assert.deepEqual(openClawAdapter.closeProcessNames, [
    "OpenClaw.Tray.WinUI.exe"
  ]);
  assert.equal(openClawAdapter.closeProcessStrategy, "force-after-grace");
  assert.deepEqual(openClawAdapter.uninstall.launchArguments, []);
  assert.deepEqual(openClawAdapter.uninstall.allowedArguments, [[]]);
});
