//! Small vector and plane math. Everything is `f64`; lengths are inches.

use serde::{Deserialize, Serialize};
use std::ops::{Add, Mul, Neg, Sub};

use crate::tol;

#[derive(Clone, Copy, Debug, PartialEq, Default, Serialize, Deserialize)]
#[serde(from = "[f64; 3]", into = "[f64; 3]")]
pub struct V3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl From<[f64; 3]> for V3 {
    fn from(a: [f64; 3]) -> Self {
        V3::new(a[0], a[1], a[2])
    }
}

impl From<V3> for [f64; 3] {
    fn from(v: V3) -> Self {
        [v.x, v.y, v.z]
    }
}

impl V3 {
    pub const ZERO: V3 = V3 { x: 0.0, y: 0.0, z: 0.0 };
    pub const X: V3 = V3 { x: 1.0, y: 0.0, z: 0.0 };
    pub const Y: V3 = V3 { x: 0.0, y: 1.0, z: 0.0 };
    pub const Z: V3 = V3 { x: 0.0, y: 0.0, z: 1.0 };

    pub const fn new(x: f64, y: f64, z: f64) -> Self {
        V3 { x, y, z }
    }
    pub fn dot(self, o: V3) -> f64 {
        self.x * o.x + self.y * o.y + self.z * o.z
    }
    pub fn cross(self, o: V3) -> V3 {
        V3::new(self.y * o.z - self.z * o.y, self.z * o.x - self.x * o.z, self.x * o.y - self.y * o.x)
    }
    pub fn len(self) -> f64 {
        self.dot(self).sqrt()
    }
    pub fn dist(self, o: V3) -> f64 {
        (self - o).len()
    }
    /// Unit vector, or `None` for a (near) zero vector.
    pub fn unit(self) -> Option<V3> {
        let l = self.len();
        (l > 1e-12).then(|| self * (1.0 / l))
    }
    pub fn lerp(self, o: V3, t: f64) -> V3 {
        self + (o - self) * t
    }
    pub fn is_finite(self) -> bool {
        self.x.is_finite() && self.y.is_finite() && self.z.is_finite()
    }
}

impl Add for V3 {
    type Output = V3;
    fn add(self, o: V3) -> V3 {
        V3::new(self.x + o.x, self.y + o.y, self.z + o.z)
    }
}
impl Sub for V3 {
    type Output = V3;
    fn sub(self, o: V3) -> V3 {
        V3::new(self.x - o.x, self.y - o.y, self.z - o.z)
    }
}
impl Mul<f64> for V3 {
    type Output = V3;
    fn mul(self, s: f64) -> V3 {
        V3::new(self.x * s, self.y * s, self.z * s)
    }
}
impl Neg for V3 {
    type Output = V3;
    fn neg(self) -> V3 {
        V3::new(-self.x, -self.y, -self.z)
    }
}

/// A plane `normal · p = d` with a unit normal.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Plane {
    pub normal: V3,
    pub d: f64,
}

impl Plane {
    pub fn from_point_normal(p: V3, n: V3) -> Option<Plane> {
        let normal = n.unit()?;
        Some(Plane { normal, d: normal.dot(p) })
    }

    /// Best-fit plane through a closed loop (Newell's method). The normal follows the
    /// right-hand rule for the loop order, so a counter-clockwise loop seen from the
    /// front gives a normal pointing at the viewer.
    pub fn from_loop(pts: &[V3]) -> Option<Plane> {
        if pts.len() < 3 {
            return None;
        }
        let mut n = V3::ZERO;
        let mut c = V3::ZERO;
        for (i, &a) in pts.iter().enumerate() {
            let b = pts[(i + 1) % pts.len()];
            n.x += (a.y - b.y) * (a.z + b.z);
            n.y += (a.z - b.z) * (a.x + b.x);
            n.z += (a.x - b.x) * (a.y + b.y);
            c = c + a;
        }
        let c = c * (1.0 / pts.len() as f64);
        let normal = n.unit()?;
        Some(Plane { normal, d: normal.dot(c) })
    }

