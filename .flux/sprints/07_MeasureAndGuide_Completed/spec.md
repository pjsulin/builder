# Specification: MeasureAndGuide

Signatures, schemas and contracts, never function bodies.

## Baseline

Definition listing of the modules this sprint touches, taken at plan time (`flux repomap` could not run in this session; the listing is in the repomap's format so close Gate 2 can diff against it the way sprint 06's close did).

```
commit: abf0dc4
mode: definition grep (flux repomap unavailable in this session), unbudgeted

kernel/src/doc.rs:
│18:        pub struct $name(pub u32);
│20:            pub fn idx(self) -> usize {
│36:pub const ROOT: DefId = DefId(0);
│39:pub type AttrValue = serde_json::Value;
│43:pub type Attributes = BTreeMap<String, BTreeMap<String, AttrValue>>;
│47:pub enum AttrTarget {
│55:pub(crate) fn check_attribute(ns: &str, key: &str, value: Option<&AttrValue>) -> Result<(), String> {
│72:pub struct Vertex {
│79:pub struct Edge {
│86:    pub fn other(&self, v: VId) -> VId {
│96:pub struct Face {
│112:    pub fn loops(&self) -> impl Iterator<Item = &Vec<VId>> {
│116:    pub fn flat_vertices(&self) -> Vec<VId> {
│123:pub enum DefKind {
│124:    Root,
│125:    Group,
│126:    Component,
│130:pub struct Definition {
│137:pub struct Instance {
│149:pub struct Material {
│157:pub struct Tag {
│167:pub struct Arena<T> {
│172:    fn default() -> Self {
│178:    pub fn get(&self, i: usize) -> Option<&T> {
│181:    pub fn len_slots(&self) -> usize {
│184:    pub fn iter(&self) -> impl Iterator<Item = (usize, &T)> {
│187:    pub fn count(&self) -> usize {
│190:    fn put(&mut self, i: usize, v: Option<T>) -> Option<T> {
│200:pub enum Change {
│211:pub struct Transaction {
│217:pub struct Document {
│234:        pub fn $get(&self, id: $id) -> Option<&$ty> {
│238:        pub fn $set(&mut self, id: $id, value: Option<$ty>) {
│247:    pub fn new() -> Self {
│265:    pub fn next_vid(&self) -> VId {
│268:    pub fn next_eid(&self) -> EId {
│271:    pub fn next_fid(&self) -> FId {
│274:    pub fn next_def(&self) -> DefId {
│277:    pub fn next_inst(&self) -> InstId {
│280:    pub fn next_mat(&self) -> MatId {
│284:    pub fn pos(&self, v: VId) -> V3 {
│292:    pub fn begin(&mut self, name: &str) {
│299:    pub fn in_transaction(&self) -> bool {
│304:    pub fn commit(&mut self) -> bool {
│316:    pub fn abort(&mut self) {
│324:    pub fn undo(&mut self) -> Option<String> {
│337:    pub fn redo(&mut self) -> Option<String> {
│350:    pub fn can_undo(&self) -> bool {
│353:    pub fn can_redo(&self) -> bool {
│356:    pub fn undo_name(&self) -> Option<&str> {
│361:    pub fn pending_changes(&self) -> &[Change] {
│366:    pub fn clear_history(&mut self) {
│373:    fn apply(&mut self, c: &Change, backwards: bool) {
│393:    pub fn faces_in(&self, ctx: DefId) -> impl Iterator<Item = (FId, &Face)> {
│396:    pub fn edges_in(&self, ctx: DefId) -> impl Iterator<Item = (EId, &Edge)> {
│399:    pub fn vertices_in(&self, ctx: DefId) -> impl Iterator<Item = (VId, &Vertex)> {
│402:    pub fn instances_in(&self, ctx: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
│405:    pub fn instances_of(&self, def: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
│412:    pub fn new_instance(&mut self, definition: DefId, parent: DefId) -> InstId {
│431:    pub fn attributes(&self, t: AttrTarget) -> Option<&Attributes> {
│440:    pub fn set_attribute(
│483:    pub fn new_tag(&mut self, name: &str) -> TagId {
│490:    pub fn set_tag(&mut self, inst: InstId, tag: Option<TagId>) -> Result<(), Error> {
│500:    pub fn set_tag_flags(&mut self, tag: TagId, visible: bool, locked: bool) -> Result<(), Error> {

kernel/src/format.rs:
│12:pub const FORMAT: &str = "builder";
│13:pub const VERSION: u32 = 1;
│16:struct File {
│32:struct FileDefinition {
│46:type FileAttributes = BTreeMap<String, Value>;
│49:struct FileFace {
│62:struct FileInstance {
│78:    pub fn to_json(&self) -> String {
│151:    pub fn from_json(text: &str) -> Result<Document, Error> {
│281:fn write_attributes(attrs: &Attributes) -> FileAttributes {
│292:fn read_attributes(raw: &FileAttributes, path: &str) -> Result<Attributes, Error> {
│308:fn has_cycle(n: usize, links: impl Iterator<Item = (usize, usize)>) -> bool {
│315:    fn visit(d: usize, children: &[Vec<usize>], state: &mut [u8]) -> bool {

kernel/src/check.rs:
│9:pub enum FindingKind {
│11:    OverlappingEdges,
│13:    NonPlanarFace,
│15:    FacelessEdge,
│17:    DuplicateVertices,
│22:    pub fn name(self) -> &'static str {
│33:pub struct Finding {
│45:    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
│66:    pub fn to_json(&self) -> serde_json::Value {
│82:pub fn check(doc: &Document) -> Vec<Finding> {
│185:struct Span {
│195:fn overlap_midpoint(p: V3, q: V3, r: V3, s: V3) -> Option<V3> {

kernel/src/lib.rs:
│48:pub enum Error {
│52:    NotPlanar,
│54:    Collapsed,
│58:    Empty,
│62:    Locked,
│66:    SelfIntersecting,
│70:    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {

kernel-wasm/src/lib.rs:
│12:fn js(e: Error) -> JsError {
│16:fn ids<T>(v: &[u32], f: impl Fn(u32) -> T) -> Vec<T> {
│20:fn matrix(m: Vec<f64>) -> Result<Mat4, JsError> {
│24:fn id_list(v: &[u32]) -> String {
│30:pub struct Buffers {
│41:    pub fn positions(&self) -> Vec<f32> {
│45:    pub fn normals(&self) -> Vec<f32> {
│49:    pub fn face_ids(&self) -> Vec<u32> {
│53:    pub fn edge_positions(&self) -> Vec<f32> {
│57:    pub fn edge_ids(&self) -> Vec<u32> {
│63:pub struct Kernel {
│68:    fn default() -> Self {
│76:    pub fn new() -> Kernel {
│81:    pub fn from_json(text: &str) -> Result<Kernel, JsError> {
│86:    pub fn to_json(&self) -> String {
│92:    pub fn begin(&mut self, name: &str) {
│95:    pub fn commit(&mut self) -> bool {
│98:    pub fn abort(&mut self) {
│101:    pub fn undo(&mut self) -> Option<String> {
│104:    pub fn redo(&mut self) -> Option<String> {
│108:    pub fn can_undo(&self) -> bool {
│112:    pub fn can_redo(&self) -> bool {
│121:    pub fn add_line(
│138:    pub fn push_pull(&mut self, face: u32, distance: f64) -> Result<i32, JsError> {
│144:    pub fn vertices_of(&self, faces: Vec<u32>, edges: Vec<u32>) -> Vec<u32> {
│149:    pub fn move_vertices(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError> {
│154:    pub fn move_and_integrate(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError> {
│160:    pub fn transform_vertices(&mut self, verts: Vec<u32>, m: Vec<f64>) -> Result<(), JsError> {
│166:    pub fn transform_and_integrate(&mut self, verts: Vec<u32>, m: Vec<f64>) -> Result<(), JsError> {
│170:    pub fn erase(&mut self, faces: Vec<u32>, edges: Vec<u32>, instances: Vec<u32>) -> Result<(), JsError> {
│180:    pub fn make_group(
│195:    pub fn explode(&mut self, inst: u32) -> Result<String, JsError> {
│210:    pub fn copy_geometry(
│234:    pub fn copy_instance(&mut self, inst: u32, dx: f64, dy: f64, dz: f64) -> Result<u32, JsError> {
│241:    pub fn copy_geometry_transformed(
│262:    pub fn copy_instance_transformed(&mut self, inst: u32, m: Vec<f64>) -> Result<u32, JsError> {
│268:    pub fn offset_face(&mut self, face: u32, distance: f64) -> Result<Vec<u32>, JsError> {
│276:    pub fn offset_edges(&mut self, ctx: u32, edges: Vec<u32>, distance: f64) -> Result<Vec<u32>, JsError> {
│284:    pub fn intersect_faces(
│301:    pub fn check_model(&self) -> String {
│307:    pub fn set_transform(&mut self, inst: u32, m: Vec<f64>) -> Result<(), JsError> {
│315:    pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError> {
│324:    pub fn set_attribute(
│339:    pub fn tags(&self) -> String {
│350:    pub fn new_tag(&mut self, name: &str) -> u32 {
│356:    pub fn set_instance_tag(&mut self, inst: u32, tag: i32) -> Result<(), JsError> {
│362:    pub fn set_tag_flags(&mut self, tag: u32, visible: bool, locked: bool) -> Result<(), JsError> {
│370:    pub fn instance_props(&self, inst: u32) -> String {
│383:    pub fn materials(&self) -> String {
│395:    pub fn face_materials(&self, def: u32) -> Vec<i32> {
│405:    pub fn definition_name(&self, def: u32) -> String {
│412:    pub fn is_locked_def(&self, def: u32) -> bool {
│418:    pub fn buffers(&self, def: u32) -> Buffers {
│431:    pub fn definitions(&self) -> Vec<u32> {
│436:    pub fn instances(&self, def: u32) -> Vec<f64> {
│448:    pub fn instance_info(&self, inst: u32) -> Vec<u32> {
│454:    pub fn world_transform(&self, def: u32) -> Vec<f64> {
│460:    pub fn face_plane(&self, face: u32) -> Vec<f64> {
│472:    pub fn face_edges(&self, face: u32) -> Vec<u32> {
│481:    pub fn face_outer(&self, face: u32) -> Vec<f64> {
│488:    pub fn edge_info(&self, edge: u32) -> Vec<f64> {
│496:    pub fn edge_faces(&self, edge: u32) -> Vec<u32> {
│501:    pub fn stats(&self) -> Vec<u32> {
│511:fn target(kind: &str, id: u32) -> Result<AttrTarget, JsError> {

kernel/tests/common/fuzz.rs:
│13:pub struct Rng(u64);
│16:    pub fn new(seed: u64) -> Rng {
│19:    pub fn next_u64(&mut self) -> u64 {
│28:    pub fn f64(&mut self) -> f64 {
│32:    pub fn range(&mut self, lo: i64, hi: i64) -> i64 {
│35:    pub fn choose<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
│47:pub enum Op {
│48:    Line {
│52:    Rect {
│60:    PushPull {
│66:    MoveFace {
│71:    EraseFace {
│76:    EraseEdge {
│80:    GroupFace {
│85:    Intersect,
│86:    Undo,
│87:    Redo,
│91:    Rotate {
│98:    Offset {
│106:    fn name(&self) -> &'static str {
│123:fn nearest_edge(doc: &Document, p: V3) -> Option<EId> {
│134:pub fn apply(doc: &mut Document, op: &Op) -> Result<bool, Error> {
│209:fn grid(rng: &mut Rng) -> f64 {
│214:fn pick_face(rng: &mut Rng, doc: &Document) -> Option<(V3, V3)> {
│228:pub fn generate(rng: &mut Rng, steps: usize, doc: &mut Document) -> Vec<Op> {
│397:fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
│409:pub fn run(ops: &[Op]) -> Result<(), (usize, String)> {
│425:fn fails_quietly(ops: &[Op]) -> bool {
│435:pub fn shrink(ops: Vec<Op>) -> Vec<Op> {
│467:fn v3(p: V3) -> String {
│471:fn render_op(op: &Op) -> String {
│506:pub fn render_test(name: &str, ops: &[Op]) -> String {

app/src/kernel/model.ts:
│7:export const ROOT = 0;
│9:export type EntityKind = "face" | "edge" | "instance";
│10:export interface Entity {
│15:export interface DefBuffers {
│23:export interface InstanceRecord {
│29:export interface FacePlane {
│36:export type AttrKind = "definition" | "instance" | "face";
│37:export type AttrValue = string | number | boolean;
│39:export type Attributes = Record<string, Record<string, AttrValue>>;
│40:export interface TagInfo {
│46:export interface MaterialInfo {
│52:export interface InstanceProps {
│61:export interface Finding {
│72:export async function loadKernel(): Promise<void> {
│77:export function loadKernelSync(bytes: BufferSource): void {
│78:  initSync({ module: bytes });
│84:export const JOURNAL_SIZE = 50;
│86:export class Model {
│99:  constructor(kernel?: Kernel) {
│107:  toJson(): string {
│117:  begin(name: string): void {
│123:  commit(): boolean {
│128:  abort(): void {
│131:  undo(): string | undefined {
│136:  redo(): string | undefined {
│141:  canUndo(): boolean {
│144:  canRedo(): boolean {
│162:  addLine(ctx: number, a: Vec3, b: Vec3): number[] {
│166:  pushPull(face: number, distance: number): number | null {
│170:  verticesOf(faces: number[], edges: number[]): number[] {
│173:  moveVertices(verts: number[], d: Vec3): void {
│177:  moveAndIntegrate(verts: number[], d: Vec3): void {
│181:  transformVertices(verts: number[], m: Mat4): void {
│185:  transformAndIntegrate(verts: number[], m: Mat4): void {
│188:  erase(faces: number[], edges: number[], instances: number[]): void {
│191:  makeGroup(ctx: number, faces: number[], edges: number[], instances: number[]): number {
│194:  explode(inst: number): { faces: number[]; edges: number[]; instances: number[] } {
│197:  setTransform(inst: number, m: Mat4): void {
│202:  copyGeometry(ctx: number, faces: number[], edges: number[], d: Vec3): { faces: number[]; edges: number[] } {
│206:  copyInstance(inst: number, d: Vec3): number {
│210:  copyGeometryTransformed(ctx: number, faces: number[], edges: number[], m: Mat4): { faces: number[]; edges: number[] } {
│214:  copyInstanceTransformed(inst: number, m: Mat4): number {
│218:  offsetFace(face: number, distance: number): number[] {
│222:  offsetEdges(ctx: number, edges: number[], distance: number): number[] {
│228:  intersectFaces(ctx: number, faces: number[], instances: number[], withModel: boolean): number[] {
│232:  checkModel(): Finding[] {
│237:  attributes(kind: AttrKind, id: number): Attributes {
│241:  setAttribute(kind: AttrKind, id: number, ns: string, key: string, v: AttrValue | null): void {
│244:  tags(): TagInfo[] {
│247:  newTag(name: string): number {
│250:  setInstanceTag(inst: number, tag: number | null): void {
│253:  setTagFlags(tag: number, visible: boolean, locked: boolean): void {
│256:  instanceProps(inst: number): InstanceProps | null {
│259:  materials(): MaterialInfo[] {
│263:  faceMaterials(def: number): Int32Array {
│266:  definitionName(def: number): string {
│269:  isLockedDef(def: number): boolean {
│274:  buffers(def: number): DefBuffers {
│286:  definitions(): number[] {
│289:  instances(def: number): InstanceRecord[] {
│297:  instanceInfo(inst: number): { definition: number; parent: number } | null {
│301:  worldTransform(def: number): Mat4 {
│304:  facePlane(face: number): FacePlane | null {
│309:  faceEdges(face: number): number[] {
│312:  faceOuter(face: number): Vec3[] {
│318:  edgeInfo(edge: number): { a: Vec3; b: Vec3; owner: number } | null {
│322:  edgeFaces(edge: number): number[] {
│325:  exists(e: Entity): boolean {
│330:  stats(): { faces: number; edges: number; vertices: number; instances: number } {

app/src/inference/engine.ts:
│24:export type InferenceKind =
│35:export interface Inference {
│52:export interface InferOptions {
│65:export const AXES: Vec3[] = [
│70:export const AXIS_NAMES = ["Red", "Green", "Blue"];
│72:const POINT_RADIUS = 12;
│73:const EDGE_RADIUS = 7;
│74:const AXIS_RADIUS = 10;
│76:export class InferenceEngine {
│84:  constructor(
│90:  toggleAxisLock(axis: 0 | 1 | 2): void {
│98:  lockCurrent(): boolean {
│118:  unlock(): void {
│124:  get locked(): boolean {
│128:  infer(x: number, y: number, opts: InferOptions = {}): Inference | null {
│134:  private compute(x: number, y: number, opts: InferOptions): Inference | null {
│198:  private pointSnap(
│240:  private axisSnap(anchor: Vec3, x: number, y: number, plane?: Plane): Inference | null {
│262:  private edgeSnap(
│296:function screenSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {

app/src/tools/tool.ts:
│12:export interface ToolPointer {
│24:export interface Overlay {
│52:export interface ToolHost {
│61:  scene(): SceneIndex;
│63:  toLocal(p: Vec3): Vec3;
│65:  toLocalDir(d: Vec3): Vec3;
│70:  refresh(opts?: { preview?: boolean }): void;
│71:  show(overlay: Overlay): void;
│72:  setVcb(text: string): void;
│73:  flash(message: string): void;
│75:  hintChanged(): void;
│76:  enterGroup(instance: number): void;
│77:  exitGroup(): void;
│78:  format(inches: number): string;
│81:export interface Tool {
│84:  hint(): string;
│85:  vcbLabel(): string;
│87:  busy(): boolean;
│88:  activate?(): void;
│90:  deactivate(): void;
│91:  move(p: ToolPointer): void;
│92:  down(p: ToolPointer): void;
│94:  up(p: ToolPointer, dragged: boolean): void;
│95:  doubleClick?(p: ToolPointer): void;
│97:  key?(key: string, shift: boolean): boolean;
│99:  vcb(text: string): void;
│103:  modifier?(): void;
│107:export class Selection {
│111:  private changed(): void {
│114:  has(e: Entity): boolean {
│117:  set(items: Entity[]): void {
│121:  add(items: Entity[]): void {
│125:  toggle(e: Entity): void {
│129:  clear(): void {
│134:  get empty(): boolean {
│137:  ids(kind: Entity["kind"]): number[] {
│141:  prune(model: Model): void {
│150:function dedupe(items: Entity[]): Entity[] {
│160:export function errorMessage(e: unknown): string {

app/src/tools/erase.ts:
│9:export class EraseTool implements Tool {
│14:  constructor(private host: ToolHost) {}
│16:  hint(): string {
│19:  vcbLabel(): string {
│22:  busy(): boolean {
│26:  deactivate(): void {
│31:  private under(p: ToolPointer): Entity | null {
│36:  move(p: ToolPointer): void {
│42:  down(p: ToolPointer): void {
│47:  up(): void {
│63:  vcb(): void {

app/src/tools/pick.ts:
│8:const EDGE_PX = 5;
│10:export interface EntityPick {
│20:export function pickEntity(scene: SceneIndex, cam: CameraModel, x: number, y: number): EntityPick | null {
│46:function entityFor(scene: SceneIndex, item: number, raw: Entity): EntityPick {
│58:export function boxSelect(

app/src/units.ts:
│4:export type UnitSystem = "imperial" | "metric";
│7:export function formatImperial(inches: number): string {
│29:export function formatMetric(inches: number): string {
│35:export function formatLength(inches: number, units: UnitSystem = "imperial"): string {
│40:function number(x: string): number {
│54:const METRIC: Record<string, number> = { mm: 1 / 25.4, cm: 10 / 25.4, m: 1000 / 25.4 };
│61:export function parseLength(text: string, units: UnitSystem = "imperial"): number {
│90:export interface ArraySpec {
│103:export function parseArray(text: string): ArraySpec | null {
│117:export function parseAngle(text: string): number {
│133:export function formatAngle(degrees: number): string {
│139:export function parseLengths(text: string, units: UnitSystem = "imperial"): number[] {

app/src/view/scene.ts:
│10:export interface DrawItem {
│30:export type RGBA = [number, number, number, number];
│32:export interface FaceHit {
│41:export class SceneIndex {
│112:  private flatten(): void {
│159:  triColor(item: number, triInDef: number): RGBA | null {
│168:  triCorner(t: number, c: number): Vec3 {
│173:  segEnd(s: number, end: 0 | 1): Vec3 {
│179:  pick(ray: Ray, filter: (item: DrawItem) => boolean = (it) => it.active): FaceHit | null {
│222:  faceNormal(item: number, face: number): Vec3 {
│237:  screenEdges(cam: CameraModel): Float32Array {
│258:  faceTriangles(item: number, face: number): number[] {
│269:  editableItem(): number {
│277:function transformInto(out: Float32Array, offset: number, src: Float32Array, m: Mat4): void {

app/src/view/viewport.ts:
│11:export interface Theme {
│33:export class Viewport {
│61:  constructor(private host: HTMLElement) {
│86:  setTheme(t: Theme): void {
│105:  resize(): void {
│113:  syncCamera(cam: CameraModel): void {
│130:  private translucentFor(opacity: number): THREE.MeshLambertMaterial {
│145:  private colouredFor(index: SceneIndex, item: number, base: THREE.BufferGeometry): ColouredGeometry | null {
│171:  setScene(index: SceneIndex): void {
│216:  private setLayer(name: string, obj: THREE.Object3D | null): void {
│232:  clearLayer(name: string): void {
│237:  setTriangles(name: string, tris: number[], style: "select" | "hover" | "previewFill"): void {
│245:  setSegments(name: string, segs: number[], style: "selectEdge" | "preview" | "guide" | "box"): void {
│255:  setGuide(name: string, a: Vec3, b: Vec3, color: string): void {
│263:  request(): void {
│274:  get canvas(): HTMLCanvasElement {

app/src/app.ts:
│28:const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
│30:const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
│37:function copyKey(ev: KeyboardEvent | MouseEvent): boolean {
│40:const COPY_KEY = MAC ? "Alt" : "Control";
│42:const MARKER_CLASS: Record<string, string> = {
│54:export class App implements ToolHost {
│82:  constructor(store = new AutosaveStore()) {
│117:  scene(): SceneIndex {
│120:  toLocal(p: Vec3): Vec3 {
│123:  toLocalDir(d: Vec3): Vec3 {
│128:  refresh(opts: { preview?: boolean } = {}): void {
│142:  show(overlay: Overlay): void {
│147:  setVcb(text: string): void {
│152:  flash(message: string): void {
│161:  hintChanged(): void {
│167:  enterGroup(instance: number): void {
│177:  exitGroup(): void {
│188:  private setContext(def: number): void {
│203:  setTool(id: string): void {
│221:  loadModel(model: Model, name: string, opts: { saved?: boolean } = {}): void {
│242:  async offerRestore(candidate: Version | undefined): Promise<boolean> {
│260:  async showVersions(): Promise<void> {
│301:  private undo(redo = false): void {
│310:  private eraseSelection(): void {
│322:  private makeGroup(): void {
│336:  private explode(): void {
│357:  private intersect(withModel: boolean): void {
│371:  private checkModel(): void {
│385:  private exportPlan(): void {
│398:  private selectAll(): void {
│415:  private save(): void {
│440:  private offerReport(e: unknown): void {
│453:  private confirmDiscard(): boolean {
│459:  private zoomExtents(): void {
│468:  private cameraChanged(): void {
│473:  private resize(): void {
│481:  private readTheme(): void {
│500:  private entityGeometry(e: Entity): { tris: number[]; segs: number[] } {
│532:  private drawSelection(): void {
│547:  private drawOverlay(): void {
│569:  private drawGuide(r: Inference | null): void {
│583:  private positionLabels(): void {
│628:  private frameStats(ms: number): void {
│634:  private updateHeader(): void {
│639:  private updateButtons(): void {
│651:  private pointer(ev: PointerEvent | MouseEvent | WheelEvent): ToolPointer {
│656:  private bindUi(): void {
│786:  private keydown(ev: KeyboardEvent): void {
│884:function boxSegments(min: Vec3, max: Vec3): number[] {
│891:export function describeFinding(f: Finding): string {
│909:function protractorSegments(p: NonNullable<Overlay["protractor"]>): number[] {
```

