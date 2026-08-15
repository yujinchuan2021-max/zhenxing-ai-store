const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../admin/data/catalog-v1.json");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  resolveProductBehavior
} = require("../shared/product-policy.cjs");
const {
  EXTENSION_INSTALL_REGISTRY
} = require("../shared/extension-install-registry.cjs");
const {
  cliInstallPlans,
  getProductIntakeDossier
} = require("../shared/install-registry.cjs");
const {
  CLI_REVIEW_BLOCKERS
} = require("../shared/windows-cli-review-decisions.cjs");

function assertCurrentDesktopPolicy(product, productId) {
  const managed = Boolean(getProductIntakeDossier(productId));
  assert.equal(
    product.productType,
    managed ? "desktop-reviewed" : "desktop-official",
    productId
  );
  assert.equal(
    product.moduleId,
    managed ? "desktop-managed" : "desktop-official",
    productId
  );
  assert.equal(
    product.installPolicy,
    managed ? "client-managed-installer" : "open-official-download",
    productId
  );
  assert.equal(Boolean(product.installProfileId), managed, productId);
}

const PRESERVED_MANAGED_PRODUCTS = Object.freeze({
  openai: ["chatgpt-desktop", "codex-cli"],
  anthropic: ["claude-desktop", "claude-code"],
  comfy: ["comfy-desktop"],
  google: ["gemini-cli"],
  ollama: ["ollama-cli"]
});

const HIGH_VALUE_RESEARCH_PRODUCTS = Object.freeze([
  "openai-codex",
  "google-jules",
  "amazon-kiro-ide",
  "amazon-kiro-cli",
  "kimi-work-desktop",
  "kimi-claw",
  "kimi-claw-desktop",
  "kimi-webbridge",
  "moonshot-kimi-code-cli",
  "minimax-cli",
  "hf-cli",
  "openclaw-agent",
  "openclaw-windows-hub",
  "chatgpt-work",
  "claude-cowork",
  "claude-tag",
  "google-antigravity-desktop",
  "google-antigravity-cli",
  "google-gemini-spark",
  "google-flow",
  "google-stitch",
  "microsoft-agent-365",
  "cursor-cli",
  "elevenlabs-agents",
  "tencent-qclaw",
  "tencent-ima",
  "tencent-clawpro",
  "tencent-ardot",
  "alibaba-qoder-cn-ide",
  "alibaba-qoderwork-cn",
  "alibaba-qoder-cn-cli",
  "alibaba-qoderwake-cn",
  "alibaba-qoder-cloud-agents-cn",
  "nous-hermes-agent",
  "cline-agent",
  "opencode",
  "comfy-cli"
]);

const VENDOR_EXPANSION_BATCH5 = Object.freeze([
  "replit-agent",
  "bolt-new",
  "lovable-ai-app-builder",
  "brave-browser-leo",
  "tabnine-ai-code-assistant",
  "ideogram-web",
  "recraft-studio",
  "luma-app",
  "heygen-ai-video",
  "synthesia-ai-video",
  "watsonx-ai",
  "deepgram-voice-ai-platform",
  "pinecone-vector-database",
  "oracle-cloud-infrastructure",
  "sap-business-ai-platform"
]);

const VENDOR_EXPANSION_BATCH6 = Object.freeze([
  "bytedance-capcut-desktop",
  "microsoft-vscode",
  "clickup-brain-max",
  "gamma-app",
  "krea-ai",
  "krea-agent-platform",
  "meshy-ai",
  "meshy-3d-agent",
  "meshy-developer-platform",
  "shengshu-vidu",
  "shengshu-vidu-claw",
  "pixverse-ai-video",
  "pixverse-agent",
  "pixverse-developer-platform",
  "udio-ai-music",
  "obsidian-desktop",
  "discord-desktop"
]);

const VENDOR_EXPANSION_BATCH7 = Object.freeze([
  "asana-work-graph",
  "monday-work-management",
  "box-content-cloud",
  "redis-insight",
  "neo4j-desktop",
  "mongodb-compass",
  "microsoft-visual-studio",
  "google-android-studio",
  "adobe-acrobat-reader-ai",
  "google-chrome-devtools",
  "microsoft-edge-ai",
  "opera-one",
  "mozilla-firefox",
  "invokeai-community-edition",
  "upscayl-desktop",
  "fotor-windows",
  "cyberlink-powerdirector",
  "cyberlink-photodirector"
]);

