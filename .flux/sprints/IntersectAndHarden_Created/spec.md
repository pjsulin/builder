# Specification: IntersectAndHarden

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

`flux repomap kernel/src/heal.rs kernel/src/line.rs kernel/src/math.rs kernel/src/tol.rs kernel/src/doc.rs kernel/src/lib.rs kernel/examples/validate.rs kernel/tests/common/mod.rs kernel-wasm/src/lib.rs app/src/kernel/model.ts app/src/app.ts`

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

kernel/examples/validate.rs:
# Check that a `.builder` file loads: `cargo run -p builder-kernel --example validate -- FILE`.
⋮
│fn main() -> ExitCode {
│    let Some(path) = std::env::args().nth(1) else {
│        eprintln!("usage: validate FILE");
│        return ExitCode::FAILURE;
│    };
│    let text = match std::fs::read_to_string(&path) {
│        Ok(t) => t,
│        Err(e) => {
│            eprintln!("{path}: {e}");
│            return ExitCode::FAILURE;
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

kernel/src/heal.rs:
# Healing a plane: the one routine behind auto face creation, face splitting,
⋮
│pub struct OldRegion {
│    pub outer: Vec<P2>,
│    pub holes: Vec<Vec<P2>>,
│    /// The old face's normal agreed with the healed plane's normal.
│    pub front: bool,
│    pub material: Option<MatId>,
│    pub back_material: Option<MatId>,
│    pub attributes: Attributes,
⋮
│impl OldRegion {
│    fn contains(&self, p: P2) -> bool {
│        point_in_polygon(p, &self.outer) && !self.holes.iter().any(|h| point_in_polygon(p, h))
│    }
⋮
│/// A region found by the arrangement walk: an outer loop and its holes, as vertex ids.
│struct Region {
│    outer: Vec<VId>,
│    holes: Vec<Vec<VId>>,
│    component: usize,
│    uses_fresh: bool,
│    area: f64,
⋮
│impl Document {
│    /// Capture a face as an [`OldRegion`] relative to `plane`.
│    pub fn old_region(&self, f: FId, plane: &Plane) -> Option<OldRegion> {
│        let face = self.face(f)?;
│        let (u, v) = plane.basis();
│        let to = |lp: &Vec<VId>| lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect::<Vec<P2>>();
│        Some(OldRegion {
│            outer: to(&face.outer),
│            holes: face.holes.iter().map(to).collect(),
│            front: face.plane.normal.dot(plane.normal) > 0.0,
│            material: face.material,
│            back_material: face.back_material,
⋮
│    pub(crate) fn face_region_contains(&self, face: &Face, p: P2, u: V3, v: V3) -> bool {
│        let poly = |lp: &Vec<VId>| lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect::<Vec<P2>>(
│        point_in_polygon(p, &poly(&face.outer)) && !face.holes.iter().any(|h| point_in_polygon(p, &
⋮
│    fn near_face_boundary(&self, face: &Face, p: V3) -> bool {
│        face.loops().any(|lp| {
│            (0..lp.len())
│                .any(|i| point_segment(p, self.pos(lp[i]), self.pos(lp[(i + 1) % lp.len()])).0 <= t
│        })
⋮
│    /// Returns the faces created.
│    pub fn heal(
│        &mut self,
│        ctx: DefId,
│        plane: &Plane,
│        fresh: &[EId],
│        extra: &[EId],
│        mut old: Vec<OldRegion>,
⋮
│    fn bbox_2d(&self, edges: &HashSet<EId>, u: V3, v: V3) -> [f64; 4] {
│        let mut b = [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY];
│        for &e in edges {
│            if let Some(ed) = self.edge(e) {
│                for &x in &ed.v {
│                    grow(&mut b, to_2d(self.pos(x), u, v));
│                }
│            }
│        }
│        b
⋮
│    fn loop_bbox(&self, lp: &[VId], u: V3, v: V3) -> [f64; 4] {
│        let mut b = [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY];
│        for &x in lp {
│            grow(&mut b, to_2d(self.pos(x), u, v));
│        }
│        b
⋮
│    /// else toward the default camera.
│    fn default_normal(&self, plane: &Plane, outer: &[VId]) -> V3 {
│        let n = plane.normal;
│        let mut sum = V3::ZERO;
│        let mut count = 0.0;
│        for i in 0..outer.len() {
│            let Some(e) = self.edge_between(outer[i], outer[(i + 1) % outer.len()]) else {
│                continue;
│            };
│            for &f in &self.edge(e).map(|e| e.faces.clone()).unwrap_or_default() {
│                let Some(face) = self.face(f) else { continue };
⋮
│    /// Walk the planar arrangement of `graph` and return its bounded regions with holes.
│    fn arrangement(&self, graph: &HashSet<EId>, fresh: &HashSet<EId>, u: V3, v: V3) -> Vec<Region> 
│        let mut edges: Vec<EId> = graph.iter().copied().collect();
│        edges.sort();
│        // Half-edge h: 2k is edge k from v[0] to v[1], 2k+1 the reverse.
│        let mut from = Vec::with_capacity(edges.len() * 2);
│        let mut to = Vec::with_capacity(edges.len() * 2);
│        for &e in &edges {
│            let ed = self.edge(e).expect("graph edge exists");
│            from.extend([ed.v[0], ed.v[1]]);
│            to.extend([ed.v[1], ed.v[0]]);
⋮
│        fn find(p: &mut [usize], x: usize) -> usize {
│            let mut r = x;
│            while p[r] != r {
│                r = p[r];
│            }
│            let mut c = x;
│            while p[c] != r {
│                let n = p[c];
│                p[c] = r;
│                c = n;
⋮
│/// of vertex ids.
│fn split_loops(kept: &[usize], from: &[VId], to: &[VId]) -> Vec<Vec<VId>> {
│    let n = kept.len();
│    let mut used = vec![false; n];
│    let mut loops = Vec::new();
│    for s in 0..n {
│        if used[s] {
│            continue;
│        }
│        let start_vertex = from[kept[s]];
│        let mut lp = Vec::new();
⋮
│fn grow(b: &mut [f64; 4], p: P2) {
│    b[0] = b[0].min(p[0]);
│    b[1] = b[1].min(p[1]);
│    b[2] = b[2].max(p[0]);
│    b[3] = b[3].max(p[1]);
⋮
│fn bbox_overlap(a: [f64; 4], b: [f64; 4]) -> bool {
│    let t = tol::LENGTH;
│    a[0] <= b[2] + t && b[0] <= a[2] + t && a[1] <= b[3] + t && b[1] <= a[3] + t
⋮
│/// A point well inside a polygon with holes: the centroid of its largest triangle.
│pub fn interior_point(outer: &[P2], holes: &[Vec<P2>]) -> Option<P2> {
│    let mut data: Vec<f64> = Vec::new();
│    let mut hole_idx = Vec::new();
│    for p in outer {
│        data.extend_from_slice(p);
│    }
│    for h in holes {
│        hole_idx.push(data.len() / 2);
│        for p in h {
│            data.extend_from_slice(p);
⋮

kernel/src/lib.rs:
# Builder's geometry kernel: sticky planar geometry with undo.
⋮
│pub mod doc;
│pub mod edit;
│pub mod format;
│pub mod group;
│pub mod heal;
│pub mod line;
│pub mod math;
│pub mod mesh;
│pub mod pushpull;
│pub mod tol;
│pub mod topo;
│
⋮
│pub enum Error {
│    /// The input would create something with no length or area.
│    Degenerate(&'static str),
│    /// A face would no longer be flat.
│    NotPlanar,
│    /// A face would shrink to nothing or turn inside out.
│    Collapsed,
│    /// An id that does not exist (or no longer exists).
│    Missing(&'static str),
│    /// Nothing to do with an empty selection.
⋮
│impl std::fmt::Display for Error {
│    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
│        match self {
│            Error::Degenerate(why) => write!(f, "{why}"),
│            Error::NotPlanar => write!(f, "that would bend a face out of flat"),
│            Error::Collapsed => write!(f, "that would collapse or turn a face inside out"),
│            Error::Missing(what) => write!(f, "that {what} no longer exists"),
│            Error::Empty => write!(f, "nothing selected"),
│            Error::Format(why) => write!(f, "can't read file: {why}"),
│            Error::Locked => write!(f, "that is on a locked tag"),
│            Error::Attribute(why) => write!(f, "bad attribute: {why}"),
⋮

kernel/src/line.rs:
# Drawing lines into sticky geometry.
⋮
│impl Document {
│    /// Draw a line from `a` to `b` in context `ctx`.
│    ///
│    /// Endpoints weld to nearby vertices, edges the line touches or crosses are split,
│    /// the line is cut at every touch point, and then every plane the new edges lie
│    /// in is healed, which creates faces for closed loops and splits faces the line
│    /// crosses. Returns the edges that make up the line, in order from `a` to `b`.
│    pub fn add_line(&mut self, ctx: DefId, a: V3, b: V3) -> Result<Vec<EId>, Error> {
│        self.check_def_unlocked(ctx)?;
│        let edges = self.insert_segment(ctx, a, b)?;
│        self.heal_around(ctx, &edges)?;
│        Ok(edges)
⋮
│    /// Insert a segment's edges without healing faces.
│    pub fn insert_segment(&mut self, ctx: DefId, a: V3, b: V3) -> Result<Vec<EId>, Error> {
│        if !a.is_finite() || !b.is_finite() {
│            return Err(Error::Degenerate("line has a non-finite point"));
│        }
│        if a.dist(b) <= tol::LENGTH {
│            return Err(Error::Degenerate("line is too short"));
│        }
│        // Weld the endpoints to existing points first so the rest works with ids.
│        let a = self.find_vertex(ctx, a).map(|v| self.pos(v)).unwrap_or(a);
│        let b = self.find_vertex(ctx, b).map(|v| self.pos(v)).unwrap_or(b);
⋮
│    /// Returns the vertices at those points.
│    pub fn split_edge_at(&mut self, e: EId, pts: &[V3]) -> Result<Vec<VId>, Error> {
│        let edge = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
│        let (p, q) = (self.pos(edge.v[0]), self.pos(edge.v[1]));
│        let mut inside: Vec<V3> = pts
│            .iter()
│            .copied()
│            .filter(|&x| {
│                point_segment(x, p, q).0 <= tol::LENGTH && x.dist(p) > tol::LENGTH && x.dist(q) > t
│            })
│            .collect();
⋮
│    /// Heal every plane that the given edges lie in.
│    pub fn heal_around(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error> {
│        let planes = self.candidate_planes(ctx, edges);
│        for plane in planes {
│            let seeds: Vec<EId> = edges
│                .iter()
│                .copied()
│                .filter(|&e| self.edge(e).is_some() && self.edge_in_plane(e, &plane))
│                .collect();
│            if !seeds.is_empty() {
│                self.heal(ctx, &plane, &seeds, &[], Vec::new())?;
⋮
│    pub fn edge_in_plane(&self, e: EId, plane: &Plane) -> bool {
│        self.edge(e).is_some_and(|ed| ed.v.iter().all(|&v| plane.contains(self.pos(v))))
⋮
│    /// edge, and the planes an edge spans with each non-parallel neighbor.
│    fn candidate_planes(&self, ctx: DefId, edges: &[EId]) -> Vec<Plane> {
│        let mut planes: Vec<Plane> = Vec::new();
│        let mut push = |p: Plane| {
│            if !planes.iter().any(|q| q.same_surface(&p)) {
│                planes.push(p);
│            }
│        };
│        for &e in edges {
│            let Some(edge) = self.edge(e) else { continue };
│            let (a, b) = (self.pos(edge.v[0]), self.pos(edge.v[1]));
⋮

kernel/src/math.rs:
# Small vector and plane math. Everything is `f64`; lengths are inches.
⋮
│pub struct V3 {
│    pub x: f64,
│    pub y: f64,
│    pub z: f64,
⋮
│impl From<[f64; 3]> for V3 {
│    fn from(a: [f64; 3]) -> Self {
│        V3::new(a[0], a[1], a[2])
│    }
⋮
│impl From<V3> for [f64; 3] {
│    fn from(v: V3) -> Self {
│        [v.x, v.y, v.z]
│    }
⋮
│impl V3 {
│    pub const ZERO: V3 = V3 { x: 0.0, y: 0.0, z: 0.0 };
│    pub const X: V3 = V3 { x: 1.0, y: 0.0, z: 0.0 };
│    pub const Y: V3 = V3 { x: 0.0, y: 1.0, z: 0.0 };
│    pub const Z: V3 = V3 { x: 0.0, y: 0.0, z: 1.0 };
│
│    pub const fn new(x: f64, y: f64, z: f64) -> Self {
│        V3 { x, y, z }
│    }
│    pub fn dot(self, o: V3) -> f64 {
│        self.x * o.x + self.y * o.y + self.z * o.z
│    }
│    pub fn cross(self, o: V3) -> V3 {
│        V3::new(self.y * o.z - self.z * o.y, self.z * o.x - self.x * o.z, self.x * o.y - self.y * o
│    }
│    pub fn len(self) -> f64 {
│        self.dot(self).sqrt()
│    }
│    pub fn dist(self, o: V3) -> f64 {
│        (self - o).len()
│    }
│    /// Unit vector, or `None` for a (near) zero vector.
│    pub fn unit(self) -> Option<V3> {
│        let l = self.len();
│        (l > 1e-12).then(|| self * (1.0 / l))
│    }
│    pub fn lerp(self, o: V3, t: f64) -> V3 {
│        self + (o - self) * t
│    }
│    pub fn is_finite(self) -> bool {
│        self.x.is_finite() && self.y.is_finite() && self.z.is_finite()
⋮
│impl Add for V3 {
│    type Output = V3;
│    fn add(self, o: V3) -> V3 {
│        V3::new(self.x + o.x, self.y + o.y, self.z + o.z)
│    }
│}
│impl Sub for V3 {
│    type Output = V3;
│    fn sub(self, o: V3) -> V3 {
│        V3::new(self.x - o.x, self.y - o.y, self.z - o.z)
│    }
│}
│impl Mul<f64> for V3 {
│    type Output = V3;
│    fn mul(self, s: f64) -> V3 {
│        V3::new(self.x * s, self.y * s, self.z * s)
│    }
│}
│impl Neg for V3 {
│    type Output = V3;
│    fn neg(self) -> V3 {
│        V3::new(-self.x, -self.y, -self.z)
│    }
⋮
│pub struct Plane {
│    pub normal: V3,
│    pub d: f64,
⋮
│impl Plane {
│    pub fn from_point_normal(p: V3, n: V3) -> Option<Plane> {
│        let normal = n.unit()?;
│        Some(Plane { normal, d: normal.dot(p) })
│    }
│
│    /// Best-fit plane through a closed loop (Newell's method). The normal follows the
│    /// right-hand rule for the loop order, so a counter-clockwise loop seen from the
│    /// front gives a normal pointing at the viewer.
│    pub fn from_loop(pts: &[V3]) -> Option<Plane> {
│        if pts.len() < 3 {
│            return None;
│        }
│        let mut n = V3::ZERO;
│        let mut c = V3::ZERO;
│        for (i, &a) in pts.iter().enumerate() {
│            let b = pts[(i + 1) % pts.len()];
│            n.x += (a.y - b.y) * (a.z + b.z);
│            n.y += (a.z - b.z) * (a.x + b.x);
⋮
│    pub fn dist(&self, p: V3) -> f64 {
│        self.normal.dot(p) - self.d
│    }
│    pub fn contains(&self, p: V3) -> bool {
│        self.dist(p).abs() <= tol::PLANE
│    }
│    pub fn flipped(&self) -> Plane {
│        Plane { normal: -self.normal, d: -self.d }
│    }
│    /// Same set of points, either orientation.
│    pub fn same_surface(&self, o: &Plane) -> bool {
│        let c = self.normal.dot(o.normal);
│        if c > 0.0 {
│            (1.0 - c) <= tol::ANGLE && (self.d - o.d).abs() <= tol::PLANE
│        } else {
│            (1.0 + c) <= tol::ANGLE && (self.d + o.d).abs() <= tol::PLANE
│        }
⋮
│    /// keeps rectangles on walls and roofs aligned with their eaves.
│    pub fn basis(&self) -> (V3, V3) {
│        let n = self.normal;
│        let u = if n.z.abs() > 1.0 - 1e-9 { V3::X } else { V3::Z.cross(n).unit().unwrap_or(V3::X) }
│        let v = n.cross(u);
│        (u, v)
│    }
│    pub fn project(&self, p: V3) -> V3 {
│        p - self.normal * self.dist(p)
⋮
│/// 2D point in a plane basis.
│pub type P2 = [f64; 2];
│
│pub fn to_2d(p: V3, u: V3, v: V3) -> P2 {
│    [p.dot(u), p.dot(v)]
⋮
│/// Twice the signed area of a 2D polygon (positive when counter-clockwise).
│pub fn signed_area2(pts: &[P2]) -> f64 {
│    let mut a = 0.0;
│    for i in 0..pts.len() {
│        let p = pts[i];
│        let q = pts[(i + 1) % pts.len()];
│        a += p[0] * q[1] - q[0] * p[1];
│    }
│    a
⋮
│/// callers should test points that are clearly inside or outside.
│pub fn point_in_polygon(p: P2, poly: &[P2]) -> bool {
│    let mut inside = false;
│    let n = poly.len();
│    let mut j = n.wrapping_sub(1);
│    for i in 0..n {
│        let (a, b) = (poly[i], poly[j]);
│        if (a[1] > p[1]) != (b[1] > p[1]) {
│            let x = a[0] + (p[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
│            if p[0] < x {
│                inside = !inside;
⋮
│/// Distance from `p` to the segment `a`–`b`, and the parameter of the closest point.
│pub fn point_segment(p: V3, a: V3, b: V3) -> (f64, f64) {
│    let ab = b - a;
│    let l2 = ab.dot(ab);
│    if l2 <= 0.0 {
│        return (p.dist(a), 0.0);
│    }
│    let t = ((p - a).dot(ab) / l2).clamp(0.0, 1.0);
│    (p.dist(a + ab * t), t)
⋮
│/// parameters along each segment, or `None` when the segments are parallel.
│pub fn segment_segment(p0: V3, p1: V3, q0: V3, q1: V3) -> Option<(f64, f64, f64)> {
│    let d1 = p1 - p0;
│    let d2 = q1 - q0;
│    let r = p0 - q0;
│    let a = d1.dot(d1);
│    let e = d2.dot(d2);
│    let f = d2.dot(r);
│    let c = d1.dot(r);
│    let b = d1.dot(d2);
│    let denom = a * e - b * b;
⋮
│/// Column-major 4×4 affine transform, the same layout as Three.js `Matrix4.elements`.
│pub type Mat4 = [f64; 16];
│
⋮
│pub fn mat_translation(t: V3) -> Mat4 {
│    let mut m = IDENTITY;
│    m[12] = t.x;
│    m[13] = t.y;
│    m[14] = t.z;
│    m
⋮
│pub fn mat_mul(a: &Mat4, b: &Mat4) -> Mat4 {
│    let mut r = [0.0; 16];
│    for col in 0..4 {
│        for row in 0..4 {
│            r[col * 4 + row] = (0..4).map(|k| a[k * 4 + row] * b[col * 4 + k]).sum();
│        }
│    }
│    r
⋮
│pub fn mat_apply(m: &Mat4, p: V3) -> V3 {
│    V3::new(
│        m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
│        m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
│        m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
│    )
⋮
│/// Inverse of an affine transform, or `None` if it is singular.
│pub fn mat_invert(m: &Mat4) -> Option<Mat4> {
│    let (a, b, c) = (m[0], m[4], m[8]);
│    let (d, e, f) = (m[1], m[5], m[9]);
│    let (g, h, i) = (m[2], m[6], m[10]);
│    let det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
│    if det.abs() < 1e-12 {
│        return None;
│    }
│    let k = 1.0 / det;
│    let inv3 = [
⋮

kernel/src/tol.rs

kernel/tests/common/mod.rs:
⋮
│pub fn v(x: f64, y: f64, z: f64) -> V3 {
│    V3::new(x, y, z)
⋮
│/// Draw a closed polyline.
│pub fn poly(doc: &mut Document, ctx: DefId, pts: &[V3]) {
│    for i in 0..pts.len() {
│        doc.add_line(ctx, pts[i], pts[(i + 1) % pts.len()]).expect("line");
│    }
⋮
│/// Axis-aligned rectangle on the plane z.
│pub fn rect_xy(doc: &mut Document, ctx: DefId, x0: f64, y0: f64, x1: f64, y1: f64, z: f64) {
│    poly(doc, ctx, &[v(x0, y0, z), v(x1, y0, z), v(x1, y1, z), v(x0, y1, z)]);
⋮
│/// Ground faces point down, so pulling up is a negative distance along the normal.
│pub fn make_box(doc: &mut Document, w: f64, d: f64, h: f64) {
│    rect_xy(doc, ROOT, 0.0, 0.0, w, d, 0.0);
│    let f = only_face(doc, ROOT);
│    doc.push_pull(f, -h).expect("pull");
⋮
│pub fn faces(doc: &Document, ctx: DefId) -> Vec<FId> {
│    doc.faces_in(ctx).map(|(id, _)| id).collect()
⋮
│pub fn only_face(doc: &Document, ctx: DefId) -> FId {
│    let f = faces(doc, ctx);
│    assert_eq!(f.len(), 1, "expected one face, got {}", f.len());
│    f[0]
⋮
│/// The face whose plane contains `p` with the given normal.
│pub fn face_at(doc: &Document, ctx: DefId, p: V3, normal: V3) -> FId {
│    let found: Vec<FId> = doc
│        .faces_in(ctx)
│        .filter(|(id, f)| {
│            f.plane.normal.dot(normal) > 0.999 && f.plane.contains(p) && contains_point(doc, *id, p
│        })
│        .map(|(id, _)| id)
│        .collect();
│    assert_eq!(found.len(), 1, "expected one face at {p:?} facing {normal:?}, found {}", found.len(
│    found[0]
⋮
│pub fn contains_point(doc: &Document, f: FId, p: V3) -> bool {
│    let face = doc.face(f).unwrap();
│    let (u, w) = face.plane.basis();
│    let poly = |lp: &Vec<VId>| lp.iter().map(|&x| to_2d(doc.pos(x), u, w)).collect::<Vec<_>>();
│    let q = to_2d(p, u, w);
│    math::point_in_polygon(q, &poly(&face.outer))
│        && !face.holes.iter().any(|h| math::point_in_polygon(q, &poly(h)))
⋮
│pub fn edge_count(doc: &Document, ctx: DefId) -> usize {
│    doc.edges_in(ctx).count()
⋮
│pub fn vertex_count(doc: &Document, ctx: DefId) -> usize {
│    doc.vertices_in(ctx).count()
⋮
│pub fn total_area(doc: &Document, ctx: DefId) -> f64 {
│    faces(doc, ctx).iter().map(|&f| doc.face_area(f)).sum()
⋮
│pub fn approx(a: f64, b: f64) -> bool {
│    (a - b).abs() < 1e-6
⋮
│/// Every edge borders exactly two faces: a closed solid.
│pub fn is_closed(doc: &Document, ctx: DefId) -> bool {
│    doc.edges_in(ctx).all(|(_, e)| e.faces.len() == 2)
⋮
│/// Signed volume by the divergence theorem. Positive when every face points out.
│pub fn volume(doc: &Document, ctx: DefId) -> f64 {
│    let mut vol = 0.0;
│    for (_, f) in doc.faces_in(ctx) {
│        let verts = f.flat_vertices();
│        for t in f.tris.chunks(3) {
│            let a = doc.pos(verts[t[0] as usize]);
│            let b = doc.pos(verts[t[1] as usize]);
│            let c = doc.pos(verts[t[2] as usize]);
│            vol += a.dot(b.cross(c)) / 6.0;
│        }
⋮
│/// Check every topology invariant the kernel promises.
│pub fn validate(doc: &Document) {
│    for (vi, vx) in doc.vertices.iter() {
│        let vid = VId(vi as u32);
│        assert!(!vx.edges.is_empty(), "vertex {vi} has no edges");
│        let unique: HashSet<_> = vx.edges.iter().collect();
│        assert_eq!(unique.len(), vx.edges.len(), "vertex {vi} lists an edge twice");
│        for &e in &vx.edges {
│            let ed = doc.edge(e).unwrap_or_else(|| panic!("vertex {vi} lists missing edge {e:?}"));
│            assert!(ed.v.contains(&vid), "edge {e:?} does not use vertex {vi}");
│            assert_eq!(ed.owner, vx.owner, "edge and vertex owners differ");
⋮
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