## Summary

Guides as a kernel entity with an additive file key, wasm and `Model` wrappers, a guide draw layer and guide picking, six new inference kinds with the Down-arrow cycle, the Tape Measure and Protractor tools, Delete Guides and a saved visibility flag, fuzz ops and docs.

## Decisions

### Cited

- `mvr2opid` Tag lock enforced by the kernel: `add_guide_*` and `erase_guides` check the owner's lock before writing.
- `mvr2op7t` Namespaced attributes in the builder format: guides are their own top-level key, not attributes; 2.4's edge attributes follow the ADR.
- Kickoff § Decisions and § Open Questions (resolved from SketchUp defaults, 2026-11-04): infinite guide lines, Ctrl toggle, guide point from endpoints, 15° ticks near the centre, slope syntax, Down cycles parallel, perpendicular, off.

### Proposed

- none

## Technical Specifications

### Interfaces

**Kernel (`kernel/src/doc.rs`)**

```rust
id!(GuideId);

#[derive(Clone, Debug, PartialEq)]
pub enum GuideShape {
    /// Unbounded line through `origin` along unit `dir`.
    Line { origin: V3, dir: V3 },
    Point { pos: V3 },
}

#[derive(Clone, Debug, PartialEq)]
pub struct Guide { pub owner: DefId, pub shape: GuideShape }

pub enum Change { /* existing variants */ Guide(u32, Option<Guide>, Option<Guide>), GuidesVisible(bool, bool) }

pub struct Document { /* existing */ pub guides: Arena<Guide>, guides_visible: bool }

impl Document {
    pub fn next_guide(&self) -> GuideId;
    pub fn guide(&self, id: GuideId) -> Option<&Guide>;
    pub fn guides_in(&self, ctx: DefId) -> impl Iterator<Item = (GuideId, &Guide)>;
    pub fn guides_visible(&self) -> bool;
    /// Journaled. Requires an open transaction like every other write.
    pub fn set_guides_visible(&mut self, visible: bool);
}
```

