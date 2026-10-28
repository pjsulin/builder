//! Groups and component instances.

use std::collections::{BTreeSet, HashMap};

use crate::doc::*;
use crate::math::{mat_apply, mat_mul, Mat4, V3};
use crate::Error;

/// What an explode put back into the parent context.
#[derive(Clone, Debug, Default)]
pub struct Exploded {
    pub faces: Vec<FId>,
    pub edges: Vec<EId>,
    pub instances: Vec<InstId>,
}

impl Document {
    /// Wrap faces, edges and instances of `ctx` in a new group. Faces bring their
    /// edges with them. Edges still used by faces left outside stay behind as well,
    /// so the remaining geometry keeps its boundary.
    pub fn make_group(
        &mut self,
        ctx: DefId,
        faces: &[FId],
        edges: &[EId],
        instances: &[InstId],
    ) -> Result<InstId, Error> {
        self.check_def_unlocked(ctx)?;
        for &i in instances {
            self.check_instance_unlocked(i)?;
        }
        let faces: Vec<FId> =
            faces.iter().copied().filter(|&f| self.face(f).is_some_and(|x| x.owner == ctx)).collect();
        let mut edge_set: BTreeSet<EId> =
            edges.iter().copied().filter(|&e| self.edge(e).is_some_and(|x| x.owner == ctx)).collect();
        for &f in &faces {
            let face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
            edge_set.extend(self.face_edges(&face));
        }
        let instances: Vec<InstId> = instances
            .iter()
            .copied()
            .filter(|&i| self.instance(i).is_some_and(|x| x.parent == ctx))
            .collect();
        if faces.is_empty() && edge_set.is_empty() && instances.is_empty() {
            return Err(Error::Empty);
        }

        let def = self.next_def();
        let n = self.definitions.count();
        self.set_definition(
            def,
            Some(Definition {
                name: format!("Group#{n}"),
                kind: DefKind::Group,
                attributes: Attributes::new(),
            }),
        );
        let inst = self.new_instance(def, ctx);

        let mut vmap: HashMap<VId, VId> = HashMap::new();
        let mut map_v = |doc: &mut Document, v: VId| -> VId {
            *vmap.entry(v).or_insert_with(|| {
                let p = doc.pos(v);
                doc.add_vertex(def, p)
            })
        };
        for &e in &edge_set {
            let ed = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
            let (a, b) = (map_v(self, ed.v[0]), map_v(self, ed.v[1]));
            self.add_edge(a, b)?;
        }
        for &f in &faces {
            let face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
            let outer = face.outer.iter().map(|&v| map_v(self, v)).collect();
            let holes = face.holes.iter().map(|h| h.iter().map(|&v| map_v(self, v)).collect()).collect();
            let nf = self.add_face(def, outer, holes, Some(face.plane.normal))?;
            self.with_face(nf, |x| {
                x.material = face.material;
                x.back_material = face.back_material;
                x.attributes = face.attributes.clone();
            });
        }

        for &f in &faces {
            self.remove_face(f);
        }
        for &e in &edge_set {
            if self.edge(e).is_some_and(|x| x.faces.is_empty()) {
                self.remove_edge(e);
            }
        }
        for i in instances {
            let mut x = self.instance(i).cloned().ok_or(Error::Missing("instance"))?;
            x.parent = def;
            self.set_instance(i, Some(x));
        }
        Ok(inst)
    }

    /// Replace an instance with a copy of its geometry in the parent context. The
    /// copy welds to touching geometry there. A group's definition is deleted.
    pub fn explode(&mut self, inst: InstId) -> Result<Exploded, Error> {
        let instance = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
        self.check_instance_unlocked(inst)?;
        let (def, parent, m) = (instance.definition, instance.parent, instance.transform);
        let mut out = Exploded::default();

        let mut vmap: HashMap<VId, VId> = HashMap::new();
        let verts: Vec<(VId, V3)> = self.vertices_in(def).map(|(id, v)| (id, v.pos)).collect();
        for (id, p) in verts {
            let nv = self.vertex_at(parent, mat_apply(&m, p));
            vmap.insert(id, nv);
        }
        let edges: Vec<[VId; 2]> = self.edges_in(def).map(|(_, e)| e.v).collect();
        for [a, b] in edges {
            if vmap[&a] != vmap[&b] {
                out.edges.push(self.add_edge(vmap[&a], vmap[&b])?);
            }
        }
        let faces: Vec<Face> = self.faces_in(def).map(|(_, f)| f.clone()).collect();
        for face in faces {
            let p0 = self.pos(face.outer[0]);
            let normal = mat_apply(&m, p0 + face.plane.normal) - mat_apply(&m, p0);
            let outer = face.outer.iter().map(|v| vmap[v]).collect();
            let holes = face.holes.iter().map(|h| h.iter().map(|v| vmap[v]).collect()).collect();
            if let Ok(nf) = self.add_face(parent, outer, holes, Some(normal)) {
                self.with_face(nf, |x| {
                    x.material = face.material.or(instance.material);
                    x.back_material = face.back_material;
                    x.attributes = face.attributes.clone();
                });
                out.faces.push(nf);
            }
        }
        let children: Vec<InstId> = self.instances_in(def).map(|(i, _)| i).collect();
        let only_instance = self.instances_of(def).count() == 1;
        for c in children {
            if only_instance {
                let mut x = self.instance(c).cloned().ok_or(Error::Missing("instance"))?;
                x.parent = parent;
                x.transform = mat_mul(&m, &x.transform);
                self.set_instance(c, Some(x));
                out.instances.push(c);
            } else {
                let child = self.instance(c).cloned().ok_or(Error::Missing("instance"))?;
                let copy = self.new_instance(child.definition, parent);
                let mut x = child;
                x.parent = parent;
                x.transform = mat_mul(&m, &x.transform);
                self.set_instance(copy, Some(x));
                out.instances.push(copy);
            }
        }
        self.set_instance(inst, None);
        if only_instance {
            self.delete_definition_contents(def);
            self.set_definition(def, None);
        }
        Ok(out)
    }

