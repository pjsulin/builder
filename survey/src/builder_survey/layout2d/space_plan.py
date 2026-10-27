"""2D layout page for one room: out/<room>_plan.html.

Everything existing (walls, ledges, door frames, fixtures, pipes) comes from
the built elements, so it matches the model. Pieces (sauna, toilet, sink,
new walls, pocket door) are dragged around in the browser; their starting
list and sizes are in space/<room>.json (an exported layout replaces it).
Heights are above the room's floor; a piece only hits what overlaps its height.
"""
import json
import math

SKIP = (" floor", " joists", " sill")   # slabs, joists, door sills: not in the way


def _part_shapes(part):
    """Plan shapes of one element part, in spec coords (east, south), z in inches."""
    k = part["kind"]
    if k == "prism":
        xs = [p[0] for p in part["pts"]]
        ss = [-p[1] for p in part["pts"]]
        return [dict(shape="box", x0=min(xs), y0=min(ss), x1=max(xs), y1=max(ss),
                     z0=part["z"][0], z1=part["z"][1])]
    if k == "mesh":
        v = part["verts"]
        return [dict(shape="box", x0=min(p[0] for p in v), y0=min(-p[1] for p in v),
                     x1=max(p[0] for p in v), y1=max(-p[1] for p in v),
                     z0=min(p[2] for p in v), z1=max(p[2] for p in v))]
    if k == "cylinder":
        a, b, r = part["a"], part["b"], part["r"]
        return [dict(shape="pipe", ax=a[0], ay=-a[1], az=a[2], bx=b[0], by=-b[1], bz=b[2], r=r)]
    return []


def _bbox(s):
    if s["shape"] == "box":
        return s["x0"], s["y0"], s["x1"], s["y1"]
    return (min(s["ax"], s["bx"]) - s["r"], min(s["ay"], s["by"]) - s["r"],
            max(s["ax"], s["bx"]) + s["r"], max(s["ay"], s["by"]) + s["r"])


def write_space_plan(space_dir, report, elements, ceiling_z, out_dir, room, margin=36):
    rooms = report.get("layout") or {}
    if room not in rooms:
        raise SystemExit(f"layout page: no room {room!r} in the spec's layout")
    R = rooms[room]
    fz = R["fz"]
    ceiling = ceiling_z - fz
    pieces_file = space_dir / f"{room}.json"
    pieces = json.loads(pieces_file.read_text()) if pieces_file.exists() else {"pieces": []}
    north = R["north"] - margin
    # "view": {"north": "laundry.north"} shows more of the neighbours on that side
    places = {**rooms, **report.get("fixtures", {})}
    for side, ref in (pieces.get("view") or {}).items():
        name, edge = ref.split(".")
        if side != "north":
            raise SystemExit(f"space/{room}.json: view.{side}: only `north` is supported")
        north = min(north, places[name][edge] - 6)
    view = (R["west"] - margin, north, R["east"] + margin, R["south"] + margin)

    def in_view(b):
        return b[2] > view[0] and b[0] < view[2] and b[3] > view[1] and b[1] < view[3]

    obstacles = []
    for el in elements:
        name = el["name"]
        if el["phase"] not in ("existing",) or name.endswith(SKIP) or el["base"] == "slab":
            continue
        kind = ("wall" if name == "walls" else "pipe" if name.startswith("pipe ")
                else "door" if name.startswith("door ") else "ledge" if " ledge" in name
                else "fixture")
        for part in el["parts"]:
            for s in _part_shapes(part):
                if not in_view(_bbox(s)):
                    continue
                for z in ("z0", "z1", "az", "bz"):
                    if z in s:
                        s[z] = round(s[z] - fz, 2)
                label = name[5:] if kind == "pipe" else name
                obstacles.append({**s, "kind": kind, "name": label, "material": el["base"]})

    # Effective walls at the floor: the ledge faces where there's a ledge.
    faces = {"west": R["west"], "east": R["east"], "north": R["north"], "south": R["south"]}
    for o in obstacles:
        if o["kind"] == "ledge" and o["name"].startswith(f"{room} "):
            side = o["name"].split()[1]
            faces[side] = {"west": o["x1"], "east": o["x0"], "north": o["y1"], "south": o["y0"]}[side]

    rooms_out = [dict(name=n, x0=p["west"], y0=p["north"], x1=p["east"], y1=p["south"])
                 for n, p in rooms.items()
                 if in_view((p["west"], p["north"], p["east"], p["south"]))]
    doors = [dict(name=d["name"], side=d["side"], lo=d["lo"], hi=d["hi"], frame=d["frame"],
                  across=d["across"], height=d["height"])
             for d in report.get("doors", []) if "across" in d
             and in_view((d["across"][0], d["lo"], d["across"][1], d["hi"]) if d["side"] in ("east", "west")
                         else (d["lo"], d["across"][0], d["hi"], d["across"][1]))]

    labels = [dict(name=n, x0=f["west"], y0=f["north"], x1=f["east"], y1=f["south"],
                   z0=f["z"][0] - fz, z1=f["z"][1] - fz)
              for n, f in report.get("fixtures", {}).items()
              if in_view((f["west"], f["north"], f["east"], f["south"]))]
    data = dict(room=room, view=view, faces=faces, ceiling=ceiling, rooms=rooms_out, doors=doors,
                labels=labels,
                obstacles=obstacles, layout=pieces)
    html = TEMPLATE.replace("/*DATA*/null", json.dumps(data)).replace("{{ROOM}}", room)
    (out_dir / f"{room}_plan.html").write_text(html)


