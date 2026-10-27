//! The `.builder` file format, version 1. See docs/file-format.md.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::doc::*;
use crate::math::{Mat4, V3};
use crate::Error;

pub const FORMAT: &str = "builder";
pub const VERSION: u32 = 1;

#[derive(Serialize, Deserialize)]
struct File {
    format: String,
    version: u32,
    units: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    generator: Option<String>,
    definitions: Vec<FileDefinition>,
    #[serde(default)]
    instances: Vec<FileInstance>,
    #[serde(default)]
    materials: Vec<Material>,
    #[serde(default)]
    tags: Vec<Tag>,
}

#[derive(Serialize, Deserialize)]
struct FileDefinition {
    name: String,
    kind: DefKind,
    #[serde(default)]
    vertices: Vec<[f64; 3]>,
    #[serde(default)]
    edges: Vec<[u32; 2]>,
    #[serde(default)]
    faces: Vec<FileFace>,
}

#[derive(Serialize, Deserialize)]
struct FileFace {
    outer: Vec<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    holes: Vec<Vec<u32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    material: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    back_material: Option<u32>,
}

#[derive(Serialize, Deserialize)]
struct FileInstance {
    definition: u32,
    parent: u32,
    transform: Vec<f64>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    material: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tag: Option<u32>,
}

impl Document {
    /// Serialize to `.builder` JSON. Ids are compacted; the root definition is 0.
    pub fn to_json(&self) -> String {
        let mut def_ids: Vec<DefId> = vec![ROOT];
        def_ids.extend(self.definitions.iter().map(|(i, _)| DefId(i as u32)).filter(|&d| d != ROOT));
        let def_index: HashMap<DefId, u32> =
            def_ids.iter().enumerate().map(|(i, &d)| (d, i as u32)).collect();
        let mat_ids: Vec<MatId> = self.materials.iter().map(|(i, _)| MatId(i as u32)).collect();
        let mat_index: HashMap<MatId, u32> =
            mat_ids.iter().enumerate().map(|(i, &m)| (m, i as u32)).collect();
        let tag_ids: Vec<TagId> = self.tags.iter().map(|(i, _)| TagId(i as u32)).collect();
        let tag_index: HashMap<TagId, u32> =
            tag_ids.iter().enumerate().map(|(i, &t)| (t, i as u32)).collect();
        let mat = |m: Option<MatId>| m.and_then(|m| mat_index.get(&m).copied());

        let definitions = def_ids
            .iter()
            .map(|&d| {
                let def = self.definition(d).expect("listed definition exists");
                let mut vindex: HashMap<VId, u32> = HashMap::new();
                let mut vertices = Vec::new();
                for (id, v) in self.vertices_in(d) {
                    vindex.insert(id, vertices.len() as u32);
                    vertices.push([v.pos.x, v.pos.y, v.pos.z]);
                }
                let edges = self.edges_in(d).map(|(_, e)| [vindex[&e.v[0]], vindex[&e.v[1]]]).collect();
                let lp = |l: &Vec<VId>| l.iter().map(|v| vindex[v]).collect::<Vec<u32>>();
                let faces = self
                    .faces_in(d)
                    .map(|(_, f)| FileFace {
                        outer: lp(&f.outer),
                        holes: f.holes.iter().map(lp).collect(),
                        material: mat(f.material),
                        back_material: mat(f.back_material),
                    })
                    .collect();
                FileDefinition { name: def.name.clone(), kind: def.kind, vertices, edges, faces }
            })
            .collect();
        let instances = self
            .instances
            .iter()
            .filter(|(_, i)| def_index.contains_key(&i.definition) && def_index.contains_key(&i.parent))
            .map(|(_, i)| FileInstance {
                definition: def_index[&i.definition],
                parent: def_index[&i.parent],
                transform: i.transform.to_vec(),
                name: i.name.clone(),
                material: mat(i.material),
                tag: i.tag.and_then(|t| tag_index.get(&t).copied()),
            })
            .collect();
        let file = File {
            format: FORMAT.into(),
            version: VERSION,
            units: "inch".into(),
            generator: Some(format!("Builder {}", env!("CARGO_PKG_VERSION"))),
            definitions,
            instances,
            materials: mat_ids.iter().map(|&m| self.material(m).cloned().expect("listed")).collect(),
            tags: tag_ids.iter().map(|&t| self.tag(t).cloned().expect("listed")).collect(),
        };
        serde_json::to_string(&file).expect("document serializes")
    }