**Kernel (`kernel/src/guide.rs`, new; `pub mod guide` in `lib.rs`)**

```rust
impl Document {
    /// Error::Locked if `ctx` is locked; Error::Degenerate("guide direction") if `dir` has no length.
    pub fn add_guide_line(&mut self, ctx: DefId, origin: V3, dir: V3) -> Result<GuideId, Error>;
    pub fn add_guide_point(&mut self, ctx: DefId, pos: V3) -> Result<GuideId, Error>;
    /// Erases the given guides; Error::Locked if any owner is locked, Error::Missing("guide") if any is gone.
    pub fn erase_guides(&mut self, guides: &[GuideId]) -> Result<(), Error>;
    /// Every guide in every unlocked definition; locked ones are left, not an error.
    pub fn erase_all_guides(&mut self) -> usize;
}
```

**Kernel (`kernel/src/check.rs`)**: `FindingKind::BadGuide` (owner missing or direction not unit), reported by `check`.

**Kernel (`kernel/tests/common/mod.rs`)**: `validate` also asserts every guide's owner exists and every line's `dir` is unit.

**Kernel (`kernel/tests/common/fuzz.rs`)**

```rust
pub enum Op { /* existing */ Guide { point: V3, normal: V3, distance: f64 }, EraseGuide }
// weights grow to [i64; 14]; render_op and the shrinker handle both without change to their shape.
```

