// One inference engine for every tool. Given the cursor it finds the point the user
// most likely means: an endpoint, midpoint, guide point or intersection, a point
// along a red/green/blue axis from the current anchor, parallel or perpendicular to
// the last edge hovered, aligned with the last point hovered, a point on an edge,
// guide or face, or the ground. It also holds the arrow-key and Shift locks, the
// referenced edge and the from-point memory.

import type { CameraModel } from "../view/camera";
import { guideScreenDistance, type DrawItem, type FaceHit, type SceneIndex } from "../view/scene";
import {
  add,
  cross,
  dist,
  dot,
  len,
  lineRayParam,
  madd,
  norm,
  planeFrom,
  projectToPlane,
  rayPlane,
  scale,
  sub,
  type Plane,
  type Vec3,
} from "../math";

export type InferenceKind =
  | "endpoint"
  | "midpoint"
  | "origin"
  | "onEdge"
  | "onFace"
  | "axis"
  | "line"
  | "plane"
  | "ground"
  | "parallel"
  | "perpendicular"
  | "fromPoint"
  | "intersection"
  | "guidePoint"
  | "onGuide";

/** The Down-arrow lock against the referenced edge. */
export type EdgeLock = "parallel" | "perpendicular" | null;

export interface Inference {
  point: Vec3;
  kind: InferenceKind;
  /** Tooltip text, e.g. "Endpoint", "On Red Axis". Empty for plain ground points. */
  label: string;
  /** For axis inferences: 0 = red/X, 1 = green/Y, 2 = blue/Z. */
  axis?: 0 | 1 | 2;
  /** Start of the guide line to draw (the anchor) for axis and locked inferences. */
  from?: Vec3;
  face?: FaceHit;
  edge?: { item: number; id: number; a: Vec3; b: Vec3 };
  /** True when the result came from a lock (arrow keys or Shift). */
  locked?: boolean;
  /** A point elsewhere that this result was aligned with (e.g. a matched height). */
  ref?: { point: Vec3; kind: InferenceKind };
  /** The guide this result lies on or at. */
  guide?: { item: number; id: number };
}

export interface InferOptions {
  /** Start point of the current step; enables axis inferences. */
  anchor?: Vec3;
  /** Keep the result on this plane (e.g. a rectangle's plane). */
  plane?: Plane;
  /** Keep the result on this line (e.g. push/pull along a normal). */
  line?: { origin: Vec3; dir: Vec3 };
  /** Which drawn items faces and edges may come from. Defaults to the active context. */
  pickable?: (item: DrawItem) => boolean;
  /** Edge ids (in editable geometry) to ignore, such as the edges being moved. */
  ignoreEdges?: Set<number>;
}

export const AXES: Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
export const AXIS_NAMES = ["Red", "Green", "Blue"];

const POINT_RADIUS = 12;
const EDGE_RADIUS = 7;
const AXIS_RADIUS = 10;
/** Two lines cross when their closest points are this close, in model inches. */
const CROSS_TOL = 1e-3;

type EdgeRef = { item: number; id: number; a: Vec3; b: Vec3 };

export class InferenceEngine {
  /** Direction lock from the arrow keys or Shift. */
  lockDir: Vec3 | null = null;
  lockAxis: 0 | 1 | 2 | null = null;
  /** Plane lock from Shift while on a face. */
  lockPlane: Plane | null = null;
  last: Inference | null = null;
  /** Down arrow or Shift: hold parallel or perpendicular to the referenced edge. */
  private edgeLockState: EdgeLock = null;
  /** The last edge hovered with an On Edge result. */
  private refEdge: EdgeRef | null = null;
  /** The last point snapped to, until the next click: the from-point memory. */
  private fromMemory: { point: Vec3; kind: InferenceKind } | null = null;

  constructor(
    private scene: () => SceneIndex,
    private camera: CameraModel,
  ) {}