    /// Read a `.builder` JSON document. Topology is rebuilt and validated.
    pub fn from_json(text: &str) -> Result<Document, Error> {
        let file: File = serde_json::from_str(text).map_err(|e| Error::Format(e.to_string()))?;
        if file.format != FORMAT {
            return Err(Error::Format(format!("not a Builder file (format is {:?})", file.format)));
        }
        if file.version > VERSION {
            return Err(Error::Format(format!(
                "file version {} is newer than this app understands ({VERSION})",
                file.version
            )));
        }
        let scale = match file.units.as_str() {
            "inch" => 1.0,
            "mm" => 1.0 / 25.4,
            "m" => 1000.0 / 25.4,
            u => return Err(Error::Format(format!("unknown units {u:?}"))),
        };
        if file.definitions.is_empty() || file.definitions[0].kind != DefKind::Root {
            return Err(Error::Format("the first definition must be the root".into()));
        }
        let mut doc = Document::new();
        for m in &file.materials {
            let id = doc.next_mat();
            doc.set_material(id, Some(m.clone()));
        }
        for t in &file.tags {
            let id = TagId(doc.tags.len_slots() as u32);
            doc.set_tag(id, Some(t.clone()));
        }
        let nmat = file.materials.len() as u32;
        let check_mat = |m: Option<u32>| -> Result<Option<MatId>, Error> {
            match m {
                Some(i) if i >= nmat => Err(Error::Format(format!("material {i} does not exist"))),
                other => Ok(other.map(MatId)),
            }
        };
        for (di, fd) in file.definitions.iter().enumerate() {
            let def = DefId(di as u32);
            if di > 0 {
                if fd.kind == DefKind::Root {
                    return Err(Error::Format("only the first definition can be the root".into()));
                }
                doc.set_definition(def, Some(Definition { name: fd.name.clone(), kind: fd.kind }));
            }
            let mut verts = Vec::with_capacity(fd.vertices.len());
            for p in &fd.vertices {
                let p = V3::from(*p) * scale;
                if !p.is_finite() {
                    return Err(Error::Format("vertex is not a finite number".into()));
                }
                verts.push(doc.add_vertex(def, p));
            }
            let v = |i: u32| -> Result<VId, Error> {
                verts
                    .get(i as usize)
                    .copied()
                    .ok_or_else(|| Error::Format(format!("vertex {i} does not exist")))
            };
            for [a, b] in &fd.edges {
                doc.add_edge(v(*a)?, v(*b)?).map_err(|e| Error::Format(format!("bad edge: {e}")))?;
            }
            for ff in &fd.faces {
                let outer = ff.outer.iter().map(|&i| v(i)).collect::<Result<Vec<_>, _>>()?;
                let holes = ff
                    .holes
                    .iter()
                    .map(|h| h.iter().map(|&i| v(i)).collect::<Result<Vec<_>, _>>())
                    .collect::<Result<Vec<_>, _>>()?;
                let f = doc
                    .add_face(def, outer, holes, None)
                    .map_err(|e| Error::Format(format!("bad face: {e}")))?;
                let (m, bm) = (check_mat(ff.material)?, check_mat(ff.back_material)?);
                doc.with_face(f, |x| {
                    x.material = m;
                    x.back_material = bm;
                });
            }
            // Drop vertices no edge uses (the format has no loose points).
            for id in verts {
                if doc.vertex(id).is_some_and(|x| x.edges.is_empty()) {
                    doc.set_vertex(id, None);
                }
            }
        }
        let ndef = file.definitions.len() as u32;
        for fi in &file.instances {
            if fi.definition >= ndef || fi.parent >= ndef || fi.definition == 0 {
                return Err(Error::Format("instance refers to a missing definition".into()));
            }
        }
        if has_cycle(ndef as usize, file.instances.iter().map(|i| (i.parent as usize, i.definition as usize)))
        {
            return Err(Error::Format("a definition contains itself".into()));
        }
        for fi in &file.instances {
            let t: Mat4 = fi
                .transform
                .clone()
                .try_into()
                .map_err(|_| Error::Format("transform needs 16 numbers".into()))?;
            let mut t = t;
            for x in &mut t[12..15] {
                *x *= scale;
            }
            let id = doc.new_instance(DefId(fi.definition), DefId(fi.parent));
            let mut inst = doc.instance(id).cloned().expect("just created");
            inst.transform = t;
            inst.name = fi.name.clone();
            inst.material = check_mat(fi.material)?;
            inst.tag = fi.tag.filter(|&t| (t as usize) < file.tags.len()).map(TagId);
            doc.set_instance(id, Some(inst));
        }
        doc.clear_history();
        Ok(doc)
    }
}

/// True if the parent → child definition graph has a cycle.
fn has_cycle(n: usize, links: impl Iterator<Item = (usize, usize)>) -> bool {
    let mut children = vec![Vec::new(); n];
    for (p, c) in links {
        children[p].push(c);
    }
    // 0 = unvisited, 1 = on the current path, 2 = done.
    let mut state = vec![0u8; n];
    fn visit(d: usize, children: &[Vec<usize>], state: &mut [u8]) -> bool {
        match state[d] {
            1 => return true,
            2 => return false,
            _ => {}
        }
        state[d] = 1;
        if children[d].iter().any(|&c| visit(c, children, state)) {
            return true;
        }
        state[d] = 2;
        false
    }
    (0..n).any(|d| visit(d, &children, &mut state))
}
