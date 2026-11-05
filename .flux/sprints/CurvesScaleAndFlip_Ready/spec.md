# Specification: CurvesScaleAndFlip

Signatures, schemas and contracts, never function bodies.

## Baseline

Definition listing of the modules this sprint touches, taken at plan time (`flux repomap` could not run in this session; the listing is in the repomap's format so close Gate 2 can diff against it the way sprint 07's close did).

```
commit: a54f4c2
mode: definition grep (flux repomap unavailable in this session), unbudgeted

kernel/src/lib.rs:
│28:pub mod check;
│29:pub mod doc;
│30:pub mod edit;
│31:pub mod format;
│32:pub mod group;
│33:pub mod guide;
│34:pub mod heal;
│35:pub mod intersect;
│36:pub mod line;
│37:pub mod math;
│38:pub mod mesh;
│39:pub mod offset;
│40:pub mod pushpull;
│41:pub mod tol;
│42:pub mod topo;
│51:pub enum Error {
│72:impl std::fmt::Display for Error {
│73:    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
│88:impl std::error::Error for Error {}

kernel/src/doc.rs:
│18:        pub struct $name(pub u32);
│19:        impl $name {
│20:            pub fn idx(self) -> usize {
│37:pub const ROOT: DefId = DefId(0);
│40:pub type AttrValue = serde_json::Value;
│44:pub type Attributes = BTreeMap<String, BTreeMap<String, AttrValue>>;
│48:pub enum AttrTarget {
│56:pub(crate) fn check_attribute(ns: &str, key: &str, value: Option<&AttrValue>) -> Result<(), String> {
│73:pub struct Vertex {
│80:pub struct Edge {
│86:impl Edge {
│87:    pub fn other(&self, v: VId) -> VId {
│97:pub struct Face {
│112:impl Face {
│113:    pub fn loops(&self) -> impl Iterator<Item = &Vec<VId>> {
│117:    pub fn flat_vertices(&self) -> Vec<VId> {
│124:pub enum DefKind {
│131:pub struct Definition {
│138:pub struct Instance {
│150:pub struct Material {
│158:pub struct Tag {
│168:pub enum GuideShape {
│182:pub struct Guide {
│189:pub struct Arena<T> {
│193:impl<T> Default for Arena<T> {
│194:    fn default() -> Self {
│199:impl<T> Arena<T> {
│200:    pub fn get(&self, i: usize) -> Option<&T> {
│203:    pub fn len_slots(&self) -> usize {
│206:    pub fn iter(&self) -> impl Iterator<Item = (usize, &T)> {
│209:    pub fn count(&self) -> usize {
│212:    fn put(&mut self, i: usize, v: Option<T>) -> Option<T> {
│222:pub enum Change {
│236:pub struct Transaction {
│242:pub struct Document {
│262:        pub fn $get(&self, id: $id) -> Option<&$ty> {
│266:        pub fn $set(&mut self, id: $id, value: Option<$ty>) {
│274:impl Document {
│275:    pub fn new() -> Self {
│294:    pub fn next_vid(&self) -> VId {
│297:    pub fn next_eid(&self) -> EId {
│300:    pub fn next_fid(&self) -> FId {
│303:    pub fn next_def(&self) -> DefId {
│306:    pub fn next_inst(&self) -> InstId {
│309:    pub fn next_mat(&self) -> MatId {
│312:    pub fn next_guide(&self) -> GuideId {
│316:    pub fn guides_visible(&self) -> bool {
│320:    pub fn set_guides_visible(&mut self, visible: bool) {
│326:    pub fn pos(&self, v: VId) -> V3 {
│334:    pub fn begin(&mut self, name: &str) {
│341:    pub fn in_transaction(&self) -> bool {
│346:    pub fn commit(&mut self) -> bool {
│358:    pub fn abort(&mut self) {
│366:    pub fn undo(&mut self) -> Option<String> {
│379:    pub fn redo(&mut self) -> Option<String> {
│392:    pub fn can_undo(&self) -> bool {
│395:    pub fn can_redo(&self) -> bool {
│398:    pub fn undo_name(&self) -> Option<&str> {
│403:    pub fn pending_changes(&self) -> &[Change] {
│408:    pub fn clear_history(&mut self) {
│415:    fn apply(&mut self, c: &Change, backwards: bool) {
│437:    pub fn faces_in(&self, ctx: DefId) -> impl Iterator<Item = (FId, &Face)> {
│440:    pub fn edges_in(&self, ctx: DefId) -> impl Iterator<Item = (EId, &Edge)> {
│443:    pub fn vertices_in(&self, ctx: DefId) -> impl Iterator<Item = (VId, &Vertex)> {
│446:    pub fn guides_in(&self, ctx: DefId) -> impl Iterator<Item = (GuideId, &Guide)> {
│449:    pub fn instances_in(&self, ctx: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
│452:    pub fn instances_of(&self, def: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
│459:    pub fn new_instance(&mut self, definition: DefId, parent: DefId) -> InstId {
│478:    pub fn attributes(&self, t: AttrTarget) -> Option<&Attributes> {
│487:    pub fn set_attribute(
│530:    pub fn new_tag(&mut self, name: &str) -> TagId {
│537:    pub fn set_tag(&mut self, inst: InstId, tag: Option<TagId>) -> Result<(), Error> {
│547:    pub fn set_tag_flags(&mut self, tag: TagId, visible: bool, locked: bool) -> Result<(), Error> {

kernel/src/topo.rs:
│10:impl Document {
│12:    pub fn find_vertex(&self, ctx: DefId, p: V3) -> Option<VId> {
│23:    pub fn add_vertex(&mut self, ctx: DefId, p: V3) -> VId {
│30:    pub fn vertex_at(&mut self, ctx: DefId, p: V3) -> VId {
│34:    pub fn edge_between(&self, a: VId, b: VId) -> Option<EId> {
│40:    pub fn add_edge(&mut self, a: VId, b: VId) -> Result<EId, Error> {
│59:    pub fn remove_edge(&mut self, e: EId) {
│79:    pub fn remove_face(&mut self, f: FId) {
│93:    pub fn face_edges(&self, face: &Face) -> Vec<EId> {
│105:    pub fn loop_points(&self, lp: &[VId]) -> Vec<V3> {
│112:    pub fn add_face(
│150:    pub fn prepare_face(&self, face: &mut Face, normal: Option<V3>) -> Result<(), Error> {
│185:    fn triangulate(&self, face: &Face) -> Result<Vec<u32>, Error> {
│215:    pub fn refresh_face(&mut self, f: FId) -> Result<(), Error> {
│228:    pub fn flip_face(&mut self, f: FId) -> Result<(), Error> {
│243:    pub fn split_edge(&mut self, e: EId, p: V3) -> Result<VId, Error> {
│292:    pub fn face_area(&self, f: FId) -> f64 {
│305:fn insert_between(lp: &mut Vec<VId>, a: VId, b: VId, w: VId) {

kernel/src/edit.rs:
│17:pub struct Copied {
│22:impl Document {
│25:    pub fn copy_geometry(
│42:    pub fn copy_geometry_transformed(
│103:    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│115:    pub fn transform_vertices(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error> {
│148:    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
│156:    pub fn transform_and_integrate(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error> {
│181:    pub(crate) fn fold_for_move(&mut self, verts: &[VId], m: &Mat4) -> Result<(), Error> {
│234:    pub(crate) fn integrate_moved(&mut self, def: DefId, edges: &[EId]) -> Result<(), Error> {
│279:    pub(crate) fn edges_of_vertices(&self, verts: &[VId]) -> Vec<EId> {
│293:    pub(crate) fn merge_vertex_into(&mut self, from: VId, into: VId) -> Result<(), Error> {
│364:    pub fn vertices_of(&self, faces: &[FId], edges: &[EId]) -> Vec<VId> {
│381:    pub fn erase(&mut self, faces: &[FId], edges: &[EId]) -> Result<(), Error> {
│444:    pub fn dissolve_vertex(&mut self, v: VId) -> Result<bool, Error> {
│490:fn is_planar(pts: &[V3]) -> bool {
│502:pub fn fold_diagonals(pts: &[V3], normal: V3) -> Vec<(usize, usize)> {
│514:fn fold_pieces(pts: &[V3], flat: &[P2], normal: V3) -> (Vec<(usize, usize)>, Vec<Vec<usize>>) {
│522:fn split_piece(
│565:fn area2(a: P2, b: P2, c: P2) -> f64 {
│572:fn is_diagonal(poly: &[P2], i: usize, j: usize) -> bool {
│609:mod tests {
│613:    fn fold_hinges_between_the_lifted_corners_neighbours() {
│631:    fn a_bent_hexagon_folds_into_planar_pieces() {
│652:    fn fold_diagonals_stay_inside_a_notched_face() {

kernel/src/pushpull.rs:
│11:pub enum PushPullMode {
│21:pub struct PushPullResult {
│27:impl Document {
│29:    pub fn push_pull(&mut self, f: FId, distance: f64) -> Result<PushPullResult, Error> {
│56:    fn can_stretch(&self, f: FId, face: &Face) -> bool {
│79:    fn stretch(&mut self, face: &Face, distance: f64) -> Result<(), Error> {
│99:    fn extrude(&mut self, f: FId, face: &Face, distance: f64) -> Result<PushPullResult, Error> {
│163:    fn settle(&mut self, ctx: DefId, created: &[FId], cap: FId) -> Result<bool, Error> {
│171:    pub(crate) fn settle_faces(&mut self, ctx: DefId, faces: &[FId]) -> Result<Vec<FId>, Error> {
│210:    pub(crate) fn integrate_edges(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error> {
│252:    pub(crate) fn cancel_against_opposite(&mut self, ctx: DefId, f: FId) -> Result<bool, Error> {
│280:    pub fn face_containing(&self, ctx: DefId, p: V3, normal: V3) -> Option<FId> {
│293:    pub(crate) fn remove_coincident_faces(&mut self, ctx: DefId, plane: &Plane, f: FId) -> bool {
│317:    pub(crate) fn with_face(&mut self, f: FId, edit: impl FnOnce(&mut Face)) {
│325:    pub fn face_interior_point(&self, f: FId) -> Option<V3> {
│335:    pub fn face_normal(&self, f: FId) -> Option<V3> {

kernel/src/offset.rs:
│22:pub fn offset_loop(pts: &[P2], d: f64, closed: bool) -> Option<Vec<P2>> {
│84:fn mitre(a1: P2, d1: P2, a2: P2, d2: P2, corner: P2, d: f64) -> Option<P2> {
│98:fn area2(a: P2, b: P2, c: P2) -> f64 {
│104:fn segments_meet(a: P2, b: P2, c: P2, d: P2) -> bool {
│121:impl Document {
│130:    pub fn offset_face(&mut self, f: FId, distance: f64) -> Result<Vec<EId>, Error> {
│152:    pub fn offset_edges(&mut self, ctx: DefId, edges: &[EId], distance: f64) -> Result<Vec<EId>, Error> {
│176:    fn chain_of(&self, ctx: DefId, edges: &[EId]) -> Result<(Vec<VId>, bool), Error> {
│232:    fn draw_loops(&mut self, ctx: DefId, loops: &[Vec<V3>], closed: bool) -> Result<Vec<EId>, Error> {
│246:fn check_distance(distance: f64) -> Result<(), Error> {
│257:fn lift(plane: &Plane, u: V3, v: V3, p: P2) -> V3 {
│262:mod tests {
│265:    fn close(a: &[P2], b: &[P2]) -> bool {
│271:    fn a_square_offsets_in_and_out() {
│284:    fn a_triangle_mitres_its_corners() {
│299:    fn a_collinear_corner_moves_straight_across() {
│306:    fn an_open_chain_offsets_its_ends_square() {
│320:    fn an_offset_that_crosses_itself_is_none() {

kernel/src/mesh.rs:
│7:pub struct FaceBuffers {
│17:pub struct EdgeBuffers {
│24:impl Document {
│25:    pub fn face_buffers(&self, def: DefId) -> FaceBuffers {
│42:    pub fn edge_buffers(&self, def: DefId) -> EdgeBuffers {

kernel/src/format.rs:
│12:pub const FORMAT: &str = "builder";
│13:pub const VERSION: u32 = 1;
│16:struct File {
│37:fn default_true() -> bool {
│43:enum FileGuide {
│49:struct FileDefinition {
│63:type FileAttributes = BTreeMap<String, Value>;
│66:struct FileFace {
│79:struct FileInstance {
│93:impl Document {
│95:    pub fn to_json(&self) -> String {
│187:    pub fn from_json(text: &str) -> Result<Document, Error> {
│350:fn write_attributes(attrs: &Attributes) -> FileAttributes {
│361:fn read_attributes(raw: &FileAttributes, path: &str) -> Result<Attributes, Error> {
│377:fn has_cycle(n: usize, links: impl Iterator<Item = (usize, usize)>) -> bool {
│384:    fn visit(d: usize, children: &[Vec<usize>], state: &mut [u8]) -> bool {

kernel/src/math.rs:
│10:pub struct V3 {
│16:impl From<[f64; 3]> for V3 {
│17:    fn from(a: [f64; 3]) -> Self {
│22:impl From<V3> for [f64; 3] {
│23:    fn from(v: V3) -> Self {
│28:impl V3 {
│29:    pub const ZERO: V3 = V3 { x: 0.0, y: 0.0, z: 0.0 };
│30:    pub const X: V3 = V3 { x: 1.0, y: 0.0, z: 0.0 };
│31:    pub const Y: V3 = V3 { x: 0.0, y: 1.0, z: 0.0 };
│32:    pub const Z: V3 = V3 { x: 0.0, y: 0.0, z: 1.0 };
│34:    pub const fn new(x: f64, y: f64, z: f64) -> Self {
│37:    pub fn dot(self, o: V3) -> f64 {
│40:    pub fn cross(self, o: V3) -> V3 {
│43:    pub fn len(self) -> f64 {
│46:    pub fn dist(self, o: V3) -> f64 {
│50:    pub fn unit(self) -> Option<V3> {
│54:    pub fn lerp(self, o: V3, t: f64) -> V3 {
│57:    pub fn is_finite(self) -> bool {
│62:impl Add for V3 {
│63:    type Output = V3;
│64:    fn add(self, o: V3) -> V3 {
│68:impl Sub for V3 {
│69:    type Output = V3;
│70:    fn sub(self, o: V3) -> V3 {
│74:impl Mul<f64> for V3 {
│75:    type Output = V3;
│76:    fn mul(self, s: f64) -> V3 {
│80:impl Neg for V3 {
│81:    type Output = V3;
│82:    fn neg(self) -> V3 {
│89:pub struct Plane {
│94:impl Plane {
│95:    pub fn from_point_normal(p: V3, n: V3) -> Option<Plane> {
│103:    pub fn from_loop(pts: &[V3]) -> Option<Plane> {
│121:    pub fn dist(&self, p: V3) -> f64 {
│124:    pub fn contains(&self, p: V3) -> bool {
│127:    pub fn flipped(&self) -> Plane {
│131:    pub fn same_surface(&self, o: &Plane) -> bool {
│142:    pub fn basis(&self) -> (V3, V3) {
│148:    pub fn project(&self, p: V3) -> V3 {
│154:    pub fn intersect(&self, o: &Plane) -> Option<(V3, V3)> {
│168:pub fn bbox(points: impl Iterator<Item = V3>) -> Option<(V3, V3)> {
│183:pub fn bbox_overlap_3d(a: (V3, V3), b: (V3, V3)) -> bool {
│194:pub type P2 = [f64; 2];
│196:pub fn to_2d(p: V3, u: V3, v: V3) -> P2 {
│201:pub fn signed_area2(pts: &[P2]) -> f64 {
│213:pub fn point_in_polygon(p: P2, poly: &[P2]) -> bool {
│231:pub fn point_segment(p: V3, a: V3, b: V3) -> (f64, f64) {
│243:pub fn segment_segment(p0: V3, p1: V3, q0: V3, q1: V3) -> Option<(f64, f64, f64)> {
│270:pub type Mat4 = [f64; 16];
│272:pub const IDENTITY: Mat4 = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
│274:pub fn mat_translation(t: V3) -> Mat4 {
│285:pub fn mat_rotation(center: V3, axis: V3, angle: f64) -> Option<Mat4> {
│310:pub fn mat_apply_dir(m: &Mat4, d: V3) -> V3 {
│319:pub fn mat_is_finite(m: &Mat4) -> bool {
│323:pub fn mat_mul(a: &Mat4, b: &Mat4) -> Mat4 {
│333:pub fn mat_apply(m: &Mat4, p: V3) -> V3 {
│342:pub fn mat_invert(m: &Mat4) -> Option<Mat4> {
│382:mod tests {
│385:    fn plane(p: V3, n: V3) -> Plane {
│390:    fn parallel_and_near_parallel_planes_do_not_intersect() {
│401:    fn perpendicular_planes_meet_on_a_unit_line() {
│415:    fn rotation_about_z_maps_x_to_y_and_keeps_the_centre() {
│432:    fn zero_angle_is_the_identity_and_a_zero_axis_is_none() {
│439:    fn boxes_touching_within_tolerance_overlap() {

kernel/src/check.rs:
│9:pub enum FindingKind {
│22:impl FindingKind {
│24:    pub fn name(self) -> &'static str {
│36:pub struct Finding {
│47:impl std::fmt::Display for Finding {
│49:    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
│70:impl Finding {
│73:    pub fn to_json(&self) -> serde_json::Value {
│90:pub fn check(doc: &Document) -> Vec<Finding> {
│215:struct Span {
│225:fn overlap_midpoint(p: V3, q: V3, r: V3, s: V3) -> Option<V3> {

kernel-wasm/src/lib.rs:
│12:fn js(e: Error) -> JsError {
│16:fn ids<T>(v: &[u32], f: impl Fn(u32) -> T) -> Vec<T> {
│20:fn matrix(m: Vec<f64>) -> Result<Mat4, JsError> {
│24:fn id_list(v: &[u32]) -> String {
│30:pub struct Buffers {
│39:impl Buffers {
│41:    pub fn positions(&self) -> Vec<f32> {
│45:    pub fn normals(&self) -> Vec<f32> {
│49:    pub fn face_ids(&self) -> Vec<u32> {
│53:    pub fn edge_positions(&self) -> Vec<f32> {
│57:    pub fn edge_ids(&self) -> Vec<u32> {
│63:pub struct Kernel {
│67:impl Default for Kernel {
│68:    fn default() -> Self {
│74:impl Kernel {
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
│285:    pub fn add_guide_line(
│300:    pub fn add_guide_point(&mut self, ctx: u32, x: f64, y: f64, z: f64) -> Result<u32, JsError> {
│306:    pub fn erase_guides(&mut self, guides: Vec<u32>) -> Result<(), JsError> {
│312:    pub fn erase_all_guides(&mut self) -> u32 {
│318:    pub fn guides(&self, def: u32) -> Vec<f64> {
│331:    pub fn guides_visible(&self) -> bool {
│337:    pub fn set_guides_visible(&mut self, visible: bool) {
│344:    pub fn intersect_faces(
│361:    pub fn check_model(&self) -> String {
│367:    pub fn set_transform(&mut self, inst: u32, m: Vec<f64>) -> Result<(), JsError> {
│375:    pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError> {
│384:    pub fn set_attribute(
│399:    pub fn tags(&self) -> String {
│410:    pub fn new_tag(&mut self, name: &str) -> u32 {
│416:    pub fn set_instance_tag(&mut self, inst: u32, tag: i32) -> Result<(), JsError> {
│422:    pub fn set_tag_flags(&mut self, tag: u32, visible: bool, locked: bool) -> Result<(), JsError> {
│430:    pub fn instance_props(&self, inst: u32) -> String {
│443:    pub fn materials(&self) -> String {
│455:    pub fn face_materials(&self, def: u32) -> Vec<i32> {
│465:    pub fn definition_name(&self, def: u32) -> String {
│472:    pub fn is_locked_def(&self, def: u32) -> bool {
│478:    pub fn buffers(&self, def: u32) -> Buffers {
│491:    pub fn definitions(&self) -> Vec<u32> {
│496:    pub fn instances(&self, def: u32) -> Vec<f64> {
│508:    pub fn instance_info(&self, inst: u32) -> Vec<u32> {
│514:    pub fn world_transform(&self, def: u32) -> Vec<f64> {
│520:    pub fn face_plane(&self, face: u32) -> Vec<f64> {
│532:    pub fn face_edges(&self, face: u32) -> Vec<u32> {
│541:    pub fn face_outer(&self, face: u32) -> Vec<f64> {
│548:    pub fn edge_info(&self, edge: u32) -> Vec<f64> {
│556:    pub fn edge_faces(&self, edge: u32) -> Vec<u32> {
│561:    pub fn stats(&self) -> Vec<u32> {
│571:fn target(kind: &str, id: u32) -> Result<AttrTarget, JsError> {

kernel/tests/common/fuzz.rs:
│13:pub struct Rng(u64);
│15:impl Rng {
│16:    pub fn new(seed: u64) -> Rng {
│19:    pub fn next_u64(&mut self) -> u64 {
│28:    pub fn f64(&mut self) -> f64 {
│32:    pub fn range(&mut self, lo: i64, hi: i64) -> i64 {
│35:    pub fn choose<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
│47:pub enum Op {
│114:impl Op {
│115:    fn name(&self) -> &'static str {
│134:fn nearest_edge(doc: &Document, p: V3) -> Option<EId> {
│145:pub fn apply(doc: &mut Document, op: &Op) -> Result<bool, Error> {
│236:fn grid(rng: &mut Rng) -> f64 {
│241:fn pick_face(rng: &mut Rng, doc: &Document) -> Option<(V3, V3)> {
│255:pub fn generate(rng: &mut Rng, steps: usize, doc: &mut Document) -> Vec<Op> {
│431:fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
│443:pub fn run(ops: &[Op]) -> Result<(), (usize, String)> {
│459:fn fails_quietly(ops: &[Op]) -> bool {
│469:pub fn shrink(ops: Vec<Op>) -> Vec<Op> {
│501:fn v3(p: V3) -> String {
│505:fn render_op(op: &Op) -> String {
│544:pub fn render_test(name: &str, ops: &[Op]) -> String {

kernel/tests/common/mod.rs:
│3:pub mod fuzz;
│9:pub fn v(x: f64, y: f64, z: f64) -> V3 {
│14:pub fn poly(doc: &mut Document, ctx: DefId, pts: &[V3]) {
│21:pub fn rect_xy(doc: &mut Document, ctx: DefId, x0: f64, y0: f64, x1: f64, y1: f64, z: f64) {
│27:pub fn make_box(doc: &mut Document, w: f64, d: f64, h: f64) {
│33:pub fn faces(doc: &Document, ctx: DefId) -> Vec<FId> {
│37:pub fn only_face(doc: &Document, ctx: DefId) -> FId {
│44:pub fn face_at(doc: &Document, ctx: DefId, p: V3, normal: V3) -> FId {
│56:pub fn contains_point(doc: &Document, f: FId, p: V3) -> bool {
│65:pub fn edge_count(doc: &Document, ctx: DefId) -> usize {
│69:pub fn vertex_count(doc: &Document, ctx: DefId) -> usize {
│73:pub fn total_area(doc: &Document, ctx: DefId) -> f64 {
│77:pub fn approx(a: f64, b: f64) -> bool {
│82:pub fn is_closed(doc: &Document, ctx: DefId) -> bool {
│87:pub fn volume(doc: &Document, ctx: DefId) -> f64 {
│102:pub fn validate(doc: &Document) {

app/src/kernel/model.ts:
│7:export const ROOT = 0;
│9:export type EntityKind = "face" | "edge" | "instance" | "guide";
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
│61:export interface GuideRecord {
│69:export interface Finding {
│81:export async function loadKernel(): Promise<void> {
│86:export function loadKernelSync(bytes: BufferSource): void {
│90:const u32 = (a: number[]) => Uint32Array.from(a);
│93:export const JOURNAL_SIZE = 50;
│95:export class Model {
│108:  constructor(kernel?: Kernel) {
│112:  static fromJson(text: string): Model {
│116:  toJson(): string {
│120:  private changed<T>(v: T): T {
│126:  begin(name: string): void {
│132:  commit(): boolean {
│137:  abort(): void {
│140:  undo(): string | undefined {
│145:  redo(): string | undefined {
│150:  canUndo(): boolean {
│153:  canRedo(): boolean {
│171:  addLine(ctx: number, a: Vec3, b: Vec3): number[] {
│175:  pushPull(face: number, distance: number): number | null {
│179:  verticesOf(faces: number[], edges: number[]): number[] {
│182:  moveVertices(verts: number[], d: Vec3): void {
│186:  moveAndIntegrate(verts: number[], d: Vec3): void {
│190:  transformVertices(verts: number[], m: Mat4): void {
│194:  transformAndIntegrate(verts: number[], m: Mat4): void {
│197:  erase(faces: number[], edges: number[], instances: number[]): void {
│200:  makeGroup(ctx: number, faces: number[], edges: number[], instances: number[]): number {
│206:  setTransform(inst: number, m: Mat4): void {
│215:  copyInstance(inst: number, d: Vec3): number {
│223:  copyInstanceTransformed(inst: number, m: Mat4): number {
│227:  offsetFace(face: number, distance: number): number[] {
│231:  offsetEdges(ctx: number, edges: number[], distance: number): number[] {
│236:  addGuideLine(ctx: number, origin: Vec3, dir: Vec3): number {
│239:  addGuidePoint(ctx: number, pos: Vec3): number {
│243:  eraseGuides(ids: number[]): void {
│247:  eraseAllGuides(): number {
│250:  guides(def: number): GuideRecord[] {
│263:  guidesVisible(): boolean {
│267:  setGuidesVisible(v: boolean): void {
│273:  intersectFaces(ctx: number, faces: number[], instances: number[], withModel: boolean): number[] {
│277:  checkModel(): Finding[] {
│282:  attributes(kind: AttrKind, id: number): Attributes {
│286:  setAttribute(kind: AttrKind, id: number, ns: string, key: string, v: AttrValue | null): void {
│289:  tags(): TagInfo[] {
│292:  newTag(name: string): number {
│295:  setInstanceTag(inst: number, tag: number | null): void {
│298:  setTagFlags(tag: number, visible: boolean, locked: boolean): void {
│301:  instanceProps(inst: number): InstanceProps | null {
│304:  materials(): MaterialInfo[] {
│308:  faceMaterials(def: number): Int32Array {
│311:  definitionName(def: number): string {
│314:  isLockedDef(def: number): boolean {
│319:  buffers(def: number): DefBuffers {
│331:  definitions(): number[] {
│334:  instances(def: number): InstanceRecord[] {
│346:  worldTransform(def: number): Mat4 {
│349:  facePlane(face: number): FacePlane | null {
│354:  faceEdges(face: number): number[] {
│357:  faceOuter(face: number): Vec3[] {
│367:  edgeFaces(edge: number): number[] {
│370:  exists(e: Entity): boolean {
│377:  guideOwner(id: number): number | null {

app/src/tools/tool.ts:
│12:export interface ToolPointer {
│24:export interface Overlay {
│52:export interface ToolHost {
│81:export interface Tool {
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

app/src/tools/rectangle.ts:
│7:const ON_PLANE = 0.01;
│9:interface RectPlane {
│19:export class RectangleTool implements Tool {
│31:  hint(): string {
│36:  vcbLabel(): string {
│39:  busy(): boolean {
│43:  deactivate(): void {
│55:  private planeFor(r: Inference, p: ToolPointer): RectPlane {
│69:  move(p: ToolPointer): void {
│94:  private corners(w: number, h: number): Vec3[] {
│100:  private preview(r: Inference | null): void {
│116:  down(): void {
│128:  up(_p: ToolPointer, dragged: boolean): void {
│132:  key(key: string): boolean {
│141:  vcb(text: string): void {
│166:  private commit(): void {

app/src/tools/select.ts:
│10:export class SelectTool implements Tool {
│18:  hint(): string {
│23:  vcbLabel(): string {
│26:  busy(): boolean {
│30:  deactivate(): void {
│36:  move(p: ToolPointer): void {
│47:  down(p: ToolPointer): void {
│51:  up(p: ToolPointer, dragged: boolean): void {
│76:  doubleClick(p: ToolPointer): void {
│96:  key(key: string): boolean {
│114:  vcb(): void {

app/src/tools/erase.ts:
│9:export class EraseTool implements Tool {
│16:  hint(): string {
│19:  vcbLabel(): string {
│22:  busy(): boolean {
│26:  deactivate(): void {
│31:  private under(p: ToolPointer): Entity | null {
│36:  move(p: ToolPointer): void {
│42:  down(p: ToolPointer): void {
│47:  up(): void {
│67:  vcb(): void {

app/src/tools/measure.ts:
│8:interface Measuring {
│25:interface LastGuide {
│46:export class TapeMeasureTool implements Tool {
│54:  get cursor(): string {
│58:  hint(): string {
│66:  vcbLabel(): string {
│69:  busy(): boolean {
│74:  modifier(): void {
│79:  deactivate(): void {
│84:  move(p: ToolPointer): void {
│130:  private choosePlane(a: Measuring, at: Vec3): boolean {
│139:  private lineRun(origin: Vec3, dir: Vec3): Vec3[] {
│144:  private stubSize(): number {
│148:  down(p: ToolPointer): void {
│175:  private edgePlanes(r: Inference): Plane[] {
│189:  private faceEdge(a: Measuring, r: Inference): void {
│204:  up(_p: ToolPointer, dragged: boolean): void {
│208:  key(key: string): boolean {
│217:  vcb(text: string): void {
│250:  private place(g: GuideRecord): number | null {
│264:  private commit(): void {
│292:function canonical(d: Vec3): Vec3 {
│298:function stub(o: Vec3, r: number): Vec3[] {

app/src/tools/pick.ts:
│8:const EDGE_PX = 5;
│9:const POINT_PX = 8;
│11:export interface EntityPick {
│25:export function pickEntity(scene: SceneIndex, cam: CameraModel, x: number, y: number): EntityPick | null {
│54:function pickGuide(scene: SceneIndex, cam: CameraModel, x: number, y: number, visibleDepth: number): WorldGuide | null {
│66:function entityFor(scene: SceneIndex, item: number, raw: Entity): EntityPick {
│78:export function boxSelect(

app/src/inference/engine.ts:
│28:export type InferenceKind =
│46:export type EdgeLock = "parallel" | "perpendicular" | null;
│48:export interface Inference {
│67:export interface InferOptions {
│80:export const AXES: Vec3[] = [
│85:export const AXIS_NAMES = ["Red", "Green", "Blue"];
│87:const POINT_RADIUS = 12;
│88:const EDGE_RADIUS = 7;
│89:const AXIS_RADIUS = 10;
│91:const CROSS_TOL = 1e-3;
│93:type EdgeRef = { item: number; id: number; a: Vec3; b: Vec3 };
│95:export class InferenceEngine {
│115:  toggleAxisLock(axis: 0 | 1 | 2): void {
│125:  cycleEdgeLock(): EdgeLock {
│135:  edgeLock(): EdgeLock {
│140:  referencedEdge(): EdgeRef | null {
│145:  reset(): void {
│153:  clicked(): void {
│158:  lockCurrent(): boolean {
│184:  unlock(): void {
│191:  get locked(): boolean {
│195:  infer(x: number, y: number, opts: InferOptions = {}): Inference | null {
│206:  private edgeDir(kind: "parallel" | "perpendicular", anchor: Vec3, plane?: Plane): Vec3 | null {
│225:  private compute(x: number, y: number, opts: InferOptions): Inference | null {
│364:  private intersectionSnap(scene: SceneIndex, x: number, y: number, ignore?: Set<number>): Inference | null {
│404:  private edgeCue(anchor: Vec3, x: number, y: number, plane?: Plane): Inference | null {
│431:  private fromPointCue(x: number, y: number, plane?: Plane, anchor?: Vec3): Inference | null {
│472:  private axisSnap(anchor: Vec3, x: number, y: number, plane?: Plane): Inference | null {
│528:function isPointSnap(kind: InferenceKind): boolean {
│536:function crossing(
│555:function screenSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {

app/src/view/scene.ts:
│10:export interface DrawItem {
│30:export type RGBA = [number, number, number, number];
│33:export interface WorldGuide {
│41:export interface FaceHit {
│50:export class SceneIndex {
│74:  static build(model: Model, activeCtx: number): SceneIndex {
│126:  private flatten(): void {
│177:  guides(): WorldGuide[] {
│185:  triColor(item: number, triInDef: number): RGBA | null {
│194:  triCorner(t: number, c: number): Vec3 {
│199:  segEnd(s: number, end: 0 | 1): Vec3 {
│248:  faceNormal(item: number, face: number): Vec3 {
│263:  screenEdges(cam: CameraModel): Float32Array {
│284:  faceTriangles(item: number, face: number): number[] {
│295:  editableItem(): number {
│300:const isIdentity = (m: Mat4) => m.every((v, i) => v === IDENTITY[i]);
│303:function transformInto(out: Float32Array, offset: number, src: Float32Array, m: Mat4): void {
│323:export function guideScreenDistance(cam: CameraModel, g: WorldGuide, x: number, y: number): { d: number; at: Vec3 } | null {

app/src/view/viewport.ts:
│11:export interface Theme {
│21:interface DefGeometry {
│27:interface ColouredGeometry {
│33:export class Viewport {
│62:  constructor(private host: HTMLElement) {
│87:  setTheme(t: Theme): void {
│106:  resize(): void {
│114:  syncCamera(cam: CameraModel): void {
│131:  private translucentFor(opacity: number): THREE.MeshLambertMaterial {
│146:  private colouredFor(index: SceneIndex, item: number, base: THREE.BufferGeometry): ColouredGeometry | null {
│172:  setScene(index: SceneIndex): void {
│217:  private setLayer(name: string, obj: THREE.Object3D | null): void {
│233:  clearLayer(name: string): void {
│238:  setTriangles(name: string, tris: number[], style: "select" | "hover" | "previewFill"): void {
│246:  setSegments(name: string, segs: number[], style: "selectEdge" | "preview" | "guide" | "box"): void {
│260:  setGuides(guides: WorldGuide[], visible: boolean): void {
│282:  setGuide(name: string, a: Vec3, b: Vec3, color: string): void {
│290:  request(): void {
│301:  get canvas(): HTMLCanvasElement {

app/src/math.ts:
│4:export type Vec3 = [number, number, number];
│6:export type Mat4 = number[];
│8:export const X: Vec3 = [1, 0, 0];
│9:export const Y: Vec3 = [0, 1, 0];
│10:export const Z: Vec3 = [0, 0, 1];
│11:export const ORIGIN: Vec3 = [0, 0, 0];
│13:export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
│14:export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
│15:export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
│16:export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
│17:export const cross = (a: Vec3, b: Vec3): Vec3 => [
│22:export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
│23:export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));
│24:export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
│25:export const madd = (a: Vec3, d: Vec3, t: number): Vec3 => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
│26:export function norm(a: Vec3): Vec3 {
│31:export interface Ray {
│36:export interface Plane {
│41:export const planeFrom = (point: Vec3, normal: Vec3): Plane => {
│46:export function rayPlane(ray: Ray, plane: Plane): Vec3 | null {
│54:export function projectToPlane(p: Vec3, plane: Plane): Vec3 {
│62:export function lineRayParam(p0: Vec3, u: Vec3, ray: Ray): number | null {
│75:export function rayTriangle(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
│93:export function planeBasis(n: Vec3): [Vec3, Vec3] {
│98:export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
│100:export function translation(t: Vec3): Mat4 {
│107:export function rotation(center: Vec3, axis: Vec3, angle: number): Mat4 {
│126:export function mul(a: Mat4, b: Mat4): Mat4 {
│137:export function apply(m: Mat4, p: Vec3): Vec3 {
│146:export function applyDir(m: Mat4, d: Vec3): Vec3 {
│155:export function invert(m: Mat4): Mat4 {

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
│119:export function parseAngle(text: string): number {
│142:export function formatAngle(degrees: number): string {
│148:export function parseLengths(text: string, units: UnitSystem = "imperial"): number[] {

app/src/app.ts:
│30:const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
│32:const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
│39:function copyKey(ev: KeyboardEvent | MouseEvent): boolean {
│42:const COPY_KEY = MAC ? "Alt" : "Control";
│45:function cursorStyle(cursor: string): string {
│50:const MAGENTA = "#c43cb0";
│52:const MARKER_CLASS: Record<string, string> = {
│70:export class App implements ToolHost {
│135:  scene(): SceneIndex {
│138:  toLocal(p: Vec3): Vec3 {
│141:  toLocalDir(d: Vec3): Vec3 {
│146:  refresh(opts: { preview?: boolean } = {}): void {
│160:  show(overlay: Overlay): void {
│165:  setVcb(text: string): void {
│170:  flash(message: string): void {
│179:  hintChanged(): void {
│185:  enterGroup(instance: number): void {
│195:  exitGroup(): void {
│206:  private setContext(def: number): void {
│221:  setTool(id: string): void {
│239:  loadModel(model: Model, name: string, opts: { saved?: boolean } = {}): void {
│260:  async offerRestore(candidate: Version | undefined): Promise<boolean> {
│278:  async showVersions(): Promise<void> {
│306:  private async openVersion(id: number): Promise<void> {
│319:  private undo(redo = false): void {
│328:  private eraseSelection(): void {
│344:  private toggleGuides(): void {
│352:  private deleteGuides(): void {
│360:  private makeGroup(): void {
│374:  private explode(): void {
│395:  private intersect(withModel: boolean): void {
│409:  private checkModel(): void {
│423:  private exportPlan(): void {
│436:  private selectAll(): void {
│453:  private save(): void {
│466:  private async open(file: File): Promise<void> {
│478:  private offerReport(e: unknown): void {
│491:  private confirmDiscard(): boolean {
│497:  private zoomExtents(): void {
│506:  private cameraChanged(): void {
│511:  private resize(): void {
│519:  private readTheme(): void {
│581:  private drawSelection(): void {
│596:  private drawOverlay(): void {
│619:  private drawGuide(r: Inference | null): void {
│638:  private positionLabels(): void {
│683:  private frameStats(ms: number): void {
│689:  private updateHeader(): void {
│694:  private updateButtons(): void {
│707:  private pointer(ev: PointerEvent | MouseEvent | WheelEvent): ToolPointer {
│712:  private bindUi(): void {
│846:  private keydown(ev: KeyboardEvent): void {
│947:function boxSegments(min: Vec3, max: Vec3): number[] {
│954:export function describeFinding(f: Finding): string {
│973:function protractorSegments(p: NonNullable<Overlay["protractor"]>): number[] {

app/test/toolhost.ts:
│13:export class TestHost implements ToolHost {
│26:  constructor(model?: Model) {
│34:  scene(): SceneIndex {
│37:  toLocal(p: Vec3): Vec3 {
│40:  toLocalDir(d: Vec3): Vec3 {
│43:  refresh(opts: { preview?: boolean } = {}): void {
│49:  show(o: Overlay): void {
│52:  setVcb(text: string): void {
│55:  flash(m: string): void {
│60:  enterGroup(instance: number): void {
│65:  exitGroup(): void {
│74:  at(p: Vec3, opts: { copy?: boolean } = {}): ToolPointer {
│81:  click(tool: Tool, p: Vec3): void {
│89:  copyClick(tool: Tool, p: Vec3): void {
│96:  hover(tool: Tool, p: Vec3): void {
│100:  drag(tool: Tool, from: Vec3, to: Vec3): void {
```

