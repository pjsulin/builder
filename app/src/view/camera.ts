// A perspective camera in plain math, Z up. The Three.js camera is synced from it,
// but projection, rays and orbit/pan/zoom live here so inference and tools can be
// tested without a browser.

import { add, cross, madd, norm, scale, sub, type Ray, type Vec3 } from "../math";

export interface Screen {
  x: number;
  y: number;
}

export class CameraModel {
  target: Vec3 = [100, 40, 30];
  dist = 620;
  /** Azimuth around Z, radians. */
  theta = -2.05;
  /** Angle from +Z, radians. */
  phi = 1.15;
  fov = 35; // vertical, degrees
  width = 800;
  height = 600;

  get eye(): Vec3 {
    const sp = Math.sin(this.phi);
    return [
      this.target[0] + this.dist * sp * Math.cos(this.theta),
      this.target[1] + this.dist * sp * Math.sin(this.theta),
      this.target[2] + this.dist * Math.cos(this.phi),
    ];
  }
  get near(): number {
    return Math.max(0.05, this.dist / 1000);
  }
  get far(): number {
    return this.dist * 60 + 30000;
  }

  private cache: { key: string; eye: Vec3; basis: [Vec3, Vec3, Vec3] } | null = null;

  /** Eye and basis, recomputed only when the camera changes (projection is hot). */
  private frame(): { eye: Vec3; basis: [Vec3, Vec3, Vec3] } {
    const key = `${this.target}|${this.dist}|${this.theta}|${this.phi}`;
    if (this.cache?.key !== key) {
      const eye = this.eye;
      const f = norm(sub(this.target, eye));
      let r = cross(f, [0, 0, 1]);
      if (Math.hypot(...r) < 1e-9) r = [1, 0, 0];
      r = norm(r);
      this.cache = { key, eye, basis: [f, r, cross(r, f)] };
    }
    return this.cache;
  }

  /** Changes whenever the view changes; used to cache screen projections. */
  key(): string {
    return `${this.target}|${this.dist}|${this.theta}|${this.phi}|${this.fov}|${this.width}|${this.height}`;
  }

  /** Camera basis: forward, right, up. */
  basis(): [Vec3, Vec3, Vec3] {
    return this.frame().basis;
  }

  private tanHalf(): number {
    return Math.tan((this.fov * Math.PI) / 360);
  }

  /** World point to screen pixels, or null if behind the camera. */
  project(p: Vec3): Screen | null {
    const { eye, basis } = this.frame();
    const [f, r, u] = basis;
    const dx = p[0] - eye[0];
    const dy = p[1] - eye[1];
    const dz = p[2] - eye[2];
    const z = dx * f[0] + dy * f[1] + dz * f[2];
    if (z <= this.near) return null;
    const th = this.tanHalf();
    const aspect = this.width / this.height;
    const x = (dx * r[0] + dy * r[1] + dz * r[2]) / (z * th * aspect);
    const y = (dx * u[0] + dy * u[1] + dz * u[2]) / (z * th);
    return { x: ((x + 1) / 2) * this.width, y: ((1 - y) / 2) * this.height };
  }

  /** Ray from the eye through a screen pixel. */
  ray(sx: number, sy: number): Ray {
    const { eye, basis } = this.frame();
    const [f, r, u] = basis;
    const th = this.tanHalf();
    const aspect = this.width / this.height;
    const x = (sx / this.width) * 2 - 1;
    const y = 1 - (sy / this.height) * 2;
    const dir = norm(add(f, add(scale(r, x * th * aspect), scale(u, y * th))));
    return { origin: eye, dir };
  }

  /** World units per pixel at the target distance. */
  pixelSize(): number {
    return (2 * this.dist * this.tanHalf()) / this.height;
  }

  orbit(dx: number, dy: number): void {
    this.theta -= dx * 0.008;
    this.phi = Math.min(Math.PI - 0.02, Math.max(0.02, this.phi - dy * 0.008));
  }

  pan(dx: number, dy: number): void {
    const [, r, u] = this.basis();
    const k = this.pixelSize();
    this.target = madd(madd(this.target, r, -dx * k), u, dy * k);
  }

  /** Zoom by factor `f` (<1 zooms in) toward a world point. */
  zoomToward(p: Vec3, f: number): void {
    if (this.dist * f < 1) return;
    this.target = add(p, scale(sub(this.target, p), f));
    this.dist *= f;
  }

  /** Fit a bounding box in view. */
  fit(min: Vec3, max: Vec3): void {
    this.target = scale(add(min, max), 0.5);
    const r = Math.max(30, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    const vf = (this.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (this.width / this.height));
    this.dist = (r / Math.sin(Math.min(vf, hf) / 2)) * 1.05;
  }
}
