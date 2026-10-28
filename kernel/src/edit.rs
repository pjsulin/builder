//! Moving and erasing geometry.

use std::collections::{BTreeSet, HashSet};

use crate::doc::*;
use crate::heal::OldRegion;
use crate::math::{point_segment, to_2d, Plane, P2, V3};
use crate::tol;
use crate::Error;

impl Document {
    /// Preview move: move vertices by `offset`. A face the move would bend is left
    /// as it was (its plane and triangulation stale) so the drag still shows; the
    /// committed `move_and_integrate` folds it. A face that would collapse or turn
    /// inside out fails the move and the caller should abort.
    pub fn move_vertices(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
        let set: BTreeSet<VId> = verts.iter().copied().collect();
        for &v in &set {
            self.check_def_unlocked(self.vertex(v).ok_or(Error::Missing("vertex"))?.owner)?;
        }
        let mut touched: BTreeSet<FId> = BTreeSet::new();
        for &v in &set {
            let mut vx = self.vertex(v).cloned().ok_or(Error::Missing("vertex"))?;
            vx.pos = vx.pos + offset;
            for &e in &vx.edges {
                touched.extend(self.edge(e).map(|e| e.faces.clone()).unwrap_or_default());
            }
            self.set_vertex(v, Some(vx));
        }
        for f in touched {
            match self.refresh_face(f) {
                Err(Error::NotPlanar) => {}
                r => r?,
            }
        }
        Ok(())
    }

    /// Committed move: fold faces the move would bend into planar pieces, move the
    /// vertices, then weld and settle what they landed on in their own definition,
    /// as if the geometry had been drawn there. Preview uses `move_vertices` alone.
    /// Every vertex must belong to one definition.
    pub fn move_and_integrate(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
        let set: BTreeSet<VId> = verts.iter().copied().collect();
        let mut owner: Option<DefId> = None;
        for &v in &set {
            let o = self.vertex(v).ok_or(Error::Missing("vertex"))?.owner;
            if owner.is_some_and(|d| d != o) {
                return Err(Error::Degenerate("vertices belong to more than one definition"));
            }
            owner = Some(o);
        }
        let Some(def) = owner else {
            return Ok(());
        };
        self.check_def_unlocked(def)?;
        self.fold_for_move(verts, offset)?;
        self.move_vertices(verts, offset)?;
        let edges = self.edges_of_vertices(verts);
        self.integrate_moved(def, &edges)
    }

    /// Before a move: every face using one of `verts` whose outer loop would not be
    /// planar at `pos + offset` is replaced by planar pieces along new diagonal
    /// edges, each keeping the face's normal side, materials and attributes. A face
    /// with holes that would bend is refused with `Error::NotPlanar`.
    pub(crate) fn fold_for_move(&mut self, verts: &[VId], offset: V3) -> Result<(), Error> {
        let set: BTreeSet<VId> = verts.iter().copied().collect();
        let mut faces: BTreeSet<FId> = BTreeSet::new();
        for &v in &set {
            for e in self.vertex(v).map(|x| x.edges.clone()).unwrap_or_default() {
                faces.extend(self.edge(e).map(|x| x.faces.clone()).unwrap_or_default());
            }
        }
        for f in faces {
            let Some(face) = self.face(f).cloned() else { continue };
            let pts: Vec<V3> = face
                .outer
                .iter()
                .map(|&x| if set.contains(&x) { self.pos(x) + offset } else { self.pos(x) })
                .collect();
            if is_planar(&pts) {
                continue;
            }
            if !face.holes.is_empty() {
                return Err(Error::NotPlanar);
            }
            // Diagonals are judged inside the face as it is now, in its own plane.
            let (u, v) = face.plane.basis();
            let flat: Vec<P2> = face.outer.iter().map(|&x| to_2d(self.pos(x), u, v)).collect();
            let (diagonals, pieces) = fold_pieces(&pts, &flat, face.plane.normal);
            if diagonals.is_empty() {
                return Err(Error::NotPlanar);
            }
            for (a, b) in diagonals {
                self.add_edge(face.outer[a], face.outer[b])?;
            }
            self.remove_face(f);
            for piece in pieces {
                let lp: Vec<VId> = piece.iter().map(|&k| face.outer[k]).collect();
                let nf = self.add_face(face.owner, lp, Vec::new(), Some(face.plane.normal))?;
                self.with_face(nf, |x| {
                    x.material = face.material;
                    x.back_material = face.back_material;
                    x.attributes = face.attributes.clone();
                });
            }
        }
        Ok(())
    }

