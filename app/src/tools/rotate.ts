import { AXES, type Inference } from "../inference/engine";
import { add, applyDir, cross, dot, len, madd, mul, norm, planeFrom, rotation, scale, sub, type Mat4, type Ray, type Vec3 } from "../math";
import { formatAngle, parseAngle, parseArray, type ArraySpec } from "../units";
import { pickEntity } from "./pick";
import type { Entity } from "../kernel/model";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

interface Selected {
  faces: number[];
  edges: number[];
  instances: number[];
}

interface Rotating {
  /** World centre and unit normal of the protractor (the rotation axis). */
  center: Vec3;
  normal: Vec3;
  /** Unit direction of the start ray in the plane; null until the second click. */
  start: Vec3 | null;
  /** Radians, the last angle the kernel accepted. */
  angle: number;
  verts: number[];
  instances: { id: number; transform: Mat4 }[];
  /** Commit as a copy instead of a rotation. Toggled by the copy modifier until commit. */
  copy: boolean;
  /** The faces and edges the copy duplicates (instances come from `instances`). */
  selection: Selected;
}

interface LastCopy {
  /** What was copied, in the context it was copied in. */
  selection: Selected;
  /** The committed rotation, in world coordinates. */
  center: Vec3;
  normal: Vec3;
  angle: number;
  /** Copies made by the last array replay, or 1 after a plain copy. */
  count: number;
  /** `model.revision` right after the Copy commit (or array replay); a later
   *  change to the model means the last Copy is no longer the top undo step. */
  revision: number;
}

/** 15°, the snap step when the cursor is on nothing in particular. */
const STEP = Math.PI / 12;

/**
 * Rotate: with something selected (or hovering it), click the centre, click a
 * start direction, then sweep or type the angle. The protractor lies on the
 * face under the cursor, on a face of the hovered edge (the one facing the
 * camera), else on the ground; arrow keys lock it to an axis. 15° snapping when
 * the cursor is on nothing; an endpoint, midpoint or edge sets the angle exactly.
 * With the copy modifier held (Option on Mac, Ctrl elsewhere) the original stays
 * and a rotated copy is placed; `6x` or `/6` typed afterwards makes a radial array.
 */
export class RotateTool implements Tool {
  readonly id = "rotate";
  private rotating: Rotating | null = null;
  private current: Inference | null = null;
  /** The protractor normal under the cursor while idle. */
  private hoverNormal: Vec3 = [0, 0, 1];
  private last: { center: Vec3; normal: Vec3; start: Vec3; copy: boolean; selection: Selected } | null = null;
  private lastCopy: LastCopy | null = null;
  /** The copy modifier as last reported while nothing was rotating. */
  private pendingCopy = false;

  constructor(private host: ToolHost) {}

  get cursor(): string {
    return (this.rotating ? this.rotating.copy : this.pendingCopy) ? "copy" : "crosshair";
  }

  hint(): string {
    if (!this.rotating) {
      return this.pendingCopy
        ? "Copy is on: click the point the copy turns about (on the selection to turn in place, elsewhere to swing round it). Tap Ctrl (Option on Mac) again to rotate the original instead."
        : "Click the point the selection turns about: on it to turn in place, elsewhere to swing round that point. Arrow keys lock the axis. Tap Ctrl (Option on Mac) to copy.";
    }
    if (!this.rotating.start) return "Click a direction from that point to be 0° on the protractor (along the selection is usual). Nothing moves yet.";
    if (this.rotating.copy) return "Move or type the angle from 0° and click (minus turns the other way): the copy lands there. Then type 6x or /6 for a radial array.";
    return "Move to set the angle from 0° and click, or type it (minus turns the other way). Steps of 15° off geometry; a point or edge sets it exactly.";
  }

  /** The copy key was tapped: switch the rotation in progress between rotate and
   *  copy, or arm a copy for the next pick-up. */
  modifier(): void {
    if (this.rotating) this.rotating.copy = !this.rotating.copy;
    else this.pendingCopy = !this.pendingCopy;
  }
  vcbLabel(): string {
    return "Angle";
  }
  busy(): boolean {
    return this.rotating !== null;
  }