TEMPLATE = r"""<!doctype html>
<html><head><meta charset="utf-8"><title>{{ROOM}} plan</title>
<style>
  body { margin: 0; font: 13px/1.35 -apple-system, system-ui, sans-serif; color: #222; display: flex; height: 100vh; }
  #plan { flex: 1; background: #fafaf8; }
  svg { width: 100%; height: 100%; user-select: none; }
  aside { width: 330px; overflow-y: auto; border-left: 1px solid #ddd; padding: 10px 14px; background: #fff; }
  h2 { font-size: 14px; margin: 14px 0 6px; }
  .row { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
  .row label { width: 92px; color: #555; }
  input[type=text] { width: 80px; font: inherit; padding: 2px 4px; }
  button { font: inherit; padding: 3px 8px; margin: 2px 2px 2px 0; cursor: pointer; }
  .hit { color: #c62828; } .warn { color: #b26a00; } .ok { color: #2e7d32; }
  .muted { color: #777; font-size: 12px; }
  textarea { width: 100%; height: 120px; font: 11px monospace; }
  ul { margin: 4px 0; padding-left: 18px; }
  #tip { position: fixed; pointer-events: none; background: #222; color: #fff; padding: 3px 6px;
         border-radius: 3px; font-size: 12px; display: none; white-space: pre; }
</style></head>
<body>
<div id="plan"><svg id="svg"></svg></div>
<aside>
  <div class="muted">Drag pieces. Drag the white squares on a selected piece to resize it, or type sizes below. Arrow keys nudge ½" (shift: 6"). R rotates. Numbers are from the
  ledge faces (the effective walls at the floor). A piece only hits things that overlap its height.
  Your layout is kept in this browser; use Export to send it.</div>
  <h2>Add piece</h2>
  <div id="presets"></div>
  <h2 id="selTitle">Selected: none</h2>
  <div id="sel"></div>
  <h2>Problems</h2>
  <div id="problems"></div>
  <h2>Layout</h2>
  <button id="export">Export</button><button id="import">Import</button><button id="reset">Reset to file</button>
  <textarea id="io" placeholder="Export puts the layout here (also copied). Paste one and press Import."></textarea>
</aside>
<div id="tip"></div>
<script>
const D = /*DATA*/null;
const NS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("svg");
const KEY = "space-plan-" + D.room;
const F = D.faces;

// ---- units ---------------------------------------------------------------
function ftin(v) {
  const neg = v < 0; v = Math.abs(v);
  let ft = Math.floor((v + 1e-6) / 12), inch = Math.round((v - ft * 12) * 4) / 4;
  if (inch >= 12) { ft += 1; inch -= 12; }
  const fr = { 0: "", 0.25: " 1/4", 0.5: " 1/2", 0.75: " 3/4" }[inch % 1];
  const s = (ft ? ft + "'" : "") + Math.floor(inch) + fr + '"';
  return (neg ? "-" : "") + s;
}
function parseLen(s) {
  s = String(s).trim(); if (!s) return NaN;
  const m = s.match(/^(?:(\d+(?:\.\d+)?)\s*')?\s*(?:(\d+(?:\.\d+)?)?(?:\s+(\d+)\/(\d+))?\s*"?)?$/);
  if (!m) return NaN;
  let v = (+m[1] || 0) * 12 + (+m[2] || 0);
  if (m[3]) v += m[3] / m[4];
  return v;
}

// ---- pieces --------------------------------------------------------------
const PRESETS = D.layout.presets || [];
let pieces = load();
let selected = null;

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.pieces) return s.pieces; } catch (e) {}
  return JSON.parse(JSON.stringify(D.layout.pieces || []));
}
function save() { localStorage.setItem(KEY, JSON.stringify({ pieces })); }
// "ceiling" heights resolve to floor-to-joists; pieces without a place go in the tray
function normalize(list) {
  let x = D.view[2] + 8, y = D.view[1] + 8, colw = 0;
  for (const p of list) {
    if (p.h === "ceiling") p.h = D.ceiling;
    if (p.x === undefined || p.y === undefined) {
      if (p.kind === "wall" && p.w > 50) [p.w, p.d] = [p.d, p.w];   // long walls stand up in the tray
                                                    // (walls only: a fixture's door must stay on its front)
      if (y + p.d > D.view[3]) { x += colw + 6; y = D.view[1] + 8; colw = 0; }
      p.x = x; p.y = y; y += p.d + 4; colw = Math.max(colw, p.w);
    }
  }
  return list;
}
pieces = normalize(pieces);

// a piece: {name, kind, w (east-west), d (north-south), h, x, y (west / north edge),
//           facing (front side, for clearances), front (clear depth in front),
//           side (clear from centreline to each side), opening/pocket (doors), swing (door width)}
function rectOf(p) { return { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.d }; }
function rotate(p) {
  const cx = p.x + p.w / 2, cy = p.y + p.d / 2;
  [p.w, p.d] = [p.d, p.w];
  p.x = snap(cx - p.w / 2); p.y = snap(cy - p.d / 2);
  if (p.facing) p.facing = { north: "east", east: "south", south: "west", west: "north" }[p.facing];
}
function snap(v) { return Math.round(v * 2) / 2; }

// clearance zone in front (and to the sides from the centreline) of a fixture
function clearZone(p) {
  if (!p.facing || !p.front) return null;
  const r = rectOf(p), half = p.side ? p.side : null;
  const ns = p.facing === "north" || p.facing === "south";
  let z;
  if (p.facing === "north") z = { x0: r.x0, x1: r.x1, y0: r.y0 - p.front, y1: r.y0 };
  if (p.facing === "south") z = { x0: r.x0, x1: r.x1, y0: r.y1, y1: r.y1 + p.front };
  if (p.facing === "west")  z = { x0: r.x0 - p.front, x1: r.x0, y0: r.y0, y1: r.y1 };
  if (p.facing === "east")  z = { x0: r.x1, x1: r.x1 + p.front, y0: r.y0, y1: r.y1 };
  if (half) {
    if (ns) { const c = (r.x0 + r.x1) / 2; z.x0 = Math.min(z.x0, c - half); z.x1 = Math.max(z.x1, c + half); }
    else    { const c = (r.y0 + r.y1) / 2; z.y0 = Math.min(z.y0, c - half); z.y1 = Math.max(z.y1, c + half); }
  }
  return z;
}
// clearance all round (e.g. a sauna's 3" to anything), checked over the piece's full height
function aroundZone(p) {
  if (!p.around) return null;
  const r = rectOf(p), a = p.around;
  return { x0: r.x0 - a, x1: r.x1 + a, y0: r.y0 - a, y1: r.y1 + a };
}
// side clearance from the centreline: a band beside the fixture itself
function sideZone(p) {
  if (!p.side) return null;
  const r = rectOf(p), ns = p.facing === "north" || p.facing === "south";
  if (ns) { const c = (r.x0 + r.x1) / 2; return { x0: c - p.side, x1: c + p.side, y0: r.y0, y1: r.y1 }; }
  const c = (r.y0 + r.y1) / 2; return { x0: r.x0, x1: r.x1, y0: c - p.side, y1: c + p.side };
}

// ---- obstacles as circles / boxes for hit tests ----------------------------
// Pipes become circles every ½" along their run, each with its own height.
const SOLIDS = [];
for (const o of D.obstacles) {
  if (o.shape === "box") SOLIDS.push({ o, t: "box", ...o });
  else {
    const L = Math.hypot(o.bx - o.ax, o.by - o.ay), n = Math.max(1, Math.ceil(L / 0.5));
    if (L < 0.5) {    // vertical: one circle, its true height range
      SOLIDS.push({ o, t: "circle", cx: o.ax, cy: o.ay, r: o.r, z0: Math.min(o.az, o.bz), z1: Math.max(o.az, o.bz) });
      continue;
    }
    for (let i = 0; i <= n; i++) {
      const f = i / n, z = o.az + (o.bz - o.az) * f;
      SOLIDS.push({ o, t: "circle", cx: o.ax + (o.bx - o.ax) * f, cy: o.ay + (o.by - o.ay) * f,
                    r: o.r, z0: z - o.r, z1: z + o.r });
    }
  }
}
// Drains flush with the floor (top within 2") are shown but never in the way.
function overlapZ(s, h0, h1) { return s.z1 > Math.max(h0, 2) + 0.01 && s.z0 < h1 - 0.01; }
function hitRect(s, r) {
  if (s.t === "box") return s.x1 > r.x0 + 0.01 && s.x0 < r.x1 - 0.01 && s.y1 > r.y0 + 0.01 && s.y0 < r.y1 - 0.01;
  const dx = Math.max(r.x0 - s.cx, 0, s.cx - r.x1), dy = Math.max(r.y0 - s.cy, 0, s.cy - r.y1);
  return dx * dx + dy * dy < s.r * s.r - 0.01;
}
// free distance from a rect's side outward, against solids overlapping [h0, h1]
function reach(r, dir, h0, h1, skip) {
  let best = Infinity, who = null;
  const consider = (dist, o) => { if (dist > -0.01 && dist < best) { best = dist; who = o; } };
  for (const s of SOLIDS) {
    if (!overlapZ(s, h0, h1) || s.o === skip) continue;
    if (s.t === "box") {
      if (dir === "west" || dir === "east") {
        if (s.y1 <= r.y0 + 0.01 || s.y0 >= r.y1 - 0.01) continue;
        consider(dir === "west" ? r.x0 - s.x1 : s.x0 - r.x1, s.o);
      } else {
        if (s.x1 <= r.x0 + 0.01 || s.x0 >= r.x1 - 0.01) continue;
        consider(dir === "north" ? r.y0 - s.y1 : s.y0 - r.y1, s.o);
      }
    } else {
      if (dir === "west" || dir === "east") {
        const dy = Math.max(r.y0 - s.cy, 0, s.cy - r.y1); if (dy >= s.r) continue;
        const e = Math.sqrt(s.r * s.r - dy * dy);
        consider(dir === "west" ? r.x0 - (s.cx + e) : (s.cx - e) - r.x1, s.o);
      } else {
        const dx = Math.max(r.x0 - s.cx, 0, s.cx - r.x1); if (dx >= s.r) continue;
        const e = Math.sqrt(s.r * s.r - dx * dx);
        consider(dir === "north" ? r.y0 - (s.cy + e) : (s.cy - e) - r.y1, s.o);
      }
    }
  }
  for (const q of pieces) {
    if (q === skip || !(q.h > h0)) continue;
    const t = rectOf(q);
    if (dir === "west" || dir === "east") {
      if (t.y1 <= r.y0 + 0.01 || t.y0 >= r.y1 - 0.01) continue;
      consider(dir === "west" ? r.x0 - t.x1 : t.x0 - r.x1, { name: q.name, kind: "piece" });
    } else {
      if (t.x1 <= r.x0 + 0.01 || t.x0 >= r.x1 - 0.01) continue;
      consider(dir === "north" ? r.y0 - t.y1 : t.y0 - r.y1, { name: q.name, kind: "piece" });
    }
  }
  return { dist: best, who };
}
function hitsOf(p) {
  const r = rectOf(p), out = new Map();
  for (const s of SOLIDS) if (overlapZ(s, 0, p.h) && hitRect(s, r)) out.set(s.o, s);
  return [...out.keys()];
}
function overhead(p) {      // pipes above the piece's footprint: lowest bottom of each
  const r = rectOf(p), out = new Map();
  const hit = new Set(hitsOf(p));
  for (const s of SOLIDS) {
    if (s.o.kind !== "pipe" || hit.has(s.o) || s.z0 < p.h - 0.01 || !hitRect(s, r)) continue;
    const cur = out.get(s.o); if (cur === undefined || s.z0 < cur) out.set(s.o, s.z0);
  }
  return [...out.entries()];
}
function piecesOverlap(a, b) {
  if (a.kind === "door" || b.kind === "door") return false;   // a door sits in a wall
  const r = rectOf(a), t = rectOf(b);
  return r.x1 > t.x0 + 0.01 && r.x0 < t.x1 - 0.01 && r.y1 > t.y0 + 0.01 && r.y0 < t.y1 - 0.01;
}
function zoneProblems(p) {
  const out = [];
  for (const [zn, z, ztop] of [["front clearance", clearZone(p), 30], ["side clearance", sideZone(p), 30], ["clearance around", aroundZone(p), p.h]]) {
    if (!z) continue;
    for (const s of SOLIDS) if (overlapZ(s, 0, ztop) && hitRect(s, z)) { out.push(`${zn} hits ${s.o.name}`); break; }
    for (const q of pieces) {
      if (q === p || q.kind === "door") continue;
      const t = rectOf(q);
      if (t.x1 > z.x0 + 0.01 && t.x0 < z.x1 - 0.01 && t.y1 > z.y0 + 0.01 && t.y0 < z.y1 - 0.01)
        out.push(`${zn} overlaps ${q.name}`);
    }
  }
  return out;
}

// ---- drawing -------------------------------------------------------------
const V = D.view, PAD = 4;
const TRAY = 130;   // room on the east for pieces not placed yet
svg.setAttribute("viewBox", `${V[0] - PAD} ${V[1] - PAD} ${V[2] - V[0] + 2 * PAD + TRAY} ${V[3] - V[1] + 2 * PAD}`);
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(e); return e;
}
const COLORS = { wall: "#9e9e98", ledge: "#c9c6bc", door: "#c8a26a", fixture: "#e3cfa8" };
const PIPE = { pvc: "#e8e8e8", cast_iron: "#4a4440", copper: "#c87533", steel: "#55595e", rubber: "#222", pipe: "#666" };
const tip = document.getElementById("tip");
function tipOn(e, text) { tip.style.display = "block"; tip.textContent = text; tip.style.left = e.clientX + 12 + "px"; tip.style.top = e.clientY + 12 + "px"; }
function tipOff() { tip.style.display = "none"; }
function hgt(o) {
  if (o.shape === "pipe") {
    const lo = Math.min(o.az, o.bz) - o.r, hi = Math.max(o.az, o.bz) + o.r;
    return `${ftin(lo)} – ${ftin(hi)} above the floor, ${ftin(2 * o.r)} across`;
  }
  return `${ftin(o.z0)} – ${ftin(o.z1)} above the floor`;
}

let base, layer;
function drawBase() {
  base = el("g", {});
  for (let x = Math.ceil(V[0] / 12) * 12; x <= V[2]; x += 12) el("line", { x1: x, y1: V[1], x2: x, y2: V[3], stroke: "#eee", "stroke-width": 0.3 }, base);
  for (let y = Math.ceil(V[1] / 12) * 12; y <= V[3]; y += 12) el("line", { x1: V[0], y1: y, x2: V[2], y2: y, stroke: "#eee", "stroke-width": 0.3 }, base);
  for (const r of D.rooms) {
    el("rect", { x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0, fill: r.name === D.room ? "#fff" : "#f1f1ee", stroke: "#bbb", "stroke-width": 0.3, "stroke-dasharray": "2 2" }, base);
    const t = el("text", { x: Math.max(r.x0, V[0]) + 2, y: Math.max(r.y0, V[1]) + 5, "font-size": 4, fill: "#aaa" }, base); t.textContent = r.name;
  }
  const pipes = [];
  for (const o of D.obstacles) {
    if (o.shape === "pipe") { pipes.push(o); continue; }
    const node = el("rect", { x: o.x0, y: o.y0, width: o.x1 - o.x0, height: o.y1 - o.y0, fill: COLORS[o.kind] || "#ddd",
      stroke: o.kind === "fixture" ? "#8b5a2b" : "none", "stroke-width": 0.3, opacity: o.kind === "fixture" ? 0.6 : 1 }, base);
    node.addEventListener("mousemove", e => tipOn(e, `${o.name}\n${hgt(o)}`)); node.addEventListener("mouseleave", tipOff);
  }
  for (const d of D.doors) {
    const ns = d.side === "east" || d.side === "west";
    const [c0, c1] = d.across;
    const r = ns ? { x: c0, y: d.lo, width: c1 - c0, height: d.hi - d.lo } : { x: d.lo, y: c0, width: d.hi - d.lo, height: c1 - c0 };
    const win = d.name.includes("window");
    el("rect", { ...r, fill: win ? "#e3f2fd" : "#fff", stroke: win ? "#90a4ae" : "#7a4a1a", "stroke-width": 0.4 }, base);
    const t = el("text", { x: r.x + r.width / 2, y: r.y + r.height / 2, "font-size": 3.2, fill: "#7a4a1a", "text-anchor": "middle", "dominant-baseline": "middle",
      transform: ns ? `rotate(-90 ${r.x + r.width / 2} ${r.y + r.height / 2})` : "" }, base);
    t.textContent = `${win ? "" : "door "}${d.name.replace(/_/g, " ")} ${ftin(d.hi - d.lo)}`;
  }
  // pipes: high ones (above 6') faded and dashed; vertical ones as circles with a label
  pipes.sort((a, b) => Math.min(b.az, b.bz) - Math.min(a.az, a.bz));
  const labelled = new Set(["kitchen_cleanout_cap"]);
  for (const o of pipes) {
    const low = Math.min(o.az, o.bz) - o.r, high = low > 72;
    const col = PIPE[o.material] || "#666";
    const flat = Math.hypot(o.bx - o.ax, o.by - o.ay) < 0.5;
    let node;
    if (flat) node = el("circle", { cx: o.ax, cy: o.ay, r: o.r, fill: col, stroke: "#333", "stroke-width": 0.3 }, base);
    else node = el("line", { x1: o.ax, y1: o.ay, x2: o.bx, y2: o.by, stroke: col, "stroke-width": 2 * o.r, "stroke-linecap": "round",
      opacity: high ? 0.45 : 0.95, "stroke-dasharray": high ? "1.5 1" : "none" }, base);
    if (!flat && (o.material === "pvc")) el("line", { x1: o.ax, y1: o.ay, x2: o.bx, y2: o.by, stroke: "#999", "stroke-width": 0.25, "pointer-events": "none" }, base);
    const pname = o.name.split(" ")[0];
    if (flat && !labelled.has(pname)) {
      labelled.add(pname);
      const t = el("text", { x: o.ax + o.r + 1, y: o.ay - o.r - 0.5, "font-size": 3, fill: "#333" }, base);
      t.textContent = pname.replace(/_/g, " ");
    }
    node.addEventListener("mousemove", e => tipOn(e, `${o.name}\n${hgt(o)}`)); node.addEventListener("mouseleave", tipOff);
  }
  for (const f of D.labels) {           // fixture names, with their heights above this floor
    if (f.x1 - f.x0 < 8 || f.y1 - f.y0 < 8) continue;
    const t = el("text", { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2, "font-size": 3.2, fill: "#5a3a1a", "text-anchor": "middle",
      "dominant-baseline": "middle", "pointer-events": "none", stroke: "#fff", "stroke-width": 0.8, "paint-order": "stroke" }, base);
    t.textContent = `${f.name.replace(/_/g, " ")} ${ftin(f.z0)}–${ftin(f.z1)}`;
  }
  // effective walls (ledge faces) of the room
  el("rect", { x: F.west, y: F.north, width: F.east - F.west, height: F.south - F.north, fill: "none", stroke: "#1565c0", "stroke-width": 0.25, "stroke-dasharray": "1 1", "pointer-events": "none" }, base);
  el("line", { x1: V[2] + 4, y1: V[1], x2: V[2] + 4, y2: V[3], stroke: "#ccc", "stroke-width": 0.4 }, base);
  const t = el("text", { x: V[2] + 8, y: V[1] + 4, "font-size": 4, fill: "#999" }, base); t.textContent = "not placed";
  layer = el("g", {});
}

function draw() {
  layer.innerHTML = "";
  for (const p of pieces) {
    const r = rectOf(p), bad = hitsOf(p).length || pieces.some(q => q !== p && piecesOverlap(p, q));
    const g = el("g", { cursor: "move" }, layer);
    for (const z of [clearZone(p), sideZone(p), aroundZone(p)]) if (z && p === selected)
      el("rect", { x: z.x0, y: z.y0, width: z.x1 - z.x0, height: z.y1 - z.y0, fill: "#2e7d32", opacity: 0.08, stroke: "#2e7d32", "stroke-width": 0.25, "stroke-dasharray": "1 1" }, g);
    const fill = p.kind === "wall" ? "#8d6e63" : p.kind === "door" ? "#fff" : (p.color || "#90caf9");
    el("rect", { x: r.x0, y: r.y0, width: p.w, height: p.d, fill, opacity: p.kind === "door" ? 0.9 : 0.75,
      stroke: bad ? "#c62828" : p === selected ? "#0d47a1" : "#37474f", "stroke-width": bad || p === selected ? 0.8 : 0.4 }, g);
    if (p.kind === "door") {            // opening solid, pocket dashed, along the long side
      const along = p.w >= p.d, o = p.opening || 0;
      const a = along ? { x: r.x0, y: r.y0, width: o, height: p.d } : { x: r.x0, y: r.y0, width: p.w, height: o };
      el("rect", { ...a, fill: "#fff3e0", stroke: "#e65100", "stroke-width": 0.4 }, g);
    }
    if (p.swing && p.facing) {          // a hinged door on the front, its swing
      // hinge: distance along the front from its west (north/south fronts) or north
      // (east/west fronts) end; default 2 (at the corner). hinge_far mirrors the swing.
      const s = p.swing, f = p.facing, h = p.hinge === undefined ? 2 : p.hinge, far = !!p.hinge_far;
      const ew = f === "north" || f === "south", len = ew ? p.w : p.d;
      const a0 = far ? len - h : h, a1 = far ? a0 - s : a0 + s;   // hinge and free end along the front
      const out = { north: -s, south: s, east: s, west: -s }[f];  // open position, out from the front
      let hx, hy, x2, y2, x3, y3;
      if (ew) { hy = f === "north" ? r.y0 : r.y1; hx = r.x0 + a0; x2 = r.x0 + a1; y2 = hy; x3 = hx; y3 = hy + out; }
      else    { hx = f === "east" ? r.x1 : r.x0; hy = r.y0 + a0; y2 = r.y0 + a1; x2 = hx; y3 = hy; x3 = hx + out; }
      // quarter arc centred on the hinge: sweep 1 when x3 -> x2 is clockwise on screen
      const sweep = (x3 - hx) * (y2 - hy) - (y3 - hy) * (x2 - hx) > 0 ? 1 : 0;
      el("path", { d: `M${hx},${hy} L${x3},${y3} A${s},${s} 0 0 ${sweep} ${x2},${y2}`, fill: "none", stroke: "#e65100", "stroke-width": 0.35 }, g);
    }
    if (p.facing && p.kind !== "door") {   // front marker
      const c = { north: [(r.x0 + r.x1) / 2, r.y0 + 1.5], south: [(r.x0 + r.x1) / 2, r.y1 - 1.5], west: [r.x0 + 1.5, (r.y0 + r.y1) / 2], east: [r.x1 - 1.5, (r.y0 + r.y1) / 2] }[p.facing];
      el("circle", { cx: c[0], cy: c[1], r: 0.8, fill: "#263238" }, g);
    }
    const t = el("text", { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, "font-size": Math.min(4, Math.max(2.4, Math.min(p.w, p.d) / 5)), "text-anchor": "middle", "dominant-baseline": "middle", fill: "#102027", "pointer-events": "none",
      transform: p.d > p.w * 1.6 && p.w < 12 ? `rotate(-90 ${(r.x0 + r.x1) / 2} ${(r.y0 + r.y1) / 2})` : "" }, g);
    t.textContent = p.name;
    g.addEventListener("pointerdown", e => startDrag(e, p));
    if (p === selected) {               // edge handles: drag to resize
      const H = 3, mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2;
      for (const [edge, x, y, cur] of [["west", r.x0, my, "ew-resize"], ["east", r.x1, my, "ew-resize"],
                                       ["north", mx, r.y0, "ns-resize"], ["south", mx, r.y1, "ns-resize"]]) {
        const h = el("rect", { x: x - H / 2, y: y - H / 2, width: H, height: H, fill: "#fff", stroke: "#0d47a1", "stroke-width": 0.5, cursor: cur }, layer);
        h.addEventListener("pointerdown", e => startResize(e, p, edge));
      }
    }
  }
  if (selected) drawDims(selected);
  panel(); problems(); save();
}

function drawDims(p) {
  const r = rectOf(p);
  for (const dir of ["west", "east", "north", "south"]) {
    const { dist, who } = reach(r, dir, 0, p.h, p);
    if (!isFinite(dist) || dist > 200) continue;
    const midx = (r.x0 + r.x1) / 2, midy = (r.y0 + r.y1) / 2;
    let x1, y1, x2, y2;
    if (dir === "west")  { x1 = r.x0; x2 = r.x0 - dist; y1 = y2 = midy; }
    if (dir === "east")  { x1 = r.x1; x2 = r.x1 + dist; y1 = y2 = midy; }
    if (dir === "north") { y1 = r.y0; y2 = r.y0 - dist; x1 = x2 = midx; }
    if (dir === "south") { y1 = r.y1; y2 = r.y1 + dist; x1 = x2 = midx; }
    el("line", { x1, y1, x2, y2, stroke: "#0d47a1", "stroke-width": 0.35, "marker-end": "", "pointer-events": "none" }, layer);
    const t = el("text", { x: (x1 + x2) / 2 + (dir === "north" || dir === "south" ? 1 : 0), y: (y1 + y2) / 2 - 1, "font-size": 3.4, fill: "#0d47a1", "font-weight": 600, "pointer-events": "none" }, layer);
    t.textContent = ftin(dist);
  }
}

// ---- interaction -----------------------------------------------------------
function toPlan(e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
let drag = null;
function startDrag(e, p) {
  e.preventDefault(); selected = p;
  const q = toPlan(e); drag = { p, dx: q.x - p.x, dy: q.y - p.y };
  svg.setPointerCapture(e.pointerId); draw();
}
function startResize(e, p, edge) {
  e.preventDefault(); e.stopPropagation(); selected = p; drag = { p, edge };
  svg.setPointerCapture(e.pointerId);
}
svg.addEventListener("pointermove", e => {
  if (!drag) return;
  const q = toPlan(e), p = drag.p, MIN = 1;
  if (!drag.edge) { p.x = snap(q.x - drag.dx); p.y = snap(q.y - drag.dy); }
  else if (drag.edge === "east")  p.w = Math.max(MIN, snap(q.x - p.x));
  else if (drag.edge === "south") p.d = Math.max(MIN, snap(q.y - p.y));
  else if (drag.edge === "west")  { const x1 = p.x + p.w, x = Math.min(x1 - MIN, snap(q.x)); p.w = x1 - x; p.x = x; }
  else if (drag.edge === "north") { const y1 = p.y + p.d, y = Math.min(y1 - MIN, snap(q.y)); p.d = y1 - y; p.y = y; }
  draw();
});
svg.addEventListener("pointerup", () => { drag = null; });
svg.addEventListener("pointerdown", e => { if (e.target === svg) { selected = null; draw(); } });
document.addEventListener("keydown", e => {
  if (!selected || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const s = e.shiftKey ? 6 : 0.5;
  const mv = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
  if (mv) { selected.x += mv[0]; selected.y += mv[1]; e.preventDefault(); draw(); }
  if (e.key === "r" || e.key === "R") { rotate(selected); draw(); }
  if (e.key === "Delete" || e.key === "Backspace") { pieces = pieces.filter(q => q !== selected); selected = null; draw(); }
});

// ---- side panel --------------------------------------------------------------
function field(parent, label, value, set) {
  const row = document.createElement("div"); row.className = "row";
  row.innerHTML = `<label>${label}</label>`;
  const inp = document.createElement("input"); inp.type = "text"; inp.value = value;
  inp.addEventListener("change", () => { const v = parseLen(inp.value); if (isFinite(v)) { set(v); draw(); } else inp.value = value; });
  row.appendChild(inp); parent.appendChild(row); return row;
}
function panel() {
  const box = document.getElementById("sel"); box.innerHTML = "";
  document.getElementById("selTitle").textContent = "Selected: " + (selected ? selected.name : "none");
  if (!selected) { box.innerHTML = '<div class="muted">Click a piece. Hover pipes and walls for their heights.</div>'; return; }
  const p = selected, r = rectOf(p);
  const nameRow = document.createElement("div"); nameRow.className = "row";
  nameRow.innerHTML = "<label>name</label>";
  const ni = document.createElement("input"); ni.type = "text"; ni.style.width = "150px"; ni.value = p.name;
  ni.addEventListener("change", () => { p.name = ni.value; draw(); }); nameRow.appendChild(ni); box.appendChild(nameRow);
  field(box, "east-west", ftin(p.w), v => { p.w = v; });
  field(box, "north-south", ftin(p.d), v => { p.d = v; });
  field(box, "height", ftin(p.h), v => { p.h = v; });
  if (p.kind === "door") field(box, "opening", ftin(p.opening || 0), v => { p.opening = v; });
  if (p.swing !== undefined) field(box, "door width", ftin(p.swing), v => { p.swing = v; });
  if (p.front !== undefined) field(box, "front clear", ftin(p.front), v => { p.front = v; });
  const sub = document.createElement("div"); sub.className = "muted"; sub.textContent = "From the ledge faces:"; box.appendChild(sub);
  field(box, "west face →", ftin(r.x0 - F.west), v => { p.x = F.west + v; });
  field(box, "east face →", ftin(F.east - r.x1), v => { p.x = F.east - v - p.w; });
  field(box, "south face →", ftin(F.south - r.y1), v => { p.y = F.south - v - p.d; });
  const b = document.createElement("div");
  b.innerHTML = `<button id="rot">Rotate (R)</button><button id="dup">Duplicate</button><button id="del">Delete</button>`;
  box.appendChild(b);
  b.querySelector("#rot").onclick = () => { rotate(p); draw(); };
  b.querySelector("#dup").onclick = () => { const c = JSON.parse(JSON.stringify(p)); c.x += 6; c.y += 6; c.name += " 2"; pieces.push(c); selected = c; draw(); };
  b.querySelector("#del").onclick = () => { pieces = pieces.filter(q => q !== p); selected = null; draw(); };
  const oh = overhead(p);
  if (oh.length) {
    const d = document.createElement("div"); d.innerHTML = "<b>Pipes above it</b>";
    const ul = document.createElement("ul");
    for (const [o, z] of oh) { const li = document.createElement("li"); li.textContent = `${o.name}: bottom ${ftin(z)} (clears by ${ftin(z - p.h)})`; ul.appendChild(li); }
    d.appendChild(ul); box.appendChild(d);
  }
  const c = document.createElement("div"); c.className = "muted";
  c.textContent = `Floor to joists: ${ftin(D.ceiling)}.`; box.appendChild(c);
}
function problems() {
  const box = document.getElementById("problems"), items = [];
  for (const p of pieces) {
    if (rectOf(p).x0 > D.view[2] + 4) continue;      // still in the tray
    for (const o of hitsOf(p)) items.push(["hit", `${p.name} hits ${o.name} (${o.kind})`]);
    for (const q of pieces) if (q !== p && pieces.indexOf(q) > pieces.indexOf(p) && piecesOverlap(p, q)) items.push(["hit", `${p.name} overlaps ${q.name}`]);
    for (const z of zoneProblems(p)) items.push(["warn", `${p.name}: ${z}`]);
  }
  box.innerHTML = items.length ? "<ul>" + items.map(([c, t]) => `<li class="${c}">${t}</li>`).join("") + "</ul>"
                               : '<div class="ok">None.</div>';
}

// presets and layout io
const pre = document.getElementById("presets");
for (const p of PRESETS) {
  const b = document.createElement("button"); b.textContent = p.name;
  b.onclick = () => { const c = JSON.parse(JSON.stringify(p)); normalize([c]); c.y = D.view[1] + 8; pieces.push(c); selected = c; draw(); };
  pre.appendChild(b);
}
const io = document.getElementById("io");
document.getElementById("export").onclick = () => {
  io.value = JSON.stringify({ presets: PRESETS, pieces }, null, 1);
  navigator.clipboard && navigator.clipboard.writeText(io.value);
};
document.getElementById("import").onclick = () => {
  try { const v = JSON.parse(io.value); pieces = normalize(v.pieces || []); selected = null; draw(); } catch (e) { alert("Not a layout: " + e.message); }
};
document.getElementById("reset").onclick = () => {
  if (!confirm("Drop this browser's layout and go back to the one in the file?")) return;
  localStorage.removeItem(KEY); pieces = normalize(JSON.parse(JSON.stringify(D.layout.pieces || []))); selected = null; draw();
};

drawBase(); draw();
</script></body></html>
"""
