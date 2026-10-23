// Small 3D math used by tools, inference and picking. Pure functions over plain
// tuples so it runs anywhere (browser, Node tests) without Three.js.

export type Vec3 = [number, number, number];
/** Column-major 4×4, the same layout as Three.js `Matrix4.elements` and the kernel. */
export type Mat4 = number[];

export const X: Vec3 = [1, 0, 0];
export const Y: Vec3 = [0, 1, 0];
export const Z: Vec3 = [0, 0, 1];
export const ORIGIN: Vec3 = [0, 0, 0];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
export const madd = (a: Vec3, d: Vec3, t: number): Vec3 => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
export function norm(a: Vec3): Vec3 {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0];
}

export interface Ray {
  origin: Vec3;
  dir: Vec3; // unit
}

export interface Plane {
  normal: Vec3; // unit
  d: number; // normal · p = d
}

export const planeFrom = (point: Vec3, normal: Vec3): Plane => {
  const n = norm(normal);
  return { normal: n, d: dot(n, point) };
};

export function rayPlane(ray: Ray, plane: Plane): Vec3 | null {
  const den = dot(ray.dir, plane.normal);
  if (Math.abs(den) < 1e-9) return null;
  const t = (plane.d - dot(ray.origin, plane.normal)) / den;
  if (t < 0) return null;
  return madd(ray.origin, ray.dir, t);
}

export function projectToPlane(p: Vec3, plane: Plane): Vec3 {
  return madd(p, plane.normal, plane.d - dot(plane.normal, p));
}

/**
 * Closest point on the infinite line `p0 + t·u` to a ray. Returns the line parameter
 * (in units of `u`), or null when they are parallel.
 */
export function lineRayParam(p0: Vec3, u: Vec3, ray: Ray): number | null {
  const w0 = sub(p0, ray.origin);
  const a = dot(u, u);
  const b = dot(u, ray.dir);
  const c = dot(ray.dir, ray.dir);
  const d = dot(u, w0);
  const e = dot(ray.dir, w0);
  const den = a * c - b * b;
  if (Math.abs(den) < 1e-10 * a * c) return null;
  return (b * e - c * d) / den;
}

/** Ray–triangle intersection (Möller–Trumbore). Returns the ray distance or null. */
export function rayTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
  const e1 = sub(b, a);
  const e2 = sub(c, a);
  const p = cross(ray.dir, e2);
  const det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const s = sub(ray.origin, a);
  const u = dot(s, p) * inv;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const q = cross(s, e1);
  const v = dot(ray.dir, q) * inv;
  if (v < -1e-9 || u + v > 1 + 1e-9) return null;
  const t = dot(e2, q) * inv;
  return t > 1e-9 ? t : null;
}

/** Orthonormal basis (u, v) in a plane with u × v = normal; matches the kernel. */
export function planeBasis(n: Vec3): [Vec3, Vec3] {
  const u: Vec3 = Math.abs(n[2]) > 1 - 1e-9 ? [1, 0, 0] : norm(cross(Z, n));
  return [u, cross(n, u)];
}

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function translation(t: Vec3): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
}

export function mul(a: Mat4, b: Mat4): Mat4 {
  const r = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
      r[col * 4 + row] = s;
    }
  return r;
}

export function apply(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** Apply only the linear part (for directions). */
export function applyDir(m: Mat4, d: Vec3): Vec3 {
  return [
    m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
    m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
    m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
  ];
}

/** Inverse of an affine transform. */
export function invert(m: Mat4): Mat4 {
  const [a, d, g] = [m[0], m[1], m[2]];
  const [b, e, h] = [m[4], m[5], m[6]];
  const [c, f, i] = [m[8], m[9], m[10]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return [...IDENTITY];
  const k = 1 / det;
  // Row-major inverse of the 3×3 part.
  const r = [
    (e * i - f * h) * k, (c * h - b * i) * k, (b * f - c * e) * k,
    (f * g - d * i) * k, (a * i - c * g) * k, (c * d - a * f) * k,
    (d * h - e * g) * k, (b * g - a * h) * k, (a * e - b * d) * k,
  ];
  const out = [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1];
  const t = apply(out, [m[12], m[13], m[14]]);
  out[12] = -t[0];
  out[13] = -t[1];
  out[14] = -t[2];
  return out;
}