    /// Weld and settle geometry that was placed by a move (or a copy): vertices that
    /// landed on another vertex merge into it, `edges` split and are split by edges
    /// they cross or overlap, every plane they lie in is healed as `add_line` would,
    /// and the faces around them settle as push/pull's do (cancelling against an
    /// opposite face, merging with a same-facing coplanar neighbour). `def` owns
    /// every edge.
    pub(crate) fn integrate_moved(&mut self, def: DefId, edges: &[EId]) -> Result<(), Error> {
        let mut verts: BTreeSet<VId> = BTreeSet::new();
        for &e in edges {
            if let Some(ed) = self.edge(e) {
                verts.extend(ed.v);
            }
        }
        for &v in &verts {
            let Some(pos) = self.vertex(v).map(|x| x.pos) else { continue };
            let into = self
                .vertices_in(def)
                .filter(|&(id, x)| id != v && x.pos.dist(pos) <= tol::LENGTH)
                .min_by(|a, b| a.1.pos.dist(pos).total_cmp(&b.1.pos.dist(pos)))
                .map(|(id, _)| id);
            if let Some(into) = into {
                self.merge_vertex_into(v, into)?;
            }
        }
        // Re-inserting each edge as a segment splits it at vertices and edges it now
        // touches, and splits those; the chain returned is the edge in its new pieces.
        let mut chain: BTreeSet<EId> = BTreeSet::new();
        for &e in edges {
            let Some(ed) = self.edge(e).cloned() else { continue };
            chain.extend(self.insert_segment(def, self.pos(ed.v[0]), self.pos(ed.v[1]))?);
        }
        let live = |d: &Document, set: &BTreeSet<EId>| {
            set.iter().copied().filter(|&e| d.edge(e).is_some()).collect::<Vec<EId>>()
        };
        self.integrate_edges(def, &live(self, &chain))?;
        self.heal_around(def, &live(self, &chain))?;
        let mut touched: BTreeSet<FId> = BTreeSet::new();
        for e in live(self, &chain) {
            let ends = self.edge(e).map(|x| x.v).unwrap_or([VId(0); 2]);
            for v in ends {
                for ve in self.vertex(v).map(|x| x.edges.clone()).unwrap_or_default() {
                    touched.extend(self.edge(ve).map(|x| x.faces.clone()).unwrap_or_default());
                }
            }
        }
        let touched: Vec<FId> = touched.into_iter().collect();
        self.settle_faces(def, &touched)?;
        Ok(())
    }

    /// The edges incident to `verts`, deduplicated and sorted.
    pub(crate) fn edges_of_vertices(&self, verts: &[VId]) -> Vec<EId> {
        let mut out: BTreeSet<EId> = BTreeSet::new();
        for &v in verts {
            if let Some(vx) = self.vertex(v) {
                out.extend(vx.edges.iter().copied());
            }
        }
        out.into_iter().collect()
    }

