//! Intersect Faces: draw the edges where faces cross each other.
//!
//! Only the open context's definition is written. Faces of instances placed in it
//! are read, transformed into the context's coordinates, and never changed: the
//! other side of a cut is made by repeating the command inside that group, which is
//! SketchUp's rule too.

use crate::doc::*;
use crate::math::{
    bbox, bbox_overlap_3d, mat_apply, mat_mul, point_in_polygon, point_segment, segment_segment, to_2d, Mat4,
    Plane, IDENTITY, P2, V3,
};
use crate::tol;
use crate::Error;

/// What the selected faces are intersected against.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IntersectWith {
    /// Everything in `ctx`: its faces and the faces of instances placed in it, at any
    /// depth, transformed into `ctx` coordinates.
    Model,
    /// Only the other faces in `faces` (and the faces of `instances`, when given).
    Selection,
}

/// One segment to be drawn: the part of a plane–plane line inside both faces.
#[derive(Clone, Debug, PartialEq)]
pub struct Cut {
    pub a: V3,
    pub b: V3,
    /// The face in `ctx` the segment cuts (`None` when both faces belong to instances).
    pub face: Option<FId>,
}

/// A face as seen from `ctx`: its loops in `ctx` coordinates.
struct Placed {
    face: Option<FId>,
    plane: Plane,
    /// Outer loop first, then holes.
    loops: Vec<Vec<V3>>,
    bbox: (V3, V3),
    selected: bool,
}

/// A stretch of the intersection line inside one face: parameters along the line,
/// and whether the midpoint is clearly inside (`strict`) rather than on the boundary.
struct Span {
    t0: f64,
    t1: f64,
    strict: bool,
}

impl Placed {
    fn contains(&self, p: V3) -> bool {
        let (u, v) = self.plane.basis();
        let poly = |lp: &Vec<V3>| lp.iter().map(|&x| to_2d(x, u, v)).collect::<Vec<P2>>();
        let q = to_2d(p, u, v);
        point_in_polygon(q, &poly(&self.loops[0]))
            && !self.loops[1..].iter().any(|h| point_in_polygon(q, &poly(h)))
    }

    fn near_boundary(&self, p: V3) -> bool {
        self.loops
            .iter()
            .any(|lp| (0..lp.len()).any(|i| point_segment(p, lp[i], lp[(i + 1) % lp.len()]).0 <= tol::LENGTH))
    }

    /// The parts of the line `p + dir t` inside this face, as parameter ranges. The
    /// line lies in the face's plane; it is cut where it meets the loop edges and
    /// each piece between two cuts is tested at its midpoint.
    fn spans(&self, p: V3, dir: V3) -> Vec<Span> {
        let along = |q: V3| (q - p).dot(dir);
        let (mut lo, mut hi) = (f64::INFINITY, f64::NEG_INFINITY);
        for q in self.loops.iter().flatten() {
            lo = lo.min(along(*q));
            hi = hi.max(along(*q));
        }
        if lo > hi {
            return Vec::new();
        }
        let (l0, l1) = (p + dir * (lo - 1.0), p + dir * (hi + 1.0));
        let mut ts: Vec<f64> = Vec::new();
        for lp in &self.loops {
            for i in 0..lp.len() {
                let (a, b) = (lp[i], lp[(i + 1) % lp.len()]);
                match segment_segment(l0, l1, a, b) {
                    Some((s, _, d)) if d <= tol::LENGTH => ts.push((lo - 1.0) + s * (hi - lo + 2.0)),
                    Some(_) => {}
                    None => {
                        for q in [a, b] {
                            if point_segment(q, l0, l1).0 <= tol::LENGTH {
                                ts.push(along(q));
                            }
                        }
                    }
                }
            }
        }
        ts.sort_by(|x, y| x.total_cmp(y));
        ts.dedup_by(|x, y| (*x - *y).abs() <= tol::LENGTH);
        let mut out = Vec::new();
        for w in ts.windows(2) {
            let (t0, t1) = (w[0], w[1]);
            if t1 - t0 <= tol::LENGTH {
                continue;
            }
            let mid = p + dir * ((t0 + t1) / 2.0);
            let near = self.near_boundary(mid);
            if near || self.contains(mid) {
                out.push(Span { t0, t1, strict: !near });
            }
        }
        out
    }
}