const VENDOR_EXPANSION_BATCH8 = Object.freeze([
  "on1-photo-raw",
  "capture-one-pro",
  "dxo-photolab",
  "craft-desktop",
  "capacities-desktop",
  "evernote-desktop",
  "dropbox-dash",
  "tana-outliner",
  "heptabase-desktop",
  "acdsee-photo-studio-ultimate",
  "vegas-pro",
  "zoner-studio"
]);

const CONTINUOUS_CATALOG_EXPANSION = Object.freeze([
  "mylio-photos",
  "endnote-2025",
  "taskade-workspace",
  "tldv-desktop",
  "aftershoot",
  "excire-foto",
  "evoto-desktop",
  "maxqda-desktop",
  "nvivo",
  "atlas-ti",
  "citavi",
  "wrike-desktop",
  "motion-desktop",
  "coda-ai",
  "reclaim-ai",
  "camtasia",
  "snagit",
  "audiate",
  "knime-analytics-platform",
  "dbeaver-pro",
  "alteryx-designer",
  "gitkraken-desktop",
  "termius-desktop",
  "lens-desktop",
  "nero-ai-photo-tagger",
  "nero-ai-image-upscaler",
  "nero-ai-video-upscaler",
  "hitpaw-vikpea",
  "hitpaw-fotorpea",
  "hitpaw-voicepea",
  "hitpaw-edimakor",
  "portraitpro",
  "izotope-rx",
  "steinberg-spectralayers",
  "supernormal-desktop",
  "meetgeek-desktop",
  "fellow-desktop",
  "teamviewer-remote-ai",
  "microsoft-power-bi-desktop",
  "tableau-desktop",
  "adobe-photoshop",
  "adobe-lightroom",
  "adobe-premiere",
  "adobe-illustrator",
  "adobe-firefly"
]);

const POPULAR_AGENT_EXPANSION = Object.freeze([
  "activepieces-platform",
  "agent-zero",
  "agenticseek-self-hosted",
  "agno-agentos",
  "aider-cli",
  "astrbot-platform",
  "autogpt-platform",
  "bardeen-agents",
  "browser-use-cli",
  "browser-use-cloud",
  "bytebot-self-hosted",
  "bytedance-agent-tars-cli",
  "bytedance-deerflow",
  "bytedance-ui-tars-desktop",
  "camel-ai-framework",
  "cognition-devin",
  "continue-agent",
  "continue-cli",
  "factory-cli",
  "factory-droids",
  "flowise-platform",
  "flowith-agent-neo",
  "google-agent-development-kit",
  "gumloop-agents",
  "hkuds-nanobot-cli",
  "huggingface-smolagents",
  "ironclaw-cli",
  "kilo-code-agent",
  "kilo-code-cli",
  "kortix-cli",
  "kortix-command-center",
  "langbot-platform",
  "langchain-deep-agents",
  "langflow-platform",
  "letta-agent",
  "letta-code-cli",
  "lindy-ai-assistant",
  "llamaindex-agents",
  "mastra-agent-framework",
  "metagpt-framework",
  "mini-swe-agent-cli",
  "nanoclaw-cli",
  "nvidia-nemoclaw-cli",
  "open-interpreter-cli",
  "openfang-cli",
  "openhands-agent-canvas",
  "openhands-cloud",
  "openmanus-cli",
  "opera-neon",
  "plandex-cli",
  "praisonai-cli",
  "pydantic-ai-framework",
  "ragflow-platform",
  "relevance-ai-agents",
  "rowboat-desktop",
  "ruflo-cli",
  "simular-agent-s-cli",
  "skyvern-cloud",
  "skyvern-self-hosted",
  "voltagent-framework",
  "zeroclaw-cli"
]);

