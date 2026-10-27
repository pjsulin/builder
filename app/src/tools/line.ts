import type { Inference } from "../inference/engine";
import { dist, madd, norm, sub, type Vec3 } from "../math";
import { parseLength } from "../units";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

/**
 * Line: click a start point, then click each next point. Lines chain until a loop
 * closes into a face or Esc. Type a length to set the current segment, or retype
 * right after a click to change the last one.
 */
export class LineTool implements Tool {
  readonly id = "line";
  readonly cursor = "crosshair";
  private start: Vec3 | null = null;
  private current: Inference | null = null;
  private last: { start: Vec3; dir: Vec3 } | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return this.start
      ? "Click the next point, or type a length. Arrow keys lock an axis; Shift locks the current direction. Esc ends."
      : "Click to start a line. Lines that close a flat loop make a face.";
  }
  vcbLabel(): string {
    return "Length";
  }
  busy(): boolean {
    return this.start !== null;
  }

  deactivate(): void {
    this.start = null;
    this.current = null;
    this.host.inference.unlock();
    this.host.show({});
  }

  move(p: ToolPointer): void {
    const r = this.host.inference.infer(p.x, p.y, { anchor: this.start ?? undefined });
    this.current = r;
    if (!r) return this.host.show({});
    if (!this.start) {
      this.host.show({ inference: r });
      return;
    }
    const length = dist(this.start, r.point);
    this.host.setVcb(this.host.format(length));
    this.host.show({
      inference: r,
      segments: [this.start, r.point],
      dims: [{ pos: madd(this.start, sub(r.point, this.start), 0.5), text: this.host.format(length) }],
    });
  }

  down(): void {
    if (!this.current) return;
    if (!this.start) {
      this.start = this.current.point;
      this.host.hintChanged();
      return;
    }
    this.drawTo(this.current.point, this.current.kind === "endpoint" || this.current.kind === "origin");
  }

  up(_p: ToolPointer, dragged: boolean): void {
    if (dragged && this.start && this.current && dist(this.start, this.current.point) > 1e-3) {
      this.drawTo(this.current.point, true);
    }
  }

  key(key: string): boolean {
    if (key === "Escape" && this.start) {
      this.deactivate();
      this.host.hintChanged();
      return true;
    }
    return false;
  }

  vcb(text: string): void {
    const length = parseLength(text, this.host.units);
    if (!(length > 0)) return this.host.flash("Type a length like 8' or 30\"");
    if (this.start && this.current) {
      const dir = norm(sub(this.current.point, this.start));
      if (dist(this.current.point, this.start) < 1e-6) return this.host.flash("Move the cursor to pick a direction first");
      this.drawTo(madd(this.start, dir, length), false);
      return;
    }
    if (this.last) {
      // Retype: replace the last segment with one of the typed length.
      const { start, dir } = this.last;
      this.host.model.undo();
      this.start = start;
      this.drawTo(madd(start, dir, length), false);
      return;
    }
    this.host.flash("Start a line first");
  }

  private drawTo(end: Vec3, mayClose: boolean): void {
    const start = this.start!;
    if (dist(start, end) < 1e-3) return;
    const { model, ctx } = this.host;
    const before = model.stats().faces;
    try {
      model.transact("Line", () => model.addLine(ctx, this.host.toLocal(start), this.host.toLocal(end)));
    } catch (e) {
      this.host.flash(errorMessage(e));
      return;
    }
    this.last = { start, dir: norm(sub(end, start)) };
    this.host.refresh();
    const closed = mayClose && model.stats().faces > before;
    this.start = closed ? null : end;
    this.host.inference.unlock();
    this.host.hintChanged();
  }
}
