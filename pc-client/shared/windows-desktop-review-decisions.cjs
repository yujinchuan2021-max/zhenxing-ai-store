"use strict";

const SPECIAL_OFFICIAL_ONLY = Object.freeze({
  "perplexity-comet": Object.freeze({
    reasonCode: "official-endpoint-not-binary",
    reviewReference:
      "docs/research/2026-08-04-existing-desktop-identities-batch-c.md"
  }),
  "grammarly-windows": Object.freeze({
    reasonCode: "isolation-lifecycle-acceptance-required",
    reviewReference: "docs/research/2026-08-04-managed-desktop-batch-2.md"
  }),
  "obsidian-desktop": Object.freeze({
    reasonCode: "trusted-install-receipt-not-captured",
    reviewReference: "docs/research/2026-08-04-managed-desktop-batch-2.md"
  }),
  "notion-desktop": Object.freeze({
    reasonCode: "legacy-to-msix-migration-not-accepted",
    reviewReference: "docs/research/2026-08-04-managed-desktop-batch-3.md"
  }),
  "deepl-desktop": Object.freeze({
    reasonCode: "zero-install-lifecycle-not-accepted",
    reviewReference: "docs/research/2026-08-04-managed-desktop-batch-3.md"
  }),
  "cherry-studio": Object.freeze({
    reasonCode: "current-windows-installer-not-signed",
    reviewReference: "docs/development-status.md"
  }),
  "deepchat-desktop": Object.freeze({
    reasonCode: "current-windows-installer-not-signed",
    reviewReference: "docs/development-status.md"
  }),
  "windsurf-editor": Object.freeze({
    reasonCode: "vendor-product-identity-migration",
    reviewReference: "docs/development-status.md"
  })
});

function getWindowsDesktopReviewDecision(product) {
  if (!product || typeof product !== "object") return null;
  if (
    product.productType === "desktop-reviewed" ||
    (product.productType === "local-model" &&
      product.installProfileId === "local-model.ollama")
  ) {
    return Object.freeze({
      status: "managed",
      reasonCode: "client-owned-execution-contract",
      reviewReference: "docs/windows-desktop-certification.md"
    });
  }
  if (product.productType !== "desktop-official") return null;
  const special = SPECIAL_OFFICIAL_ONLY[product.id];
  return Object.freeze({
    status: "official-only",
    reasonCode: special?.reasonCode || "client-execution-contract-not-reviewed",
    reviewReference:
      special?.reviewReference || "docs/windows-desktop-certification.md"
  });
}

module.exports = {
  getWindowsDesktopReviewDecision
};
