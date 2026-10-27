// Build the Rust kernel to WebAssembly and generate its JS bindings in
// app/src/kernel/pkg. Needs the wasm32 target and wasm-bindgen-cli (see README).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const profile = process.argv.includes("--debug") ? "debug" : "release";

try {
  run("cargo", ["build", "-p", "builder-kernel-wasm", "--target", "wasm32-unknown-unknown", ...(profile === "release" ? ["--release"] : [])]);
} catch {
  console.error("\nKernel build failed. Install the target with: rustup target add wasm32-unknown-unknown");
  process.exit(1);
}
const wasm = `target/wasm32-unknown-unknown/${profile}/builder_kernel_wasm.wasm`;
if (!existsSync(wasm)) {
  console.error(`Missing ${wasm}`);
  process.exit(1);
}
try {
  run("wasm-bindgen", ["--target", "web", "--out-dir", "app/src/kernel/pkg", "--out-name", "kernel", wasm]);
} catch {
  console.error("\nwasm-bindgen failed. Install it with: cargo install wasm-bindgen-cli --version 0.2.129");
  process.exit(1);
}
