import type { Inference } from "../inference/engine";
import { add, dot, madd, planeBasis, planeFrom, scale, sub, type Plane, type Vec3 } from "../math";
import { parseLengths } from "../units";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

/** How close (inches) a start point must be to a face's plane to draw on that face. */
const ON_PLANE = 0.01;

interface RectPlane {
  plane: Plane;
  u: Vec3;
  v: Vec3;
}

/**
 * Rectangle: click a corner on the ground or on any face (flat or tilted), then the
 * opposite corner. Type "width, depth" while drawing, or right after to resize.
 */
export class RectangleTool implements Tool {
  readonly id = "rectangle";
  readonly cursor = "crosshair";
  private c0: Vec3 | null = null;
  private rp: RectPlane | null = null;
  private hoverPlane: RectPlane | null = null;
  private hoverPoint: Vec3 | null = null;
  private size: [number, number] = [0, 0];
  private last: { c0: Vec3; rp: RectPlane; su: number; sv: number } | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return this.c0
      ? "Click the opposite corner, or type width, depth such as 10',8' and press Enter."
      : "Click a corner on the ground or on any face, then click the opposite corner.";
  }
  vcbLabel(): string {
    return "Dimensions";
  }
  busy(): boolean {
    return this.c0 !== null;
  }

  deactivate(): void {
    this.c0 = null;
    this.rp = null;
    this.host.show({});
  }

  /**
   * The plane a rectangle starting at this inference would lie in: the face it is
   * on, a plane locked with Shift, or the face under the cursor when the start
   * snapped to a corner or edge of that face. Only with no face at all does it lie
   * flat (horizontal) at the start point's height.
   */
  private planeFor(r: Inference, p: ToolPointer): RectPlane {
    let normal: Vec3 = [0, 0, 1];
    const locked = this.host.inference.lockPlane;
    if (r.face) normal = r.face.normal;
    else if (locked && Math.abs(dot(locked.normal, r.point) - locked.d) < ON_PLANE) normal = locked.normal;
    else {
      const hit = this.host.scene().pick(this.host.camera.ray(p.x, p.y), (it) => it.active);
      if (hit && Math.abs(dot(hit.normal, sub(r.point, hit.point))) < ON_PLANE) normal = hit.normal;
    }
    const plane = planeFrom(r.point, normal);
    const [u, v] = planeBasis(plane.normal);
    return { plane, u, v };
  }

  move(p: ToolPointer): void {
    const { inference } = this.host;
    if (!this.c0 || !this.rp) {
      const r = inference.infer(p.x, p.y);
      if (!r) return this.host.show({});
      this.hoverPoint = r.point;
      this.hoverPlane = this.planeFor(r, p);
      this.host.show({ inference: r, hover: r.face ? { item: r.face.item, face: r.face.face } : null });
      return;
    }
    const r = inference.infer(p.x, p.y, { plane: this.rp.plane, anchor: this.c0 });
    if (!r) return;
    const d = sub(r.point, this.c0);
    let w = dot(d, this.rp.u);
    let h = dot(d, this.rp.v);
    let label = r.label;
    const snapped = r.kind === "endpoint" || r.kind === "midpoint" || r.kind === "origin";
    if (!snapped && Math.abs(w) > 2 && Math.abs(Math.abs(w) - Math.abs(h)) < 0.04 * Math.max(Math.abs(w), Math.abs(h))) {
      h = Math.sign(h || 1) * Math.abs(w);
      label = "Square";
    }
    this.size = [w, h];
    this.preview({ ...r, label });
  }

  private corners(w: number, h: number): Vec3[] {
    const { u, v } = this.rp!;
    const c0 = this.c0!;
    return [c0, madd(c0, u, w), add(madd(c0, u, w), scale(v, h)), madd(c0, v, h)];
  }

  private preview(r: Inference | null): void {
    const [w, h] = this.size;
    const pts = this.corners(w, h);
    const f = this.host.format;
    this.host.setVcb(`${f(Math.abs(w))}, ${f(Math.abs(h))}`);
    this.host.show({
      inference: r ? { ...r, point: pts[2] } : null,
      segments: [pts[0], pts[1], pts[1], pts[2], pts[2], pts[3], pts[3], pts[0]],
      fill: pts,
      dims: [
        { pos: madd(pts[0], sub(pts[1], pts[0]), 0.5), text: f(Math.abs(w)) },
        { pos: madd(pts[1], sub(pts[2], pts[1]), 0.5), text: f(Math.abs(h)) },
      ],
    });
  }

  down(): void {
    if (!this.c0) {
      if (!this.hoverPoint || !this.hoverPlane) return;
      this.c0 = this.hoverPoint;
      this.rp = this.hoverPlane;
      this.size = [0, 0];
      this.host.hintChanged();
      return;
    }
    this.commit();
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.c0 && (Math.abs(this.size[0]) > 1e-3 || Math.abs(this.size[1]) > 1e-3)) this.commit();
  }

  key(key: string): boolean {
    if (key === "Escape" && this.c0) {
      this.deactivate();
      this.host.hintChanged();
      return true;
    }
    return false;
  }

  vcb(text: string): void {
    const parts = parseLengths(text, this.host.units);
    if (this.c0 && this.rp) {
      const [w0, h0] = this.size;
      const w = parts[0];
      const h = parts.length > 1 ? parts[1] : Math.abs(h0) || w;
      if (!(w > 0 && h > 0)) return this.host.flash("Type width, depth like 8',6'");
      this.size = [Math.sign(w0 || 1) * w, Math.sign(h0 || 1) * h];
      this.commit();
      return;
    }
    if (this.last) {
      const w = parts[0];
      const h = parts.length > 1 ? parts[1] : w;
      if (!(w > 0 && h > 0)) return this.host.flash("Type width, depth like 8',6'");
      this.host.model.undo();
      this.c0 = this.last.c0;
      this.rp = this.last.rp;
      this.size = [this.last.su * w, this.last.sv * h];
      this.commit();
      return;
    }
    this.host.flash("Start a rectangle first");
  }

  private commit(): void {
    const [w, h] = this.size;
    if (Math.abs(w) < 1e-3 || Math.abs(h) < 1e-3) {
      this.host.flash("Rectangle too small");
      return;
    }
    const pts = this.corners(w, h).map((p) => this.host.toLocal(p));
    const { model, ctx } = this.host;
    try {
      model.transact("Rectangle", () => {
        for (let i = 0; i < 4; i++) model.addLine(ctx, pts[i], pts[(i + 1) % 4]);
      });
    } catch (e) {
      this.host.flash(errorMessage(e));
    }
    this.last = { c0: this.c0!, rp: this.rp!, su: Math.sign(w), sv: Math.sign(h) };
    const f = this.host.format;
    this.host.setVcb(`${f(Math.abs(w))}, ${f(Math.abs(h))}`);
    this.c0 = null;
    this.rp = null;
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}
