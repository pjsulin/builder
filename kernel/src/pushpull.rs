//! Push/Pull on any planar face.

use std::collections::{HashMap, HashSet};

use crate::doc::*;
use crate::math::{to_2d, Plane, V3};
use crate::tol;
use crate::Error;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PushPullMode {
    /// The face moved along its normal and its neighbors stretched.
    Stretch,
    /// New side faces and a cap were created.
    Extrude,
    /// The cap landed on an opposite face and both were removed, leaving an opening.
    Through,
}

#[derive(Clone, Debug)]
pub struct PushPullResult {
    /// The face now at the pushed or pulled position (absent after a push-through).
    pub face: Option<FId>,
    pub mode: PushPullMode,
}

impl Document {
    /// Move a face `distance` inches along its normal (negative pushes it in).
    pub fn push_pull(&mut self, f: FId, distance: f64) -> Result<PushPullResult, Error> {
        let face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
        self.check_def_unlocked(face.owner)?;
        if !distance.is_finite() {
            return Err(Error::Degenerate("distance is not a number"));
        }
        if distance.abs() <= tol::LENGTH {
            return Ok(PushPullResult { face: Some(f), mode: PushPullMode::Stretch });
        }
        if self.can_stretch(f, &face) {
            self.stretch(&face, distance)?;
            let mut edges: Vec<EId> = Vec::new();
            for &v in face.loops().flatten() {
                edges.extend(self.vertex(v).map(|x| x.edges.clone()).unwrap_or_default());
            }
            self.integrate_edges(face.owner, &edges)?;
            // A pocket floor pushed onto the far side of a wall opens it up.
            if self.cancel_against_opposite(face.owner, f)? {
                return Ok(PushPullResult { face: None, mode: PushPullMode::Through });
            }
            return Ok(PushPullResult { face: Some(f), mode: PushPullMode::Stretch });
        }
        self.extrude(f, &face, distance)
    }

    /// True when every edge of the face is shared with faces that contain the face's
    /// normal direction, so moving the face keeps them planar.
    fn can_stretch(&self, f: FId, face: &Face) -> bool {
        let n = face.plane.normal;
        let edges = self.face_edges(face);
        let mut any = false;
        for e in edges {
            let others: Vec<FId> = self
                .edge(e)
                .map(|e| e.faces.iter().copied().filter(|&x| x != f).collect())
                .unwrap_or_default();
            if others.is_empty() {
                return false;
            }
            for g in others {
                let Some(gf) = self.face(g) else { return false };
                if gf.plane.normal.dot(n).abs() > 1e-6 {
                    return false;
                }
                any = true;
            }
        }
        any
    }

    fn stretch(&mut self, face: &Face, distance: f64) -> Result<(), Error> {
        let offset = face.plane.normal * distance;
        let verts: HashSet<VId> = face.loops().flatten().copied().collect();
        let mut touched: HashSet<FId> = HashSet::new();
        for &v in &verts {
            let mut vx = self.vertex(v).cloned().ok_or(Error::Missing("vertex"))?;
            vx.pos = vx.pos + offset;
            for &e in &vx.edges {
                touched.extend(self.edge(e).map(|e| e.faces.clone()).unwrap_or_default());
            }
            self.set_vertex(v, Some(vx));
        }
        let mut touched: Vec<FId> = touched.into_iter().collect();
        touched.sort();
        for g in touched {
            self.refresh_face(g).map_err(|_| Error::Collapsed)?;
        }
        Ok(())
    }