const INDUSTRY_AI_EXPANSION = Object.freeze([
  "autodesk-autocad",
  "autodesk-revit",
  "graphisoft-archicad",
  "vectorworks-design-suite",
  "octave-bricscad",
  "dassault-solidworks-design",
  "siemens-designcenter-nx",
  "trimble-tekla-structures",
  "siemens-rapidminer-ai-studio",
  "ilastik-desktop",
  "qupath-desktop",
  "orange-data-mining-desktop",
  "elsevier-scopus-ai",
  "clarivate-web-of-science-research-assistant",
  "scispace-literature-review",
  "scite-assistant",
  "thomson-reuters-cocounsel-legal",
  "lexisnexis-lexis-plus-protege",
  "harvey-platform",
  "spellbook-legal",
  "vlex-vincent-ai",
  "relativity-air-review",
  "zendesk-copilot",
  "freshworks-freddy-ai-copilot",
  "genesys-cloud-cx",
  "gong-revenue-ai-os",
  "dialpad-desktop",
  "audacity-desktop",
  "streamlabs-desktop",
  "riverside-ai-video-editor",
  "opusclip",
  "thoughtspot-spotter",
  "qlik-answers",
  "dataiku-platform",
  "navicat-premium"
]);

const NEXT_CATALOG_EXPANSION = Object.freeze([
  "amp-cli",
  "augment-code",
  "augment-auggie-cli",
  "qodo-code-review",
  "coderabbit-code-review",
  "greptile-code-review",
  "github-spark",
  "langchain-langsmith",
  "clickhouse-langfuse",
  "promptfoo-cli",
  "daytona-sandboxes",
  "daytona-cli",
  "e2b-sandboxes",
  "amazon-q-developer",
  "google-gemini-code-assist",
  "jetbrains-junie",
  "vercel-v0",
  "atlassian-rovo",
  "microsoft-security-copilot",
  "sap-joule",
  "cisco-webex-ai-assistant",
  "playcanvas-editor",
  "vimeo-platform",
  "cloudinary-media-platform",
  "onlyoffice-docspace",
  "airtable-platform",
  "pandadoc-workspace",
  "superwhisper-windows",
  "screenpipe-desktop",
  "pdfgear-windows",
  "updf-windows",
  "vrew-desktop",
  "voice-ai-windows",
  "finevoice-desktop",
  "gitbutler-desktop",
  "affine-desktop",
  "appflowy-desktop",
  "duckduckgo-browser",
  "spark-mail-windows",
  "canary-mail",
  "movavi-video-editor",
  "coreldraw-graphics-suite",
  "braintrust-platform",
  "agentops-platform",
  "helicone-platform",
  "mod-io-platform",
  "assemblyai-voice-ai-platform",
  "livekit-cloud-agents",
  "anydesk-windows",
  "tripo-studio",
  "tripo-openapi",
  "docling",
  "tailscale-aperture",
  "spline-platform"
]);

test("the researched catalog keeps the Windows second pass and reviewed connectable products", () => {
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.equal(catalog.vendors.length, 375);
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.ok(products.length >= 600);
  const productIds = new Set(products.map((product) => product.id));
  assert.equal(productIds.size, products.length);
  for (const productId of [
    ...HIGH_VALUE_RESEARCH_PRODUCTS,
    ...VENDOR_EXPANSION_BATCH5,
    ...VENDOR_EXPANSION_BATCH6,
    ...VENDOR_EXPANSION_BATCH7,
    ...VENDOR_EXPANSION_BATCH8,
    ...CONTINUOUS_CATALOG_EXPANSION,
    ...POPULAR_AGENT_EXPANSION,
    ...INDUSTRY_AI_EXPANSION,
    ...NEXT_CATALOG_EXPANSION
  ]) {
    assert.equal(productIds.has(productId), true, productId);
  }
  for (const productId of [
    "unity-ai-assistant",
    "unity-editor",
    "sunlogin-windows"
  ]) {
    assert.equal(productIds.has(productId), true, productId);
  }
  for (const [vendorId, expectedProductIds] of Object.entries(
    PRESERVED_MANAGED_PRODUCTS
  )) {
    const vendor = catalog.vendors.find((item) => item.id === vendorId);
    assert.ok(vendor, vendorId);
    for (const productId of expectedProductIds) {
      assert.equal(
        vendor.products.some((product) => product.id === productId),
        true,
        `${vendorId}/${productId}`
      );
    }
  }
  assert.equal(productIds.has("openai-sora-retired"), false);
  assert.equal(productIds.has("amazon-q-developer-transition"), false);
  assert.equal(productIds.has("microsoft-autogen-maintenance"), false);
  for (const mergedId of [
    "chatgpt-web",
    "claude-web",
    "doubao",
    "microsoft-copilot-web",
    "qianwen-web",
    "tencent-yuanbao-web"
  ]) {
    assert.equal(productIds.has(mergedId), false, mergedId);
  }
  for (const productId of [
    "chatgpt-desktop",
    "claude-desktop",
    "bytedance-doubao",
    "microsoft-copilot-desktop",
    "alibaba-qwen-studio",
    "tencent-yuanbao-desktop"
  ]) {
    const product = products.find((item) => item.id === productId);
    assert.deepEqual(
      product.entryPoints.map((entry) => entry.type),
      ["website", "web", "desktop"],
      productId
    );
  }
});

