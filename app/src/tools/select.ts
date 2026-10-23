import type { Entity } from "../kernel/model";
import { boxSelect, pickEntity } from "./pick";
import type { Tool, ToolHost, ToolPointer } from "./tool";

/**
 * Select: click an edge, face or group. Shift toggles, Ctrl adds. Drag right for a
 * window selection, left for a crossing selection. Double-click a face to take its
 * edges too, or a group to edit inside it. Click outside an open group to close it.
 */
export class SelectTool implements Tool {
  readonly id = "select";
  readonly cursor = "default";
  private origin: { x: number; y: number } | null = null;
  private marquee: { x0: number; y0: number; x1: number; y1: number; crossing: boolean } | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return this.host.ctx
      ? "Editing a group. Click outside it or press Esc to close it."
      : "Click to select, Shift to toggle, drag for a box. Double-click a group to edit it. G groups the selection.";
  }
  vcbLabel(): string {
    return "Measurements";
  }
  busy(): boolean {
    return this.marquee !== null;
  }

  deactivate(): void {
    this.origin = null;
    this.marquee = null;
    this.host.show({});
  }

  move(p: ToolPointer): void {
    if (this.origin) {
      const crossing = p.x < this.origin.x;
      this.marquee = { x0: this.origin.x, y0: this.origin.y, x1: p.x, y1: p.y, crossing };
      this.host.show({ marquee: this.marquee });
      return;
    }
    const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
    this.host.show({ hoverEntity: pick && !pick.outside ? pick.entity : null });
  }

  down(p: ToolPointer): void {
    this.origin = { x: p.x, y: p.y };
  }

  up(p: ToolPointer, dragged: boolean): void {
    const origin = this.origin;
    this.origin = null;
    const { selection } = this.host;
    if (dragged && this.marquee) {
      const found = boxSelect(this.host.scene(), this.host.camera, this.marquee, this.marquee.crossing);
      this.marquee = null;
      if (p.shift || p.ctrl) selection.add(found);
      else selection.set(found);
      this.host.show({});
      return;
    }
    this.marquee = null;
    if (!origin) return;
    const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
    if (!pick || pick.outside) {
      if (this.host.ctx) this.host.exitGroup();
      else if (!p.shift && !p.ctrl) selection.clear();
      return;
    }
    if (p.shift) selection.toggle(pick.entity);
    else if (p.ctrl) selection.add([pick.entity]);
    else selection.set([pick.entity]);
  }

  doubleClick(p: ToolPointer): void {
    const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
    if (!pick || pick.outside) return;
    const { model, selection } = this.host;
    const e = pick.entity;
    if (e.kind === "instance") {
      this.host.enterGroup(e.id);
      return;
    }
    const more: Entity[] =
      e.kind === "face"
        ? model.faceEdges(e.id).map((id) => ({ kind: "edge", id }))
        : model.edgeFaces(e.id).map((id) => ({ kind: "face", id }));
    selection.set([e, ...more]);
  }

  key(key: string): boolean {
    if (key === "Escape") {
      if (this.marquee) {
        this.deactivate();
        return true;
      }
      if (!this.host.selection.empty) {
        this.host.selection.clear();
        return true;
      }
      if (this.host.ctx) {
        this.host.exitGroup();
        return true;
      }
    }
    return false;
  }

  vcb(): void {
    this.host.flash("Pick a drawing tool to type a size");
  }
}
