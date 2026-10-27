// World-space view of the model for picking and inference, built from the kernel's
// per-definition buffers. Rendering uses the same buffers; this is kept separate so
// it can be tested in Node and queried without touching the GPU.

import type { DefBuffers, Model } from "../kernel/model";
import type { CameraModel } from "./camera";
import { ROOT } from "../kernel/model";
import { applyDir, IDENTITY, mul, norm, type Mat4, type Ray, type Vec3 } from "../math";

export interface DrawItem {
  def: number;
  /** Definition coordinates → world. */
  matrix: Mat4;
  /** Instance path from the root to this placement. */
  path: number[];
  /** This is the geometry of the context being edited. */
  editable: boolean;
  /** Inside the context being edited (drawn normally, can be picked). */
  active: boolean;
  /** The instance directly inside the active context that a click here selects. */
  pickInstance: number | null;
}

export interface FaceHit {
  item: number;
  face: number;
  point: Vec3;
  /** World-space front normal. */
  normal: Vec3;
  distance: number;
}

export class SceneIndex {
  items: DrawItem[] = [];
  buffers = new Map<number, DefBuffers>();
  /** Triangle corners in world space, 9 floats per triangle. */
  tri = new Float32Array(0);
  triFace = new Uint32Array(0);
  triItem = new Uint32Array(0);
  /** Edge ends in world space, 6 floats per edge. */
  seg = new Float32Array(0);
  segEdge = new Uint32Array(0);
  segItem = new Uint32Array(0);
  min: Vec3 = [0, 0, 0];
  max: Vec3 = [0, 0, 0];
  empty = true;
  /** Path of instances leading to the active context ([] for the root). */
  activePath: number[] = [];

  static build(model: Model, activeCtx: number): SceneIndex {
    const s = new SceneIndex();
    const raw: { def: number; matrix: Mat4; path: number[] }[] = [];
    const walk = (def: number, matrix: Mat4, path: number[], depth: number) => {
      raw.push({ def, matrix, path });
      if (depth > 32) return;
      for (const inst of model.instances(def)) {
        walk(inst.definition, mul(matrix, inst.transform), [...path, inst.id], depth + 1);
      }
    };
    walk(ROOT, IDENTITY, [], 0);
    const activeItem = raw.find((r) => r.def === activeCtx) ?? raw[0];
    s.activePath = activeItem.path;
    const ap = s.activePath;
    for (const r of raw) {
      const inside = r.path.length >= ap.length && ap.every((id, i) => r.path[i] === id);
      const editable = inside && r.path.length === ap.length;
      s.items.push({
        ...r,
        editable,
        active: inside,
        pickInstance: inside && !editable ? r.path[ap.length] : null,
      });
    }
    for (const def of new Set(raw.map((r) => r.def))) s.buffers.set(def, model.buffers(def));
    s.flatten();
    return s;
  }

