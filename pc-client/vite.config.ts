import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@aihub-shared": fileURLToPath(new URL("./shared", import.meta.url))
    }
  },
  optimizeDeps: {
    include: [
      "@aihub-shared/brand.cjs",
      "@aihub-shared/catalog-projections.cjs",
      "@aihub-shared/catalog-taxonomy.cjs",
      "@aihub-shared/community-embed.cjs",
      "@aihub-shared/development-catalog.cjs",
      "@aihub-shared/desktop-installer-launch-policy.cjs",
      "@aihub-shared/desktop-inventory-presentation.cjs",
      "@aihub-shared/download-task-presentation.cjs",
      "@aihub-shared/downloaded-package-action.cjs",
      "@aihub-shared/environment-install-flow.cjs",
      "@aihub-shared/environment-install-orchestrator.cjs",
      "@aihub-shared/installed-product-management.cjs",
      "@aihub-shared/managed-product-action-context.cjs",
      "@aihub-shared/navigation-back.cjs",
      "@aihub-shared/official-download-page.cjs",
      "@aihub-shared/home-carousel-presentation.cjs",
      "@aihub-shared/product-install-presentation.cjs",
      "@aihub-shared/product-components.cjs",
      "@aihub-shared/product-policy.cjs",
      "@aihub-shared/resource-marketplace.cjs",
      "@aihub-shared/resource-store.cjs",
      "@aihub-shared/uninstall-presentation.cjs",
      "@aihub-shared/verified-managed-install.cjs"
    ],
    needsInterop: [
      "@aihub-shared/brand.cjs",
      "@aihub-shared/catalog-projections.cjs",
      "@aihub-shared/catalog-taxonomy.cjs",
      "@aihub-shared/community-embed.cjs",
      "@aihub-shared/development-catalog.cjs",
      "@aihub-shared/desktop-installer-launch-policy.cjs",
      "@aihub-shared/desktop-inventory-presentation.cjs",
      "@aihub-shared/download-task-presentation.cjs",
      "@aihub-shared/downloaded-package-action.cjs",
      "@aihub-shared/environment-install-flow.cjs",
      "@aihub-shared/environment-install-orchestrator.cjs",
      "@aihub-shared/installed-product-management.cjs",
      "@aihub-shared/managed-product-action-context.cjs",
      "@aihub-shared/navigation-back.cjs",
      "@aihub-shared/official-download-page.cjs",
      "@aihub-shared/home-carousel-presentation.cjs",
      "@aihub-shared/product-install-presentation.cjs",
      "@aihub-shared/product-components.cjs",
      "@aihub-shared/product-policy.cjs",
      "@aihub-shared/resource-marketplace.cjs",
      "@aihub-shared/resource-store.cjs",
      "@aihub-shared/uninstall-presentation.cjs",
      "@aihub-shared/verified-managed-install.cjs"
    ]
  },
  server: {
    headers: {
      "Cache-Control": "no-store"
    },
    proxy: {
      "/__aihub-local-catalog": {
        target: "http://127.0.0.1:4173",
        changeOrigin: false,
        rewrite: (requestPath) =>
          requestPath.replace(/^\/__aihub-local-catalog/, "")
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
