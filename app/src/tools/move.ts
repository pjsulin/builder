import type { Inference } from "../inference/engine";
import { add, dist, madd, mul, norm, sub, translation, type Mat4, type Vec3 } from "../math";
import { parseLength } from "../units";
import { pickEntity } from "./pick";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

interface Moving {
  base: Vec3;
  verts: number[];
  instances: { id: number; transform: Mat4 }[];
  /** Last offset the kernel accepted. */
  good: Vec3;
}

/**
 * Move: with something selected (or hovering it), click a base point, then click
 * where it goes. Inference and axis locks work from the base point. Moving part of
 * connected geometry stretches what it is attached to. Type a distance to set it.
 */
export class MoveTool implements Tool {
  readonly id = "move";
  readonly cursor = "move";
  private moving: Moving | null = null;
  private current: Inference | null = null;
  private last: { base: Vec3; dir: Vec3; selection: { faces: number[]; edges: number[]; instances: number[] } } | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return this.moving
      ? "Click to place, or type a distance. Arrow keys lock an axis."
      : "Click a point on the selection (or on what you hover) to pick it up.";
  }
  vcbLabel(): string {
    return "Distance";
  }
  busy(): boolean {
    return this.moving !== null;
  }

  deactivate(): void {
    if (this.moving) {
      this.host.model.abort();
      this.moving = null;
      this.host.refresh();
    }
    this.host.inference.unlock();
    this.host.show({});
  }

  move(p: ToolPointer): void {
    const r = this.host.inference.infer(p.x, p.y, { anchor: this.moving?.base });
    this.current = r;
    if (!this.moving) {
      const pick = this.host.selection.empty ? pickEntity(this.host.scene(), this.host.camera, p.x, p.y) : null;
      this.host.show({ inference: r, hoverEntity: pick && !pick.outside && !pick.locked ? pick.entity : null });
      return;
    }
    if (!r) return;
    const m = this.moving;
    this.apply(sub(r.point, m.base));
    const d = dist([0, 0, 0], m.good);
    this.host.setVcb(this.host.format(d));
    const end = add(m.base, m.good);
    this.host.show({
      inference: r,
      segments: [m.base, end],
      dims: [{ pos: madd(m.base, m.good, 0.5), text: this.host.format(d) }],
    });
  }

  private apply(offset: Vec3): void {
    const m = this.moving!;
    const { model } = this.host;
    const run = (o: Vec3) => {
      const local = this.host.toLocalDir(o);
      if (m.verts.length) model.moveVertices(m.verts, local);
      for (const inst of m.instances) model.setTransform(inst.id, mul(translation(local), inst.transform));
    };
    model.abort();
    model.begin("Move");
    try {
      run(offset);
      m.good = offset;
    } catch {
      model.abort();
      model.begin("Move");
      run(m.good);
    }
    this.host.refresh({ preview: true });
  }

  down(p: ToolPointer): void {
    if (this.moving) return this.commit();
    const { selection, model } = this.host;
    if (selection.empty) {
      const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
      if (!pick || pick.outside || pick.locked) return;
      selection.set([pick.entity]);
    }
    if (!this.current) return;
    this.start(this.current.point, selection.ids("face"), selection.ids("edge"), selection.ids("instance"));
    if (this.moving) model.begin("Move");
  }

  private start(base: Vec3, faces: number[], edges: number[], instances: number[]): void {
    const { model, ctx } = this.host;
    const verts = model.verticesOf(faces, edges);
    const all = model.instances(ctx);
    const insts = instances.map((id) => ({ id, transform: all.find((i) => i.id === id)?.transform ?? [] })).filter((i) => i.transform.length);
    if (!verts.length && !insts.length) return;
    this.moving = { base, verts, instances: insts, good: [0, 0, 0] };
    this.last = { base, dir: [0, 0, 0], selection: { faces, edges, instances } };
    this.host.hintChanged();
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.moving && dist([0, 0, 0], this.moving.good) > 1e-3) this.commit();
  }

  key(key: string): boolean {
    if (key === "Escape" && this.moving) {
      this.deactivate();
      this.host.hintChanged();
      return true;
    }
    return false;
  }

  vcb(text: string): void {
    const d = parseLength(text, this.host.units);
    if (!Number.isFinite(d)) return this.host.flash("Type a distance like 8' or 30\"");
    if (this.moving) {
      const dir = norm(this.moving.good);
      if (dist([0, 0, 0], dir) < 0.5) return this.host.flash("Move the cursor to pick a direction first");
      this.apply(madd([0, 0, 0], dir, d));
      this.commit();
      return;
    }
    if (this.last && dist([0, 0, 0], this.last.dir) > 0.5) {
      const { base, dir, selection } = this.last;
      this.host.model.undo();
      this.start(base, selection.faces, selection.edges, selection.instances);
      if (!this.moving) return;
      this.host.model.begin("Move");
      this.apply(madd([0, 0, 0], dir, d));
      this.commit();
      return;
    }
    this.host.flash("Move something first");
  }

  private commit(): void {
    const m = this.moving!;
    this.moving = null;
    const { model } = this.host;
    if (dist([0, 0, 0], m.good) < 1e-3) {
      model.abort();
    } else {
      try {
        model.commit();
      } catch (e) {
        this.host.flash(errorMessage(e));
      }
      if (this.last) this.last.dir = norm(m.good);
    }
    this.host.inference.unlock();
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}