    pub fn dist(&self, p: V3) -> f64 {
        self.normal.dot(p) - self.d
    }
    pub fn contains(&self, p: V3) -> bool {
        self.dist(p).abs() <= tol::PLANE
    }
    pub fn flipped(&self) -> Plane {
        Plane { normal: -self.normal, d: -self.d }
    }
    /// Same set of points, either orientation.
    pub fn same_surface(&self, o: &Plane) -> bool {
        let c = self.normal.dot(o.normal);
        if c > 0.0 {
            (1.0 - c) <= tol::ANGLE && (self.d - o.d).abs() <= tol::PLANE
        } else {
            (1.0 + c) <= tol::ANGLE && (self.d + o.d).abs() <= tol::PLANE
        }
    }
    /// An orthonormal basis `(u, v)` in the plane with `u × v = normal`. Horizontal
    /// planes use the world X axis for `u`; other planes use a horizontal `u`, which
    /// keeps rectangles on walls and roofs aligned with their eaves.
    pub fn basis(&self) -> (V3, V3) {
        let n = self.normal;
        let u = if n.z.abs() > 1.0 - 1e-9 { V3::X } else { V3::Z.cross(n).unit().unwrap_or(V3::X) };
        let v = n.cross(u);
        (u, v)
    }
    pub fn project(&self, p: V3) -> V3 {
        p - self.normal * self.dist(p)
    }
    /// The line where two planes meet as (point, unit direction), or `None` when
    /// the planes are parallel within `tol::INTERSECT_SIN`. The point is the one on
    /// the line closest to the origin.
    pub fn intersect(&self, o: &Plane) -> Option<(V3, V3)> {
        let cross = self.normal.cross(o.normal);
        let len2 = cross.dot(cross);
        if len2.sqrt() < tol::INTERSECT_SIN {
            return None;
        }
        // p = (d1 (n2 × c) + d2 (c × n1)) / |c|², the solution of n1·p = d1, n2·p = d2
        // with no component along c.
        let p = (o.normal.cross(cross) * self.d + cross.cross(self.normal) * o.d) * (1.0 / len2);
        Some((p, cross.unit()?))
    }
}

/// Axis-aligned bounds of a point set, as (min, max). `None` for an empty set.
pub fn bbox(points: impl Iterator<Item = V3>) -> Option<(V3, V3)> {
    let mut out: Option<(V3, V3)> = None;
    for p in points {
        out = Some(match out {
            None => (p, p),
            Some((lo, hi)) => (
                V3::new(lo.x.min(p.x), lo.y.min(p.y), lo.z.min(p.z)),
                V3::new(hi.x.max(p.x), hi.y.max(p.y), hi.z.max(p.z)),
            ),
        });
    }
    out
}

/// True when two boxes overlap or touch within `tol::LENGTH`.
pub fn bbox_overlap_3d(a: (V3, V3), b: (V3, V3)) -> bool {
    let t = tol::LENGTH;
    a.0.x <= b.1.x + t
        && b.0.x <= a.1.x + t
        && a.0.y <= b.1.y + t
        && b.0.y <= a.1.y + t
        && a.0.z <= b.1.z + t
        && b.0.z <= a.1.z + t
}

/// 2D point in a plane basis.
pub type P2 = [f64; 2];

pub fn to_2d(p: V3, u: V3, v: V3) -> P2 {
    [p.dot(u), p.dot(v)]
}

/// Twice the signed area of a 2D polygon (positive when counter-clockwise).
pub fn signed_area2(pts: &[P2]) -> f64 {
    let mut a = 0.0;
    for i in 0..pts.len() {
        let p = pts[i];
        let q = pts[(i + 1) % pts.len()];
        a += p[0] * q[1] - q[0] * p[1];
    }
    a
}

/// Even-odd point-in-polygon test. Points on the boundary may go either way, so
/// callers should test points that are clearly inside or outside.
pub fn point_in_polygon(p: P2, poly: &[P2]) -> bool {
    let mut inside = false;
    let n = poly.len();
    let mut j = n.wrapping_sub(1);
    for i in 0..n {
        let (a, b) = (poly[i], poly[j]);
        if (a[1] > p[1]) != (b[1] > p[1]) {
            let x = a[0] + (p[1] - a[1]) / (b[1] - a[1]) * (b[0] - a[0]);
            if p[0] < x {
                inside = !inside;
            }
        }
        j = i;
    }
    inside
}

/// Distance from `p` to the segment `a`–`b`, and the parameter of the closest point.
pub fn point_segment(p: V3, a: V3, b: V3) -> (f64, f64) {
    let ab = b - a;
    let l2 = ab.dot(ab);
    if l2 <= 0.0 {
        return (p.dist(a), 0.0);
    }
    let t = ((p - a).dot(ab) / l2).clamp(0.0, 1.0);
    (p.dist(a + ab * t), t)
}

