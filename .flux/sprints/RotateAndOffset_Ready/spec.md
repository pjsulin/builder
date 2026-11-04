# Specification: RotateAndOffset

Signatures, schemas and contracts, never function bodies.

## Baseline

Output of `flux repomap` for the modules this sprint touches, pasted at plan time. Close Gate 2 diffs the finished code against this and the Interfaces section below.

`flux repomap kernel/src/math.rs kernel/src/edit.rs kernel/src/group.rs kernel/src/line.rs kernel/src/lib.rs kernel-wasm/src/lib.rs kernel/tests/common/fuzz.rs app/src/math.ts app/src/units.ts app/src/kernel/model.ts app/src/tools/tool.ts app/src/tools/move.ts app/src/tools/pushpull.ts app/src/inference/engine.ts app/test/toolhost.ts`

(2026-11-03: `flux` was not installed in the planning session and could not be fetched, so this listing was produced from the same files at commit b7a6b67 by a definition grep in the repomap's format: every `fn`, `struct`, `enum`, `type`, `const`, `impl` and wasm export in the Rust files, every export, method and field in the TypeScript files. Gate 2 should run `flux repomap --diff b7a6b67` against the record; the listing below is the fallback.)

```
kernel/src/math.rs:
│pub struct V3 {
│impl From<[f64; 3]> for V3 {
│    fn from(a: [f64; 3]) -> Self {
│impl From<V3> for [f64; 3] {
│    fn from(v: V3) -> Self {
│impl V3 {
│    pub const ZERO: V3 = V3 { x: 0.0, y: 0.0, z: 0.0 };
│    pub const X: V3 = V3 { x: 1.0, y: 0.0, z: 0.0 };
│    pub const Y: V3 = V3 { x: 0.0, y: 1.0, z: 0.0 };
│    pub const Z: V3 = V3 { x: 0.0, y: 0.0, z: 1.0 };
│    pub const fn new(x: f64, y: f64, z: f64) -> Self {
│    pub fn dot(self, o: V3) -> f64 {
│    pub fn cross(self, o: V3) -> V3 {
│    pub fn len(self) -> f64 {
│    pub fn dist(self, o: V3) -> f64 {
│    pub fn unit(self) -> Option<V3> {
│    pub fn lerp(self, o: V3, t: f64) -> V3 {
│    pub fn is_finite(self) -> bool {
│impl Add for V3 {
│    type Output = V3;
│    fn add(self, o: V3) -> V3 {
│impl Sub for V3 {
│    type Output = V3;
│    fn sub(self, o: V3) -> V3 {
│impl Mul<f64> for V3 {
│    type Output = V3;
│    fn mul(self, s: f64) -> V3 {
│impl Neg for V3 {
│    type Output = V3;
│    fn neg(self) -> V3 {
│pub struct Plane {
│impl Plane {
│    pub fn from_point_normal(p: V3, n: V3) -> Option<Plane> {
│    pub fn from_loop(pts: &[V3]) -> Option<Plane> {
│    pub fn dist(&self, p: V3) -> f64 {
│    pub fn contains(&self, p: V3) -> bool {
│    pub fn flipped(&self) -> Plane {
│    pub fn same_surface(&self, o: &Plane) -> bool {
│    pub fn basis(&self) -> (V3, V3) {
│    pub fn project(&self, p: V3) -> V3 {
│    pub fn intersect(&self, o: &Plane) -> Option<(V3, V3)> {
│pub fn bbox(points: impl Iterator<Item = V3>) -> Option<(V3, V3)> {
│pub fn bbox_overlap_3d(a: (V3, V3), b: (V3, V3)) -> bool {
│pub type P2 = [f64; 2];
│pub fn to_2d(p: V3, u: V3, v: V3) -> P2 {
│pub fn signed_area2(pts: &[P2]) -> f64 {
│pub fn point_in_polygon(p: P2, poly: &[P2]) -> bool {
│pub fn point_segment(p: V3, a: V3, b: V3) -> (f64, f64) {
│pub fn segment_segment(p0: V3, p1: V3, q0: V3, q1: V3) -> Option<(f64, f64, f64)> {
│pub type Mat4 = [f64; 16];
│pub const IDENTITY: Mat4 = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
│pub fn mat_translation(t: V3) -> Mat4 {
│pub fn mat_mul(a: &Mat4, b: &Mat4) -> Mat4 {
│pub fn mat_apply(m: &Mat4, p: V3) -> V3 {
│pub fn mat_invert(m: &Mat4) -> Option<Mat4> {
│    fn plane(p: V3, n: V3) -> Plane {
│    fn parallel_and_near_parallel_planes_do_not_intersect() {
│    fn perpendicular_planes_meet_on_a_unit_line() {
│    fn boxes_touching_within_tolerance_overlap() {

kernel/src/edit.rs:
│pub struct Copied {
│impl Document {
│    pub fn copy_geometry(
│    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│    pub(crate) fn fold_for_move(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│    pub(crate) fn integrate_moved(&mut self, def: DefId, edges: &[EId]) -> Result<(), Error> {
│    pub(crate) fn edges_of_vertices(&self, verts: &[VId]) -> Vec<EId> {
│    pub(crate) fn merge_vertex_into(&mut self, from: VId, into: VId) -> Result<(), Error> {
│    pub fn vertices_of(&self, faces: &[FId], edges: &[EId]) -> Vec<VId> {
│    pub fn erase(&mut self, faces: &[FId], edges: &[EId]) -> Result<(), Error> {
│    pub fn dissolve_vertex(&mut self, v: VId) -> Result<bool, Error> {
│fn is_planar(pts: &[V3]) -> bool {
│pub fn fold_diagonals(pts: &[V3], normal: V3) -> Vec<(usize, usize)> {
│fn fold_pieces(pts: &[V3], flat: &[P2], normal: V3) -> (Vec<(usize, usize)>, Vec<Vec<usize>>) {
│fn split_piece(
│fn area2(a: P2, b: P2, c: P2) -> f64 {
│fn is_diagonal(poly: &[P2], i: usize, j: usize) -> bool {
│    fn fold_hinges_between_the_lifted_corners_neighbours() {
│    fn a_bent_hexagon_folds_into_planar_pieces() {
│    fn fold_diagonals_stay_inside_a_notched_face() {

kernel/src/group.rs:
│pub struct Exploded {
│impl Document {
│    pub fn make_group(
│    pub fn explode(&mut self, inst: InstId) -> Result<Exploded, Error> {
│    pub fn copy_instance(&mut self, inst: InstId, offset: V3) -> Result<InstId, Error> {
│    fn copy_definition(&mut self, def: DefId) -> Result<DefId, Error> {
│    fn delete_definition_contents(&mut self, def: DefId) {
│    pub fn erase_instance(&mut self, inst: InstId) -> Result<(), Error> {
│    pub fn set_transform(&mut self, inst: InstId, m: Mat4) -> Result<(), Error> {
│    pub fn is_locked_def(&self, def: DefId) -> bool {
│    fn tag_locked(&self, tag: Option<TagId>) -> bool {
│    fn contains_locked(&self, def: DefId) -> bool {
│    pub(crate) fn check_def_unlocked(&self, def: DefId) -> Result<(), Error> {
│    pub(crate) fn check_instance_unlocked(&self, inst: InstId) -> Result<(), Error> {
│    pub fn world_transform(&self, def: DefId) -> Mat4 {

kernel/src/line.rs:
│impl Document {
│    pub fn add_line(&mut self, ctx: DefId, a: V3, b: V3) -> Result<Vec<EId>, Error> {
│    pub fn insert_segment(&mut self, ctx: DefId, a: V3, b: V3) -> Result<Vec<EId>, Error> {
│    pub fn split_edge_at(&mut self, e: EId, pts: &[V3]) -> Result<Vec<VId>, Error> {
│    pub fn heal_around(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error> {
│    pub fn edge_in_plane(&self, e: EId, plane: &Plane) -> bool {
│    fn candidate_planes(&self, ctx: DefId, edges: &[EId]) -> Vec<Plane> {

kernel/src/lib.rs:
│pub enum Error {
│impl std::fmt::Display for Error {
│    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
│impl std::error::Error for Error {}

kernel-wasm/src/lib.rs:
│fn js(e: Error) -> JsError {
│fn ids<T>(v: &[u32], f: impl Fn(u32) -> T) -> Vec<T> {
│pub struct Buffers {
│impl Buffers {
│    pub fn positions(&self) -> Vec<f32> {
│    pub fn normals(&self) -> Vec<f32> {
│    pub fn face_ids(&self) -> Vec<u32> {
│    pub fn edge_positions(&self) -> Vec<f32> {
│    pub fn edge_ids(&self) -> Vec<u32> {
│pub struct Kernel {
│impl Default for Kernel {
│    fn default() -> Self {
│impl Kernel {
│    pub fn new() -> Kernel {
│    #[wasm_bindgen(js_name = fromJson)]
│    pub fn from_json(text: &str) -> Result<Kernel, JsError> {
│    #[wasm_bindgen(js_name = toJson)]
│    pub fn to_json(&self) -> String {
│    pub fn begin(&mut self, name: &str) {
│    pub fn commit(&mut self) -> bool {
│    pub fn abort(&mut self) {
│    pub fn undo(&mut self) -> Option<String> {
│    pub fn redo(&mut self) -> Option<String> {
│    #[wasm_bindgen(js_name = canUndo)]
│    pub fn can_undo(&self) -> bool {
│    #[wasm_bindgen(js_name = canRedo)]
│    pub fn can_redo(&self) -> bool {
│    #[wasm_bindgen(js_name = addLine)]
│    pub fn add_line(
│    #[wasm_bindgen(js_name = pushPull)]
│    pub fn push_pull(&mut self, face: u32, distance: f64) -> Result<i32, JsError> {
│    #[wasm_bindgen(js_name = verticesOf)]
│    pub fn vertices_of(&self, faces: Vec<u32>, edges: Vec<u32>) -> Vec<u32> {
│    #[wasm_bindgen(js_name = moveVertices)]
│    pub fn move_vertices(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError> {
│    #[wasm_bindgen(js_name = moveAndIntegrate)]
│    pub fn move_and_integrate(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError> {
│    pub fn erase(&mut self, faces: Vec<u32>, edges: Vec<u32>, instances: Vec<u32>) -> Result<(), JsError> {
│    #[wasm_bindgen(js_name = makeGroup)]
│    pub fn make_group(
│    pub fn explode(&mut self, inst: u32) -> Result<String, JsError> {
│    #[wasm_bindgen(js_name = copyGeometry)]
│    pub fn copy_geometry(
│    #[wasm_bindgen(js_name = copyInstance)]
│    pub fn copy_instance(&mut self, inst: u32, dx: f64, dy: f64, dz: f64) -> Result<u32, JsError> {
│    #[wasm_bindgen(js_name = intersectFaces)]
│    pub fn intersect_faces(
│    #[wasm_bindgen(js_name = checkModel)]
│    pub fn check_model(&self) -> String {
│    #[wasm_bindgen(js_name = setTransform)]
│    pub fn set_transform(&mut self, inst: u32, m: Vec<f64>) -> Result<(), JsError> {
│    pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError> {
│    #[wasm_bindgen(js_name = setAttribute)]
│    pub fn set_attribute(
│    pub fn tags(&self) -> String {
│    #[wasm_bindgen(js_name = newTag)]
│    pub fn new_tag(&mut self, name: &str) -> u32 {
│    #[wasm_bindgen(js_name = setInstanceTag)]
│    pub fn set_instance_tag(&mut self, inst: u32, tag: i32) -> Result<(), JsError> {
│    #[wasm_bindgen(js_name = setTagFlags)]
│    pub fn set_tag_flags(&mut self, tag: u32, visible: bool, locked: bool) -> Result<(), JsError> {
│    #[wasm_bindgen(js_name = instanceProps)]
│    pub fn instance_props(&self, inst: u32) -> String {
│    pub fn materials(&self) -> String {
│    #[wasm_bindgen(js_name = faceMaterials)]
│    pub fn face_materials(&self, def: u32) -> Vec<i32> {
│    #[wasm_bindgen(js_name = definitionName)]
│    pub fn definition_name(&self, def: u32) -> String {
│    #[wasm_bindgen(js_name = isLockedDef)]
│    pub fn is_locked_def(&self, def: u32) -> bool {
│    pub fn buffers(&self, def: u32) -> Buffers {
│    pub fn definitions(&self) -> Vec<u32> {
│    pub fn instances(&self, def: u32) -> Vec<f64> {
│    #[wasm_bindgen(js_name = instanceInfo)]
│    pub fn instance_info(&self, inst: u32) -> Vec<u32> {
│    #[wasm_bindgen(js_name = worldTransform)]
│    pub fn world_transform(&self, def: u32) -> Vec<f64> {
│    #[wasm_bindgen(js_name = facePlane)]
│    pub fn face_plane(&self, face: u32) -> Vec<f64> {
│    #[wasm_bindgen(js_name = faceEdges)]
│    pub fn face_edges(&self, face: u32) -> Vec<u32> {
│    #[wasm_bindgen(js_name = faceOuter)]
│    pub fn face_outer(&self, face: u32) -> Vec<f64> {
│    #[wasm_bindgen(js_name = edgeInfo)]
│    pub fn edge_info(&self, edge: u32) -> Vec<f64> {
│    #[wasm_bindgen(js_name = edgeFaces)]
│    pub fn edge_faces(&self, edge: u32) -> Vec<u32> {
│    pub fn stats(&self) -> Vec<u32> {
│fn target(kind: &str, id: u32) -> Result<AttrTarget, JsError> {

kernel/tests/common/fuzz.rs:
│pub struct Rng(u64);
│impl Rng {
│    pub fn new(seed: u64) -> Rng {
│    pub fn next_u64(&mut self) -> u64 {
│    pub fn f64(&mut self) -> f64 {
│    pub fn range(&mut self, lo: i64, hi: i64) -> i64 {
│    pub fn choose<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
│pub enum Op {
│impl Op {
│    fn name(&self) -> &'static str {
│fn nearest_edge(doc: &Document, p: V3) -> Option<EId> {
│pub fn apply(doc: &mut Document, op: &Op) -> Result<bool, Error> {
│fn grid(rng: &mut Rng) -> f64 {
│fn pick_face(rng: &mut Rng, doc: &Document) -> Option<(V3, V3)> {
│pub fn generate(rng: &mut Rng, steps: usize, doc: &mut Document) -> Vec<Op> {
│fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
│pub fn run(ops: &[Op]) -> Result<(), (usize, String)> {
│fn fails_quietly(ops: &[Op]) -> bool {
│pub fn shrink(ops: Vec<Op>) -> Vec<Op> {
│fn v3(p: V3) -> String {
│fn render_op(op: &Op) -> String {
│pub fn render_test(name: &str, ops: &[Op]) -> String {

app/src/math.ts:
│export type Vec3 = [number, number, number];
│export type Mat4 = number[];
│export const X: Vec3 = [1, 0, 0];
│export const Y: Vec3 = [0, 1, 0];
│export const Z: Vec3 = [0, 0, 1];
│export const ORIGIN: Vec3 = [0, 0, 0];
│export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
│export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
│export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
│export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
│export const cross = (a: Vec3, b: Vec3): Vec3 => [
│export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
│export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
│export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
│export const madd = (a: Vec3, d: Vec3, t: number): Vec3 => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
│export function norm(a: Vec3): Vec3 {
│export interface Ray {
│  origin: Vec3;
│  dir: Vec3; // unit
│export interface Plane {
│  normal: Vec3; // unit
│  d: number; // normal · p = d
│export const planeFrom = (point: Vec3, normal: Vec3): Plane => {
│export function rayPlane(ray: Ray, plane: Plane): Vec3 | null {
│export function projectToPlane(p: Vec3, plane: Plane): Vec3 {
│export function lineRayParam(p0: Vec3, u: Vec3, ray: Ray): number | null {
│export function rayTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
│export function planeBasis(n: Vec3): [Vec3, Vec3] {
│export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
│export function translation(t: Vec3): Mat4 {
│export function mul(a: Mat4, b: Mat4): Mat4 {
│export function apply(m: Mat4, p: Vec3): Vec3 {
│export function applyDir(m: Mat4, d: Vec3): Vec3 {
│export function invert(m: Mat4): Mat4 {

app/src/units.ts:
│export type UnitSystem = "imperial" | "metric";
│export function formatImperial(inches: number): string {
│export function formatMetric(inches: number): string {
│export function formatLength(inches: number, units: UnitSystem = "imperial"): string {
│  x = x.trim();
│export function parseLength(text: string, units: UnitSystem = "imperial"): number {
│export interface ArraySpec {
│  kind: "times" | "divide";
│  n: number;
│export function parseArray(text: string): ArraySpec | null {
│export function parseLengths(text: string, units: UnitSystem = "imperial"): number[] {

app/src/kernel/model.ts:
│export const ROOT = 0;
│export type EntityKind = "face" | "edge" | "instance";
│export interface Entity {
│  kind: EntityKind;
│  id: number;
│export interface DefBuffers {
│  positions: Float32Array;
│  normals: Float32Array;
│  faceIds: Uint32Array;
│  edgePositions: Float32Array;
│  edgeIds: Uint32Array;
│export interface InstanceRecord {
│  id: number;
│  definition: number;
│  transform: Mat4;
│export interface FacePlane {
│  normal: Vec3;
│  d: number;
│  owner: number;
│  area: number;
│export type AttrKind = "definition" | "instance" | "face";
│export type AttrValue = string | number | boolean;
│export type Attributes = Record<string, Record<string, AttrValue>>;
│export interface TagInfo {
│  id: number;
│  name: string;
│  visible: boolean;
│  locked: boolean;
│export interface MaterialInfo {
│  id: number;
│  name: string;
│  color: [number, number, number];
│  opacity: number;
│export interface InstanceProps {
│  name: string;
│  tag: number | null;
│  material: number | null;
│  locked: boolean;
│export interface Finding {
│  kind: "overlapping_edges" | "non_planar_face" | "faceless_edge" | "duplicate_vertices";
│  owner: number;
│  faces: number[];
│  edges: number[];
│  vertices: number[];
│  position: Vec3;
│export async function loadKernel(): Promise<void> {
│export function loadKernelSync(bytes: BufferSource): void {
│export const JOURNAL_SIZE = 50;
│export class Model {
│  revision = 0;
│  lastOperation = "";
│  onCommit?: (operation: string) => void;
│  constructor(kernel?: Kernel) {
│  static fromJson(text: string): Model {
│  toJson(): string {
│  private changed<T>(v: T): T {
│  begin(name: string): void {
│  commit(): boolean {
│  abort(): void {
│  undo(): string | undefined {
│  redo(): string | undefined {
│  canUndo(): boolean {
│  canRedo(): boolean {
│  transact<T>(name: string, edit: () => T): T {
│  addLine(ctx: number, a: Vec3, b: Vec3): number[] {
│  pushPull(face: number, distance: number): number | null {
│  verticesOf(faces: number[], edges: number[]): number[] {
│  moveVertices(verts: number[], d: Vec3): void {
│  moveAndIntegrate(verts: number[], d: Vec3): void {
│  erase(faces: number[], edges: number[], instances: number[]): void {
│  makeGroup(ctx: number, faces: number[], edges: number[], instances: number[]): number {
│  setTransform(inst: number, m: Mat4): void {
│  copyInstance(inst: number, d: Vec3): number {
│  intersectFaces(ctx: number, faces: number[], instances: number[], withModel: boolean): number[] {
│  checkModel(): Finding[] {
│  attributes(kind: AttrKind, id: number): Attributes {
│  setAttribute(kind: AttrKind, id: number, ns: string, key: string, v: AttrValue | null): void {
│  tags(): TagInfo[] {
│  newTag(name: string): number {
│  setInstanceTag(inst: number, tag: number | null): void {
│  setTagFlags(tag: number, visible: boolean, locked: boolean): void {
│  instanceProps(inst: number): InstanceProps | null {
│  materials(): MaterialInfo[] {
│  faceMaterials(def: number): Int32Array {
│  definitionName(def: number): string {
│  isLockedDef(def: number): boolean {
│  buffers(def: number): DefBuffers {
│  definitions(): number[] {
│  instances(def: number): InstanceRecord[] {
│  worldTransform(def: number): Mat4 {
│  facePlane(face: number): FacePlane | null {
│  faceEdges(face: number): number[] {
│  faceOuter(face: number): Vec3[] {
│  edgeFaces(edge: number): number[] {
│  exists(e: Entity): boolean {

app/src/tools/tool.ts:
│export interface ToolPointer {
│  x: number;
│  y: number;
│  shift: boolean;
│  ctrl: boolean;
│  alt: boolean;
│  copy: boolean;
│export interface Overlay {
│  inference?: Inference | null;
│  segments?: Vec3[];
│  fill?: Vec3[];
│  hover?: { item: number; face: number } | null;
│  hoverEntity?: Entity | null;
│  dims?: { pos: Vec3; text: string }[];
│  marquee?: { x0: number; y0: number; x1: number; y1: number; crossing: boolean } | null;
│export interface ToolHost {
│export interface Tool {
│export class Selection {
│  items: Entity[] = [];
│  onChange: (() => void) | null = null;
│  private changed(): void {
│  has(e: Entity): boolean {
│  set(items: Entity[]): void {
│  add(items: Entity[]): void {
│  toggle(e: Entity): void {
│  clear(): void {
│  get empty(): boolean {
│  ids(kind: Entity["kind"]): number[] {
│  prune(model: Model): void {
│export function errorMessage(e: unknown): string {

app/src/tools/move.ts:
│  base: Vec3;
│  verts: number[];
│  instances: { id: number; transform: Mat4 }[];
│  good: Vec3;
│  copy: boolean;
│  selection: Selected;
│  faces: number[];
│  edges: number[];
│  instances: number[];
│  selection: Selected;
│  offset: Vec3;
│  count: number;
│  revision: number;
│export class MoveTool implements Tool {
│  get cursor(): string {
│  hint(): string {
│  modifier(copy: boolean): void {
│  vcbLabel(): string {
│  busy(): boolean {
│  deactivate(): void {
│  move(p: ToolPointer): void {
│  private apply(offset: Vec3): void {
│  down(p: ToolPointer): void {
│  private start(base: Vec3, faces: number[], edges: number[], instances: number[], copy = false): void {
│  up(_p: ToolPointer, dragged: boolean): void {
│  key(key: string): boolean {
│  vcb(text: string): void {
│  private array(spec: ArraySpec): void {
│  private copyIsLastStep(): boolean {
│  private makeCopies(sel: Selected, offsets: Vec3[]): Entity[] | null {
│  private commit(): void {

app/src/tools/pushpull.ts:
│  face: number;
│  item: number;
│  normal: Vec3;
│  start: Vec3;
│  good: number;
│export class PushPullTool implements Tool {
│  hint(): string {
│  vcbLabel(): string {
│  busy(): boolean {
│  deactivate(): void {
│  private pickFace(p: ToolPointer) {
│  move(p: ToolPointer): void {
│  private apply(t: number): void {
│  down(p: ToolPointer): void {
│  up(_p: ToolPointer, dragged: boolean): void {
│  doubleClick(p: ToolPointer): void {
│  key(key: string): boolean {
│  vcb(text: string): void {
│  private run(face: number, distance: number): void {
│  private commit(): void {

app/src/inference/engine.ts:
│export type InferenceKind =
│export interface Inference {
│  point: Vec3;
│  kind: InferenceKind;
│  label: string;
│  axis?: 0 | 1 | 2;
│  from?: Vec3;
│  face?: FaceHit;
│  edge?: { item: number; id: number; a: Vec3; b: Vec3 };
│  locked?: boolean;
│  ref?: { point: Vec3; kind: InferenceKind };
│export interface InferOptions {
│  anchor?: Vec3;
│  plane?: Plane;
│  line?: { origin: Vec3; dir: Vec3 };
│  pickable?: (item: DrawItem) => boolean;
│  ignoreEdges?: Set<number>;
│export const AXES: Vec3[] = [
│export const AXIS_NAMES = ["Red", "Green", "Blue"];
│export class InferenceEngine {
│  lockDir: Vec3 | null = null;
│  lockAxis: 0 | 1 | 2 | null = null;
│  lockPlane: Plane | null = null;
│  last: Inference | null = null;
│  toggleAxisLock(axis: 0 | 1 | 2): void {
│  lockCurrent(): boolean {
│  unlock(): void {
│  get locked(): boolean {
│  infer(x: number, y: number, opts: InferOptions = {}): Inference | null {
│  private compute(x: number, y: number, opts: InferOptions): Inference | null {
│  private axisSnap(anchor: Vec3, x: number, y: number, plane?: Plane): Inference | null {

app/test/toolhost.ts:
│export class TestHost implements ToolHost {
│  model: Model;
│  ctx = ROOT;
│  camera = new CameraModel();
│  selection = new Selection();
│  inference: InferenceEngine;
│  units = "imperial" as const;
│  overlay: Overlay = {};
│  vcbText = "";
│  flashes: string[] = [];
│  constructor(model?: Model) {
│  scene(): SceneIndex {
│  toLocal(p: Vec3): Vec3 {
│  toLocalDir(d: Vec3): Vec3 {
│  refresh(opts: { preview?: boolean } = {}): void {
│  show(o: Overlay): void {
│  setVcb(text: string): void {
│  flash(m: string): void {
│  enterGroup(instance: number): void {
│  exitGroup(): void {
│  format = (inches: number) => formatLength(inches);
│  at(p: Vec3, opts: { copy?: boolean } = {}): ToolPointer {
│  click(tool: Tool, p: Vec3): void {
│  copyClick(tool: Tool, p: Vec3): void {
│  hover(tool: Tool, p: Vec3): void {
│  drag(tool: Tool, from: Vec3, to: Vec3): void {

```

## Summary

One kernel transform path (`transform_vertices`, `transform_and_integrate`, `copy_geometry_transformed`, `copy_instance_transformed`, all taking a `Mat4`) that Move's offset forms wrap and Rotate uses directly, with `mat_rotation` for the matrix; a kernel offset module (`offset_face`, `offset_edges`, pure `offset_loop`) that draws the offset through `insert_segment` and `heal_around` and refuses self-intersecting results with `Error::SelfIntersecting`; wasm and `Model` wrappers; `rotation` and `parseAngle` in the app; a `RotateTool` with a protractor overlay, the copy modifier and radial arrays through `parseArray`; an `OffsetTool` that previews with the real operation like Push/Pull; two fuzz ops; docs and the deck walkthrough.

## Decisions

### Cited

- `mvr2opid Tag lock enforced by the kernel`: `transform_vertices` checks every vertex's owner, `transform_and_integrate` the one owner, `copy_geometry_transformed` the context, `copy_instance_transformed` the instance and its parent, `offset_face` the face's owner and `offset_edges` the context, all before writing. The app turns `Error::Locked` into the locked-tag toast as `MoveTool.down` does (`app/src/tools/move.ts:103-105`), and refuses a locked selection before previewing.
- `mvr2op7t Namespaced attributes in the builder format`: transformed copies carry face, definition and instance attributes unchanged, as the offset copies do; the offset's new faces come from `heal`, which gives a split face's pieces the old face's materials and attributes (`heal.rs` `old`).

### Proposed

- None. The kickoff's decisions (one sprint for both tools; rotate-copies are independent groups until 3.1; the protractor plane rule; a self-intersecting offset is refused; the array path is reused; new tools get fuzz ops) are recorded in requirements.md and here; none constrains code beyond this sprint in a way an ADR would, and the fuzz rule is a documented practice in `docs/architecture.md` § 9, not a decision about the code.

### Resolved at plan time

- **Snapping.** 15° when the cursor's inference kind is `ground`, `plane` or `onFace`; an `endpoint`, `midpoint`, `onEdge`, `origin` or `axis` inference sets the angle exactly. Shift keeps its lock role (`InferenceEngine.lockCurrent`) and has no snap role.
- **Angle sign.** Counter-clockwise about the protractor normal is positive (right-hand rule). The normal from a face is the face's front normal flipped to face the camera (`dot(normal, -ray.dir) > 0`), the ground's is +Z, an axis lock's is the axis, so a positive angle reads counter-clockwise on screen in the usual views. A typed angle uses that sign; the sweep's sign comes from the cursor.
- **Offset sign.** Kernel: `distance > 0` moves every loop away from the face's interior (outward; holes grow into the hole), `< 0` toward it; for a chain `> 0` is to the right of the chain's direction (`dir × normal`), the same side `offset_loop` uses for every input. Tool: a typed positive value follows the preview's direction, negative flips it; before any movement positive is inward for a face and left for a chain.
- **Fold plane.** `fold_for_move` keeps judging diagonals in the face's current plane; under a rotation the loop before the transform is the simple polygon with a plane, the loop after may have none.
- **Face normals under a transform.** A face every vertex of which is transformed gets its plane normal transformed first (`mat_apply(m, p0 + n) - mat_apply(m, p0)`, the `explode` rule) so `refresh_face` does not report `Collapsed` for a rotation past 90°; a face only some of whose vertices move keeps its normal and is folded on commit or refused as under Move.
- **Rotate-copy is a transformed copy.** The kickoff's "a copy followed by the transform" is one kernel call: `copy_geometry_transformed` recreates the geometry at `mat_apply(m, pos)` and integrates it there. Copying at the origin and then rotating would weld the copy into the original first.
- **Protractor size.** The tool sets the radius to `camera.dist * 0.12` world units so the circle stays about the same size on screen; the app draws it, ticks every 15° (longer every 90°), and the swept arc.
- **Shortcuts.** Q for Rotate, F for Offset (SketchUp's keys); neither is taken (`app.ts` keys are space, l, r, p, m, e, o, h, g, Z).
- **Deck walkthrough.** New `docs/walkthrough-deck.md`, same format as `walkthrough-shed.md`, covering the frame, joists by array (2.1), the rotated stair and the railing by Offset and Copy; the round posts step is added by the curves sprint.

## Technical Specifications

### Interfaces

#### Kernel math (`kernel/src/math.rs`)

```rust
/// Rotation of `angle` radians about the axis through `center` along `axis`
/// (right-hand rule), as a column-major affine `Mat4` like `mat_translation`.
/// `None` for a (near) zero axis. Rodrigues' formula; `angle == 0.0` is `IDENTITY`.
pub fn mat_rotation(center: V3, axis: V3, angle: f64) -> Option<Mat4>;

/// A direction under an affine transform: `mat_apply(m, d) - mat_apply(m, ZERO)`.
pub fn mat_apply_dir(m: &Mat4, d: V3) -> V3;

/// True when every entry is finite.
pub fn mat_is_finite(m: &Mat4) -> bool;
```

#### Kernel transform path (`kernel/src/edit.rs`)

```rust
impl Document {
    /// Preview: set each vertex of `verts` to `mat_apply(m, pos)`. A face every
    /// vertex of which is in `verts` carries its normal through `m`; a face the
    /// transform would bend is left as it was (plane and triangulation stale) so
    /// the drag still shows, and a face that would collapse or turn inside out
    /// fails the transform. `Error::Locked` for a locked owner (ADR mvr2opid);
    /// `Error::Degenerate` for a non-finite matrix.
    pub fn transform_vertices(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error>;

    /// Committed transform: `fold_for_move` with `m`, `transform_vertices`, then
    /// `integrate_moved` on the vertices' edges in their one definition, exactly as
    /// `move_and_integrate` does today.
    pub fn transform_and_integrate(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error>;

    /// Unchanged signatures, now `transform_vertices(verts, &mat_translation(offset))`
    /// and `transform_and_integrate(verts, &mat_translation(offset))`.
    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;
    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error>;

    /// Was `fold_for_move(verts, offset)`: the target position of a vertex in
    /// `verts` is `mat_apply(m, pos)`. Diagonals are still judged in the face's
    /// current plane. Same contract otherwise (holes refused with `NotPlanar`).
    pub(crate) fn fold_for_move(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error>;

    /// Was `copy_geometry(ctx, faces, edges, offset)` in substance: new vertices at
    /// `mat_apply(m, pos)`, face normals through `mat_apply_dir`, then
    /// `integrate_moved`. Same `Copied`, same lock and `Empty` rules.
    pub fn copy_geometry_transformed(&mut self, ctx: DefId, faces: &[FId], edges: &[EId], m: &Mat4) -> Result<Copied, Error>;

    /// Unchanged signature: `copy_geometry_transformed(ctx, faces, edges, &mat_translation(offset))`.
    pub fn copy_geometry(&mut self, ctx: DefId, faces: &[FId], edges: &[EId], offset: V3) -> Result<Copied, Error>;
}
```

#### Kernel instances (`kernel/src/group.rs`)

```rust
impl Document {
    /// `copy_instance` with the copy's transform `mat_mul(m, &src.transform)`
    /// (`m` in the parent's coordinates). Same deep copy, same lock rules.
    pub fn copy_instance_transformed(&mut self, inst: InstId, m: &Mat4) -> Result<InstId, Error>;

    /// Unchanged signature: `copy_instance_transformed(inst, &mat_translation(offset))`.
    pub fn copy_instance(&mut self, inst: InstId, offset: V3) -> Result<InstId, Error>;
}
```

#### Kernel offset (`kernel/src/offset.rs`, new; `kernel/src/lib.rs`)

```rust
// lib.rs
pub mod offset;
pub enum Error {
    // ...existing variants...
    /// An offset outline would cross itself, reverse an edge or lose its area.
    SelfIntersecting,
}
// Display: "that offset would cross itself"

// offset.rs
/// Pure: `pts` offset by `d` along each edge's right-hand normal in the plane
/// basis (`(dy, -dx)` of the edge direction: outward for a counter-clockwise loop,
/// into the hole for a clockwise one, to the right of an open chain's direction),
/// corners mitred where consecutive offset lines meet, a collinear corner moved
/// straight across. For an open chain (`closed == false`) the two ends are offset
/// perpendicular to their edge. `None` when the result self-intersects, an edge's
/// direction reverses against its original, two consecutive points coincide
/// within `tol::LENGTH`, or a closed loop's signed area changes sign or drops under
/// `tol::AREA`. `pts.len() >= 3` for a loop, `>= 2` for a chain.
pub fn offset_loop(pts: &[P2], d: f64, closed: bool) -> Option<Vec<P2>>;

impl Document {
    /// Offset a face's outer loop and holes in its plane: `distance > 0` moves every
    /// loop away from the face's interior, `< 0` toward it. Each offset loop is
    /// drawn through `insert_segment` and the drawn edges healed with
    /// `heal_around`, so an inward offset splits the face into a ring and an inner
    /// face, and an outward one adds a ring around it. Returns the edges drawn.
    /// `Error::SelfIntersecting` when `offset_loop` refuses any loop; nothing is
    /// written then. `Error::Degenerate` for a non-finite or `|distance| <= LENGTH`
    /// value; `Error::Locked` for a locked owner (ADR mvr2opid).
    pub fn offset_face(&mut self, f: FId, distance: f64) -> Result<Vec<EId>, Error>;

    /// Offset a chain of edges of `ctx`: the edges must form one connected path
    /// (open, or closed) and lie in one plane; `distance > 0` is to the right of
    /// the chain's direction (`dir × plane.normal`, the chain taken from the edge
    /// listed first), as `offset_loop` offsets an open chain. The plane is the chain's own (`Plane::from_loop` of its
    /// points) or, for a single edge or a collinear chain, the plane of a face a
    /// chain edge bounds; `Error::Degenerate("edges do not lie in one plane")` or
    /// `("edges are not one chain")` otherwise. Drawn and healed like
    /// `offset_face`. Returns the edges drawn.
    pub fn offset_edges(&mut self, ctx: DefId, edges: &[EId], distance: f64) -> Result<Vec<EId>, Error>;
}
```

#### Fuzz harness (`kernel/tests/common/fuzz.rs`)

```rust
pub enum Op {
    // ...existing variants...
    /// Vertices of the face found by `face_containing(ROOT, point, normal)`, rotated
    /// by `angle` radians about the axis through `point` along `axis`
    /// (`transform_and_integrate` with `mat_rotation`).
    Rotate { point: V3, normal: V3, axis: V3, angle: f64 },
    /// `offset_face` of the face found as above by `distance` (signed).
    Offset { point: V3, normal: V3, distance: f64 },
}
// name(): "Rotate", "Offset". render_op renders both. generate(): weights
// [i64; 12], the two new slots low (Rotate 4, Offset 4 of a total near 100) and
// zero when crowded; Rotate picks an axis among X, Y, Z (and the face normal) and
// an angle from {±15°, ±30°, ±45°, ±90°, ±180°, a random one}; Offset picks a
// distance in [-12, 12] \ {0}.
```

#### Wasm (`kernel-wasm/src/lib.rs`)

```rust
impl Kernel {
    /// Preview transform of vertices by a column-major 4×4 (16 numbers).
    #[wasm_bindgen(js_name = transformVertices)]
    pub fn transform_vertices(&mut self, verts: Vec<u32>, m: Vec<f64>) -> Result<(), JsError>;

    /// Committed transform: fold, transform, weld and settle.
    #[wasm_bindgen(js_name = transformAndIntegrate)]
    pub fn transform_and_integrate(&mut self, verts: Vec<u32>, m: Vec<f64>) -> Result<(), JsError>;

    /// Copy loose geometry under a transform. JSON `{ faces, edges }` as `copyGeometry`.
    #[wasm_bindgen(js_name = copyGeometryTransformed)]
    pub fn copy_geometry_transformed(&mut self, ctx: u32, faces: Vec<u32>, edges: Vec<u32>, m: Vec<f64>) -> Result<String, JsError>;

    /// Copy an instance as a new group under a transform (parent coordinates).
    #[wasm_bindgen(js_name = copyInstanceTransformed)]
    pub fn copy_instance_transformed(&mut self, inst: u32, m: Vec<f64>) -> Result<u32, JsError>;

    /// Offset a face's outline. Returns the edges drawn.
    #[wasm_bindgen(js_name = offsetFace)]
    pub fn offset_face(&mut self, face: u32, distance: f64) -> Result<Vec<u32>, JsError>;

    /// Offset an edge chain of `ctx`. Returns the edges drawn.
    #[wasm_bindgen(js_name = offsetEdges)]
    pub fn offset_edges(&mut self, ctx: u32, edges: Vec<u32>, distance: f64) -> Result<Vec<u32>, JsError>;
}
// A 16-number check as setTransform's ("a transform needs 16 numbers").
// moveVertices, moveAndIntegrate, copyGeometry, copyInstance are unchanged.
```

#### Model (`app/src/kernel/model.ts`)

```ts
export class Model {
  /** Preview transform of vertices (context coordinates). */
  transformVertices(verts: number[], m: Mat4): void;
  /** Committed transform: folds, transforms, welds and settles. */
  transformAndIntegrate(verts: number[], m: Mat4): void;
  /** Copy loose geometry of `ctx` under `m` (context coordinates); welds where it lands. */
  copyGeometryTransformed(ctx: number, faces: number[], edges: number[], m: Mat4): { faces: number[]; edges: number[] };
  /** Copy an instance as a new group under `m` (parent coordinates). */
  copyInstanceTransformed(inst: number, m: Mat4): number;
  /** Offset a face's outline; positive is outward. Returns the edges drawn. */
  offsetFace(face: number, distance: number): number[];
  /** Offset an edge chain of `ctx`; positive is to the chain's right. Returns the edges drawn. */
  offsetEdges(ctx: number, edges: number[], distance: number): number[];
}
```

All through `changed()` like `moveAndIntegrate` and `copyGeometry` (model.ts:147-166), called inside a transaction.

#### App math (`app/src/math.ts`)

```ts
/** Rotation of `angle` radians about the axis through `center` along `axis`
 *  (right-hand rule), column-major like `translation`; the kernel's `mat_rotation`. */
export function rotation(center: Vec3, axis: Vec3, angle: number): Mat4;
```

#### Units (`app/src/units.ts`)

```ts
/**
 * Parse an angle typed into the Measurements box, in degrees: `37`, `37°`,
 * `37deg`, `-15`, `22.5`, `1/2`. Whitespace and case are ignored. NaN otherwise
 * (and for every array spelling, so callers try `parseArray` first).
 */
export function parseAngle(text: string): number;

/** Degrees to one decimal with the sign, e.g. `37°`, `-22.5°`. */
export function formatAngle(degrees: number): string;
```

#### Tool framework (`app/src/tools/tool.ts`)

```ts
export interface Overlay {
  // ...existing fields...
  /** The Rotate tool's protractor: a circle in the plane, tick marks every 15°,
   *  and, once a start direction exists, the start ray and the swept arc. */
  protractor?: {
    center: Vec3;
    /** Unit normal of the protractor's plane (the rotation axis). */
    normal: Vec3;
    radius: number;
    /** Unit direction of the start ray, in the plane. */
    start?: Vec3;
    /** Swept angle in radians, counter-clockwise about `normal`. */
    angle?: number;
  } | null;
}
```

`ToolHost`, `Tool`, `ToolPointer` and `Selection` are unchanged.

#### Rotate tool (`app/src/tools/rotate.ts`, new)

```ts
interface Rotating {
  center: Vec3;          // world
  normal: Vec3;          // world, unit
  start: Vec3 | null;    // unit direction in the plane, null until the second click
  angle: number;         // radians, the last angle the kernel accepted
  verts: number[];
  instances: { id: number; transform: Mat4 }[];
  copy: boolean;
  selection: Selected;   // the move.ts triple {faces, edges, instances}
}

/**
 * Rotate: with something selected (or hovering it), click the centre, click a
 * start direction, then sweep or type the angle. The protractor lies on the
 * face under the cursor, on a face of the hovered edge (the one facing the
 * camera), else on the ground; arrow keys lock it to an axis. 15° snapping when
 * the cursor is on nothing. With the copy modifier held the original stays and
 * a rotated copy is placed; `6x` or `/6` typed afterwards makes a radial array.
 */
export class RotateTool implements Tool {
  readonly id = "rotate";
  get cursor(): string;                 // "copy" while copying, else "crosshair"
  hint(): string;
  vcbLabel(): string;                   // "Angle"
  busy(): boolean;                      // a centre is set
  modifier(copy: boolean): void;        // as MoveTool.modifier
  deactivate(): void;
  move(p: ToolPointer): void;
  down(p: ToolPointer): void;
  up(p: ToolPointer, dragged: boolean): void;
  key(key: string): boolean;            // Escape cancels
  vcb(text: string): void;              // parseArray first, then parseAngle
}
```

Contracts:

- `move` while idle: infer with no anchor; show `hoverEntity` (as Move does) and a protractor preview at the inference point with the plane from `protractorNormal(r)`: a face hit (`r.face`) gives its world normal flipped toward the camera; an `onEdge` or `midpoint` result with `r.edge` gives the normal of a face of that edge (`model.edgeFaces(id)`, `model.facePlane(f).normal` taken through the item's matrix with `applyDir`; the one with the larger `dot(n, -ray.dir)` when two), flipped toward the camera; nothing gives `[0, 0, 1]`; `host.inference.lockAxis !== null` overrides with that axis.
- `down` while idle: the Move pick-up rules (selection or hover pick, locked refused with the toast), then `rotating` with the centre and normal; `model.begin("Rotate")` is not called yet. `lastCopy` is cleared.
- `move` with a centre and no start: infer with `{ plane: planeFrom(center, normal) }`; the start ray is `norm(sub(r.point, center))` projected into the plane; the protractor shows it.
- `down` with a centre and no start: fix `start`; `model.begin("Rotate")`.
- `move` with a start: the current direction as above; `angle = atan2(dot(cross(start, dir), normal), dot(start, dir))`; snapped to the nearest 15° when `r.kind` is `ground`, `plane` or `onFace`; then `apply(angle)`: abort, begin "Rotate", `transformVertices(verts, rotation(toLocal(center), toLocalDir(normal), angle))` and `setTransform(inst, mul(rotation(...), inst.transform))` per instance, keeping the last good angle on a kernel error as `MoveTool.apply` does; `setVcb(formatAngle(deg))`; overlay with the protractor, `dims: [{ pos: on the arc's midpoint, text: formatAngle }]`.
- `down` with a start, or `up` after a drag with a non-zero angle: `commit()`: abort the preview; a plain rotate runs `transformAndIntegrate` and `setTransform` in one "Rotate" transaction; a copy runs `makeCopies(selection, [m])` in one "Copy" transaction and records `lastCopy = { selection, center, normal, angle, count: 1, revision }`; `last = { center, normal, start, copy, selection }` for retyping; angle under 1e-6 aborts.
- `vcb`: `parseArray` → `array(spec)` as in Move (undo the last Copy, replay `rotation(center, normal, angle * k)` or `angle * k / n` for `k = 1..n`, one "Copy" transaction, the revision guard, "Copy something first"); else `parseAngle` in degrees: with a start, `apply(deg)` then `commit()`; with a centre but no start, flash "Pick a start direction first"; after a commit, undo and redo with the new angle as Move's retype does (a copy only while it is the last step); else flash "Rotate something first". Unparseable: flash "Type an angle like 37 or -15".
- `key("Escape")` with a centre: `deactivate()`, which aborts the preview if begun, clears `rotating`, `lastCopy` and `pendingCopy`, unlocks inference, clears the overlay.

#### Offset tool (`app/src/tools/offset.ts`, new)

```ts
interface Offsetting {
  target: { face: number } | { edges: number[] };
  /** World plane of the face or chain. */
  plane: Plane;
  /** For a face: the boundary edge nearest the first click, as a world line, and
   *  its inward normal in the plane. For a chain: the chain's first edge and
   *  `normal × dir` (left). */
  ref: { origin: Vec3; dir: Vec3; inward: Vec3 };
  /** The first click, projected into the plane. */
  startDist: number;
  /** Last distance the kernel accepted, in the tool's sign (positive = inward / left). */
  good: number;
  /** The last kernel error flashed, so a refused preview flashes once. */
  flashed: string | null;
}

/**
 * Offset: hover a face (or select a chain of edges first), click, move to set the
 * distance, click again, or type it. The distance is the cursor's travel toward
 * the inside of the face from the edge nearest the first click; for a chain, to
 * the cursor's side of it. An offset that would cross itself is refused.
 */
export class OffsetTool implements Tool {
  readonly id = "offset";
  readonly cursor = "crosshair";
  hint(): string;
  vcbLabel(): string;                   // "Distance"
  busy(): boolean;
  deactivate(): void;
  move(p: ToolPointer): void;
  down(p: ToolPointer): void;
  up(p: ToolPointer, dragged: boolean): void;
  key(key: string): boolean;            // Escape cancels
  vcb(text: string): void;              // parseLength
}
```

Contracts:

- Idle `move`: with edges selected (`selection.ids("edge")` non-empty, no faces) show the chain as `hoverEntity`-style highlight of those edges (through `segments` of their endpoints); else pick a face as `PushPullTool.pickFace` does and show `hover`.
- `down` while idle: for a face hit, `target = {face}`, plane from the hit, `ref` from the nearest boundary edge (`model.faceEdges`, `model.edgeInfo`, world through the item's matrix; inward = `cross(normal, dir)` flipped to point at the face's interior point); for a chain, `target = {edges}` with the plane from the edges' endpoints (Newell, `planeFrom`) or, when collinear, the plane of `model.edgeFaces` of the first edge (flash "Select edges that lie in one plane" when none); `startDist = dot(sub(click, ref.origin), ref.inward)`; `model.begin("Offset")`; `good = 0`. A locked context is refused with the toast before anything is begun.
- `move` with a target: infer with `{ plane }`; `d = dot(sub(r.point, ref.origin), ref.inward) - startDist`; `apply(d)`: abort, begin "Offset", `offsetFace(face, -d)` or `offsetEdges(ctx, edges, -d)` (kernel sign: outward / right positive; the tool's is inward / left), `refresh({ preview: true })`; a kernel error keeps `good` and flashes its message once per distinct message (`flashed`); `setVcb(format(|d|))`; overlay `dims` at the cursor with the distance.
- `down` with a target, or `up` after a drag: `commit()`: `|good| < 1e-3` aborts; else `model.commit()` and `last = { target, distance: good }`.
- `vcb`: `parseLength`; with a target, `want = (sign(good) || 1) * d` (inward for a face, left for a chain, before any movement), `apply(want)`; if the kernel refused, flash and stay; else commit. After a commit, undo and rerun with `(sign(last.distance) || 1) * d` in one "Offset" transaction as `PushPullTool.run` does. Else flash "Offset a face or a chain of edges first".

#### App shell (`app/src/app.ts`, `app/index.html`)

- `tools` gains `rotate: new RotateTool(this)` and `offset: new OffsetTool(this)`; `keys` gains `q: "rotate"`, `f: "offset"`.
- `drawOverlay` renders `o.protractor` into a `"protractor"` segment layer (style `"preview"`): a 72-segment circle, tick marks every 15° (longer every 90°), the start ray and the arc from `start` to `start` rotated by `angle` when present; cleared otherwise.
- `index.html` gains Rotate (Q) and Offset (F) tool buttons after Move.

### Data Models

- **Transform under the lock.** `transform_vertices` checks each vertex's owner with `check_def_unlocked` as `move_vertices` does today; the other entry points follow their offset forms.
- **Normals through a transform.** Faces are partitioned by `transform_vertices` into fully moved (every loop vertex in the set: plane normal set to `mat_apply_dir(m, normal)` before `refresh_face`) and partly moved (normal kept). `copy_geometry_transformed` passes `mat_apply_dir(m, face.plane.normal)` as the `add_face` hint.
- **Offset loops in 3D.** `offset_face` works in the face's `plane.basis()`: outer and holes to `P2`, `offset_loop` on each (outer counter-clockwise, holes clockwise, as stored), back to 3D as `u * x + v * y + normal * d`; every loop must succeed before any segment is inserted. The drawn edges of all loops are healed together in one `heal_around`.
- **Chain in `offset_edges`.** Edges ordered into a path by shared vertices (each inner vertex used twice, the ends once; a closed chain has no ends); the chain's direction is from the first listed edge's first vertex. The points go through `offset_loop(pts, d, closed)`.
- **Fuzz weights.** `generate` weights become `[12, 20, 15, 8, 6, 8, 3, 5, 4, 3, 4, 4]` (line, rect, push/pull, move, erase face, erase edge, group, intersect, undo, redo, rotate, offset) and `[0, 0, 0, 0, 20, 70, 0, 0, 10, 0, 0, 0]` when crowded.
- **`LastCopy` for rotation.** `{ selection, center, normal, angle, count, revision }`, the revision guard as in Move.

### Examples

```rust
// kernel: a stringer face rotated 37° about the Z axis through its corner
let m = mat_rotation(v(0.0, 0.0, 0.0), V3::Z, 37f64.to_radians()).unwrap();
let verts = d.vertices_of(&faces(&d, ROOT), &[]);
d.transform_and_integrate(&verts, &m)?;           // welds and settles as a move does

// kernel: a rotated copy of a box about its right edge welds into one solid
let m = mat_rotation(v(10.0, 0.0, 0.0), V3::Z, std::f64::consts::PI).unwrap();
d.copy_geometry_transformed(ROOT, &faces, &edges, &m)?;

// kernel: wall thickness
let ring_edges = d.offset_face(wall, -4.0)?;     // inward: ring + inner face
// kernel: a chain
let drawn = d.offset_edges(ROOT, &[e1, e2], 2.0)?;
```

```ts
// app: the Rotate tool's preview
model.transformVertices(verts, rotation(host.toLocal(center), host.toLocalDir(normal), angle));
model.setTransform(inst.id, mul(rotation(host.toLocal(center), host.toLocalDir(normal), angle), inst.transform));
// app: radial array of the last rotate-copy
for (let k = 1; k <= n; k++) ms.push(rotation(center, normal, kind === "times" ? angle * k : (angle * k) / n));
// app: the Offset tool's preview (tool sign inward / left positive, kernel outward / right positive)
model.offsetFace(face, -d);
model.offsetEdges(ctx, edges, -d);
```

## Validation Criteria

```bash
cargo test --workspace
# kernel/src/math.rs: mat_rotation unit tests (90° about Z maps X to Y; centre fixed; angle 0 is IDENTITY; zero axis None)
# kernel/src/offset.rs: offset_loop unit tests (square in and out, triangle, collinear corner, open chain, self-intersecting None)
# kernel/tests/rotate.rs: box rotated whole stays closed with the same volume; box top rotated about its front edge is a
#   closed 6-face wedge; a top edge rotated folds the walls; a copy rotated 180° about a shared edge welds into one solid
#   (volume doubles); copy_instance_transformed transform == rotation × original; locked refused; validate after each
# kernel/tests/move.rs, copy.rs: unchanged and passing through the wrappers
# kernel/tests/offset.rs: 120×96 face inward 4" → ring + 112×88 inner (2 faces, 8 edges, areas); outward 3" → 126×102 ring;
#   face with a hole offsets the hole; L-shape past its notch → Error::SelfIntersecting, document unchanged; two-edge chain
#   2" → 2 edges, no face; chain on a face splits it; non-chain refused; locked refused; undo removes the offset
# kernel/tests/fuzz.rs: Rotate and Offset generated; random_operations_keep_invariants under 60 s (debug)
cargo run --release --example bench -p builder-kernel
npm test
# app/test/math.test.ts: rotation matches translation/mul conventions; 90° about Z; centre fixed
# app/test/units.test.ts: parseAngle accepts 37 37° 37deg -15 22.5, NaN for 5x and ""; formatAngle
# app/test/rotate.test.ts: stringer group typed 37 → transform == rotation(centre, Z, 37°) × original; retype 30; one undo
#   "Rotate"; sweep 22° on nothing → 15° and dims "15°"; sweep to an endpoint → exact; protractor normal from face, edge
#   (camera-facing), ground, arrow lock; top face rotated 10° about its front edge stays 6 faces; Esc; locked toast;
#   rotate-copy 60° then 5x → 6 instances, one undo; /6 after 180° → 6 evenly; 6x after a plain rotate → "Copy something first"
# app/test/offset.test.ts: front wall inward 4" → faces + 1, inner 112×88; Push/Pull of the ring; retype 6"; window outward 3"
#   → ring; negative flips; two selected L edges 2" → edges + 2; L-shaped face too far → flash, model unchanged
npm run typecheck
```

Browser check (Patrick): `docs/walkthrough-deck.md` steps for the stair (Rotate, type `37`) and the railing (Offset `1 1/2"`, Push/Pull, Copy with `/5`).
