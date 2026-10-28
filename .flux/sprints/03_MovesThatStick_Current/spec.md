# Specification: MovesThatStick

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

`flux repomap kernel/src/edit.rs kernel/src/line.rs kernel/src/pushpull.rs kernel/src/heal.rs kernel/src/topo.rs kernel/src/doc.rs kernel/src/format.rs kernel-wasm/src/lib.rs app/src/kernel/model.ts app/src/tools/move.ts kernel/tests/edit.rs kernel/tests/common/mod.rs`

```
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
│    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
⋮
│/// Attributes as written: checked on read so errors can name their path.
│type FileAttributes = BTreeMap<String, Value>;
│
⋮
│struct FileFace {
│    outer: Vec<u32>,
│    #[serde(default, skip_serializing_if = "Vec::is_empty")]
│    holes: Vec<Vec<u32>>,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    material: Option<u32>,
│    #[serde(default, skip_serializing_if = "Option::is_none")]
│    back_material: Option<u32>,
│    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
│    attributes: FileAttributes,
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
│fn write_attributes(attrs: &Attributes) -> FileAttributes {
│    attrs
│        .iter()
│        .map(|(ns, keys)| (ns.clone(), Value::Object(keys.iter().map(|(k, v)| (k.clone(), v.clone()
│        .collect()
⋮
│/// `instances[3].attributes.survey.kind`. Empty namespaces are dropped.
│fn read_attributes(raw: &FileAttributes, path: &str) -> Result<Attributes, Error> {
│    let mut out = Attributes::new();
│    for (ns, keys) in raw {
│        let Value::Object(keys) = keys else {
│            return Err(Error::Attribute(format!("{path}.{ns}: namespace must be an object")));
│        };
│        for (key, value) in keys {
│            check_attribute(ns, key, Some(value))
│                .map_err(|why| Error::Attribute(format!("{path}.{ns}.{key}: {why}")))?;
│            out.entry(ns.clone()).or_default().insert(key.clone(), value.clone());
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

kernel/src/pushpull.rs:
# Push/Pull on any planar face.
⋮
│pub enum PushPullMode {
│    /// The face moved along its normal and its neighbors stretched.
│    Stretch,
│    /// New side faces and a cap were created.
│    Extrude,
│    /// The cap landed on an opposite face and both were removed, leaving an opening.
│    Through,
⋮
│pub struct PushPullResult {
│    /// The face now at the pushed or pulled position (absent after a push-through).
│    pub face: Option<FId>,
│    pub mode: PushPullMode,
⋮
│impl Document {
│    /// Move a face `distance` inches along its normal (negative pushes it in).
│    pub fn push_pull(&mut self, f: FId, distance: f64) -> Result<PushPullResult, Error> {
│        let face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
│        self.check_def_unlocked(face.owner)?;
│        if !distance.is_finite() {
│            return Err(Error::Degenerate("distance is not a number"));
│        }
│        if distance.abs() <= tol::LENGTH {
│            return Ok(PushPullResult { face: Some(f), mode: PushPullMode::Stretch });
│        }
│        if self.can_stretch(f, &face) {
⋮
│    /// normal direction, so moving the face keeps them planar.
│    fn can_stretch(&self, f: FId, face: &Face) -> bool {
│        let n = face.plane.normal;
│        let edges = self.face_edges(face);
│        let mut any = false;
│        for e in edges {
│            let others: Vec<FId> = self
│                .edge(e)
│                .map(|e| e.faces.iter().copied().filter(|&x| x != f).collect())
│                .unwrap_or_default();
│            if others.is_empty() {
⋮
│    fn stretch(&mut self, face: &Face, distance: f64) -> Result<(), Error> {
│        let offset = face.plane.normal * distance;
│        let verts: HashSet<VId> = face.loops().flatten().copied().collect();
│        let mut touched: HashSet<FId> = HashSet::new();
│        for &v in &verts {
│            let mut vx = self.vertex(v).cloned().ok_or(Error::Missing("vertex"))?;
│            vx.pos = vx.pos + offset;
│            for &e in &vx.edges {
│                touched.extend(self.edge(e).map(|e| e.faces.clone()).unwrap_or_default());
│            }
⋮
│    fn extrude(&mut self, f: FId, face: &Face, distance: f64) -> Result<PushPullResult, Error> {
│        let ctx = face.owner;
│        let n = face.plane.normal;
│        let offset = n * distance;
│        let free = self.face_edges(face).iter().all(|&e| self.edge(e).is_some_and(|e| e.faces.len()
│
│        // Offset copies of every loop vertex.
│        let mut map: HashMap<VId, VId> = HashMap::new();
│        for &v in face.loops().flatten() {
│            if let std::collections::hash_map::Entry::Vacant(slot) = map.entry(v) {
⋮
│    /// cancelled.
│    fn settle(&mut self, ctx: DefId, created: &[FId], cap: FId) -> Result<bool, Error> {
│        let mut edges: Vec<EId> = Vec::new();
│        for &f in created {
│            if let Some(face) = self.face(f) {
│                edges.extend(self.face_edges(face));
│            }
│        }
│        self.integrate_edges(ctx, &edges)?;
│        let mut cap_gone = false;
│        for &f in created {
⋮
│    /// separate pieces.
│    fn integrate_edges(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error> {
│        let mut verts: HashSet<VId> = HashSet::new();
│        let mut seen: HashSet<EId> = HashSet::new();
│        for &e in edges {
│            if !seen.insert(e) {
│                continue;
│            }
│            if let Some(ed) = self.edge(e).cloned() {
│                let new = self.insert_segment(ctx, self.pos(ed.v[0]), self.pos(ed.v[1]))?;
│                for ne in new {
⋮
│    /// `f`'s outline and remove both overlapping pieces. Returns true if it did.
│    fn cancel_against_opposite(&mut self, ctx: DefId, f: FId) -> Result<bool, Error> {
│        let Some(plane) = self.face(f).map(|x| x.plane) else { return Ok(false) };
│        let Some(pt) = self.face_interior_point(f) else { return Ok(false) };
│        let (u, v) = plane.basis();
│        let opposite = self.faces_in(ctx).any(|(g, gf)| {
│            g != f
│                && gf.plane.same_surface(&plane)
│                && gf.plane.normal.dot(plane.normal) < 0.0
│                && self.face_region_contains(gf, to_2d(pt, u, v), u, v)
│        });
⋮
│    /// The face containing point `p` whose normal points along `normal`.
│    pub fn face_containing(&self, ctx: DefId, p: V3, normal: V3) -> Option<FId> {
│        self.faces_in(ctx)
│            .find(|(_, f)| {
│                let (u, v) = f.plane.basis();
│                f.plane.normal.dot(normal) > 0.0
│                    && f.plane.contains(p)
│                    && self.face_region_contains(f, to_2d(p, u, v), u, v)
│            })
│            .map(|(id, _)| id)
⋮
│    /// other way, delete both. Returns true if it did.
│    fn remove_coincident_faces(&mut self, ctx: DefId, plane: &Plane, f: FId) -> bool {
│        let key = |face: &Face| {
│            let mut v: Vec<VId> = face.loops().flatten().copied().collect();
│            v.sort();
│            v
│        };
│        let Some(face) = self.face(f) else {
│            return false;
│        };
│        let k = key(face);
⋮
│    pub(crate) fn with_face(&mut self, f: FId, edit: impl FnOnce(&mut Face)) {
│        if let Some(mut face) = self.face(f).cloned() {
│            edit(&mut face);
│            self.set_face(f, Some(face));
│        }
⋮
│    /// A 3D point well inside a face (not on an edge).
│    pub fn face_interior_point(&self, f: FId) -> Option<V3> {
│        let face = self.face(f)?;
│        let (u, v) = face.plane.basis();
│        let to = |lp: &Vec<VId>| lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect::<Vec<_>>();
│        let p =
│            crate::heal::interior_point(&to(&face.outer), &face.holes.iter().map(to).collect::<Vec<
│        Some(u * p[0] + v * p[1] + face.plane.normal * face.plane.d)
⋮
│    /// The normal a push/pull of `f` moves along, for tools.
│    pub fn face_normal(&self, f: FId) -> Option<V3> {
│        self.face(f).map(|x| x.plane.normal)
⋮

kernel/src/topo.rs:
# Low-level topology edits. These keep the incidence lists (vertex → edges,
⋮
│impl Document {
│    /// An existing vertex in `ctx` within tolerance of `p`.
│    pub fn find_vertex(&self, ctx: DefId, p: V3) -> Option<VId> {
│        let mut best: Option<(VId, f64)> = None;
│        for (id, v) in self.vertices_in(ctx) {
│            let d = v.pos.dist(p);
│            if d <= tol::LENGTH && best.is_none_or(|(_, bd)| d < bd) {
│                best = Some((id, d));
│            }
│        }
│        best.map(|(id, _)| id)
⋮
│    pub fn add_vertex(&mut self, ctx: DefId, p: V3) -> VId {
│        let id = self.next_vid();
│        self.set_vertex(id, Some(Vertex { owner: ctx, pos: p, edges: Vec::new() }));
│        id
⋮
│    /// The vertex at `p`, welding to an existing one when within tolerance.
│    pub fn vertex_at(&mut self, ctx: DefId, p: V3) -> VId {
│        self.find_vertex(ctx, p).unwrap_or_else(|| self.add_vertex(ctx, p))
⋮
│    pub fn edge_between(&self, a: VId, b: VId) -> Option<EId> {
│        let va = self.vertex(a)?;
│        va.edges.iter().copied().find(|&e| self.edge(e).is_some_and(|e| e.other(a) == b))
⋮
│    /// The edge from `a` to `b`, creating it if needed.
│    pub fn add_edge(&mut self, a: VId, b: VId) -> Result<EId, Error> {
│        if a == b {
│            return Err(Error::Degenerate("edge has the same start and end"));
│        }
│        if let Some(e) = self.edge_between(a, b) {
│            return Ok(e);
│        }
│        let owner = self.vertex(a).ok_or(Error::Missing("vertex"))?.owner;
│        let id = self.next_eid();
│        self.set_edge(id, Some(Edge { owner, v: [a, b], faces: Vec::new() }));
⋮
│    /// Delete an edge and any faces that use it. Vertices left without edges go too.
│    pub fn remove_edge(&mut self, e: EId) {
│        let Some(edge) = self.edge(e).cloned() else {
│            return;
│        };
│        for f in edge.faces.clone() {
│            self.remove_face(f);
│        }
│        self.set_edge(e, None);
│        for v in edge.v {
│            if let Some(mut vx) = self.vertex(v).cloned() {
⋮
│    pub fn remove_face(&mut self, f: FId) {
│        let Some(face) = self.face(f).cloned() else {
│            return;
│        };
│        for e in self.face_edges(&face) {
│            if let Some(mut ed) = self.edge(e).cloned() {
│                ed.faces.retain(|&x| x != f);
│                self.set_edge(e, Some(ed));
│            }
│        }
⋮
│    /// Edges of every loop of a face, in loop order.
│    pub fn face_edges(&self, face: &Face) -> Vec<EId> {
│        let mut out = Vec::new();
│        for lp in face.loops() {
│            for i in 0..lp.len() {
│                if let Some(e) = self.edge_between(lp[i], lp[(i + 1) % lp.len()]) {
│                    out.push(e);
│                }
│            }
│        }
│        out
⋮
│    pub fn loop_points(&self, lp: &[VId]) -> Vec<V3> {
│        lp.iter().map(|&v| self.pos(v)).collect()
⋮
│    /// is given, the loops are reversed when needed so the face points that way.
│    pub fn add_face(
│        &mut self,
│        ctx: DefId,
│        outer: Vec<VId>,
│        holes: Vec<Vec<VId>>,
│        normal: Option<V3>,
⋮
│    /// they are planar and not degenerate.
│    pub fn prepare_face(&self, face: &mut Face, normal: Option<V3>) -> Result<(), Error> {
│        if face.outer.len() < 3 {
│            return Err(Error::Degenerate("face needs at least three vertices"));
│        }
│        let pts = self.loop_points(&face.outer);
│        let mut plane = Plane::from_loop(&pts).ok_or(Error::Degenerate("face has no area"))?;
│        if let Some(n) = normal {
│            if plane.normal.dot(n) < 0.0 {
│                face.outer.reverse();
│                plane = plane.flipped();
⋮
│    fn triangulate(&self, face: &Face) -> Result<Vec<u32>, Error> {
│        let (u, v) = face.plane.basis();
│        let mut data = Vec::new();
│        let mut holes = Vec::new();
│        for (i, lp) in face.loops().enumerate() {
│            if i > 0 {
│                holes.push(data.len() / 2);
│            }
│            for &x in lp {
│                let p = to_2d(self.pos(x), u, v);
⋮
│    /// the face is no longer planar, collapsed, or turned inside out.
│    pub fn refresh_face(&mut self, f: FId) -> Result<(), Error> {
│        let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
│        let n = face.plane.normal;
│        let wound = Plane::from_loop(&self.loop_points(&face.outer)).ok_or(Error::Collapsed)?;
│        if wound.normal.dot(n) < 0.0 {
│            return Err(Error::Collapsed);
│        }
│        self.prepare_face(&mut face, Some(n))?;
│        self.set_face(f, Some(face));
│        Ok(())
⋮
│    /// Reverse a face so its front becomes its back.
│    pub fn flip_face(&mut self, f: FId) -> Result<(), Error> {
│        let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
│        face.outer.reverse();
│        for h in face.holes.iter_mut() {
│            h.reverse();
│        }
│        std::mem::swap(&mut face.material, &mut face.back_material);
│        let n = -face.plane.normal;
│        self.prepare_face(&mut face, Some(n))?;
│        self.set_face(f, Some(face));
⋮
│    /// their loops. Returns the new vertex.
│    pub fn split_edge(&mut self, e: EId, p: V3) -> Result<VId, Error> {
│        let edge = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
│        let [a, b] = edge.v;
│        let ctx = edge.owner;
│        let (pa, pb) = (self.pos(a), self.pos(b));
│        let (_, t) = point_segment(p, pa, pb);
│        let at = pa.lerp(pb, t);
│        if at.dist(pa) <= tol::LENGTH {
│            return Ok(a);
│        }
⋮
│    /// Area of a face in square inches.
│    pub fn face_area(&self, f: FId) -> f64 {
│        let Some(face) = self.face(f) else { return 0.0 };
│        let (u, v) = face.plane.basis();
│        face.loops()
│            .map(|lp| {
│                let p: Vec<P2> = lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect();
│                signed_area2(&p) / 2.0
│            })
│            .sum()
⋮
│/// Insert `w` into a vertex loop wherever `a` and `b` are adjacent (either order).
│fn insert_between(lp: &mut Vec<VId>, a: VId, b: VId, w: VId) {
│    let n = lp.len();
│    for i in 0..n {
│        let (x, y) = (lp[i], lp[(i + 1) % n]);
│        if (x == a && y == b) || (x == b && y == a) {
│            lp.insert(i + 1, w);
│            return;
│        }
│    }
⋮

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

kernel/tests/edit.rs:
│mod common;
⋮
│fn moving_the_top_face_of_a_box_stretches_it() {
│    let mut d = Document::new();
│    make_box(&mut d, 10.0, 10.0, 10.0);
│    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
│    let verts = d.vertices_of(&[top], &[]);
│    d.move_vertices(&verts, v(3.0, 0.0, 2.0)).unwrap();
│    assert!(approx(volume(&d, ROOT), 1200.0), "a sheared box keeps base × height");
│    validate(&d);
⋮
│fn moving_one_corner_up_fails_because_faces_would_bend() {
│    let mut d = Document::new();
│    make_box(&mut d, 10.0, 10.0, 10.0);
│    d.commit();
│    let before = d.to_json();
│    let corner = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
│    d.begin("Move");
│    assert_eq!(d.move_vertices(&[corner], v(0.0, 0.0, 3.0)).unwrap_err(), Error::NotPlanar);
│    d.abort();
│    assert_eq!(d.to_json(), before);
⋮
│fn moving_a_loose_rectangle_moves_everything() {
│    let mut d = Document::new();
│    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
│    let f = only_face(&d, ROOT);
│    let verts = d.vertices_of(&[f], &[]);
│    d.move_vertices(&verts, v(50.0, 0.0, 0.0)).unwrap();
│    assert!(d.find_vertex(ROOT, v(60.0, 10.0, 0.0)).is_some());
│    assert!(d.find_vertex(ROOT, v(0.0, 0.0, 0.0)).is_none());
│    validate(&d);
⋮
│fn erasing_a_box_edge_removes_its_two_faces() {
│    let mut d = Document::new();
│    make_box(&mut d, 10.0, 10.0, 10.0);
│    let a = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
│    let b = d.find_vertex(ROOT, v(0.0, 10.0, 10.0)).unwrap();
│    let e = d.edge_between(a, b).unwrap();
│    d.erase(&[], &[e]).unwrap();
│    assert_eq!(faces(&d, ROOT).len(), 4);
│    assert_eq!(edge_count(&d, ROOT), 11);
│    validate(&d);
⋮
│fn erasing_a_face_keeps_its_edges() {
│    let mut d = Document::new();
│    make_box(&mut d, 10.0, 10.0, 10.0);
│    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
│    d.erase(&[top], &[]).unwrap();
│    assert_eq!(faces(&d, ROOT).len(), 5);
│    assert_eq!(edge_count(&d, ROOT), 12);
│    validate(&d);
⋮
│fn erasing_a_lone_edge_removes_its_vertices() {
│    let mut d = Document::new();
│    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(5.0, 0.0, 0.0)).unwrap();
│    d.erase(&[], &e).unwrap();
│    assert_eq!(vertex_count(&d, ROOT), 0);
│    validate(&d);
⋮
│fn erasing_the_line_that_split_a_box_side_heals_it() {
│    let mut d = Document::new();
│    make_box(&mut d, 10.0, 10.0, 10.0);
│    let e = d.add_line(ROOT, v(5.0, 0.0, 0.0), v(5.0, 0.0, 10.0)).unwrap();
│    assert_eq!(faces(&d, ROOT).len(), 7);
│    d.erase(&[], &e).unwrap();
│    assert_eq!(faces(&d, ROOT).len(), 6);
│    assert_eq!(edge_count(&d, ROOT), 12);
│    assert_eq!(vertex_count(&d, ROOT), 8);
│    assert!(is_closed(&d, ROOT));
⋮
```