  /** Arrow keys: lock to an axis, or unlock if it is already locked. */
  toggleAxisLock(axis: 0 | 1 | 2): void {
    if (this.lockAxis === axis) return this.unlock();
    this.lockAxis = axis;
    this.lockDir = AXES[axis];
    this.lockPlane = null;
    this.edgeLockState = null;
  }

  /** Down arrow: parallel → perpendicular → off against the referenced edge. A
   *  no-op (null) without one. Replaces any axis or plane lock. */
  cycleEdgeLock(): EdgeLock {
    if (!this.refEdge) return null;
    const next: EdgeLock = this.edgeLockState === null ? "parallel" : this.edgeLockState === "parallel" ? "perpendicular" : null;
    this.lockDir = null;
    this.lockAxis = null;
    this.lockPlane = null;
    this.edgeLockState = next;
    return next;
  }

  edgeLock(): EdgeLock {
    return this.edgeLockState;
  }

  /** The last edge hovered with an On Edge result; cleared by `reset()`. */
  referencedEdge(): EdgeRef | null {
    return this.refEdge;
  }

  /** Tool change and Esc: clears locks, the referenced edge and the from-point memory. */
  reset(): void {
    this.unlock();
    this.refEdge = null;
    this.fromMemory = null;
    this.last = null;
  }

  /** A click: the from-point memory ends; the next hovered point starts a new one. */
  clicked(): void {
    this.fromMemory = null;
  }

  /** Shift: lock whatever direction or plane is inferred now. */
  lockCurrent(): boolean {
    const l = this.last;
    if (!l) return false;
    if (l.kind === "axis" && l.axis !== undefined) {
      this.lockAxis = l.axis;
      this.lockDir = AXES[l.axis];
      return true;
    }
    if ((l.kind === "parallel" || l.kind === "perpendicular") && this.refEdge) {
      this.lockDir = null;
      this.lockAxis = null;
      this.edgeLockState = l.kind;
      return true;
    }
    if ((l.kind === "onEdge" && l.edge) || (l.kind === "onGuide" && l.edge)) {
      this.lockAxis = null;
      this.lockDir = norm(sub(l.edge.b, l.edge.a));
      return true;
    }
    if (l.kind === "onFace" && l.face) {
      this.lockPlane = planeFrom(l.face.point, l.face.normal);
      return true;
    }
    return false;
  }

  unlock(): void {
    this.lockDir = null;
    this.lockAxis = null;
    this.lockPlane = null;
    this.edgeLockState = null;
  }

  get locked(): boolean {
    return !!(this.lockDir || this.lockPlane || this.edgeLockState);
  }

  infer(x: number, y: number, opts: InferOptions = {}): Inference | null {
    const r = this.compute(x, y, opts);
    this.last = r;
    if (r?.kind === "onEdge" && r.edge) this.refEdge = r.edge;
    if (r && isPointSnap(r.kind)) this.fromMemory = { point: r.point, kind: r.kind };
    return r;
  }

  /** Parallel or perpendicular direction to the referenced edge from `anchor`: the
   *  perpendicular lies in the working plane, else in the plane of the edge and
   *  the anchor (the ground's for an anchor on the edge's line). */
  private edgeDir(kind: "parallel" | "perpendicular", anchor: Vec3, plane?: Plane): Vec3 | null {
    const e = this.refEdge;
    if (!e) return null;
    const along = norm(sub(e.b, e.a));
    if (kind === "parallel") return along;
    let n: Vec3 | undefined = plane?.normal;
    if (!n) {
      const toAnchor = sub(anchor, e.a);
      const c = cross(along, toAnchor);
      n = len(c) > 1e-6 * Math.max(1, len(toAnchor)) ? norm(c) : undefined;
    }
    if (!n) {
      const c = cross(along, [0, 0, 1]);
      n = len(c) > 1e-6 ? [0, 0, 1] : [0, 1, 0];
    }
    const d = cross(n, along);
    return len(d) > 1e-6 ? norm(d) : null;
  }

