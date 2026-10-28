commit: bda40f8
budget: 1000

app/src/math.ts:
# Small 3D math used by tools, inference and picking. Pure functions over plain
⋮
│export type Vec3 = [number, number, number];
⋮

app/src/store/autosave.ts:
# Autosaved versions of the open model in IndexedDB. One database holds a ring
⋮
│export type VersionInfo = Omit<Version, "json">;
│
│export interface RingLimits {
│  versions?: number;
│  bytes?: number;
⋮

app/src/store/autosaver.ts:
# Debounced autosave. Follows the model's commit points (`Model.onCommit`, which
⋮
│export interface AutosaverOptions {
│  store: Pick<AutosaveStore, "put" | "setDirty">;
│  /** Default DEBOUNCE_MS. */
│  debounceMs?: number;
│  /** Default Date.now. */
│  now?: () => number;
│  /** Default globalThis.setTimeout / clearTimeout; tests inject a fake clock. */
│  setTimer?: (fn: () => void, ms: number) => unknown;
│  clearTimer?: (handle: unknown) => void;
│  /** Default console.error. Store failures land here, never in the tool that committed. */
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
│    pub fn is_finite(self) -> bool {
│        self.x.is_finite() && self.y.is_finite() && self.z.is_finite()
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
