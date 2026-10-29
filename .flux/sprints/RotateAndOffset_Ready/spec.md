# Specification: RotateAndOffset

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time (2026-10-29, commit b7a6b67). Close Gate 2 diffs the finished code against this and the Interfaces section below.

`flux repomap kernel/src/edit.rs kernel/src/group.rs kernel/src/math.rs kernel/src/lib.rs kernel/tests/common/fuzz.rs kernel/tests/fuzz.rs kernel-wasm/src/lib.rs app/src/kernel/model.ts app/src/tools/move.ts app/src/tools/tool.ts app/src/units.ts app/src/math.ts app/src/app.ts`

New files this sprint (not in the map): `kernel/src/offset.rs`, `kernel/tests/rotate.rs`, `kernel/tests/offset.rs`, `app/src/tools/rotate.ts`, `app/src/tools/offset.ts`, `app/src/tools/copies.ts`, `app/test/rotate.test.ts`, `app/test/offset.test.ts`, `app/test/deck.test.ts`, `docs/walkthrough-deck.md`. Also modified but unmapped: `app/test/toolhost.ts` (gains `toWorld`, `toWorldDir`), `app/index.html` (two toolbar buttons), `kernel/tests/copy.rs`, `app/test/tools.test.ts`, `app/test/math.test.ts`, `app/test/units.test.ts`.