    /// Weld `from` into `into`, two vertices of one definition at the same position:
    /// every face loop and edge using `from` is re-pointed to `into`, an edge that
    /// would collapse or duplicate an existing `into` edge is dropped (its faces move
    /// to the existing edge), and `from` is removed.
    pub(crate) fn merge_vertex_into(&mut self, from: VId, into: VId) -> Result<(), Error> {
        if from == into {
            return Ok(());
        }
        let fx = self.vertex(from).cloned().ok_or(Error::Missing("vertex"))?;
        self.vertex(into).ok_or(Error::Missing("vertex"))?;
        let mut faces: BTreeSet<FId> = BTreeSet::new();
        for &e in &fx.edges {
            faces.extend(self.edge(e).map(|x| x.faces.clone()).unwrap_or_default());
        }
        for f in faces {
            let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
            for lp in std::iter::once(&mut face.outer).chain(face.holes.iter_mut()) {
                for x in lp.iter_mut() {
                    if *x == from {
                        *x = into;
                    }
                }
                // A collapsed edge leaves `into` twice in a row.
                let mut i = 0;
                while lp.len() > 1 && i < lp.len() {
                    if lp[i] == lp[(i + 1) % lp.len()] {
                        lp.remove(i);
                    } else {
                        i += 1;
                    }
                }
            }
            if face.outer.len() < 3 {
                self.remove_face(f);
                continue;
            }
            face.holes.retain(|h| h.len() >= 3);
            let n = face.plane.normal;
            self.prepare_face(&mut face, Some(n))?;
            self.set_face(f, Some(face));
        }
        for e in fx.edges {
            let Some(mut ed) = self.edge(e).cloned() else { continue };
            let other = ed.other(from);
            let existing = if other == into { None } else { self.edge_between(into, other) };
            if other == into || existing.is_some() {
                // Detach the faces so removing the edge keeps them.
                let faces = std::mem::take(&mut ed.faces);
                self.set_edge(e, Some(ed));
                self.remove_edge(e);
                if let Some(x) = existing {
                    let mut ex = self.edge(x).cloned().ok_or(Error::Missing("edge"))?;
                    for f in faces {
                        if self.face(f).is_some() && !ex.faces.contains(&f) {
                            ex.faces.push(f);
                        }
                    }
                    self.set_edge(x, Some(ex));
                }
                continue;
            }
            let i = if ed.v[0] == from { 0 } else { 1 };
            ed.v[i] = into;
            self.set_edge(e, Some(ed));
            let mut ix = self.vertex(into).cloned().ok_or(Error::Missing("vertex"))?;
            ix.edges.push(e);
            self.set_vertex(into, Some(ix));
        }
        if self.vertex(from).is_some() {
            self.set_vertex(from, None);
        }
        Ok(())
    }

    /// The vertices used by a set of faces and edges, for moving them.
    pub fn vertices_of(&self, faces: &[FId], edges: &[EId]) -> Vec<VId> {
        let mut out: BTreeSet<VId> = BTreeSet::new();
        for &f in faces {
            if let Some(face) = self.face(f) {
                out.extend(face.loops().flatten().copied());
            }
        }
        for &e in edges {
            if let Some(ed) = self.edge(e) {
                out.extend(ed.v);
            }
        }
        out.into_iter().collect()
    }