    fn delete_definition_contents(&mut self, def: DefId) {
        let faces: Vec<FId> = self.faces_in(def).map(|(id, _)| id).collect();
        for f in faces {
            self.remove_face(f);
        }
        let edges: Vec<EId> = self.edges_in(def).map(|(id, _)| id).collect();
        for e in edges {
            self.remove_edge(e);
        }
    }

    /// Delete an instance. A group's definition goes with it.
    pub fn erase_instance(&mut self, inst: InstId) -> Result<(), Error> {
        let def = self.instance(inst).ok_or(Error::Missing("instance"))?.definition;
        self.check_instance_unlocked(inst)?;
        self.set_instance(inst, None);
        if self.instances_of(def).count() == 0 {
            let children: Vec<InstId> = self.instances_in(def).map(|(i, _)| i).collect();
            for c in children {
                self.erase_instance(c)?;
            }
            self.delete_definition_contents(def);
            self.set_definition(def, None);
        }
        Ok(())
    }

    pub fn set_transform(&mut self, inst: InstId, m: Mat4) -> Result<(), Error> {
        let mut x = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
        self.check_instance_unlocked(inst)?;
        x.transform = m;
        self.set_instance(inst, Some(x));
        Ok(())
    }

    /// True when the definition's geometry is locked: an instance of it, or of a
    /// definition it is placed in, is on a locked tag.
    pub fn is_locked_def(&self, def: DefId) -> bool {
        self.instances_of(def).any(|(_, i)| self.tag_locked(i.tag) || self.is_locked_def(i.parent))
    }

    fn tag_locked(&self, tag: Option<TagId>) -> bool {
        tag.and_then(|t| self.tag(t)).is_some_and(|t| t.locked)
    }

    /// True when anything placed inside `def`, at any depth, is on a locked tag.
    fn contains_locked(&self, def: DefId) -> bool {
        self.instances_in(def).any(|(_, i)| self.tag_locked(i.tag) || self.contains_locked(i.definition))
    }

    /// `Error::Locked` if edits to geometry in `def` are refused.
    pub(crate) fn check_def_unlocked(&self, def: DefId) -> Result<(), Error> {
        if self.is_locked_def(def) {
            return Err(Error::Locked);
        }
        Ok(())
    }

    /// `Error::Locked` if moving, erasing, exploding or regrouping `inst` would change a
    /// locked instance: it is on a locked tag, sits in locked geometry, or carries a
    /// locked instance inside it.
    pub(crate) fn check_instance_unlocked(&self, inst: InstId) -> Result<(), Error> {
        let i = self.instance(inst).ok_or(Error::Missing("instance"))?;
        if self.tag_locked(i.tag) || self.is_locked_def(i.parent) || self.contains_locked(i.definition) {
            return Err(Error::Locked);
        }
        Ok(())
    }

    /// Transform from a definition's coordinates to world coordinates, following the
    /// chain of instances up to the root. Assumes each definition on the path has one
    /// instance (true for groups); components use the first instance found.
    pub fn world_transform(&self, def: DefId) -> Mat4 {
        let mut m = crate::math::IDENTITY;
        let mut d = def;
        let mut guard = 0;
        while d != ROOT && guard < 64 {
            let Some((_, inst)) = self.instances_of(d).next() else {
                break;
            };
            m = mat_mul(&inst.transform, &m);
            d = inst.parent;
            guard += 1;
        }
        m
    }
}