## Summary

Edges gain attributes in the kernel and an additive `edge_attributes` key in the file; the `builder` namespace's `curve` and `soft` keys make circles, polygons and arcs one thing and make a pulled curve a smooth surface. Scale and mirror are new matrices through the existing transform path, with the determinant's sign keeping mirrored faces pointing out; `reverse_faces` and `orient_faces` fix orientation. The app gets Circle, Polygon, two Arc tools, Scale with grips, Flip with planes, Rotated Rectangle, a centre inference, curve-wide selection and erase, soft-edge rendering, and the Tape Measure's resize prompt.

## Decisions

### Cited

- `mvr2op7t` Namespaced attributes in the builder format: namespace, key and value rules; additive change; sorted output.
- `mvr2opid` Tag lock enforced by the kernel: `add_curve`, the transform path, `reverse_faces` and `orient_faces` refuse a locked owner with `Error::Locked`.

### Proposed

- `mwdq3k7a` Edge attributes and the builder namespace (`decisions/mwdq3k7a-edge-attributes-and-the-builder-namespace.md`): edges carry attributes; `edge_attributes` in the file; the `builder` namespace with `curve` and `soft`.

## Technical Specifications

### Interfaces

Kernel (`kernel/src`):

```rust
// doc.rs
pub struct Edge { pub owner: DefId, pub v: [VId; 2], pub faces: Vec<FId>, pub attributes: Attributes }
pub enum AttrTarget { Definition(DefId), Instance(InstId), Face(FId), Edge(EId) }
// `attributes` and `set_attribute` take the new variant; every `Edge { .. }` literal gains `attributes`.
pub const BUILDER_NS: &str = "builder";
pub const CURVE_KEY: &str = "curve";
pub const SOFT_KEY: &str = "soft";
impl Document {
    pub fn edge_curve(&self, e: EId) -> Option<u64>;      // builder.curve as a number
    pub fn edge_soft(&self, e: EId) -> bool;              // builder.soft == true
}

// topo.rs: unchanged signatures; `split_edge` copies the split edge's attributes to both halves.

// curve.rs (new)
impl Document {
    /// Draw `pts` as a polyline through `add_line` (closing it when `closed`) and mark
    /// every resulting segment `builder.curve = next_curve_id(ctx)`. Fewer than 2 points
    /// (3 closed) is `Error::Degenerate`; a locked `ctx` is `Error::Locked`.
    pub fn add_curve(&mut self, ctx: DefId, pts: &[V3], closed: bool) -> Result<Vec<EId>, Error>;
    /// One more than the highest `builder.curve` among `ctx`'s edges, 0 when none.
    pub fn next_curve_id(&self, ctx: DefId) -> u64;
    /// The live segments of `e`'s curve in chain order; `[e]` for an edge in no curve.
    pub fn curve_of(&self, e: EId) -> Vec<EId>;
    /// Circumcentre of three consecutive vertices of `e`'s curve; None when the chain
    /// has fewer than three vertices or they are collinear.
    pub fn curve_center(&self, e: EId) -> Option<V3>;
    /// Remove `builder.curve` from every segment of each curve that has a vertex in
    /// `verts` but not all of its vertices. Returns the exploded curve ids.
    pub(crate) fn explode_curves_touching(&mut self, verts: &[VId]) -> Vec<u64>;
    /// Give `edges` (a chain, in order) `builder.curve = next_curve_id(ctx)`.
    pub(crate) fn mark_curve(&mut self, ctx: DefId, edges: &[EId]) -> Result<u64, Error>;
    pub(crate) fn set_soft(&mut self, e: EId, soft: bool) -> Result<(), Error>;
    /// Give the curves among `edges` fresh ids in `ctx`, keeping each curve's segments
    /// together: called by `copy_geometry_transformed` (a copy beside its source) and
    /// `explode` (edges returning to a parent that may already use their ids).
    pub(crate) fn remap_curve_ids(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error>;
}

// edit.rs: `transform_vertices` calls `explode_curves_touching(verts)` first and, for a
// face every vertex of which moves, carries `det.signum() * mat_apply_dir(m, n)`;
// `Error::Degenerate("transform is singular")` when `mat_det(m).abs() <= 1e-12`.
// `fold_for_move` sets `builder.soft` on each diagonal it adds.

// pushpull.rs: `extrude` marks each side edge joining two side faces whose base
// segments share a curve id `builder.soft = true`, and gives the cap's edges that
// correspond to a base curve a fresh curve id per base curve.

// offset.rs: `offset_edges` marks its output a new curve (per input curve) when every
// input edge carries one curve id; `offset_face` does the same per curve in the loop.

// math.rs
pub fn mat_scale(center: V3, factors: [f64; 3]) -> Mat4;
pub fn mat_mirror(point: V3, normal: V3) -> Option<Mat4>;   // None for a zero normal
pub fn mat_det(m: &Mat4) -> f64;

// orient.rs (new)
impl Document {
    /// `flip_face` each; `Error::Locked` for a locked owner; `Error::Missing` for a dead id.
    pub fn reverse_faces(&mut self, faces: &[FId]) -> Result<(), Error>;
    /// Walk from `seed` across edges shared by exactly two faces; flip every face whose
    /// direction along a shared edge agrees with its neighbour's. Returns the count flipped.
    pub fn orient_faces(&mut self, seed: FId) -> Result<usize, Error>;
}

// mesh.rs
pub struct EdgeBuffers { pub positions: Vec<f32>, pub edge_ids: Vec<u32>, pub soft: Vec<bool> }
// `face_buffers`: a corner's normal is the unit mean of the normals of the faces reachable
// from this face around that vertex through soft edges only (the face's own normal when none).

// format.rs
struct FileEdgeAttributes { edge: u32, attributes: FileAttributes }
struct FileDefinition { /* as before */ edge_attributes: Vec<FileEdgeAttributes> }  // skip when empty

// check.rs: FindingKind::BrokenCurve, name "broken_curve" (a curve id whose segments are not one
// chain, or shared by two definitions), position at a segment midpoint.
// group.rs: `make_group` and `copy_instance_transformed` copy edge attributes onto the edges they
// create (ids stay unique in the new definition); `explode` copies them and calls `remap_curve_ids`.
```

