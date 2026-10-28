//! The document: entity records stored in journaled arenas.
//!
//! Every write to an arena goes through [`Document`]'s setters, which record the
//! slot's value before and after. A transaction is the list of those writes, so undo,
//! redo and aborting a live preview are all just restoring slot values.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::math::{Mat4, Plane, IDENTITY, V3};
use crate::Error;

macro_rules! id_type {
    ($name:ident) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub u32);
        impl $name {
            pub fn idx(self) -> usize {
                self.0 as usize
            }
        }
    };
}

id_type!(VId);
id_type!(EId);
id_type!(FId);
id_type!(DefId);
id_type!(InstId);
id_type!(MatId);
id_type!(TagId);

/// The model root's definition. Loose geometry lives here.
pub const ROOT: DefId = DefId(0);

/// An attribute value: a JSON string, number or boolean.
pub type AttrValue = serde_json::Value;

/// Attributes by namespace, then key (`{"survey": {"kind": "wall"}}`). Sorted, so
/// they serialize the same way every time. A namespace is never left empty.
pub type Attributes = BTreeMap<String, BTreeMap<String, AttrValue>>;

/// What an attribute is attached to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttrTarget {
    Definition(DefId),
    Instance(InstId),
    Face(FId),
}

/// Check one attribute: the namespace is a lowercase identifier
/// (`[a-z][a-z0-9_-]*`), the key is not empty and the value, if any, is a scalar.
pub(crate) fn check_attribute(ns: &str, key: &str, value: Option<&AttrValue>) -> Result<(), String> {
    let mut chars = ns.chars();
    let ns_ok = chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-');
    if !ns_ok {
        return Err(format!("namespace {ns:?} must match [a-z][a-z0-9_-]*"));
    }
    if key.is_empty() {
        return Err("key is empty".into());
    }
    if value.is_some_and(|v| !(v.is_string() || v.is_number() || v.is_boolean())) {
        return Err("value must be a string, number or boolean".into());
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq)]
pub struct Vertex {
    pub owner: DefId,
    pub pos: V3,
    pub edges: Vec<EId>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Edge {
    pub owner: DefId,
    pub v: [VId; 2],
    pub faces: Vec<FId>,
}

impl Edge {
    pub fn other(&self, v: VId) -> VId {
        if self.v[0] == v {
            self.v[1]
        } else {
            self.v[0]
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Face {
    pub owner: DefId,
    /// Counter-clockwise seen from the front (looking against `plane.normal`).
    pub outer: Vec<VId>,
    /// Clockwise seen from the front.
    pub holes: Vec<Vec<VId>>,
    pub plane: Plane,
    pub material: Option<MatId>,
    pub back_material: Option<MatId>,
    pub attributes: Attributes,
    /// Cached triangulation: indices into the concatenation of `outer` and `holes`,
    /// counter-clockwise seen from the front.
    pub tris: Vec<u32>,
}

impl Face {
    pub fn loops(&self) -> impl Iterator<Item = &Vec<VId>> {
        std::iter::once(&self.outer).chain(self.holes.iter())
    }
    /// The loop vertices in triangulation index order.
    pub fn flat_vertices(&self) -> Vec<VId> {
        self.loops().flatten().copied().collect()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DefKind {
    Root,
    Group,
    Component,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Definition {
    pub name: String,
    pub kind: DefKind,
    pub attributes: Attributes,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Instance {
    pub definition: DefId,
    /// The definition this instance is placed in.
    pub parent: DefId,
    pub transform: Mat4,
    pub name: String,
    pub material: Option<MatId>,
    pub tag: Option<TagId>,
    pub attributes: Attributes,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Material {
    pub name: String,
    /// sRGB, 0–255.
    pub color: [u8; 3],
    pub opacity: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Tag {
    pub name: String,
    pub visible: bool,
    /// Instances on a locked tag, and the geometry inside them, refuse edits.
    #[serde(default)]
    pub locked: bool,
}

/// Slot storage. Ids are indexes and are never reused; deleted slots are `None`.
#[derive(Clone, Debug)]
pub struct Arena<T> {
    slots: Vec<Option<T>>,
}

impl<T> Default for Arena<T> {
    fn default() -> Self {
        Arena { slots: Vec::new() }
    }
}

impl<T> Arena<T> {
    pub fn get(&self, i: usize) -> Option<&T> {
        self.slots.get(i).and_then(|s| s.as_ref())
    }
    pub fn len_slots(&self) -> usize {
        self.slots.len()
    }
    pub fn iter(&self) -> impl Iterator<Item = (usize, &T)> {
        self.slots.iter().enumerate().filter_map(|(i, s)| s.as_ref().map(|t| (i, t)))
    }
    pub fn count(&self) -> usize {
        self.slots.iter().filter(|s| s.is_some()).count()
    }
    fn put(&mut self, i: usize, v: Option<T>) -> Option<T> {
        if i >= self.slots.len() {
            self.slots.resize_with(i + 1, || None);
        }
        std::mem::replace(&mut self.slots[i], v)
    }
}

/// One recorded arena write.
#[derive(Clone, Debug)]
pub enum Change {
    Vertex(u32, Option<Vertex>, Option<Vertex>),
    Edge(u32, Option<Edge>, Option<Edge>),
    Face(u32, Option<Face>, Option<Face>),
    Definition(u32, Option<Definition>, Option<Definition>),
    Instance(u32, Option<Instance>, Option<Instance>),
    Material(u32, Option<Material>, Option<Material>),
    Tag(u32, Option<Tag>, Option<Tag>),
}

#[derive(Clone, Debug)]
pub struct Transaction {
    pub name: String,
    pub changes: Vec<Change>,
}

#[derive(Clone, Debug, Default)]
pub struct Document {
    pub vertices: Arena<Vertex>,
    pub edges: Arena<Edge>,
    pub faces: Arena<Face>,
    pub definitions: Arena<Definition>,
    pub instances: Arena<Instance>,
    pub materials: Arena<Material>,
    pub tags: Arena<Tag>,
    /// Writes made since the open transaction began.
    pending: Vec<Change>,
    open: Option<String>,
    undo: Vec<Transaction>,
    redo: Vec<Transaction>,
}

macro_rules! setter {
    ($set:ident, $get:ident, $arena:ident, $ty:ty, $id:ty, $variant:ident) => {
        pub fn $get(&self, id: $id) -> Option<&$ty> {
            self.$arena.get(id.idx())
        }
        /// Write a slot, recording the change in the open transaction.
        pub fn $set(&mut self, id: $id, value: Option<$ty>) {
            let after = value.clone();
            let before = self.$arena.put(id.idx(), value);
            self.pending.push(Change::$variant(id.0, before, after));
        }
    };
}

impl Document {
    pub fn new() -> Self {
        let mut d = Document::default();
        d.set_definition(
            DefId(0),
            Some(Definition { name: "Model".into(), kind: DefKind::Root, attributes: Attributes::new() }),
        );
        d.pending.clear();
        d
    }

    setter!(set_vertex, vertex, vertices, Vertex, VId, Vertex);
    setter!(set_edge, edge, edges, Edge, EId, Edge);
    setter!(set_face, face, faces, Face, FId, Face);
    setter!(set_definition, definition, definitions, Definition, DefId, Definition);
    setter!(set_instance, instance, instances, Instance, InstId, Instance);
    setter!(set_material, material, materials, Material, MatId, Material);
    setter!(set_tag_record, tag, tags, Tag, TagId, Tag);

    pub fn next_vid(&self) -> VId {
        VId(self.vertices.len_slots() as u32)
    }
    pub fn next_eid(&self) -> EId {
        EId(self.edges.len_slots() as u32)
    }
    pub fn next_fid(&self) -> FId {
        FId(self.faces.len_slots() as u32)
    }
    pub fn next_def(&self) -> DefId {
        DefId(self.definitions.len_slots() as u32)
    }
    pub fn next_inst(&self) -> InstId {
        InstId(self.instances.len_slots() as u32)
    }
    pub fn next_mat(&self) -> MatId {
        MatId(self.materials.len_slots() as u32)
    }

    pub fn pos(&self, v: VId) -> V3 {
        self.vertices.get(v.idx()).map(|v| v.pos).unwrap_or_default()
    }

    // ---- transactions ----

    /// Start a transaction. Edits made outside a transaction are still journaled and
    /// become part of the next one that commits.
    pub fn begin(&mut self, name: &str) {
        if self.open.is_some() {
            self.abort();
        }
        self.open = Some(name.to_string());
    }

    pub fn in_transaction(&self) -> bool {
        self.open.is_some()
    }

    /// Commit the open transaction. Returns false if nothing changed.
    pub fn commit(&mut self) -> bool {
        let name = self.open.take().unwrap_or_default();
        if self.pending.is_empty() {
            return false;
        }
        let changes = std::mem::take(&mut self.pending);
        self.undo.push(Transaction { name, changes });
        self.redo.clear();
        true
    }

    /// Throw away every write since `begin`.
    pub fn abort(&mut self) {
        let changes = std::mem::take(&mut self.pending);
        for c in changes.iter().rev() {
            self.apply(c, true);
        }
        self.open = None;
    }

    pub fn undo(&mut self) -> Option<String> {
        if self.open.is_some() {
            self.abort();
        }
        let t = self.undo.pop()?;
        for c in t.changes.iter().rev() {
            self.apply(c, true);
        }
        let name = t.name.clone();
        self.redo.push(t);
        Some(name)
    }

    pub fn redo(&mut self) -> Option<String> {
        if self.open.is_some() {
            self.abort();
        }
        let t = self.redo.pop()?;
        for c in &t.changes {
            self.apply(c, false);
        }
        let name = t.name.clone();
        self.undo.push(t);
        Some(name)
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
    pub fn undo_name(&self) -> Option<&str> {
        self.undo.last().map(|t| t.name.as_str())
    }

    /// Changes in the open transaction (used to find which definitions to redraw).
    pub fn pending_changes(&self) -> &[Change] {
        &self.pending
    }

    /// Forget all history (after loading a file).
    pub fn clear_history(&mut self) {
        self.pending.clear();
        self.open = None;
        self.undo.clear();
        self.redo.clear();
    }

    fn apply(&mut self, c: &Change, backwards: bool) {
        macro_rules! restore {
            ($arena:ident, $i:expr, $b:expr, $a:expr) => {{
                let v = if backwards { $b.clone() } else { $a.clone() };
                self.$arena.put(*$i as usize, v);
            }};
        }
        match c {
            Change::Vertex(i, b, a) => restore!(vertices, i, b, a),
            Change::Edge(i, b, a) => restore!(edges, i, b, a),
            Change::Face(i, b, a) => restore!(faces, i, b, a),
            Change::Definition(i, b, a) => restore!(definitions, i, b, a),
            Change::Instance(i, b, a) => restore!(instances, i, b, a),
            Change::Material(i, b, a) => restore!(materials, i, b, a),
            Change::Tag(i, b, a) => restore!(tags, i, b, a),
        }
    }

    // ---- convenience queries ----

    pub fn faces_in(&self, ctx: DefId) -> impl Iterator<Item = (FId, &Face)> {
        self.faces.iter().filter(move |(_, f)| f.owner == ctx).map(|(i, f)| (FId(i as u32), f))
    }
    pub fn edges_in(&self, ctx: DefId) -> impl Iterator<Item = (EId, &Edge)> {
        self.edges.iter().filter(move |(_, e)| e.owner == ctx).map(|(i, e)| (EId(i as u32), e))
    }
    pub fn vertices_in(&self, ctx: DefId) -> impl Iterator<Item = (VId, &Vertex)> {
        self.vertices.iter().filter(move |(_, v)| v.owner == ctx).map(|(i, v)| (VId(i as u32), v))
    }
    pub fn instances_in(&self, ctx: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
        self.instances.iter().filter(move |(_, i)| i.parent == ctx).map(|(i, inst)| (InstId(i as u32), inst))
    }
    pub fn instances_of(&self, def: DefId) -> impl Iterator<Item = (InstId, &Instance)> {
        self.instances
            .iter()
            .filter(move |(_, i)| i.definition == def)
            .map(|(i, inst)| (InstId(i as u32), inst))
    }

    pub fn new_instance(&mut self, definition: DefId, parent: DefId) -> InstId {
        let id = self.next_inst();
        self.set_instance(
            id,
            Some(Instance {
                definition,
                parent,
                transform: IDENTITY,
                name: String::new(),
                material: None,
                tag: None,
                attributes: Attributes::new(),
            }),
        );
        id
    }

    // ---- attributes and tags ----

    pub fn attributes(&self, t: AttrTarget) -> Option<&Attributes> {
        match t {
            AttrTarget::Definition(d) => self.definition(d).map(|x| &x.attributes),
            AttrTarget::Instance(i) => self.instance(i).map(|x| &x.attributes),
            AttrTarget::Face(f) => self.face(f).map(|x| &x.attributes),
        }
    }

    /// Set one attribute, or delete it with `None`. A namespace left empty is removed.
    pub fn set_attribute(
        &mut self,
        t: AttrTarget,
        ns: &str,
        key: &str,
        value: Option<AttrValue>,
    ) -> Result<(), Error> {
        check_attribute(ns, key, value.as_ref())
            .map_err(|why| Error::Attribute(format!("{ns}.{key}: {why}")))?;
        let edit = |attrs: &mut Attributes| match value {
            Some(v) => {
                attrs.entry(ns.to_string()).or_default().insert(key.to_string(), v);
            }
            None => {
                if let Some(keys) = attrs.get_mut(ns) {
                    keys.remove(key);
                    if keys.is_empty() {
                        attrs.remove(ns);
                    }
                }
            }
        };
        match t {
            AttrTarget::Definition(d) => {
                let mut x = self.definition(d).cloned().ok_or(Error::Missing("definition"))?;
                edit(&mut x.attributes);
                self.set_definition(d, Some(x));
            }
            AttrTarget::Instance(i) => {
                let mut x = self.instance(i).cloned().ok_or(Error::Missing("instance"))?;
                edit(&mut x.attributes);
                self.set_instance(i, Some(x));
            }
            AttrTarget::Face(f) => {
                let mut x = self.face(f).cloned().ok_or(Error::Missing("face"))?;
                edit(&mut x.attributes);
                self.set_face(f, Some(x));
            }
        }
        Ok(())
    }

    /// Add a visible, unlocked tag.
    pub fn new_tag(&mut self, name: &str) -> TagId {
        let id = TagId(self.tags.len_slots() as u32);
        self.set_tag_record(id, Some(Tag { name: name.to_string(), visible: true, locked: false }));
        id
    }

    /// Put an instance on a tag, or on none.
    pub fn set_tag(&mut self, inst: InstId, tag: Option<TagId>) -> Result<(), Error> {
        let mut x = self.instance(inst).cloned().ok_or(Error::Missing("instance"))?;
        if let Some(t) = tag {
            self.tag(t).ok_or(Error::Missing("tag"))?;
        }
        x.tag = tag;
        self.set_instance(inst, Some(x));
        Ok(())
    }

    pub fn set_tag_flags(&mut self, tag: TagId, visible: bool, locked: bool) -> Result<(), Error> {
        let mut x = self.tag(tag).cloned().ok_or(Error::Missing("tag"))?;
        x.visible = visible;
        x.locked = locked;
        self.set_tag_record(tag, Some(x));
        Ok(())
    }
}
