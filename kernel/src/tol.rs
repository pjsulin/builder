//! The kernel's single tolerance policy. Every geometric comparison uses these.

/// Points closer than this (inches) are the same point. SketchUp uses 0.001" too.
pub const LENGTH: f64 = 1e-3;

/// Maximum distance (inches) of a point from a plane for it to count as on the plane.
pub const PLANE: f64 = 1e-3;

/// Two unit directions are parallel when `1 - |cos|` is below this.
pub const ANGLE: f64 = 1e-9;

/// Faces smaller than this (square inches) are degenerate.
pub const AREA: f64 = 1e-6;