test("Chinese vendor names use their displayed-name pinyin bucket", () => {
  const expected = {
    alibaba: "A",
    baichuan: "B",
    baidu: "B",
    bytedance: "Z",
    deepseek: "S",
    iflytek: "K",
    kingsoft: "J",
    kuaishou: "K",
    laiye: "L",
    meitu: "M",
    moonshot: "Y",
    oray: "B",
    sensetime: "S",
    shengshu: "S",
    tencent: "T",
    yingdao: "Y",
    youdao: "W",
    zhipu: "Z"
  };
  for (const [vendorId, initial] of Object.entries(expected)) {
    assert.equal(
      catalog.vendors.find((vendor) => vendor.id === vendorId)?.initial,
      initial,
      vendorId
    );
  }
});

test("only the reviewed mainland China network notices are enabled", () => {
  const expected = new Set([
    "anthropic",
    "google",
    "meta",
    "midjourney",
    "openai",
    "perplexity",
    "xai"
  ]);
  const actual = new Set(
    catalog.vendors
      .filter((vendor) => vendor.requiresCrossBorderNetwork === true)
      .map((vendor) => vendor.id)
  );
  assert.deepEqual(actual, expected);
  assert.equal(
    catalog.vendors.every(
      (vendor) =>
        vendor.requiresCrossBorderNetwork === undefined ||
        typeof vendor.requiresCrossBorderNetwork === "boolean"
    ),
    true
  );
});

