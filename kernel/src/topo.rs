//! Low-level topology edits. These keep the incidence lists (vertex → edges,
//! edge → faces) consistent but do not merge or heal anything; the operations in
//! `line`, `heal` and `pushpull` build on them.

use crate::doc::*;
use crate::math::{point_segment, signed_area2, to_2d, Plane, P2, V3};
use crate::tol;
use crate::Error;

impl Document {
    /// An existing vertex in `ctx` within tolerance of `p`.
    pub fn find_vertex(&self, ctx: DefId, p: V3) -> Option<VId> {
        let mut best: Option<(VId, f64)> = None;
        for (id, v) in self.vertices_in(ctx) {
            let d = v.pos.dist(p);
            if d <= tol::LENGTH && best.is_none_or(|(_, bd)| d < bd) {
                best = Some((id, d));
            }
        }
        best.map(|(id, _)| id)
    }

    pub fn add_vertex(&mut self, ctx: DefId, p: V3) -> VId {
        let id = self.next_vid();
        self.set_vertex(id, Some(Vertex { owner: ctx, pos: p, edges: Vec::new() }));
        id
    }

    /// The vertex at `p`, welding to an existing one when within tolerance.
    pub fn vertex_at(&mut self, ctx: DefId, p: V3) -> VId {
        self.find_vertex(ctx, p).unwrap_or_else(|| self.add_vertex(ctx, p))
    }

    pub fn edge_between(&self, a: VId, b: VId) -> Option<EId> {
        let va = self.vertex(a)?;
        va.edges.iter().copied().find(|&e| self.edge(e).is_some_and(|e| e.other(a) == b))
    }

    /// The edge from `a` to `b`, creating it if needed.
    pub fn add_edge(&mut self, a: VId, b: VId) -> Result<EId, Error> {
        if a == b {
            return Err(Error::Degenerate("edge has the same start and end"));
        }
        if let Some(e) = self.edge_between(a, b) {
            return Ok(e);
        }
        let owner = self.vertex(a).ok_or(Error::Missing("vertex"))?.owner;
        let id = self.next_eid();
        self.set_edge(id, Some(Edge { owner, v: [a, b], faces: Vec::new() }));
        for v in [a, b] {
            let mut vx = self.vertex(v).cloned().ok_or(Error::Missing("vertex"))?;
            vx.edges.push(id);
            self.set_vertex(v, Some(vx));
        }
        Ok(id)
    }

    /// Delete an edge and any faces that use it. Vertices left without edges go too.
    pub fn remove_edge(&mut self, e: EId) {
        let Some(edge) = self.edge(e).cloned() else {
            return;
        };
        for f in edge.faces.clone() {
            self.remove_face(f);
        }
        self.set_edge(e, None);
        for v in edge.v {
            if let Some(mut vx) = self.vertex(v).cloned() {
                vx.edges.retain(|&x| x != e);
                if vx.edges.is_empty() {
                    self.set_vertex(v, None);
                } else {
                    self.set_vertex(v, Some(vx));
                }
            }
        }
    }

    pub fn remove_face(&mut self, f: FId) {
        let Some(face) = self.face(f).cloned() else {
            return;
        };
        for e in self.face_edges(&face) {
            if let Some(mut ed) = self.edge(e).cloned() {
                ed.faces.retain(|&x| x != f);
                self.set_edge(e, Some(ed));
            }
        }
        self.set_face(f, None);
    }

    /// Edges of every loop of a face, in loop order.
    pub fn face_edges(&self, face: &Face) -> Vec<EId> {
        let mut out = Vec::new();
        for lp in face.loops() {
            for i in 0..lp.len() {
                if let Some(e) = self.edge_between(lp[i], lp[(i + 1) % lp.len()]) {
                    out.push(e);
                }
            }
        }
        out
    }

    pub fn loop_points(&self, lp: &[VId]) -> Vec<V3> {
        lp.iter().map(|&v| self.pos(v)).collect()
    }

    /// Create a face from vertex loops. Missing edges are created. The face's normal
    /// comes from the outer loop's winding; holes are re-wound to match. If `normal`
    /// is given, the loops are reversed when needed so the face points that way.
    pub fn add_face(
        &mut self,
        ctx: DefId,
        outer: Vec<VId>,
        holes: Vec<Vec<VId>>,
        normal: Option<V3>,
    ) -> Result<FId, Error> {
        let mut face = Face {
            owner: ctx,
            outer,
            holes,
            plane: Plane { normal: V3::Z, d: 0.0 },
            material: None,
            back_material: None,
            tris: Vec::new(),
        };
        self.prepare_face(&mut face, normal)?;
        let id = self.next_fid();
        for lp in face.loops() {
            for i in 0..lp.len() {
                self.add_edge(lp[i], lp[(i + 1) % lp.len()])?;
            }
        }
        let edges = self.face_edges(&face);
        self.set_face(id, Some(face));
        for e in edges {
            let mut ed = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
            if !ed.faces.contains(&id) {
                ed.faces.push(id);
            }
            self.set_edge(e, Some(ed));
        }
        Ok(id)
    }

