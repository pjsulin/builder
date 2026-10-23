import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadKernelSync, Model } from "../src/kernel/model";

let loaded = false;

/** A fresh model backed by the real WebAssembly kernel. */
export function newModel(): Model {
  if (!loaded) {
    const wasm = fileURLToPath(new URL("../src/kernel/pkg/kernel_bg.wasm", import.meta.url));
    loadKernelSync(readFileSync(wasm));
    loaded = true;
  }
  return new Model();
}