test("every product has complete behavior and policy metadata", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  for (const product of products) {
    assert.ok(product.name);
    assert.ok(product.description);
    assert.ok(product.category);
    assert.match(product.website, /^https:\/\//);
    assert.match(product.tutorial, /^https:\/\//);
    assert.ok(product.productType);
    assert.ok(Array.isArray(product.requirements));
    assert.ok(product.installPolicy);
    assert.ok(product.downloadPolicy);
    assert.ok(product.signaturePolicy);
    assert.ok(product.uninstallPolicy);
    const behavior = resolveProductBehavior(product);
    assert.equal(
      behavior.opensDirectly || behavior.requiresEnvironmentCheck,
      true
    );
  }
});

test("the seven product behavior modules classify every catalog entry", () => {
  const counts = Object.fromEntries(
    [
      "web",
      "desktop-official",
      "desktop-reviewed",
      "cli-official",
      "cli",
      "local-model",
      "tutorial"
    ].map((type) => [type, 0])
  );
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  for (const product of products) {
    counts[product.productType] += 1;
  }
  assert.equal(
    Object.values(counts).reduce((total, count) => total + count, 0),
    products.length
  );
  assert.equal(counts["cli-official"], Object.keys(CLI_REVIEW_BLOCKERS).length);
  assert.equal(counts.cli, Object.keys(cliInstallPlans()).length);
  assert.ok(counts.web > 0);
  assert.ok(counts["desktop-official"] + counts["desktop-reviewed"] > 0);
  assert.ok(counts["local-model"] > 0);
  assert.ok(counts.tutorial > 0);
  assert.equal(
    products
      .filter((product) => product.productType === "desktop-reviewed")
      .every((product) => getProductIntakeDossier(product.id)),
    true
  );
});

test("ecosystem resources are top-level, typed and expose only reviewed managed profiles", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.every((product) => !("extensions" in product)), true);
  assert.equal(
    products.every((product) =>
      ["ai-tool", "ai-connectable"].includes(product.directoryKind)
    ),
    true
  );
  const resources = catalog.resources;
  assert.equal(resources.length, 146);
  assert.equal(
    resources.every((item) => item.publisherVendorId),
    true,
    "every resource must link to its single backend vendor record"
  );
  assert.equal(resources.filter((item) => item.resourceTypes.includes("skill")).length, 16);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("mcp")).length, 123);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("plugin")).length, 8);
  assert.equal(resources.filter((item) => item.resourceTypes.includes("connector")).length, 3);
  const managed = resources.find(
    (item) => item.id === "openai-chatgpt-apps-skill"
  );
  const managedTarget = managed.targets[0];
  assert.deepEqual(
    {
      moduleId: managedTarget.moduleId,
      installProfileId: managedTarget.installProfileId,
      versionRef: managed.versionRef,
      capabilities: managedTarget.capabilities
    },
    {
      moduleId: "skill-managed",
      installProfileId: "skill.codex.chatgpt-apps",
      versionRef: "49f948faa9258a0c61caceaf225e179651397431",
      capabilities: ["website", "install", "update", "repair", "uninstall"]
    }
  );
  const managedProfiles = new Set(Object.keys(EXTENSION_INSTALL_REGISTRY));
  assert.equal(
    resources.every(
      (item) => item.targets.every((target) =>
        managedProfiles.has(target.installProfileId) ||
        (target.moduleId === "resource-link" &&
          target.installProfileId === "" &&
          target.capabilities.length === 1 &&
          target.capabilities[0] === "website")
      )
    ),
    true
  );
  const resourceIds = new Set(resources.map((item) => item.id));
  for (const resourceId of [
    "openai-codex-skills-catalog",
    "openai-chatgpt-apps-skill",
    "anthropic-claude-code-mcp",
    "openclaw-clawhub-skills",
    "comfy-custom-nodes",
    "unity-official-mcp-server",
    "oray-awesun-mcp",
    "meshy-mcp-server",
    "meshy-3d-skill",
    "krea-mcp-server",
    "krea-agent-skills",
    "pixverse-mcp-server",
    "playcanvas-editor-mcp",
    "vimeo-mcp-server",
    "cloudinary-mcp-servers",
    "onlyoffice-docspace-mcp",
    "airtable-mcp-server",
    "pandadoc-mcp-server",
    "assemblyai-docs-mcp",
    "livekit-docs-mcp",
    "docling-mcp",
    "tailscale-aperture-mcp-proxy"
  ]) {
    assert.equal(resourceIds.has(resourceId), true, resourceId);
  }
});

test("batch 6 merges web and Windows entry points instead of duplicating products", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  for (const productId of [
    "slack-workspace",
    "miro-workspace",
    "linear-workspace",
    "clickup-workspace",
    "zoom-workplace",
    "bytedance-capcut-desktop",
    "microsoft-vscode",
    "clickup-brain-max",
    "obsidian-desktop",
    "discord-desktop"
  ]) {
    const matches = products.filter((product) => product.id === productId);
    assert.equal(matches.length, 1, productId);
    assertCurrentDesktopPolicy(matches[0], productId);
    assert.equal(
      matches[0].entryPoints.filter((entry) => entry.type === "desktop").length,
      1,
      productId
    );
  }
  for (const duplicateId of [
    "slack-desktop",
    "miro-desktop",
    "linear-desktop",
    "clickup-desktop",
    "zoom-desktop"
  ]) {
    assert.equal(products.some((product) => product.id === duplicateId), false, duplicateId);
  }
});

test("batch 7 keeps each Web and Windows product on one backend-owned card", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  for (const productId of [
    "asana-work-graph",
    "monday-work-management",
    "box-content-cloud",
    "adobe-acrobat-reader-ai",
    "fotor-windows"
  ]) {
    const matches = products.filter((product) => product.id === productId);
    assert.equal(matches.length, 1, productId);
    assertCurrentDesktopPolicy(matches[0], productId);
    assert.equal(
      matches[0].entryPoints.filter((entry) => entry.type === "web").length,
      1,
      productId
    );
    assert.equal(
      matches[0].entryPoints.filter((entry) => entry.type === "desktop").length,
      1,
      productId
    );
  }
  for (const duplicateId of [
    "asana-desktop",
    "monday-desktop",
    "box-drive",
    "adobe-acrobat-web",
    "fotor-web",
    "google-chrome-ai"
  ]) {
    assert.equal(products.some((product) => product.id === duplicateId), false, duplicateId);
  }
});