Fuzz (`kernel/tests/common/fuzz.rs`):

```rust
pub enum Op {
    /* existing */
    /// `add_curve` of a circle on z = 0 in ROOT.
    Circle { center: V3, radius: f64, segments: u32 },
    /// Vertices of the face found by `face_containing` scaled about `point` by `factors`.
    Scale { point: V3, normal: V3, factors: [f64; 3] },
    /// Vertices of the face found as above mirrored across the plane through `point` with normal `axis`.
    Flip { point: V3, normal: V3, axis: V3 },
    /// `orient_faces` from the face found as above.
    Orient { point: V3, normal: V3 },
}
```

Wasm (`kernel-wasm/src/lib.rs`), each a thin wrapper:

```rust
impl Buffers { pub fn edge_soft(&self) -> Vec<u8>; }
impl Kernel {
    pub fn add_curve(&mut self, ctx: u32, pts: Vec<f64>, closed: bool) -> Result<Vec<u32>, JsError>;
    pub fn curve_of(&self, edge: u32) -> Vec<u32>;
    pub fn curve_center(&self, edge: u32) -> Vec<f64>;      // [] when none
    pub fn reverse_faces(&mut self, faces: Vec<u32>) -> Result<(), JsError>;
    pub fn orient_faces(&mut self, seed: u32) -> Result<u32, JsError>;
    // `attributes` / `set_attribute` accept kind "edge".
}
```

