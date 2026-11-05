import type { Inference } from "../inference/engine";
import { AXES } from "../inference/engine";
import type { GuideRecord } from "../kernel/model";
import { add, applyDir, cross, dist, dot, len, madd, norm, planeFrom, scale, sub, type Plane, type Vec3 } from "../math";
import { parseLength } from "../units";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

interface Measuring {
  from: Inference;
  /** What the second click makes: a parallel guide line, a guide point, or nothing. */
  mode: "line" | "point" | "measure";
  /** For a line: the edge (or in-face line) the guide runs parallel to, in world space. */
  edge?: { a: Vec3; b: Vec3 };
  /** For a line: the plane the guide is dragged in, chosen from `planes` by the
   *  first movement (the clicked face's plane straight away). */
  plane?: Plane;
  /** The planes of the edge's faces, or the ground for a loose edge or a guide. */
  planes?: Plane[];
  /** The clicked edge, which the drag never snaps back onto. */
  ignore?: Set<number>;
  /** The guide the second click would place, in world space. */
  preview?: GuideRecord;
}

interface LastGuide {
  id: number;
  kind: "line" | "point";
  /** World base the typed distance is measured from, and the unit direction it runs along. */
  base: Vec3;
  dir: Vec3;
  /** For a line: its world direction. */
  along?: Vec3;
  /** `model.revision` right after the Guide commit; a later change to the model
   *  means the last Guide is no longer the top undo step. */
  revision: number;
}

/**
 * Tape Measure: in guide mode (the default, cursor with a +), click an endpoint
 * or guide point and then a second point for a guide point at that distance, or
 * click a midpoint, an edge or a face and move off it for a parallel guide line
 * at that distance; type the distance to set it, and retype right after to move
 * the guide. Tap Ctrl (Option on a Mac) for measure-only mode: two clicks show the
 * length in the Measurements box and change nothing.
 */
export class TapeMeasureTool implements Tool {
  readonly id = "measure";
  private active: Measuring | null = null;
  private last: LastGuide | null = null;
  private measureOnly = false;

  constructor(private host: ToolHost) {}

  get cursor(): string {
    return this.measureOnly ? "measure-only" : "measure";
  }

  hint(): string {
    if (this.active?.mode === "measure") return "Click the second point to read the length.";
    if (this.active?.mode === "point") return "Click or type the distance for the guide point. Arrow keys lock an axis.";
    if (this.active) return "Move off the edge and click, or type the distance, for a parallel guide line.";
    return this.measureOnly
      ? "Measure only: click two points. Tap Ctrl (Option on Mac) to place guides again."
      : "Click an endpoint for a guide point, or an edge or face for a parallel guide line. Tap Ctrl (Option on Mac) to measure only.";
  }
  vcbLabel(): string {
    return this.measureOnly || this.active?.mode === "measure" ? "Length" : "Distance";
  }
  busy(): boolean {
    return this.active !== null;
  }

  /** The Ctrl tap: guide-create mode ↔ measure-only mode. */
  modifier(): void {
    this.measureOnly = !this.measureOnly;
    if (this.active) this.active.mode = this.measureOnly ? "measure" : this.active.edge ? "line" : "point";
  }

  deactivate(): void {
    this.active = null;
    this.host.show({});
  }