test("batch 8 keeps verified AI products on official Windows entry modules", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  for (const productId of VENDOR_EXPANSION_BATCH8) {
    const matches = products.filter((product) => product.id === productId);
    assert.equal(matches.length, 1, productId);
    assertCurrentDesktopPolicy(matches[0], productId);
    assert.equal(matches[0].directoryKind, "ai-tool", productId);
    assert.equal(
      matches[0].entryPoints.filter((entry) => entry.type === "desktop").length,
      1,
      productId
    );
  }
  for (const productId of [
    "capture-one-pro",
    "craft-desktop",
    "capacities-desktop",
    "evernote-desktop",
    "dropbox-dash",
    "tana-outliner",
    "heptabase-desktop"
  ]) {
    assert.equal(
      products.find((product) => product.id === productId).entryPoints
        .filter((entry) => entry.type === "web").length,
      1,
      productId
    );
  }
  assert.equal(
    products.find((product) => product.id === "capture-one-pro").entryPoints
      .find((entry) => entry.type === "web").label,
    "Capture One Live 网页协作"
  );
  for (const obsoleteId of ["craft-docs", "capacities-notes", "tana-desktop"]) {
    assert.equal(products.some((product) => product.id === obsoleteId), false, obsoleteId);
  }
});

test("continuous expansion keeps graphical products on fixed official modules", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  const webOnly = new Set(["coda-ai", "reclaim-ai", "adobe-firefly"]);
  for (const productId of CONTINUOUS_CATALOG_EXPANSION) {
    const matches = products.filter((product) => product.id === productId);
    assert.equal(matches.length, 1, productId);
    assert.equal(matches[0].directoryKind, "ai-tool", productId);
    if (webOnly.has(productId)) {
      assert.equal(matches[0].productType, "web", productId);
      assert.equal(matches[0].moduleId, "web-link", productId);
      assert.equal(
        matches[0].entryPoints.filter((entry) => entry.type === "desktop").length,
        0,
        productId
      );
    } else {
      assertCurrentDesktopPolicy(matches[0], productId);
      assert.equal(
        matches[0].entryPoints.filter((entry) => entry.type === "desktop").length,
        1,
        productId
      );
    }
  }
});

test("popular agents keep their real product and platform boundaries", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  const byId = new Map(products.map((product) => [product.id, product]));

  for (const productId of [
    "browser-use-cli",
    "kortix-cli",
    "metagpt-framework",
    "mini-swe-agent-cli",
    "nvidia-nemoclaw-cli",
    "plandex-cli",
    "simular-agent-s-cli"
  ]) {
    assert.equal(byId.get(productId)?.productType, "cli-official", productId);
  }
  for (const productId of [
    "aider-cli",
    "bytedance-agent-tars-cli",
    "factory-cli",
    "hkuds-nanobot-cli",
    "ironclaw-cli",
    "kilo-code-cli",
    "letta-code-cli",
    "open-interpreter-cli",
    "openfang-cli",
    "praisonai-cli",
    "zeroclaw-cli"
  ]) {
    assert.equal(byId.get(productId)?.productType, "cli", productId);
  }
  for (const productId of [
    "agenticseek-self-hosted",
    "nanoclaw-cli",
    "openmanus-cli"
  ]) {
    assert.equal(byId.get(productId)?.productType, "tutorial", productId);
  }
  assert.equal(byId.has("agenticseek-cli"), false);

  for (const productId of [
    "bytedance-ui-tars-desktop",
    "letta-agent",
    "opera-neon",
    "rowboat-desktop"
  ]) {
    assertCurrentDesktopPolicy(byId.get(productId), productId);
  }

  assert.deepEqual(
    byId.get("letta-agent").entryPoints.map((entry) => entry.type),
    ["website", "web", "desktop", "tutorial"]
  );
  assert.equal(byId.get("openhands-cloud")?.productType, "web");
  assert.equal(byId.get("openhands-agent-canvas")?.productType, "tutorial");
  assert.equal(byId.get("skyvern-cloud")?.productType, "web");
  assert.equal(byId.get("skyvern-self-hosted")?.productType, "tutorial");

  const hermesProducts = products.filter((product) =>
    product.id.startsWith("nous-hermes-")
  );
  assert.deepEqual(
    hermesProducts.map((product) => [product.id, product.productType]).sort(),
    [
      ["nous-hermes-agent", "cli-official"],
      ["nous-hermes-desktop", "desktop-official"]
    ]
  );

  for (const excludedId of [
    "agentgpt",
    "amazon-strands-agents-sdk",
    "fellou-agentic-browser",
    "openhands-cli",
    "roo-code",
    "skyvern-cli"
  ]) {
    assert.equal(byId.has(excludedId), false, excludedId);
  }
});