    /// Compute plane, winding and triangulation for a face's loops, checking that
    /// they are planar and not degenerate.
    pub fn prepare_face(&self, face: &mut Face, normal: Option<V3>) -> Result<(), Error> {
        if face.outer.len() < 3 {
            return Err(Error::Degenerate("face needs at least three vertices"));
        }
        let pts = self.loop_points(&face.outer);
        let mut plane = Plane::from_loop(&pts).ok_or(Error::Degenerate("face has no area"))?;
        if let Some(n) = normal {
            if plane.normal.dot(n) < 0.0 {
                face.outer.reverse();
                plane = plane.flipped();
            }
        }
        let (u, v) = plane.basis();
        for lp in face.holes.iter_mut() {
            let hp: Vec<P2> = lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect();
            if signed_area2(&hp) > 0.0 {
                lp.reverse();
            }
        }
        for lp in face.loops() {
            for &x in lp {
                if !plane.contains(self.pos(x)) {
                    return Err(Error::NotPlanar);
                }
            }
        }
        let outer2: Vec<P2> = pts.iter().map(|&p| to_2d(p, u, v)).collect();
        if signed_area2(&outer2).abs() / 2.0 < tol::AREA {
            return Err(Error::Degenerate("face has no area"));
        }
        face.plane = plane;
        face.tris = self.triangulate(face)?;
        Ok(())
    }

    fn triangulate(&self, face: &Face) -> Result<Vec<u32>, Error> {
        let (u, v) = face.plane.basis();
        let mut data = Vec::new();
        let mut holes = Vec::new();
        for (i, lp) in face.loops().enumerate() {
            if i > 0 {
                holes.push(data.len() / 2);
            }
            for &x in lp {
                let p = to_2d(self.pos(x), u, v);
                data.extend_from_slice(&p);
            }
        }
        let tris =
            earcutr::earcut(&data, &holes, 2).map_err(|_| Error::Degenerate("triangulation failed"))?;
        // earcut does not promise a winding; make every triangle counter-clockwise.
        let mut out = Vec::with_capacity(tris.len());
        for t in tris.chunks(3) {
            let p = |k: usize| [data[2 * t[k]], data[2 * t[k] + 1]];
            if signed_area2(&[p(0), p(1), p(2)]) >= 0.0 {
                out.extend([t[0] as u32, t[1] as u32, t[2] as u32]);
            } else {
                out.extend([t[0] as u32, t[2] as u32, t[1] as u32]);
            }
        }
        Ok(out)
    }

    /// Re-derive a face's plane and triangulation after its vertices moved. Fails if
    /// the face is no longer planar, collapsed, or turned inside out.
    pub fn refresh_face(&mut self, f: FId) -> Result<(), Error> {
        let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
        let n = face.plane.normal;
        let wound = Plane::from_loop(&self.loop_points(&face.outer)).ok_or(Error::Collapsed)?;
        if wound.normal.dot(n) < 0.0 {
            return Err(Error::Collapsed);
        }
        self.prepare_face(&mut face, Some(n))?;
        self.set_face(f, Some(face));
        Ok(())
    }

    /// Reverse a face so its front becomes its back.
    pub fn flip_face(&mut self, f: FId) -> Result<(), Error> {
        let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
        face.outer.reverse();
        for h in face.holes.iter_mut() {
            h.reverse();
        }
        std::mem::swap(&mut face.material, &mut face.back_material);
        let n = -face.plane.normal;
        self.prepare_face(&mut face, Some(n))?;
        self.set_face(f, Some(face));
        Ok(())
    }

    /// Split an edge at a point near it. Faces using the edge get the new vertex in
    /// their loops. Returns the new vertex.
    pub fn split_edge(&mut self, e: EId, p: V3) -> Result<VId, Error> {
        let edge = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
        let [a, b] = edge.v;
        let ctx = edge.owner;
        let (pa, pb) = (self.pos(a), self.pos(b));
        let (_, t) = point_segment(p, pa, pb);
        let at = pa.lerp(pb, t);
        if at.dist(pa) <= tol::LENGTH {
            return Ok(a);
        }
        if at.dist(pb) <= tol::LENGTH {
            return Ok(b);
        }
        // Weld to a vertex already there, so overlapping edges merge.
        let w = self.find_vertex(ctx, at).unwrap_or_else(|| self.add_vertex(ctx, at));
        // Detach the faces, replace the edge, then re-attach with the new vertex.
        let faces = edge.faces.clone();
        let mut ed = edge.clone();
        ed.faces.clear();
        self.set_edge(e, Some(ed));
        self.remove_edge(e);
        // remove_edge may have deleted a or b if they had no other edges; restore them.
        for (v, pos) in [(a, pa), (b, pb)] {
            if self.vertex(v).is_none() {
                self.set_vertex(v, Some(Vertex { owner: ctx, pos, edges: Vec::new() }));
            }
        }
        let e1 = self.add_edge(a, w)?;
        let e2 = self.add_edge(w, b)?;
        for f in faces {
            let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
            for lp in std::iter::once(&mut face.outer).chain(face.holes.iter_mut()) {
                insert_between(lp, a, b, w);
            }
            let n = face.plane.normal;
            self.prepare_face(&mut face, Some(n))?;
            self.set_face(f, Some(face));
            for ne in [e1, e2] {
                let mut x = self.edge(ne).cloned().ok_or(Error::Missing("edge"))?;
                if !x.faces.contains(&f) {
                    x.faces.push(f);
                }
                self.set_edge(ne, Some(x));
            }
        }
        Ok(w)
    }

    /// Area of a face in square inches.
    pub fn face_area(&self, f: FId) -> f64 {
        let Some(face) = self.face(f) else { return 0.0 };
        let (u, v) = face.plane.basis();
        face.loops()
            .map(|lp| {
                let p: Vec<P2> = lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect();
                signed_area2(&p) / 2.0
            })
            .sum()
    }
}

/// Insert `w` into a vertex loop wherever `a` and `b` are adjacent (either order).
fn insert_between(lp: &mut Vec<VId>, a: VId, b: VId, w: VId) {
    let n = lp.len();
    for i in 0..n {
        let (x, y) = (lp[i], lp[(i + 1) % n]);
        if (x == a && y == b) || (x == b && y == a) {
            lp.insert(i + 1, w);
            return;
        }
    }
}