**Format (`kernel/src/format.rs`)**

```rust
#[derive(Serialize, Deserialize)]
struct File { /* existing */
    #[serde(default, skip_serializing_if = "Vec::is_empty")] guides: Vec<FileGuide>,
    #[serde(default = "default_true", skip_serializing_if = "Clone::clone")] guides_visible: bool,
}
#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum FileGuide {
    Line { definition: usize, origin: [f64; 3], dir: [f64; 3] },
    Point { definition: usize, pos: [f64; 3] },
}
```

**Wasm (`kernel-wasm/src/lib.rs`)**

```rust
pub fn add_guide_line(&mut self, ctx: u32, ox: f64, oy: f64, oz: f64, dx: f64, dy: f64, dz: f64) -> Result<u32, JsError>;
pub fn add_guide_point(&mut self, ctx: u32, x: f64, y: f64, z: f64) -> Result<u32, JsError>;
pub fn erase_guides(&mut self, guides: Vec<u32>) -> Result<(), JsError>;
pub fn erase_all_guides(&mut self) -> u32;
/// Flat: per guide [id, kind(0 line, 1 point), x, y, z, dx, dy, dz] in definition coordinates.
pub fn guides(&self, def: u32) -> Vec<f64>;
pub fn guides_visible(&self) -> bool;
pub fn set_guides_visible(&mut self, visible: bool);
```