    fn extrude(&mut self, f: FId, face: &Face, distance: f64) -> Result<PushPullResult, Error> {
        let ctx = face.owner;
        let n = face.plane.normal;
        let offset = n * distance;
        let free = self.face_edges(face).iter().all(|&e| self.edge(e).is_some_and(|e| e.faces.len() == 1));

        // Offset copies of every loop vertex.
        let mut map: HashMap<VId, VId> = HashMap::new();
        for &v in face.loops().flatten() {
            if let std::collections::hash_map::Entry::Vacant(slot) = map.entry(v) {
                let p = self.pos(v) + offset;
                slot.insert(self.vertex_at(ctx, p));
            }
        }
        let shift = |lp: &Vec<VId>| lp.iter().map(|v| map[v]).collect::<Vec<VId>>();
        let cap_outer = shift(&face.outer);
        let cap_holes: Vec<Vec<VId>> = face.holes.iter().map(shift).collect();

        // A free face stays as the bottom, facing away from the new solid. A face set
        // into a larger surface is consumed: the walls join that surface's hole.
        let sign = distance.signum();
        let (cap_normal, wall_sign) = if free { (n * sign, 1.0) } else { (n, sign) };
        if free {
            if sign > 0.0 {
                self.flip_face(f)?;
            }
        } else {
            self.remove_face(f);
        }

        let material = face.material;
        let cap = self.add_face(ctx, cap_outer, cap_holes, Some(cap_normal))?;
        self.with_face(cap, |c| {
            c.material = material;
            c.back_material = face.back_material;
            c.attributes = face.attributes.clone();
        });
        let mut created = vec![cap];
        for lp in face.loops() {
            for i in 0..lp.len() {
                let (a, b) = (lp[i], lp[(i + 1) % lp.len()]);
                let (a2, b2) = (map[&a], map[&b]);
                let dir = (self.pos(b) - self.pos(a)).cross(n) * wall_sign;
                let wall = self.add_face(ctx, vec![a, b, b2, a2], Vec::new(), Some(dir))?;
                self.with_face(wall, |w| {
                    w.material = material;
                    w.attributes = face.attributes.clone();
                });
                created.push(wall);
            }
        }

        let cap_point = self.face_interior_point(cap);
        let through = self.settle(ctx, &created, cap)?;
        if through {
            return Ok(PushPullResult { face: None, mode: PushPullMode::Through });
        }
        // Merging may have replaced the cap; find the face now under its old interior.
        let face = cap_point.and_then(|p| self.face_containing(ctx, p, cap_normal));
        Ok(PushPullResult { face: face.or(Some(cap)), mode: PushPullMode::Extrude })
    }

    /// Make newly created faces sticky with what they touch: merge overlapping edges,
    /// cancel faces that land on opposite-facing faces (leaving an opening), and merge
    /// faces that land beside same-facing coplanar faces. Returns true if `cap` was
    /// cancelled.
    fn settle(&mut self, ctx: DefId, created: &[FId], cap: FId) -> Result<bool, Error> {
        let mut edges: Vec<EId> = Vec::new();
        for &f in created {
            if let Some(face) = self.face(f) {
                edges.extend(self.face_edges(face));
            }
        }
        self.integrate_edges(ctx, &edges)?;
        let mut cap_gone = false;
        for &f in created {
            if self.cancel_against_opposite(ctx, f)? && f == cap {
                cap_gone = true;
            }
        }
        let mut edges: Vec<EId> = Vec::new();
        for &f in created {
            if let Some(face) = self.face(f) {
                edges.extend(self.face_edges(face));
            }
        }
        for e in edges {
            let Some(ed) = self.edge(e) else { continue };
            let [f1, f2] = ed.faces[..] else { continue };
            let (Some(a), Some(b)) = (self.face(f1), self.face(f2)) else { continue };
            if a.plane.same_surface(&b.plane)
                && a.plane.normal.dot(b.plane.normal) > 0.0
                && a.material == b.material
                && a.back_material == b.back_material
                && a.attributes == b.attributes
            {
                self.erase(&[], &[e])?;
            }
        }
        Ok(cap_gone)
    }

