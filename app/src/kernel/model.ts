// Typed wrapper around the WebAssembly kernel. Everything the UI does to the model
// goes through here, which keeps the kernel boundary in one place.

import init, { initSync, Kernel } from "./pkg/kernel.js";
import type { Mat4, Vec3 } from "../math";

export const ROOT = 0;

export type EntityKind = "face" | "edge" | "instance";
export interface Entity {
  kind: EntityKind;
  id: number;
}

export interface DefBuffers {
  positions: Float32Array;
  normals: Float32Array;
  faceIds: Uint32Array;
  edgePositions: Float32Array;
  edgeIds: Uint32Array;
}

export interface InstanceRecord {
  id: number;
  definition: number;
  transform: Mat4;
}

export interface FacePlane {
  normal: Vec3;
  d: number;
  owner: number;
  area: number;
}

export type AttrKind = "definition" | "instance" | "face";
export type AttrValue = string | number | boolean;
/** Namespace → key → scalar, as stored in the file. */
export type Attributes = Record<string, Record<string, AttrValue>>;
export interface TagInfo {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
}
export interface MaterialInfo {
  id: number;
  name: string;
  color: [number, number, number];
  opacity: number;
}
export interface InstanceProps {
  name: string;
  tag: number | null;
  material: number | null;
  /** On a locked tag, or inside or around locked geometry. */
  locked: boolean;
}

/** Load the kernel in a browser (fetches the .wasm next to the module). */
export async function loadKernel(): Promise<void> {
  await init();
}

/** Load the kernel from bytes, for Node tests. */
export function loadKernelSync(bytes: BufferSource): void {
  initSync({ module: bytes });
}

const u32 = (a: number[]) => Uint32Array.from(a);

export class Model {
  private k: Kernel;
  /** Bumped on every change so views know to rebuild. */
  revision = 0;
  /** Name passed to the last begin(); the label autosave uses. */
  lastOperation = "";
  /** Called after commit() returns true and after undo()/redo() return a name,
   *  never from abort(), so previews do not fire it. */
  onCommit?: (operation: string) => void;

  constructor(kernel?: Kernel) {
    this.k = kernel ?? new Kernel();
  }

  static fromJson(text: string): Model {
    return new Model(Kernel.fromJson(text));
  }

  toJson(): string {
    return this.k.toJson();
  }

  private changed<T>(v: T): T {
    this.revision++;
    return v;
  }

  // ---- history ----
  begin(name: string): void {
    this.lastOperation = name;
    this.k.begin(name);
  }
  commit(): boolean {
    const committed = this.changed(this.k.commit());
    if (committed) this.onCommit?.(this.lastOperation);
    return committed;
  }
  abort(): void {
    this.changed(this.k.abort());
  }
  undo(): string | undefined {
    const name = this.changed(this.k.undo());
    if (name !== undefined) this.onCommit?.(`Undo ${name}`);
    return name;
  }
  redo(): string | undefined {
    const name = this.changed(this.k.redo());
    if (name !== undefined) this.onCommit?.(`Redo ${name}`);
    return name;
  }
  canUndo(): boolean {
    return this.k.canUndo();
  }
  canRedo(): boolean {
    return this.k.canRedo();
  }

  /** Run `edit` in its own committed transaction; abort and rethrow on error. */
  transact<T>(name: string, edit: () => T): T {
    this.begin(name);
    try {
      const r = edit();
      this.commit();
      return r;
    } catch (e) {
      this.abort();
      throw e;
    }
  }

  // ---- edits (points in the definition's own coordinates) ----
  addLine(ctx: number, a: Vec3, b: Vec3): number[] {
    return this.changed(Array.from(this.k.addLine(ctx, a[0], a[1], a[2], b[0], b[1], b[2])));
  }
  /** Returns the face at the new position, or null if the push cut an opening. */
  pushPull(face: number, distance: number): number | null {
    const f = this.changed(this.k.pushPull(face, distance));
    return f < 0 ? null : f;
  }
  verticesOf(faces: number[], edges: number[]): number[] {
    return Array.from(this.k.verticesOf(u32(faces), u32(edges)));
  }
  moveVertices(verts: number[], d: Vec3): void {
    this.changed(this.k.moveVertices(u32(verts), d[0], d[1], d[2]));
  }
  /** Committed move: folds, moves, welds and settles. Preview uses moveVertices. */
  moveAndIntegrate(verts: number[], d: Vec3): void {
    this.changed(this.k.moveAndIntegrate(u32(verts), d[0], d[1], d[2]));
  }
  erase(faces: number[], edges: number[], instances: number[]): void {
    this.changed(this.k.erase(u32(faces), u32(edges), u32(instances)));
  }
  makeGroup(ctx: number, faces: number[], edges: number[], instances: number[]): number {
    return this.changed(this.k.makeGroup(ctx, u32(faces), u32(edges), u32(instances)));
  }
  explode(inst: number): { faces: number[]; edges: number[]; instances: number[] } {
    return this.changed(JSON.parse(this.k.explode(inst)));
  }
  setTransform(inst: number, m: Mat4): void {
    this.changed(this.k.setTransform(inst, Float64Array.from(m)));
  }
  /** Copy loose geometry of `ctx` by `d` (context coordinates); the copy welds to
   *  what it lands on. Returns the copy's faces and edges as they are after that. */
  copyGeometry(ctx: number, faces: number[], edges: number[], d: Vec3): { faces: number[]; edges: number[] } {
    return this.changed(JSON.parse(this.k.copyGeometry(ctx, u32(faces), u32(edges), d[0], d[1], d[2])));
  }
  /** Copy an instance as a new group placed `d` away (parent coordinates). */
  copyInstance(inst: number, d: Vec3): number {
    return this.changed(this.k.copyInstance(inst, d[0], d[1], d[2]));
  }

