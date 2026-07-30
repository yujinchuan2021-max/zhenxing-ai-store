const assert = require("node:assert/strict");
const test = require("node:test");

const { validateCatalog } = require("../shared/catalog.cjs");
const {
  getManagedDownload,
  isAllowedManagedDownloadUrl,
  matchesManagedDownload
} = require("../shared/managed-downloads.cjs");
const {
  resolveProductBehavior
} = require("../shared/product-policy.cjs");
const {
  INSTALL_MODES,
  cliInstallPlans,
  getInstallRegistration
} = require("../shared/install-registry.cjs");

function catalogWith(product, vendorId = "example") {
  return {
    schemaVersion: 1,
    vendors: [
      {
        id: vendorId,
        name: "Example",
        initial: "E",
        mark: "E",
        color: "#112233",
        description: "示例厂商。",
        website: "https://example.com",
        tutorial: "https://example.com/docs",
        products: [product]
      }
    ]
  };
}

function webProduct(overrides = {}) {
  return {
    id: "example-web",
    name: "Example Web",
    kind: "其他产品",
    category: "AI 对话",
    description: "示例网页产品。",
    website: "https://example.com/app",
    tutorial: "https://example.com/docs",
    productType: "web",
    requirements: [],
    installPolicy: "open-product-website",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "not-managed",
    ...overrides
  };
}

test("resolves web, official desktop, and tutorial products as direct links", () => {
  const web = webProduct();
  const desktop = {
    ...webProduct({
      id: "example-desktop",
      name: "Example Desktop",
      kind: "桌面端",
      website: "https://example.com/download",
      productType: "desktop-official",
      installPolicy: "open-official-download",
      downloadPolicy: "official-page",
      signaturePolicy: "vendor-controlled",
      uninstallPolicy: "vendor-managed"
    })
  };
  const tutorial = webProduct({
    id: "example-tutorial",
    name: "Example Tutorial",
    productType: "tutorial",
    installPolicy: "open-tutorial"
  });
  for (const product of [web, desktop, tutorial]) {
    assert.doesNotThrow(() => validateCatalog(catalogWith(product)));
    assert.equal(resolveProductBehavior(product).opensDirectly, true);
    assert.equal(
      resolveProductBehavior(product).requiresEnvironmentCheck,
      false
    );
  }
  assert.equal(resolveProductBehavior(tutorial).directUrl, tutorial.tutorial);
  assert.equal(
    resolveProductBehavior(desktop).installMode,
    "official-installer-page"
  );
  assert.equal(
    resolveProductBehavior(desktop).primaryLabel,
    "获取官方安装包"
  );
});

test("accepts only the reviewed Comfy Desktop installer identity and policy", () => {
  const download = {
    url: "https://download.comfy.org/windows/nsis/x64",
    fileName: "Comfy-Desktop-Setup-x64.exe"
  };
  const product = {
    id: "comfy-desktop",
    name: "Comfy Desktop",
    kind: "桌面端",
    category: "图像创作",
    description: "节点式图像工作流。",
    website: "https://www.comfy.org/download",
    tutorial: "https://docs.comfy.org",
    productType: "desktop-reviewed",
    requirements: ["python"],
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    download
  };
  assert.doesNotThrow(() => validateCatalog(catalogWith(product, "comfy")));
  assert.equal(resolveProductBehavior(product).managedDownload, true);
  assert.equal(resolveProductBehavior(product).managedDesktop, true);
  assert.equal(resolveProductBehavior(product).clientManagedInstall, true);
  assert.equal(resolveProductBehavior(product).primaryLabel, "一键安装");
  assert.match(
    getManagedDownload("comfy-desktop").expectedSigner.source,
    /Drip Artificial/
  );
  assert.equal(isAllowedManagedDownloadUrl("comfy-desktop", download.url), true);
});

test("locks reviewed desktop downloads to the current consumer distributions", () => {
  const chatgpt = getManagedDownload("chatgpt-desktop");
  assert.equal(
    chatgpt.url,
    "https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi"
  );
  assert.equal(chatgpt.fileName, "ChatGPT Installer.exe");
  assert.deepEqual(chatgpt.allowedHosts, ["get.microsoft.com"]);
  assert.match(chatgpt.expectedSigner.source, /Microsoft Corporation/);

  const claude = getManagedDownload("claude-desktop");
  assert.equal(
    claude.url,
    "https://claude.ai/api/desktop/win32/x64/exe/latest/redirect"
  );
  assert.equal(claude.fileName, "Claude-Setup-x64.exe");
  assert.deepEqual(claude.allowedHosts, [
    "claude.ai",
    "downloads.claude.ai"
  ]);
  assert.equal(
    matchesManagedDownload("claude-desktop", {
      url: "https://claude.ai/api/desktop/win32/x64/msix/latest/redirect",
      fileName: "Claude-x64.msix"
    }),
    false
  );
  assert.equal(
    isAllowedManagedDownloadUrl(
      "claude-desktop",
      "https://downloads.claude.ai/releases/win32/x64/Claude.exe"
    ),
    true
  );
  assert.equal(
    isAllowedManagedDownloadUrl(
      "claude-desktop",
      "https://downloads.claude.ai.attacker.example/Claude.exe"
    ),
    false
  );
});

