commit: dce9a98
budget: 1000

app/src/math.ts:
# Small 3D math used by tools, inference and picking. Pure functions over plain
⋮
│export type Vec3 = [number, number, number];
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

app/src/units.ts:
# Lengths are stored in inches. These parse what people type in the Measurements
⋮
│export type UnitSystem = "imperial" | "metric";
│
⋮

app/src/view/scene.ts:
# World-space view of the model for picking and inference, built from the kernel's
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

kernel/src/doc.rs:
# The document: entity records stored in journaled arenas.
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
⋮

kernel/src/math.rs:
# Small vector and plane math. Everything is `f64`; lengths are inches.
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
⋮
│    pub fn len(self) -> f64 {
│        self.dot(self).sqrt()
⋮
│    pub fn is_finite(self) -> bool {
│        self.x.is_finite() && self.y.is_finite() && self.z.is_finite()
⋮

survey/src/builder_survey/elements.py:
# The element record every generator produces.
⋮
│def element(name, phase, material, ctx, parts, *, kind, notes=None):
⋮

survey/src/builder_survey/generate/fixtures/registry.py:
# Fixture type registry.
⋮
│TYPES = {}
│
⋮
│def fixture_type(name, own_z=False):
│    def register(builder):
│        if name in TYPES:
│            sys.exit(f"fixture type {name!r} is registered twice")
│        TYPES[name] = (builder, own_z)
⋮

survey/src/builder_survey/spec/ctx.py:
# Value resolution for one spec entry: MISSING / ~ bookkeeping, levels, lengths.
⋮
│class Ctx:
│    """Resolves values and records MISSING / placeholder use for one element."""
│
⋮
│    def len(self, val, field):
⋮

survey/src/builder_survey/units.py:
# Lengths: feet-inches text <-> inches.
⋮
│def parse_length(val, where):
⋮