    /// Merge edges with any existing geometry they overlap or touch. A face whose
    /// loop now touches itself (a notch pushed all the way across it) is rebuilt as
    /// separate pieces.
    fn integrate_edges(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error> {
        let mut verts: HashSet<VId> = HashSet::new();
        let mut seen: HashSet<EId> = HashSet::new();
        for &e in edges {
            if !seen.insert(e) {
                continue;
            }
            if let Some(ed) = self.edge(e).cloned() {
                let new = self.insert_segment(ctx, self.pos(ed.v[0]), self.pos(ed.v[1]))?;
                for ne in new {
                    if let Some(x) = self.edge(ne) {
                        verts.extend(x.v);
                    }
                }
            }
        }
        let mut faces: HashSet<FId> = HashSet::new();
        for v in verts {
            for e in self.vertex(v).map(|x| x.edges.clone()).unwrap_or_default() {
                faces.extend(self.edge(e).map(|x| x.faces.clone()).unwrap_or_default());
            }
        }
        let mut faces: Vec<FId> = faces.into_iter().collect();
        faces.sort();
        for f in faces {
            let Some(face) = self.face(f) else { continue };
            let all: Vec<VId> = face.loops().flatten().copied().collect();
            let unique: HashSet<VId> = all.iter().copied().collect();
            if unique.len() == all.len() {
                continue;
            }
            let plane = face.plane;
            let edges = self.face_edges(face);
            let Some(region) = self.old_region(f, &plane) else { continue };
            self.remove_face(f);
            self.heal(ctx, &plane, &[], &edges, vec![region])?;
        }
        Ok(())
    }

    /// If face `f` lies on a coplanar face pointing the other way, cut that face along
    /// `f`'s outline and remove both overlapping pieces. Returns true if it did.
    fn cancel_against_opposite(&mut self, ctx: DefId, f: FId) -> Result<bool, Error> {
        let Some(plane) = self.face(f).map(|x| x.plane) else { return Ok(false) };
        let Some(pt) = self.face_interior_point(f) else { return Ok(false) };
        let (u, v) = plane.basis();
        let opposite = self.faces_in(ctx).any(|(g, gf)| {
            g != f
                && gf.plane.same_surface(&plane)
                && gf.plane.normal.dot(plane.normal) < 0.0
                && self.face_region_contains(gf, to_2d(pt, u, v), u, v)
        });
        if !opposite {
            return Ok(false);
        }
        let edges = self.face(f).map(|x| self.face_edges(x)).unwrap_or_default();
        if !self.remove_coincident_faces(ctx, &plane, f) {
            self.heal(ctx, &plane, &edges, &[], Vec::new())?;
            self.remove_face(f);
        }
        // The outline of an opening that no longer borders anything is not kept.
        for e in edges {
            if self.edge(e).is_some_and(|x| x.faces.is_empty()) {
                self.remove_edge(e);
            }
        }
        Ok(true)
    }

    /// The face containing point `p` whose normal points along `normal`.
    pub fn face_containing(&self, ctx: DefId, p: V3, normal: V3) -> Option<FId> {
        self.faces_in(ctx)
            .find(|(_, f)| {
                let (u, v) = f.plane.basis();
                f.plane.normal.dot(normal) > 0.0
                    && f.plane.contains(p)
                    && self.face_region_contains(f, to_2d(p, u, v), u, v)
            })
            .map(|(id, _)| id)
    }

    /// If another face in the plane has exactly the same loops as `f` but faces the
    /// other way, delete both. Returns true if it did.
    fn remove_coincident_faces(&mut self, ctx: DefId, plane: &Plane, f: FId) -> bool {
        let key = |face: &Face| {
            let mut v: Vec<VId> = face.loops().flatten().copied().collect();
            v.sort();
            v
        };
        let Some(face) = self.face(f) else {
            return false;
        };
        let k = key(face);
        let n = face.plane.normal;
        let twin = self.faces_in(ctx).find(|(g, gf)| {
            *g != f && gf.plane.same_surface(plane) && gf.plane.normal.dot(n) < 0.0 && key(gf) == k
        });
        match twin.map(|(g, _)| g) {
            Some(g) => {
                self.remove_face(f);
                self.remove_face(g);
                true
            }
            None => false,
        }
    }

    pub(crate) fn with_face(&mut self, f: FId, edit: impl FnOnce(&mut Face)) {
        if let Some(mut face) = self.face(f).cloned() {
            edit(&mut face);
            self.set_face(f, Some(face));
        }
    }

    /// A 3D point well inside a face (not on an edge).
    pub fn face_interior_point(&self, f: FId) -> Option<V3> {
        let face = self.face(f)?;
        let (u, v) = face.plane.basis();
        let to = |lp: &Vec<VId>| lp.iter().map(|&x| to_2d(self.pos(x), u, v)).collect::<Vec<_>>();
        let p =
            crate::heal::interior_point(&to(&face.outer), &face.holes.iter().map(to).collect::<Vec<_>>())?;
        Some(u * p[0] + v * p[1] + face.plane.normal * face.plane.d)
    }

    /// The normal a push/pull of `f` moves along, for tools.
    pub fn face_normal(&self, f: FId) -> Option<V3> {
        self.face(f).map(|x| x.plane.normal)
    }
}