/// Closest points between segments `p0`–`p1` and `q0`–`q1`. Returns `(s, t, dist)` with
/// parameters along each segment, or `None` when the segments are parallel.
pub fn segment_segment(p0: V3, p1: V3, q0: V3, q1: V3) -> Option<(f64, f64, f64)> {
    let d1 = p1 - p0;
    let d2 = q1 - q0;
    let r = p0 - q0;
    let a = d1.dot(d1);
    let e = d2.dot(d2);
    let f = d2.dot(r);
    let c = d1.dot(r);
    let b = d1.dot(d2);
    let denom = a * e - b * b;
    if denom <= 1e-12 * a * e {
        return None;
    }
    let mut s = ((b * f - c * e) / denom).clamp(0.0, 1.0);
    let mut t = (b * s + f) / e;
    if t < 0.0 {
        t = 0.0;
        s = (-c / a).clamp(0.0, 1.0);
    } else if t > 1.0 {
        t = 1.0;
        s = ((b - c) / a).clamp(0.0, 1.0);
    }
    let dist = (p0 + d1 * s).dist(q0 + d2 * t);
    Some((s, t, dist))
}

/// Column-major 4×4 affine transform, the same layout as Three.js `Matrix4.elements`.
pub type Mat4 = [f64; 16];

pub const IDENTITY: Mat4 = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

pub fn mat_translation(t: V3) -> Mat4 {
    let mut m = IDENTITY;
    m[12] = t.x;
    m[13] = t.y;
    m[14] = t.z;
    m
}

/// Rotation of `angle` radians about the axis through `center` along `axis`
/// (right-hand rule), as a column-major affine `Mat4` like `mat_translation`.
/// `None` for a (near) zero axis. Rodrigues' formula; `angle == 0.0` is `IDENTITY`.
pub fn mat_rotation(center: V3, axis: V3, angle: f64) -> Option<Mat4> {
    let k = axis.unit()?;
    let (s, c) = angle.sin_cos();
    let t = 1.0 - c;
    // R = cos I + sin [k]× + (1 - cos) k kᵀ, written row by row.
    let r = [
        [c + t * k.x * k.x, t * k.x * k.y - s * k.z, t * k.x * k.z + s * k.y],
        [t * k.y * k.x + s * k.z, c + t * k.y * k.y, t * k.y * k.z - s * k.x],
        [t * k.z * k.x - s * k.y, t * k.z * k.y + s * k.x, c + t * k.z * k.z],
    ];
    let mut m = IDENTITY;
    for (row, line) in r.iter().enumerate() {
        for (col, &x) in line.iter().enumerate() {
            m[col * 4 + row] = x;
        }
    }
    // The centre stays fixed: translate by c - R c.
    let rc = mat_apply(&m, center);
    m[12] = center.x - rc.x;
    m[13] = center.y - rc.y;
    m[14] = center.z - rc.z;
    Some(m)
}

/// A direction under an affine transform: `mat_apply(m, d) - mat_apply(m, ZERO)`.
pub fn mat_apply_dir(m: &Mat4, d: V3) -> V3 {
    V3::new(
        m[0] * d.x + m[4] * d.y + m[8] * d.z,
        m[1] * d.x + m[5] * d.y + m[9] * d.z,
        m[2] * d.x + m[6] * d.y + m[10] * d.z,
    )
}

/// True when every entry is finite.
pub fn mat_is_finite(m: &Mat4) -> bool {
    m.iter().all(|x| x.is_finite())
}

pub fn mat_mul(a: &Mat4, b: &Mat4) -> Mat4 {
    let mut r = [0.0; 16];
    for col in 0..4 {
        for row in 0..4 {
            r[col * 4 + row] = (0..4).map(|k| a[k * 4 + row] * b[col * 4 + k]).sum();
        }
    }
    r
}

pub fn mat_apply(m: &Mat4, p: V3) -> V3 {
    V3::new(
        m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
        m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
        m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
    )
}