  private flatten(): void {
    let nt = 0;
    let ns = 0;
    for (const it of this.items) {
      const b = this.buffers.get(it.def)!;
      nt += b.faceIds.length;
      ns += b.edgeIds.length;
    }
    this.tri = new Float32Array(nt * 9);
    this.triFace = new Uint32Array(nt);
    this.triItem = new Uint32Array(nt);
    this.seg = new Float32Array(ns * 6);
    this.segEdge = new Uint32Array(ns);
    this.segItem = new Uint32Array(ns);
    let t = 0;
    let s = 0;
    this.items.forEach((it, idx) => {
      const b = this.buffers.get(it.def)!;
      transformInto(this.tri, t * 9, b.positions, it.matrix);
      this.triFace.set(b.faceIds, t);
      this.triItem.fill(idx, t, t + b.faceIds.length);
      t += b.faceIds.length;
      transformInto(this.seg, s * 6, b.edgePositions, it.matrix);
      this.segEdge.set(b.edgeIds, s);
      this.segItem.fill(idx, s, s + b.edgeIds.length);
      s += b.edgeIds.length;
    });
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const arr of [this.tri, this.seg]) {
      for (let i = 0; i < arr.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = arr[i + k];
          if (v < min[k]) min[k] = v;
          if (v > max[k]) max[k] = v;
        }
      }
    }
    this.empty = nt + ns === 0;
    this.min = this.empty ? [0, 0, 0] : min;
    this.max = this.empty ? [0, 0, 0] : max;
  }

  triCorner(t: number, c: number): Vec3 {
    const o = t * 9 + c * 3;
    return [this.tri[o], this.tri[o + 1], this.tri[o + 2]];
  }

  segEnd(s: number, end: 0 | 1): Vec3 {
    const o = s * 6 + end * 3;
    return [this.seg[o], this.seg[o + 1], this.seg[o + 2]];
  }

  /** Nearest face under a ray, among items that pass `filter`. */
  pick(ray: Ray, filter: (item: DrawItem) => boolean = (it) => it.active): FaceHit | null {
    const allowed = this.items.map(filter);
    const [ox, oy, oz] = ray.origin;
    const [dx, dy, dz] = ray.dir;
    const T = this.tri;
    let bestT = Infinity;
    let bestTri = -1;
    for (let t = 0; t < this.triFace.length; t++) {
      if (!allowed[this.triItem[t]]) continue;
      // Möller–Trumbore, inlined to avoid allocating per triangle.
      const o = t * 9;
      const ax = T[o], ay = T[o + 1], az = T[o + 2];
      const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
      const e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const sx = ox - ax, sy = oy - ay, sz = oz - az;
      const u = (sx * px + sy * py + sz * pz) * inv;
      if (u < -1e-9 || u > 1 + 1e-9) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (d > 1e-9 && d < bestT) {
        bestT = d;
        bestTri = t;
      }
    }
    if (bestTri < 0) return null;
    const item = this.triItem[bestTri];
    const face = this.triFace[bestTri];
    return {
      item,
      face,
      point: [ox + dx * bestT, oy + dy * bestT, oz + dz * bestT],
      normal: this.faceNormal(item, face),
      distance: bestT,
    };
  }

  /** World-space front normal of a face placed by an item. */
  faceNormal(item: number, face: number): Vec3 {
    const it = this.items[item];
    const b = this.buffers.get(it.def)!;
    const i = b.faceIds.indexOf(face);
    if (i < 0) return [0, 0, 1];
    return norm(applyDir(it.matrix, [b.normals[i * 9], b.normals[i * 9 + 1], b.normals[i * 9 + 2]]));
  }

  private screen: { key: string; xy: Float32Array } | null = null;

  /**
   * Screen positions of every edge end (4 floats per edge: x0, y0, x1, y1), cached
   * until the camera moves. Ends behind the camera are NaN. Inference and picking
   * scan this instead of projecting tens of thousands of points per mouse move.
   */
  screenEdges(cam: CameraModel): Float32Array {
    const key = cam.key();
    if (this.screen?.key === key) return this.screen.xy;
    const xy = new Float32Array(this.segEdge.length * 4);
    const p: Vec3 = [0, 0, 0];
    for (let i = 0; i < this.segEdge.length; i++) {
      for (let end = 0; end < 2; end++) {
        const o = i * 6 + end * 3;
        p[0] = this.seg[o];
        p[1] = this.seg[o + 1];
        p[2] = this.seg[o + 2];
        const s = cam.project(p);
        xy[i * 4 + end * 2] = s ? s.x : NaN;
        xy[i * 4 + end * 2 + 1] = s ? s.y : NaN;
      }
    }
    this.screen = { key, xy };
    return xy;
  }

  /** World-space triangles of one face of one item (9 floats each), for highlights. */
  faceTriangles(item: number, face: number): number[] {
    const out: number[] = [];
    for (let t = 0; t < this.triFace.length; t++) {
      if (this.triItem[t] === item && this.triFace[t] === face) {
        for (let k = 0; k < 9; k++) out.push(this.tri[t * 9 + k]);
      }
    }
    return out;
  }

  /** The item that holds the active context's own geometry. */
  editableItem(): number {
    return Math.max(0, this.items.findIndex((it) => it.editable));
  }
}

const isIdentity = (m: Mat4) => m.every((v, i) => v === IDENTITY[i]);

/** Copy xyz triples from `src` into `out` at `offset`, transformed by `m`. */
function transformInto(out: Float32Array, offset: number, src: Float32Array, m: Mat4): void {
  if (isIdentity(m)) {
    out.set(src, offset);
    return;
  }
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i];
    const y = src[i + 1];
    const z = src[i + 2];
    out[offset + i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[offset + i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[offset + i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
}
