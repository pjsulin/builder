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
        if !distance.is_finite() {
            return Err(Error::Degenerate("distance is not a number"));
        }
        if distance.abs() <= tol::LENGTH {
            return Ok(PushPullResult {
                face: Some(f),
                mode: PushPullMode::Stretch,
            });
        }
        if self.can_stretch(f, &face) {
            self.stretch(&face, distance)?;
            return Ok(PushPullResult {
                face: Some(f),
                mode: PushPullMode::Stretch,
            });
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
        let free = self
            .face_edges(face)
            .iter()
            .all(|&e| self.edge(e).is_some_and(|e| e.faces.len() == 1));

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
        });

        for lp in face.loops() {
            for i in 0..lp.len() {
                let (a, b) = (lp[i], lp[(i + 1) % lp.len()]);
                let (a2, b2) = (map[&a], map[&b]);
                let dir = (self.pos(b) - self.pos(a)).cross(n) * wall_sign;
                let wall = self.add_face(ctx, vec![a, b, b2, a2], Vec::new(), Some(dir))?;
                self.with_face(wall, |w| w.material = material);
            }
        }

        // Pushing all the way through: the cap lands on an opposite face. Split that
        // face along the cap's outline, then drop the cap to leave an opening.
        let cap_plane = self
            .face(cap)
            .map(|c| c.plane)
            .ok_or(Error::Missing("face"))?;
        if let Some(pt) = self.face_interior_point(cap) {
            let (u, v) = cap_plane.basis();
            let opposite = self.faces_in(ctx).any(|(g, gf)| {
                g != cap
                    && gf.plane.same_surface(&cap_plane)
                    && gf.plane.normal.dot(cap_plane.normal) < 0.0
                    && self.face_region_contains(gf, to_2d(pt, u, v), u, v)
            });
            if opposite {
                if !self.remove_coincident_faces(ctx, &cap_plane, cap) {
                    let cap_edges = self
                        .face(cap)
                        .map(|c| self.face_edges(c))
                        .unwrap_or_default();
                    self.heal(ctx, &cap_plane, &cap_edges, &[], Vec::new())?;
                    self.remove_face(cap);
                }
                return Ok(PushPullResult {
                    face: None,
                    mode: PushPullMode::Through,
                });
            }
        }
        Ok(PushPullResult {
            face: Some(cap),
            mode: PushPullMode::Extrude,
        })
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
        let to = |lp: &Vec<VId>| {
            lp.iter()
                .map(|&x| to_2d(self.pos(x), u, v))
                .collect::<Vec<_>>()
        };
        let p = crate::heal::interior_point(
            &to(&face.outer),
            &face.holes.iter().map(to).collect::<Vec<_>>(),
        )?;
        Some(u * p[0] + v * p[1] + face.plane.normal * face.plane.d)
    }

    /// The normal a push/pull of `f` moves along, for tools.
    pub fn face_normal(&self, f: FId) -> Option<V3> {
        self.face(f).map(|x| x.plane.normal)
    }
}