test("accepts the reviewed ChatGPT and Claude desktop installer identities", () => {
  const products = [
    {
      vendorId: "openai",
      product: {
        id: "chatgpt-desktop",
        name: "ChatGPT Desktop",
        website: "https://chatgpt.com/download",
        tutorial: "https://help.openai.com",
        download: {
          url: "https://get.microsoft.com/installer/download/9PLM9XGG6VKS?cid=website_cta_psi",
          fileName: "ChatGPT Installer.exe"
        }
      },
      signer: /Microsoft Corporation/
    },
    {
      vendorId: "anthropic",
      product: {
        id: "claude-desktop",
        name: "Claude Desktop",
        website: "https://claude.com/download",
        tutorial: "https://support.claude.com",
        download: {
          url: "https://claude.ai/api/desktop/win32/x64/exe/latest/redirect",
          fileName: "Claude-Setup-x64.exe"
        }
      },
      signer: /Anthropic/
    }
  ];

  for (const { vendorId, product, signer } of products) {
    const reviewed = {
      ...product,
      kind: "桌面端",
      category: "AI 对话",
      description: `${product.name} Windows 客户端。`,
      productType: "desktop-reviewed",
      requirements: [],
      installPolicy: "client-managed-installer",
      downloadPolicy: "client-managed",
      signaturePolicy: "client-reviewed",
      uninstallPolicy: "client-managed"
    };
    assert.doesNotThrow(() => validateCatalog(catalogWith(reviewed, vendorId)));
    assert.equal(resolveProductBehavior(reviewed).managedDesktop, true);
    assert.match(
      getManagedDownload(product.id).expectedSigner.source,
      signer
    );
    assert.equal(
      isAllowedManagedDownloadUrl(product.id, product.download.url),
      true
    );
    assert.throws(
      () => validateCatalog(catalogWith(reviewed, "attacker")),
      /本地白名单/
    );
  }
});

test("rejects an approved installer ID moved to another vendor or type", () => {
  const product = {
    id: "comfy-desktop",
    name: "Comfy Desktop",
    kind: "桌面端",
    category: "图像创作",
    description: "节点式图像工作流。",
    website: "https://www.comfy.org/download",
    tutorial: "https://docs.comfy.org",
    productType: "desktop-reviewed",
    requirements: ["python"],
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    download: {
      url: "https://download.comfy.org/windows/nsis/x64",
      fileName: "Comfy-Desktop-Setup-x64.exe"
    }
  };
  assert.throws(
    () => validateCatalog(catalogWith(product, "attacker")),
    /本地白名单/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWith({ ...product, productType: "local-model" }, "comfy")
      ),
    /本地白名单/
  );
});

test("accepts Ollama as a reviewed local-model desktop policy", () => {
  const product = {
    id: "ollama-cli",
    name: "Ollama",
    kind: "桌面端",
    category: "本地模型",
    description: "本地模型运行工具。",
    website: "https://ollama.com/download",
    tutorial: "https://docs.ollama.com",
    productType: "local-model",
    requirements: [],
    installPolicy: "client-managed-installer",
    downloadPolicy: "client-managed",
    signaturePolicy: "client-reviewed",
    uninstallPolicy: "client-managed",
    download: {
      url: "https://ollama.com/download/OllamaSetup.exe",
      fileName: "OllamaSetup.exe"
    }
  };
  assert.doesNotThrow(() => validateCatalog(catalogWith(product, "ollama")));
  assert.equal(resolveProductBehavior(product).managedDesktop, true);
  assert.match(
    getManagedDownload("ollama-cli").expectedSigner.source,
    /Ollama/
  );
});

test("accepts only the reviewed CLI identity and exact dependencies", () => {
  const product = {
    id: "codex-cli",
    name: "Codex CLI",
    kind: "CLI",
    category: "编程开发",
    description: "命令行开发工具。",
    website: "https://github.com/openai/codex",
    tutorial: "https://github.com/openai/codex",
    productType: "cli",
    requirements: ["node"],
    installPolicy: "client-managed-cli",
    downloadPolicy: "none",
    signaturePolicy: "not-applicable",
    uninstallPolicy: "client-managed"
  };
  assert.doesNotThrow(() => validateCatalog(catalogWith(product, "openai")));
  assert.equal(resolveProductBehavior(product).managedCli, true);
  assert.equal(resolveProductBehavior(product).installMode, "managed-cli");
  assert.equal(resolveProductBehavior(product).primaryLabel, "一键安装");
  assert.throws(
    () =>
      validateCatalog(
        catalogWith({ ...product, requirements: ["node", "git"] }, "openai")
      ),
    /CLI 部署策略/
  );
});

test("one local installation registry drives every managed product adapter", () => {
  const plans = cliInstallPlans();
  assert.deepEqual(Object.keys(plans).sort(), [
    "claude-code",
    "codex-cli",
    "gemini-cli"
  ]);
  assert.equal(plans["codex-cli"].packageName, "@openai/codex");
  assert.equal(
    plans["claude-code"].packageName,
    "@anthropic-ai/claude-code"
  );
  assert.equal(
    getInstallRegistration("comfy-desktop").mode,
    INSTALL_MODES.MANAGED_INSTALLER
  );
  assert.equal(getInstallRegistration("unknown-product"), null);
});

test("rejects executable policy fields and unreviewed downloads", () => {
  assert.throws(
    () =>
      validateCatalog(
        catalogWith(webProduct({ command: "powershell.exe -Command calc" }))
      ),
    /不支持的策略字段/
  );
  assert.throws(
    () =>
      validateCatalog(
        catalogWith({
          ...webProduct({
            id: "example-desktop",
            kind: "桌面端",
            productType: "desktop-reviewed",
            installPolicy: "client-managed-installer",
            downloadPolicy: "client-managed",
            signaturePolicy: "client-reviewed",
            uninstallPolicy: "client-managed"
          }),
          download: {
            url: "https://example.com/Example-Setup.exe",
            fileName: "Example-Setup.exe"
          }
        })
      ),
    /托管安装包未通过客户端策略审核|本地白名单/
  );
});
