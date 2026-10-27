// A headless ToolHost so tools can be driven in tests the way the app drives them.

import { InferenceEngine } from "../src/inference/engine";
import { ROOT, type Model } from "../src/kernel/model";
import { apply, applyDir, IDENTITY, invert, type Mat4, type Vec3 } from "../src/math";
import { Selection, type Overlay, type Tool, type ToolHost, type ToolPointer } from "../src/tools/tool";
import { formatLength } from "../src/units";
import { CameraModel } from "../src/view/camera";
import { SceneIndex } from "../src/view/scene";
import { newModel } from "./helpers";

export class TestHost implements ToolHost {
  model: Model;
  ctx = ROOT;
  camera = new CameraModel();
  selection = new Selection();
  inference: InferenceEngine;
  units = "imperial" as const;
  overlay: Overlay = {};
  vcbText = "";
  flashes: string[] = [];
  private pickScene: SceneIndex;
  private inverse: Mat4 = IDENTITY;

  constructor(model?: Model) {
    this.model = model ?? newModel();
    this.camera.target = [60, 48, 40];
    this.camera.dist = 700;
    this.pickScene = SceneIndex.build(this.model, ROOT);
    this.inference = new InferenceEngine(() => this.pickScene, this.camera);
  }

  scene(): SceneIndex {
    return this.pickScene;
  }
  toLocal(p: Vec3): Vec3 {
    return apply(this.inverse, p);
  }
  toLocalDir(d: Vec3): Vec3 {
    return applyDir(this.inverse, d);
  }
  refresh(opts: { preview?: boolean } = {}): void {
    if (!opts.preview) {
      this.pickScene = SceneIndex.build(this.model, this.ctx);
      this.selection.prune(this.model);
    }
  }
  show(o: Overlay): void {
    this.overlay = o;
  }
  setVcb(text: string): void {
    this.vcbText = text;
  }
  flash(m: string): void {
    this.flashes.push(m);
  }
  hintChanged(): void {}
  enterGroup(instance: number): void {
    this.ctx = this.model.instanceInfo(instance)!.definition;
    this.inverse = invert(this.model.worldTransform(this.ctx));
    this.refresh();
  }
  exitGroup(): void {
    this.ctx = ROOT;
    this.inverse = IDENTITY;
    this.refresh();
  }
  format = (inches: number) => formatLength(inches);

  // ---- driving tools ----

  at(p: Vec3): ToolPointer {
    const s = this.camera.project(p);
    if (!s) throw new Error(`point ${p} is behind the camera`);
    return { x: s.x, y: s.y, shift: false, ctrl: false, alt: false };
  }
  /** Hover then click at a world point. */
  click(tool: Tool, p: Vec3): void {
    const ptr = this.at(p);
    tool.move(ptr);
    tool.down(ptr);
    tool.up(ptr, false);
  }
  hover(tool: Tool, p: Vec3): void {
    tool.move(this.at(p));
  }
  /** Press, drag through points, release. */
  drag(tool: Tool, from: Vec3, to: Vec3): void {
    tool.move(this.at(from));
    tool.down(this.at(from));
    for (let i = 1; i <= 4; i++) {
      const p: Vec3 = [from[0] + ((to[0] - from[0]) * i) / 4, from[1] + ((to[1] - from[1]) * i) / 4, from[2] + ((to[2] - from[2]) * i) / 4];
      tool.move(this.at(p));
    }
    tool.up(this.at(to), true);
  }
}
