import type { Inference } from "../inference/engine";
import { add, cross, dist, dot, len, madd, norm, planeFrom, scale, sub, type Vec3 } from "../math";
import { formatAngle, parseAngle } from "../units";
import { protractorNormal, protractorRadius } from "./rotate";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

interface Sweeping {
  /** World centre and unit normal of the protractor's plane. */
  center: Vec3;
  normal: Vec3;
  /** Unit direction of the 0° ray in the plane; null until the second click. */
  start: Vec3 | null;
  /** Radians, counter-clockwise about `normal`, as last previewed. */
  angle: number;
}

interface LastGuide {
  id: number;
  center: Vec3;
  normal: Vec3;
  start: Vec3;
  /** `model.revision` right after the Guide commit; a later change to the model
   *  means the last Guide is no longer the top undo step. */
  revision: number;
}

/** 15°, the tick step near the protractor's centre. */
const TICK = Math.PI / 12;
/** 1°, the step farther out, where the protractor measures finer. */
const FINE = Math.PI / 180;

/**
 * Protractor: click a centre, click a base direction, then sweep or type the
 * angle (`37`, `-15`, or a slope such as `3:12`), and a guide line is placed
 * through the centre at that angle. The protractor lies on the face under the
 * cursor, on a face of the hovered edge, else the ground; Shift holds the plane
 * and the arrow keys lock an axis, as Rotate does. Sweeping within the protractor
 * snaps to its 15° ticks, farther out to 1°; a point inference sets it exactly.
 * Retype right after to move the guide.
 */
