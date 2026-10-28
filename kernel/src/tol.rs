//! The kernel's single tolerance policy. Every geometric comparison uses these.

/// Points closer than this (inches) are the same point. SketchUp uses 0.001" too.
pub const LENGTH: f64 = 1e-3;

/// Maximum distance (inches) of a point from a plane for it to count as on the plane.
pub const PLANE: f64 = 1e-3;

/// Two unit directions are parallel when `1 - |cos|` is below this.
pub const ANGLE: f64 = 1e-9;

/// Faces smaller than this (square inches) are degenerate.
pub const AREA: f64 = 1e-6;

/// Planes whose normals' cross product is shorter than this (the sine of the angle
/// between them) are treated as parallel by intersection: a `PLANE`-sized error in
/// either plane moves their line by up to `PLANE / INTERSECT_SIN`. 1e-2 bounds that
/// at 0.1".
pub const INTERSECT_SIN: f64 = 1e-2;
