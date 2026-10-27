//! Moving and erasing geometry.

use std::collections::{BTreeSet, HashSet};

use crate::doc::*;
use crate::heal::OldRegion;
use crate::math::{point_segment, Plane, V3};
use crate::tol;
use crate::Error;

impl Document {
    /// Move vertices by `offset`. Faces that use them must stay planar and keep
    /// their facing; otherwise the move fails and the caller should abort.
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
            self.refresh_face(f)?;
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
