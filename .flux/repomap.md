commit: f5ae8e3
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
│pub fn mat_apply(m: &Mat4, p: V3) -> V3 {
│    V3::new(
│        m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
│        m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
│        m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
│    )
⋮