`erase(faces, edges, instances)` is unchanged; guides are erased through `erase_guides`.

**App model (`app/src/kernel/model.ts`)**

```ts
export type EntityKind = "face" | "edge" | "instance" | "guide";
export interface Finding { kind: /* existing */ | "bad_guide"; /* unchanged */ }
export interface GuideRecord { id: number; kind: "line" | "point"; origin: Vec3; dir: Vec3 }
class Model {
  addGuideLine(ctx: number, origin: Vec3, dir: Vec3): number;
  addGuidePoint(ctx: number, pos: Vec3): number;
  eraseGuides(ids: number[]): void;
  eraseAllGuides(): number;
  guides(def: number): GuideRecord[];
  guidesVisible(): boolean;
  setGuidesVisible(v: boolean): void;   // journaled, caller wraps in transact
  exists(e: Entity): boolean;            // now also answers for "guide"
}
```

**Scene and view (`app/src/view/scene.ts`, `viewport.ts`, `app/src/tools/pick.ts`)**

```ts
export interface WorldGuide { item: number; id: number; kind: "line" | "point"; origin: Vec3; dir: Vec3 }
class SceneIndex { guides(): WorldGuide[]; }          // flattened with the items, empty when hidden
class Viewport { setGuides(guides: WorldGuide[], visible: boolean): void; } // layer "guides", dashed; a point is a short stub with an x
// pick.ts
export function pickEntity(...): PickResult | null;   // now also returns { kind: "guide", id } within EDGE_RADIUS of a guide line or POINT_RADIUS of a guide point
// Callers that switch on kind: erase.ts, select.ts (handle guides); move.ts:97, rotate.ts:157 (ignore a picked guide); survey/mode.ts:36 (owner of a guide from Model.guides)
```