App (`app/src`):

```ts
// kernel/model.ts
export type AttrKind = "definition" | "instance" | "face" | "edge";
export interface Finding { kind: /* existing */ | "broken_curve"; /* rest unchanged */ }
export interface DefBuffers { /* as before */ edgeSoft: Uint8Array }
class Model {
  addCurve(ctx: number, pts: Vec3[], closed: boolean): number[];
  curveOf(edge: number): number[];
  curveCenter(edge: number): Vec3 | null;
  reverseFaces(faces: number[]): void;
  orientFaces(seed: number): number;
}

// math.ts
export function scaling(center: Vec3, factors: Vec3): Mat4;
export function mirror(point: Vec3, normal: Vec3): Mat4;
export function det(m: Mat4): number;

// units.ts
/** `24s` → 24; null when the text is not a segment count. */
export function parseSegments(text: string): number | null;
/** `r12"` → inches; null otherwise. */
export function parseRadius(text: string, units: UnitSystem): number | null;

// inference/engine.ts
export type InferenceKind = /* existing */ | "center";
// `infer` offers { kind: "center", label: "Center", point } for a hovered curve segment,
// ranked with endpoint and midpoint; uses model.curveCenter through the scene's edge→item map.

// tools/tool.ts
export interface Overlay {
  /* existing */
  /** Scale grips in world space, with which is hovered. */
  grips?: { pos: Vec3; axes: number; hot: boolean }[];
  /** Flip planes: centre, normal, half-size, hovered. */
  planes?: { center: Vec3; normal: Vec3; size: number; hot: boolean }[];
}
export interface ToolHost {
  /* existing */
  /** Ask the user; the browser host uses window.confirm, the test host a scripted answer. */
  confirm(message: string): boolean;
}

