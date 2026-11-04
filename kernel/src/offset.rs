//! Offsetting outlines: a face's loops, or a chain of edges, moved sideways in
//! their plane by a distance, with mitred corners, then drawn through the segment
//! path and healed like any drawn line. See docs/architecture.md, "Sticky
//! geometry: the operations".

use std::collections::{BTreeMap, BTreeSet};

use crate::doc::*;
use crate::math::{signed_area2, to_2d, Plane, P2, V3};
use crate::tol;
use crate::Error;

/// Pure: `pts` offset by `d` along each edge's right-hand normal in the plane
/// basis (`(dy, -dx)` of the edge direction: outward for a counter-clockwise loop,
/// into the hole for a clockwise one, to the right of an open chain's direction),
/// corners mitred where consecutive offset lines meet, a collinear corner moved
/// straight across. For an open chain (`closed == false`) the two ends are offset
/// perpendicular to their edge. `None` when the result self-intersects, an edge's
/// direction reverses against its original, two consecutive points coincide
/// within `tol::LENGTH`, or a closed loop's signed area changes sign or drops under
/// `tol::AREA`. `pts.len() >= 3` for a loop, `>= 2` for a chain.
pub fn offset_loop(pts: &[P2], d: f64, closed: bool) -> Option<Vec<P2>> {
    let n = pts.len();
    if n < if closed { 3 } else { 2 } || !d.is_finite() {
        return None;
    }
    let segments = if closed { n } else { n - 1 };
    // Unit direction and offset start point of every edge.
    let mut dirs: Vec<P2> = Vec::with_capacity(segments);
    let mut starts: Vec<P2> = Vec::with_capacity(segments);
    for i in 0..segments {
        let (a, b) = (pts[i], pts[(i + 1) % n]);
        let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
        let len = dx.hypot(dy);
        if len <= tol::LENGTH {
            return None;
        }
        let dir = [dx / len, dy / len];
        dirs.push(dir);
        starts.push([a[0] + dir[1] * d, a[1] - dir[0] * d]);
    }
    let mut out: Vec<P2> = Vec::with_capacity(n);
    for (i, &a) in pts.iter().enumerate() {
        let prev = if closed { Some((i + segments - 1) % segments) } else { i.checked_sub(1) };
        let next = if closed || i < segments { Some(i) } else { None };
        let p = match (prev, next) {
            (None, Some(k)) => starts[k],
            (Some(k), None) => [a[0] + dirs[k][1] * d, a[1] - dirs[k][0] * d],
            (Some(j), Some(k)) => mitre(starts[j], dirs[j], starts[k], dirs[k], a, d)?,
            (None, None) => return None,
        };
        out.push(p);
    }
    // Every edge keeps its direction and its length.
    for i in 0..segments {
        let (a, b) = (out[i], out[(i + 1) % n]);
        let (dx, dy) = (b[0] - a[0], b[1] - a[1]);
        if dx.hypot(dy) <= tol::LENGTH || dx * dirs[i][0] + dy * dirs[i][1] <= 0.0 {
            return None;
        }
    }
    if closed {
        let (before, after) = (signed_area2(pts), signed_area2(&out));
        if after.abs() / 2.0 < tol::AREA || (after > 0.0) != (before > 0.0) {
            return None;
        }
    }
    // No two edges that are not neighbours meet.
    for i in 0..segments {
        for j in i + 2..segments {
            if closed && i == 0 && j == segments - 1 {
                continue;
            }
            if segments_meet(out[i], out[(i + 1) % n], out[j], out[(j + 1) % n]) {
                return None;
            }
        }
    }
    Some(out)
}

/// Where the offset lines of two consecutive edges meet. Collinear edges (the
/// corner is straight) move the corner straight across; a hairpin is `None`.
fn mitre(a1: P2, d1: P2, a2: P2, d2: P2, corner: P2, d: f64) -> Option<P2> {
    let cross = d1[0] * d2[1] - d1[1] * d2[0];
    if cross.abs() < 1e-9 {
        if d1[0] * d2[0] + d1[1] * d2[1] < 0.0 {
            return None;
        }
        return Some([corner[0] + d1[1] * d, corner[1] - d1[0] * d]);
    }
    let w = [a2[0] - a1[0], a2[1] - a1[1]];
    let t = (w[0] * d2[1] - w[1] * d2[0]) / cross;
    Some([a1[0] + d1[0] * t, a1[1] + d1[1] * t])
}