  // ---- attributes, tags, materials ----
  attributes(kind: AttrKind, id: number): Attributes {
    return JSON.parse(this.k.attributes(kind, id));
  }
  /** `null` deletes the attribute. */
  setAttribute(kind: AttrKind, id: number, ns: string, key: string, v: AttrValue | null): void {
    this.changed(this.k.setAttribute(kind, id, ns, key, JSON.stringify(v)));
  }
  tags(): TagInfo[] {
    return JSON.parse(this.k.tags());
  }
  newTag(name: string): number {
    return this.changed(this.k.newTag(name));
  }
  setInstanceTag(inst: number, tag: number | null): void {
    this.changed(this.k.setInstanceTag(inst, tag ?? -1));
  }
  setTagFlags(tag: number, visible: boolean, locked: boolean): void {
    this.changed(this.k.setTagFlags(tag, visible, locked));
  }
  instanceProps(inst: number): InstanceProps | null {
    return JSON.parse(this.k.instanceProps(inst));
  }
  materials(): MaterialInfo[] {
    return JSON.parse(this.k.materials());
  }
  /** Front material id per triangle of `buffers(def)`, -1 for none. */
  faceMaterials(def: number): Int32Array {
    return this.k.faceMaterials(def);
  }
  definitionName(def: number): string {
    return this.k.definitionName(def);
  }
  isLockedDef(def: number): boolean {
    return this.k.isLockedDef(def);
  }

  // ---- queries ----
  buffers(def: number): DefBuffers {
    const b = this.k.buffers(def);
    const out = {
      positions: b.positions,
      normals: b.normals,
      faceIds: b.faceIds,
      edgePositions: b.edgePositions,
      edgeIds: b.edgeIds,
    };
    b.free();
    return out;
  }
  definitions(): number[] {
    return Array.from(this.k.definitions());
  }
  instances(def: number): InstanceRecord[] {
    const flat = this.k.instances(def);
    const out: InstanceRecord[] = [];
    for (let i = 0; i < flat.length; i += 18) {
      out.push({ id: flat[i], definition: flat[i + 1], transform: Array.from(flat.subarray(i + 2, i + 18)) });
    }
    return out;
  }
  instanceInfo(inst: number): { definition: number; parent: number } | null {
    const r = this.k.instanceInfo(inst);
    return r.length ? { definition: r[0], parent: r[1] } : null;
  }
  worldTransform(def: number): Mat4 {
    return Array.from(this.k.worldTransform(def));
  }
  facePlane(face: number): FacePlane | null {
    const r = this.k.facePlane(face);
    if (!r.length) return null;
    return { normal: [r[0], r[1], r[2]], d: r[3], owner: r[4], area: r[5] };
  }
  faceEdges(face: number): number[] {
    return Array.from(this.k.faceEdges(face));
  }
  faceOuter(face: number): Vec3[] {
    const r = this.k.faceOuter(face);
    const out: Vec3[] = [];
    for (let i = 0; i < r.length; i += 3) out.push([r[i], r[i + 1], r[i + 2]]);
    return out;
  }
  edgeInfo(edge: number): { a: Vec3; b: Vec3; owner: number } | null {
    const r = this.k.edgeInfo(edge);
    return r.length ? { a: [r[0], r[1], r[2]], b: [r[3], r[4], r[5]], owner: r[6] } : null;
  }
  edgeFaces(edge: number): number[] {
    return Array.from(this.k.edgeFaces(edge));
  }
  exists(e: Entity): boolean {
    if (e.kind === "face") return this.k.facePlane(e.id).length > 0;
    if (e.kind === "edge") return this.k.edgeInfo(e.id).length > 0;
    return this.k.instanceInfo(e.id).length > 0;
  }
  stats(): { faces: number; edges: number; vertices: number; instances: number } {
    const [faces, edges, vertices, instances] = this.k.stats();
    return { faces, edges, vertices, instances };
  }
}
