import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Emit app/sw.js into the bundle with __PRECACHE__ set to every built file and
 *  __CACHE_VERSION__ to a hash of their contents, so the same inputs give the
 *  same worker and a changed build gets a new cache. */
function precachePlugin(): Plugin {
  return {
    name: "builder-precache",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => f !== "sw.js")
        .sort((a, b) => (a === "index.html" ? -1 : b === "index.html" ? 1 : a.localeCompare(b)));
      const hash = createHash("sha256");
      for (const f of files) {
        const item = bundle[f];
        hash.update(f).update(item.type === "chunk" ? item.code : item.source);
      }
      const source = readFileSync(new URL("./app/sw.js", import.meta.url), "utf8")
        .replace("__PRECACHE__", JSON.stringify(files.map((f) => `./${f}`)))
        .replace("__CACHE_VERSION__", hash.digest("hex").slice(0, 12));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  root: "app",
  base: "./",
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 1000 },
  plugins: [precachePlugin()],
  test: { root: ".", include: ["app/test/**/*.test.ts"], environment: "node" },
});