**Inference (`app/src/inference/engine.ts`)**

```ts
export type InferenceKind = /* existing */ | "parallel" | "perpendicular" | "fromPoint" | "intersection" | "guidePoint" | "onGuide";
export type EdgeLock = "parallel" | "perpendicular" | null;
export interface Inference { /* existing */ guide?: { item: number; id: number } }
class InferenceEngine {
  /** Down arrow: parallel → perpendicular → off. No-op without a referenced edge. */
  cycleEdgeLock(): EdgeLock;
  edgeLock(): EdgeLock;
  /** The last edge hovered with an On Edge result; cleared by reset(). */
  referencedEdge(): { item: number; id: number; a: Vec3; b: Vec3 } | null;
  /** Called by the app on tool change and Esc: clears locks, reference edge and from-point memory. */
  reset(): void;
  /** Called by the app's pointerdown handler before the tool sees the click: ends the from-point memory. */
  clicked(): void;
}
```

Ranking in `compute`: point snaps (endpoint, midpoint, origin, guidePoint) → intersection → line constraints and locks (axis, parallel, perpendicular) → axis, parallel and perpendicular cues → onEdge, onGuide → from-point cue → plane, onFace, ground. (Amended 2026-11-05 at execution: from-point sits below On Edge and On Guide; see plan.md Task 5.2.) Labels: `Guide Point`, `Intersection`, `Parallel to Edge`, `Perpendicular to Edge`, `From Point`, `On Guide`. Marker colours: magenta for parallel and perpendicular, the existing dotted axis colour for fromPoint, grey for guides.