## Summary

Defines the kernel entry point `Document::move_and_integrate` (fold, move, weld, settle) that the Move tool calls at commit, the shared `settle_faces` / `integrate_moved` steps it and the later CopyAndArrays sprint reuse, the preview-only contract of the existing `move_vertices`, and the wasm and `Model` wrappers that expose the new call. Fold edges are ordinary edges; no format change.

## Decisions

### Cited

- `mvr2opid Tag lock enforced by the kernel`: `move_and_integrate` keeps the `check_def_unlocked` refusal already in `move_vertices` (kernel/src/edit.rs:17); nothing is welded into a locked definition.
- `mvr2op7t Namespaced attributes in the builder format`: faces re-created by a fold keep `material`, `back_material` and `attributes` of the face they replace (same rule `heal` applies through `OldRegion`).

### Proposed

- None. The four open questions were settled at the plan checkpoint (`.flux/docs/plan-checkpoint-2026-10-28.md`):
  - **No `soft` edge flag this sprint.** `Edge` has no flag field and `FileDefinition.edges` is `Vec<[u32; 2]>`; the additive shape would be a per-definition `soft_edges` list plus an ADR and wasm exposure with nothing rendering it. Deferred to styles (5.3). Fold diagonals are ordinary edges.
  - **Fold diagonal:** the diagonal whose two triangles' normals, at post-move positions, stay closest to the face's original plane (maximise the larger of the two dot products, so the fold hinges on the moved vertex's neighbours). For the box corner this leaves one triangle in the old plane; maximising the smaller dot would pick the diagonal through the lifted corner and bend both triangles.
  - **Weld context:** integration runs in the moved vertices' own definition (`Vertex.owner`), SketchUp's rule; a vertex set spanning two definitions is refused with `Error::Degenerate`. A group instance moved with `set_transform` is never integrated.
  - **Weld tolerance:** `tol::LENGTH` (1e-3"), the same tolerance `find_vertex`, `insert_segment` and `split_edge_at` use.

## Technical Specifications

### Interfaces

Rust, `kernel/src/pushpull.rs` (Phase 1). Bodies unchanged; visibility widens so `edit.rs` can call them.

```rust
impl Document {
    /// Merge edges with any existing geometry they overlap or touch (unchanged body).
    pub(crate) fn integrate_edges(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error>;
    /// Cancel `f` against an opposite-facing coplanar face it lies on (unchanged body).
    pub(crate) fn cancel_against_opposite(&mut self, ctx: DefId, f: FId) -> Result<bool, Error>;
    /// Delete `f` and a twin with the same loops facing the other way (unchanged body).
    pub(crate) fn remove_coincident_faces(&mut self, ctx: DefId, plane: &Plane, f: FId) -> bool;

    /// The settle steps of push/pull on any set of faces: integrate their edges,
    /// cancel each against an opposite face, merge same-facing coplanar neighbours
    /// across shared edges. Returns the faces that were cancelled (removed).
    pub(crate) fn settle_faces(&mut self, ctx: DefId, faces: &[FId]) -> Result<Vec<FId>, Error>;

    /// Unchanged signature; now `settle_faces(ctx, created)` and `cancelled.contains(&cap)`.
    fn settle(&mut self, ctx: DefId, created: &[FId], cap: FId) -> Result<bool, Error>;
}
```

Rust, `kernel/src/edit.rs` (Phases 2 and 3).

```rust
impl Document {
    /// Preview move. Unchanged signature. Faces a vertex move would bend are left
    /// unrefreshed (their stored plane and tris stay stale) instead of failing;
    /// `Error::Collapsed` from `refresh_face` still fails the move. Nothing welds.
    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;

    /// Committed move: fold faces that would bend, move, then weld and settle in the
    /// vertices' own definition. Errors: `Missing("vertex")`, `Locked`,
    /// `Degenerate("vertices belong to more than one definition")`, `Collapsed`.
    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;

    /// Weld and settle after geometry was placed: `merge_vertex_into` for each edge
    /// vertex `find_vertex` resolves to another id, then `integrate_edges` then `heal_around`
    /// on `edges` (so crossed edges split and touched planes heal like `add_line`),
    /// then `settle_faces` on every face touching the edges' vertices afterwards.
    /// `def` is the owner of every edge. Reused by CopyAndArrays for copied geometry.
    pub(crate) fn integrate_moved(&mut self, def: DefId, edges: &[EId]) -> Result<(), Error>;

    /// The edges incident to `verts`, deduplicated and sorted.
    pub(crate) fn edges_of_vertices(&self, verts: &[VId]) -> Vec<EId>;

    /// Weld `from` into `into` (same owner, positions within `tol::LENGTH`): every
    /// edge and face loop using `from` is re-pointed to `into`, an edge that would
    /// duplicate an existing `into` edge is dropped, and `from` is removed. Called
    /// first by `integrate_moved` for each moved vertex that `find_vertex` resolves
    /// to a different id, since push/pull creates vertices with `vertex_at` and the
    /// settle path never sees two vertices at one position.
    pub(crate) fn merge_vertex_into(&mut self, from: VId, into: VId) -> Result<(), Error>;

    /// Before a move: every face using one of `verts` whose outer loop would not be
    /// planar at `pos + offset` is replaced by planar triangles. Diagonals are added
    /// with `add_edge` (no welding; they join existing vertices), the face is removed
    /// and one face per triangle is added with `add_face`, keeping the old face's
    /// normal side, material, back_material and attributes. A face with holes that
    /// would bend returns `Error::NotPlanar` (folding holed faces is out of scope).
    pub(crate) fn fold_for_move(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;
}

/// Pure: diagonals (index pairs into `pts`) that split a simple 3D polygon into
/// planar pieces. At each step the diagonal whose two sub-polygon planes stay closest
/// to `normal` (largest maximum dot product: one piece stays as flat as possible, the
/// hinge runs between the moved vertex's neighbours) is chosen; a sub-polygon already planar
/// within `tol::PLANE` is not split further. Returns an empty Vec for a planar input.
pub(crate) fn fold_diagonals(pts: &[V3], normal: V3) -> Vec<(usize, usize)>;
```

Rust, `kernel-wasm/src/lib.rs` (Phase 2), beside `move_vertices` at :141.

```rust
#[wasm_bindgen(js_name = moveAndIntegrate)]
pub fn move_and_integrate(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError>;
```

TypeScript, `app/src/kernel/model.ts` (Phase 2), beside `moveVertices` at :142.

```ts
/** Committed move: folds, moves, welds and settles. Preview uses moveVertices. */
moveAndIntegrate(verts: number[], d: Vec3): void;
```

TypeScript, `app/src/tools/move.ts` (Phase 4). `commit()` keeps its signature; its body changes from committing the preview transaction to replacing it:

1. `model.abort()` the preview transaction.
2. `model.begin("Move")`; `model.moveAndIntegrate(m.verts, local)` when `m.verts.length`; `model.setTransform(...)` for each instance as `apply()` does; `model.commit()`.
3. On error: `model.abort()`, `this.host.flash(errorMessage(e))`.

`apply()` (preview) is unchanged and keeps calling `moveVertices`.

### Data Models

No record or file-format change. `Vertex`, `Edge`, `Face` and `FileDefinition` keep their fields. Fold diagonals are plain `Edge` records; the triangles are plain `Face` records.

Ordering contract inside `move_and_integrate`:

```
check owners (all Vertex.owner equal → def; else Degenerate) and check_def_unlocked(def)
fold_for_move(verts, offset)          // may add edges and replace faces; verts unchanged
move_vertices(verts, offset)          // refresh_face succeeds for every touched face after folding
integrate_moved(def, edges_of_vertices(verts))
```

Every write goes through the existing `set_*` setters, so the open transaction journals it and `undo` restores the previous arenas exactly (byte-equal `to_json`).

### Examples

```rust
// kernel/tests/move.rs: the shed ridge, lifted then nudged sideways, stays watertight.
make_box(&mut d, 120.0, 96.0, 96.0);
let ridge = d.add_line(ROOT, v(0.0, 48.0, 96.0), v(120.0, 48.0, 96.0)).unwrap();
let verts = d.vertices_of(&[], &ridge);
d.move_and_integrate(&verts, v(0.0, 0.0, 36.0)).unwrap();
d.move_and_integrate(&verts, v(0.0, 10.0, 0.0)).unwrap();
assert!(is_closed(&d, ROOT));
validate(&d);

// One box moved until its face lands on another's: one solid, no internal face.
// (Amended at implementation: the facing sides cancel and the coplanar sides
// merge across the shared edges, as push/pull's settle does, so the result is
// one 20-inch box with 6 faces, not 10. Moving only the facing side stretches
// the box instead, so the test moves every vertex of it.)
let second: Vec<VId> = d.vertices_in(ROOT).filter(|(_, x)| x.pos.x > 15.0).map(|(id, _)| id).collect();
d.move_and_integrate(&second, v(-10.0, 0.0, 0.0)).unwrap();
assert_eq!(faces(&d, ROOT).len(), 6);
assert!(is_closed(&d, ROOT));

// A corner lifted: the top folds into two triangles, nothing fails.
let corner = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
d.move_and_integrate(&[corner], v(0.0, 0.0, 3.0)).unwrap();
assert_eq!(faces(&d, ROOT).len(), 7); // five sides stay planar; the top is two triangles
assert_eq!(edge_count(&d, ROOT), 13);  // one fold diagonal
assert!(is_closed(&d, ROOT));
```

```ts
// app/src/tools/move.ts commit()
model.abort();
model.begin("Move");
if (m.verts.length) model.moveAndIntegrate(m.verts, this.host.toLocalDir(m.good));
for (const inst of m.instances) model.setTransform(inst.id, mul(translation(local), inst.transform));
model.commit();
```

```rust
// kernel/src/pushpull.rs settle(), after Phase 1
let cancelled = self.settle_faces(ctx, created)?;
Ok(cancelled.contains(&cap))
```

## Validation Criteria

```bash
cargo test --workspace
# Expected: all pass, including unchanged kernel/tests/pushpull.rs (settle regression gate)
# and the new kernel/tests/move.rs: ridge_lifted_and_nudged_stays_closed,
# box_face_moved_onto_box_face_joins_them, instance_moved_onto_loose_geometry_never_sticks,
# lifting_a_corner_folds_the_top, undo_after_each_integrated_move_restores_the_file,
# moving_vertices_from_two_definitions_is_refused, move_and_integrate_into_a_locked_definition_is_refused,
# vertex_moved_onto_a_vertex_merges_into_it;
# kernel/tests/edit.rs: moving_one_corner_up_previews_without_folding (rewritten).

npm run build:kernel && npm test
# Expected: app/test/tools.test.ts passes, including the two new Move cases:
# "commits a fold when a top edge is pushed sideways" and "welds a face moved onto another".
```

Manual check on the shed sample (`buildSample`): lift the ridge with the Move tool, undo, redo; no error flashes.