    /// Erase faces and edges. Erasing an edge removes the faces it bounds; when the
    /// edge divided two coplanar faces facing the same way, they merge into one.
    pub fn erase(&mut self, faces: &[FId], edges: &[EId]) -> Result<(), Error> {
        let owners = faces
            .iter()
            .filter_map(|&f| self.face(f).map(|x| x.owner))
            .chain(edges.iter().filter_map(|&e| self.edge(e).map(|x| x.owner)));
        for def in owners.collect::<BTreeSet<DefId>>() {
            self.check_def_unlocked(def)?;
        }
        let erased_faces: HashSet<FId> = faces.iter().copied().collect();
        for &f in faces {
            self.remove_face(f);
        }
        let mut ends: BTreeSet<VId> = BTreeSet::new();
        let mut merges: Vec<(DefId, Plane, Vec<OldRegion>, Vec<EId>)> = Vec::new();
        let mut merged_faces: HashSet<FId> = HashSet::new();
        for &e in edges {
            let Some(edge) = self.edge(e).cloned() else {
                continue;
            };
            ends.extend(edge.v);
            if let [f1, f2] = edge.faces[..] {
                if !erased_faces.contains(&f1)
                    && !erased_faces.contains(&f2)
                    && !merged_faces.contains(&f1)
                    && !merged_faces.contains(&f2)
                {
                    if let (Some(a), Some(b)) = (self.face(f1), self.face(f2)) {
                        let same = a.plane.same_surface(&b.plane)
                            && a.plane.normal.dot(b.plane.normal) > 0.0
                            && a.material == b.material
                            && a.back_material == b.back_material
                            && a.attributes == b.attributes;
                        if same {
                            let plane = a.plane;
                            let mut boundary: Vec<EId> = self.face_edges(a);
                            boundary.extend(self.face_edges(b));
                            boundary.retain(|&x| x != e);
                            let regions = [f1, f2]
                                .iter()
                                .filter_map(|&f| self.old_region(f, &plane))
                                .collect::<Vec<_>>();
                            merges.push((edge.owner, plane, regions, boundary));
                            merged_faces.extend([f1, f2]);
                        }
                    }
                }
            }
            self.remove_edge(e);
        }
        for (ctx, plane, regions, boundary) in merges {
            let boundary: Vec<EId> = boundary.into_iter().filter(|&e| self.edge(e).is_some()).collect();
            if !boundary.is_empty() {
                self.heal(ctx, &plane, &[], &boundary, regions)?;
            }
        }
        for v in ends {
            self.dissolve_vertex(v)?;
        }
        Ok(())
    }

    /// Remove a vertex that only joins two collinear edges used by the same faces,
    /// replacing them with one edge. Returns true if it did.
    pub fn dissolve_vertex(&mut self, v: VId) -> Result<bool, Error> {
        let Some(vx) = self.vertex(v).cloned() else {
            return Ok(false);
        };
        let [e1, e2] = vx.edges[..] else {
            return Ok(false);
        };
        let (Some(ed1), Some(ed2)) = (self.edge(e1).cloned(), self.edge(e2).cloned()) else {
            return Ok(false);
        };
        let (a, b) = (ed1.other(v), ed2.other(v));
        let (pa, pb) = (self.pos(a), self.pos(b));
        if point_segment(vx.pos, pa, pb).0 > tol::LENGTH || self.edge_between(a, b).is_some() {
            return Ok(false);
        }
        let f1: BTreeSet<FId> = ed1.faces.iter().copied().collect();
        let f2: BTreeSet<FId> = ed2.faces.iter().copied().collect();
        if f1 != f2 {
            return Ok(false);
        }
        // Detach faces so removing the edges keeps them, then drop v from their loops.
        for e in [e1, e2] {
            let mut ed = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
            ed.faces.clear();
            self.set_edge(e, Some(ed));
            self.remove_edge(e);
        }
        let ne = self.add_edge(a, b)?;
        for &f in &f1 {
            let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
            face.outer.retain(|&x| x != v);
            for h in face.holes.iter_mut() {
                h.retain(|&x| x != v);
            }
            let n = face.plane.normal;
            self.prepare_face(&mut face, Some(n))?;
            self.set_face(f, Some(face));
        }
        let mut ed = self.edge(ne).cloned().ok_or(Error::Missing("edge"))?;
        ed.faces = f1.into_iter().collect();
        self.set_edge(ne, Some(ed));
        Ok(true)
    }
}

/// True when every point lies on the loop's best-fit plane (or the loop has no plane).
fn is_planar(pts: &[V3]) -> bool {
    Plane::from_loop(pts).is_none_or(|p| pts.iter().all(|&q| p.contains(q)))
}

/// Pure: diagonals (index pairs into `pts`) that split a simple polygon that is no
/// longer planar into planar pieces. Only diagonals inside the polygon count, judged
/// on the loop projected along `normal` (a diagonal across a notch would overlap
/// other faces). At each step the inside diagonal whose two sub-polygon planes stay
/// closest to `normal` is chosen (the largest of the two dot products, so one piece
/// stays as flat as possible and the hinge runs between the moved vertex's
/// neighbours); a piece already planar within `tol::PLANE` is not split further.
/// Returns an empty Vec for a planar input, or when no inside diagonal exists.
pub fn fold_diagonals(pts: &[V3], normal: V3) -> Vec<(usize, usize)> {
    let Some(plane) = Plane::from_point_normal(pts.first().copied().unwrap_or_default(), normal) else {
        return Vec::new();
    };
    let (u, v) = plane.basis();
    let flat: Vec<P2> = pts.iter().map(|&p| to_2d(p, u, v)).collect();
    fold_pieces(pts, &flat, normal).0
}