  private compute(x: number, y: number, opts: InferOptions): Inference | null {
    const scene = this.scene();
    const cam = this.camera;
    const ray = cam.ray(x, y);
    const pickable = opts.pickable ?? ((it: DrawItem) => it.active);
    const hit = scene.pick(ray, pickable);
    const visible = (p: Vec3) => {
      if (!hit) return true;
      const d = dist(ray.origin, p);
      return d <= hit.distance + Math.max(0.05, hit.distance * 2e-3);
    };
    const snap = this.pointSnap(scene, x, y, visible, opts.ignoreEdges);
    const plane = opts.plane ?? this.lockPlane ?? undefined;

    // A line constraint (push/pull), a direction lock with an anchor, or the
    // parallel/perpendicular lock against the referenced edge.
    const edgeLockDir = this.edgeLockState && opts.anchor ? this.edgeDir(this.edgeLockState, opts.anchor, plane) : null;
    const line =
      opts.line ??
      (this.lockDir && opts.anchor ? { origin: opts.anchor, dir: this.lockDir } : undefined) ??
      (edgeLockDir && opts.anchor ? { origin: opts.anchor, dir: edgeLockDir } : undefined);
    if (line) {
      let t = lineRayParam(line.origin, line.dir, ray);
      let label = "";
      const ref = snap ? { point: snap.point, kind: snap.kind } : undefined;
      if (snap) {
        t = dot(sub(snap.point, line.origin), line.dir) / dot(line.dir, line.dir);
        label = `${snap.label} · matched`;
      }
      if (t === null) return null;
      const point = madd(line.origin, line.dir, t);
      const locked = !opts.line;
      if (locked && this.lockAxis !== null) {
        label = label || `On ${AXIS_NAMES[this.lockAxis]} Axis`;
        return { point, kind: "axis", axis: this.lockAxis, from: line.origin, label, locked, ref };
      }
      if (locked && !this.lockDir && this.edgeLockState) {
        const kind = this.edgeLockState;
        label = label || (kind === "parallel" ? "Parallel to Edge" : "Perpendicular to Edge");
        return { point, kind, from: line.origin, label, locked, ref, edge: this.refEdge ?? undefined };
      }
      return { point, kind: "line", from: line.origin, label: label || (locked ? "Locked" : ""), locked, ref };
    }

    // Only say "Locked" when the Shift lock is what's constraining the point.
    const fromLock = !opts.plane && !!this.lockPlane;
    const onPlane = (p: Vec3) => (plane ? projectToPlane(p, plane) : p);

    if (snap) return { ...snap, point: onPlane(snap.point) };

    // Axis inferences from the anchor, then parallel and perpendicular to the
    // referenced edge.
    if (opts.anchor) {
      const ax = this.axisSnap(opts.anchor, x, y, plane);
      if (ax) return ax;
      const ref = this.edgeCue(opts.anchor, x, y, plane);
      if (ref) return ref;
    }

    // On edge, on guide: the cursor is on something, which beats an alignment.
    const edge = this.edgeSnap(scene, x, y, visible, pickable, opts.ignoreEdges);
    if (edge && (!plane || Math.abs(dot(plane.normal, edge.point) - plane.d) < 1e-3)) return edge;
    const guide = this.guideSnap(scene, x, y, visible);
    if (guide && (!plane || Math.abs(dot(plane.normal, guide.point) - plane.d) < 1e-3)) return guide;

    // Alignment with the remembered point, on empty space.
    const from = this.fromPointCue(x, y, plane, opts.anchor);
    if (from) return from;

    if (plane) {
      const p = rayPlane(ray, plane) ?? rayPlane(ray, { normal: scale(plane.normal, -1), d: -plane.d });
      if (!p) return null;
      const onSameFace = hit && Math.abs(dot(plane.normal, hit.point) - plane.d) < 1e-3;
      return onSameFace
        ? { point: p, kind: "onFace", label: "On Face", face: hit! }
        : { point: p, kind: "plane", label: fromLock ? "Locked" : "", locked: fromLock };
    }
    if (hit) return { point: hit.point, kind: "onFace", label: "On Face", face: hit };
    const g = rayPlane(ray, { normal: [0, 0, 1], d: 0 });
    return g ? { point: g, kind: "ground", label: "" } : null;
  }