  deactivate(): void {
    if (this.rotating) {
      this.host.model.abort();
      this.rotating = null;
      this.host.refresh();
    }
    this.lastCopy = null;
    this.pendingCopy = false;
    this.host.inference.unlock();
    this.host.show({});
  }

  private radius(): number {
    return protractorRadius(this.host);
  }

  private protractorNormal(r: Inference | null, ray: Ray): Vec3 {
    return protractorNormal(this.host, r, ray);
  }

  /** The unit direction from the centre to a point, in the protractor's plane. */
  private direction(p: Vec3): Vec3 | null {
    const m = this.rotating!;
    const d = sub(p, m.center);
    const inPlane = sub(d, scale(m.normal, dot(d, m.normal)));
    return len(inPlane) > 1e-6 ? norm(inPlane) : null;
  }

  move(p: ToolPointer): void {
    const ray = this.host.camera.ray(p.x, p.y);
    if (!this.rotating) {
      const r = this.host.inference.infer(p.x, p.y, {});
      this.current = r;
      this.hoverNormal = this.protractorNormal(r, ray);
      const pick = this.host.selection.empty ? pickEntity(this.host.scene(), this.host.camera, p.x, p.y) : null;
      this.host.show({
        inference: r,
        hoverEntity: pick && !pick.outside && !pick.locked && pick.entity.kind !== "guide" ? pick.entity : null,
        protractor: r ? { center: r.point, normal: this.hoverNormal, radius: this.radius() } : null,
      });
      return;
    }
    const m = this.rotating;
    // The plane alone: an anchor would let an arrow-key lock (which chose the
    // protractor's plane) pin the cursor to the axis line.
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
    if (r.kind === "ground" || r.kind === "plane" || r.kind === "onFace") angle = Math.round(angle / STEP) * STEP;
    this.apply(angle);
    this.showSweep(r);
  }

  private showSweep(r: Inference | null): void {
    const m = this.rotating!;
    const deg = (m.angle * 180) / Math.PI;
    this.host.setVcb(formatAngle(deg));
    const half = m.angle / 2;
    const mid = add(scale(m.start!, Math.cos(half)), scale(cross(m.normal, m.start!), Math.sin(half)));
    this.host.show({
      inference: r,
      protractor: { center: m.center, normal: m.normal, radius: this.radius(), start: m.start!, angle: m.angle },
      dims: [{ pos: madd(m.center, mid, this.radius() * 1.25), text: formatAngle(deg) }],
    });
  }

  /** The rotation in the active context's coordinates. */
  private localRotation(center: Vec3, normal: Vec3, angle: number): Mat4 {
    return rotation(this.host.toLocal(center), this.host.toLocalDir(normal), angle);
  }

  /** Re-run the preview at `angle`, keeping the last good angle on a kernel error.
   *  A copy keeps the requested angle anyway: its preview displaces the originals,
   *  which can fail (a face turned onto its neighbour) where the copy itself welds. */
  private apply(angle: number): void {
    const m = this.rotating!;
    const { model } = this.host;
    const run = (a: number) => {
      const local = this.localRotation(m.center, m.normal, a);
      if (m.verts.length) model.transformVertices(m.verts, local);
      for (const inst of m.instances) model.setTransform(inst.id, mul(local, inst.transform));
    };
    model.abort();
    model.begin("Rotate");
    try {
      run(angle);
      m.angle = angle;
    } catch {
      model.abort();
      model.begin("Rotate");
      if (m.copy) m.angle = angle;
      else run(m.angle);
    }
    this.host.refresh({ preview: true });
  }