/// Twice the signed area of the triangle `a`, `b`, `c`.
fn area2(a: P2, b: P2, c: P2) -> f64 {
    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
}

/// True when segments `a`–`b` and `c`–`d` cross properly or one touches the other
/// within `tol::LENGTH`.
fn segments_meet(a: P2, b: P2, c: P2, d: P2) -> bool {
    let eps = tol::AREA;
    let side = |p: P2, q: P2, r: P2| area2(p, q, r);
    let proper = (side(a, b, c) > eps) != (side(a, b, d) > eps)
        && (side(a, b, c) < -eps) != (side(a, b, d) < -eps)
        && (side(c, d, a) > eps) != (side(c, d, b) > eps)
        && (side(c, d, a) < -eps) != (side(c, d, b) < -eps);
    let touches = |p: P2, q: P2, r: P2| {
        // Distance from r to the segment p–q.
        let (dx, dy) = (q[0] - p[0], q[1] - p[1]);
        let l2 = dx * dx + dy * dy;
        let t = if l2 > 0.0 { (((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / l2).clamp(0.0, 1.0) } else { 0.0 };
        (r[0] - p[0] - dx * t).hypot(r[1] - p[1] - dy * t) <= tol::LENGTH
    };
    proper || touches(a, b, c) || touches(a, b, d) || touches(c, d, a) || touches(c, d, b)
}

impl Document {
    /// Offset a face's outer loop and holes in its plane: `distance > 0` moves every
    /// loop away from the face's interior (the outline grows, holes shrink), `< 0`
    /// toward it. Each offset loop is drawn through `insert_segment` and the drawn
    /// edges healed with `heal_around`, so an inward offset splits the face into a
    /// ring and an inner face, and an outward one adds a ring around it. Returns the
    /// edges drawn. `Error::SelfIntersecting` when `offset_loop` refuses any loop;
    /// nothing is written then. `Error::Degenerate` for a non-finite or
    /// `|distance| <= LENGTH` value; `Error::Locked` for a locked owner (ADR mvr2opid).
    pub fn offset_face(&mut self, f: FId, distance: f64) -> Result<Vec<EId>, Error> {
        let face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
        self.check_def_unlocked(face.owner)?;
        check_distance(distance)?;
        let (u, v) = face.plane.basis();
        let mut loops: Vec<Vec<V3>> = Vec::new();
        for lp in face.loops() {
            let flat: Vec<P2> = lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect();
            let moved = offset_loop(&flat, distance, true).ok_or(Error::SelfIntersecting)?;
            loops.push(moved.iter().map(|&p| lift(&face.plane, u, v, p)).collect());
        }
        self.draw_loops(face.owner, &loops, true)
    }

    /// Offset a chain of edges of `ctx`: the edges must form one connected path
    /// (open, or closed) and lie in one plane; `distance > 0` is to the right of
    /// the chain's direction (`dir × plane.normal`, the chain taken from the edge
    /// listed first), as `offset_loop` offsets an open chain. The plane is the
    /// chain's own (`Plane::from_loop` of its points) or, for a single edge or a
    /// collinear chain, the plane of a face a chain edge bounds;
    /// `Error::Degenerate("edges do not lie in one plane")` or `("edges are not one
    /// chain")` otherwise. Drawn and healed like `offset_face`. Returns the edges drawn.
    pub fn offset_edges(&mut self, ctx: DefId, edges: &[EId], distance: f64) -> Result<Vec<EId>, Error> {
        self.check_def_unlocked(ctx)?;
        check_distance(distance)?;
        let (path, closed) = self.chain_of(ctx, edges)?;
        let pts: Vec<V3> = path.iter().map(|&v| self.pos(v)).collect();
        let plane = match Plane::from_loop(&pts) {
            Some(p) if pts.iter().all(|&q| p.contains(q)) => p,
            Some(_) => return Err(Error::Degenerate("edges do not lie in one plane")),
            None => edges
                .iter()
                .filter_map(|&e| self.edge(e))
                .flat_map(|ed| ed.faces.iter())
                .find_map(|&f| self.face(f).map(|x| x.plane))
                .ok_or(Error::Degenerate("edges do not lie in one plane"))?,
        };
        let (u, v) = plane.basis();
        let flat: Vec<P2> = pts.iter().map(|&p| to_2d(p, u, v)).collect();
        let moved = offset_loop(&flat, distance, closed).ok_or(Error::SelfIntersecting)?;
        let lifted: Vec<V3> = moved.iter().map(|&p| lift(&plane, u, v, p)).collect();
        self.draw_loops(ctx, &[lifted], closed)
    }

    /// The vertices of `edges` in path order, and whether the path is closed. Every
    /// edge must belong to `ctx`; the direction follows the first listed edge.
    fn chain_of(&self, ctx: DefId, edges: &[EId]) -> Result<(Vec<VId>, bool), Error> {
        let set: BTreeSet<EId> = edges.iter().copied().collect();
        let not_chain = Error::Degenerate("edges are not one chain");
        if set.is_empty() {
            return Err(Error::Empty);
        }
        let mut at: BTreeMap<VId, Vec<EId>> = BTreeMap::new();
        for &e in &set {
            let ed = self.edge(e).ok_or(Error::Missing("edge"))?;
            if ed.owner != ctx {
                return Err(Error::Missing("edge"));
            }
            for v in ed.v {
                at.entry(v).or_default().push(e);
            }
        }
        if at.values().any(|l| l.len() > 2) {
            return Err(not_chain);
        }
        let ends: Vec<VId> = at.iter().filter(|(_, l)| l.len() == 1).map(|(&v, _)| v).collect();
        let closed = match ends.len() {
            0 => true,
            2 => false,
            _ => return Err(not_chain),
        };
        let first = self.edge(edges[0]).ok_or(Error::Missing("edge"))?.v;
        // Walk from one end (or from the first edge's start) along the path.
        let start = if closed { first[0] } else { ends[0] };
        let mut path = vec![start];
        let mut used: BTreeSet<EId> = BTreeSet::new();
        let mut here = start;
        while let Some(&e) = at[&here].iter().find(|e| !used.contains(e)) {
            used.insert(e);
            here = self.edge(e).ok_or(Error::Missing("edge"))?.other(here);
            if closed && here == start {
                break;
            }
            path.push(here);
        }
        if used.len() != set.len() || (closed && path.len() < 3) {
            return Err(not_chain);
        }
        // The chain runs the way the first listed edge does.
        let i = path.iter().position(|&v| v == first[0]).ok_or(not_chain.clone())?;
        let forward = path.get(i + 1).copied().or(closed.then(|| path[0]));
        if forward != Some(first[1]) {
            path.reverse();
            if closed {
                path.rotate_right(1);
            }
        }
        Ok((path, closed))
    }

    /// Draw loops (or one open chain) as segments and heal the planes they lie in.
    /// Returns the live edges drawn.
    fn draw_loops(&mut self, ctx: DefId, loops: &[Vec<V3>], closed: bool) -> Result<Vec<EId>, Error> {
        let mut drawn: Vec<EId> = Vec::new();
        for lp in loops {
            let segments = if closed { lp.len() } else { lp.len() - 1 };
            for i in 0..segments {
                drawn.extend(self.insert_segment(ctx, lp[i], lp[(i + 1) % lp.len()])?);
            }
        }
        let live: Vec<EId> = drawn.iter().copied().filter(|&e| self.edge(e).is_some()).collect();
        self.heal_around(ctx, &live)?;
        Ok(live.into_iter().filter(|&e| self.edge(e).is_some()).collect())
    }
}

fn check_distance(distance: f64) -> Result<(), Error> {
    if !distance.is_finite() {
        return Err(Error::Degenerate("offset is not a number"));
    }
    if distance.abs() <= tol::LENGTH {
        return Err(Error::Degenerate("offset is too small"));
    }
    Ok(())
}

/// A plane-basis point back in 3D.
fn lift(plane: &Plane, u: V3, v: V3, p: P2) -> V3 {
    u * p[0] + v * p[1] + plane.normal * plane.d
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: &[P2], b: &[P2]) -> bool {
        a.len() == b.len()
            && a.iter().zip(b).all(|(p, q)| (p[0] - q[0]).abs() < 1e-9 && (p[1] - q[1]).abs() < 1e-9)
    }

    #[test]
    fn a_square_offsets_in_and_out() {
        let sq = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]];
        let out = offset_loop(&sq, 2.0, true).unwrap();
        assert!(close(&out, &[[-2.0, -2.0], [12.0, -2.0], [12.0, 12.0], [-2.0, 12.0]]));
        let inner = offset_loop(&sq, -3.0, true).unwrap();
        assert!(close(&inner, &[[3.0, 3.0], [7.0, 3.0], [7.0, 7.0], [3.0, 7.0]]));
        // A clockwise loop (a hole) grows the other way for the same sign.
        let cw: Vec<P2> = sq.iter().rev().copied().collect();
        let hole = offset_loop(&cw, 2.0, true).unwrap();
        assert!(close(&hole, &[[2.0, 8.0], [8.0, 8.0], [8.0, 2.0], [2.0, 2.0]]));
    }

    #[test]
    fn a_triangle_mitres_its_corners() {
        let tri = [[0.0, 0.0], [12.0, 0.0], [0.0, 9.0]];
        let inner = offset_loop(&tri, -1.0, true).unwrap();
        // The right angle's corner moves along its bisector by √2; the hypotenuse
        // (3-4-5) shifts inward by 1.
        assert!((inner[0][0] - 1.0).abs() < 1e-9 && (inner[0][1] - 1.0).abs() < 1e-9);
        for p in &inner {
            let d = (3.0 * p[0] + 4.0 * p[1] - 36.0) / 5.0;
            assert!(d <= 1e-9, "inside the hypotenuse: {p:?}");
        }
        assert!((inner[1][1] - 1.0).abs() < 1e-9 && (inner[2][0] - 1.0).abs() < 1e-9);
        assert!(signed_area2(&inner) > 0.0 && signed_area2(&inner) < signed_area2(&tri));
    }

    #[test]
    fn a_collinear_corner_moves_straight_across() {
        let pts = [[0.0, 0.0], [5.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0]];
        let out = offset_loop(&pts, 1.0, true).unwrap();
        assert!(close(&out[..3], &[[-1.0, -1.0], [5.0, -1.0], [11.0, -1.0]]));
    }

    #[test]
    fn an_open_chain_offsets_its_ends_square() {
        let l = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0]];
        // Right of the direction: below the first edge, right of the second.
        let out = offset_loop(&l, 2.0, false).unwrap();
        assert!(close(&out, &[[0.0, -2.0], [12.0, -2.0], [12.0, 10.0]]));
        let left = offset_loop(&l, -2.0, false).unwrap();
        assert!(close(&left, &[[0.0, 2.0], [8.0, 2.0], [8.0, 10.0]]));
        let one = offset_loop(&[[0.0, 0.0], [10.0, 0.0]], 1.0, false).unwrap();
        assert!(close(&one, &[[0.0, -1.0], [10.0, -1.0]]));
        assert!(offset_loop(&[[0.0, 0.0]], 1.0, false).is_none());
        assert!(offset_loop(&[[0.0, 0.0], [10.0, 0.0]], 1.0, true).is_none());
    }

    #[test]
    fn an_offset_that_crosses_itself_is_none() {
        let thin = [[0.0, 0.0], [10.0, 0.0], [10.0, 2.0], [0.0, 2.0]];
        assert!(offset_loop(&thin, -1.5, true).is_none(), "the long sides reverse");
        assert!(offset_loop(&thin, -1.0, true).is_none(), "the long sides coincide");
        assert!(offset_loop(&thin, -0.5, true).is_some());
        // An L whose arms are 10 wide, offset inward 6: the arms fold back on themselves.
        let l = [[10.0, 0.0], [20.0, 0.0], [20.0, 20.0], [0.0, 20.0], [0.0, 10.0], [10.0, 10.0]];
        assert!(offset_loop(&l, -6.0, true).is_none());
        assert!(offset_loop(&l, -4.0, true).is_some());
        assert!(offset_loop(&l, 4.0, true).is_some());
        // Coincident consecutive points never offset.
        assert!(offset_loop(&[[0.0, 0.0], [0.0, 0.0], [1.0, 1.0]], 1.0, true).is_none());
        assert!(offset_loop(&thin, f64::NAN, true).is_none());
    }
}
