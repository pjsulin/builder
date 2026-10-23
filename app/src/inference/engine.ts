// One inference engine for every tool. Given the cursor it finds the point the user
// most likely means: an endpoint or midpoint, a point along a red/green/blue axis
// from the current anchor, a point on an edge or face, or the ground. It also holds
// the arrow-key and Shift locks.

import type { CameraModel } from "../view/camera";
import type { DrawItem, FaceHit, SceneIndex } from "../view/scene";
import {
  add,
  dist,
  dot,
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
  | "ground";

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

export class InferenceEngine {
  /** Direction lock from the arrow keys or Shift. */
  lockDir: Vec3 | null = null;
  lockAxis: 0 | 1 | 2 | null = null;
  /** Plane lock from Shift while on a face. */
  lockPlane: Plane | null = null;
  last: Inference | null = null;

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
    if (l.kind === "onEdge" && l.edge) {
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
  }

  get locked(): boolean {
    return !!(this.lockDir || this.lockPlane);
  }

  infer(x: number, y: number, opts: InferOptions = {}): Inference | null {
    const r = this.compute(x, y, opts);
    this.last = r;
    return r;
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

    // A line constraint (push/pull) or a direction lock with an anchor.
    const line =
      opts.line ?? (this.lockDir && opts.anchor ? { origin: opts.anchor, dir: this.lockDir } : undefined);
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
      return { point, kind: "line", from: line.origin, label: label || (locked ? "Locked" : ""), locked, ref };
    }

    const plane = opts.plane ?? this.lockPlane ?? undefined;
    const onPlane = (p: Vec3) => (plane ? projectToPlane(p, plane) : p);

    if (snap) return { ...snap, point: onPlane(snap.point) };

    // Axis inferences from the anchor.
    if (opts.anchor) {
      const ax = this.axisSnap(opts.anchor, x, y, plane);
      if (ax) return ax;
    }

    // On edge.
    const edge = this.edgeSnap(scene, x, y, visible, pickable, opts.ignoreEdges);
    if (edge && (!plane || Math.abs(dot(plane.normal, edge.point) - plane.d) < 1e-3)) return edge;

    if (plane) {
      const p = rayPlane(ray, plane) ?? rayPlane(ray, { normal: scale(plane.normal, -1), d: -plane.d });
      if (!p) return null;
      const onSameFace = hit && Math.abs(dot(plane.normal, hit.point) - plane.d) < 1e-3;
      return onSameFace
        ? { point: p, kind: "onFace", label: "On Face", face: hit! }
        : { point: p, kind: "plane", label: this.lockPlane ? "Locked" : "", locked: !!this.lockPlane };
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
    const consider = (p: Vec3, kind: InferenceKind, label: string, score: number, edge?: Inference["edge"]) => {
      if (score < bestScore && visible(p)) {
        bestScore = score;
        best = { point: p, kind, label, edge };
      }
    };
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

function screenSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
