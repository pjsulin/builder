import { dot, madd, sub, type Vec3 } from "../math";
import { parseLength } from "../units";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

interface Active {
  face: number;
  item: number;
  normal: Vec3;
  start: Vec3;
  /** Last distance the kernel accepted. */
  good: number;
}

/**
 * Push/Pull: click any flat face, move to set the distance, click again. Hover a
 * point elsewhere to match its height, or type a distance. Double-click a face to
 * repeat the last distance. Pushing a face fully through a solid cuts an opening.
 */
export class PushPullTool implements Tool {
  readonly id = "pushpull";
  readonly cursor = "crosshair";
  private active: Active | null = null;
  private last: { face: number; distance: number } | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return this.active
      ? "Move to set the distance and click. Hover a corner elsewhere to match its height, or type a distance."
      : "Click a face, then move to push or pull it. Double-click a face to repeat the last distance.";
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

  private pickFace(p: ToolPointer) {
    const ray = this.host.camera.ray(p.x, p.y);
    const hit = this.host.scene().pick(ray, (it) => it.active);
    if (!hit) return null;
    return this.host.scene().items[hit.item].editable ? hit : null;
  }

  move(p: ToolPointer): void {
    if (!this.active) {
      const hit = this.pickFace(p);
      this.host.show(hit ? { hover: { item: hit.item, face: hit.face } } : {});
      return;
    }
    const a = this.active;
    const r = this.host.inference.infer(p.x, p.y, { line: { origin: a.start, dir: a.normal } });
    if (!r) return;
    const t = dot(sub(r.point, a.start), a.normal);
    this.apply(t);
    // Shown as a length; which way it goes is clear from the drag.
    const shown = this.active.good;
    const text = this.host.format(Math.abs(shown));
    this.host.setVcb(text);
    this.host.show({
      inference: r.label ? r : null,
      segments: [a.start, madd(a.start, a.normal, shown)],
      dims: [{ pos: madd(a.start, a.normal, shown / 2), text }],
    });
  }

  /** Re-run the push/pull preview at distance t, keeping the last good one on error. */
  private apply(t: number): void {
    const a = this.active!;
    const { model } = this.host;
    model.abort();
    model.begin("Push/Pull");
    try {
      if (Math.abs(t) > 1e-3) model.pushPull(a.face, t);
      a.good = t;
    } catch {
      model.abort();
      model.begin("Push/Pull");
      if (Math.abs(a.good) > 1e-3) model.pushPull(a.face, a.good);
    }
    this.host.refresh({ preview: true });
  }

  down(p: ToolPointer): void {
    if (this.active) return this.commit();
    const hit = this.pickFace(p);
    if (!hit) return;
    this.active = { face: hit.face, item: hit.item, normal: hit.normal, start: hit.point, good: 0 };
    this.host.model.begin("Push/Pull");
    this.host.hintChanged();
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.active && Math.abs(this.active.good) > 1e-3) this.commit();
  }

  doubleClick(p: ToolPointer): void {
    if (this.active || !this.last) return;
    const hit = this.pickFace(p);
    if (!hit) return;
    this.run(hit.face, this.last.distance);
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
    // A typed distance goes the way the face is being dragged; a minus reverses it.
    if (this.active) {
      const want = (Math.sign(this.active.good) || 1) * d;
      this.apply(want);
      if (Math.abs(this.active.good - want) > 1e-6) {
        this.host.flash("Can't push that far");
        return;
      }
      this.commit();
      return;
    }
    if (this.last) {
      this.host.model.undo();
      this.run(this.last.face, (Math.sign(this.last.distance) || 1) * d);
      return;
    }
    this.host.flash("Push or pull a face first");
  }

  private run(face: number, distance: number): void {
    try {
      this.host.model.transact("Push/Pull", () => this.host.model.pushPull(face, distance));
      this.last = { face, distance };
    } catch (e) {
      this.host.flash(errorMessage(e));
    }
    this.host.refresh();
  }

  private commit(): void {
    const a = this.active!;
    this.active = null;
    if (Math.abs(a.good) < 1e-3) {
      this.host.model.abort();
    } else {
      this.host.model.commit();
      this.last = { face: a.face, distance: a.good };
    }
    this.host.refresh();
    this.host.show({});
    this.host.hintChanged();
  }
}
