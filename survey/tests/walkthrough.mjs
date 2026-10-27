// The survey-mode walkthrough (survey/docs/walkthrough.md), driven in headless Chrome
// over CDP with Node's built-in WebSocket, so it needs no packages: open a .builder,
// select an approximate element, try to move it (Locked: Existing), hide and show
// Existing, draw a box, group it on Proposed, export the plan. Prints each step's
// result and writes screenshots.
//
//   make start
//   node survey/tests/walkthrough.mjs http://localhost:5173/ ../house/model/out/basement.builder /tmp/shots
//
// Needs Google Chrome at /Applications/Google Chrome.app (the path below).
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [url, file, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=9333", "--window-size=1400,900", "--no-first-run",
  "--user-data-dir=" + outDir + "/profile", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch("http://localhost:9333/json")).json(); break; } catch { await sleep(200); }
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description).join(" "));
  else if (m.method === "Runtime.exceptionThrown") logs.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed");
  return r.result.result.value;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(r.result.data, "base64"));
  console.log("screenshot", name);
};
await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url });
for (let i = 0; i < 100; i++) { if (await evaluate("!!window.builder")) break; await sleep(200); }
await sleep(500);
const text = JSON.stringify(readFileSync(file, "utf8"));
// Load the file the way File > Open does, through the app's own open path.
await evaluate(`(async () => { const f = new File([${text}], ${JSON.stringify(file.split("/").pop())}, {type: "application/json"}); await window.builder.open(f); })()`);
await sleep(1500);
await shot("01-opened");
const run = async (name, code) => { const v = await evaluate(code); console.log(name, JSON.stringify(v)); return v; };
await run("survey panel", `({hidden: document.getElementById("survey").hidden, tags: [...document.querySelectorAll("#tagStrip .tag")].map(t => t.textContent.trim()), toast: document.getElementById("toast").textContent})`);
await run("model tags", `window.builder.model.tags()`);
// Select the first approximate element through the app's selection and show its attributes.
await run("select approx", `(() => { const m = window.builder.model; const inst = m.instances(0).find(i => (m.attributes("definition", i.definition).survey||{}).approx); window.builder.selection.set([{kind:"instance", id: inst.id}]); return {id: inst.id, name: m.instanceProps(inst.id).name, attrs: m.attributes("definition", inst.definition)}; })()`);
await sleep(300);
await shot("02-approx-selected");
await run("attribute view", `document.getElementById("attrView").innerText`);
// Move the locked selection: the app's flash should say Locked: Existing.
await run("move locked", `(() => { const b = window.builder; b.setTool("move"); const m = b.model; const id = b.selection.items[0].id; const info = m.instanceInfo(id); try { m.transact("Move", () => m.setTransform(id, m.worldTransform(info.definition))); return "no error"; } catch (e) { b.flash(e.message); return document.getElementById("toast").textContent; } })()`);
await shot("03-locked-message");
// Hide Existing through the tag strip checkbox.
await run("hide existing", `(() => { const cb = document.querySelector("#tagStrip .tag input"); cb.click(); return {tags: window.builder.model.tags(), toast: document.getElementById("toast").textContent}; })()`);
await sleep(500);
await shot("04-existing-hidden");
await run("show existing", `(() => { document.querySelector("#tagStrip .tag input").click(); return window.builder.model.tags()[0]; })()`);
// Draw a box on Proposed: a rectangle at the root, pull it, group it, export the plan.
await run("draw and group", `(() => { const b = window.builder; const m = b.model; const R = 0;
  const faces0 = new Set(m.buffers(R).faceIds);
  m.transact("Rectangle", () => { m.addLine(R,[288,-360,0],[318,-360,0]); m.addLine(R,[318,-360,0],[318,-381,0]); m.addLine(R,[318,-381,0],[288,-381,0]); m.addLine(R,[288,-381,0],[288,-360,0]); });
  const newFace = [...new Set(m.buffers(R).faceIds)].find(f => !faces0.has(f));
  m.transact("Push/Pull", () => m.pushPull(newFace, -34));
  const own = [...new Set(m.buffers(R).faceIds)].filter(f => !faces0.has(f));
  b.selection.set(own.map(id => ({kind: "face", id})));
  b.makeGroup();
  b.refresh();
  const g = b.selection.items[0];
  return {group: g, props: m.instanceProps(g.id), toast: document.getElementById("toast").textContent}; })()`);
await sleep(500);
await shot("05-proposed-group");
await run("export plan", `import("/src/survey/plan-export.ts").then(mod => mod.exportProposed(window.builder.model, "vanity", "2026-10-27"))`);
console.log("console:", logs.join("\n") || "(none)");
ws.close();
chrome.kill();
