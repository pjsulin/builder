import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "app",
  base: "./",
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 1000 },
  test: { root: ".", include: ["app/test/**/*.test.ts"], environment: "node" },
});