  move(p: ToolPointer): void {
    if (!this.active) {
      const r = this.host.inference.infer(p.x, p.y, {});
      this.host.show({ inference: r });
      return;
    }
    const a = this.active;
    let r = this.host.inference.infer(p.x, p.y, a.mode === "line" ? { plane: a.plane, ignoreEdges: a.ignore } : { anchor: a.from.point });
    if (!r) return;
    if (a.mode === "line" && !a.plane && this.choosePlane(a, r.point)) {
      r = this.host.inference.infer(p.x, p.y, { plane: a.plane, ignoreEdges: a.ignore });
      if (!r) return;
    }
    if (a.mode === "measure") {
      const d = dist(a.from.point, r.point);
      this.host.setVcb(this.host.format(d));
      this.host.show({ inference: r, segments: [a.from.point, r.point], dims: [{ pos: madd(a.from.point, sub(r.point, a.from.point), 0.5), text: this.host.format(d) }] });
      return;
    }
    if (a.mode === "point") {
      a.preview = { id: -1, kind: "point", origin: r.point, dir: [0, 0, 0] };
      const d = dist(a.from.point, r.point);
      this.host.setVcb(this.host.format(d));
      this.host.show({ inference: r, segments: [a.from.point, r.point, ...stub(r.point, this.stubSize())], dims: [{ pos: madd(a.from.point, sub(r.point, a.from.point), 0.5), text: this.host.format(d) }] });
      return;
    }
    this.faceEdge(a, r);
    const e = a.edge!;
    if (dist(e.a, e.b) === 0) return this.host.show({ inference: r });
    const along = norm(sub(e.b, e.a));
    const off = sub(r.point, e.a);
    const perp = sub(off, scale(along, dot(off, along)));
    const d = len(perp);
    const origin = add(e.a, perp);
    a.preview = { id: -1, kind: "line", origin, dir: canonical(along) };
    this.host.setVcb(this.host.format(d));
    const foot = madd(e.a, along, dot(sub(r.point, e.a), along));
    this.host.show({
      inference: r,
      segments: [...this.lineRun(origin, along), foot, r.point],
      dims: [{ pos: madd(foot, perp, 0.5), text: this.host.format(d) }],
    });
  }

  /** The first movement off the edge picks the plane the guide is dragged in: of
   *  the edge's faces, the one whose plane runs most nearly along the travel. */
  private choosePlane(a: Measuring, at: Vec3): boolean {
    const travel = sub(at, a.from.point);
    if (len(travel) < 1e-6 || !a.planes?.length) return false;
    const t = norm(travel);
    a.plane = a.planes.slice().sort((p, q) => Math.abs(dot(p.normal, t)) - Math.abs(dot(q.normal, t)))[0];
    return true;
  }

  /** The visible run of a guide line for the preview, far past the viewport each way. */
  private lineRun(origin: Vec3, dir: Vec3): Vec3[] {
    const far = this.host.camera.dist * 4;
    return [madd(origin, dir, -far), madd(origin, dir, far)];
  }

  private stubSize(): number {
    return Math.max(0.5, this.host.camera.dist * 0.012);
  }

  down(p: ToolPointer): void {
    if (this.active) return this.commit();
    const r = this.host.inference.infer(p.x, p.y, {});
    if (!r) return;
    if (this.measureOnly) {
      this.active = { from: r, mode: "measure" };
      this.host.hintChanged();
      return;
    }
    const { model, ctx } = this.host;
    if (model.isLockedDef(ctx)) return this.host.flash("that is on a locked tag");
    if (r.kind === "endpoint" || r.kind === "guidePoint" || r.kind === "origin" || r.kind === "intersection") {
      this.active = { from: r, mode: "point" };
    } else if ((r.kind === "midpoint" || r.kind === "onEdge" || r.kind === "onGuide") && r.edge) {
      const ignore = r.guide ? undefined : new Set([r.edge.id]);
      this.active = { from: r, mode: "line", edge: { a: r.edge.a, b: r.edge.b }, planes: this.edgePlanes(r), ignore };
    } else if (r.kind === "onFace" && r.face) {
      // The line's direction is settled by the first move: see `faceEdge`.
      this.active = { from: r, mode: "line", edge: { a: r.point, b: r.point }, plane: planeFrom(r.point, r.face.normal) };
    } else {
      this.active = { from: r, mode: "measure" };
    }
    this.host.hintChanged();
  }

  /** World planes of the faces an edge bounds, through the clicked point; the
   *  ground for a loose edge or a guide line. */
  private edgePlanes(r: Inference): Plane[] {
    const planes: Plane[] = [];
    if (r.edge && !r.guide) {
      const item = this.host.scene().items[r.edge.item];
      for (const f of this.host.model.edgeFaces(r.edge.id)) {
        const fp = this.host.model.facePlane(f);
        if (fp) planes.push(planeFrom(r.point, norm(applyDir(item.matrix, fp.normal))));
      }
    }
    return planes.length ? planes : [planeFrom(r.point, [0, 0, 1])];
  }