// tools/pick.ts
/** The entity, or every segment of its curve when it is a curve segment. */
export function expandCurve(model: Model, e: Entity): Entity[];

// tools/rectangle.ts
export function planeFor(host: ToolHost, r: Inference, p: ToolPointer): RectPlane;
export function commitRect(host: ToolHost, corners: Vec3[]): boolean;

// tools/circle.ts
export class CircleTool implements Tool   // id "circle", cursor "crosshair"; 24 segments by default
export class PolygonTool implements Tool  // id "polygon"; 6 sides by default
// tools/arc.ts
export class ArcTool implements Tool      // id "arc2" | "arc3" by constructor mode; 12 segments by default
// tools/rotrect.ts
export class RotatedRectangleTool implements Tool  // id "rotrect"
// tools/scale.ts
export class ScaleTool implements Tool    // id "scale"; 26 grips; vcb: factors or lengths; modifier(): about centre
// tools/flip.ts
export class FlipTool implements Tool     // id "flip"; three planes

// tools/measure.ts: in measure-only mode, `vcb(text)` after a measurement calls
// host.confirm(`Resize the model to make this ${text}?`) and on true runs transaction
// "Resize": transformAndIntegrate(all vertices of ctx, scaling(origin, [k,k,k])) and
// setTransform(mul(scaling(origin,[k,k,k]), t)) for every instance in ctx, k = typed / measured.