  private pointSnap(
    scene: SceneIndex,
    x: number,
    y: number,
    visible: (p: Vec3) => boolean,
    ignore?: Set<number>,
  ): Inference | null {
    const cam = this.camera;
    const xy = scene.screenEdges(cam);
    let best: Inference | null = null;
    let bestScore = POINT_RADIUS * POINT_RADIUS;
    const consider = (p: Vec3, kind: InferenceKind, label: string, score: number, edge?: Inference["edge"], guide?: Inference["guide"]) => {
      if (score < bestScore && visible(p)) {
        bestScore = score;
        best = { point: p, kind, label, edge, guide };
      }
    };
    for (const g of scene.guides()) {
      if (g.kind !== "point") continue;
      const sg = cam.project(g.origin);
      if (sg) consider(g.origin, "guidePoint", "Guide Point", (sg.x - x) ** 2 + (sg.y - y) ** 2, undefined, { item: g.item, id: g.id });
    }
    const o = cam.project([0, 0, 0]);
    if (o) consider([0, 0, 0], "origin", "Origin", (o.x - x) ** 2 + (o.y - y) ** 2);
    for (let i = 0; i < scene.segEdge.length; i++) {
      const ax = xy[i * 4], ay = xy[i * 4 + 1], bx = xy[i * 4 + 2], by = xy[i * 4 + 3];
      // Cheap reject: both ends and the midpoint are far from the cursor.
      const da = (ax - x) ** 2 + (ay - y) ** 2;
      const db = (bx - x) ** 2 + (by - y) ** 2;
      const dm = ((ax + bx) / 2 - x) ** 2 + ((ay + by) / 2 - y) ** 2;
      if (!(da < bestScore || db < bestScore || dm + 30 < bestScore * 1.5)) continue;
      const it = scene.items[scene.segItem[i]];
      if (ignore && it.editable && ignore.has(scene.segEdge[i])) continue;
      const a = scene.segEnd(i, 0);
      const b = scene.segEnd(i, 1);
      consider(a, "endpoint", "Endpoint", da);
      consider(b, "endpoint", "Endpoint", db);
      const m = scale(add(a, b), 0.5);
      const sm = cam.project(m);
      if (sm) {
        const score = (sm.x - x) ** 2 + (sm.y - y) ** 2 + 30;
        consider(m, "midpoint", "Midpoint", score, { item: scene.segItem[i], id: scene.segEdge[i], a, b });
      }
    }
    const cross = this.intersectionSnap(scene, x, y, ignore);
    if (cross) {
      const sx = cam.project(cross.point)!;
      consider(cross.point, "intersection", "Intersection", (sx.x - x) ** 2 + (sx.y - y) ** 2 + 60, cross.edge, cross.guide);
    }
    return best;
  }

