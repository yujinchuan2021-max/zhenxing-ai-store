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
      "@aihub-shared/environment-install-flow.cjs",
      "@aihub-shared/product-policy.cjs"
    ],
    needsInterop: [
      "@aihub-shared/environment-install-flow.cjs",
      "@aihub-shared/product-policy.cjs"
    ]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