// app.ts: tools circle, polygon, arc2, arc3, rotrect, scale, flip; keys C, A, S; buttons
// reverseBtn, orientBtn; `confirm()` via window.confirm; overlay drawing of grips and planes.
// view/viewport.ts: line set built from edges with edgeSoft[i] == 0; `drawGrips`, `drawPlanes`.
// view/scene.ts: `segSoft: Uint8Array`; a mirrored item's face normals multiplied by sign(det).
```

### Data Models

File, per definition (additive; `edge_attributes` absent when no edge has attributes):

```json
{
  "name": "Model", "kind": "root",
  "vertices": [[0,0,0], [24,0,0], [24,24,0], [0,24,0]],
  "edges": [[0,1], [1,2], [2,3], [3,0]],
  "edge_attributes": [
    { "edge": 0, "attributes": { "builder": { "curve": 0 } } },
    { "edge": 1, "attributes": { "builder": { "curve": 0, "soft": true } } }
  ],
  "faces": [ { "outer": [0,1,2,3] } ]
}
```

Rules: `edge` indexes this definition's `edges`; out of range is `Error::Format("definitions[d].edge_attributes[k].edge out of range")`; attributes are read by `read_attributes` with path `definitions[d].edge_attributes[k].attributes`; the list is sorted by `edge` on write and may be in any order on read.

The `builder` namespace: `curve` is a non-negative integer, unique per definition, shared by one chain of edges; `soft` is `true` or absent (never `false`). `validate` asserts each curve id's segments form one open or closed chain owned by one definition; `check` reports a violation as `BrokenCurve`.

Scale grips (26), in the selection's box with min `a`, max `b`, centre `c`: corners (8) scale all three axes about the opposite corner; edge midpoints (12) scale the two axes the edge does not run along, about the opposite edge's midpoint; face centres (6) scale one axis about the opposite face. `axes` in the overlay is a 3-bit mask. With Ctrl the fixed point is `c`. With Shift the factor of the dragged axis applies to every axis in the mask. Typed `f` applies `f` to every axis in the mask; `f1,f2[,f3]` applies by axis order of the mask; a length with units sets the first masked axis's extent to that length (factor = length / current extent).

### Examples

```rust
// A round post: circle, pull, and what the kernel guarantees.
let segs = doc.add_curve(ROOT, &circle_points(center, 2.0, 24), true)?;   // 24 edges, one face
assert_eq!(doc.curve_of(segs[7]).len(), 24);
let f = doc.face_containing(ROOT, center, V3::new(0.0, 0.0, 1.0)).unwrap();
doc.push_pull(f, 96.0)?;
assert_eq!(doc.edges_in(ROOT).filter(|(e, _)| doc.edge_soft(*e)).count(), 24);