  /**
   * Where two edges, two guide lines, or an edge and a guide line cross within the
   * point radius of the cursor. Lines that only pass each other in space do not
   * count; nor does a shared endpoint, which is an endpoint snap already.
   */
  private intersectionSnap(scene: SceneIndex, x: number, y: number, ignore?: Set<number>): Inference | null {
    const cam = this.camera;
    const xy = scene.screenEdges(cam);
    type Cand = { p: Vec3; u: Vec3; bounded: boolean; edge?: Inference["edge"]; guide?: Inference["guide"] };
    const cands: Cand[] = [];
    for (let i = 0; i < scene.segEdge.length; i++) {
      if (screenSegDist(x, y, xy[i * 4], xy[i * 4 + 1], xy[i * 4 + 2], xy[i * 4 + 3]) > POINT_RADIUS) continue;
      const item = scene.segItem[i];
      if (ignore && scene.items[item].editable && ignore.has(scene.segEdge[i])) continue;
      const a = scene.segEnd(i, 0);
      const b = scene.segEnd(i, 1);
      cands.push({ p: a, u: sub(b, a), bounded: true, edge: { item, id: scene.segEdge[i], a, b } });
    }
    for (const g of scene.guides()) {
      if (g.kind !== "line") continue;
      const r = guideScreenDistance(cam, g, x, y);
      if (!r || r.d > POINT_RADIUS) continue;
      cands.push({ p: g.origin, u: g.dir, bounded: false, guide: { item: g.item, id: g.id } });
    }
    let best: Inference | null = null;
    let bestD = POINT_RADIUS;
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        const hit = crossing(cands[i], cands[j]);
        if (!hit) continue;
        const s = cam.project(hit);
        if (!s) continue;
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bestD) {
          bestD = d;
          const edge = cands[i].edge ?? cands[j].edge;
          const guide = cands[i].guide ?? cands[j].guide;
          best = { point: hit, kind: "intersection", label: "Intersection", edge, guide };
        }
      }
    }
    return best;
  }

  /** The parallel or perpendicular cue from the anchor against the referenced edge. */
  private edgeCue(anchor: Vec3, x: number, y: number, plane?: Plane): Inference | null {
    if (!this.refEdge) return null;
    const cam = this.camera;
    const ray = cam.ray(x, y);
    let best: Inference | null = null;
    let bestD = AXIS_RADIUS;
    for (const kind of ["parallel", "perpendicular"] as const) {
      const dir = this.edgeDir(kind, anchor, plane);
      if (!dir) continue;
      if (plane && Math.abs(dot(dir, plane.normal)) > 1e-6) continue;
      // The red, green and blue axes already own their directions.
      if (AXES.some((a) => Math.abs(dot(a, dir)) > 1 - 1e-9)) continue;
      const t = lineRayParam(anchor, dir, ray);
      if (t === null || Math.abs(t) < 1e-6) continue;
      const p = madd(anchor, dir, t);
      const s = cam.project(p);
      if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        bestD = d;
        best = { point: p, kind, from: anchor, label: kind === "parallel" ? "Parallel to Edge" : "Perpendicular to Edge", edge: this.refEdge };
      }
    }
    return best;
  }

  /** The from-point cue: the cursor lines up on an axis with the remembered point. */
  private fromPointCue(x: number, y: number, plane?: Plane, anchor?: Vec3): Inference | null {
    const m = this.fromMemory;
    if (!m) return null;
    if (anchor && dist(anchor, m.point) < 1e-6) return null;
    const cam = this.camera;
    const ray = cam.ray(x, y);
    let best: Inference | null = null;
    let bestD = AXIS_RADIUS;
    for (let a = 0; a < 3; a++) {
      const dir = AXES[a];
      if (plane && Math.abs(dot(dir, plane.normal)) > 1e-6) continue;
      const t = lineRayParam(m.point, dir, ray);
      if (t === null || Math.abs(t) < 1e-6) continue;
      const p = madd(m.point, dir, t);
      const s = cam.project(p);
      if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        bestD = d;
        best = { point: p, kind: "fromPoint", axis: a as 0 | 1 | 2, from: m.point, label: "From Point", ref: { point: m.point, kind: m.kind } };
      }
    }
    return best;
  }

  /** On a guide line within the edge radius. Carries the line as `edge` so the
   *  Shift lock can hold its direction. */
  private guideSnap(scene: SceneIndex, x: number, y: number, visible: (p: Vec3) => boolean): Inference | null {
    const cam = this.camera;
    let best: Inference | null = null;
    let bestD = EDGE_RADIUS;
    for (const g of scene.guides()) {
      if (g.kind !== "line") continue;
      const r = guideScreenDistance(cam, g, x, y);
      if (!r || !(r.d < bestD) || !visible(r.at)) continue;
      bestD = r.d;
      best = { point: r.at, kind: "onGuide", label: "On Guide", guide: { item: g.item, id: g.id }, edge: { item: g.item, id: g.id, a: r.at, b: add(r.at, g.dir) } };
    }
    return best;
  }

  private axisSnap(anchor: Vec3, x: number, y: number, plane?: Plane): Inference | null {
    const cam = this.camera;
    const ray = cam.ray(x, y);
    let best: Inference | null = null;
    let bestD = AXIS_RADIUS;
    for (let a = 0; a < 3; a++) {
      const dir = AXES[a];
      if (plane && Math.abs(dot(dir, plane.normal)) > 1e-6) continue;
      const t = lineRayParam(anchor, dir, ray);
      if (t === null || Math.abs(t) < 1e-6) continue;
      const p = madd(anchor, dir, t);
      const s = cam.project(p);
      if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) {
        bestD = d;
        best = { point: p, kind: "axis", axis: a as 0 | 1 | 2, from: anchor, label: `On ${AXIS_NAMES[a]} Axis` };
      }
    }
    return best;
  }

  private edgeSnap(
    scene: SceneIndex,
    x: number,
    y: number,
    visible: (p: Vec3) => boolean,
    pickable: (it: DrawItem) => boolean,
    ignore?: Set<number>,
  ): Inference | null {
    const cam = this.camera;
    const ray = cam.ray(x, y);
    const xy = scene.screenEdges(cam);
    let best: Inference | null = null;
    let bestD = EDGE_RADIUS;
    for (let i = 0; i < scene.segEdge.length; i++) {
      const d = screenSegDist(x, y, xy[i * 4], xy[i * 4 + 1], xy[i * 4 + 2], xy[i * 4 + 3]);
      if (!(d < bestD)) continue;
      const item = scene.segItem[i];
      if (!pickable(scene.items[item])) continue;
      if (ignore && scene.items[item].editable && ignore.has(scene.segEdge[i])) continue;
      const a = scene.segEnd(i, 0);
      const b = scene.segEnd(i, 1);
      const u = sub(b, a);
      let t = lineRayParam(a, u, ray);
      if (t === null) continue;
      t = Math.min(1, Math.max(0, t));
      const p = madd(a, u, t);
      if (!visible(p)) continue;
      bestD = d;
      best = { point: p, kind: "onEdge", label: "On Edge", edge: { item, id: scene.segEdge[i], a, b } };
    }
    return best;
  }
}

