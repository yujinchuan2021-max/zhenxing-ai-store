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
      "@aihub-shared/development-catalog.cjs",
      "@aihub-shared/downloaded-package-action.cjs",
      "@aihub-shared/environment-install-flow.cjs",
      "@aihub-shared/environment-install-orchestrator.cjs",
      "@aihub-shared/installed-product-management.cjs",
      "@aihub-shared/managed-product-action-context.cjs",
      "@aihub-shared/product-install-presentation.cjs",
      "@aihub-shared/product-components.cjs",
      "@aihub-shared/product-policy.cjs",
      "@aihub-shared/uninstall-presentation.cjs",
      "@aihub-shared/verified-managed-install.cjs"
    ],
    needsInterop: [
      "@aihub-shared/development-catalog.cjs",
      "@aihub-shared/downloaded-package-action.cjs",
      "@aihub-shared/environment-install-flow.cjs",
      "@aihub-shared/environment-install-orchestrator.cjs",
      "@aihub-shared/installed-product-management.cjs",
      "@aihub-shared/managed-product-action-context.cjs",
      "@aihub-shared/product-install-presentation.cjs",
      "@aihub-shared/product-components.cjs",
      "@aihub-shared/product-policy.cjs",
      "@aihub-shared/uninstall-presentation.cjs",
      "@aihub-shared/verified-managed-install.cjs"
    ]
  },
  server: {
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