test("industry expansion keeps graphical and Web products on fixed safe modules", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  const byId = new Map(products.map((product) => [product.id, product]));
  const desktopIds = new Set([
    "autodesk-autocad",
    "autodesk-revit",
    "graphisoft-archicad",
    "vectorworks-design-suite",
    "octave-bricscad",
    "dassault-solidworks-design",
    "siemens-designcenter-nx",
    "trimble-tekla-structures",
    "siemens-rapidminer-ai-studio",
    "ilastik-desktop",
    "qupath-desktop",
    "orange-data-mining-desktop",
    "genesys-cloud-cx",
    "dialpad-desktop",
    "audacity-desktop",
    "streamlabs-desktop",
    "navicat-premium"
  ]);
  const connectableIds = new Set([
    "autodesk-autocad",
    "autodesk-revit",
    "graphisoft-archicad",
    "vectorworks-design-suite",
    "octave-bricscad",
    "dassault-solidworks-design",
    "siemens-designcenter-nx",
    "trimble-tekla-structures",
    "genesys-cloud-cx",
    "dialpad-desktop",
    "audacity-desktop",
    "streamlabs-desktop",
    "navicat-premium"
  ]);

  for (const productId of INDUSTRY_AI_EXPANSION) {
    const product = byId.get(productId);
    assert.ok(product, productId);
    if (desktopIds.has(productId)) {
      assertCurrentDesktopPolicy(product, productId);
    } else {
      assert.equal(product.installProfileId, "", productId);
    }
    assert.equal("download" in product, false, productId);
    assert.equal(
      product.directoryKind,
      connectableIds.has(productId) ? "ai-connectable" : "ai-tool",
      productId
    );
    if (desktopIds.has(productId)) {
      assertCurrentDesktopPolicy(product, productId);
      assert.equal(
        product.entryPoints.filter((entry) => entry.type === "desktop").length,
        1,
        productId
      );
    } else {
      assert.equal(product.productType, "web", productId);
      assert.equal(product.moduleId, "web-link", productId);
      assert.equal(product.installPolicy, "open-product-website", productId);
    }
  }

  assert.equal(
    catalog.vendors.filter((vendor) => vendor.id === "autodesk").length,
    1
  );
  assert.equal(byId.get("autodesk-autocad").directoryKind, "ai-connectable");
  assert.equal(byId.get("autodesk-revit").directoryKind, "ai-connectable");
  assert.equal(byId.has("altair-ai-studio"), false);
  assert.equal(catalog.vendors.some((vendor) => vendor.id === "altair"), false);
  assert.equal(byId.has("bricsys-bricscad"), false);
  assert.equal(catalog.vendors.some((vendor) => vendor.id === "bricsys"), false);
});

test("cross-directory products use names that explain their different roles", () => {
  const products = catalog.vendors.flatMap((vendor) => vendor.products);
  assert.equal(products.find((item) => item.id === "canva-windows")?.name, "Canva for Windows");
  assert.equal(products.find((item) => item.id === "canva-design")?.name, "Canva Design Platform");
  assert.doesNotMatch(
    products.find((item) => item.id === "openai-codex")?.description || "",
    /迁移证据$/
  );
});