impl Document {
    /// Intersect Faces. For every pair of non-parallel faces whose bounding boxes
    /// overlap, draw the common part of their intersection line into `ctx` and heal
    /// the planes it lies in. Only `ctx`'s definition is written; faces of instances
    /// are read, transformed into `ctx` coordinates, and never changed.
    /// `faces` are faces of `ctx`; `instances` are instances placed in `ctx` whose
    /// definitions (recursively) contribute faces. Returns the edges drawn.
    pub fn intersect_faces(
        &mut self,
        ctx: DefId,
        faces: &[FId],
        instances: &[InstId],
        with: IntersectWith,
    ) -> Result<Vec<EId>, Error> {
        self.check_def_unlocked(ctx)?;
        if faces.iter().any(|&f| !self.face(f).is_some_and(|x| x.owner == ctx)) {
            return Err(Error::Missing("face"));
        }
        if instances.iter().any(|&i| !self.instance(i).is_some_and(|x| x.parent == ctx)) {
            return Err(Error::Missing("instance"));
        }
        if faces.is_empty() && instances.is_empty() {
            return Err(Error::Empty);
        }
        let cuts = self.intersection_cuts(ctx, faces, instances, with);
        for c in &cuts {
            self.insert_segment(ctx, c.a, c.b)?;
        }
        // A later cut may have split an earlier cut's edges; a second pass changes
        // nothing and returns each cut's edges as they are now.
        let mut edges: Vec<EId> = Vec::new();
        for c in &cuts {
            for e in self.insert_segment(ctx, c.a, c.b)? {
                if !edges.contains(&e) {
                    edges.push(e);
                }
            }
        }
        self.heal_around(ctx, &edges)?;
        Ok(edges)
    }

    /// The segments `intersect_faces` would draw, without writing. Used by the
    /// tests and by `intersect_faces` itself.
    pub fn intersection_cuts(
        &self,
        ctx: DefId,
        faces: &[FId],
        instances: &[InstId],
        with: IntersectWith,
    ) -> Vec<Cut> {
        let mut placed: Vec<Placed> = Vec::new();
        for (id, face) in self.faces_in(ctx) {
            let selected = faces.contains(&id);
            if selected || with == IntersectWith::Model {
                placed.push(self.place(Some(id), face, &IDENTITY, selected));
            }
        }
        for (id, inst) in self.instances_in(ctx) {
            let selected = instances.contains(&id);
            if selected || with == IntersectWith::Model {
                self.place_instance(inst, &IDENTITY, selected, 0, &mut placed);
            }
        }
        let mut cuts = Vec::new();
        for i in 0..placed.len() {
            for j in i + 1..placed.len() {
                let (a, b) = (&placed[i], &placed[j]);
                if !(a.selected || b.selected) || !bbox_overlap_3d(a.bbox, b.bbox) {
                    continue;
                }
                let Some((p, dir)) = a.plane.intersect(&b.plane) else { continue };
                let (sa, sb) = (a.spans(p, dir), b.spans(p, dir));
                for x in &sa {
                    for y in &sb {
                        let (t0, t1) = (x.t0.max(y.t0), x.t1.min(y.t1));
                        // A line along both faces' boundaries (a shared edge) is not a cut.
                        if t1 - t0 > tol::LENGTH && (x.strict || y.strict) {
                            cuts.push(Cut { a: p + dir * t0, b: p + dir * t1, face: a.face.or(b.face) });
                        }
                    }
                }
            }
        }
        cuts
    }

    fn place(&self, id: Option<FId>, face: &Face, m: &Mat4, selected: bool) -> Placed {
        let loops: Vec<Vec<V3>> =
            face.loops().map(|lp| lp.iter().map(|&v| mat_apply(m, self.pos(v))).collect()).collect();
        let plane = Plane::from_loop(&loops[0]).unwrap_or(face.plane);
        let bbox = bbox(loops.iter().flatten().copied()).unwrap_or((V3::ZERO, V3::ZERO));
        Placed { face: id, plane, loops, bbox, selected }
    }

    /// Every face inside an instance, at any depth, placed through the composed
    /// transforms.
    fn place_instance(
        &self,
        inst: &Instance,
        parent: &Mat4,
        selected: bool,
        depth: usize,
        out: &mut Vec<Placed>,
    ) {
        if depth > 64 {
            return;
        }
        let m = mat_mul(parent, &inst.transform);
        for (_, face) in self.faces_in(inst.definition) {
            out.push(self.place(None, face, &m, selected));
        }
        for (_, child) in self.instances_in(inst.definition) {
            self.place_instance(child, &m, selected, depth + 1, out);
        }
    }
}