export class ProtractorTool implements Tool {
  readonly id = "protractor";
  readonly cursor = "crosshair";
  private sweeping: Sweeping | null = null;
  private current: Inference | null = null;
  /** The protractor normal under the cursor while idle. */
  private hoverNormal: Vec3 = [0, 0, 1];
  private last: LastGuide | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    if (!this.sweeping) return "Click the point the guide passes through. The protractor lies on the face under the cursor; arrow keys lock its axis.";
    if (!this.sweeping.start) return "Click a direction from that point to be 0° on the protractor.";
    return "Move to set the angle and click, or type it (37, -15, or a slope like 3:12). 15° steps inside the protractor, 1° outside.";
  }
  vcbLabel(): string {
    return "Angle";
  }
  busy(): boolean {
    return this.sweeping !== null;
  }

  deactivate(): void {
    this.sweeping = null;
    this.host.inference.unlock();
    this.host.show({});
  }

  private radius(): number {
    return protractorRadius(this.host);
  }

  /** The unit direction from the centre to a point, in the protractor's plane. */
  private direction(p: Vec3): Vec3 | null {
    const m = this.sweeping!;
    const d = sub(p, m.center);
    const inPlane = sub(d, scale(m.normal, dot(d, m.normal)));
    return len(inPlane) > 1e-6 ? norm(inPlane) : null;
  }

  move(p: ToolPointer): void {
    const ray = this.host.camera.ray(p.x, p.y);
    if (!this.sweeping) {
      const r = this.host.inference.infer(p.x, p.y, {});
      this.current = r;
      const held = this.host.inference.lockPlane;
      this.hoverNormal = held && this.host.inference.lockAxis === null ? norm(held.normal) : protractorNormal(this.host, r, ray);
      this.host.show({ inference: r, protractor: r ? { center: r.point, normal: this.hoverNormal, radius: this.radius() } : null });
      return;
    }
    const m = this.sweeping;
    const r = this.host.inference.infer(p.x, p.y, { plane: planeFrom(m.center, m.normal) });
    this.current = r;
    if (!r) return;
    const dir = this.direction(r.point);
    if (!dir) return;
    if (!m.start) {
      this.host.show({
        inference: r,
        protractor: { center: m.center, normal: m.normal, radius: this.radius(), start: dir },
        segments: [m.center, r.point],
      });
      return;
    }
    let angle = Math.atan2(dot(cross(m.start, dir), m.normal), dot(m.start, dir));
    if (r.kind === "ground" || r.kind === "plane" || r.kind === "onFace") {
      const step = dist(r.point, m.center) <= this.radius() ? TICK : FINE;
      angle = Math.round(angle / step) * step;
    }
    m.angle = angle;
    this.showSweep(r);
  }

  private showSweep(r: Inference | null): void {
    const m = this.sweeping!;
    const deg = (m.angle * 180) / Math.PI;
    this.host.setVcb(formatAngle(deg));
    const dir = this.swept(m.start!, m.normal, m.angle);
    const half = m.angle / 2;
    const mid = add(scale(m.start!, Math.cos(half)), scale(cross(m.normal, m.start!), Math.sin(half)));
    const far = this.host.camera.dist * 4;
    this.host.show({
      inference: r,
      protractor: { center: m.center, normal: m.normal, radius: this.radius(), start: m.start!, angle: m.angle },
      segments: [madd(m.center, dir, -far), madd(m.center, dir, far)],
      dims: [{ pos: madd(m.center, mid, this.radius() * 1.25), text: formatAngle(deg) }],
    });
  }

  /** The start ray turned by `angle` about `normal`. */
  private swept(start: Vec3, normal: Vec3, angle: number): Vec3 {
    return norm(add(scale(start, Math.cos(angle)), scale(cross(normal, start), Math.sin(angle))));
  }

  down(p: ToolPointer): void {
    if (this.sweeping) {
      if (this.sweeping.start) return this.commit();
      const r = this.current;
      const dir = r && this.direction(r.point);
      if (!dir) return;
      this.sweeping.start = dir;
      this.host.hintChanged();
      return;
    }
    const r = this.current ?? this.host.inference.infer(p.x, p.y, {});
    if (!r) return;
    if (this.host.model.isLockedDef(this.host.ctx)) return this.host.flash("that is on a locked tag");
    this.sweeping = { center: r.point, normal: this.hoverNormal, start: null, angle: 0 };
    this.host.hintChanged();
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.sweeping?.start && Math.abs(this.sweeping.angle) > 1e-6) this.commit();
  }

  key(key: string): boolean {
    if (key === "Escape" && this.sweeping) {
      this.deactivate();
      this.host.hintChanged();
      return true;
    }
    return false;
  }

  vcb(text: string): void {
    const deg = parseAngle(text);
    if (!Number.isFinite(deg)) return this.host.flash("Type an angle like 37, -15 or a slope like 3:12");
    const angle = (deg * Math.PI) / 180;
    if (this.sweeping) {
      if (!this.sweeping.start) return this.host.flash("Pick a 0° direction first");
      this.sweeping.angle = angle;
      this.commit();
      return;
    }
    const last = this.last;
    if (last && last.revision === this.host.model.revision) {
      this.host.model.undo();
      const id = this.place(last.center, this.swept(last.start, last.normal, angle));
      if (id !== null) this.last = { ...last, id, revision: this.host.model.revision };
      this.host.refresh();
      return;
    }
    this.host.flash("Place an angled guide first");
  }

  /** Add the guide line in one Guide transaction; null (flashed) when the kernel refuses. */
  private place(center: Vec3, dir: Vec3): number | null {
    const { model, ctx } = this.host;
    try {
      return model.transact("Guide", () => model.addGuideLine(ctx, this.host.toLocal(center), this.host.toLocalDir(dir)));
    } catch (e) {
      this.host.flash(errorMessage(e));
      return null;
    }
  }

  private commit(): void {
    const m = this.sweeping!;
    this.sweeping = null;
    const id = this.place(m.center, this.swept(m.start!, m.normal, m.angle));
    if (id !== null) this.last = { id, center: m.center, normal: m.normal, start: m.start!, revision: this.host.model.revision };
    this.host.inference.unlock();
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}