/// `fold_diagonals` plus the pieces themselves, as index loops in the input's order.
/// `flat` is the loop in the plane's basis, counter-clockwise, used to test that a
/// diagonal lies inside the polygon.
fn fold_pieces(pts: &[V3], flat: &[P2], normal: V3) -> (Vec<(usize, usize)>, Vec<Vec<usize>>) {
    let mut diagonals = Vec::new();
    let mut pieces = Vec::new();
    let all: Vec<usize> = (0..pts.len()).collect();
    split_piece(pts, flat, all, normal, &mut diagonals, &mut pieces);
    (diagonals, pieces)
}

fn split_piece(
    pts: &[V3],
    flat: &[P2],
    idx: Vec<usize>,
    normal: V3,
    diagonals: &mut Vec<(usize, usize)>,
    pieces: &mut Vec<Vec<usize>>,
) {
    let n = idx.len();
    let of = |part: &[usize]| part.iter().map(|&k| pts[k]).collect::<Vec<V3>>();
    if n < 4 || is_planar(&of(&idx)) {
        pieces.push(idx);
        return;
    }
    let poly: Vec<P2> = idx.iter().map(|&k| flat[k]).collect();
    let flatness = |part: &[usize]| Plane::from_loop(&of(part)).map(|p| p.normal.dot(normal));
    let mut best: Option<(usize, usize, f64)> = None;
    for i in 0..n {
        for j in i + 2..n {
            if (i == 0 && j == n - 1) || !is_diagonal(&poly, i, j) {
                continue;
            }
            let a = &idx[i..=j];
            let b: Vec<usize> = idx[j..].iter().chain(&idx[..=i]).copied().collect();
            let (Some(fa), Some(fb)) = (flatness(a), flatness(&b)) else { continue };
            let score = fa.max(fb);
            if best.is_none_or(|(_, _, s)| score > s) {
                best = Some((i, j, score));
            }
        }
    }
    let Some((i, j, _)) = best else {
        pieces.push(idx);
        return;
    };
    diagonals.push((idx[i], idx[j]));
    let a: Vec<usize> = idx[i..=j].to_vec();
    let b: Vec<usize> = idx[j..].iter().chain(&idx[..=i]).copied().collect();
    split_piece(pts, flat, a, normal, diagonals, pieces);
    split_piece(pts, flat, b, normal, diagonals, pieces);
}