**Units (`app/src/units.ts`)**

```ts
/** Degrees. Accepts `37`, `37.5`, `-22`, `37°`, and a slope `rise:run` such as `3:12` (atan(rise/run)). */
export function parseAngle(text: string): number;
```

**Tools (`app/src/tools/measure.ts`, `app/src/tools/protractor.ts`, new)**

```ts
export class TapeMeasureTool implements Tool {
  id: "measure"; get cursor(): string;    // "measure" with a + badge in create mode
  hint(): string; vcbLabel(): string;    // "Length" measuring, "Distance" placing
  busy(): boolean; deactivate(): void; modifier(): void;  // Ctrl tap toggles create ↔ measure-only
  move(p: ToolPointer): void; down(p: ToolPointer): void; up(p: ToolPointer, dragged: boolean): void;
  key(key: string): boolean; vcb(text: string): void;
}
export class ProtractorTool implements Tool {
  id: "protractor"; get cursor(): string;
  hint(): string; vcbLabel(): string;    // "Angle"
  busy(): boolean; deactivate(): void;
  move(p: ToolPointer): void; down(p: ToolPointer): void; up(p: ToolPointer, dragged: boolean): void;
  key(key: string): boolean; vcb(text: string): void;
}
```

Tape Measure state: `{ from: Inference; mode: "line" | "point" | "measure"; edge?: {a,b}; preview?: GuideRecord }`; a first click on an endpoint or guide point sets `point`, on a midpoint, an edge or a face sets `line` (direction of the hovered edge; on a face, the axis nearest the drag), in measure-only mode always `measure`. Commit is one transaction `Guide`; `lastGuide` with the model revision guards retype like `lastCopy` does.
Protractor state mirrors `Rotating` (centre, normal, start direction, angle, snap) minus the selection; commit adds a guide line through the centre along the swept direction.

**App (`app/src/app.ts`, `app/index.html`)**: tools `measure` (key `t`) and `protractor` (button only) in `tools` and `keys`; `ArrowDown` calls `cycleEdgeLock()` and falls back to `unlock()` when it returns null and nothing is referenced; buttons `guidesBtn` (View › Guides, toggles `setGuidesVisible` in a transaction) and `deleteGuidesBtn` (Edit › Delete Guides); `setTool` calls `inference.reset()`, pointerdown calls `inference.clicked()`; `entityGeometry` highlights a selected guide; `drawOverlay` passes guides to `viewport.setGuides`.

### Data Models

File, version 1, additive:

```json
{
  "format": "builder", "version": 1, "units": "inch",
  "definitions": [...], "instances": [...],
  "guides": [
    { "kind": "line",  "definition": 0, "origin": [48, 0, 0], "dir": [0, 1, 0] },
    { "kind": "point", "definition": 2, "pos": [0, 24, 0] }
  ],
  "guides_visible": false
}
```

Rules: `definition` indexes `definitions`; `dir` is written unit and readers normalise, refusing zero (`Error::Format` naming the path); `guides` absent or empty is not written; `guides_visible` is written only when false. Readers from before this sprint ignore both keys (compatibility rules). Guides are in definition coordinates and are drawn through every instance of the definition.

### Examples

```ts
// Tape Measure: guide line 4' from the rim's front edge (headless)
host.hover(measure, edgeMid); host.click(measure, edgeMid); host.hover(measure, add(edgeMid, [0, 48, 0]));
measure.vcb("4'");
expect(model.guides(ROOT)).toEqual([{ id: 0, kind: "line", origin: [x, 48, 0], dir: [1, 0, 0] }]);

// Engine: Down cycles
host.hover(line, onAnEdge);           // referencedEdge() set
app.keydown("ArrowDown");             // "parallel"
app.keydown("ArrowDown");             // "perpendicular"
app.keydown("ArrowDown");             // null

// Kernel
let g = doc.add_guide_line(ROOT, v(48.0, 0.0, 0.0), V3::Y)?;
doc.erase_guides(&[g])?;
```

## Validation Criteria

```bash
cargo test --workspace            # guides.rs, format.rs guide cases, check.rs BadGuide, fuzz with Guide/EraseGuide under 60 s at the CI seed
npm test                          # measure.test.ts, protractor.test.ts, inference.test.ts (new kinds, Down cycle), scene.test.ts (guides layer, hidden → empty), units.test.ts (slope), the deck walkthrough replay with the layout step
uv run --project survey pytest survey/tests   # unchanged, still green
```

Expected: all pass; `validate` holds after every fuzz step; a `.builder` with guides round-trips byte-identically; one without the keys loads with no guides and `guides_visible() == true`.

## Added during implementation

Recorded at close (2026-11-05). Private helpers and tests, one line each; no new public interface beyond § Interfaces except where noted.

- `kernel/src/format.rs` `default_true` (serde default for `guides_visible`).
- `kernel/src/check.rs` `Finding.guides: Vec<GuideId>` and the `"guides"` key of `Finding::to_json` (public field; the finding needs the guide id as the others carry face, edge and vertex ids).
- `app/src/kernel/model.ts` `Model.guideOwner(id)` (public; `exists` and the survey panel's owner lookup need the owner of a guide, which `guides(def)` alone cannot give without a scan the callers would each repeat).
- `app/src/view/scene.ts` `SceneIndex.defGuides`, `guideScreenDistance(cam, g, x, y)` (exported helper shared by `pick.ts` and the engine).
- `app/src/tools/pick.ts` `pickGuide`, `POINT_PX`.
- `app/src/inference/engine.ts` `EdgeRef`, `CROSS_TOL`, `edgeDir`, `intersectionSnap`, `edgeCue`, `fromPointCue`, `guideSnap`, `isPointSnap`, `crossing`; `lockCurrent` also holds a parallel or perpendicular cue and an On Guide direction.
- `app/src/tools/rotate.ts` `protractorNormal(host, r, ray)`, `protractorRadius(host)` (exported, per Task 7.2; `RotateTool.radius` and `protractorNormal` wrap them).
- `app/src/tools/measure.ts` `Measuring` (with `plane`, `planes`, `ignore`), `LastGuide`, `choosePlane`, `lineRun`, `stubSize`, `edgePlanes`, `faceEdge`, `place`, `commit`, `canonical`, `stub`.
- `app/src/tools/protractor.ts` `Sweeping`, `LastGuide`, `TICK`, `FINE`, `radius`, `direction`, `showSweep`, `swept`, `place`, `commit`.
- `app/src/app.ts` `cursorStyle`, `MAGENTA`, `toggleGuides`, `deleteGuides`; `MARKER_CLASS` entries `para`, `from`, `guide`; `--cursor-measure`, `--cursor-measure-only`, `--snap-para`, `--snap-guide` in `style.css`.
- `kernel/tests/common/fuzz.rs` `Op::EraseGuide` erases the live guide of ROOT with the lowest id (the spec's "a random live guide" needs no parameter and must replay deterministically).
- Tests: `kernel/tests/guides.rs` (six), `kernel/tests/format.rs` (three), `app/test/tools.test.ts` "Model guides" (two) and "Guides in the view" (three), `app/test/scene.test.ts` "SceneIndex guides", `app/test/inference.test.ts` "guides and reference edges" (four), `app/test/measure.test.ts` (four), `app/test/protractor.test.ts` (three), `app/test/units.test.ts` slope cases; `app/test/toolhost.ts` `click`, `copyClick` and `drag` call `inference.clicked()` as the app's pointerdown does (no `tapKey` helper was needed: tests call `modifier()`).
