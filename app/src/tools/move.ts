import type { Inference } from "../inference/engine";
import { add, dist, madd, mul, norm, sub, translation, type Mat4, type Vec3 } from "../math";
import { parseArray, parseLength, type ArraySpec } from "../units";
import { pickEntity } from "./pick";
import type { Entity } from "../kernel/model";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

interface Moving {
  base: Vec3;
  verts: number[];
  instances: { id: number; transform: Mat4 }[];
  /** Last offset the kernel accepted. */
  good: Vec3;
  /** Commit as a copy instead of a move. Toggled by the copy modifier until commit. */
  copy: boolean;
  /** The faces and edges the copy duplicates (instances come from `instances`). */
  selection: Selected;
}

interface Selected {
  faces: number[];
  edges: number[];
  instances: number[];
}

interface LastCopy {
  /** What was copied, in the context it was copied in. */
  selection: Selected;
  /** The committed offset in world coordinates. */
  offset: Vec3;
  /** Copies made by the last array replay, or 1 after a plain copy. */
  count: number;
  /** `model.revision` right after the Copy commit (or array replay); a later
   *  change to the model means the last Copy is no longer the top undo step. */
  revision: number;
}

/**
 * Move: with something selected (or hovering it), click a base point, then click
 * where it goes. Inference and axis locks work from the base point. Moving part of
 * connected geometry stretches what it is attached to. Type a distance to set it.
 * With the copy modifier held (Option on Mac, Ctrl elsewhere) the original stays
 * and a copy is placed instead.
 */
export class MoveTool implements Tool {
  readonly id = "move";
  private moving: Moving | null = null;
  private current: Inference | null = null;
  private last: { base: Vec3; dir: Vec3; copy: boolean; selection: Selected } | null = null;
  private lastCopy: LastCopy | null = null;
  /** The copy modifier as last reported while nothing was moving. */
  private pendingCopy = false;

  constructor(private host: ToolHost) {}

  get cursor(): string {
    return this.moving?.copy ? "copy" : "move";
  }

  hint(): string {
    if (this.moving?.copy) return "Click to place the copy, or type a distance. Then type 5x or /5 for an array.";
    return this.moving
      ? "Click to place, or type a distance. Arrow keys lock an axis."
      : "Click a point on the selection (or on what you hover) to pick it up. Hold Ctrl (Option on Mac) to copy.";
  }

  /** The copy modifier went down or up: switch the move in progress, or remember
   *  it for the next pick-up. */
  modifier(copy: boolean): void {
    if (this.moving) this.moving.copy = copy;
    else this.pendingCopy = copy;
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
    this.lastCopy = null;
    this.pendingCopy = false;
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
    // Locked geometry is refused before anything is previewed.
    const locked = selection.ids("instance").some((id) => model.instanceProps(id)?.locked) ||
      ((selection.ids("face").length || selection.ids("edge").length) && model.isLockedDef(this.host.ctx));
    if (locked) return this.host.flash("that is on a locked tag");
    this.start(this.current.point, selection.ids("face"), selection.ids("edge"), selection.ids("instance"), p.copy || this.pendingCopy);
    if (this.moving) model.begin("Move");
  }

  private start(base: Vec3, faces: number[], edges: number[], instances: number[], copy = false): void {
    const { model, ctx } = this.host;
    this.lastCopy = null;
    const verts = model.verticesOf(faces, edges);
    const all = model.instances(ctx);
    const insts = instances.map((id) => ({ id, transform: all.find((i) => i.id === id)?.transform ?? [] })).filter((i) => i.transform.length);
    if (!verts.length && !insts.length) return;
    const selection = { faces, edges, instances };
    this.moving = { base, verts, instances: insts, good: [0, 0, 0], copy, selection };
    this.last = { base, dir: [0, 0, 0], copy, selection };
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
    const spec = parseArray(text);
    if (spec) return this.array(spec);
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
      const { base, dir, copy, selection } = this.last;
      // A copy is retyped only while it is still the last step; a plain move
      // keeps its older, unguarded retype.
      if (copy && !this.copyIsLastStep()) return;
      this.host.model.undo();
      this.start(base, selection.faces, selection.edges, selection.instances, copy);
      if (!this.moving) return;
      this.host.model.begin("Move");
      this.apply(madd([0, 0, 0], dir, d));
      this.commit();
      return;
    }
    this.host.flash("Move something first");
  }

  /** Replace the last copy by an array of it: `times` N puts N copies at the
   *  copy's spacing, `divide` N spreads N copies evenly over the copy's offset.
   *  The last Copy transaction is undone and the array made as one, so retyping
   *  changes the count and one undo removes the whole array. */
  private array(spec: ArraySpec): void {
    if (!this.copyIsLastStep()) return;
    const lc = this.lastCopy!;
    const { model } = this.host;
    const offsets: Vec3[] = [];
    for (let k = 1; k <= spec.n; k++) offsets.push(madd([0, 0, 0], lc.offset, spec.kind === "times" ? k : k / spec.n));
    model.undo();
    if (this.makeCopies(lc.selection, offsets)) {
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

  /** Make copies of `sel` at every offset (world coordinates) in one Copy
   *  transaction and select them. Returns what was made, or null on an error
   *  (flashed, transaction aborted). */
  private makeCopies(sel: Selected, offsets: Vec3[]): Entity[] | null {
    const { model, ctx } = this.host;
    try {
      const made: Entity[] = [];
      model.transact("Copy", () => {
        for (const o of offsets) {
          const local = this.host.toLocalDir(o);
          if (sel.faces.length || sel.edges.length) {
            const g = model.copyGeometry(ctx, sel.faces, sel.edges, local);
            made.push(...g.faces.map((id) => ({ kind: "face" as const, id })), ...g.edges.map((id) => ({ kind: "edge" as const, id })));
          }
          for (const i of sel.instances) made.push({ kind: "instance", id: model.copyInstance(i, local) });
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
    const m = this.moving!;
    this.moving = null;
    const { model } = this.host;
    if (dist([0, 0, 0], m.good) < 1e-3) {
      model.abort();
    } else if (m.copy) {
      // The preview moved the originals; put them back and make the copies.
      model.abort();
      if (this.makeCopies(m.selection, [m.good])) {
        this.lastCopy = { selection: m.selection, offset: m.good, count: 1, revision: model.revision };
      }
      // The modifier may have changed since pick-up; retyping repeats what was committed.
      if (this.last) this.last = { ...this.last, dir: norm(m.good), copy: true };
    } else {
      // The preview only displaced vertices; the committed move also folds bent
      // faces and welds what landed on other geometry.
      model.abort();
      model.begin("Move");
      try {
        const local = this.host.toLocalDir(m.good);
        if (m.verts.length) model.moveAndIntegrate(m.verts, local);
        for (const inst of m.instances) model.setTransform(inst.id, mul(translation(local), inst.transform));
        model.commit();
      } catch (e) {
        model.abort();
        this.host.flash(errorMessage(e));
      }
      if (this.last) this.last = { ...this.last, dir: norm(m.good), copy: false };
    }
    this.host.inference.unlock();
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}
