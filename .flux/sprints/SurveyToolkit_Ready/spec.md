# Specification: SurveyToolkit

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

Command: `flux repomap kernel/src/doc.rs kernel/src/format.rs kernel/src/group.rs kernel-wasm/src/lib.rs app/src/kernel/model.ts app/src/app.ts app/src/tools/tool.ts app/src/tools/select.ts app/src/tools/pick.ts app/src/view/scene.ts survey/src/builder_survey/build.py survey/src/builder_survey/cli.py survey/src/builder_survey/elements.py survey/src/builder_survey/materials.py survey/src/builder_survey/project.py survey/src/builder_survey/export/mesh.py survey/src/builder_survey/export/__init__.py survey/src/builder_survey/spec/plan.py survey/src/builder_survey/capture/serve.py survey/src/builder_survey/render/blender_build.py survey/tests/golden.py`

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
│
│  private view: Viewport;
│  private drawScene!: SceneIndex;
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
│    }
│    this.view.setScene(this.drawScene);
│    this.drawSelection();
│    this.drawOverlay();
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
│    t.textContent = message;
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
│    this.refresh();
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
│      const g = this.model.transact("Make Group", () => this.model.makeGroup(this.ctx, s.ids("face"
│      this.refresh();
│      this.selection.set([{ kind: "instance", id: g }]);
│      this.flash("Grouped");
│    } catch (e) {
│      this.flash(errorMessage(e));
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

app/src/tools/pick.ts:
# Picking whole entities (faces, edges, groups) for Select, Move and Erase.
⋮
│export interface EntityPick {
│  entity: Entity;
│  item: number;
│  /** The click landed outside the context being edited. */
│  outside: boolean;
⋮
│export function pickEntity(scene: SceneIndex, cam: CameraModel, x: number, y: number): EntityPick |
│  const ray = cam.ray(x, y);
│  const hit = scene.pick(ray, () => true);
│  const visibleDepth = hit ? hit.distance * (1 + 2e-3) + 0.05 : Infinity;
│  let best: { s: number; d: number } | null = null;
│  const xy = scene.screenEdges(cam);
│  for (let s = 0; s < scene.segEdge.length; s++) {
│    const ax = xy[s * 4], ay = xy[s * 4 + 1];
│    const dx = xy[s * 4 + 2] - ax;
│    const dy = xy[s * 4 + 3] - ay;
⋮
│function entityFor(scene: SceneIndex, item: number, raw: Entity): EntityPick {
│  const it = scene.items[item];
│  if (it.editable) return { entity: raw, item, outside: false };
│  if (it.pickInstance !== null) return { entity: { kind: "instance", id: it.pickInstance }, item, o
│  return { entity: raw, item, outside: true };
⋮
│export function boxSelect(
│  scene: SceneIndex,
│  cam: CameraModel,
│  rect: { x0: number; y0: number; x1: number; y1: number },
│  crossing: boolean,
⋮

app/src/tools/select.ts:
⋮
│export class SelectTool implements Tool {
│  readonly id = "select";
│  readonly cursor = "default";
│  private origin: { x: number; y: number } | null = null;
│  private marquee: { x0: number; y0: number; x1: number; y1: number; crossing: boolean } | null = n
│
│  constructor(private host: ToolHost) {}
│
│  hint(): string {
│    return this.host.ctx
│      ? "Editing a group. Click outside it or press Esc to close it."
│      : "Click to select, Shift to toggle, drag for a box. Double-click a group to edit it. G group
│  }
│  vcbLabel(): string {
│    return "Measurements";
│  }
│  busy(): boolean {
│    return this.marquee !== null;
⋮
│  deactivate(): void {
│    this.origin = null;
│    this.marquee = null;
│    this.host.show({});
⋮
│  move(p: ToolPointer): void {
│    if (this.origin) {
│      const crossing = p.x < this.origin.x;
│      this.marquee = { x0: this.origin.x, y0: this.origin.y, x1: p.x, y1: p.y, crossing };
│      this.host.show({ marquee: this.marquee });
│      return;
│    }
│    const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
│    this.host.show({ hoverEntity: pick && !pick.outside ? pick.entity : null });
⋮
│  down(p: ToolPointer): void {
│    this.origin = { x: p.x, y: p.y };
⋮
│  up(p: ToolPointer, dragged: boolean): void {
│    const origin = this.origin;
│    this.origin = null;
│    const { selection } = this.host;
│    if (dragged && this.marquee) {
│      const found = boxSelect(this.host.scene(), this.host.camera, this.marquee, this.marquee.cross
│      this.marquee = null;
│      if (p.shift || p.ctrl) selection.add(found);
│      else selection.set(found);
│      this.host.show({});
⋮
│  doubleClick(p: ToolPointer): void {
│    const pick = pickEntity(this.host.scene(), this.host.camera, p.x, p.y);
│    if (!pick || pick.outside) return;
│    const { model, selection } = this.host;
│    const e = pick.entity;
│    if (e.kind === "instance") {
│      this.host.enterGroup(e.id);
│      return;
│    }
│    const more: Entity[] =
⋮
│  key(key: string): boolean {
│    if (key === "Escape") {
│      if (this.marquee) {
│        this.deactivate();
│        return true;
│      }
│      if (!this.host.selection.empty) {
│        this.host.selection.clear();
│        return true;
│      }
⋮
│  vcb(): void {
│    this.host.flash("Pick a drawing tool to type a size");
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

app/src/view/scene.ts:
# World-space view of the model for picking and inference, built from the kernel's
⋮
│export interface DrawItem {
│  def: number;
│  /** Definition coordinates → world. */
│  matrix: Mat4;
│  /** Instance path from the root to this placement. */
│  path: number[];
│  /** This is the geometry of the context being edited. */
│  editable: boolean;
│  /** Inside the context being edited (drawn normally, can be picked). */
│  active: boolean;
⋮
│export interface FaceHit {
│  item: number;
│  face: number;
│  point: Vec3;
│  /** World-space front normal. */
│  normal: Vec3;
│  distance: number;
⋮
│export class SceneIndex {
│  items: DrawItem[] = [];
│  buffers = new Map<number, DefBuffers>();
│  /** Triangle corners in world space, 9 floats per triangle. */
│  tri = new Float32Array(0);
│  triFace = new Uint32Array(0);
│  triItem = new Uint32Array(0);
│  /** Edge ends in world space, 6 floats per edge. */
│  seg = new Float32Array(0);
│  segEdge = new Uint32Array(0);
⋮
│  static build(model: Model, activeCtx: number): SceneIndex {
│    const s = new SceneIndex();
│    const raw: { def: number; matrix: Mat4; path: number[] }[] = [];
│    const walk = (def: number, matrix: Mat4, path: number[], depth: number) => {
│      raw.push({ def, matrix, path });
│      if (depth > 32) return;
│      for (const inst of model.instances(def)) {
│        walk(inst.definition, mul(matrix, inst.transform), [...path, inst.id], depth + 1);
│      }
│    };
⋮
│  private flatten(): void {
│    let nt = 0;
│    let ns = 0;
│    for (const it of this.items) {
│      const b = this.buffers.get(it.def)!;
│      nt += b.faceIds.length;
│      ns += b.edgeIds.length;
│    }
│    this.tri = new Float32Array(nt * 9);
│    this.triFace = new Uint32Array(nt);
⋮
│  triCorner(t: number, c: number): Vec3 {
│    const o = t * 9 + c * 3;
│    return [this.tri[o], this.tri[o + 1], this.tri[o + 2]];
⋮
│  segEnd(s: number, end: 0 | 1): Vec3 {
│    const o = s * 6 + end * 3;
│    return [this.seg[o], this.seg[o + 1], this.seg[o + 2]];
⋮
│  pick(ray: Ray, filter: (item: DrawItem) => boolean = (it) => it.active): FaceHit | null {
│    const allowed = this.items.map(filter);
│    const [ox, oy, oz] = ray.origin;
│    const [dx, dy, dz] = ray.dir;
│    const T = this.tri;
│    let bestT = Infinity;
│    let bestTri = -1;
│    for (let t = 0; t < this.triFace.length; t++) {
│      if (!allowed[this.triItem[t]]) continue;
│      // Möller–Trumbore, inlined to avoid allocating per triangle.
⋮
│  faceNormal(item: number, face: number): Vec3 {
│    const it = this.items[item];
│    const b = this.buffers.get(it.def)!;
│    const i = b.faceIds.indexOf(face);
│    if (i < 0) return [0, 0, 1];
│    return norm(applyDir(it.matrix, [b.normals[i * 9], b.normals[i * 9 + 1], b.normals[i * 9 + 2]])
⋮
│  screenEdges(cam: CameraModel): Float32Array {
│    const key = cam.key();
│    if (this.screen?.key === key) return this.screen.xy;
│    const xy = new Float32Array(this.segEdge.length * 4);
│    const p: Vec3 = [0, 0, 0];
│    for (let i = 0; i < this.segEdge.length; i++) {
│      for (let end = 0; end < 2; end++) {
│        const o = i * 6 + end * 3;
│        p[0] = this.seg[o];
│        p[1] = this.seg[o + 1];
⋮
│  faceTriangles(item: number, face: number): number[] {
│    const out: number[] = [];
│    for (let t = 0; t < this.triFace.length; t++) {
│      if (this.triItem[t] === item && this.triFace[t] === face) {
│        for (let k = 0; k < 9; k++) out.push(this.tri[t * 9 + k]);
│      }
│    }
│    return out;
⋮
│  editableItem(): number {
│    return Math.max(0, this.items.findIndex((it) => it.editable));
⋮
│function transformInto(out: Float32Array, offset: number, src: Float32Array, m: Mat4): void {
│  if (isIdentity(m)) {
│    out.set(src, offset);
│    return;
│  }
│  for (let i = 0; i < src.length; i += 3) {
│    const x = src[i];
│    const y = src[i + 1];
│    const z = src[i + 2];
│    out[offset + i] = m[0] * x + m[4] * y + m[8] * z + m[12];
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

kernel/src/doc.rs:
# The document: entity records stored in journaled arenas.
⋮
│macro_rules! id_type {
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
│    /// Cached triangulation: indices into the concatenation of `outer` and `holes`,
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
⋮
│pub struct Instance {
│    pub definition: DefId,
│    /// The definition this instance is placed in.
│    pub parent: DefId,
│    pub transform: Mat4,
│    pub name: String,
│    pub material: Option<MatId>,
│    pub tag: Option<TagId>,
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
│        d.set_definition(DefId(0), Some(Definition { name: "Model".into(), kind: DefKind::Root }));
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

kernel/src/format.rs:
# The `.builder` file format, version 1. See docs/file-format.md.
⋮
│struct File {
│    format: String,
│    version: u32,
│    units: String,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    generator: Option<String>,
│    definitions: Vec<FileDefinition>,
│    #[serde(default)]
│    instances: Vec<FileInstance>,
│    #[serde(default)]
⋮
│struct FileDefinition {
│    name: String,
│    kind: DefKind,
│    #[serde(default)]
│    vertices: Vec<[f64; 3]>,
│    #[serde(default)]
│    edges: Vec<[u32; 2]>,
│    #[serde(default)]
│    faces: Vec<FileFace>,
⋮
│struct FileFace {
│    outer: Vec<u32>,
│    #[serde(default, skip_serializing_if = "Vec::is_empty")]
│    holes: Vec<Vec<u32>>,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    material: Option<u32>,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    back_material: Option<u32>,
⋮
│struct FileInstance {
│    definition: u32,
│    parent: u32,
│    transform: Vec<f64>,
│    #[serde(default, skip_serializing_if = "String::is_empty")]
│    name: String,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    material: Option<u32>,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    tag: Option<u32>,
⋮
│impl Document {
│    /// Serialize to `.builder` JSON. Ids are compacted; the root definition is 0.
│    pub fn to_json(&self) -> String {
│        let mut def_ids: Vec<DefId> = vec![ROOT];
│        def_ids.extend(self.definitions.iter().map(|(i, _)| DefId(i as u32)).filter(|&d| d != ROOT)
│        let def_index: HashMap<DefId, u32> =
│            def_ids.iter().enumerate().map(|(i, &d)| (d, i as u32)).collect();
│        let mat_ids: Vec<MatId> = self.materials.iter().map(|(i, _)| MatId(i as u32)).collect();
│        let mat_index: HashMap<MatId, u32> =
│            mat_ids.iter().enumerate().map(|(i, &m)| (m, i as u32)).collect();
│        let tag_ids: Vec<TagId> = self.tags.iter().map(|(i, _)| TagId(i as u32)).collect();
│        let tag_index: HashMap<TagId, u32> =
⋮
│    /// Read a `.builder` JSON document. Topology is rebuilt and validated.
│    pub fn from_json(text: &str) -> Result<Document, Error> {
│        let file: File = serde_json::from_str(text).map_err(|e| Error::Format(e.to_string()))?;
│        if file.format != FORMAT {
│            return Err(Error::Format(format!("not a Builder file (format is {:?})", file.format)));
│        }
│        if file.version > VERSION {
│            return Err(Error::Format(format!(
│                "file version {} is newer than this app understands ({VERSION})",
│                file.version
│            )));
⋮
│/// True if the parent → child definition graph has a cycle.
│fn has_cycle(n: usize, links: impl Iterator<Item = (usize, usize)>) -> bool {
│    let mut children = vec![Vec::new(); n];
│    for (p, c) in links {
│        children[p].push(c);
│    }
│    // 0 = unvisited, 1 = on the current path, 2 = done.
│    let mut state = vec![0u8; n];
│    fn visit(d: usize, children: &[Vec<usize>], state: &mut [u8]) -> bool {
│        match state[d] {
│            1 => return true,
│            2 => return false,
│            _ => {}
│        }
│        state[d] = 1;
│        if children[d].iter().any(|&c| visit(c, children, state)) {
│            return true;
│        }
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
│        let (def, parent, m) = (instance.definition, instance.parent, instance.transform);
│        let mut out = Exploded::default();
│
│        let mut vmap: HashMap<VId, VId> = HashMap::new();
│        let verts: Vec<(VId, V3)> = self.vertices_in(def).map(|(id, v)| (id, v.pos)).collect();
│        for (id, p) in verts {
│            let nv = self.vertex_at(parent, mat_apply(&m, p));
│            vmap.insert(id, nv);
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
│        self.set_instance(inst, None);
│        if self.instances_of(def).count() == 0 {
│            let children: Vec<InstId> = self.instances_in(def).map(|(i, _)| i).collect();
│            for c in children {
│                self.erase_instance(c)?;
│            }
│            self.delete_definition_contents(def);
│            self.set_definition(def, None);
⋮
│    pub fn set_transform(&mut self, inst: InstId, m: Mat4) -> Result<(), Error> {
│        let mut x = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
│        x.transform = m;
│        self.set_instance(inst, Some(x));
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

survey/src/builder_survey/build.py:
⋮
│def build(project_dir, plan=None):
⋮

survey/src/builder_survey/capture/serve.py:
# Measure app server: serves the iPad page and saves answers into the project.
⋮
│HERE = Path(__file__).resolve().parent
│ROOT = PHOTOS = OUT = CHECKLIST = NAME = None   # set by serve() from --project
│PORT = 8000
│
│EXT = {"image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif"}
│
⋮
│def load_items():
⋮
│def answers():
⋮
│def decode(data_url):
⋮
│class Handler(BaseHTTPRequestHandler):
│    def send(self, code, body, ctype):
│        self.send_response(code)
│        self.send_header("Content-Type", ctype)
│        self.send_header("Content-Length", str(len(body)))
│        self.send_header("Cache-Control", "no-store")
│        self.end_headers()
⋮
│    def send_json(self, obj, code=200):
⋮
│    def do_GET(self):
⋮
│    def do_POST(self):
⋮
│    def unref(self):
⋮
│    def log_message(self, fmt, *args):
⋮
│def serve(project, port=PORT):
⋮

survey/src/builder_survey/cli.py:
# survey build | render | capture, each with --project DIR.
⋮
│BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
│
⋮
│def main():
⋮

survey/src/builder_survey/elements.py:
# The element record every generator produces.
⋮
│def element(name, phase, material, ctx, parts, *, kind, notes=None):
⋮

survey/src/builder_survey/export/__init__.py

survey/src/builder_survey/export/mesh.py:
# mesh.json: triangle meshes and finishes for the Blender build.
⋮
│def write_mesh_json(out, elements, cams, face, ceilings, daylight):
⋮

survey/src/builder_survey/materials.py:
# The material library: name -> RGB. Includes house-specific ones (walnut, iron,
⋮
│MATERIALS = {  # name -> RGB
│    "block": (190, 190, 185),
│    "framed": (235, 225, 205),
│    "slab": (160, 160, 160),
│    "wood": (200, 160, 110),
│    "joist": (200, 160, 110),          # old floor framing; dark brown in renders
│    "sauna_wood": (225, 195, 150),
│    "glass": (200, 225, 235),
│    "glow": (255, 190, 110),           # LED strips; emit light in renders
│    "white_paint": (240, 240, 235),    # painted wood: stairs, window sashes, doors
⋮
│def rgb(name, alpha=1.0):
⋮

survey/src/builder_survey/project.py:
# A survey project: the directory that supplies the data and receives the outputs.
⋮
│CONFIG_KEYS = {"ruby_module", "sh3d_floor_z", "layout_pages"}
│
⋮
│class Project:
│    def __init__(self, root):
│        self.root = Path(root).resolve()
│        if not self.root.is_dir():
│            sys.exit(f"--project {root}: not a directory")
│        self.model = self.root / "model"
│        self.spec_path = self.model / "spec.yaml"
│        self.plans = self.model / "plans"
│        self.space = self.model / "space"
│        self.out = self.model / "out"
│        if not self.spec_path.is_file():
⋮
│    def load_spec(self):
⋮

survey/src/builder_survey/render/blender_build.py:
# Build the basement in Blender from out/mesh.json (written by survey build).
⋮
│OUT = None  # set in main() from --project
│INCH = 0.0254  # spec is in inches, Blender works in meters
│
│SCENES = {"before": ("existing", "demo"), "after": ("existing", "proposed")}
│
⋮
│def reset():
⋮
│def make_materials(spec):
⋮
│def _nodes(name):
⋮
│def _ramp(nt, fac, c0, c1, lo=0.3, hi=0.7):
⋮
│def _noise(nt, coord, scale, detail=6.0, rough=0.6):
⋮
│def _bump(nt, bsdf, height, strength, distance=0.002):
⋮
│def concrete(name, c0, c1, rough, bump):
⋮
│def block(name, face, mortar, rough, bump):
⋮
│def painted_block(name):
⋮
│def worn_paint_floor(name):
│    """Blue-grey floor paint scuffed through, as in the storage photo: bare
│    tan concrete in flaky patches (heavier in large areas), light dusty grey
⋮
│    def over(base, fac, color):
⋮
│    def where(large, fine, lo, hi):
⋮
│def pavers(name):
⋮
│def plain(name, color, rough, metallic=0.0):
⋮
│def wood(name, c0, c1):
⋮
│def pine(name):
⋮
│def glass(name):
⋮
│def glow(name, color, strength):
⋮
│def make_real_materials():
⋮
│def make_object(el, mats, coll, real=None):
⋮
│def add_ceilings(spec, real, scene):
⋮
│def add_daylight(spec, coll):
⋮
│def bounds(objs):
⋮
│def setup_view(scene, objs):
⋮
│def args():
⋮
│def use_device(scene, cpu):
⋮
│def render(scene, path):
⋮
│def add_camera(scene, name, at, look_at, lens):
⋮
│def main():
│    global OUT
⋮
│    def interior(on):
⋮

survey/src/builder_survey/spec/plan.py:
# Plans (plans/<name>.yaml) layer onto the spec without editing it.
⋮
│PLAN_SECTIONS = ("layout.fixtures", "layout.doors", "pipes", "joists", "objects", "cameras")
│
⋮
│def apply_plan(spec, name, plans_dir):
│    path = plans_dir / f"{name}.yaml"
⋮
│    def section(dotted, create):
⋮
│    def flatten(tree, prefix=""):
⋮

survey/tests/golden.py:
⋮
│def zip_members(path):
⋮
│def diff_dirs(label, gold, new):
⋮
│def main():
⋮
```

Call sites found at plan time (each is a modify task):

- `Face { .. }` literal: `kernel/src/topo.rs:119`; split-face carry-over `OldRegion` in `kernel/src/heal.rs:13`.
- `Definition { .. }` literals: `kernel/src/doc.rs:207`, `kernel/src/group.rs:47`, `kernel/src/format.rs:174`.
- `Instance { .. }` literal: `kernel/src/doc.rs:371` (`new_instance`).
- `Tag` is serialized directly in `kernel/src/format.rs:27,126,157`.
- `MATERIALS` / `rgb()`: `generate/pipes.py:7,124`, `export/sh3d.py:3,126`, `export/ruby.py:4,104`, `export/mesh.py:5,11`, `export/dae.py:3,19,24`, `export/check_plan.py:69`, `export/previews.py:20-74`.
- Hard-coded output names: `export/ruby.py:107`, `export/dae.py:64`, `export/sh3d.py:138,156`, `build.py:47`, `render/blender_build.py:710-711`.
- Hard-coded out dir: `project.py:36`, `build.py:38`, `render/blender_build.py:627-629`.
- `Project(...)`: `build.py:35`, `capture/serve.py:158`.

## Summary

This spec defines five contracts: the survey project settings that remove the house from the toolkit (output stem, out dir, spec materials), the attributes and tag lock in Builder's kernel, wasm API and `.builder` format, the `.builder` file survey writes, the Builder survey-mode UI with its Proposed → plan export, and the phone + voice capture entry with Mac-side transcription.

## Decisions

### Cited

- None. `.flux/decisions/` has no accepted ADRs yet.

### Proposed

- `mvr2ooxl` Survey code lives in the builder repo.
- `mvr2op7t` Namespaced attributes in the builder format (additive to v1; scalar values only).
- `mvr2opid` Tag lock enforced by the kernel.

**Settled in this spec (no ADR needed):**

- **Rust/WASM boundary.** Survey never calls the kernel. It writes `.builder` JSON from Python. The kernel checks those files through a small Rust example binary (`cargo run -p builder-kernel --example validate -- FILE`). The Proposed → plan export runs in the browser in TypeScript, over the open document, because that is where the drawn geometry is. The solver stays Python, so there is no survey crate.
- **Output names.** `survey.yaml` `output_stem` sets the file stem for `.dae`, `.sh3d`, `.rb`, `.builder` and `.blend`. When it is absent, the stem is the spec `name:` slugged (lowercase, runs of non-alphanumerics → `-`). 20SPierson sets `output_stem: basement`, so its file names, and the golden reference, do not change.
- **Out dir.** `survey.yaml` `out_dir` (relative to the project, default `model/out`) and `--out DIR` on `build` and `render`; the flag wins. Plans keep going to `<out>/plans/NAME/`.
- **Materials.** The toolkit library keeps the generic materials. A spec `materials:` section adds or overrides entries by name, with an RGB colour and an optional Blender recipe drawn from the toolkit's generic recipes. The house materials move to 20SPierson's spec. `mesh.json` carries the merged table, and Blender reads recipes from it instead of its own house list.
- **`kind` in mesh.json.** Each element record in `mesh.json` gains `"kind"`. That is an explained golden difference.
- **`survey/uv.lock`.** It is kept and committed. `survey/` is its own uv project with a CLI, and the lock makes `uv run` in builder reproducible. A house project's own lock still governs its environment.
- **Golden coverage.** `golden.py` compares every output file, the `.builder` file byte for byte included. When outputs change on purpose, the phase commit message lists each differing file with its reason. `golden.py --write` refreshes the reference directory after printing the differences. The 20SPierson conversation runs it on its side and commits the reference with that list. A run that shows differences nobody explained is a failure.
- **`.builder` geometry.** Each element is one group, named by the element and tagged by phase. Each part is a child group inside it, so parts never weld to each other. Prisms become polygon faces: the top and bottom loops and the side quads, with the top triangulated when it is not planar. Cylinders become 16-segment prisms along their axis. `mesh` parts become their triangles. The element's material is the group instance's material, which keeps `placeholder` orange and `proposed` blue as they look in the renders. Per-face finishes are not exported (mesh.json and Blender keep them).
- **Provenance attributes.** `survey:kind`, `survey:approx` (bool), `survey:base_material`, `survey:phase`, and `survey:source` when the spec entry has a `source:` key (a `measurements/...` path). `source:` is a new, optional spec key, and the build checks that its folder exists. Turning today's YAML comments into `source:` keys is a 20SPierson edit and is not inferred by the toolkit.
- **Survey mode.** A file is a survey model when it has the tags `Existing`, `Demo` and `Proposed`. Survey mode then makes `Proposed` the active tag (new groups go on it), locks `Existing` and `Demo` on open (the lock is saved in the file by survey), shows a tag strip with visibility checkboxes and lock state, and shows a read-only attribute panel for the selection. Material colours are rendered for every model, since survey mode needs them and Milestone 3.5 would need them anyway.
- **Proposed → plan.** Only groups on `Proposed` whose geometry is an axis-aligned box (six faces, each normal on an axis) are exported, as `add: objects: NAME: {type: box, at: [e, s, z], size: [W, L, H], material}`. `at` is the corner with the least east, least south and lowest z: east = x, south = −y, so the least south comes from the largest y. The NAME comes from the group name, or `proposed_N`. Anything else on `Proposed` is listed by name in a message and left out. The file downloads as `NAME.yaml` for `model/plans/`.
- **Capture transport.** The phone records in the page with `MediaRecorder`, which iOS Safari only allows on HTTPS. `survey capture` serves HTTPS with a certificate from `mkcert` (Homebrew; its root CA is installed on the iPhone once) when `--cert`/`--key` or `survey.yaml` `capture_tls: {cert, key}` are set, and plain HTTP otherwise, with a page banner saying recording is unavailable.
- **Transcription.** `faster-whisper` (model `small.en` by default, `survey.yaml` `transcribe_model`) runs on the Mac in a background thread after each save. It lives in the optional dependency group `transcribe` (`uv sync --extra transcribe`). It writes `transcript.txt` and sets `entry.json` `transcript`. If the package is missing, the entry is saved with `"transcript_error"` set and the server logs it. Nothing is invented in its place.
- **Entry → model.** As today: a Claude session reads the entries and takes numbers into the spec, citing the folder (now also through `source:`). `survey entries --project DIR` lists entries with their transcripts, marking each one cited or not by whether its folder path appears in `spec.yaml` or `model/plans/*.yaml`.

## Technical Specifications

### Interfaces

Survey (Python):

```python
# project.py
CONFIG_KEYS = {"ruby_module", "sh3d_floor_z", "layout_pages", "output_stem", "out_dir",
               "capture_tls", "transcribe_model"}

class Project:
    def __init__(self, root: Path, out: Path | None = None): ...
    root: Path; model: Path; spec_path: Path; plans: Path; space: Path
    out: Path                      # --out, else survey.yaml out_dir, else model/out
    measurements: Path; photos: Path; checklist: Path
    def load_spec(self) -> dict: ...
    def stem(self, spec: dict) -> str: ...   # output_stem or slug(spec["name"])

# materials.py
LIBRARY: dict[str, dict]           # name -> {"color": (r, g, b), "render": {recipe: args}?}
def material_table(spec: dict) -> dict[str, dict]: ...   # LIBRARY merged with spec materials:
def rgb(table: dict, name: str, alpha: float = 1.0) -> tuple[float, float, float, float]: ...

# build.py
def build(project_dir: Path, plan: str | None = None, out: Path | None = None) -> None: ...

# export/*: each writer takes the stem and the material table
def write_ruby(out: Path, stem: str, name: str, module: str, elements: list, mats: dict) -> None: ...
def write_dae(out: Path, stem: str, name: str, elements: list, mats: dict) -> None: ...
def write_sh3d(out: Path, stem: str, elements: list, floor_z: float, appliances: set, mats: dict) -> tuple: ...
def write_mesh_json(out: Path, elements, cams, face, ceilings, daylight, mats: dict) -> None: ...
def write_builder(out: Path, stem: str, name: str, elements: list, mats: dict) -> None: ...   # export/builder.py

# elements.py: element() gains source
def element(name, phase, material, ctx, parts, *, kind, notes=None, source=None) -> dict: ...

# render/blender_build.py
RECIPES: dict[str, Callable]       # concrete, block, painted_block, worn_paint_floor, pavers, plain, wood, pine, glass, glow
def make_real_materials(table: dict) -> dict: ...

# capture/serve.py
def serve(project: Path, port: int = 8000, cert: Path | None = None, key: Path | None = None) -> None: ...
# capture/transcribe.py
def transcribe(entry_dir: Path, model: str) -> None: ...     # writes transcript.txt, updates entry.json
# capture/entries.py
def list_entries(project: Project) -> list[dict]: ...      # {folder, saved, question, transcript, cited}

# cli.py
#   survey build   --project DIR [--plan NAME] [--out DIR]
#   survey render  --project DIR [--out DIR] [--blender PATH] -- [options]
#   survey capture --project DIR [--port N] [--cert FILE --key FILE]
#   survey entries --project DIR [--uncited]

# tests/golden.py
#   golden.py --golden DIR --project DIR [--extra-plan FILE] [--write]
```

Kernel (Rust):

```rust
// doc.rs
pub type AttrValue = serde_json::Value;            // only String, Number, Bool accepted
pub type Attributes = BTreeMap<String, BTreeMap<String, AttrValue>>;
pub struct Face { /* existing fields */ pub attributes: Attributes }
pub struct Definition { /* existing */ pub attributes: Attributes }
pub struct Instance { /* existing */ pub attributes: Attributes }
pub struct Tag { pub name: String, pub visible: bool, #[serde(default)] pub locked: bool }

pub enum AttrTarget { Definition(DefId), Instance(InstId), Face(FId) }
impl Document {
    pub fn attributes(&self, t: AttrTarget) -> Option<&Attributes>;
    pub fn set_attribute(&mut self, t: AttrTarget, ns: &str, key: &str, v: Option<AttrValue>) -> Result<(), Error>;
    pub fn new_tag(&mut self, name: &str) -> TagId;
    pub fn set_tag(&mut self, inst: InstId, tag: Option<TagId>) -> Result<(), Error>;
    pub fn set_tag_flags(&mut self, tag: TagId, visible: bool, locked: bool) -> Result<(), Error>;
    pub fn is_locked_def(&self, def: DefId) -> bool;    // any instance of def (or an ancestor) on a locked tag
}
// lib.rs
pub enum Error { /* existing */ Locked, Attribute(String) }
// Locked check at entry of: add_line, push_pull, move_vertices, erase, erase_instance,
// make_group, explode, set_transform (by the target definition / instance)

// heal.rs
pub struct OldRegion { /* existing */ pub attributes: Attributes }

// kernel/examples/validate.rs: reads FILE, Document::from_json, prints counts or the error, exit 1 on error
```

WASM (`kernel-wasm/src/lib.rs`), `kind` is `"definition" | "instance" | "face"`:

```rust
pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError>;      // JSON object
pub fn set_attribute(&mut self, kind: &str, id: u32, ns: &str, key: &str, value_json: &str) -> Result<(), JsError>; // "null" deletes
pub fn tags(&self) -> String;                                                  // JSON [{id,name,visible,locked}]
pub fn new_tag(&mut self, name: &str) -> u32;
pub fn set_instance_tag(&mut self, inst: u32, tag: i32) -> Result<(), JsError>; // -1 clears
pub fn set_tag_flags(&mut self, tag: u32, visible: bool, locked: bool) -> Result<(), JsError>;
pub fn instance_props(&self, inst: u32) -> String;                             // JSON {name, tag, material}
pub fn materials(&self) -> String;                                             // JSON [{id,name,color,opacity}]
pub fn face_materials(&self, def: u32) -> Vec<i32>;                            // per face id in buffers order, -1 none
pub fn definition_name(&self, def: u32) -> String;
```

App (TypeScript):

```ts
// kernel/model.ts
export type AttrKind = "definition" | "instance" | "face";
export type Attributes = Record<string, Record<string, string | number | boolean>>;
export interface TagInfo { id: number; name: string; visible: boolean; locked: boolean }
export interface MaterialInfo { id: number; name: string; color: [number, number, number]; opacity: number }
class Model {
  attributes(kind: AttrKind, id: number): Attributes;
  setAttribute(kind: AttrKind, id: number, ns: string, key: string, v: string | number | boolean | null): void;
  tags(): TagInfo[];
  newTag(name: string): number;
  setInstanceTag(inst: number, tag: number | null): void;
  setTagFlags(tag: number, visible: boolean, locked: boolean): void;
  instanceProps(inst: number): { name: string; tag: number | null; material: number | null };
  materials(): MaterialInfo[];
}
// view/scene.ts: DrawItem gains `tag: number | null`, `material: number | null`, `locked: boolean`;
// SceneIndex.build skips items whose tag (or an ancestor's) is hidden; per-triangle colour
// = face material ?? nearest instance material ?? theme face colour.
// survey/mode.ts
export function isSurveyModel(m: Model): boolean;
export class SurveyPanel { constructor(app: App); update(): void }   // tag strip + attribute view
// survey/plan-export.ts
export interface PlanExport { yaml: string; skipped: string[] }
export function exportProposed(m: Model, planName: string): PlanExport;
```

### Data Models

`.builder` additions (version stays 1):

```json
{
  "definitions": [{ "name": "garage west wall", "kind": "group", "vertices": [], "edges": [], "faces": [],
                    "attributes": { "survey": { "kind": "wall", "approx": false, "phase": "existing",
                                                "base_material": "block",
                                                "source": "measurements/2026-10-23/103127-zone_b_return" } } }],
  "instances": [{ "definition": 1, "parent": 0, "transform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
                  "name": "garage west wall", "material": 0, "tag": 0 }],
  "tags": [{ "name": "Existing", "visible": true, "locked": true },
           { "name": "Demo", "visible": true, "locked": true },
           { "name": "Proposed", "visible": true, "locked": false }]
}
```

Survey writes element attributes on the element's definition. Part groups carry none. `generator` is `"builder-survey <version>"`. Coordinates are written as given (inches, x east, y north, z up). Floats are rounded to 1e-6 inch and keys are sorted, so the output is deterministic.

Spec `materials:` (20SPierson; colours from today's `MATERIALS`, recipes from today's `make_real_materials`):

```yaml
materials:
  walnut: {color: [110, 70, 40], render: {wood: [[0.035, 0.018, 0.009], [0.07, 0.036, 0.018]]}}
  worn grey paint: {render: {worn_paint_floor: []}}   # finish-only: no colour needed
```

`entry.json` (capture v2; v1 entries with `values` still read):

```json
{ "id": "zone_b_return", "saved": "2026-11-03T10:01:08", "question": "Return pipe height at the west wall",
  "photos": ["photo-1.jpg"], "audio": "note.m4a", "transcript": "...", "marks": [], "base": null }
```

`checklist.yaml` v2: `items: [{id, question, photo?}]`. Items with `fields:` (v1) are still shown, with their fields read-only.

Plan export (`model/plans/NAME.yaml`):

```yaml
description: drawn in Builder 2026-11-02
add:
  objects:
    vanity: {type: box, at: [24', 30', 0"], size: [30", 21", 34"], material: proposed, phase: proposed}
```

### Examples

```bash
uv run survey build --project ../20SPierson                    # writes basement.builder too
cargo run -p builder-kernel --example validate -- ../20SPierson/model/out/basement.builder
# 214 definitions, 213 instances, 3 tags: ok
uv run survey capture --project ../20SPierson --cert ~/certs/mac.pem --key ~/certs/mac-key.pem
uv run survey entries --project ../20SPierson --uncited
uv run python survey/tests/golden.py --golden ../20SPierson/tests/golden --project ../20SPierson \
    --extra-plan survey/tests/plans/testplan.yaml --write
```

```ts
const { yaml, skipped } = exportProposed(app.model, "vanity");
if (skipped.length) app.flash(`Not exported: ${skipped.join(", ")}`);
```

## Validation Criteria

```bash
cargo test --workspace                 # attribute round-trip, undo, lock refusals, format v1 compat
uv run --project survey pytest survey/tests   # stem, materials, part -> faces, plan round trip, capture
npm test                               # scene tag/material colour, survey mode, plan export
npx tsc --noEmit
cd ../20SPierson && uv run survey build --project . && uv run survey build --project . --plan testplan
cargo run -p builder-kernel --example validate -- ../20SPierson/model/out/basement.builder   # base and plan
uv run python ../builder/survey/tests/golden.py --golden tests/golden --project . \
    --extra-plan ../builder/survey/tests/plans/testplan.yaml          # 0 differences after the reference update
grep -rniE "pierson|basement" survey/src                              # nothing
```

End to end (manual, browser): open `basement.builder`. Existing and Demo are locked: Move, Push/Pull and Erase on a wall show "Locked". Hide and show each tag. Select a `~` element: it is orange and its panel shows `survey:approx: true`. Draw a box, group it (it lands on Proposed) and export the plan. `survey build --plan` then builds it at the same place, checked by reading the vanity corner in `report.md`/`mesh.json`.

Capture (on an iPhone, on Patrick's return): photo + voice note saved over HTTPS, `transcript.txt` appears, and `survey entries --uncited` lists it. A Claude session takes the number into the spec with `source:`, rebuilds, and the change shows in Builder.
