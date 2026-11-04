import { apply, cross, dist, dot, len, norm, planeFrom, rayPlane, scale, sub, type Plane, type Vec3 } from "../math";
import { parseLength } from "../units";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

type Target = { face: number } | { edges: number[] };

interface Offsetting {
  target: Target;
  /** World plane of the face or chain. */
  plane: Plane;
  /** For a face: the boundary edge nearest the first click, as a world line, and
   *  its inward normal in the plane. For a chain: the chain's first edge and
   *  `normal × dir` (left). */
  ref: { origin: Vec3; dir: Vec3; inward: Vec3 };
  /** The first click, measured along `ref.inward`. */
  startDist: number;
  /** Last distance the kernel accepted, in the tool's sign (positive = inward / left). */
  good: number;
  /** The last kernel error flashed, so a refused preview flashes once. */
  flashed: string | null;
}

/**
 * Offset: hover a face (or select a chain of edges first), click, move to set the
 * distance, click again, or type it. The distance is the cursor's travel toward
 * the inside of the face from the edge nearest the first click; for a chain, to
 * the cursor's side of it. A typed value follows the preview's direction and a
 * minus reverses it. An offset that would cross itself is refused.
 */
export class OffsetTool implements Tool {
  readonly id = "offset";
  readonly cursor = "crosshair";
  private active: Offsetting | null = null;
  private last: { target: Target; distance: number } | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return this.active
      ? "Move to set the distance and click, or type it. A minus goes the other way."
      : "Click a face to offset its outline, or select a chain of edges first and click. Then type a distance.";
  }
  vcbLabel(): string {
    return "Distance";
  }
  busy(): boolean {
    return this.active !== null;
  }

  deactivate(): void {
    if (this.active) {
      this.host.model.abort();
      this.active = null;
      this.host.refresh();
    }
    this.host.show({});
  }

  /** The selected edges, when the selection is edges only. */
  private selectedChain(): number[] | null {
    const { selection } = this.host;
    const edges = selection.ids("edge");
    return edges.length && !selection.ids("face").length && !selection.ids("instance").length ? edges : null;
  }

  private pickFace(p: ToolPointer) {
    const ray = this.host.camera.ray(p.x, p.y);
    const hit = this.host.scene().pick(ray, (it) => it.active && !it.locked);
    if (!hit) return null;
    return this.host.scene().items[hit.item].editable ? hit : null;
  }

  /** World endpoints of an edge of the active context. */
  private edgeEnds(edge: number): [Vec3, Vec3] | null {
    const info = this.host.model.edgeInfo(edge);
    if (!info) return null;
    const m = this.host.scene().items[this.host.scene().editableItem()].matrix;
    return [apply(m, info.a), apply(m, info.b)];
  }

  /**
   * The chain's points in the kernel's order: the path through the edges, run
   * the way the first listed edge goes. Null when the edges are not one path.
   */
  private chainPoints(edges: number[]): { points: Vec3[]; closed: boolean } | null {
    const key = (p: Vec3) => p.map((x) => Math.round(x * 1000)).join(",");
    const ends = new Map<number, [Vec3, Vec3]>();
    const at = new Map<string, number[]>();
    for (const e of edges) {
      const ab = this.edgeEnds(e);
      if (!ab) return null;
      ends.set(e, ab);
      for (const p of ab) at.set(key(p), [...(at.get(key(p)) ?? []), e]);
    }
    if ([...at.values()].some((l) => l.length > 2)) return null;
    const tips = [...at.entries()].filter(([, l]) => l.length === 1).map(([k]) => k);
    const closed = tips.length === 0;
    if (!closed && tips.length !== 2) return null;
    const [a0, b0] = ends.get(edges[0])!;
    const startKey = closed ? key(a0) : tips[0];
    const pointAt = (k: string, e: number): Vec3 => {
      const [a, b] = ends.get(e)!;
      return key(a) === k ? a : b;
    };
    const path: Vec3[] = [];
    const used = new Set<number>();
    let here = startKey;
    path.push(pointAt(here, at.get(here)![0]));
    for (;;) {
      const e = at.get(here)!.find((x) => !used.has(x));
      if (e === undefined) break;
      used.add(e);
      const [a, b] = ends.get(e)!;
      const next = key(a) === here ? b : a;
      here = key(next);
      if (closed && here === startKey) break;
      path.push(next);
    }
    if (used.size !== edges.length || (closed && path.length < 3)) return null;
    const i = path.findIndex((p) => key(p) === key(a0));
    const forward = path[i + 1] ?? (closed ? path[0] : undefined);
    if (!forward || key(forward) !== key(b0)) {
      path.reverse();
      if (closed) path.unshift(path.pop()!);
    }
    return { points: path, closed };
  }

  move(p: ToolPointer): void {
    if (!this.active) {
      const chain = this.selectedChain();
      if (chain) {
        const segments: Vec3[] = [];
        for (const e of chain) {
          const ab = this.edgeEnds(e);
          if (ab) segments.push(...ab);
        }
        this.host.show({ segments });
        return;
      }
      const hit = this.pickFace(p);
      this.host.show(hit ? { hover: { item: hit.item, face: hit.face } } : {});
      return;
    }
    const a = this.active;
    const r = this.host.inference.infer(p.x, p.y, { plane: a.plane });
    if (!r) return;
    const d = dot(sub(r.point, a.ref.origin), a.ref.inward) - a.startDist;
    this.apply(d);
    const text = this.host.format(Math.abs(this.active.good));
    this.host.setVcb(text);
    this.host.show({ inference: r.label ? r : null, dims: [{ pos: r.point, text }] });
  }

  /** Run the offset for the preview. The tool's sign is inward / left; the kernel's
   *  is outward / right. */
  private run(target: Target, d: number): void {
    const { model, ctx } = this.host;
    if ("face" in target) model.offsetFace(target.face, -d);
    else model.offsetEdges(ctx, target.edges, -d);
  }

  /** Re-run the preview at distance `d`, keeping the last good one on error and
   *  flashing each distinct kernel message once. */
  private apply(d: number): void {
    const a = this.active!;
    const { model } = this.host;
    model.abort();
    model.begin("Offset");
    try {
      if (Math.abs(d) > 1e-3) this.run(a.target, d);
      a.good = d;
    } catch (e) {
      model.abort();
      model.begin("Offset");
      if (Math.abs(a.good) > 1e-3) this.run(a.target, a.good);
      const message = errorMessage(e);
      if (message !== a.flashed) this.host.flash(message);
      a.flashed = message;
    }
    this.host.refresh({ preview: true });
  }

  down(p: ToolPointer): void {
    if (this.active) return this.commit();
    const { model, ctx } = this.host;
    const chain = this.selectedChain();
    if (chain) {
      if (model.isLockedDef(ctx)) return this.host.flash("that is on a locked tag");
      const path = this.chainPoints(chain);
      if (!path) return this.host.flash("Select edges that form one chain");
      const pts = path.points;
      let normal = newell(pts);
      if (!normal || pts.some((q) => Math.abs(dot(sub(q, pts[0]), normal!)) > 1e-3)) {
        // One edge or a straight chain: the plane of a face the first edge bounds.
        const f = model.edgeFaces(chain[0])[0];
        const scene = this.host.scene();
        normal = f === undefined ? null : scene.faceNormal(scene.editableItem(), f);
        if (!normal) return this.host.flash("Select edges that lie in one plane");
      }
      const plane = planeFrom(pts[0], normal);
      const dir = norm(sub(pts[1], pts[0]));
      const ref = { origin: pts[0], dir, inward: cross(plane.normal, dir) };
      const click = rayPlane(this.host.camera.ray(p.x, p.y), plane) ?? pts[0];
      this.begin({ edges: chain }, plane, ref, click);
      return;
    }
    const hit = this.pickFace(p);
    if (!hit) return;
    const plane = planeFrom(hit.point, hit.normal);
    // The boundary edge nearest the click sets the direction the distance is read along.
    let best: { origin: Vec3; dir: Vec3; d: number } | null = null;
    for (const e of model.faceEdges(hit.face)) {
      const ab = this.edgeEnds(e);
      if (!ab) continue;
      const [a, b] = ab;
      const u = sub(b, a);
      const l2 = dot(u, u);
      const t = l2 > 0 ? Math.min(1, Math.max(0, dot(sub(hit.point, a), u) / l2)) : 0;
      const d = dist(hit.point, [a[0] + u[0] * t, a[1] + u[1] * t, a[2] + u[2] * t]);
      if (!best || d < best.d) best = { origin: a, dir: norm(u), d };
    }
    if (!best) return;
    let inward = cross(plane.normal, best.dir);
    if (dot(sub(hit.point, best.origin), inward) < 0) inward = scale(inward, -1);
    this.begin({ face: hit.face }, plane, { origin: best.origin, dir: best.dir, inward }, hit.point);
  }

  private begin(target: Target, plane: Plane, ref: Offsetting["ref"], click: Vec3): void {
    const startDist = dot(sub(click, ref.origin), ref.inward);
    this.active = { target, plane, ref, startDist, good: 0, flashed: null };
    this.host.model.begin("Offset");
    this.host.hintChanged();
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.active && Math.abs(this.active.good) > 1e-3) this.commit();
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
    const d = parseLength(text, this.host.units);
    if (!Number.isFinite(d)) return this.host.flash("Type a distance like 8' or 30\"");
    // A typed distance goes the way the preview goes (inward, or left of a chain,
    // before any movement); a minus reverses it.
    if (this.active) {
      const want = (Math.sign(this.active.good) || 1) * d;
      this.apply(want);
      if (Math.abs(this.active.good - want) > 1e-6) return;
      this.commit();
      return;
    }
    if (this.last) {
      const { target, distance } = this.last;
      this.host.model.undo();
      try {
        this.host.model.transact("Offset", () => this.run(target, (Math.sign(distance) || 1) * d));
        this.last = { target, distance: (Math.sign(distance) || 1) * d };
      } catch (e) {
        // The new distance is refused; the offset as it was comes back.
        this.host.model.redo();
        this.host.flash(errorMessage(e));
      }
      this.host.refresh();
      return;
    }
    this.host.flash("Offset a face or a chain of edges first");
  }

  private commit(): void {
    const a = this.active!;
    this.active = null;
    if (Math.abs(a.good) < 1e-3) {
      this.host.model.abort();
    } else {
      this.host.model.commit();
      this.last = { target: a.target, distance: a.good };
    }
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}

/** Unit normal of a point loop by Newell's method (the kernel's `Plane::from_loop`),
 *  or null when the points have no area. */
function newell(pts: Vec3[]): Vec3 | null {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return len(n) > 1e-9 ? norm(n) : null;
}