function isPointSnap(kind: InferenceKind): boolean {
  return kind === "endpoint" || kind === "midpoint" || kind === "origin" || kind === "guidePoint" || kind === "intersection";
}

/**
 * Where two lines (each bounded to its segment when `bounded`) actually cross,
 * or null when they are parallel, miss each other, or meet at a shared end.
 */
function crossing(
  a: { p: Vec3; u: Vec3; bounded: boolean },
  b: { p: Vec3; u: Vec3; bounded: boolean },
): Vec3 | null {
  const w = sub(a.p, b.p);
  const aa = dot(a.u, a.u);
  const bb = dot(b.u, b.u);
  const ab = dot(a.u, b.u);
  const den = aa * bb - ab * ab;
  if (den < 1e-12 * aa * bb) return null;
  const s = (ab * dot(b.u, w) - bb * dot(a.u, w)) / den;
  const t = (aa * dot(b.u, w) - ab * dot(a.u, w)) / den;
  const inside = (k: number, bounded: boolean) => !bounded || (k > 1e-6 && k < 1 - 1e-6);
  if (!inside(s, a.bounded) || !inside(t, b.bounded)) return null;
  const pa = madd(a.p, a.u, s);
  const pb = madd(b.p, b.u, t);
  return dist(pa, pb) <= CROSS_TOL ? pa : null;
}

function screenSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
