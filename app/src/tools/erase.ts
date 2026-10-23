import type { Entity } from "../kernel/model";
import { pickEntity } from "./pick";
import { errorMessage, type Tool, type ToolHost, type ToolPointer } from "./tool";

/**
 * Eraser: click an edge, face or group to erase it, or drag across several. Erasing
 * the edge between two flat faces merges them.
 */
export class EraseTool implements Tool {
  readonly id = "erase";
  readonly cursor = "crosshair";
  private pending: Entity[] | null = null;

  constructor(private host: ToolHost) {}

  hint(): string {
    return "Click an edge, face or group to erase it, or drag across several. Erasing a dividing edge merges faces.";
  }
  vcbLabel(): string {
    return "Measurements";
  }
  busy(): boolean {
    return this.pending !== null;
  }

  deactivate(): void {
    this.pending = null;
    this.host.show({});
  }

  private under(p: ToolPointer): Entity | null {
    const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
    return pick && !pick.outside ? pick.entity : null;
  }

  move(p: ToolPointer): void {
    const e = this.under(p);
    if (this.pending && e && !this.pending.some((x) => x.kind === e.kind && x.id === e.id)) this.pending.push(e);
    this.host.show({ hoverEntity: e });
  }

  down(p: ToolPointer): void {
    const e = this.under(p);
    this.pending = e ? [e] : [];
  }

  up(): void {
    const items = this.pending ?? [];
    this.pending = null;
    if (!items.length) return;
    const { model } = this.host;
    const ids = (k: Entity["kind"]) => items.filter((e) => e.kind === k).map((e) => e.id);
    try {
      model.transact("Erase", () => model.erase(ids("face"), ids("edge"), ids("instance")));
    } catch (e) {
      this.host.flash(errorMessage(e));
    }
    this.host.selection.prune(model);
    this.host.refresh();
    this.host.show({});
  }

  vcb(): void {
    this.host.flash("Pick a drawing tool to type a size");
  }
}