  /** On a face, the guide runs across the axis nearest the cursor's travel: dragging
   *  along red from the click gives a line along green at that distance. */
  private faceEdge(a: Measuring, r: Inference): void {
    if (!a.from.face || dist(a.edge!.a, a.edge!.b) > 0) return;
    const n = a.from.face.normal;
    const travel = sub(r.point, a.from.point);
    const inPlane = sub(travel, scale(n, dot(travel, n)));
    if (len(inPlane) < 1e-6) return;
    const axis = AXES.map((ax) => sub(ax, scale(n, dot(ax, n))))
      .map((ax) => (len(ax) > 1e-6 ? norm(ax) : null))
      .filter((ax): ax is Vec3 => !!ax)
      .sort((x, y) => Math.abs(dot(y, norm(inPlane))) - Math.abs(dot(x, norm(inPlane))))[0];
    if (!axis) return;
    const along = norm(cross(n, axis));
    a.edge = { a: a.from.point, b: add(a.from.point, along) };
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.active && this.active.preview && this.active.mode !== "measure") this.commit();
  }

  key(key: string): boolean {
    if (key === "Escape" && this.active) {
      this.deactivate();
      this.host.hintChanged();
      return true;
    }
    return false;
  }

  vcb(text: string): void {
    const a = this.active;
    if (a?.mode === "measure" || (!a && this.measureOnly)) return this.host.flash("Measuring only; tap Ctrl (Option on Mac) to place guides");
    const d = parseLength(text, this.host.units);
    if (!Number.isFinite(d) || d <= 0) return this.host.flash("Type a distance like 4' or 30\"");
    if (a) {
      if (!a.preview) return this.host.flash("Move the cursor to set the direction first");
      if (a.mode === "point") {
        const dir = sub(a.preview.origin, a.from.point);
        if (len(dir) < 1e-6) return this.host.flash("Move the cursor to set the direction first");
        a.preview.origin = madd(a.from.point, norm(dir), d);
      } else {
        const e = a.edge!;
        const perp = sub(a.preview.origin, e.a);
        if (len(perp) < 1e-6) return this.host.flash("Move off the edge to set the side first");
        a.preview.origin = madd(e.a, norm(perp), d);
      }
      this.commit();
      return;
    }
    const last = this.last;
    if (last && last.revision === this.host.model.revision) {
      this.host.model.undo();
      const origin = madd(last.base, last.dir, d);
      const id = this.place({ id: -1, kind: last.kind, origin, dir: last.along ?? [0, 0, 0] });
      if (id !== null) this.last = { ...last, id, revision: this.host.model.revision };
      this.host.refresh();
      return;
    }
    this.host.flash("Place a guide first");
  }

  /** Add the guide in one Guide transaction; null (flashed) when the kernel refuses. */
  private place(g: GuideRecord): number | null {
    const { model, ctx } = this.host;
    try {
      return model.transact("Guide", () =>
        g.kind === "line"
          ? model.addGuideLine(ctx, this.host.toLocal(g.origin), this.host.toLocalDir(g.dir))
          : model.addGuidePoint(ctx, this.host.toLocal(g.origin)),
      );
    } catch (e) {
      this.host.flash(errorMessage(e));
      return null;
    }
  }

  private commit(): void {
    const a = this.active!;
    this.active = null;
    if (a.mode !== "measure" && a.preview) {
      const g = a.preview;
      const id = this.place(g);
      if (id !== null) {
        const base = a.mode === "point" ? a.from.point : a.edge!.a;
        const d = sub(g.origin, base);
        this.last = {
          id,
          kind: g.kind,
          base,
          dir: len(d) > 1e-9 ? norm(d) : [0, 0, 0],
          along: g.kind === "line" ? g.dir : undefined,
          revision: this.host.model.revision,
        };
      }
      this.host.refresh();
    }
    this.host.inference.unlock();
    this.host.show({});
    this.host.hintChanged();
  }
}

/** A guide direction with its first non-zero component positive, so the same line
 *  reads the same way whichever way its edge ran. */
function canonical(d: Vec3): Vec3 {
  const k = d.findIndex((v) => Math.abs(v) > 1e-9);
  return k >= 0 && d[k] < 0 ? scale(d, -1) : d;
}

/** The three short segments of a guide point's x. */
function stub(o: Vec3, r: number): Vec3[] {
  return [
    [o[0] - r, o[1], o[2]], [o[0] + r, o[1], o[2]],
    [o[0], o[1] - r, o[2]], [o[0], o[1] + r, o[2]],
    [o[0], o[1], o[2] - r], [o[0], o[1], o[2] + r],
  ];
}
