// The tool framework. Each tool is a small state machine driven by pointer, key and
// Measurements-box events. Tools talk to the app only through ToolHost, which keeps
// them free of DOM and Three.js code and lets tests drive them headlessly.

import type { Inference, InferenceEngine } from "../inference/engine";
import type { Entity, Model } from "../kernel/model";
import type { Vec3 } from "../math";
import type { UnitSystem } from "../units";
import type { CameraModel } from "../view/camera";
import type { SceneIndex } from "../view/scene";

export interface ToolPointer {
  /** Pixels from the viewport's top left. */
  x: number;
  y: number;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  /** The copy modifier is held (Option on Mac, Ctrl elsewhere). */
  copy: boolean;
}

/** What a tool wants drawn on top of the model. Plain data, rendered by the app. */
export interface Overlay {
  inference?: Inference | null;
  /** Preview line segments as pairs of points. */
  segments?: Vec3[];
  /** Preview polygon fill. */
  fill?: Vec3[];
  /** Face to highlight, by drawn item and face id. */
  hover?: { item: number; face: number } | null;
  /** An entity to highlight on hover (for select and erase). */
  hoverEntity?: Entity | null;
  /** Dimension labels. */
  dims?: { pos: Vec3; text: string }[];
  /** Selection rectangle in pixels; dashed when crossing. */
  marquee?: { x0: number; y0: number; x1: number; y1: number; crossing: boolean } | null;
}

export interface ToolHost {
  readonly model: Model;
  /** The definition being edited (0 is the model root). */
  readonly ctx: number;
  readonly camera: CameraModel;
  readonly inference: InferenceEngine;
  readonly selection: Selection;
  readonly units: UnitSystem;
  /** The scene used for picking and inference. Frozen during previews. */
  scene(): SceneIndex;
  /** World point → active context coordinates. */
  toLocal(p: Vec3): Vec3;
  /** World direction → active context direction. */
  toLocalDir(d: Vec3): Vec3;
  /**
   * The model changed. With `preview`, only the drawing updates and picking keeps
   * the scene from before the operation, so a moving shape never snaps to itself.
   */
  refresh(opts?: { preview?: boolean }): void;
  show(overlay: Overlay): void;
  setVcb(text: string): void;
  flash(message: string): void;
  /** The tool's step changed; update hint text. */
  hintChanged(): void;
  enterGroup(instance: number): void;
  exitGroup(): void;
  format(inches: number): string;
}

export interface Tool {
  readonly id: string;
  readonly cursor: string;
  hint(): string;
  vcbLabel(): string;
  /** True while an operation is in progress (Esc cancels it). */
  busy(): boolean;
  activate?(): void;
  /** Cancel anything in progress and abort its preview. */
  deactivate(): void;
  move(p: ToolPointer): void;
  down(p: ToolPointer): void;
  /** `dragged` is true when the pointer moved since `down` (click-drag-release). */
  up(p: ToolPointer, dragged: boolean): void;
  doubleClick?(p: ToolPointer): void;
  /** Return true if the key was handled. */
  key?(key: string, shift: boolean): boolean;
  /** A value typed into the Measurements box. */
  vcb(text: string): void;
  /** The copy modifier went down or up while the tool is active (keyboard, no pointer). */
  modifier?(copy: boolean): void;
}

/** The current selection, in the active context. */
export class Selection {
  items: Entity[] = [];
  onChange: (() => void) | null = null;

  private changed(): void {
    this.onChange?.();
  }
  has(e: Entity): boolean {
    return this.items.some((x) => x.kind === e.kind && x.id === e.id);
  }
  set(items: Entity[]): void {
    this.items = dedupe(items);
    this.changed();
  }
  add(items: Entity[]): void {
    this.items = dedupe([...this.items, ...items]);
    this.changed();
  }
  toggle(e: Entity): void {
    this.items = this.has(e) ? this.items.filter((x) => !(x.kind === e.kind && x.id === e.id)) : [...this.items, e];
    this.changed();
  }
  clear(): void {
    if (!this.items.length) return;
    this.items = [];
    this.changed();
  }
  get empty(): boolean {
    return this.items.length === 0;
  }
  ids(kind: Entity["kind"]): number[] {
    return this.items.filter((x) => x.kind === kind).map((x) => x.id);
  }
  /** Drop entities that no longer exist (after undo or erase). */
  prune(model: Model): void {
    const kept = this.items.filter((e) => model.exists(e));
    if (kept.length !== this.items.length) {
      this.items = kept;
      this.changed();
    }
  }
}

function dedupe(items: Entity[]): Entity[] {
  const seen = new Set<string>();
  return items.filter((e) => {
    const k = `${e.kind}:${e.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.charAt(0).toUpperCase() + m.slice(1);
}