/// Inverse of an affine transform, or `None` if it is singular.
pub fn mat_invert(m: &Mat4) -> Option<Mat4> {
    let (a, b, c) = (m[0], m[4], m[8]);
    let (d, e, f) = (m[1], m[5], m[9]);
    let (g, h, i) = (m[2], m[6], m[10]);
    let det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if det.abs() < 1e-12 {
        return None;
    }
    let k = 1.0 / det;
    let inv3 = [
        (e * i - f * h) * k,
        (c * h - b * i) * k,
        (b * f - c * e) * k,
        (f * g - d * i) * k,
        (a * i - c * g) * k,
        (c * d - a * f) * k,
        (d * h - e * g) * k,
        (b * g - a * h) * k,
        (a * e - b * d) * k,
    ];
    // inv3 is row-major; write it column-major.
    let mut r = IDENTITY;
    for row in 0..3 {
        for col in 0..3 {
            r[col * 4 + row] = inv3[row * 3 + col];
        }
    }
    let t = V3::new(m[12], m[13], m[14]);
    let it = V3::new(
        -(r[0] * t.x + r[4] * t.y + r[8] * t.z),
        -(r[1] * t.x + r[5] * t.y + r[9] * t.z),
        -(r[2] * t.x + r[6] * t.y + r[10] * t.z),
    );
    r[12] = it.x;
    r[13] = it.y;
    r[14] = it.z;
    Some(r)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plane(p: V3, n: V3) -> Plane {
        Plane::from_point_normal(p, n).unwrap()
    }

    #[test]
    fn parallel_and_near_parallel_planes_do_not_intersect() {
        let a = plane(V3::ZERO, V3::Z);
        let b = plane(V3::new(0.0, 0.0, 10.0), V3::Z);
        assert!(a.intersect(&b).is_none());
        // Half a degree apart: sin(0.5°) is about 8.7e-3, under INTERSECT_SIN.
        let tilt = 0.5_f64.to_radians();
        let c = plane(V3::ZERO, V3::new(tilt.sin(), 0.0, tilt.cos()));
        assert!(a.intersect(&c).is_none());
    }

    #[test]
    fn perpendicular_planes_meet_on_a_unit_line() {
        let a = plane(V3::new(0.0, 0.0, 96.0), V3::Z);
        let b = plane(V3::new(120.0, 0.0, 0.0), V3::X);
        let (p, dir) = a.intersect(&b).unwrap();
        assert!(a.dist(p).abs() <= tol::PLANE);
        assert!(b.dist(p).abs() <= tol::PLANE);
        assert!((dir.len() - 1.0).abs() < 1e-12);
        assert!(dir.dot(V3::Y).abs() > 1.0 - 1e-12);
        // The point is the one closest to the origin: no component along the line.
        assert!(p.dot(dir).abs() < 1e-9);
        assert!(p.dist(V3::new(120.0, 0.0, 96.0)) < 1e-9);
    }

    #[test]
    fn rotation_about_z_maps_x_to_y_and_keeps_the_centre() {
        let m = mat_rotation(V3::ZERO, V3::Z, std::f64::consts::FRAC_PI_2).unwrap();
        let p = mat_apply(&m, V3::X);
        assert!(p.dist(V3::Y) < 1e-12);
        assert!(mat_apply_dir(&m, V3::X).dist(V3::Y) < 1e-12);
        let c = V3::new(10.0, 5.0, 3.0);
        let m = mat_rotation(c, V3::new(1.0, 1.0, 0.0), 1.0).unwrap();
        assert!(mat_apply(&m, c).dist(c) < 1e-12);
        // Rigid: lengths are kept and the inverse is the opposite rotation.
        let q = mat_apply(&m, V3::new(12.0, 5.0, 3.0));
        assert!((q.dist(c) - 2.0).abs() < 1e-12);
        let back = mat_rotation(c, V3::new(1.0, 1.0, 0.0), -1.0).unwrap();
        assert!(mat_apply(&back, q).dist(V3::new(12.0, 5.0, 3.0)) < 1e-12);
        assert!(mat_is_finite(&m));
    }

    #[test]
    fn zero_angle_is_the_identity_and_a_zero_axis_is_none() {
        assert_eq!(mat_rotation(V3::new(4.0, -2.0, 7.0), V3::Y, 0.0), Some(IDENTITY));
        assert_eq!(mat_rotation(V3::ZERO, V3::ZERO, 1.0), None);
        assert!(!mat_is_finite(&mat_translation(V3::new(f64::NAN, 0.0, 0.0))));
    }

    #[test]
    fn boxes_touching_within_tolerance_overlap() {
        let a = bbox([V3::ZERO, V3::new(10.0, 10.0, 10.0)].into_iter()).unwrap();
        let b =
            bbox([V3::new(10.0 + tol::LENGTH / 2.0, 0.0, 0.0), V3::new(20.0, 5.0, 5.0)].into_iter()).unwrap();
        let c =
            bbox([V3::new(10.0 + tol::LENGTH * 2.0, 0.0, 0.0), V3::new(20.0, 5.0, 5.0)].into_iter()).unwrap();
        assert!(bbox_overlap_3d(a, b));
        assert!(!bbox_overlap_3d(a, c));
        assert!(bbox(std::iter::empty()).is_none());
    }
}
