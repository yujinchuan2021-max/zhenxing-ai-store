const assert = require("node:assert/strict");
const test = require("node:test");

const {
  INSTALL_REGISTRY,
  getProductIntakeDossier
} = require("../shared/install-registry.cjs");
const {
  buildProductIntakeDossier,
  executionContractSha256,
  validateProductIntakeDossier
} = require("../shared/product-intake-dossier.cjs");
const { getManagedDownload } = require("../shared/managed-downloads.cjs");
const { getDesktopAdapter } = require("../shared/desktop-adapters.cjs");
const { getDesktopLifecycle } = require("../shared/desktop-lifecycle.cjs");
const approvals = require("../shared/product-intake-approvals.cjs");

test("every locally executable product has an approved intake dossier", () => {
  for (const productId of Object.keys(INSTALL_REGISTRY)) {
    const dossier = getProductIntakeDossier(productId);
    assert.ok(dossier, productId);
    assert.equal(validateProductIntakeDossier(dossier), "", productId);
    assert.equal(dossier.productId, productId);
  }
});

test("OpenClaw records its Hub, dedicated WSL, service and pairing layers", () => {
  const dossier = getProductIntakeDossier("openclaw-wsl-gateway");
  assert.equal(dossier.architecture, "desktop-companion-runtime");
  assert.deepEqual(dossier.components, [
    "windows-hub",
    "dedicated-wsl-distribution",
    "gateway-service",
    "pairing"
  ]);
  assert.ok(dossier.officialSources.some((source) => source.includes("openclaw")));
});

test("an execution contract change invalidates the independent approval", () => {
  const productId = "codex-cli";
  const registration = INSTALL_REGISTRY[productId];
  const download = getManagedDownload(productId);
  const changed = {
    ...registration,
    requirements: [...registration.requirements, "git"]
  };
  assert.notEqual(
    executionContractSha256(productId, changed, download),
    approvals[productId].executionContractSha256
  );
  assert.equal(
    buildProductIntakeDossier(
      productId,
      changed,
      download,
      approvals[productId]
    ),
    null
  );
});

test("desktop approval covers adapter identity, lifecycle and uninstall behavior", () => {
  const productId = "claude-desktop";
  const registration = INSTALL_REGISTRY[productId];
  const adapter = getDesktopAdapter(registration.desktopAdapterId);
  const lifecycle = getDesktopLifecycle(productId);
  const download = getManagedDownload(productId);
  const reviewed = {
    ...registration,
    desktopAdapter: adapter,
    desktopLifecycle: lifecycle
  };
  const approvedHash = getProductIntakeDossier(productId).executionContractSha256;
  assert.equal(
    executionContractSha256(productId, reviewed, download),
    approvedHash
  );
  for (const changed of [
    { ...reviewed, desktopAdapter: { ...adapter, signer: /^CN=Other$/i } },
    {
      ...reviewed,
      desktopAdapter: {
        ...adapter,
        uninstall: { ...adapter.uninstall, launchArguments: ["--silent"] }
      }
    },
    {
      ...reviewed,
      desktopLifecycle: { ...lifecycle, updateOwner: "other-updater" }
    }
  ]) {
    assert.notEqual(
      executionContractSha256(productId, changed, download),
      approvedHash
    );
  }
});

test("a locally executable product cannot approve itself", () => {
  const productId = "codex-cli";
  assert.equal(
    buildProductIntakeDossier(
      productId,
      INSTALL_REGISTRY[productId],
      getManagedDownload(productId),
      null
    ),
    null
  );
});
