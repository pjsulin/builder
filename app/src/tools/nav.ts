import type { Tool, ToolHost, ToolPointer } from "./tool";

/** Orbit and Pan as tools for one-button mice and touch. */
export class NavTool implements Tool {
  readonly cursor = "grab";
  private lastPos: { x: number; y: number } | null = null;

  constructor(
    private host: ToolHost,
    readonly id: "orbit" | "pan",
    private onCamera: () => void,
  ) {}

  hint(): string {
    return this.id === "orbit" ? "Drag to orbit around the model." : "Drag to slide the view.";
  }
  vcbLabel(): string {
    return "Measurements";
  }
  busy(): boolean {
    return false;
  }
  deactivate(): void {
    this.lastPos = null;
  }
  move(p: ToolPointer): void {
    if (!this.lastPos) return;
    const dx = p.x - this.lastPos.x;
    const dy = p.y - this.lastPos.y;
    this.lastPos = { x: p.x, y: p.y };
    if (this.id === "orbit" && !p.shift) this.host.camera.orbit(dx, dy);
    else this.host.camera.pan(dx, dy);
    this.onCamera();
  }
  down(p: ToolPointer): void {
    this.lastPos = { x: p.x, y: p.y };
  }
  up(): void {
    this.lastPos = null;
  }
  vcb(): void {
    this.host.flash("Pick a drawing tool to type a size");
  }
}
