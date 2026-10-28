# Specification: NeverLoseWork

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

`flux repomap app/src/app.ts app/src/main.ts app/src/kernel/model.ts vite.config.ts package.json .github/workflows/ci.yml app/src/samples.ts`

```
.github/workflows/ci.yml

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

app/src/main.ts

app/src/samples.ts:
# Starter models built with the same kernel operations the tools use.
⋮
│function poly(m: Model, pts: Vec3[]): void {
│  pts.forEach((p, i) => m.addLine(ROOT, p, pts[(i + 1) % pts.length]));
⋮
│export function buildSample(): Model {
│  const m = new Model();
│  m.transact("Sample", () => {
│    poly(m, [[0, 0, 0], [120, 0, 0], [120, 96, 0], [0, 96, 0]]);
│    const floor = m.buffers(ROOT).faceIds[0];
│    m.pushPull(floor, -96); // ground faces point down, so up is negative
│    // A ridge line across the top, lifted to make a gable roof. The gable walls
│    // and roof planes stretch with it because the geometry is connected.
│    const ridge = m.addLine(ROOT, [0, 48, 96], [120, 48, 96]);
│    m.moveVertices(m.verticesOf([], ridge), [0, 0, 36]);
⋮
│export function buildStressTest(): Model {
│  const vertices: number[][] = [];
│  const faces: { outer: number[] }[] = [];
│  let seed = 7;
│  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
│  for (let i = 0; i < 40; i++) {
│    for (let j = 0; j < 50; j++) {
│      const x0 = i * 44;
│      const y0 = j * 44;
│      const h = 12 + Math.floor(rnd() * 14) * 12;
⋮

package.json

vite.config.ts
```

```
[paste flux repomap output here]
```

## Summary

[1-3 sentence overview: what interfaces and contracts this spec defines, not how they are implemented]

## Decisions

### Cited

- [accepted ADRs this spec relies on, e.g. `0003 Title`]

### Proposed

- [ADRs in this sprint's `decisions/` directory, `status: proposed`]

## Technical Specifications

### Interfaces

[Function signatures, class interfaces, method signatures]

```python
def process_data(input: dict) -> Result:
    """Process input data and return result."""
```

### Data Models

[Schema definitions, dataclass structures, validation rules]

```python
@dataclass
class User:
    id: int
    name: str
    email: str
```

### Examples

[Call sites showing how the interfaces are used, not how they are implemented]

```python
result = process_data({"key": "value"})
print(result.status)
```

## Validation Criteria

[How to verify the implementation is correct: test commands, assertions, expected behavior]

```bash
python -m pytest tests/test_feature.py
# Expected: all tests pass
```