/// Twice the signed area of the triangle `a`, `b`, `c`.
fn area2(a: P2, b: P2, c: P2) -> f64 {
    (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
}

/// True when `i`–`j` is an internal diagonal of the counter-clockwise simple polygon
/// `poly`: it leaves both vertices into the polygon's interior and meets no other
/// edge, not even at a vertex (O'Rourke's test).
fn is_diagonal(poly: &[P2], i: usize, j: usize) -> bool {
    let n = poly.len();
    let eps = tol::AREA;
    let left = |a: P2, b: P2, c: P2| area2(a, b, c) > eps;
    let left_on = |a: P2, b: P2, c: P2| area2(a, b, c) > -eps;
    let collinear = |a: P2, b: P2, c: P2| area2(a, b, c).abs() <= eps;
    let between = |a: P2, b: P2, c: P2| {
        collinear(a, b, c)
            && c[0] >= a[0].min(b[0]) - tol::LENGTH
            && c[0] <= a[0].max(b[0]) + tol::LENGTH
            && c[1] >= a[1].min(b[1]) - tol::LENGTH
            && c[1] <= a[1].max(b[1]) + tol::LENGTH
    };
    let in_cone = |i: usize, j: usize| {
        let (a0, a, a1, b) = (poly[(i + n - 1) % n], poly[i], poly[(i + 1) % n], poly[j]);
        if left_on(a, a1, a0) {
            left(a, b, a0) && left(b, a, a1)
        } else {
            !(left_on(a, b, a1) && left_on(b, a, a0))
        }
    };
    let (a, b) = (poly[i], poly[j]);
    let clear = (0..n).all(|k| {
        let k1 = (k + 1) % n;
        if k == i || k1 == i || k == j || k1 == j {
            return true;
        }
        let (c, d) = (poly[k], poly[k1]);
        let proper = !(collinear(a, b, c) || collinear(a, b, d) || collinear(c, d, a) || collinear(c, d, b))
            && (left(a, b, c) != left(a, b, d))
            && (left(c, d, a) != left(c, d, b));
        !(proper || between(a, b, c) || between(a, b, d) || between(c, d, a) || between(c, d, b))
    });
    in_cone(i, j) && in_cone(j, i) && clear
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fold_hinges_between_the_lifted_corners_neighbours() {
        let quad = [
            V3::new(0.0, 0.0, 10.0),
            V3::new(10.0, 0.0, 10.0),
            V3::new(10.0, 10.0, 13.0),
            V3::new(0.0, 10.0, 10.0),
        ];
        assert_eq!(fold_diagonals(&quad, V3::Z), vec![(1, 3)]);
        let flat = [
            V3::new(0.0, 0.0, 10.0),
            V3::new(10.0, 0.0, 10.0),
            V3::new(10.0, 10.0, 10.0),
            V3::new(0.0, 10.0, 10.0),
        ];
        assert!(fold_diagonals(&flat, V3::Z).is_empty());
    }

    #[test]
    fn a_bent_hexagon_folds_into_planar_pieces() {
        // A regular-ish hexagon on z = 0 with two opposite corners lifted differently.
        let pts = [
            V3::new(0.0, 0.0, 0.0),
            V3::new(10.0, 0.0, 0.0),
            V3::new(15.0, 8.0, 4.0),
            V3::new(10.0, 16.0, 0.0),
            V3::new(0.0, 16.0, 0.0),
            V3::new(-5.0, 8.0, 2.0),
        ];
        let flat: Vec<P2> = pts.iter().map(|&p| [p.x, p.y]).collect();
        let (diagonals, pieces) = fold_pieces(&pts, &flat, V3::Z);
        assert!(!diagonals.is_empty());
        for piece in &pieces {
            assert!(piece.len() >= 3);
            assert!(is_planar(&piece.iter().map(|&k| pts[k]).collect::<Vec<_>>()));
        }
        assert_eq!(pieces.len(), diagonals.len() + 1);
    }

    #[test]
    fn fold_diagonals_stay_inside_a_notched_face() {
        // An L: a 20 x 20 square missing its lower-left 10 x 10 corner, with the
        // notch's inner corner lifted. The only inside diagonals start there.
        let pts = [
            V3::new(10.0, 0.0, 0.0),
            V3::new(20.0, 0.0, 0.0),
            V3::new(20.0, 20.0, 0.0),
            V3::new(0.0, 20.0, 0.0),
            V3::new(0.0, 10.0, 0.0),
            V3::new(10.0, 10.0, 2.0),
        ];
        let flat: Vec<P2> = pts.iter().map(|&p| [p.x, p.y]).collect();
        let diagonals = fold_diagonals(&pts, V3::Z);
        assert!(!diagonals.is_empty());
        for &(i, j) in &diagonals {
            assert!(is_diagonal(&flat, i, j), "diagonal {i}-{j} leaves the face");
        }
        assert!(is_diagonal(&flat, 5, 2));
        assert!(is_diagonal(&flat, 2, 4));
        assert!(!is_diagonal(&flat, 0, 4), "0-4 cuts across the notch");
        assert!(!is_diagonal(&flat, 1, 3), "1-3 passes through the notch's inner corner");
    }
}
