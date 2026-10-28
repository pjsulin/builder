// Check that the built service worker precaches every file in dist/ except
// itself, so the app loads offline after one visit. Prints "missing: <path>"
// for a built file the worker does not list and "extra: <path>" for a listed
// file that was not built, and exits 1 on any difference.
// Usage: node scripts/check-precache.mjs [dist]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const dist = process.argv[2] ?? "dist";
const sw = readFileSync(join(dist, "sw.js"), "utf8");
const m = sw.match(/^const PRECACHE = (\[.*\]);$/m);
if (!m) {
  console.error(`${join(dist, "sw.js")} has no PRECACHE array`);
  process.exit(1);
}
const listed = new Set(JSON.parse(m[1]).map((p) => p.replace(/^\.\//, "")));

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [relative(dist, p).split(sep).join("/")];
  });
const built = new Set(walk(dist).filter((f) => f !== "sw.js"));

let differences = 0;
for (const f of [...built].sort()) if (!listed.has(f)) console.log(`missing: ${f}`), differences++;
for (const f of [...listed].sort()) if (!built.has(f)) console.log(`extra: ${f}`), differences++;
process.exit(differences ? 1 : 0);
