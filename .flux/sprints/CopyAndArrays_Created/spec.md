# Specification: CopyAndArrays

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

`flux repomap kernel/src/edit.rs kernel/src/group.rs kernel/src/doc.rs kernel-wasm/src/lib.rs app/src/kernel/model.ts app/src/tools/move.ts app/src/tools/tool.ts app/src/tools/pushpull.ts app/src/units.ts app/src/app.ts`

```
app/src/app.ts:
# The application shell: owns the model, the active editing context, selection,
⋮
│export class App implements ToolHost {
│  model = new Model();
│  ctx = ROOT;
│  readonly camera = new CameraModel();
│  readonly selection = new Selection();
│  readonly inference: InferenceEngine;
│  units: UnitSystem = "imperial";
│  /** The tag new groups land on (Proposed in a survey model). */
│  activeTag: number | null = null;
│
⋮
│  constructor() {
│    this.view = new Viewport($("view"));
│    this.inference = new InferenceEngine(() => this.pickScene, this.camera);
│    const nav = () => this.cameraChanged();
│    this.tools = {
│      select: new SelectTool(this),
│      line: new LineTool(this),
│      rectangle: new RectangleTool(this),
│      pushpull: new PushPullTool(this),
│      move: new MoveTool(this),
⋮
│  scene(): SceneIndex {
│    return this.pickScene;
│  }
│  toLocal(p: Vec3): Vec3 {
│    return apply(this.ctxInverse, p);
│  }
│  toLocalDir(d: Vec3): Vec3 {
│    return applyDir(this.ctxInverse, d);
⋮
│  refresh(opts: { preview?: boolean } = {}): void {
│    this.drawScene = SceneIndex.build(this.model, this.ctx);
│    if (!opts.preview) {
│      this.pickScene = this.drawScene;
│      this.selection.prune(this.model);
│      this.updateButtons();
│      this.survey.update();
│    }
│    this.view.setScene(this.drawScene);
│    this.drawSelection();
⋮
│  show(overlay: Overlay): void {
│    this.overlay = overlay;
│    this.drawOverlay();
⋮
│  setVcb(text: string): void {
│    if (!this.vcbTyping) $<HTMLInputElement>("vcb").value = text;
⋮
│  flash(message: string): void {
│    const t = $("toast");
│    const hover = this.overlay.hoverEntity ? [this.overlay.hoverEntity] : [];
│    t.textContent = lockedMessage(this.drawScene, this.model, [...this.selection.items, ...hover], 
│    t.classList.add("show");
│    clearTimeout(this.toastTimer);
│    this.toastTimer = window.setTimeout(() => t.classList.remove("show"), 1800);
⋮
│  hintChanged(): void {
│    $("hint").textContent = this.tool.hint();
│    $("vcbLabel").textContent = this.tool.vcbLabel();
⋮
│  enterGroup(instance: number): void {
│    const info = this.model.instanceInfo(instance);
│    if (!info) return;
│    if (this.model.instanceProps(instance)?.locked) {
│      this.selection.set([{ kind: "instance", id: instance }]);
│      return this.flash("that is on a locked tag");
│    }
│    this.setContext(info.definition);
⋮
│  exitGroup(): void {
│    if (this.ctx === ROOT) return;
│    const path = this.pickScene.activePath;
│    const inst = path[path.length - 1];
│    const parent = inst === undefined ? ROOT : (this.model.instanceInfo(inst)?.parent ?? ROOT);
│    this.setContext(parent);
│    if (inst !== undefined) this.selection.set([{ kind: "instance", id: inst }]);
⋮
│  private setContext(def: number): void {
│    this.tool.deactivate();
│    this.ctx = def;
│    this.ctxMatrix = def === ROOT ? IDENTITY : this.model.worldTransform(def);
│    this.ctxInverse = invert(this.ctxMatrix);
│    this.selection.clear();
│    this.refresh();
│    const crumb = $("context");
│    crumb.hidden = def === ROOT;
│    crumb.textContent = "Editing group · Esc to close";
⋮
│  setTool(id: string): void {
│    const next = this.tools[id];
│    if (!next) return;
│    this.tool?.deactivate();
│    this.inference.unlock();
│    this.tool = next;
│    next.activate?.();
│    document.querySelectorAll<HTMLButtonElement>(".tool").forEach((b) => b.setAttribute("aria-press
│    this.view.canvas.style.cursor = next.cursor;
│    this.overlay = {};
⋮
│  loadModel(model: Model, name: string): void {
│    this.tool?.deactivate();
│    this.model = model;
│    this.fileName = name;
│    this.ctx = ROOT;
│    this.ctxMatrix = IDENTITY;
│    this.ctxInverse = IDENTITY;
│    $("context").hidden = true;
│    this.selection.clear();
│    const tags = surveyTags(model);
⋮
│  private undo(redo = false): void {
│    this.tool.deactivate();
│    const name = redo ? this.model.redo() : this.model.undo();
│    if (name) this.flash(`${redo ? "Redo" : "Undo"} ${name}`);
│    if (this.ctx !== ROOT && !this.model.definitions().includes(this.ctx)) this.setContext(ROOT);
│    else this.refresh();
│    this.hintChanged();
⋮
│  private eraseSelection(): void {
│    if (this.selection.empty) return;
│    const s = this.selection;
│    try {
│      this.model.transact("Erase", () => this.model.erase(s.ids("face"), s.ids("edge"), s.ids("inst
│    } catch (e) {
│      this.flash(errorMessage(e));
│    }
│    this.selection.clear();
│    this.refresh();
⋮
│  private makeGroup(): void {
│    const s = this.selection;
│    if (s.empty) return this.flash("Select something to group first");
│    try {
│      const g = groupSelection(this.model, this.ctx, s, this.ctx === ROOT ? this.activeTag : null);
│      this.refresh();
│      this.selection.set([{ kind: "instance", id: g }]);
│      const tag = this.activeTag !== null && this.ctx === ROOT ? this.model.tags().find((t) => t.id
│      this.flash(tag ? `Grouped on ${tag.name}` : "Grouped");
│    } catch (e) {
⋮
│  private explode(): void {
│    const insts = this.selection.ids("instance");
│    if (!insts.length) return this.flash("Select a group to explode");
│    const out: Entity[] = [];
│    try {
│      this.model.transact("Explode", () => {
│        for (const i of insts) {
│          const r = this.model.explode(i);
│          out.push(...r.faces.map((id) => ({ kind: "face" as const, id })), ...r.edges.map((id) => 
│          out.push(...r.instances.map((id) => ({ kind: "instance" as const, id })));
⋮
│  private exportPlan(): void {
│    const name = prompt("Plan name (model/plans/NAME.yaml)", "proposed");
│    if (!name) return;
│    const { yaml, skipped } = exportProposed(this.model, name);
│    const blob = new Blob([yaml], { type: "application/yaml" });
│    const a = document.createElement("a");
│    a.href = URL.createObjectURL(blob);
│    a.download = `${name}.yaml`;
│    a.click();
│    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
⋮
│  private selectAll(): void {
│    const s = this.pickScene;
│    const out: Entity[] = [];
│    s.items.forEach((it, i) => {
│      if (it.editable) {
│        const b = s.buffers.get(it.def)!;
│        new Set(b.faceIds).forEach((id) => out.push({ kind: "face", id }));
│        b.edgeIds.forEach((id) => out.push({ kind: "edge", id }));
│      } else if (it.pickInstance !== null && s.items.findIndex((x) => x.pickInstance === it.pickIns
│        out.push({ kind: "instance", id: it.pickInstance });
⋮
│  private save(): void {
│    const blob = new Blob([this.model.toJson()], { type: "application/json" });
│    const a = document.createElement("a");
│    a.href = URL.createObjectURL(blob);
│    a.download = this.fileName;
│    a.click();
│    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
│    this.savedRevision = this.model.revision;
│    this.flash(`Saved ${this.fileName}`);
⋮
│  private async open(file: File): Promise<void> {
│    try {
│      const model = Model.fromJson(await file.text());
│      this.loadModel(model, file.name);
│      this.flash(`Opened ${file.name}`);
│    } catch (e) {
│      this.flash(errorMessage(e));
│    }
⋮
│  private confirmDiscard(): boolean {
│    return this.model.revision === this.savedRevision || confirm("Discard unsaved changes to this m
⋮
│  private zoomExtents(): void {
│    const s = this.drawScene;
│    if (s.empty) {
│      this.camera.target = [0, 0, 0];
│      this.camera.dist = 600;
│    } else this.camera.fit(s.min, s.max);
│    this.cameraChanged();
⋮
│  private cameraChanged(): void {
│    this.view.syncCamera(this.camera);
│    this.positionLabels();
⋮
│  private resize(): void {
│    const r = $("view").getBoundingClientRect();
│    this.camera.width = Math.max(1, r.width);
│    this.camera.height = Math.max(1, r.height);
│    this.view.resize();
│    this.cameraChanged();
⋮
│  private readTheme(): void {
│    const cs = getComputedStyle(document.documentElement);
│    const g = (k: string) => cs.getPropertyValue(k).trim();
│    this.view.setTheme({
│      face: g("--face"),
│      back: g("--back"),
│      edge: g("--edge"),
│      sel: g("--sel"),
│      hover: g("--hover"),
│      axes: [g("--ax-x"), g("--ax-y"), g("--ax-z")],
⋮
│  private entityGeometry(e: Entity): { tris: number[]; segs: number[] } {
│    const s = this.drawScene;
│    const tris: number[] = [];
│    const segs: number[] = [];
│    if (e.kind === "face") {
│      tris.push(...s.faceTriangles(s.editableItem(), e.id));
│    } else if (e.kind === "edge") {
│      for (let i = 0; i < s.segEdge.length; i++) {
│        if (s.segEdge[i] === e.id && s.items[s.segItem[i]].editable) for (let k = 0; k < 6; k++) se
│      }
⋮
│  private drawSelection(): void {
│    const tris: number[] = [];
│    const segs: number[] = [];
│    for (const e of this.selection.items) {
│      const g = this.entityGeometry(e);
│      tris.push(...g.tris);
│      segs.push(...g.segs);
│    }
│    this.view.setTriangles("selection", tris, "select");
│    this.view.setSegments("selectionEdges", segs, "selectEdge");
⋮
│  private drawOverlay(): void {
│    const o = this.overlay;
│    const v = this.view;
│    if (o.hover) v.setTriangles("hover", this.drawScene.faceTriangles(o.hover.item, o.hover.face), 
│    else if (o.hoverEntity) {
│      const g = this.entityGeometry(o.hoverEntity);
│      v.setTriangles("hover", g.tris, "hover");
│      v.setSegments("hoverEdges", g.segs, "box");
│    } else v.clearLayer("hover");
│    if (!o.hoverEntity) v.clearLayer("hoverEdges");
⋮
│  private drawGuide(r: Inference | null): void {
│    // A dotted line from a matched point to where it was projected.
│    if (r?.ref) this.view.setGuide("refGuide", r.ref.point, r.point, this.previewColor);
│    else this.view.clearLayer("refGuide");
│    if (r && r.from && (r.kind === "axis" || r.kind === "line")) {
│      const color = r.axis !== undefined ? this.axisColors[r.axis] : this.previewColor;
│      const dir = r.axis !== undefined ? AXES[r.axis] : null;
│      if (dir) {
│        const far = this.camera.dist * 4;
│        this.view.setGuide("guide", add(r.from, scale(dir, -far)), add(r.from, scale(dir, far)), co
⋮
│  private positionLabels(): void {
│    const o = this.overlay;
│    const place = (el: HTMLElement, p: Vec3 | undefined, dx = 0, dy = 0, center = false) => {
│      const s = p && this.camera.project(p);
│      if (!s) {
│        el.hidden = true;
│        return;
│      }
│      el.hidden = false;
│      el.style.transform = `translate(${s.x + dx}px, ${s.y + dy}px)${center ? " translate(-50%, -50
⋮
│  private frameStats(ms: number): void {
│    this.frameAvg = this.frameAvg ? this.frameAvg * 0.8 + ms * 0.2 : ms;
│    const st = this.model.stats();
│    $("perf").textContent = `${this.frameAvg.toFixed(1)} ms draw · ${st.faces.toLocaleString()} fac
⋮
│  private updateButtons(): void {
│    $<HTMLButtonElement>("undoBtn").disabled = !this.model.canUndo();
│    $<HTMLButtonElement>("redoBtn").disabled = !this.model.canRedo();
│    $<HTMLButtonElement>("groupBtn").disabled = this.selection.empty;
│    $<HTMLButtonElement>("explodeBtn").disabled = !this.selection.ids("instance").length;
⋮
│  private pointer(ev: PointerEvent | MouseEvent | WheelEvent): ToolPointer {
│    const r = this.view.canvas.getBoundingClientRect();
│    return { x: ev.clientX - r.left, y: ev.clientY - r.top, shift: ev.shiftKey, ctrl: ev.ctrlKey ||
⋮
│  private bindUi(): void {
│    const canvas = this.view.canvas;
│    let drag: { mode: "tool" | "orbit" | "pan"; x: number; y: number; moved: boolean } | null = nul
│
│    canvas.addEventListener("pointerdown", (ev) => {
│      canvas.setPointerCapture(ev.pointerId);
│      if (document.activeElement === $("vcb")) $("vcb").blur();
│      const p = this.pointer(ev);
│      if (ev.button === 1 || ev.button === 2) {
│        drag = { mode: ev.shiftKey ? "pan" : "orbit", x: p.x, y: p.y, moved: false };
⋮
│  private keydown(ev: KeyboardEvent): void {
│    const vcb = $<HTMLInputElement>("vcb");
│    if (document.activeElement === vcb) {
│      if (ev.key === "Enter") {
│        ev.preventDefault();
│        const text = vcb.value;
│        this.vcbTyping = false;
│        vcb.blur();
│        this.tool.vcb(text);
│        this.hintChanged();
⋮
│function boxSegments(min: Vec3, max: Vec3): number[] {
│  const c = (i: number): Vec3 => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] 
│  const pairs = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2
│  return pairs.flatMap(([a, b]) => [...c(a), ...c(b)]);
⋮

app/src/kernel/model.ts:
# Typed wrapper around the WebAssembly kernel. Everything the UI does to the model
⋮
│export type EntityKind = "face" | "edge" | "instance";
│export interface Entity {
│  kind: EntityKind;
│  id: number;
⋮
│export interface DefBuffers {
│  positions: Float32Array;
│  normals: Float32Array;
│  faceIds: Uint32Array;
│  edgePositions: Float32Array;
│  edgeIds: Uint32Array;
⋮
│export interface InstanceRecord {
│  id: number;
│  definition: number;
│  transform: Mat4;
⋮
│export interface FacePlane {
│  normal: Vec3;
│  d: number;
│  owner: number;
│  area: number;
⋮
│export type AttrKind = "definition" | "instance" | "face";
│export type AttrValue = string | number | boolean;
│/** Namespace → key → scalar, as stored in the file. */
│export type Attributes = Record<string, Record<string, AttrValue>>;
│export interface TagInfo {
│  id: number;
│  name: string;
│  visible: boolean;
│  locked: boolean;
│}
│export interface MaterialInfo {
│  id: number;
│  name: string;
│  color: [number, number, number];
│  opacity: number;
│}
│export interface InstanceProps {
│  name: string;
│  tag: number | null;
│  material: number | null;
│  /** On a locked tag, or inside or around locked geometry. */
│  locked: boolean;
⋮
│export async function loadKernel(): Promise<void> {
│  await init();
⋮
│export function loadKernelSync(bytes: BufferSource): void {
│  initSync({ module: bytes });
⋮
│export class Model {
│  private k: Kernel;
│  /** Bumped on every change so views know to rebuild. */
│  revision = 0;
│
│  constructor(kernel?: Kernel) {
│    this.k = kernel ?? new Kernel();
│  }
│
│  static fromJson(text: string): Model {
│    return new Model(Kernel.fromJson(text));
⋮
│  toJson(): string {
│    return this.k.toJson();
⋮
│  private changed<T>(v: T): T {
│    this.revision++;
│    return v;
⋮
│  begin(name: string): void {
│    this.k.begin(name);
│  }
│  commit(): boolean {
│    return this.changed(this.k.commit());
│  }
│  abort(): void {
│    this.changed(this.k.abort());
│  }
│  undo(): string | undefined {
│    return this.changed(this.k.undo());
│  }
│  redo(): string | undefined {
│    return this.changed(this.k.redo());
│  }
│  canUndo(): boolean {
│    return this.k.canUndo();
│  }
│  canRedo(): boolean {
│    return this.k.canRedo();
⋮
│  transact<T>(name: string, edit: () => T): T {
│    this.begin(name);
│    try {
│      const r = edit();
│      this.commit();
│      return r;
│    } catch (e) {
│      this.abort();
│      throw e;
│    }
⋮
│  addLine(ctx: number, a: Vec3, b: Vec3): number[] {
│    return this.changed(Array.from(this.k.addLine(ctx, a[0], a[1], a[2], b[0], b[1], b[2])));
⋮
│  pushPull(face: number, distance: number): number | null {
│    const f = this.changed(this.k.pushPull(face, distance));
│    return f < 0 ? null : f;
│  }
│  verticesOf(faces: number[], edges: number[]): number[] {
│    return Array.from(this.k.verticesOf(u32(faces), u32(edges)));
│  }
│  moveVertices(verts: number[], d: Vec3): void {
│    this.changed(this.k.moveVertices(u32(verts), d[0], d[1], d[2]));
│  }
│  erase(faces: number[], edges: number[], instances: number[]): void {
│    this.changed(this.k.erase(u32(faces), u32(edges), u32(instances)));
│  }
│  makeGroup(ctx: number, faces: number[], edges: number[], instances: number[]): number {
│    return this.changed(this.k.makeGroup(ctx, u32(faces), u32(edges), u32(instances)));
│  }
│  explode(inst: number): { faces: number[]; edges: number[]; instances: number[] } {
│    return this.changed(JSON.parse(this.k.explode(inst)));
│  }
│  setTransform(inst: number, m: Mat4): void {
│    this.changed(this.k.setTransform(inst, Float64Array.from(m)));
⋮
│  attributes(kind: AttrKind, id: number): Attributes {
│    return JSON.parse(this.k.attributes(kind, id));
⋮
│  setAttribute(kind: AttrKind, id: number, ns: string, key: string, v: AttrValue | null): void {
│    this.changed(this.k.setAttribute(kind, id, ns, key, JSON.stringify(v)));
│  }
│  tags(): TagInfo[] {
│    return JSON.parse(this.k.tags());
│  }
│  newTag(name: string): number {
│    return this.changed(this.k.newTag(name));
│  }
│  setInstanceTag(inst: number, tag: number | null): void {
│    this.changed(this.k.setInstanceTag(inst, tag ?? -1));
│  }
│  setTagFlags(tag: number, visible: boolean, locked: boolean): void {
│    this.changed(this.k.setTagFlags(tag, visible, locked));
│  }
│  instanceProps(inst: number): InstanceProps | null {
│    return JSON.parse(this.k.instanceProps(inst));
│  }
│  materials(): MaterialInfo[] {
│    return JSON.parse(this.k.materials());
⋮
│  faceMaterials(def: number): Int32Array {
│    return this.k.faceMaterials(def);
│  }
│  definitionName(def: number): string {
│    return this.k.definitionName(def);
│  }
│  isLockedDef(def: number): boolean {
│    return this.k.isLockedDef(def);
⋮
│  buffers(def: number): DefBuffers {
│    const b = this.k.buffers(def);
│    const out = {
│      positions: b.positions,
│      normals: b.normals,
│      faceIds: b.faceIds,
│      edgePositions: b.edgePositions,
│      edgeIds: b.edgeIds,
│    };
│    b.free();
⋮
│  definitions(): number[] {
│    return Array.from(this.k.definitions());
│  }
│  instances(def: number): InstanceRecord[] {
│    const flat = this.k.instances(def);
│    const out: InstanceRecord[] = [];
│    for (let i = 0; i < flat.length; i += 18) {
│      out.push({ id: flat[i], definition: flat[i + 1], transform: Array.from(flat.subarray(i + 2, i
│    }
│    return out;
│  }
│  instanceInfo(inst: number): { definition: number; parent: number } | null {
│    const r = this.k.instanceInfo(inst);
│    return r.length ? { definition: r[0], parent: r[1] } : null;
│  }
│  worldTransform(def: number): Mat4 {
│    return Array.from(this.k.worldTransform(def));
│  }
│  facePlane(face: number): FacePlane | null {
│    const r = this.k.facePlane(face);
│    if (!r.length) return null;
│    return { normal: [r[0], r[1], r[2]], d: r[3], owner: r[4], area: r[5] };
│  }
│  faceEdges(face: number): number[] {
│    return Array.from(this.k.faceEdges(face));
│  }
│  faceOuter(face: number): Vec3[] {
│    const r = this.k.faceOuter(face);
│    const out: Vec3[] = [];
│    for (let i = 0; i < r.length; i += 3) out.push([r[i], r[i + 1], r[i + 2]]);
│    return out;
│  }
│  edgeInfo(edge: number): { a: Vec3; b: Vec3; owner: number } | null {
│    const r = this.k.edgeInfo(edge);
│    return r.length ? { a: [r[0], r[1], r[2]], b: [r[3], r[4], r[5]], owner: r[6] } : null;
│  }
│  edgeFaces(edge: number): number[] {
│    return Array.from(this.k.edgeFaces(edge));
│  }
│  exists(e: Entity): boolean {
│    if (e.kind === "face") return this.k.facePlane(e.id).length > 0;
│    if (e.kind === "edge") return this.k.edgeInfo(e.id).length > 0;
│    return this.k.instanceInfo(e.id).length > 0;
│  }
│  stats(): { faces: number; edges: number; vertices: number; instances: number } {
│    const [faces, edges, vertices, instances] = this.k.stats();
│    return { faces, edges, vertices, instances };
⋮

app/src/tools/move.ts:
⋮
│interface Moving {
│  base: Vec3;
│  verts: number[];
│  instances: { id: number; transform: Mat4 }[];
│  /** Last offset the kernel accepted. */
│  good: Vec3;
⋮
│export class MoveTool implements Tool {
│  readonly id = "move";
│  readonly cursor = "move";
│  private moving: Moving | null = null;
│  private current: Inference | null = null;
│  private last: { base: Vec3; dir: Vec3; selection: { faces: number[]; edges: number[]; instances: 
│
│  constructor(private host: ToolHost) {}
│
│  hint(): string {
│    return this.moving
│      ? "Click to place, or type a distance. Arrow keys lock an axis."
│      : "Click a point on the selection (or on what you hover) to pick it up.";
│  }
│  vcbLabel(): string {
│    return "Distance";
│  }
│  busy(): boolean {
│    return this.moving !== null;
⋮
│  deactivate(): void {
│    if (this.moving) {
│      this.host.model.abort();
│      this.moving = null;
│      this.host.refresh();
│    }
│    this.host.inference.unlock();
│    this.host.show({});
⋮
│  move(p: ToolPointer): void {
│    const r = this.host.inference.infer(p.x, p.y, { anchor: this.moving?.base });
│    this.current = r;
│    if (!this.moving) {
│      const pick = this.host.selection.empty ? pickEntity(this.host.scene(), this.host.camera, p.x,
│      this.host.show({ inference: r, hoverEntity: pick && !pick.outside && !pick.locked ? pick.enti
│      return;
│    }
│    if (!r) return;
│    const m = this.moving;
⋮
│  private apply(offset: Vec3): void {
│    const m = this.moving!;
│    const { model } = this.host;
│    const run = (o: Vec3) => {
│      const local = this.host.toLocalDir(o);
│      if (m.verts.length) model.moveVertices(m.verts, local);
│      for (const inst of m.instances) model.setTransform(inst.id, mul(translation(local), inst.tran
│    };
│    model.abort();
│    model.begin("Move");
⋮
│  down(p: ToolPointer): void {
│    if (this.moving) return this.commit();
│    const { selection, model } = this.host;
│    if (selection.empty) {
│      const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
│      if (!pick || pick.outside || pick.locked) return;
│      selection.set([pick.entity]);
│    }
│    if (!this.current) return;
│    // Locked geometry is refused before anything is previewed.
⋮
│  private start(base: Vec3, faces: number[], edges: number[], instances: number[]): void {
│    const { model, ctx } = this.host;
│    const verts = model.verticesOf(faces, edges);
│    const all = model.instances(ctx);
│    const insts = instances.map((id) => ({ id, transform: all.find((i) => i.id === id)?.transform ?
│    if (!verts.length && !insts.length) return;
│    this.moving = { base, verts, instances: insts, good: [0, 0, 0] };
│    this.last = { base, dir: [0, 0, 0], selection: { faces, edges, instances } };
│    this.host.hintChanged();
⋮
│  up(_p: ToolPointer, dragged: boolean): void {
│    if (dragged && this.moving && dist([0, 0, 0], this.moving.good) > 1e-3) this.commit();
⋮
│  key(key: string): boolean {
│    if (key === "Escape" && this.moving) {
│      this.deactivate();
│      this.host.hintChanged();
│      return true;
│    }
│    return false;
⋮
│  vcb(text: string): void {
│    const d = parseLength(text, this.host.units);
│    if (!Number.isFinite(d)) return this.host.flash("Type a distance like 8' or 30\"");
│    if (this.moving) {
│      const dir = norm(this.moving.good);
│      if (dist([0, 0, 0], dir) < 0.5) return this.host.flash("Move the cursor to pick a direction f
│      this.apply(madd([0, 0, 0], dir, d));
│      this.commit();
│      return;
│    }
⋮
│  private commit(): void {
│    const m = this.moving!;
│    this.moving = null;
│    const { model } = this.host;
│    if (dist([0, 0, 0], m.good) < 1e-3) {
│      model.abort();
│    } else {
│      try {
│        model.commit();
│      } catch (e) {
⋮

app/src/tools/pushpull.ts:
⋮
│interface Active {
│  face: number;
│  item: number;
│  normal: Vec3;
│  start: Vec3;
│  /** Last distance the kernel accepted. */
│  good: number;
⋮
│export class PushPullTool implements Tool {
│  readonly id = "pushpull";
│  readonly cursor = "crosshair";
│  private active: Active | null = null;
│  private last: { face: number; distance: number } | null = null;
│
│  constructor(private host: ToolHost) {}
│
│  hint(): string {
│    return this.active
│      ? "Move to set the distance and click. Hover a corner elsewhere to match its height, or type 
│      : "Click a face, then move to push or pull it. Double-click a face to repeat the last distanc
│  }
│  vcbLabel(): string {
│    return "Distance";
│  }
│  busy(): boolean {
│    return this.active !== null;
⋮
│  deactivate(): void {
│    if (this.active) {
│      this.host.model.abort();
│      this.active = null;
│      this.host.refresh();
│    }
│    this.host.show({});
⋮
│  private pickFace(p: ToolPointer) {
│    const ray = this.host.camera.ray(p.x, p.y);
│    const hit = this.host.scene().pick(ray, (it) => it.active && !it.locked);
│    if (!hit) return null;
│    return this.host.scene().items[hit.item].editable ? hit : null;
⋮
│  move(p: ToolPointer): void {
│    if (!this.active) {
│      const hit = this.pickFace(p);
│      this.host.show(hit ? { hover: { item: hit.item, face: hit.face } } : {});
│      return;
│    }
│    const a = this.active;
│    const r = this.host.inference.infer(p.x, p.y, { line: { origin: a.start, dir: a.normal } });
│    if (!r) return;
│    const t = dot(sub(r.point, a.start), a.normal);
⋮
│  private apply(t: number): void {
│    const a = this.active!;
│    const { model } = this.host;
│    model.abort();
│    model.begin("Push/Pull");
│    try {
│      if (Math.abs(t) > 1e-3) model.pushPull(a.face, t);
│      a.good = t;
│    } catch {
│      model.abort();
⋮
│  down(p: ToolPointer): void {
│    if (this.active) return this.commit();
│    const hit = this.pickFace(p);
│    if (!hit) return;
│    this.active = { face: hit.face, item: hit.item, normal: hit.normal, start: hit.point, good: 0 }
│    this.host.model.begin("Push/Pull");
│    this.host.hintChanged();
⋮
│  up(_p: ToolPointer, dragged: boolean): void {
│    if (dragged && this.active && Math.abs(this.active.good) > 1e-3) this.commit();
⋮
│  doubleClick(p: ToolPointer): void {
│    if (this.active || !this.last) return;
│    const hit = this.pickFace(p);
│    if (!hit) return;
│    // Repeat the last distance, pulling the face out toward the viewer.
│    const toward = dot(hit.normal, this.host.camera.ray(p.x, p.y).dir) < 0 ? 1 : -1;
│    this.run(hit.face, toward * Math.abs(this.last.distance));
⋮
│  key(key: string): boolean {
│    if (key === "Escape" && this.active) {
│      this.deactivate();
│      this.host.hintChanged();
│      return true;
│    }
│    return false;
⋮
│  vcb(text: string): void {
│    const d = parseLength(text, this.host.units);
│    if (!Number.isFinite(d)) return this.host.flash("Type a distance like 8' or 30\"");
│    // A typed distance goes the way the face is being dragged; a minus reverses it.
│    if (this.active) {
│      const want = (Math.sign(this.active.good) || 1) * d;
│      this.apply(want);
│      if (Math.abs(this.active.good - want) > 1e-6) {
│        this.host.flash("Can't push that far");
│        return;
⋮
│  private run(face: number, distance: number): void {
│    try {
│      this.host.model.transact("Push/Pull", () => this.host.model.pushPull(face, distance));
│      this.last = { face, distance };
│    } catch (e) {
│      this.host.flash(errorMessage(e));
│    }
│    this.host.refresh();
⋮
│  private commit(): void {
│    const a = this.active!;
│    this.active = null;
│    if (Math.abs(a.good) < 1e-3) {
│      this.host.model.abort();
│    } else {
│      this.host.model.commit();
│      this.last = { face: a.face, distance: a.good };
│    }
│    this.host.refresh();
⋮

app/src/tools/tool.ts:
# The tool framework. Each tool is a small state machine driven by pointer, key and
⋮
│export interface ToolPointer {
│  /** Pixels from the viewport's top left. */
│  x: number;
│  y: number;
│  shift: boolean;
│  ctrl: boolean;
│  alt: boolean;
⋮
│export interface Overlay {
│  inference?: Inference | null;
│  /** Preview line segments as pairs of points. */
│  segments?: Vec3[];
│  /** Preview polygon fill. */
│  fill?: Vec3[];
│  /** Face to highlight, by drawn item and face id. */
│  hover?: { item: number; face: number } | null;
│  /** An entity to highlight on hover (for select and erase). */
│  hoverEntity?: Entity | null;
⋮
│export interface ToolHost {
│  readonly model: Model;
│  /** The definition being edited (0 is the model root). */
│  readonly ctx: number;
│  readonly camera: CameraModel;
│  readonly inference: InferenceEngine;
│  readonly selection: Selection;
│  readonly units: UnitSystem;
│  /** The scene used for picking and inference. Frozen during previews. */
│  scene(): SceneIndex;
│  /** World point → active context coordinates. */
│  toLocal(p: Vec3): Vec3;
│  /** World direction → active context direction. */
│  toLocalDir(d: Vec3): Vec3;
⋮
│  refresh(opts?: { preview?: boolean }): void;
│  show(overlay: Overlay): void;
│  setVcb(text: string): void;
│  flash(message: string): void;
│  /** The tool's step changed; update hint text. */
│  hintChanged(): void;
│  enterGroup(instance: number): void;
│  exitGroup(): void;
│  format(inches: number): string;
⋮
│export interface Tool {
│  readonly id: string;
│  readonly cursor: string;
│  hint(): string;
│  vcbLabel(): string;
│  /** True while an operation is in progress (Esc cancels it). */
│  busy(): boolean;
│  activate?(): void;
│  /** Cancel anything in progress and abort its preview. */
│  deactivate(): void;
│  move(p: ToolPointer): void;
│  down(p: ToolPointer): void;
│  /** `dragged` is true when the pointer moved since `down` (click-drag-release). */
│  up(p: ToolPointer, dragged: boolean): void;
│  doubleClick?(p: ToolPointer): void;
│  /** Return true if the key was handled. */
│  key?(key: string, shift: boolean): boolean;
│  /** A value typed into the Measurements box. */
│  vcb(text: string): void;
⋮
│export class Selection {
│  items: Entity[] = [];
│  onChange: (() => void) | null = null;
│
│  private changed(): void {
│    this.onChange?.();
│  }
│  has(e: Entity): boolean {
│    return this.items.some((x) => x.kind === e.kind && x.id === e.id);
│  }
│  set(items: Entity[]): void {
│    this.items = dedupe(items);
│    this.changed();
│  }
│  add(items: Entity[]): void {
│    this.items = dedupe([...this.items, ...items]);
│    this.changed();
│  }
│  toggle(e: Entity): void {
│    this.items = this.has(e) ? this.items.filter((x) => !(x.kind === e.kind && x.id === e.id)) : [.
│    this.changed();
│  }
│  clear(): void {
│    if (!this.items.length) return;
│    this.items = [];
│    this.changed();
│  }
│  get empty(): boolean {
│    return this.items.length === 0;
│  }
│  ids(kind: Entity["kind"]): number[] {
│    return this.items.filter((x) => x.kind === kind).map((x) => x.id);
⋮
│  prune(model: Model): void {
│    const kept = this.items.filter((e) => model.exists(e));
│    if (kept.length !== this.items.length) {
│      this.items = kept;
│      this.changed();
│    }
⋮
│function dedupe(items: Entity[]): Entity[] {
│  const seen = new Set<string>();
│  return items.filter((e) => {
│    const k = `${e.kind}:${e.id}`;
│    if (seen.has(k)) return false;
│    seen.add(k);
│    return true;
│  });
⋮
│export function errorMessage(e: unknown): string {
│  const m = e instanceof Error ? e.message : String(e);
│  return m.charAt(0).toUpperCase() + m.slice(1);
⋮

app/src/units.ts:
# Lengths are stored in inches. These parse what people type in the Measurements
⋮
│export type UnitSystem = "imperial" | "metric";
│
⋮
│export function formatImperial(inches: number): string {
│  const neg = inches < 0;
│  const v = Math.round(Math.abs(inches) * 8) / 8;
│  const ft = Math.floor(v / 12 + 1e-9);
│  const rest = v - ft * 12;
│  const whole = Math.floor(rest + 1e-9);
│  let n = Math.round((rest - whole) * 8);
│  let d = 8;
│  let frac = "";
│  if (n) {
⋮
│export function formatMetric(inches: number): string {
│  const mm = inches * 25.4;
│  if (Math.abs(mm) >= 1000) return `${+(mm / 1000).toFixed(3)} m`;
│  return `${Math.round(mm)} mm`;
⋮
│export function formatLength(inches: number, units: UnitSystem = "imperial"): string {
│  return units === "metric" ? formatMetric(inches) : formatImperial(inches);
⋮
│function number(x: string): number {
│  x = x.trim();
│  if (!x) return 0;
│  const m = x.match(/^(\d+(?:\.\d*)?|\.\d+)?\s*(?:(\d+)\s*\/\s*(\d+))?$/);
│  if (!m || (m[1] === undefined && m[2] === undefined)) return NaN;
│  let v = m[1] !== undefined ? parseFloat(m[1]) : 0;
│  if (m[2]) {
│    const den = +m[3];
│    if (!den) return NaN;
│    v += +m[2] / den;
⋮
│export function parseLength(text: string, units: UnitSystem = "imperial"): number {
│  let s = text.trim().toLowerCase();
│  if (!s) return NaN;
│  let neg = false;
│  if (s.startsWith("-")) {
│    neg = true;
│    s = s.slice(1).trim();
│  }
│  let v: number;
│  const metric = s.match(/^(\d+(?:\.\d*)?|\.\d+)\s*(mm|cm|m)$/);
⋮
│export function parseLengths(text: string, units: UnitSystem = "imperial"): number[] {
│  return text.split(/[,;]/).map((p) => parseLength(p, units));
⋮

kernel-wasm/src/lib.rs:
# WebAssembly bindings for the Builder kernel.
⋮
│fn js(e: Error) -> JsError {
│    JsError::new(&e.to_string())
⋮
│fn ids<T>(v: &[u32], f: impl Fn(u32) -> T) -> Vec<T> {
│    v.iter().map(|&x| f(x)).collect()
⋮
│pub struct Buffers {
│    positions: Vec<f32>,
│    normals: Vec<f32>,
│    face_ids: Vec<u32>,
│    edge_positions: Vec<f32>,
│    edge_ids: Vec<u32>,
⋮
│impl Buffers {
│    #[wasm_bindgen(getter)]
│    pub fn positions(&self) -> Vec<f32> {
│        self.positions.clone()
│    }
│    #[wasm_bindgen(getter)]
│    pub fn normals(&self) -> Vec<f32> {
│        self.normals.clone()
│    }
│    #[wasm_bindgen(getter, js_name = faceIds)]
│    pub fn face_ids(&self) -> Vec<u32> {
│        self.face_ids.clone()
⋮
│    pub fn edge_positions(&self) -> Vec<f32> {
│        self.edge_positions.clone()
⋮
│    pub fn edge_ids(&self) -> Vec<u32> {
│        self.edge_ids.clone()
⋮
│pub struct Kernel {
│    doc: Document,
⋮
│impl Default for Kernel {
│    fn default() -> Self {
│        Kernel::new()
│    }
⋮
│impl Kernel {
│    #[wasm_bindgen(constructor)]
│    pub fn new() -> Kernel {
│        Kernel { doc: Document::new() }
│    }
│
│    #[wasm_bindgen(js_name = fromJson)]
│    pub fn from_json(text: &str) -> Result<Kernel, JsError> {
│        Ok(Kernel { doc: Document::from_json(text).map_err(js)? })
│    }
│
⋮
│    pub fn to_json(&self) -> String {
│        self.doc.to_json()
⋮
│    pub fn begin(&mut self, name: &str) {
│        self.doc.begin(name);
│    }
│    pub fn commit(&mut self) -> bool {
│        self.doc.commit()
│    }
│    pub fn abort(&mut self) {
│        self.doc.abort();
│    }
│    pub fn undo(&mut self) -> Option<String> {
│        self.doc.undo()
│    }
│    pub fn redo(&mut self) -> Option<String> {
│        self.doc.redo()
⋮
│    pub fn can_undo(&self) -> bool {
│        self.doc.can_undo()
⋮
│    pub fn can_redo(&self) -> bool {
│        self.doc.can_redo()
⋮
│    pub fn add_line(
│        &mut self,
│        ctx: u32,
│        ax: f64,
│        ay: f64,
│        az: f64,
│        bx: f64,
│        by: f64,
│        bz: f64,
⋮
│    pub fn push_pull(&mut self, face: u32, distance: f64) -> Result<i32, JsError> {
│        let r = self.doc.push_pull(FId(face), distance).map_err(js)?;
│        Ok(r.face.map(|f| f.0 as i32).unwrap_or(-1))
⋮
│    pub fn vertices_of(&self, faces: Vec<u32>, edges: Vec<u32>) -> Vec<u32> {
│        self.doc.vertices_of(&ids(&faces, FId), &ids(&edges, EId)).iter().map(|v| v.0).collect()
⋮
│    pub fn move_vertices(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsErr
│        self.doc.move_vertices(&ids(&verts, VId), V3::new(dx, dy, dz)).map_err(js)
⋮
│    pub fn erase(&mut self, faces: Vec<u32>, edges: Vec<u32>, instances: Vec<u32>) -> Result<(), Js
│        for i in instances {
│            if self.doc.instance(InstId(i)).is_some() {
│                self.doc.erase_instance(InstId(i)).map_err(js)?;
│            }
│        }
│        self.doc.erase(&ids(&faces, FId), &ids(&edges, EId)).map_err(js)
⋮
│    pub fn make_group(
│        &mut self,
│        ctx: u32,
│        faces: Vec<u32>,
│        edges: Vec<u32>,
│        instances: Vec<u32>,
⋮
│    /// Explode an instance. Returns JSON `{ faces, edges, instances }` of what it left.
│    pub fn explode(&mut self, inst: u32) -> Result<String, JsError> {
│        let out = self.doc.explode(InstId(inst)).map_err(js)?;
│        let list = |v: Vec<u32>| v.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",");
│        Ok(format!(
│            r#"{{"faces":[{}],"edges":[{}],"instances":[{}]}}"#,
│            list(out.faces.iter().map(|x| x.0).collect()),
│            list(out.edges.iter().map(|x| x.0).collect()),
│            list(out.instances.iter().map(|x| x.0).collect()),
│        ))
⋮
│    pub fn set_transform(&mut self, inst: u32, m: Vec<f64>) -> Result<(), JsError> {
│        let m: Mat4 = m.try_into().map_err(|_| JsError::new("a transform needs 16 numbers"))?;
│        self.doc.set_transform(InstId(inst), m).map_err(js)
⋮
│    /// (`{"survey": {"kind": "wall"}}`). `kind` is "definition", "instance" or "face".
│    pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError> {
│        let t = target(kind, id)?;
│        let a = self.doc.attributes(t).ok_or_else(|| JsError::new(&format!("that {kind} no longer e
│        Ok(serde_json::to_string(a).expect("attributes are JSON"))
⋮
│    pub fn set_attribute(&mut self, kind: &str, id: u32, ns: &str, key: &str, value_json: &str) -> 
│        let v: Value = serde_json::from_str(value_json).map_err(|e| JsError::new(&format!("bad attr
│        let v = if v.is_null() { None } else { Some(v) };
│        self.doc.set_attribute(target(kind, id)?, ns, key, v).map_err(js)
⋮
│    /// Every tag as JSON `[{id, name, visible, locked}]`.
│    pub fn tags(&self) -> String {
│        let list: Vec<Value> = self
│            .doc
│            .tags
│            .iter()
│            .map(|(i, t)| json!({"id": i as u32, "name": t.name, "visible": t.visible, "locked": t.
│            .collect();
│        Value::Array(list).to_string()
⋮
│    pub fn new_tag(&mut self, name: &str) -> u32 {
│        self.doc.new_tag(name).0
⋮
│    pub fn set_instance_tag(&mut self, inst: u32, tag: i32) -> Result<(), JsError> {
│        let tag = if tag < 0 { None } else { Some(TagId(tag as u32)) };
│        self.doc.set_tag(InstId(inst), tag).map_err(js)
⋮
│    pub fn set_tag_flags(&mut self, tag: u32, visible: bool, locked: bool) -> Result<(), JsError> {
│        self.doc.set_tag_flags(TagId(tag), visible, locked).map_err(js)
⋮
│    pub fn instance_props(&self, inst: u32) -> String {
│        let Some(i) = self.doc.instance(InstId(inst)) else { return "null".into() };
│        let on_locked = i.tag.and_then(|t| self.doc.tag(t)).is_some_and(|t| t.locked);
│        json!({
│            "name": i.name,
│            "tag": i.tag.map(|t| t.0),
│            "material": i.material.map(|m| m.0),
│            "locked": on_locked || self.doc.is_locked_def(i.definition) || self.doc.is_locked_def(i
│        })
│        .to_string()
⋮
│    /// Every material as JSON `[{id, name, color: [r, g, b], opacity}]`.
│    pub fn materials(&self) -> String {
│        let list: Vec<Value> = self
│            .doc
│            .materials
│            .iter()
│            .map(|(i, m)| json!({"id": i as u32, "name": m.name, "color": m.color, "opacity": m.opa
│            .collect();
│        Value::Array(list).to_string()
⋮
│    pub fn face_materials(&self, def: u32) -> Vec<i32> {
│        let mut out = Vec::new();
│        for (_, face) in self.doc.faces_in(DefId(def)) {
│            let m = face.material.map(|m| m.0 as i32).unwrap_or(-1);
│            out.extend(std::iter::repeat_n(m, face.tris.len() / 3));
│        }
│        out
⋮
│    pub fn definition_name(&self, def: u32) -> String {
│        self.doc.definition(DefId(def)).map(|d| d.name.clone()).unwrap_or_default()
⋮
│    pub fn is_locked_def(&self, def: u32) -> bool {
│        self.doc.is_locked_def(DefId(def))
⋮
│    pub fn buffers(&self, def: u32) -> Buffers {
│        let f = self.doc.face_buffers(DefId(def));
│        let e = self.doc.edge_buffers(DefId(def));
│        Buffers {
│            positions: f.positions,
│            normals: f.normals,
│            face_ids: f.face_ids,
│            edge_positions: e.positions,
│            edge_ids: e.edge_ids,
│        }
⋮
│    /// Ids of every live definition (0 is the model root).
│    pub fn definitions(&self) -> Vec<u32> {
│        self.doc.definitions.iter().map(|(i, _)| i as u32).collect()
⋮
│    /// Instances placed in `def`, flattened as `[id, definition, m0..m15]` per instance.
│    pub fn instances(&self, def: u32) -> Vec<f64> {
│        let mut out = Vec::new();
│        for (id, inst) in self.doc.instances_in(DefId(def)) {
│            out.push(id.0 as f64);
│            out.push(inst.definition.0 as f64);
│            out.extend_from_slice(&inst.transform);
│        }
│        out
⋮
│    pub fn instance_info(&self, inst: u32) -> Vec<u32> {
│        self.doc.instance(InstId(inst)).map(|i| vec![i.definition.0, i.parent.0]).unwrap_or_default
⋮
│    pub fn world_transform(&self, def: u32) -> Vec<f64> {
│        self.doc.world_transform(DefId(def)).to_vec()
⋮
│    pub fn face_plane(&self, face: u32) -> Vec<f64> {
│        match self.doc.face(FId(face)) {
│            Some(f) => {
│                let n = f.plane.normal;
│                vec![n.x, n.y, n.z, f.plane.d, f.owner.0 as f64, self.doc.face_area(FId(face))]
│            }
│            None => Vec::new(),
│        }
⋮
│    pub fn face_edges(&self, face: u32) -> Vec<u32> {
│        self.doc
│            .face(FId(face))
│            .map(|f| self.doc.face_edges(f).iter().map(|e| e.0).collect())
│            .unwrap_or_default()
⋮
│    pub fn face_outer(&self, face: u32) -> Vec<f64> {
│        let Some(f) = self.doc.face(FId(face)) else { return Vec::new() };
│        f.outer.iter().flat_map(|&v| <[f64; 3]>::from(self.doc.pos(v))).collect()
⋮
│    pub fn edge_info(&self, edge: u32) -> Vec<f64> {
│        let Some(e) = self.doc.edge(EId(edge)) else { return Vec::new() };
│        let (a, b) = (self.doc.pos(e.v[0]), self.doc.pos(e.v[1]));
│        vec![a.x, a.y, a.z, b.x, b.y, b.z, e.owner.0 as f64]
⋮
│    pub fn edge_faces(&self, edge: u32) -> Vec<u32> {
│        self.doc.edge(EId(edge)).map(|e| e.faces.iter().map(|f| f.0).collect()).unwrap_or_default()
⋮
│    /// `[faces, edges, vertices, instances]` across the whole document.
│    pub fn stats(&self) -> Vec<u32> {
│        vec![
│            self.doc.faces.count() as u32,
│            self.doc.edges.count() as u32,
│            self.doc.vertices.count() as u32,
│            self.doc.instances.count() as u32,
│        ]
⋮
│fn target(kind: &str, id: u32) -> Result<AttrTarget, JsError> {
│    Ok(match kind {
│        "definition" => AttrTarget::Definition(DefId(id)),
│        "instance" => AttrTarget::Instance(InstId(id)),
│        "face" => AttrTarget::Face(FId(id)),
│        _ => return Err(JsError::new("kind must be definition, instance or face")),
│    })
⋮

kernel/src/doc.rs:
# The document: entity records stored in journaled arenas.
⋮
│macro_rules! id_type {
⋮
│/// An attribute value: a JSON string, number or boolean.
│pub type AttrValue = serde_json::Value;
│
⋮
│/// they serialize the same way every time. A namespace is never left empty.
│pub type Attributes = BTreeMap<String, BTreeMap<String, AttrValue>>;
│
⋮
│pub enum AttrTarget {
│    Definition(DefId),
│    Instance(InstId),
│    Face(FId),
⋮
│/// (`[a-z][a-z0-9_-]*`), the key is not empty and the value, if any, is a scalar.
│pub(crate) fn check_attribute(ns: &str, key: &str, value: Option<&AttrValue>) -> Result<(), String>
│    let mut chars = ns.chars();
│    let ns_ok = chars.next().is_some_and(|c| c.is_ascii_lowercase())
│        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-');
│    if !ns_ok {
│        return Err(format!("namespace {ns:?} must match [a-z][a-z0-9_-]*"));
│    }
│    if key.is_empty() {
│        return Err("key is empty".into());
│    }
⋮
│pub struct Vertex {
│    pub owner: DefId,
│    pub pos: V3,
│    pub edges: Vec<EId>,
⋮
│pub struct Edge {
│    pub owner: DefId,
│    pub v: [VId; 2],
│    pub faces: Vec<FId>,
⋮
│impl Edge {
│    pub fn other(&self, v: VId) -> VId {
│        if self.v[0] == v {
│            self.v[1]
│        } else {
│            self.v[0]
│        }
│    }
⋮
│pub struct Face {
│    pub owner: DefId,
│    /// Counter-clockwise seen from the front (looking against `plane.normal`).
│    pub outer: Vec<VId>,
│    /// Clockwise seen from the front.
│    pub holes: Vec<Vec<VId>>,
│    pub plane: Plane,
│    pub material: Option<MatId>,
│    pub back_material: Option<MatId>,
│    pub attributes: Attributes,
⋮
│impl Face {
│    pub fn loops(&self) -> impl Iterator<Item = &Vec<VId>> {
│        std::iter::once(&self.outer).chain(self.holes.iter())
│    }
│    /// The loop vertices in triangulation index order.
│    pub fn flat_vertices(&self) -> Vec<VId> {
│        self.loops().flatten().copied().collect()
│    }
⋮
│pub enum DefKind {
│    Root,
│    Group,
│    Component,
⋮
│pub struct Definition {
│    pub name: String,
│    pub kind: DefKind,
│    pub attributes: Attributes,
⋮
│pub struct Instance {
│    pub definition: DefId,
│    /// The definition this instance is placed in.
│    pub parent: DefId,
│    pub transform: Mat4,
│    pub name: String,
│    pub material: Option<MatId>,
│    pub tag: Option<TagId>,
│    pub attributes: Attributes,
⋮
│pub struct Material {
│    pub name: String,
│    /// sRGB, 0–255.
│    pub color: [u8; 3],
│    pub opacity: f64,
⋮
│pub struct Tag {
│    pub name: String,
│    pub visible: bool,
│    /// Instances on a locked tag, and the geometry inside them, refuse edits.
│    #[serde(default)]
│    pub locked: bool,
⋮
│pub struct Arena<T> {
│    slots: Vec<Option<T>>,
⋮
│impl<T> Default for Arena<T> {
│    fn default() -> Self {
│        Arena { slots: Vec::new() }
│    }
⋮
│impl<T> Arena<T> {
│    pub fn get(&self, i: usize) -> Option<&T> {
│        self.slots.get(i).and_then(|s| s.as_ref())
│    }
│    pub fn len_slots(&self) -> usize {
│        self.slots.len()
│    }
│    pub fn iter(&self) -> impl Iterator<Item = (usize, &T)> {
│        self.slots.iter().enumerate().filter_map(|(i, s)| s.as_ref().map(|t| (i, t)))
│    }
│    pub fn count(&self) -> usize {
│        self.slots.iter().filter(|s| s.is_some()).count()
│    }
│    fn put(&mut self, i: usize, v: Option<T>) -> Option<T> {
│        if i >= self.slots.len() {
│            self.slots.resize_with(i + 1, || None);
│        }
│        std::mem::replace(&mut self.slots[i], v)
⋮
│pub enum Change {
│    Vertex(u32, Option<Vertex>, Option<Vertex>),
│    Edge(u32, Option<Edge>, Option<Edge>),
│    Face(u32, Option<Face>, Option<Face>),
│    Definition(u32, Option<Definition>, Option<Definition>),
│    Instance(u32, Option<Instance>, Option<Instance>),
│    Material(u32, Option<Material>, Option<Material>),
│    Tag(u32, Option<Tag>, Option<Tag>),
⋮
│pub struct Transaction {
│    pub name: String,
│    pub changes: Vec<Change>,
⋮
│pub struct Document {
│    pub vertices: Arena<Vertex>,
│    pub edges: Arena<Edge>,
│    pub faces: Arena<Face>,
│    pub definitions: Arena<Definition>,
│    pub instances: Arena<Instance>,
│    pub materials: Arena<Material>,
│    pub tags: Arena<Tag>,
│    /// Writes made since the open transaction began.
│    pending: Vec<Change>,
⋮
│macro_rules! setter {
⋮
│impl Document {
│    pub fn new() -> Self {
│        let mut d = Document::default();
│        d.set_definition(DefId(0), Some(Definition { name: "Model".into(), kind: DefKind::Root, att
│        d.pending.clear();
│        d
│    }
│
│    setter!(set_vertex, vertex, vertices, Vertex, VId, Vertex);
│    setter!(set_edge, edge, edges, Edge, EId, Edge);
⋮
│    pub fn next_vid(&self) -> VId {
│        VId(self.vertices.len_slots() as u32)
│    }
│    pub fn next_eid(&self) -> EId {
│        EId(self.edges.len_slots() as u32)
│    }
│    pub fn next_fid(&self) -> FId {
│        FId(self.faces.len_slots() as u32)
│    }
│    pub fn next_def(&self) -> DefId {
│        DefId(self.definitions.len_slots() as u32)
│    }
│    pub fn next_inst(&self) -> InstId {
│        InstId(self.instances.len_slots() as u32)
│    }
│    pub fn next_mat(&self) -> MatId {
│        MatId(self.materials.len_slots() as u32)
⋮
│    pub fn pos(&self, v: VId) -> V3 {
│        self.vertices.get(v.idx()).map(|v| v.pos).unwrap_or_default()
⋮
│    /// become part of the next one that commits.
│    pub fn begin(&mut self, name: &str) {
│        if self.open.is_some() {
│            self.abort();
│        }
│        self.open = Some(name.to_string());
⋮
│    pub fn in_transaction(&self) -> bool {
│        self.open.is_some()
⋮
│    /// Commit the open transaction. Returns false if nothing changed.
│    pub fn commit(&mut self) -> bool {
│        let name = self.open.take().unwrap_or_default();
│        if self.pending.is_empty() {
│            return false;
│        }
│        let changes = std::mem::take(&mut self.pending);
│        self.undo.push(Transaction { name, changes });
│        self.redo.clear();
│        true
⋮
│    /// Throw away every write since `begin`.
│    pub fn abort(&mut self) {
│        let changes = std::mem::take(&mut self.pending);
│        for c in changes.iter().rev() {
│            self.apply(c, true);
│        }
│        self.open = None;
⋮
│    pub fn undo(&mut self) -> Option<String> {
│        if self.open.is_some() {
│            self.abort();
│        }
│        let t = self.undo.pop()?;
│        for c in t.changes.iter().rev() {
│            self.apply(c, true);
│        }
│        let name = t.name.clone();
│        self.redo.push(t);
⋮
│    pub fn redo(&mut self) -> Option<String> {
│        if self.open.is_some() {
│            self.abort();
│        }
│        let t = self.redo.pop()?;
│        for c in &t.changes {
│            self.apply(c, false);
│        }
│        let name = t.name.clone();
│        self.undo.push(t);
⋮
│    pub fn can_undo(&self) -> bool {
│        !self.undo.is_empty()
│    }
│    pub fn can_redo(&self) -> bool {
│        !self.redo.is_empty()
│    }
│    pub fn undo_name(&self) -> Option<&str> {
│        self.undo.last().map(|t| t.name.as_str())
⋮
│    /// Changes in the open transaction (used to find which definitions to redraw).
│    pub fn pending_changes(&self) -> &[Change] {
│        &self.pending
⋮
│    /// Forget all history (after loading a file).
│    pub fn clear_history(&mut self) {
│        self.pending.clear();
│        self.open = None;
│        self.undo.clear();
│        self.redo.clear();
⋮
│    fn apply(&mut self, c: &Change, backwards: bool) {
│        macro_rules! restore {
│            ($arena:ident, $i:expr, $b:expr, $a:expr) => {{
│                let v = if backwards { $b.clone() } else { $a.clone() };
│                self.$arena.put(*$i as usize, v);
│            }};
│        }
│        match c {
│            Change::Vertex(i, b, a) => restore!(vertices, i, b, a),
│            Change::Edge(i, b, a) => restore!(edges, i, b, a),
⋮
│    pub fn faces_in(&self, ctx: DefId) -> impl Iterator<Item = (FId, &Face)> {
│        self.faces.iter().filter(move |(_, f)| f.owner == ctx).map(|(i, f)| (FId(i as u32), f))
│    }
│    pub fn edges_in(&self, ctx: DefId) -> impl Iterator<Item = (EId, &Edge)> {
│        self.edges.iter().filter(move |(_, e)| e.owner == ctx).map(|(i, e)| (EId(i as u32), e))
│    }
│    pub fn vertices_in(&self, ctx: DefId) -> impl Iterator<Item = (VId, &Vertex)> {
│        self.vertices.iter().filter(move |(_, v)| v.owner == ctx).map(|(i, v)| (VId(i as u32), v))
│    }
│    pub fn instances_in(&self, ctx: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
│        self.instances.iter().filter(move |(_, i)| i.parent == ctx).map(|(i, inst)| (InstId(i as u3
│    }
│    pub fn instances_of(&self, def: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
│        self.instances
│            .iter()
│            .filter(move |(_, i)| i.definition == def)
│            .map(|(i, inst)| (InstId(i as u32), inst))
⋮
│    pub fn new_instance(&mut self, definition: DefId, parent: DefId) -> InstId {
│        let id = self.next_inst();
│        self.set_instance(
│            id,
│            Some(Instance {
│                definition,
│                parent,
│                transform: IDENTITY,
│                name: String::new(),
│                material: None,
⋮
│    pub fn attributes(&self, t: AttrTarget) -> Option<&Attributes> {
│        match t {
│            AttrTarget::Definition(d) => self.definition(d).map(|x| &x.attributes),
│            AttrTarget::Instance(i) => self.instance(i).map(|x| &x.attributes),
│            AttrTarget::Face(f) => self.face(f).map(|x| &x.attributes),
│        }
⋮
│    /// Set one attribute, or delete it with `None`. A namespace left empty is removed.
│    pub fn set_attribute(
│        &mut self,
│        t: AttrTarget,
│        ns: &str,
│        key: &str,
│        value: Option<AttrValue>,
⋮
│    /// Add a visible, unlocked tag.
│    pub fn new_tag(&mut self, name: &str) -> TagId {
│        let id = TagId(self.tags.len_slots() as u32);
│        self.set_tag_record(id, Some(Tag { name: name.to_string(), visible: true, locked: false }))
│        id
⋮
│    /// Put an instance on a tag, or on none.
│    pub fn set_tag(&mut self, inst: InstId, tag: Option<TagId>) -> Result<(), Error> {
│        let mut x = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
│        if let Some(t) = tag {
│            self.tag(t).ok_or(Error::Missing("tag"))?;
│        }
│        x.tag = tag;
│        self.set_instance(inst, Some(x));
│        Ok(())
⋮
│    pub fn set_tag_flags(&mut self, tag: TagId, visible: bool, locked: bool) -> Result<(), Error> {
│        let mut x = self.tag(tag).cloned().ok_or(Error::Missing("tag"))?;
│        x.visible = visible;
│        x.locked = locked;
│        self.set_tag_record(tag, Some(x));
│        Ok(())
⋮

kernel/src/edit.rs:
# Moving and erasing geometry.
⋮
│impl Document {
│    /// Move vertices by `offset`. Faces that use them must stay planar and keep
│    /// their facing; otherwise the move fails and the caller should abort.
│    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│        let set: BTreeSet<VId> = verts.iter().copied().collect();
│        for &v in &set {
│            self.check_def_unlocked(self.vertex(v).ok_or(Error::Missing("vertex"))?.owner)?;
│        }
│        let mut touched: BTreeSet<FId> = BTreeSet::new();
│        for &v in &set {
│            let mut vx = self.vertex(v).cloned().ok_or(Error::Missing("vertex"))?;
│            vx.pos = vx.pos + offset;
│            for &e in &vx.edges {
⋮
│    /// The vertices used by a set of faces and edges, for moving them.
│    pub fn vertices_of(&self, faces: &[FId], edges: &[EId]) -> Vec<VId> {
│        let mut out: BTreeSet<VId> = BTreeSet::new();
│        for &f in faces {
│            if let Some(face) = self.face(f) {
│                out.extend(face.loops().flatten().copied());
│            }
│        }
│        for &e in edges {
│            if let Some(ed) = self.edge(e) {
│                out.extend(ed.v);
⋮
│    /// edge divided two coplanar faces facing the same way, they merge into one.
│    pub fn erase(&mut self, faces: &[FId], edges: &[EId]) -> Result<(), Error> {
│        let owners = faces
│            .iter()
│            .filter_map(|&f| self.face(f).map(|x| x.owner))
│            .chain(edges.iter().filter_map(|&e| self.edge(e).map(|x| x.owner)));
│        for def in owners.collect::<BTreeSet<DefId>>() {
│            self.check_def_unlocked(def)?;
│        }
│        let erased_faces: HashSet<FId> = faces.iter().copied().collect();
│        for &f in faces {
⋮
│    /// replacing them with one edge. Returns true if it did.
│    pub fn dissolve_vertex(&mut self, v: VId) -> Result<bool, Error> {
│        let Some(vx) = self.vertex(v).cloned() else {
│            return Ok(false);
│        };
│        let [e1, e2] = vx.edges[..] else {
│            return Ok(false);
│        };
│        let (Some(ed1), Some(ed2)) = (self.edge(e1).cloned(), self.edge(e2).cloned()) else {
│            return Ok(false);
│        };
⋮

kernel/src/group.rs:
# Groups and component instances.
⋮
│pub struct Exploded {
│    pub faces: Vec<FId>,
│    pub edges: Vec<EId>,
│    pub instances: Vec<InstId>,
⋮
│impl Document {
│    /// Wrap faces, edges and instances of `ctx` in a new group. Faces bring their
│    /// edges with them. Edges still used by faces left outside stay behind as well,
│    /// so the remaining geometry keeps its boundary.
│    pub fn make_group(
│        &mut self,
│        ctx: DefId,
│        faces: &[FId],
│        edges: &[EId],
│        instances: &[InstId],
⋮
│    /// copy welds to touching geometry there. A group's definition is deleted.
│    pub fn explode(&mut self, inst: InstId) -> Result<Exploded, Error> {
│        let instance = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
│        self.check_instance_unlocked(inst)?;
│        let (def, parent, m) = (instance.definition, instance.parent, instance.transform);
│        let mut out = Exploded::default();
│
│        let mut vmap: HashMap<VId, VId> = HashMap::new();
│        let verts: Vec<(VId, V3)> = self.vertices_in(def).map(|(id, v)| (id, v.pos)).collect();
│        for (id, p) in verts {
│            let nv = self.vertex_at(parent, mat_apply(&m, p));
⋮
│    fn delete_definition_contents(&mut self, def: DefId) {
│        let faces: Vec<FId> = self.faces_in(def).map(|(id, _)| id).collect();
│        for f in faces {
│            self.remove_face(f);
│        }
│        let edges: Vec<EId> = self.edges_in(def).map(|(id, _)| id).collect();
│        for e in edges {
│            self.remove_edge(e);
│        }
⋮
│    /// Delete an instance. A group's definition goes with it.
│    pub fn erase_instance(&mut self, inst: InstId) -> Result<(), Error> {
│        let def = self.instance(inst).ok_or(Error::Missing("instance"))?.definition;
│        self.check_instance_unlocked(inst)?;
│        self.set_instance(inst, None);
│        if self.instances_of(def).count() == 0 {
│            let children: Vec<InstId> = self.instances_in(def).map(|(i, _)| i).collect();
│            for c in children {
│                self.erase_instance(c)?;
│            }
│            self.delete_definition_contents(def);
⋮
│    pub fn set_transform(&mut self, inst: InstId, m: Mat4) -> Result<(), Error> {
│        let mut x = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
│        self.check_instance_unlocked(inst)?;
│        x.transform = m;
│        self.set_instance(inst, Some(x));
│        Ok(())
⋮
│    /// definition it is placed in, is on a locked tag.
│    pub fn is_locked_def(&self, def: DefId) -> bool {
│        self.instances_of(def).any(|(_, i)| self.tag_locked(i.tag) || self.is_locked_def(i.parent))
⋮
│    fn tag_locked(&self, tag: Option<TagId>) -> bool {
│        tag.and_then(|t| self.tag(t)).is_some_and(|t| t.locked)
⋮
│    /// True when anything placed inside `def`, at any depth, is on a locked tag.
│    fn contains_locked(&self, def: DefId) -> bool {
│        self.instances_in(def).any(|(_, i)| self.tag_locked(i.tag) || self.contains_locked(i.defini
⋮
│    /// `Error::Locked` if edits to geometry in `def` are refused.
│    pub(crate) fn check_def_unlocked(&self, def: DefId) -> Result<(), Error> {
│        if self.is_locked_def(def) {
│            return Err(Error::Locked);
│        }
│        Ok(())
⋮
│    /// locked instance inside it.
│    pub(crate) fn check_instance_unlocked(&self, inst: InstId) -> Result<(), Error> {
│        let i = self.instance(inst).ok_or(Error::Missing("instance"))?;
│        if self.tag_locked(i.tag) || self.is_locked_def(i.parent) || self.contains_locked(i.definit
│            return Err(Error::Locked);
│        }
│        Ok(())
⋮
│    /// instance (true for groups); components use the first instance found.
│    pub fn world_transform(&self, def: DefId) -> Mat4 {
│        let mut m = crate::math::IDENTITY;
│        let mut d = def;
│        let mut guard = 0;
│        while d != ROOT && guard < 64 {
│            let Some((_, inst)) = self.instances_of(d).next() else {
│                break;
│            };
│            m = mat_mul(&inst.transform, &m);
│            d = inst.parent;
⋮
```

## Summary

Two journaled kernel operations that duplicate geometry or a group at an offset, their wasm and `Model` wrappers, a copy modifier on the Move tool, and a Measurements-box array syntax (`5x`, `/5`) that replays the last copy as one transaction. Group copies get their own definition (deep copy); shared definitions wait for components (3.1).

## Decisions

### Cited

- `mvr2opid Tag lock enforced by the kernel`: `copy_geometry` calls `check_def_unlocked(ctx)` and `copy_instance` calls `check_instance_unlocked(inst)` before writing, returning `Error::Locked`; the app turns it into the "that is on a locked tag" toast as `MoveTool.down` does today (`app/src/tools/move.ts:103-105`).
- `mvr2op7t Namespaced attributes in the builder format`: copies carry face, definition and instance attributes unchanged (`Attributes` is cloned), so a copied joist keeps its `survey` namespace.

### Proposed

- None. The group-copy decision (own definition, not shared) is recorded in requirements.md Feature 1 and follows from `world_transform(def)` taking the first instance (`kernel/src/group.rs:228`); it does not constrain code beyond this sprint and components (3.1) will revisit it.

## Technical Specifications

**Prerequisite (MovesThatStick).** `copy_geometry` does not weld. After it creates the new vertices, edges and faces it hands the new edges to the integrate step that the **MovesThatStick** sprint adds to `kernel/src/edit.rs` (its Phase 2 "Integrate After Move": owner check, insert the moved edges through the `add_line` segment path, `heal_around`, then the coplanar settle shared with push/pull). This sprint's Phase 1 cannot start until MovesThatStick is merged on the branch. The step is referenced here as `integrate_moved(def, &edges)`; if MovesThatStick ships it under another name (`move_and_integrate` was the requirements-time name, and that sprint's plan may expose the post-move part as a separate `pub(crate)` function), Task 1.1 uses that name and spec.md is amended in the same commit. Welding behaviour, tolerances (`tol::LENGTH`) and the "integrate in the vertices' own definition" rule are MovesThatStick's and are not re-specified or re-tested here beyond the one landing test in `kernel/tests/copy.rs`.

### Interfaces

#### Kernel (`kernel/src/edit.rs`, `kernel/src/group.rs`)

```rust
// kernel/src/edit.rs
/// What a copy of loose geometry made in the target context.
#[derive(Clone, Debug, Default)]
pub struct Copied {
    pub faces: Vec<FId>,
    pub edges: Vec<EId>,
}

impl Document {
    /// Duplicate faces and edges of `ctx` translated by `offset`, keeping
    /// materials, back materials and face attributes, then integrate the new
    /// edges with what they land on (MovesThatStick). Faces bring their edges.
    /// Inputs not owned by `ctx` are ignored; nothing to copy is `Error::Empty`.
    /// `Error::Locked` when `ctx` is locked (ADR mvr2opid). Journaled.
    pub fn copy_geometry(&mut self, ctx: DefId, faces: &[FId], edges: &[EId], offset: V3) -> Result<Copied, Error>;
}

// kernel/src/group.rs
impl Document {
    /// Copy an instance as a new group: a new definition with the same name,
    /// kind, attributes and geometry (vertices, edges, faces with materials,
    /// back materials and attributes), child instances copied recursively the
    /// same way, and a new instance record cloned from `inst` (name, material,
    /// tag, attributes) whose transform is `inst`'s translated by `offset` in
    /// the parent's coordinates. Returns the new instance. `Error::Locked`
    /// when `inst` is locked (ADR mvr2opid). Journaled.
    pub fn copy_instance(&mut self, inst: InstId, offset: V3) -> Result<InstId, Error>;

    /// Deep-copy `def` into a new definition placed nowhere; `copy_instance`
    /// and its recursion use it. The vmap pattern of `explode` (group.rs:102).
    fn copy_definition(&mut self, def: DefId) -> Result<DefId, Error>;
}
```

#### Wasm (`kernel-wasm/src/lib.rs`)

```rust
impl Kernel {
    /// Copy loose geometry. Returns JSON `{ faces, edges }` of the copy
    /// (the `explode` pattern, lib.rs:170).
    #[wasm_bindgen(js_name = copyGeometry)]
    pub fn copy_geometry(&mut self, ctx: u32, faces: Vec<u32>, edges: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<String, JsError>;

    /// Copy an instance as a new group. Returns the new instance id.
    #[wasm_bindgen(js_name = copyInstance)]
    pub fn copy_instance(&mut self, inst: u32, dx: f64, dy: f64, dz: f64) -> Result<u32, JsError>;
}
```

#### Model (`app/src/kernel/model.ts`)

```ts
export class Model {
  /** Copy loose geometry of `ctx` by `d` (context coordinates). */
  copyGeometry(ctx: number, faces: number[], edges: number[], d: Vec3): { faces: number[]; edges: number[] };
  /** Copy an instance as a new group placed `d` away (parent coordinates). */
  copyInstance(inst: number, d: Vec3): number;
}
```

Both go through `changed()` like `explode` and `setTransform` (model.ts:151-156) and are called inside a transaction (`begin`/`commit` or `transact`).

#### Units (`app/src/units.ts`)

```ts
export interface ArraySpec {
  /** "times": N more copies at the last spacing. "divide": N copies spread evenly over the last offset. */
  kind: "times" | "divide";
  /** A positive integer. */
  n: number;
}

/**
 * Parse an array count typed into the Measurements box: `5x`, `x5`, `5*`, `*5`
 * (times) or `/5`, `5/` (divide). Whitespace and case are ignored. Anything else,
 * including `0x`, `2.5x`, `-3x` and a bare `5`, is null so the caller can try
 * `parseLength` next (which returns NaN for every array spelling).
 */
export function parseArray(text: string): ArraySpec | null;
```

#### Tool framework (`app/src/tools/tool.ts`)

```ts
export interface ToolPointer {
  x: number;
  y: number;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  /** The copy modifier is held (Option on Mac, Ctrl elsewhere). */
  copy: boolean;
}

export interface Tool {
  // ...existing members unchanged...
  /** The copy modifier went down or up while the tool is active (keyboard, no pointer). */
  modifier?(copy: boolean): void;
}
```

`Tool.cursor` stays `readonly cursor: string`; `MoveTool` implements it as a getter so it can read `"copy"` while copying. `App.hintChanged()` re-applies `this.tool.cursor` to the canvas (today only `setTool` and `pointerup` do, app.ts:183 and :543).

#### App (`app/src/app.ts`)

```ts
/** Platform copy key: Option on Mac (Ctrl is undo/redo/save/open and Ctrl-click orbits), Ctrl elsewhere. */
function copyKey(ev: KeyboardEvent | MouseEvent): boolean;

private pointer(ev): ToolPointer;   // adds copy: copyKey(ev)
private keydown(ev): void;          // before `if (mod || ev.altKey) return` (app.ts:666): on the copy key, tool.modifier?.(true) then hintChanged(); auto-focus regex becomes /^[0-9.'",\-/x*]$/
// keyup listener (app.ts:613): on the copy key, tool.modifier?.(false) then hintChanged()
```

#### Move tool (`app/src/tools/move.ts`)

```ts
interface Moving {
  base: Vec3;
  verts: number[];
  instances: { id: number; transform: Mat4 }[];
  good: Vec3;
  /** Commit as a copy instead of a move. Toggled by the copy modifier until commit. */
  copy: boolean;
  /** The faces and edges the copy duplicates (instances come from `instances`). */
  selection: { faces: number[]; edges: number[]; instances: number[] };
}

interface LastCopy {
  /** What was copied, in the context it was copied in. */
  selection: { faces: number[]; edges: number[]; instances: number[] };
  /** The committed offset in world coordinates. */
  offset: Vec3;
  /** Copies made by the last array replay, or 1 after a plain copy. */
  count: number;
}

export class MoveTool implements Tool {
  readonly id = "move";
  get cursor(): string;                       // "copy" while moving with copy set, else "move"
  hint(): string;                             // copy: "Click to place the copy, or type a distance. Then type 5x or /5 for an array."
  modifier(copy: boolean): void;              // sets moving.copy when moving; remembers it for the next down() otherwise
  vcb(text: string): void;                    // parseArray first → array(spec); else parseLength as today
  private array(spec: ArraySpec): void;       // needs lastCopy, else flash("Copy something first")
  private commit(): void;                     // copy: abort the Move preview, transact("Copy") with copyGeometry/copyInstance at this.host.toLocalDir(good), select the copies, set lastCopy
  private lastCopy: LastCopy | null;          // cleared in start() and deactivate()
}
```

Array semantics (`array(spec)`), with `o` = `lastCopy.offset` and `S` = `lastCopy.selection`:

- `times` N: copies at `o*k` for `k = 1..N`.
- `divide` N: copies at `o*k/N` for `k = 1..N` (the Nth lands where the first copy was).
- The last "Copy" transaction is undone first (`model.undo()`), then the N copies are made in one `transact("Copy")`, so retyping `5x` after `9x` leaves six parts (original plus five) and one undo removes the whole array. The originals are never touched, so instance copies always start from `S`'s ids, which survive the undo.
- A plain move does not array: `last.dir` keeps only a unit direction (move.ts:169), so `lastCopy` is the only source and "Copy something first" is the message otherwise.

#### Test host (`app/test/toolhost.ts`)

```ts
at(p: Vec3, opts?: { copy?: boolean }): ToolPointer;
/** `click` with the copy modifier held. */
copyClick(tool: Tool, p: Vec3): void;
```

### Data Models

- `Copied { faces, edges }` (kernel) serialises over wasm as `{"faces":[..],"edges":[..]}`, the `Exploded` encoding without `instances`.
- `copy_instance`'s new definition: `Definition { name: same as the source, kind: Group, attributes: cloned }`. Its instance: `Instance { definition: new def, parent: same, transform: mat_mul(&mat_translation(offset), &src.transform), name, material, tag, attributes: cloned }`. Nested instances inside the source definition are copied recursively with their own transforms unchanged (they are relative to the definition).
- No file-format change: copies are ordinary definitions and instances in `.builder` JSON.
- `ArraySpec` is app-only, never stored.
- Transaction names: the Move tool's preview stays `"Move"`; a copy and an array commit as `"Copy"`, so `Undo Copy` is what the toast shows.

### Examples

```rust
// kernel/tests/copy.rs
let mut d = Document::new();
make_box(&mut d, 10.0, 10.0, 10.0);
let (f, e) = (faces(&d, ROOT), d.edges_in(ROOT).map(|(id, _)| id).collect::<Vec<_>>());
d.begin("Copy");
let c = d.copy_geometry(ROOT, &f, &e, v(10.0, 0.0, 0.0)).unwrap();   // lands flush: welded
d.commit();
assert_eq!(c.faces.len(), 6);
assert!(approx(volume(&d, ROOT), 2000.0));
validate(&d);
d.undo();
assert_eq!(faces(&d, ROOT).len(), 6);

let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
let g2 = d.copy_instance(g, v(16.0, 0.0, 0.0)).unwrap();
assert_ne!(d.instance(g2).unwrap().definition, d.instance(g).unwrap().definition);
```

```ts
// app/src/tools/move.ts commit(), copy branch
this.host.model.abort();
const copies = this.host.model.transact("Copy", () => {
  const local = this.host.toLocalDir(m.good);
  const g = m.selection.faces.length || m.selection.edges.length
    ? this.host.model.copyGeometry(this.host.ctx, m.selection.faces, m.selection.edges, local)
    : { faces: [], edges: [] };
  const insts = m.instances.map((i) => this.host.model.copyInstance(i.id, local));
  return { ...g, instances: insts };
});
this.lastCopy = { selection: m.selection, offset: m.good, count: 1 };
```

```ts
// app/test/tools.test.ts
const mv = new MoveTool(h);
h.selection.set([{ kind: "instance", id: joist }]);
h.click(mv, [0, 0, 0]);
mv.modifier(true);
h.hover(mv, [50, 0, 0]);
mv.vcb('16"');
expect(h.model.instances(ROOT).length).toBe(2);
mv.vcb("9x");
expect(h.model.instances(ROOT).length).toBe(10);
expect(h.model.undo()).toBe("Copy");
expect(h.model.instances(ROOT).length).toBe(1);
```

```ts
// app/src/app.ts keydown, before the modifier guard
if (copyKey(ev) && !ev.repeat) { this.tool.modifier?.(true); this.hintChanged(); }
if (mod || ev.altKey) return;
```

## Validation Criteria

```bash
cargo test --workspace
# kernel/tests/copy.rs: copied loose geometry welds where it lands (volume doubles, validate passes);
# copied group has its own definition with equal faces, edges, materials, attributes;
# undo removes the copy and leaves the original; locked tag refused with Error::Locked;
# fifty instance copies in one transaction commit in under 100 ms (debug build; bench: 2,000 boxes build in 24 ms release).
cargo run --release --example bench -p builder-kernel
# prints "copy instance ×50: ..." and "copy geometry ×50: ..."
npm test
# app/test/units.test.ts: parseArray accepts 5x x5 5* *5 /5 5/, rejects 0x 2.5x -3x "5"; "3/4" is still a length
# app/test/tools.test.ts: copy modifier leaves the original and adds a copy; copyGeometry/copyInstance inside
# transact undo as one step; locked instance refused; joist copied 16" then 9x → 10 instances, one undo;
# /9 across 12' → 10 end to end; 5x after 9x → 6; "Copy something first" with no lastCopy
npm run typecheck
```

Browser check (Patrick): draw a 2×8 joist, group it, Move with Option (Mac) or Ctrl, type `16"`, then `9x`; then Undo and `/9` with a 12' copy. Cursor reads copy and the hint names the array syntax.