  down(p: ToolPointer): void {
    if (this.rotating) {
      if (this.rotating.start) return this.commit();
      // The second click fixes the start direction.
      const r = this.current;
      const dir = r && this.direction(r.point);
      if (!dir) return;
      this.rotating.start = dir;
      this.host.model.begin("Rotate");
      this.host.hintChanged();
      return;
    }
    const { selection, model } = this.host;
    if (selection.empty) {
      const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
      if (!pick || pick.outside || pick.locked || pick.entity.kind === "guide") return;
      selection.set([pick.entity]);
    }
    if (!this.current) return;
    // Locked geometry is refused before anything is previewed.
    const locked = selection.ids("instance").some((id) => model.instanceProps(id)?.locked) ||
      ((selection.ids("face").length || selection.ids("edge").length) && model.isLockedDef(this.host.ctx));
    if (locked) return this.host.flash("that is on a locked tag");
    const sel = { faces: selection.ids("face"), edges: selection.ids("edge"), instances: selection.ids("instance") };
    this.start(this.current.point, this.hoverNormal, sel, p.copy || this.pendingCopy);
  }

  /** Pick up the selection about `center`; null when there is nothing to rotate. */
  private start(center: Vec3, normal: Vec3, selection: Selected, copy = false): Rotating | null {
    const { model, ctx } = this.host;
    this.lastCopy = null;
    this.pendingCopy = false;
    const verts = model.verticesOf(selection.faces, selection.edges);
    const all = model.instances(ctx);
    const insts = selection.instances
      .map((id) => ({ id, transform: all.find((i) => i.id === id)?.transform ?? [] }))
      .filter((i) => i.transform.length);
    if (!verts.length && !insts.length) return null;
    this.rotating = { center, normal, start: null, angle: 0, verts, instances: insts, copy, selection };
    this.host.hintChanged();
    return this.rotating;
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.rotating?.start && Math.abs(this.rotating.angle) > 1e-6) this.commit();
  }

  key(key: string): boolean {
    if (key === "Escape" && this.rotating) {
      this.deactivate();
      this.host.hintChanged();
      return true;
    }
    return false;
  }

  vcb(text: string): void {
    const spec = parseArray(text);
    if (spec) return this.array(spec);
    const deg = parseAngle(text);
    if (!Number.isFinite(deg)) return this.host.flash("Type an angle like 37 or -15");
    const angle = (deg * Math.PI) / 180;
    if (this.rotating) {
      if (!this.rotating.start) return this.host.flash("Pick a start direction first");
      this.apply(angle);
      if (Math.abs(this.rotating.angle - angle) > 1e-9) return this.host.flash("Can't rotate that far");
      this.commit();
      return;
    }
    if (this.last) {
      const { center, normal, start, copy, selection } = this.last;
      // A copy is retyped only while it is still the last step; a plain rotation
      // keeps its older, unguarded retype.
      if (copy && !this.copyIsLastStep()) return;
      this.host.model.undo();
      const m = this.start(center, normal, selection, copy);
      if (!m) return;
      m.start = start;
      this.host.model.begin("Rotate");
      this.apply(angle);
      this.commit();
      return;
    }
    this.host.flash("Rotate something first");
  }

  /** Replace the last rotate-copy by a radial array of it: `times` N puts N
   *  copies at the copy's angle apart, `divide` N spreads N copies evenly over
   *  the copy's angle. The last Copy transaction is undone and the array made as
   *  one, so retyping changes the count and one undo removes the whole array. */
  private array(spec: ArraySpec): void {
    if (!this.copyIsLastStep()) return;
    const lc = this.lastCopy!;
    const { model } = this.host;
    const ms: Mat4[] = [];
    for (let k = 1; k <= spec.n; k++) {
      ms.push(this.localRotation(lc.center, lc.normal, spec.kind === "times" ? lc.angle * k : (lc.angle * k) / spec.n));
    }
    model.undo();
    if (this.makeCopies(lc.selection, ms)) {
      this.lastCopy = { ...lc, count: spec.n, revision: model.revision };
    } else {
      // The array failed part way; the single copy comes back as it was.
      model.redo();
      this.lastCopy = { ...lc, revision: model.revision };
    }
    this.host.refresh();
    this.host.hintChanged();
  }

  /** True when the last Copy transaction is still the top of the undo stack;
   *  otherwise forget it and say so. */
  private copyIsLastStep(): boolean {
    if (this.lastCopy && this.host.model.revision === this.lastCopy.revision) return true;
    this.lastCopy = null;
    this.host.flash("Copy something first");
    return false;
  }

  /** Make copies of `sel` under every matrix (context coordinates) in one Copy
   *  transaction and select them. Returns what was made, or null on an error
   *  (flashed, transaction aborted). */
  private makeCopies(sel: Selected, ms: Mat4[]): Entity[] | null {
    const { model, ctx } = this.host;
    try {
      const made: Entity[] = [];
      model.transact("Copy", () => {
        for (const m of ms) {
          if (sel.faces.length || sel.edges.length) {
            const g = model.copyGeometryTransformed(ctx, sel.faces, sel.edges, m);
            made.push(...g.faces.map((id) => ({ kind: "face" as const, id })), ...g.edges.map((id) => ({ kind: "edge" as const, id })));
          }
          for (const i of sel.instances) made.push({ kind: "instance", id: model.copyInstanceTransformed(i, m) });
        }
      });
      this.host.selection.set(made);
      return made;
    } catch (e) {
      model.abort();
      this.host.flash(errorMessage(e));
      return null;
    }
  }

  private commit(): void {
    const m = this.rotating!;
    this.rotating = null;
    this.pendingCopy = false;
    const { model } = this.host;
    if (Math.abs(m.angle) < 1e-6) {
      model.abort();
    } else if (m.copy) {
      // The preview rotated the originals; put them back and place the copy.
      model.abort();
      if (this.makeCopies(m.selection, [this.localRotation(m.center, m.normal, m.angle)])) {
        this.lastCopy = { selection: m.selection, center: m.center, normal: m.normal, angle: m.angle, count: 1, revision: model.revision };
      }
      // The modifier may have changed since pick-up; retyping repeats what was committed.
      this.last = { center: m.center, normal: m.normal, start: m.start!, copy: true, selection: m.selection };
    } else {
      // The preview only displaced vertices; the committed rotation also folds
      // bent faces and welds what landed on other geometry.
      model.abort();
      model.begin("Rotate");
      try {
        const local = this.localRotation(m.center, m.normal, m.angle);
        if (m.verts.length) model.transformAndIntegrate(m.verts, local);
        for (const inst of m.instances) model.setTransform(inst.id, mul(local, inst.transform));
        model.commit();
      } catch (e) {
        model.abort();
        this.host.flash(errorMessage(e));
      }
      this.last = { center: m.center, normal: m.normal, start: m.start!, copy: false, selection: m.selection };
    }
    this.host.inference.unlock();
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}