```
app/src/app.ts:
# The application shell: owns the model, the active editing context, selection,
⋮
│function copyKey(ev: KeyboardEvent | MouseEvent): boolean {
│  return /Mac|iPhone|iPad/.test(navigator.platform) ? ev.altKey : ev.ctrlKey;
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
│  constructor(store = new AutosaveStore()) {
│    this.store = store;
│    this.autosaver = new Autosaver({ store, onError: (e) => this.flash(`Autosave failed: ${errorMes
│    this.view = new Viewport($("view"));
│    this.inference = new InferenceEngine(() => this.pickScene, this.camera);
│    const nav = () => this.cameraChanged();
│    this.tools = {
│      select: new SelectTool(this),
│      line: new LineTool(this),
│      rectangle: new RectangleTool(this),
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
│      this.updateHeader();
│      this.survey.update();
│    }
│    this.view.setScene(this.drawScene);
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
│    this.view.canvas.style.cursor = this.tool.cursor;
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
│  loadModel(model: Model, name: string, opts: { saved?: boolean } = {}): void {
│    const saved = opts.saved ?? true;
│    this.tool?.deactivate();
│    this.model = model;
│    this.fileName = name;
│    this.ctx = ROOT;
│    this.ctxMatrix = IDENTITY;
│    this.ctxInverse = IDENTITY;
│    $("context").hidden = true;
│    this.selection.clear();
⋮
│  async offerRestore(candidate: Version | undefined): Promise<boolean> {
│    if (!candidate) return false;
│    const when = new Date(candidate.time).toLocaleString();
│    if (!confirm(`Restore ${candidate.fileName} autosaved ${when} after ${candidate.operation}?`)) 
│      await this.store.setDirty(false);
│      return false;
│    }
│    try {
│      this.loadModel(Model.fromJson(candidate.json), candidate.fileName, { saved: false });
│      this.flash(`Restored ${candidate.fileName} as of ${when}`);
⋮
│  async showVersions(): Promise<void> {
│    const list = $("versionList");
│    list.replaceChildren();
│    const versions = await this.store.list();
│    if (!versions.length) {
│      const li = document.createElement("li");
│      li.className = "muted";
│      li.textContent = "No autosaves yet";
│      list.append(li);
│    }
⋮
│  private async openVersion(id: number): Promise<void> {
│    if (!this.confirmDiscard()) return;
│    const v = await this.store.get(id);
│    if (!v) return this.flash("That version has been dropped from the ring");
│    try {
│      this.loadModel(Model.fromJson(v.json), v.fileName, { saved: false });
│      this.flash(`Opened ${v.fileName} as of ${new Date(v.time).toLocaleString()}`);
│    } catch (e) {
│      this.flash(errorMessage(e));
│    }
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
│      this.offerReport(e);
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
│  private intersect(withModel: boolean): void {
│    const faces = this.selection.ids("face");
│    const insts = this.selection.ids("instance");
│    if (!faces.length && !insts.length) return this.flash("Select faces or groups to intersect firs
│    try {
│      const edges = this.model.transact("Intersect Faces", () => this.model.intersectFaces(this.ctx
│      this.refresh();
│      this.flash(edges.length ? `Intersect: ${edges.length} edge${edges.length === 1 ? "" : "s"} dr
│    } catch (e) {
│      this.offerReport(e);
⋮
│  private checkModel(): void {
│    const findings = this.model.checkModel();
│    if (!findings.length) return this.flash("Model check: clean");
│    const list = $("findingList");
│    list.replaceChildren(
│      ...findings.map((f) => {
│        const li = document.createElement("li");
│        li.textContent = describeFinding(f);
│        return li;
│      }),
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
│    void this.autosaver.markClean();
│    this.updateHeader();
⋮
│  private async open(file: File): Promise<void> {
│    try {
│      const model = Model.fromJson(await file.text());
│      this.loadModel(model, file.name);
│      this.flash(`Opened ${file.name}`);
│    } catch (e) {
│      this.offerReport(e);
│    }
⋮
│  private offerReport(e: unknown): void {
│    this.flash(errorMessage(e));
│    if (!confirm(`${errorMessage(e)}\n\nSave a problem report?`)) return;
│    const report = buildReport(this.model, this.fileName, e);
│    const blob = new Blob([JSON.stringify(report)], { type: "application/json" });
│    const a = document.createElement("a");
│    a.href = URL.createObjectURL(blob);
│    a.download = reportFileName(this.fileName);
│    a.click();
│    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
│  private updateHeader(): void {
│    $("fileName").textContent = this.fileName;
│    $("unsaved").hidden = this.model.revision === this.savedRevision;
⋮
│  private updateButtons(): void {
│    $<HTMLButtonElement>("undoBtn").disabled = !this.model.canUndo();
│    $<HTMLButtonElement>("redoBtn").disabled = !this.model.canRedo();
│    $<HTMLButtonElement>("groupBtn").disabled = this.selection.empty;
│    $<HTMLButtonElement>("explodeBtn").disabled = !this.selection.ids("instance").length;
│    const nothingToCut = !this.selection.ids("face").length && !this.selection.ids("instance").leng
│    $<HTMLButtonElement>("intersectModelBtn").disabled = nothingToCut;
│    $<HTMLButtonElement>("intersectSelBtn").disabled = nothingToCut;
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
│export function describeFinding(f: Finding): string {
│  const kind = f.kind.replace(/_/g, " ");
│  const ids = [
│    f.faces.length ? `faces ${f.faces.join(", ")}` : "",
│    f.edges.length ? `edges ${f.edges.join(", ")}` : "",
│    f.vertices.length ? `vertices ${f.vertices.join(", ")}` : "",
│  ]
│    .filter(Boolean)
│    .join("; ");
│  const at = f.position.map((x) => Math.round(x * 1000) / 1000).join(", ");
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
│export interface Finding {
│  kind: "overlapping_edges" | "non_planar_face" | "faceless_edge" | "duplicate_vertices";
│  owner: number;
│  faces: number[];
│  edges: number[];
│  vertices: number[];
│  /** A point near the problem, in the owner definition's coordinates. */
│  position: Vec3;
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
│  /** Name passed to the last begin(); the label autosave uses. */
│  lastOperation = "";
│  /** Names of the last transactions begun, oldest first, at most JOURNAL_SIZE.
│   *  A problem report carries them; they are names, not replayable operations. */
│  readonly journal: string[] = [];
│  /** Called after commit() returns true and after undo()/redo() return a name,
⋮
│  constructor(kernel?: Kernel) {
│    this.k = kernel ?? new Kernel();
⋮
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
│    this.lastOperation = name;
│    this.journal.push(name);
│    if (this.journal.length > JOURNAL_SIZE) this.journal.shift();
│    this.k.begin(name);
│  }
│  commit(): boolean {
│    const committed = this.changed(this.k.commit());
│    if (committed) this.onCommit?.(this.lastOperation);
│    return committed;
│  }
│  abort(): void {
│    this.changed(this.k.abort());
│  }
│  undo(): string | undefined {
│    const name = this.changed(this.k.undo());
│    if (name !== undefined) this.onCommit?.(`Undo ${name}`);
│    return name;
│  }
│  redo(): string | undefined {
│    const name = this.changed(this.k.redo());
│    if (name !== undefined) this.onCommit?.(`Redo ${name}`);
│    return name;
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
⋮
│  moveAndIntegrate(verts: number[], d: Vec3): void {
│    this.changed(this.k.moveAndIntegrate(u32(verts), d[0], d[1], d[2]));
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
│  copyGeometry(ctx: number, faces: number[], edges: number[], d: Vec3): { faces: number[]; edges: n
│    return this.changed(JSON.parse(this.k.copyGeometry(ctx, u32(faces), u32(edges), d[0], d[1], d[2
⋮
│  copyInstance(inst: number, d: Vec3): number {
│    return this.changed(this.k.copyInstance(inst, d[0], d[1], d[2]));
⋮
│  intersectFaces(ctx: number, faces: number[], instances: number[], withModel: boolean): number[] {
│    return this.changed(Array.from(this.k.intersectFaces(ctx, u32(faces), u32(instances), withModel
⋮
│  checkModel(): Finding[] {
│    return JSON.parse(this.k.checkModel());
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

app/src/math.ts:
# Small 3D math used by tools, inference and picking. Pure functions over plain
⋮
│export type Vec3 = [number, number, number];
│/** Column-major 4×4, the same layout as Three.js `Matrix4.elements` and the kernel. */
│export type Mat4 = number[];
│
⋮
│export function norm(a: Vec3): Vec3 {
│  const l = len(a);
│  return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0];
⋮
│export interface Ray {
│  origin: Vec3;
│  dir: Vec3; // unit
⋮
│export interface Plane {
│  normal: Vec3; // unit
│  d: number; // normal · p = d
⋮
│export function rayPlane(ray: Ray, plane: Plane): Vec3 | null {
│  const den = dot(ray.dir, plane.normal);
│  if (Math.abs(den) < 1e-9) return null;
│  const t = (plane.d - dot(ray.origin, plane.normal)) / den;
│  if (t < 0) return null;
│  return madd(ray.origin, ray.dir, t);
⋮
│export function projectToPlane(p: Vec3, plane: Plane): Vec3 {
│  return madd(p, plane.normal, plane.d - dot(plane.normal, p));
⋮
│export function lineRayParam(p0: Vec3, u: Vec3, ray: Ray): number | null {
│  const w0 = sub(p0, ray.origin);
│  const a = dot(u, u);
│  const b = dot(u, ray.dir);
│  const c = dot(ray.dir, ray.dir);
│  const d = dot(u, w0);
│  const e = dot(ray.dir, w0);
│  const den = a * c - b * b;
│  if (Math.abs(den) < 1e-10 * a * c) return null;
│  return (b * e - c * d) / den;
⋮
│export function rayTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
│  const e1 = sub(b, a);
│  const e2 = sub(c, a);
│  const p = cross(ray.dir, e2);
│  const det = dot(e1, p);
│  if (Math.abs(det) < 1e-12) return null;
│  const inv = 1 / det;
│  const s = sub(ray.origin, a);
│  const u = dot(s, p) * inv;
│  if (u < -1e-9 || u > 1 + 1e-9) return null;
⋮
│export function planeBasis(n: Vec3): [Vec3, Vec3] {
│  const u: Vec3 = Math.abs(n[2]) > 1 - 1e-9 ? [1, 0, 0] : norm(cross(Z, n));
│  return [u, cross(n, u)];
⋮
│export function translation(t: Vec3): Mat4 {
│  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
⋮
│export function mul(a: Mat4, b: Mat4): Mat4 {
│  const r = new Array<number>(16).fill(0);
│  for (let col = 0; col < 4; col++)
│    for (let row = 0; row < 4; row++) {
│      let s = 0;
│      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[col * 4 + k];
│      r[col * 4 + row] = s;
│    }
│  return r;
⋮
│export function apply(m: Mat4, p: Vec3): Vec3 {
│  return [
│    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
│    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
│    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
│  ];
⋮
│export function applyDir(m: Mat4, d: Vec3): Vec3 {
│  return [
│    m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
│    m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
│    m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
│  ];
⋮
│export function invert(m: Mat4): Mat4 {
│  const [a, d, g] = [m[0], m[1], m[2]];
│  const [b, e, h] = [m[4], m[5], m[6]];
│  const [c, f, i] = [m[8], m[9], m[10]];
│  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
│  if (Math.abs(det) < 1e-12) return [...IDENTITY];
│  const k = 1 / det;
│  // Row-major inverse of the 3×3 part.
│  const r = [
│    (e * i - f * h) * k, (c * h - b * i) * k, (b * f - c * e) * k,
⋮

app/src/tools/move.ts:
⋮
│interface Moving {
│  base: Vec3;
│  verts: number[];
│  instances: { id: number; transform: Mat4 }[];
│  /** Last offset the kernel accepted. */
│  good: Vec3;
│  /** Commit as a copy instead of a move. Toggled by the copy modifier until commit. */
│  copy: boolean;
│  /** The faces and edges the copy duplicates (instances come from `instances`). */
│  selection: Selected;
⋮
│interface Selected {
│  faces: number[];
│  edges: number[];
│  instances: number[];
⋮
│interface LastCopy {
│  /** What was copied, in the context it was copied in. */
│  selection: Selected;
│  /** The committed offset in world coordinates. */
│  offset: Vec3;
│  /** Copies made by the last array replay, or 1 after a plain copy. */
│  count: number;
│  /** `model.revision` right after the Copy commit (or array replay); a later
│   *  change to the model means the last Copy is no longer the top undo step. */
│  revision: number;
⋮
│export class MoveTool implements Tool {
│  readonly id = "move";
│  private moving: Moving | null = null;
│  private current: Inference | null = null;
│  private last: { base: Vec3; dir: Vec3; copy: boolean; selection: Selected } | null = null;
│  private lastCopy: LastCopy | null = null;
│  /** The copy modifier as last reported while nothing was moving. */
│  private pendingCopy = false;
│
│  constructor(private host: ToolHost) {}
│
│  get cursor(): string {
│    return this.moving?.copy ? "copy" : "move";
⋮
│  hint(): string {
│    if (this.moving?.copy) return "Click to place the copy, or type a distance. Then type 5x or /5 
│    return this.moving
│      ? "Click to place, or type a distance. Arrow keys lock an axis."
│      : "Click a point on the selection (or on what you hover) to pick it up. Hold Ctrl (Option on 
⋮
│  modifier(copy: boolean): void {
│    if (this.moving) this.moving.copy = copy;
│    else this.pendingCopy = copy;
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
│    this.lastCopy = null;
│    this.pendingCopy = false;
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
│  private start(base: Vec3, faces: number[], edges: number[], instances: number[], copy = false): v
│    const { model, ctx } = this.host;
│    this.lastCopy = null;
│    const verts = model.verticesOf(faces, edges);
│    const all = model.instances(ctx);
│    const insts = instances.map((id) => ({ id, transform: all.find((i) => i.id === id)?.transform ?
│    if (!verts.length && !insts.length) return;
│    const selection = { faces, edges, instances };
│    this.moving = { base, verts, instances: insts, good: [0, 0, 0], copy, selection };
│    this.last = { base, dir: [0, 0, 0], copy, selection };
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
│    const spec = parseArray(text);
│    if (spec) return this.array(spec);
│    const d = parseLength(text, this.host.units);
│    if (!Number.isFinite(d)) return this.host.flash("Type a distance like 8' or 30\"");
│    if (this.moving) {
│      const dir = norm(this.moving.good);
│      if (dist([0, 0, 0], dir) < 0.5) return this.host.flash("Move the cursor to pick a direction f
│      this.apply(madd([0, 0, 0], dir, d));
│      this.commit();
⋮
│  private array(spec: ArraySpec): void {
│    if (!this.copyIsLastStep()) return;
│    const lc = this.lastCopy!;
│    const { model } = this.host;
│    const offsets: Vec3[] = [];
│    for (let k = 1; k <= spec.n; k++) offsets.push(madd([0, 0, 0], lc.offset, spec.kind === "times"
│    model.undo();
│    if (this.makeCopies(lc.selection, offsets)) {
│      this.lastCopy = { ...lc, count: spec.n, revision: model.revision };
│    } else {
⋮
│  private copyIsLastStep(): boolean {
│    if (this.lastCopy && this.host.model.revision === this.lastCopy.revision) return true;
│    this.lastCopy = null;
│    this.host.flash("Copy something first");
│    return false;
⋮
│  private makeCopies(sel: Selected, offsets: Vec3[]): Entity[] | null {
│    const { model, ctx } = this.host;
│    try {
│      const made: Entity[] = [];
│      model.transact("Copy", () => {
│        for (const o of offsets) {
│          const local = this.host.toLocalDir(o);
│          if (sel.faces.length || sel.edges.length) {
│            const g = model.copyGeometry(ctx, sel.faces, sel.edges, local);
│            made.push(...g.faces.map((id) => ({ kind: "face" as const, id })), ...g.edges.map((id) 
⋮
│  private commit(): void {
│    const m = this.moving!;
│    this.moving = null;
│    const { model } = this.host;
│    if (dist([0, 0, 0], m.good) < 1e-3) {
│      model.abort();
│    } else if (m.copy) {
│      // The preview moved the originals; put them back and make the copies.
│      model.abort();
│      if (this.makeCopies(m.selection, [m.good])) {
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
│  /** The copy modifier is held (Option on Mac, Ctrl elsewhere). */
│  copy: boolean;
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
│  /** The copy modifier went down or up while the tool is active (keyboard, no pointer). */
│  modifier?(copy: boolean): void;
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
│export interface ArraySpec {
│  /** "times": N more copies at the last spacing. "divide": N copies spread evenly over the last of
│  kind: "times" | "divide";
│  /** A positive integer. */
│  n: number;
⋮
│export function parseArray(text: string): ArraySpec | null {
│  const s = text.replace(/\s+/g, "").toLowerCase();
│  const m = s.match(/^(?:([x*\/])(\d+)|(\d+)([x*\/]))$/);
│  if (!m) return null;
│  const n = parseInt(m[2] ?? m[3], 10);
│  if (!(n > 0)) return null;
│  return { kind: (m[1] ?? m[4]) === "/" ? "divide" : "times", n };
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
│    pub fn move_and_integrate(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), 
│        self.doc.move_and_integrate(&ids(&verts, VId), V3::new(dx, dy, dz)).map_err(js)
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
│    pub fn copy_geometry(
│        &mut self,
│        ctx: u32,
│        faces: Vec<u32>,
│        edges: Vec<u32>,
│        dx: f64,
│        dy: f64,
│        dz: f64,
⋮
│    pub fn copy_instance(&mut self, inst: u32, dx: f64, dy: f64, dz: f64) -> Result<u32, JsError> {
│        Ok(self.doc.copy_instance(InstId(inst), V3::new(dx, dy, dz)).map_err(js)?.0)
⋮
│    pub fn intersect_faces(
│        &mut self,
│        ctx: u32,
│        faces: Vec<u32>,
│        instances: Vec<u32>,
│        with_model: bool,
⋮
│    pub fn check_model(&self) -> String {
│        Value::Array(check::check(&self.doc).iter().map(|f| f.to_json()).collect()).to_string()
⋮
│    pub fn set_transform(&mut self, inst: u32, m: Vec<f64>) -> Result<(), JsError> {
│        let m: Mat4 = m.try_into().map_err(|_| JsError::new("a transform needs 16 numbers"))?;
│        self.doc.set_transform(InstId(inst), m).map_err(js)
⋮
│    /// (`{"survey": {"kind": "wall"}}`). `kind` is "definition", "instance" or "face".
│    pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError> {
│        let t = target(kind, id)?;
│        let a =
│            self.doc.attributes(t).ok_or_else(|| JsError::new(&format!("that {kind} no longer exist
│        Ok(serde_json::to_string(a).expect("attributes are JSON"))
⋮
│    pub fn set_attribute(
│        &mut self,
│        kind: &str,
│        id: u32,
│        ns: &str,
│        key: &str,
│        value_json: &str,
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

kernel/src/edit.rs:
# Moving and erasing geometry.
⋮
│pub struct Copied {
│    pub faces: Vec<FId>,
│    pub edges: Vec<EId>,
⋮
│impl Document {
│    /// Duplicate faces and edges of `ctx` translated by `offset`, keeping materials,
│    /// back materials and face attributes, then integrate the new edges with what
│    /// they land on as a committed move does (`integrate_moved`). Faces bring their
│    /// edges. Inputs not owned by `ctx` are ignored; nothing to copy is
│    /// `Error::Empty`. `Error::Locked` when `ctx` is locked (ADR mvr2opid).
│    pub fn copy_geometry(
│        &mut self,
│        ctx: DefId,
│        faces: &[FId],
│        edges: &[EId],
│        offset: V3,
⋮
│    /// inside out fails the move and the caller should abort.
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
│    /// Every vertex must belong to one definition.
│    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│        let set: BTreeSet<VId> = verts.iter().copied().collect();
│        let mut owner: Option<DefId> = None;
│        for &v in &set {
│            let o = self.vertex(v).ok_or(Error::Missing("vertex"))?.owner;
│            if owner.is_some_and(|d| d != o) {
│                return Err(Error::Degenerate("vertices belong to more than one definition"));
│            }
│            owner = Some(o);
│        }
⋮
│    /// with holes that would bend is refused with `Error::NotPlanar`.
│    pub(crate) fn fold_for_move(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│        let set: BTreeSet<VId> = verts.iter().copied().collect();
│        let mut faces: BTreeSet<FId> = BTreeSet::new();
│        for &v in &set {
│            for e in self.vertex(v).map(|x| x.edges.clone()).unwrap_or_default() {
│                faces.extend(self.edge(e).map(|x| x.faces.clone()).unwrap_or_default());
│            }
│        }
│        for f in faces {
│            let Some(face) = self.face(f).cloned() else { continue };
⋮
│    /// every edge.
│    pub(crate) fn integrate_moved(&mut self, def: DefId, edges: &[EId]) -> Result<(), Error> {
│        let mut verts: BTreeSet<VId> = BTreeSet::new();
│        for &e in edges {
│            if let Some(ed) = self.edge(e) {
│                verts.extend(ed.v);
│            }
│        }
│        for &v in &verts {
│            let Some(pos) = self.vertex(v).map(|x| x.pos) else { continue };
│            let into = self
⋮
│    /// The edges incident to `verts`, deduplicated and sorted.
│    pub(crate) fn edges_of_vertices(&self, verts: &[VId]) -> Vec<EId> {
│        let mut out: BTreeSet<EId> = BTreeSet::new();
│        for &v in verts {
│            if let Some(vx) = self.vertex(v) {
│                out.extend(vx.edges.iter().copied());
│            }
│        }
│        out.into_iter().collect()
⋮
│    /// to the existing edge), and `from` is removed.
│    pub(crate) fn merge_vertex_into(&mut self, from: VId, into: VId) -> Result<(), Error> {
│        if from == into {
│            return Ok(());
│        }
│        let fx = self.vertex(from).cloned().ok_or(Error::Missing("vertex"))?;
│        self.vertex(into).ok_or(Error::Missing("vertex"))?;
│        let mut faces: BTreeSet<FId> = BTreeSet::new();
│        for &e in &fx.edges {
│            faces.extend(self.edge(e).map(|x| x.faces.clone()).unwrap_or_default());
│        }
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
│/// True when every point lies on the loop's best-fit plane (or the loop has no plane).
│fn is_planar(pts: &[V3]) -> bool {
│    Plane::from_loop(pts).is_none_or(|p| pts.iter().all(|&q| p.contains(q)))
⋮
│/// Returns an empty Vec for a planar input, or when no inside diagonal exists.
│pub fn fold_diagonals(pts: &[V3], normal: V3) -> Vec<(usize, usize)> {
│    let Some(plane) = Plane::from_point_normal(pts.first().copied().unwrap_or_default(), normal) el
│        return Vec::new();
│    };
│    let (u, v) = plane.basis();
│    let flat: Vec<P2> = pts.iter().map(|&p| to_2d(p, u, v)).collect();
│    fold_pieces(pts, &flat, normal).0
⋮
│/// diagonal lies inside the polygon.
│fn fold_pieces(pts: &[V3], flat: &[P2], normal: V3) -> (Vec<(usize, usize)>, Vec<Vec<usize>>) {
│    let mut diagonals = Vec::new();
│    let mut pieces = Vec::new();
│    let all: Vec<usize> = (0..pts.len()).collect();
│    split_piece(pts, flat, all, normal, &mut diagonals, &mut pieces);
│    (diagonals, pieces)
⋮
│fn split_piece(
│    pts: &[V3],
│    flat: &[P2],
│    idx: Vec<usize>,
│    normal: V3,
│    diagonals: &mut Vec<(usize, usize)>,
│    pieces: &mut Vec<Vec<usize>>,
⋮
│/// Twice the signed area of the triangle `a`, `b`, `c`.
│fn area2(a: P2, b: P2, c: P2) -> f64 {
│    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
⋮
│/// edge, not even at a vertex (O'Rourke's test).
│fn is_diagonal(poly: &[P2], i: usize, j: usize) -> bool {
│    let n = poly.len();
│    let eps = tol::AREA;
│    let left = |a: P2, b: P2, c: P2| area2(a, b, c) > eps;
│    let left_on = |a: P2, b: P2, c: P2| area2(a, b, c) > -eps;
│    let collinear = |a: P2, b: P2, c: P2| area2(a, b, c).abs() <= eps;
│    let between = |a: P2, b: P2, c: P2| {
│        collinear(a, b, c)
│            && c[0] >= a[0].min(b[0]) - tol::LENGTH
│            && c[0] <= a[0].max(b[0]) + tol::LENGTH
⋮
│mod tests {
│    use super::*;
│
│    #[test]
│    fn fold_hinges_between_the_lifted_corners_neighbours() {
│        let quad = [
│            V3::new(0.0, 0.0, 10.0),
│            V3::new(10.0, 0.0, 10.0),
│            V3::new(10.0, 10.0, 13.0),
│            V3::new(0.0, 10.0, 10.0),
│        ];
│        assert_eq!(fold_diagonals(&quad, V3::Z), vec![(1, 3)]);
│        let flat = [
│            V3::new(0.0, 0.0, 10.0),
⋮
│    fn a_bent_hexagon_folds_into_planar_pieces() {
│        // A regular-ish hexagon on z = 0 with two opposite corners lifted differently.
│        let pts = [
│            V3::new(0.0, 0.0, 0.0),
│            V3::new(10.0, 0.0, 0.0),
│            V3::new(15.0, 8.0, 4.0),
│            V3::new(10.0, 16.0, 0.0),
│            V3::new(0.0, 16.0, 0.0),
│            V3::new(-5.0, 8.0, 2.0),
│        ];
⋮
│    fn fold_diagonals_stay_inside_a_notched_face() {
│        // An L: a 20 x 20 square missing its lower-left 10 x 10 corner, with the
│        // notch's inner corner lifted. The only inside diagonals start there.
│        let pts = [
│            V3::new(10.0, 0.0, 0.0),
│            V3::new(20.0, 0.0, 0.0),
│            V3::new(20.0, 20.0, 0.0),
│            V3::new(0.0, 20.0, 0.0),
│            V3::new(0.0, 10.0, 0.0),
│            V3::new(10.0, 10.0, 2.0),
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
│    /// parent definition the copy is written into is locked (ADR mvr2opid).
│    pub fn copy_instance(&mut self, inst: InstId, offset: V3) -> Result<InstId, Error> {
│        let src = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
│        self.check_instance_unlocked(inst)?;
│        self.check_def_unlocked(src.parent)?;
│        if !offset.is_finite() {
│            return Err(Error::Degenerate("offset is not a number"));
│        }
│        let def = self.copy_definition(src.definition)?;
│        let id = self.new_instance(def, src.parent);
│        let mut x = src.clone();
⋮
│    /// definitions. `copy_instance` and its recursion use it.
│    fn copy_definition(&mut self, def: DefId) -> Result<DefId, Error> {
│        let src = self.definition(def).cloned().ok_or(Error::Missing("definition"))?;
│        let new = self.next_def();
│        self.set_definition(
│            new,
│            Some(Definition { name: src.name, kind: DefKind::Group, attributes: src.attributes }),
│        );
│        let mut vmap: HashMap<VId, VId> = HashMap::new();
│        let verts: Vec<(VId, V3)> = self.vertices_in(def).map(|(id, v)| (id, v.pos)).collect();
│        for (id, p) in verts {
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

kernel/src/lib.rs:
# Builder's geometry kernel: sticky planar geometry with undo.
⋮
│pub mod check;
│pub mod doc;
│pub mod edit;
│pub mod format;
│pub mod group;
│pub mod heal;
│pub mod intersect;
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
│    /// the line closest to the origin.
│    pub fn intersect(&self, o: &Plane) -> Option<(V3, V3)> {
│        let cross = self.normal.cross(o.normal);
│        let len2 = cross.dot(cross);
│        if len2.sqrt() < tol::INTERSECT_SIN {
│            return None;
│        }
│        // p = (d1 (n2 × c) + d2 (c × n1)) / |c|², the solution of n1·p = d1, n2·p = d2
│        // with no component along c.
│        let p = (o.normal.cross(cross) * self.d + cross.cross(self.normal) * o.d) * (1.0 / len2);
│        Some((p, cross.unit()?))
⋮
│/// Axis-aligned bounds of a point set, as (min, max). `None` for an empty set.
│pub fn bbox(points: impl Iterator<Item = V3>) -> Option<(V3, V3)> {
│    let mut out: Option<(V3, V3)> = None;
│    for p in points {
│        out = Some(match out {
│            None => (p, p),
│            Some((lo, hi)) => (
│                V3::new(lo.x.min(p.x), lo.y.min(p.y), lo.z.min(p.z)),
│                V3::new(hi.x.max(p.x), hi.y.max(p.y), hi.z.max(p.z)),
│            ),
│        });
⋮
│/// True when two boxes overlap or touch within `tol::LENGTH`.
│pub fn bbox_overlap_3d(a: (V3, V3), b: (V3, V3)) -> bool {
│    let t = tol::LENGTH;
│    a.0.x <= b.1.x + t
│        && b.0.x <= a.1.x + t
│        && a.0.y <= b.1.y + t
│        && b.0.y <= a.1.y + t
│        && a.0.z <= b.1.z + t
│        && b.0.z <= a.1.z + t
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
│mod tests {
│    use super::*;
│
│    fn plane(p: V3, n: V3) -> Plane {
│        Plane::from_point_normal(p, n).unwrap()
│    }
│
│    #[test]
│    fn parallel_and_near_parallel_planes_do_not_intersect() {
│        let a = plane(V3::ZERO, V3::Z);
│        let b = plane(V3::new(0.0, 0.0, 10.0), V3::Z);
│        assert!(a.intersect(&b).is_none());
│        // Half a degree apart: sin(0.5°) is about 8.7e-3, under INTERSECT_SIN.
│        let tilt = 0.5_f64.to_radians();
│        let c = plane(V3::ZERO, V3::new(tilt.sin(), 0.0, tilt.cos()));
│        assert!(a.intersect(&c).is_none());
⋮
│    fn perpendicular_planes_meet_on_a_unit_line() {
│        let a = plane(V3::new(0.0, 0.0, 96.0), V3::Z);
│        let b = plane(V3::new(120.0, 0.0, 0.0), V3::X);
│        let (p, dir) = a.intersect(&b).unwrap();
│        assert!(a.dist(p).abs() <= tol::PLANE);
│        assert!(b.dist(p).abs() <= tol::PLANE);
│        assert!((dir.len() - 1.0).abs() < 1e-12);
│        assert!(dir.dot(V3::Y).abs() > 1.0 - 1e-12);
│        // The point is the one closest to the origin: no component along the line.
│        assert!(p.dot(dir).abs() < 1e-9);
⋮
│    fn boxes_touching_within_tolerance_overlap() {
│        let a = bbox([V3::ZERO, V3::new(10.0, 10.0, 10.0)].into_iter()).unwrap();
│        let b =
│            bbox([V3::new(10.0 + tol::LENGTH / 2.0, 0.0, 0.0), V3::new(20.0, 5.0, 5.0)].into_iter()
│        let c =
│            bbox([V3::new(10.0 + tol::LENGTH * 2.0, 0.0, 0.0), V3::new(20.0, 5.0, 5.0)].into_iter()
│        assert!(bbox_overlap_3d(a, b));
│        assert!(!bbox_overlap_3d(a, c));
│        assert!(bbox(std::iter::empty()).is_none());
⋮

kernel/tests/common/fuzz.rs:
# The randomized kernel test's harness: a seeded RNG, geometric operations, a
⋮
│/// xorshift64*: deterministic, no dependency.
│pub struct Rng(u64);
│
│impl Rng {
│    pub fn new(seed: u64) -> Rng {
│        Rng(if seed == 0 { 0x9e37_79b9_7f4a_7c15 } else { seed })
│    }
│    pub fn next_u64(&mut self) -> u64 {
│        let mut x = self.0;
│        x ^= x >> 12;
│        x ^= x << 25;
│        x ^= x >> 27;
│        self.0 = x;
│        x.wrapping_mul(0x2545_f491_4f6c_dd1d)
│    }
│    /// `[0, 1)`.
│    pub fn f64(&mut self) -> f64 {
│        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
│    }
│    /// An integer in `[lo, hi]`.
│    pub fn range(&mut self, lo: i64, hi: i64) -> i64 {
│        lo + (self.next_u64() % ((hi - lo + 1) as u64)) as i64
│    }
│    pub fn choose<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
│        if items.is_empty() {
│            None
│        } else {
│            Some(&items[(self.next_u64() % items.len() as u64) as usize])
│        }
⋮
│pub enum Op {
│    Line {
│        a: V3,
│        b: V3,
│    },
│    Rect {
│        x0: f64,
│        y0: f64,
│        x1: f64,
│        y1: f64,
⋮
│impl Op {
│    fn name(&self) -> &'static str {
│        match self {
│            Op::Line { .. } => "Line",
│            Op::Rect { .. } => "Rectangle",
│            Op::PushPull { .. } => "Push/Pull",
│            Op::MoveFace { .. } => "Move",
│            Op::EraseFace { .. } | Op::EraseEdge { .. } => "Erase",
│            Op::GroupFace { .. } => "Make Group",
│            Op::Intersect => "Intersect Faces",
│            Op::Undo => "Undo",
⋮
│fn nearest_edge(doc: &Document, p: V3) -> Option<EId> {
│    doc.edges_in(ROOT)
│        .map(|(id, e)| (id, doc.pos(e.v[0]).lerp(doc.pos(e.v[1]), 0.5).dist(p)))
│        .filter(|&(_, d)| d <= tol::LENGTH * 10.0)
│        .min_by(|a, b| a.1.total_cmp(&b.1))
│        .map(|(id, _)| id)
⋮
│/// a panic or a `validate` failure is the bug the test looks for.
│pub fn apply(doc: &mut Document, op: &Op) -> Result<bool, Error> {
│    match op {
│        Op::Undo => return Ok(doc.undo().is_some()),
│        Op::Redo => return Ok(doc.redo().is_some()),
│        _ => {}
│    }
│    let face = |doc: &Document, point: V3, normal: V3| doc.face_containing(ROOT, point, normal);
│    doc.begin(op.name());
│    let result: Result<bool, Error> = (|| match *op {
│        Op::Line { a, b } => doc.add_line(ROOT, a, b).map(|_| true),
⋮
│/// A whole-inch coordinate in `[0, 120]`.
│fn grid(rng: &mut Rng) -> f64 {
│    rng.range(0, 120) as f64
⋮
│/// A random live face of ROOT as (interior point, normal).
│fn pick_face(rng: &mut Rng, doc: &Document) -> Option<(V3, V3)> {
│    let faces: Vec<FId> = doc.faces_in(ROOT).map(|(id, _)| id).collect();
│    let f = *rng.choose(&faces)?;
│    let point = doc.face_interior_point(f)?;
│    Some((point, doc.face_normal(f)?))
⋮
│/// failing one, and `run` reproduces it.
│pub fn generate(rng: &mut Rng, steps: usize, doc: &mut Document) -> Vec<Op> {
│    let mut ops = Vec::with_capacity(steps);
│    let trace = std::env::var_os("BUILDER_FUZZ_TRACE").is_some();
│    let started = std::time::Instant::now();
│    for step in 0..steps {
│        if trace && step % 100 == 0 {
│            eprintln!(
│                "step {step}: {} faces, {} edges, {} instances, {:?}",
│                doc.faces.count(),
│                doc.edges.count(),
⋮
│fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
│    if let Some(s) = payload.downcast_ref::<&str>() {
│        s.to_string()
│    } else if let Some(s) = payload.downcast_ref::<String>() {
│        s.clone()
│    } else {
│        "panic".to_string()
│    }
⋮
│/// the failing op and the panic message.
│pub fn run(ops: &[Op]) -> Result<(), (usize, String)> {
│    let mut doc = Document::new();
│    for (i, op) in ops.iter().enumerate() {
│        let r = catch_unwind(AssertUnwindSafe(|| {
│            apply(&mut doc, op).ok();
│            validate(&doc);
│        }));
│        if let Err(payload) = r {
│            return Err((i, panic_message(payload)));
│        }
⋮
│/// flood the output.
│fn fails_quietly(ops: &[Op]) -> bool {
│    let hook = std::panic::take_hook();
│    std::panic::set_hook(Box::new(|_| {}));
│    let failed = run(ops).is_err();
│    std::panic::set_hook(hook);
│    failed
⋮
│/// fails. Starts from the prefix ending at the failing op.
│pub fn shrink(ops: Vec<Op>) -> Vec<Op> {
│    let mut ops = match run(&ops) {
│        Err((i, _)) => ops[..=i].to_vec(),
│        Ok(()) => return ops,
│    };
│    let mut n = 2;
│    while ops.len() >= 2 {
│        let chunk = ops.len().div_ceil(n);
│        let mut reduced = false;
│        let mut start = 0;
⋮
│fn v3(p: V3) -> String {
│    format!("V3::new({:?}, {:?}, {:?})", p.x, p.y, p.z)
⋮
│fn render_op(op: &Op) -> String {
│    match *op {
│        Op::Line { a, b } => format!("Op::Line {{ a: {}, b: {} }}", v3(a), v3(b)),
│        Op::Rect { x0, y0, x1, y1, z } => {
│            format!("Op::Rect {{ x0: {x0:?}, y0: {y0:?}, x1: {x1:?}, y1: {y1:?}, z: {z:?} }}")
│        }
│        Op::PushPull { point, normal, distance } => {
│            format!("Op::PushPull {{ point: {}, normal: {}, distance: {distance:?} }}", v3(point), 
│        }
│        Op::MoveFace { point, normal, offset } => {
⋮
│/// A Rust test body replaying `ops`, ready to paste into fuzz_regressions.rs.
│pub fn render_test(name: &str, ops: &[Op]) -> String {
│    let mut s = format!("#[test]\nfn {name}() {{\n    let mut d = Document::new();\n    let ops = [
│    for op in ops {
│        s.push_str(&format!("        {},\n", render_op(op)));
│    }
│    s.push_str(
│        "    ];\n    for op in &ops {\n        apply(&mut d, op).ok();\n        validate(&d);\n    
│    );
│    s
⋮

kernel/tests/fuzz.rs:
# The randomized kernel test: thousands of mixed operations with `validate` after
⋮
│//! regression test. See docs/architecture.md § Build, test and run.
│mod common;
⋮
│/// as a test body.
│fn fuzz(seed: u64, steps: usize) {
│    let mut rng = Rng::new(seed);
│    let mut doc = Document::new();
│    let ops = generate(&mut rng, steps, &mut doc);
│    if ops.len() == steps {
│        return;
│    }
│    if let Err((i, message)) = run(&ops) {
│        let head = format!("seed={seed:#x} steps={steps} failed at op {i}: {message}");
│        eprintln!("{head}");
⋮
│fn random_operations_keep_invariants() {
│    let t = Instant::now();
│    fuzz(0x5eed_2026, 1_500);
│    let elapsed = t.elapsed();
│    eprintln!("fuzz: 1500 steps in {elapsed:?}");
│    assert!(elapsed.as_secs() < 60, "fuzz run took {elapsed:?}");
⋮
│fn random_operations_long() {
│    let seed = std::env::var("BUILDER_FUZZ_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(1);
│    fuzz(seed, 50_000);
⋮
```

## Summary

One kernel transform path (`transform_vertices` / `transform_and_integrate` over a `Mat4`, with the move forms as the translation case) that a rotation, a rotate-copy (`copy_geometry_with`, `copy_instance_with`) and later Scale all use; a kernel offset module (`offset_face`, `offset_edges`, `edge_chain`) that draws mitred offset loops through `insert_segment` and `heal_around` and refuses a result that would cross itself; their wasm and `Model` wrappers; a Rotate tool with a protractor overlay, 15° snapping, the copy modifier and radial arrays through the `parseArray` path; an Offset tool for hovered faces and selected edge chains; two fuzz ops; and the docs, roadmap renumbering and the deck walkthrough.

## Decisions

### Cited

- `mvr2opid Tag lock enforced by the kernel`: `transform_vertices` checks every vertex's owner (as `move_vertices` does today, edit.rs:88), `transform_and_integrate` checks the one owner (edit.rs:128), `copy_geometry_with` checks `ctx` and `copy_instance_with` checks the instance then its parent (edit.rs:30, group.rs:177-178), `offset_face` checks the face's owner and `offset_edges` the chain's owner, all before any write, returning `Error::Locked`; the tools refuse locked targets before any preview as `MoveTool.down` does (move.ts:135-138).
- `mvr2op7t Namespaced attributes in the builder format`: fold pieces, copies and offset's refilled faces keep face, definition and instance attributes (`with_face` in `fold_for_transform` and `copy_geometry_with`, `copy_definition`, `heal`'s `OldRegion.attributes`). No format change.

### Proposed

- None. The decisions below are recorded here and in requirements.md; none constrains code beyond this sprint in a way an ADR would.

Plan-time decisions (2026-10-29), resolving the kickoff's open questions and fixing the conventions the interfaces rely on:

1. **Transform as a `Mat4`, not a closure.** `transform_vertices(verts, &Mat4)` and `transform_and_integrate(verts, &Mat4)`; `move_vertices(verts, offset)` and `move_and_integrate(verts, offset)` stay as `mat_translation(offset)` wrappers so every existing call site (wasm `moveVertices`/`moveAndIntegrate`, `samples.ts:20`, `kernel/tests/{edit,move,attributes}.rs`, the fuzz `MoveFace` op) is unchanged. `fold_for_move` becomes `fold_for_transform(verts, &Mat4)` (one call site, edit.rs:129). Instances rotate through the existing `set_transform` with `mat_mul(&R, &transform)`; the app builds `R` once (`rotation()` in `app/src/math.ts`, in context coordinates) and uses it for both.
2. **A face whose every vertex moves keeps its front side.** `transform_vertices` sets such a face's stored normal to `mat_apply_dir(m, normal)` before `refresh_face`, so a vertical face rotated 120° about blue is not reported `Collapsed` by the winding test (topo.rs:218-222); a face partly moved is refreshed against its old normal, left stale when it would bend and failed when it would collapse, exactly as `move_vertices` does today. For a translation both rules give today's behaviour.
3. **Fold diagonals are judged on the pre-transform loop** in the face's own plane (`face.plane.basis()`, edit.rs:155-157); the loop after a bending transform has no plane to judge in. The score (largest of the two sub-plane dots with the old normal) is unchanged.
4. **Offset sign:** the kernel takes a signed `distance`. Positive moves every loop away from the face's material: to the right of the walk when the loop is seen from its plane's normal side (the outer loop is counter-clockwise in `plane.basis()` by `validate`, holes clockwise), so the outer loop grows and holes shrink; negative is inward. For an open chain the walk starts at the endpoint whose position is smaller in `(x, y, z)` order; a closed chain is walked counter-clockwise seen from its plane's normal, so positive is outward. The Offset tool derives the sign from the cursor (inside the hovered face is inward; for a chain the cursor's side), and a typed value keeps the current direction with a minus reversing it, Push/Pull's rule (pushpull.ts:122).
5. **A refused offset is `Error::Degenerate("the offset would cross itself")`** and the document is untouched: the check runs on the 2D loops before any `insert_segment`. No new `Error` variant.
6. **Snapping:** the swept angle rounds to 15° unless the inference under the cursor is a point snap (`endpoint`, `midpoint`, `origin`), which wins; Shift keeps the engine's meaning (`lockCurrent`) and is not a snap release; a typed angle is exact.
7. **Protractor plane** before the centre click, re-read on every pointer move: the arrow-key lock (`inference.lockAxis`) if set; else the face under the cursor (`scene().pick(ray, it => it.active)`), its world normal; else, when the inference is `onEdge` or `midpoint` with an `edge`, the face of that edge (`model.edgeFaces`) whose world normal has the larger dot with the direction back to the camera; else the ground (`[0, 0, 1]`). The centre click fixes the plane and calls `inference.unlock()` so the lock does not become a line constraint during the sweep.
8. **Radial arrays mirror 2.1:** after a rotate-copy by θ, `Nx` puts copies at `k·θ`, `k = 1..N`, and `/N` at `k·θ/N`; the last Copy transaction is undone and the array made as one; the `model.revision` guard of 2.1 applies ("Copy something first" otherwise). Both tools' retype of a plain operation is guarded the same way (Move's older unguarded plain retype is left as it is).
9. **Keys:** Rotate is Q and Offset is F, SketchUp's.
10. **Copy replay shared:** `MoveTool.makeCopies` and `Selected` move to `app/src/tools/copies.ts` as `makeCopies(host, sel, transforms)` over `copyGeometryWith` / `copyInstanceWith`; Move passes translation matrices. One Copy routine for both tools.
11. **Deck walkthrough:** a new `docs/walkthrough-deck.md` with the steps that work now and `app/test/deck.test.ts` running them; round posts are a named later step (2.4).
12. **`ToolHost` gains `toWorld` and `toWorldDir`** (the inverses of `toLocal` and `toLocalDir`), because the Offset tool reads loop points from the kernel in context coordinates and must give the inference engine a world plane.

## Technical Specifications

### Interfaces

#### Kernel math (`kernel/src/math.rs`)

```rust
/// The linear part of `m` applied to a direction: no translation.
pub fn mat_apply_dir(m: &Mat4, d: V3) -> V3;

/// Rotation by `angle` radians about the axis through `center` along `axis`
/// (right-hand rule), column-major like `mat_translation`. `None` for a zero or
/// non-finite axis.
pub fn mat_rotation(center: V3, axis: V3, angle: f64) -> Option<Mat4>;
```

#### Kernel transform path (`kernel/src/edit.rs`)

```rust
impl Document {
    /// Preview: move every vertex of `verts` to `mat_apply(m, pos)`. A face whose
    /// every vertex moves keeps its front side (its normal goes through
    /// `mat_apply_dir`); a face partly moved is refreshed against its old normal,
    /// left as it was when it would bend, and fails with `Error::Collapsed` when it
    /// would collapse or turn inside out. `Error::Locked` for a locked owner;
    /// `Error::Degenerate("transform is not a number")` for a non-finite `m`.
    pub fn transform_vertices(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error>;

    /// Commit: fold the faces the transform would bend (`fold_for_transform`),
    /// transform the vertices, then weld and settle in their own definition
    /// (`integrate_moved`). Every vertex must belong to one definition.
    pub fn transform_and_integrate(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error>;

    /// `transform_vertices(verts, &mat_translation(offset))`.
    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;
    /// `transform_and_integrate(verts, &mat_translation(offset))`.
    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;

    /// Renamed from `fold_for_move`: the target of a vertex in `verts` is
    /// `mat_apply(m, pos)`. Diagonals are judged inside the face as it is now, in
    /// its own plane; pieces keep the face's normal side, materials and attributes.
    pub(crate) fn fold_for_transform(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error>;

    /// `copy_geometry` with a transform: new vertices at `mat_apply(m, pos)`, copied
    /// faces with `mat_apply_dir(m, normal)` as their normal, then `integrate_moved`
    /// as today. Same checks and errors as `copy_geometry`.
    pub fn copy_geometry_with(&mut self, ctx: DefId, faces: &[FId], edges: &[EId], m: &Mat4) -> Result<Copied, Error>;
    /// `copy_geometry_with(ctx, faces, edges, &mat_translation(offset))`.
    pub fn copy_geometry(&mut self, ctx: DefId, faces: &[FId], edges: &[EId], offset: V3) -> Result<Copied, Error>;
}
```

#### Kernel groups (`kernel/src/group.rs`)

```rust
impl Document {
    /// `copy_instance` with a transform: the new instance's transform is
    /// `mat_mul(&m, &src.transform)`, `m` in the parent's coordinates. Same deep
    /// copy, checks and errors as `copy_instance`.
    pub fn copy_instance_with(&mut self, inst: InstId, m: &Mat4) -> Result<InstId, Error>;
    /// `copy_instance_with(inst, &mat_translation(offset))`.
    pub fn copy_instance(&mut self, inst: InstId, offset: V3) -> Result<InstId, Error>;
}
```

#### Kernel offset (`kernel/src/offset.rs`, new; `kernel/src/lib.rs` adds `pub mod offset;` and `pub use offset::{Chain, Offset};` and lists the operations in the crate docs)

```rust
/// What an offset drew: the new edges as they are after healing, and the faces
/// that now border them (an inward face offset: the ring and the inner face; an
/// outward one: the ring).
#[derive(Clone, Debug, Default)]
pub struct Offset {
    pub edges: Vec<EId>,
    pub faces: Vec<FId>,
}

/// An ordered chain of edges and the plane it lies in. `points` are the chain's
/// vertices in walk order (a closed chain does not repeat its first point).
#[derive(Clone, Debug)]
pub struct Chain {
    pub points: Vec<V3>,
    pub closed: bool,
    pub plane: Plane,
}

impl Document {
    /// Offset a face's outline. Every loop (outer and holes) moves by `distance` in
    /// the face's plane, positive away from the face's material (the outer loop
    /// grows, holes shrink), with mitred corners: each vertex goes to the meeting
    /// point of its two edges' offset lines (collinear neighbours: straight
    /// across). The offset loops are checked first and the whole operation is
    /// refused with `Error::Degenerate("the offset would cross itself")`, the
    /// document untouched, when any loop has lost its area or orientation, meets
    /// itself, is within `tol::LENGTH` of collapsing an edge, or when the loops
    /// meet each other or a hole leaves the outer loop. Then each loop edge is
    /// drawn with `insert_segment` and `heal_around` heals the plane, so an inward
    /// offset splits the face into a ring (a face with a hole) and an inner face,
    /// both keeping the face's material, side and attributes through `heal`'s old
    /// region, and an outward offset adds a ring around it. `|distance| <=
    /// tol::LENGTH` or a non-finite distance is `Error::Degenerate`; a locked
    /// owner is `Error::Locked`; a missing face `Error::Missing("face")`.
    pub fn offset_face(&mut self, face: FId, distance: f64) -> Result<Offset, Error>;

    /// Offset a chain of edges (`edge_chain`) by `distance` in the chain's plane,
    /// positive to the right of the walk seen from the plane's normal side (outward
    /// for a closed chain), mitred at interior vertices; an open chain's ends move
    /// straight across and are not joined. Checked and refused as `offset_face`
    /// is; drawn with `insert_segment` and `heal_around`.
    pub fn offset_edges(&mut self, edges: &[EId], distance: f64) -> Result<Offset, Error>;

    /// Order `edges` into one chain. Every vertex is used by one or two of the
    /// edges and the edges connect; two vertices used once make an open chain
    /// (walked from the endpoint whose position is smaller in `(x, y, z)` order),
    /// none a closed one (walked counter-clockwise seen from the plane's normal,
    /// starting at the vertex with the smallest position). The plane is the plane
    /// of the first face, in walk order, that borders a chain edge; without one,
    /// `Plane::from_loop` of the points. Errors: `Error::Empty`; `Error::Missing
    /// ("edge")`; `Error::Degenerate("edges belong to more than one definition")`;
    /// `Error::Degenerate("edges do not form one chain")`; `Error::Degenerate("a
    /// straight chain has no plane")` when the points are collinear and no face
    /// borders them; `Error::NotPlanar` when a point is off the plane.
    pub fn edge_chain(&self, edges: &[EId]) -> Result<Chain, Error>;
}

/// Pure: the offset of a 2D polygon (`closed`) or polyline by `distance` to the
/// right of the walk, mitred; one output point per input point.
pub fn offset_loop(pts: &[P2], distance: f64, closed: bool) -> Vec<P2>;

/// Pure: true when no two non-adjacent segments of the polygon or polyline meet
/// (within `tol::LENGTH`) and adjacent ones meet only at their shared point.
pub fn is_simple(pts: &[P2], closed: bool) -> bool;
```

#### Fuzz harness (`kernel/tests/common/fuzz.rs`)

```rust
pub enum Op {
    // ...existing variants unchanged...
    /// Vertices of the face found as above, rotated by `angle` radians about the
    /// axis through `center` along the unit `axis` (`transform_and_integrate` with
    /// `mat_rotation`).
    RotateFace { point: V3, normal: V3, center: V3, axis: V3, angle: f64 },
    /// The face found as above, offset by `distance` (positive outward).
    OffsetFace { point: V3, normal: V3, distance: f64 },
}
// Op::name: "Rotate", "Offset". `apply`, `generate` (two new weight slots before
// Undo and Redo; crowded mode gives them 0), `render_op` gain one arm each; `run`,
// `shrink`, `render_test` are unchanged.
```

Generator rules for the new ops: `RotateFace` takes `center` from a random vertex of the face (80%) or a grid point, `axis` from the three world axes, `angle` from the quarter turns ±90° and 180° (60%) or ±15°, ±30°, ±45° (40%), in radians. `OffsetFace` takes `distance` from the whole inches in `[-12, 12]` excluding 0 (0 becomes 3). The CI step count in `kernel/tests/fuzz.rs` is re-measured with the new weights: 1,500 steps if it stays under 30 s in a debug build, otherwise lowered until it does, and the comment records the measurement.

#### Wasm (`kernel-wasm/src/lib.rs`)

```rust
/// 16 numbers → Mat4, or the error `setTransform` gives today ("a transform needs 16 numbers").
fn mat(m: Vec<f64>) -> Result<Mat4, JsError>;

impl Kernel {
    #[wasm_bindgen(js_name = transformVertices)]
    pub fn transform_vertices(&mut self, verts: Vec<u32>, m: Vec<f64>) -> Result<(), JsError>;
    #[wasm_bindgen(js_name = transformAndIntegrate)]
    pub fn transform_and_integrate(&mut self, verts: Vec<u32>, m: Vec<f64>) -> Result<(), JsError>;
    /// JSON `{ faces, edges }`, the `copyGeometry` encoding.
    #[wasm_bindgen(js_name = copyGeometryWith)]
    pub fn copy_geometry_with(&mut self, ctx: u32, faces: Vec<u32>, edges: Vec<u32>, m: Vec<f64>) -> Result<String, JsError>;
    #[wasm_bindgen(js_name = copyInstanceWith)]
    pub fn copy_instance_with(&mut self, inst: u32, m: Vec<f64>) -> Result<u32, JsError>;
    /// JSON `{ edges, faces }`.
    #[wasm_bindgen(js_name = offsetFace)]
    pub fn offset_face(&mut self, face: u32, distance: f64) -> Result<String, JsError>;
    #[wasm_bindgen(js_name = offsetEdges)]
    pub fn offset_edges(&mut self, edges: Vec<u32>, distance: f64) -> Result<String, JsError>;
    /// JSON `{ "points": [[x, y, z], ...], "closed": bool, "normal": [x, y, z] }`.
    #[wasm_bindgen(js_name = edgeChain)]
    pub fn edge_chain(&self, edges: Vec<u32>) -> Result<String, JsError>;
}
```

#### Model (`app/src/kernel/model.ts`)

```ts
export interface ChainInfo {
  /** Chain vertices in walk order, in the owner definition's coordinates. */
  points: Vec3[];
  closed: boolean;
  normal: Vec3;
}

export class Model {
  /** Preview: vertices to m · pos (context coordinates). */
  transformVertices(verts: number[], m: Mat4): void;
  /** Committed transform: folds, moves, welds and settles. */
  transformAndIntegrate(verts: number[], m: Mat4): void;
  copyGeometryWith(ctx: number, faces: number[], edges: number[], m: Mat4): { faces: number[]; edges: number[] };
  copyInstanceWith(inst: number, m: Mat4): number;
  /** Signed distance, positive away from the face's material. */
  offsetFace(face: number, distance: number): { edges: number[]; faces: number[] };
  offsetEdges(edges: number[], distance: number): { edges: number[]; faces: number[] };
  edgeChain(edges: number[]): ChainInfo;
}
```

All edits go through `changed()` and are called inside a transaction, as the 2.1 wrappers are.

#### App math and units (`app/src/math.ts`, `app/src/units.ts`)

```ts
/** Rotation by `angle` radians about the axis through `center` along `axis`
 *  (right-hand rule), column-major; the same matrix as the kernel's `mat_rotation`. */
export function rotation(center: Vec3, axis: Vec3, angle: number): Mat4;

/** Parse an angle typed into the Measurements box, in degrees: `37`, `37.5`,
 *  `-37`, `37°`, `37deg`. NaN otherwise; `parseArray` spellings are NaN too. */
export function parseAngle(text: string): number;
/** Degrees for display with at most one decimal and the degree sign: `37°`, `37.5°`. */
export function formatAngle(degrees: number): string;
```

#### Tool framework (`app/src/tools/tool.ts`)

```ts
/** The Rotate tool's protractor: a circle of `radius` world inches in the plane
 *  through `center` with `normal`; `start` (a unit direction in the plane) and the
 *  swept `angle` in radians are set once a rotation is in progress. */
export interface Protractor {
  center: Vec3;
  normal: Vec3;
  radius: number;
  start?: Vec3;
  angle?: number;
}

export interface Overlay {
  // ...existing fields unchanged...
  protractor?: Protractor | null;
}

export interface ToolHost {
  // ...existing members unchanged...
  /** Active context coordinates → world point; the inverse of `toLocal`. */
  toWorld(p: Vec3): Vec3;
  /** Active context direction → world direction; the inverse of `toLocalDir`. */
  toWorldDir(d: Vec3): Vec3;
}
```

`App` implements `toWorld`/`toWorldDir` with `ctxMatrix`; `TestHost` keeps the context matrix next to its inverse.

#### Shared copy replay (`app/src/tools/copies.ts`, new)

```ts
/** What a copy duplicates, in the context it was copied in. Moved here from move.ts. */
export interface Selected {
  faces: number[];
  edges: number[];
  instances: number[];
}

/** One "Copy" transaction placing a copy of `sel` at every transform (context
 *  coordinates) through `copyGeometryWith` and `copyInstanceWith`, selecting the
 *  copies. Returns what was made, or null after aborting and flashing the error.
 *  Moved from `MoveTool.makeCopies`, which passed offsets; Move now passes
 *  `translation(host.toLocalDir(o))` per offset. */
export function makeCopies(host: ToolHost, sel: Selected, transforms: Mat4[]): Entity[] | null;
```

`app/src/tools/move.ts` loses its private `Selected` and `makeCopies` and imports these; its behaviour and tests are unchanged.

#### Rotate tool (`app/src/tools/rotate.ts`, new)

```ts
/** Sweep snapping, in degrees. */
export const SNAP_DEGREES = 15;

interface Rotating {
  center: Vec3;              // world
  normal: Vec3;              // world, unit: the protractor plane
  start: Vec3 | null;        // unit direction in the plane; null until the second click
  verts: number[];
  instances: { id: number; transform: Mat4 }[];
  /** Last angle (radians) the kernel accepted. */
  good: number;
  copy: boolean;
  selection: Selected;
}

interface LastRotate { center: Vec3; normal: Vec3; start: Vec3; angle: number; copy: boolean; selection: Selected; revision: number }
interface LastCopy { selection: Selected; center: Vec3; normal: Vec3; angle: number; count: number; revision: number }

export class RotateTool implements Tool {
  readonly id = "rotate";
  get cursor(): string;            // "copy" while rotating with copy set, else "crosshair"
  hint(): string;                  // idle: "Click the centre of rotation. The protractor lies on the face under the cursor; arrow keys pick the red, green or blue plane. Hold Ctrl (Option on Mac) to copy."
                                   // centred: "Click a start direction."
                                   // sweeping: "Move to rotate and click, or type an angle in degrees." / copy: "...Then type 6x or /6 for a radial array."
  vcbLabel(): string;              // "Angle"
  busy(): boolean;
  deactivate(): void;
  modifier(copy: boolean): void;   // as MoveTool.modifier
  move(p: ToolPointer): void;
  down(p: ToolPointer): void;
  up(p: ToolPointer, dragged: boolean): void;
  key(key: string): boolean;       // Escape aborts
  vcb(text: string): void;         // parseArray → radial array; parseAngle → apply and commit, or retype the last rotate; else flash "Type an angle in degrees like 37"
}

/** Segments drawing a protractor: the circle every 5°, ticks every 15° (longer
 *  every 90°), the start ray and the current ray when `start` is set, and the
 *  swept arc. Pure; the app renders it with the preview line style. */
export function protractorSegments(p: Protractor): Vec3[];
```

Rotate semantics:

- **Idle.** Every pointer move infers the point and shows `{ inference, protractor: { center: point, normal, radius } }` with the plane normal of Decision 7 and `radius` = `camera.dist / 12` (constant on screen); hovered entities are highlighted as Move does when the selection is empty.
- **Centre click.** With an empty selection the entity under the cursor is picked (`pickEntity`, as `MoveTool.down`), else "Select something to rotate first". Locked targets are refused with the "that is on a locked tag" toast before any preview. `verts` = `model.verticesOf(faces, edges)`, `instances` with their transforms, `center` = the inferred point, `normal` fixed, `inference.unlock()`, `model.begin("Rotate")`.
- **Start click.** `start` = the unit direction from `center` to the inferred point projected onto the plane; a point within 1e-6 of the centre flashes "Pick a start direction away from the centre".
- **Sweep.** `infer(x, y, { plane })`; `angle` = the signed angle from `start` to the cursor direction about `normal`; snapped per Decision 6. `apply(angle)`: `model.abort(); model.begin("Rotate")`; `R = rotation(toLocal(center), toLocalDir(normal), angle)`; `transformVertices(verts, R)` and `setTransform(id, mul(R, transform))` for each instance; `good = angle`, or on a kernel error the last `good` is re-applied (Move's pattern). The Measurements box shows `formatAngle(deg(good))`; the overlay shows the protractor with `start` and `angle` and a dim label with the angle at the arc's middle.
- **Commit** (third click, a drag release with `|angle| > 1e-6`, or a typed angle): `|good| < 1e-6` aborts; copy: abort the preview, `makeCopies(host, selection, [R])`, `lastCopy = { selection, center, normal, angle: good, count: 1, revision }`; else abort the preview, `begin("Rotate")`, `transformAndIntegrate(verts, R)` and the instance `setTransform`s, `commit()`, flashing a kernel error after `abort()`. `last` records the rotate for retyping. Then `inference.unlock()`, `refresh()`, `show({})`, `hintChanged()`.
- **Arrays.** `vcb` with a `parseArray` spec: `copyIsLastStep` guard on `lastCopy.revision` (flash "Copy something first" otherwise); `model.undo()`; transforms `rotation(c, n, k·θ)` (times) or `rotation(c, n, k·θ/N)` (divide) for `k = 1..N`; `makeCopies`; on failure `model.redo()` restores the single copy, as Move's `array` does.
- **Retype.** A typed angle with nothing in progress and `last.revision === model.revision`: `model.undo()`, then the same rotate (or copy) at the new angle from the same centre, plane, start and selection; otherwise "Rotate something first".
- Transaction names: `"Rotate"` for the preview and the committed rotate, `"Copy"` for a rotate-copy and an array.

#### Offset tool (`app/src/tools/offset.ts`, new)

```ts
interface Active {
  kind: "face" | "chain";
  face?: number;
  edges?: number[];
  item?: number;                 // the scene item the face was picked on
  /** The outline (face: outer loop; chain: its points) in context coordinates. */
  points: Vec3[];
  closed: boolean;
  /** Plane normal in context coordinates. */
  normal: Vec3;
  /** Plane in world coordinates, for inference. */
  plane: Plane;
  /** Last signed distance the kernel accepted. */
  good: number;
}

interface LastOffset { kind: "face" | "chain"; face?: number; edges?: number[]; distance: number; revision: number }

export class OffsetTool implements Tool {
  readonly id = "offset";
  readonly cursor = "crosshair";
  hint(): string;                  // idle: "Click a face to offset its outline, or select a chain of edges and click. Move inside or outside, then click or type a distance."
                                   // active: "Move to set the distance and click, or type it. A minus reverses the direction."
  vcbLabel(): string;              // "Distance"
  busy(): boolean;
  deactivate(): void;
  move(p: ToolPointer): void;
  down(p: ToolPointer): void;
  up(p: ToolPointer, dragged: boolean): void;
  key(key: string): boolean;       // Escape aborts
  vcb(text: string): void;
}

/** Pure: the signed offset distance a cursor point asks for. Magnitude: the
 *  distance from `point` to the nearest segment of `points` (the closing segment
 *  included when `closed`), in the plane. Sign: negative (into the material) when
 *  `inside` is true (face mode), or when the point lies left of the walk of the
 *  nearest segment seen from `normal` (chain mode, `inside` null). */
export function cursorOffset(point: Vec3, points: Vec3[], closed: boolean, normal: Vec3, inside: boolean | null): number;
```

Offset semantics:

- **Mode.** Chain mode when the selection holds edges and no faces; otherwise face mode on the face under the cursor (`scene().pick` on an active, unlocked, editable item, as `PushPullTool.pickFace`).
- **Start (first click).** Face: `points = model.faceOuter(face)`, `normal = model.facePlane(face).normal`, `plane = planeFrom(hit.point, hit.normal)`. Chain: `model.edgeChain(edges)` (its error flashes and nothing starts), `points`, `closed`, `normal` from it, `plane = planeFrom(toWorld(points[0]), toWorldDir(normal))`. A locked context is refused before any preview. `model.begin("Offset")`.
- **Move.** `r = infer(x, y, { plane })`; `inside` (face mode) = the scene pick under the cursor hits the same face on an editable item, else false; `d = cursorOffset(toLocal(r.point), points, closed, normal, inside)` (chain: `inside` null). `apply(d)`: abort, begin, `offsetFace(face, d)` or `offsetEdges(edges, d)`, `good = d`; a kernel error re-applies `good` silently and `apply` returns the message. The Measurements box shows `format(|good|)`.
- **Commit** (second click, or a drag release with `|good| > 1e-3`): `commit()`; `last = { kind, face/edges, distance: good, revision }`; chain mode selects the result's edges so Offset can run again from them; face mode leaves the selection to `prune`. `refresh()`, `show({})`, `hintChanged()`.
- **Typed.** `parseLength`; NaN flashes "Type a distance like 8' or 4\"". Active: `want = (Math.sign(good) || -1) * d` (Push/Pull's rule: the dragged direction, inward when the cursor has not moved, a minus reverses); `apply(want)` and, when the kernel refused it, flash its message (capitalised by `errorMessage`) and stay active; else commit. Idle with `last` and `last.revision === model.revision`: `model.undo()`, rerun at `(Math.sign(last.distance) || -1) * d` in one transaction; on a refusal flash the message and `model.redo()` so the previous offset stays; otherwise "Offset a face or an edge chain first".
- Transaction name: `"Offset"`.

#### App (`app/src/app.ts`, `app/index.html`)

```ts
this.tools = { ..., rotate: new RotateTool(this), offset: new OffsetTool(this), ... };
// keydown tool keys gain q: "rotate", f: "offset"
// drawOverlay: v.setSegments("protractor", o.protractor ? protractorSegments(o.protractor).flat() : [], "preview");
toWorld(p: Vec3): Vec3;      // apply(this.ctxMatrix, p)
toWorldDir(d: Vec3): Vec3;   // applyDir(this.ctxMatrix, d)
```

`app/index.html` gains two toolbar buttons after Move: `data-tool="rotate"` "Rotate (Q)" and `data-tool="offset"` "Offset (F)", with inline SVG icons like their neighbours.

### Data Models

- `Mat4` crosses the wasm boundary as 16 numbers, column-major, as `setTransform` already does; `mat()` rejects any other length.
- `Offset { edges, faces }` serialises as `{"edges":[..],"faces":[..]}`; `Chain` as `{"points":[[x,y,z],...],"closed":bool,"normal":[x,y,z]}` (the plane's `d` is implied by the points).
- A rotated instance's transform is `R · T` with `R = mat_rotation(center, axis, angle)` in the parent's coordinates; a rotate-copy's new instance has the same `R · T`.
- The ring an inward face offset makes is a face with one more hole than the original (its outer loop) and the inner face is a plain face; both keep the original face's material, back material, attributes and side. The original face id is gone after the heal (undo brings it back, ids being journaled).
- `Protractor`, `Selected`, `ChainInfo` are app-only, never stored. No `.builder` format change.
- Transaction names: `"Rotate"`, `"Offset"`, `"Copy"`.

### Examples

```rust
// kernel/tests/rotate.rs
let mut d = Document::new();
make_box(&mut d, 10.0, 10.0, 10.0);
d.commit();
let before = d.to_json();
let verts: Vec<VId> = d.vertices_in(ROOT).map(|(id, _)| id).collect();
let r = mat_rotation(v(5.0, 5.0, 0.0), V3::Z, 30f64.to_radians()).unwrap();
d.begin("Rotate");
d.transform_and_integrate(&verts, &r).unwrap();
assert!(d.commit());
assert_eq!(faces(&d, ROOT).len(), 6);
assert!(approx(volume(&d, ROOT), 1000.0));
validate(&d);
assert_eq!(d.undo(), Some("Rotate".into()));
assert_eq!(d.to_json(), before);

// A stringer: a 2 x 48 face standing on the ground, rotated 37° about its own normal.
let f = face_at(&d, ROOT, v(24.0, 0.0, 1.0), -V3::Y);
let r = mat_rotation(v(0.0, 0.0, 0.0), -V3::Y, 37f64.to_radians()).unwrap();
d.transform_and_integrate(&d.vertices_of(&[f], &[]), &r).unwrap();
assert!(approx(d.face_area(face_at(&d, ROOT, rotated_point, -V3::Y)), 96.0));
```

```rust
// kernel/tests/offset.rs
let mut d = Document::new();
rect_xy(&mut d, ROOT, 0.0, 0.0, 120.0, 96.0, 0.0);      // a wall laid flat for the test
let wall = only_face(&d, ROOT);
let out = d.offset_face(wall, -4.0).unwrap();
assert_eq!(out.edges.len(), 4);
assert_eq!(faces(&d, ROOT).len(), 2);                    // the ring and the inner face
let ring = face_at(&d, ROOT, v(2.0, 48.0, 0.0), -V3::Z);
assert!(approx(d.face_area(ring), 120.0 * 96.0 - 112.0 * 88.0));
assert_eq!(d.face(ring).unwrap().holes.len(), 1);
d.push_pull(ring, -96.0).unwrap();
assert!(is_closed(&d, ROOT));
validate(&d);

// An L (20 x 20 missing its 10 x 10 corner) cannot be offset inward past 5".
let before = d.to_json();
assert!(matches!(d.offset_face(l_face, -6.0), Err(Error::Degenerate(_))));
assert_eq!(d.to_json(), before);
```

```ts
// app/test/rotate.test.ts: a stringer group rotated to 37° by typing
const rot = new RotateTool(h);
h.selection.set([{ kind: "instance", id: stringer }]);
h.click(rot, [0, 0, 0]);            // centre on the ground: protractor normal is blue
h.click(rot, [48, 0, 0]);           // start direction along red
h.hover(rot, [48, 20, 0]);
rot.vcb("37");
expect(h.model.instances(ROOT)[0].transform).toEqual(rotation([0, 0, 0], [0, 0, 1], (37 * Math.PI) / 180).map((x) => expect.closeTo(x, 9)));

// radial array
h.selection.set([{ kind: "instance", id: post }]);
h.click(rot, [60, 48, 0]);
h.click(rot, [120, 48, 0]);
rot.modifier(true);
h.hover(rot, [90, 100, 0]);
rot.vcb("60");
expect(h.model.instances(ROOT).length).toBe(2);
rot.vcb("6x");
expect(h.model.instances(ROOT).length).toBe(7);
expect(h.model.undo()).toBe("Copy");
expect(h.model.instances(ROOT).length).toBe(1);
```

```ts
// app/test/offset.test.ts: wall thickness
const off = new OffsetTool(h);
h.click(off, [60, 0, 48]);          // the front wall of the 10' x 8' x 8' box
h.hover(off, [60, 0, 40]);          // still on the wall: inward
off.vcb('4"');
expect(h.flashes).toEqual([]);
expect(h.model.stats().faces).toBe(7);   // the ring and the inner face replace the wall
const pp = new PushPullTool(h);
h.click(pp, [2, 0, 48]);            // the ring
h.hover(pp, [2, 20, 48]);
pp.vcb("8'");
```

```ts
// app/src/tools/move.ts, after the refactor
makeCopies(this.host, sel, offsets.map((o) => translation(this.host.toLocalDir(o))))
```

## Validation Criteria

```bash
cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
# kernel/src/math.rs: mat_rotation turns (1,0,0) about Z through the origin by 90° into (0,1,0); a centre off the
#   origin is fixed; mat_apply_dir ignores translation; a zero axis is None.
# kernel/tests/rotate.rs: a whole box rotated 30° about blue keeps 6 faces, 12 edges, volume 1000, validate;
#   the stringer face rotated 37° about its normal keeps area 96; a vertical face rotated 120° about blue keeps its
#   front side (normal rotated, not flipped); one lifted-and-rotated corner folds the faces that bend; a rotated
#   box landing flush on another welds into one solid; set_transform(mat_rotation) on a grouped box puts its
#   corners where the loose rotation puts them; undo restores to_json byte for byte; Error::Locked on a locked
#   tag; a NaN matrix is Degenerate; the move, edit, attributes and fuzz_regressions tests pass unchanged.
# kernel/tests/copy.rs: copy_instance_with(R) gives transform R·T and an own definition; copy_geometry_with(R) of
#   a face keeps its area and rotates its normal.
# kernel/tests/offset.rs: inward 4" on a 120 x 96 face → ring (one hole) + inner face, areas add up, push_pull of
#   the ring closes a solid; window rectangle on a wall offset outward 3" → trim ring + wall remainder; a face with
#   a hole offset inward grows the hole; the L refused with Degenerate and to_json unchanged; an open 3-edge chain
#   → 3 new edges, 0 new faces; a closed chain offset outward → a ring face; edge_chain errors (not a chain, two
#   owners, straight, not planar); Error::Locked; validate after every success.
# kernel/tests/fuzz.rs: random_operations_keep_invariants with RotateFace and OffsetFace generated, under 60 s
#   (the comment records the measured time and step count).
cargo test -p builder-kernel --test fuzz -- --ignored   # once, BUILDER_FUZZ_SEED=1, before closing
npm run build:kernel && npm run typecheck && npm test
# app/test/math.test.ts: rotation() matches mat_rotation's convention (90° about Z maps red to green).
# app/test/units.test.ts: parseAngle reads 37, 37.5, -37, 37°, 37deg; NaN for 6x, /6, "", "abc"; formatAngle.
# app/test/tools.test.ts: the Move copy and array tests pass unchanged after the copies.ts refactor; Model
#   copyInstanceWith with a rotation undoes as one step.
# app/test/rotate.test.ts: typed 37° on a stringer group; 15° snap of a swept loose face; protractor normal from
#   a hovered face, from the ground, from the right-arrow lock; rotate-copy leaves the original; 6x → 7 groups as
#   one undo; /6 → 6 evenly spaced; retyped angle replaces the last rotate; locked group → toast; Escape leaves
#   toJson unchanged.
# app/test/offset.test.ts: wall inward 4" then Push/Pull 8' → closed wall-thickness solid; window outward 3" →
#   trim ring pulled; selected 3-edge chain offsets to the cursor's side; retype changes the last offset; a refused
#   offset flashes "The offset would cross itself" and leaves toJson unchanged; Escape aborts.
# app/test/deck.test.ts: the walkthrough's steps give the counts docs/walkthrough-deck.md states.
npx vite build && node scripts/check-precache.mjs
```

Browser check (Patrick): the stair and railing steps of `docs/walkthrough-deck.md` at https://pjsulin.github.io/builder/ after the merge: the protractor follows the cursor and lies on the hovered face, the sweep snaps every 15°, `37` rotates the stringer, the copy cursor and `6x` make the radial array, and Offset's preview follows the cursor inside and outside the face.