// Scale a face's vertices by 1.5 along x about a corner; mirror a box across x.
let m = mat_scale(corner, [1.5, 1.0, 1.0]);
doc.transform_and_integrate(&verts, &m)?;
let mm = mat_mirror(V3::new(0.0, 0.0, 0.0), V3::new(1.0, 0.0, 0.0)).unwrap();
doc.transform_and_integrate(&all_verts, &mm)?;    // faces still point out
assert_eq!(doc.orient_faces(seed)?, 0);
```

```ts
// Select expands a curve; Erase erases it.
const items = expandCurve(model, { kind: "edge", id: seg });   // 24 entities
selection.set(items);
model.transact("Erase", () => model.erase([], items.map((e) => e.id), []));

// Scale tool, headless: bench group 1.5× along red.
host.selection.set([{ kind: "instance", id: bench }]);
scale.activate(); scale.move(at(faceGripX)); scale.down(at(faceGripX)); scale.vcb("1.5");
// instance transform = mul(scaling(fixedPoint, [1.5, 1, 1]), before)
```

## Validation Criteria

```bash
cargo test --workspace                       # kernel: attributes, curves, scale, orient, format, fuzz (< 60 s at the CI seed)
cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings
npm run build:kernel && npm run typecheck && npm test   # app: curves, scale, flip, scene, tools, offset (deck walkthrough)
npx vite build && node scripts/check-precache.mjs
uv run --project survey pytest survey/tests  # unchanged, must stay green
```

Expected: every suite green; `kernel/tests/format.rs` proves a file without edge attributes is byte-identical to the sprint-07 fixture's output and `fixtures/curves.builder` round-trips byte-identically; `app/test/offset.test.ts` "Deck walkthrough" replays with round posts and the counts written into `docs/walkthrough-deck.md`.