/** Radius that keeps a protractor about the same size on screen. */
export function protractorRadius(host: ToolHost): number {
  return host.camera.dist * 0.12;
}

/**
 * The protractor's plane normal for an inference: a hovered face's normal, a
 * hovered edge's camera-facing face's normal, else the ground; flipped to face
 * the camera. An arrow-key lock overrides with its axis. Shared by Rotate and the
 * Protractor guide tool, and by Tape Measure for the plane a guide is dragged in.
 */
export function protractorNormal(host: ToolHost, r: Inference | null, ray: Ray): Vec3 {
  const lock = host.inference.lockAxis;
  if (lock !== null) return AXES[lock];
  const toward = (n: Vec3): Vec3 => (dot(n, ray.dir) > 0 ? scale(n, -1) : n);
  if (r?.face) return toward(r.face.normal);
  if (r?.edge && r.guide === undefined) {
    const item = host.scene().items[r.edge.item];
    let best: Vec3 | null = null;
    let bestFacing = -1;
    for (const f of host.model.edgeFaces(r.edge.id)) {
      const plane = host.model.facePlane(f);
      if (!plane) continue;
      const n = norm(applyDir(item.matrix, plane.normal));
      const facing = Math.abs(dot(n, ray.dir));
      if (facing > bestFacing) {
        bestFacing = facing;
        best = n;
      }
    }
    if (best) return toward(best);
  }
  return [0, 0, 1];
}
