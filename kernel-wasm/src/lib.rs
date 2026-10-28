//! WebAssembly bindings for the Builder kernel.
//!
//! The boundary is deliberately narrow: commands go in as ids and numbers, and
//! results come back as ids, flat typed arrays, or small JSON strings for rare
//! queries. Errors become JavaScript exceptions with a readable message.

use builder_kernel::math::{Mat4, V3};
use builder_kernel::*;
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

fn js(e: Error) -> JsError {
    JsError::new(&e.to_string())
}

fn ids<T>(v: &[u32], f: impl Fn(u32) -> T) -> Vec<T> {
    v.iter().map(|&x| f(x)).collect()
}

/// Triangles and edges of one definition, in its own coordinates.
#[wasm_bindgen]
pub struct Buffers {
    positions: Vec<f32>,
    normals: Vec<f32>,
    face_ids: Vec<u32>,
    edge_positions: Vec<f32>,
    edge_ids: Vec<u32>,
}

#[wasm_bindgen]
impl Buffers {
    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f32> {
        self.positions.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn normals(&self) -> Vec<f32> {
        self.normals.clone()
    }
    #[wasm_bindgen(getter, js_name = faceIds)]
    pub fn face_ids(&self) -> Vec<u32> {
        self.face_ids.clone()
    }
    #[wasm_bindgen(getter, js_name = edgePositions)]
    pub fn edge_positions(&self) -> Vec<f32> {
        self.edge_positions.clone()
    }
    #[wasm_bindgen(getter, js_name = edgeIds)]
    pub fn edge_ids(&self) -> Vec<u32> {
        self.edge_ids.clone()
    }
}

#[wasm_bindgen]
pub struct Kernel {
    doc: Document,
}

impl Default for Kernel {
    fn default() -> Self {
        Kernel::new()
    }
}

#[wasm_bindgen]
impl Kernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Kernel {
        Kernel { doc: Document::new() }
    }

    #[wasm_bindgen(js_name = fromJson)]
    pub fn from_json(text: &str) -> Result<Kernel, JsError> {
        Ok(Kernel { doc: Document::from_json(text).map_err(js)? })
    }

    #[wasm_bindgen(js_name = toJson)]
    pub fn to_json(&self) -> String {
        self.doc.to_json()
    }

    // ---- history ----

    pub fn begin(&mut self, name: &str) {
        self.doc.begin(name);
    }
    pub fn commit(&mut self) -> bool {
        self.doc.commit()
    }
    pub fn abort(&mut self) {
        self.doc.abort();
    }
    pub fn undo(&mut self) -> Option<String> {
        self.doc.undo()
    }
    pub fn redo(&mut self) -> Option<String> {
        self.doc.redo()
    }
    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        self.doc.can_undo()
    }
    #[wasm_bindgen(js_name = canRedo)]
    pub fn can_redo(&self) -> bool {
        self.doc.can_redo()
    }

    // ---- edits ----

    /// Draw a line in definition `ctx`. Returns the edge ids along it.
    #[wasm_bindgen(js_name = addLine)]
    #[allow(clippy::too_many_arguments)]
    pub fn add_line(
        &mut self,
        ctx: u32,
        ax: f64,
        ay: f64,
        az: f64,
        bx: f64,
        by: f64,
        bz: f64,
    ) -> Result<Vec<u32>, JsError> {
        let e = self.doc.add_line(DefId(ctx), V3::new(ax, ay, az), V3::new(bx, by, bz)).map_err(js)?;
        Ok(e.iter().map(|e| e.0).collect())
    }

    /// Push or pull a face along its normal. Returns the face at the new position, or
    /// -1 if the push cut an opening.
    #[wasm_bindgen(js_name = pushPull)]
    pub fn push_pull(&mut self, face: u32, distance: f64) -> Result<i32, JsError> {
        let r = self.doc.push_pull(FId(face), distance).map_err(js)?;
        Ok(r.face.map(|f| f.0 as i32).unwrap_or(-1))
    }

    #[wasm_bindgen(js_name = verticesOf)]
    pub fn vertices_of(&self, faces: Vec<u32>, edges: Vec<u32>) -> Vec<u32> {
        self.doc.vertices_of(&ids(&faces, FId), &ids(&edges, EId)).iter().map(|v| v.0).collect()
    }

    #[wasm_bindgen(js_name = moveVertices)]
    pub fn move_vertices(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError> {
        self.doc.move_vertices(&ids(&verts, VId), V3::new(dx, dy, dz)).map_err(js)
    }

    #[wasm_bindgen(js_name = moveAndIntegrate)]
    pub fn move_and_integrate(&mut self, verts: Vec<u32>, dx: f64, dy: f64, dz: f64) -> Result<(), JsError> {
        self.doc.move_and_integrate(&ids(&verts, VId), V3::new(dx, dy, dz)).map_err(js)
    }

    pub fn erase(&mut self, faces: Vec<u32>, edges: Vec<u32>, instances: Vec<u32>) -> Result<(), JsError> {
        for i in instances {
            if self.doc.instance(InstId(i)).is_some() {
                self.doc.erase_instance(InstId(i)).map_err(js)?;
            }
        }
        self.doc.erase(&ids(&faces, FId), &ids(&edges, EId)).map_err(js)
    }

    #[wasm_bindgen(js_name = makeGroup)]
    pub fn make_group(
        &mut self,
        ctx: u32,
        faces: Vec<u32>,
        edges: Vec<u32>,
        instances: Vec<u32>,
    ) -> Result<u32, JsError> {
        let g = self
            .doc
            .make_group(DefId(ctx), &ids(&faces, FId), &ids(&edges, EId), &ids(&instances, InstId))
            .map_err(js)?;
        Ok(g.0)
    }

    /// Explode an instance. Returns JSON `{ faces, edges, instances }` of what it left.
    pub fn explode(&mut self, inst: u32) -> Result<String, JsError> {
        let out = self.doc.explode(InstId(inst)).map_err(js)?;
        let list = |v: Vec<u32>| v.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",");
        Ok(format!(
            r#"{{"faces":[{}],"edges":[{}],"instances":[{}]}}"#,
            list(out.faces.iter().map(|x| x.0).collect()),
            list(out.edges.iter().map(|x| x.0).collect()),
            list(out.instances.iter().map(|x| x.0).collect()),
        ))
    }

    /// Copy loose geometry of `ctx` by (dx, dy, dz). Returns JSON `{ faces, edges }`
    /// of the copy as it is after welding.
    #[wasm_bindgen(js_name = copyGeometry)]
    #[allow(clippy::too_many_arguments)]
    pub fn copy_geometry(
        &mut self,
        ctx: u32,
        faces: Vec<u32>,
        edges: Vec<u32>,
        dx: f64,
        dy: f64,
        dz: f64,
    ) -> Result<String, JsError> {
        let out = self
            .doc
            .copy_geometry(DefId(ctx), &ids(&faces, FId), &ids(&edges, EId), V3::new(dx, dy, dz))
            .map_err(js)?;
        let list = |v: Vec<u32>| v.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",");
        Ok(format!(
            r#"{{"faces":[{}],"edges":[{}]}}"#,
            list(out.faces.iter().map(|x| x.0).collect()),
            list(out.edges.iter().map(|x| x.0).collect()),
        ))
    }

    /// Copy an instance as a new group placed (dx, dy, dz) away in its parent's
    /// coordinates. Returns the new instance id.
    #[wasm_bindgen(js_name = copyInstance)]
    pub fn copy_instance(&mut self, inst: u32, dx: f64, dy: f64, dz: f64) -> Result<u32, JsError> {
        Ok(self.doc.copy_instance(InstId(inst), V3::new(dx, dy, dz)).map_err(js)?.0)
    }

    /// Set an instance's column-major 4×4 transform.
    #[wasm_bindgen(js_name = setTransform)]
    pub fn set_transform(&mut self, inst: u32, m: Vec<f64>) -> Result<(), JsError> {
        let m: Mat4 = m.try_into().map_err(|_| JsError::new("a transform needs 16 numbers"))?;
        self.doc.set_transform(InstId(inst), m).map_err(js)
    }

    // ---- attributes, tags, materials ----

    /// Attributes of a definition, instance or face as a JSON object
    /// (`{"survey": {"kind": "wall"}}`). `kind` is "definition", "instance" or "face".
    pub fn attributes(&self, kind: &str, id: u32) -> Result<String, JsError> {
        let t = target(kind, id)?;
        let a =
            self.doc.attributes(t).ok_or_else(|| JsError::new(&format!("that {kind} no longer exists")))?;
        Ok(serde_json::to_string(a).expect("attributes are JSON"))
    }

    /// Set one attribute from its JSON value (`"wall"`, `4.5`, `true`); `"null"` deletes it.
    #[wasm_bindgen(js_name = setAttribute)]
    pub fn set_attribute(
        &mut self,
        kind: &str,
        id: u32,
        ns: &str,
        key: &str,
        value_json: &str,
    ) -> Result<(), JsError> {
        let v: Value = serde_json::from_str(value_json)
            .map_err(|e| JsError::new(&format!("bad attribute value: {e}")))?;
        let v = if v.is_null() { None } else { Some(v) };
        self.doc.set_attribute(target(kind, id)?, ns, key, v).map_err(js)
    }

    /// Every tag as JSON `[{id, name, visible, locked}]`.
    pub fn tags(&self) -> String {
        let list: Vec<Value> = self
            .doc
            .tags
            .iter()
            .map(|(i, t)| json!({"id": i as u32, "name": t.name, "visible": t.visible, "locked": t.locked}))
            .collect();
        Value::Array(list).to_string()
    }

    #[wasm_bindgen(js_name = newTag)]
    pub fn new_tag(&mut self, name: &str) -> u32 {
        self.doc.new_tag(name).0
    }

    /// Put an instance on a tag; -1 clears it.
    #[wasm_bindgen(js_name = setInstanceTag)]
    pub fn set_instance_tag(&mut self, inst: u32, tag: i32) -> Result<(), JsError> {
        let tag = if tag < 0 { None } else { Some(TagId(tag as u32)) };
        self.doc.set_tag(InstId(inst), tag).map_err(js)
    }

    #[wasm_bindgen(js_name = setTagFlags)]
    pub fn set_tag_flags(&mut self, tag: u32, visible: bool, locked: bool) -> Result<(), JsError> {
        self.doc.set_tag_flags(TagId(tag), visible, locked).map_err(js)
    }

    /// JSON `{name, tag, material, locked}` of an instance (`tag` and `material` null
    /// when unset; `locked` when it, or geometry around or inside it, is on a locked
    /// tag), or `null` if it no longer exists.
    #[wasm_bindgen(js_name = instanceProps)]
    pub fn instance_props(&self, inst: u32) -> String {
        let Some(i) = self.doc.instance(InstId(inst)) else { return "null".into() };
        let on_locked = i.tag.and_then(|t| self.doc.tag(t)).is_some_and(|t| t.locked);
        json!({
            "name": i.name,
            "tag": i.tag.map(|t| t.0),
            "material": i.material.map(|m| m.0),
            "locked": on_locked || self.doc.is_locked_def(i.definition) || self.doc.is_locked_def(i.parent),
        })
        .to_string()
    }

    /// Every material as JSON `[{id, name, color: [r, g, b], opacity}]`.
    pub fn materials(&self) -> String {
        let list: Vec<Value> = self
            .doc
            .materials
            .iter()
            .map(|(i, m)| json!({"id": i as u32, "name": m.name, "color": m.color, "opacity": m.opacity}))
            .collect();
        Value::Array(list).to_string()
    }

    /// Front material per triangle of `buffers(def)`, in the same order; -1 for none.
    #[wasm_bindgen(js_name = faceMaterials)]
    pub fn face_materials(&self, def: u32) -> Vec<i32> {
        let mut out = Vec::new();
        for (_, face) in self.doc.faces_in(DefId(def)) {
            let m = face.material.map(|m| m.0 as i32).unwrap_or(-1);
            out.extend(std::iter::repeat_n(m, face.tris.len() / 3));
        }
        out
    }

    #[wasm_bindgen(js_name = definitionName)]
    pub fn definition_name(&self, def: u32) -> String {
        self.doc.definition(DefId(def)).map(|d| d.name.clone()).unwrap_or_default()
    }

    /// True when the definition's geometry refuses edits (an instance of it, or of a
    /// definition it sits in, is on a locked tag).
    #[wasm_bindgen(js_name = isLockedDef)]
    pub fn is_locked_def(&self, def: u32) -> bool {
        self.doc.is_locked_def(DefId(def))
    }

    // ---- queries ----

    pub fn buffers(&self, def: u32) -> Buffers {
        let f = self.doc.face_buffers(DefId(def));
        let e = self.doc.edge_buffers(DefId(def));
        Buffers {
            positions: f.positions,
            normals: f.normals,
            face_ids: f.face_ids,
            edge_positions: e.positions,
            edge_ids: e.edge_ids,
        }
    }

    /// Ids of every live definition (0 is the model root).
    pub fn definitions(&self) -> Vec<u32> {
        self.doc.definitions.iter().map(|(i, _)| i as u32).collect()
    }

    /// Instances placed in `def`, flattened as `[id, definition, m0..m15]` per instance.
    pub fn instances(&self, def: u32) -> Vec<f64> {
        let mut out = Vec::new();
        for (id, inst) in self.doc.instances_in(DefId(def)) {
            out.push(id.0 as f64);
            out.push(inst.definition.0 as f64);
            out.extend_from_slice(&inst.transform);
        }
        out
    }

    /// `[definition, parent]` of an instance, or empty if it no longer exists.
    #[wasm_bindgen(js_name = instanceInfo)]
    pub fn instance_info(&self, inst: u32) -> Vec<u32> {
        self.doc.instance(InstId(inst)).map(|i| vec![i.definition.0, i.parent.0]).unwrap_or_default()
    }

    /// Transform from a definition's coordinates to world coordinates.
    #[wasm_bindgen(js_name = worldTransform)]
    pub fn world_transform(&self, def: u32) -> Vec<f64> {
        self.doc.world_transform(DefId(def)).to_vec()
    }

    /// `[nx, ny, nz, d, owner, area]` for a face, or empty if it no longer exists.
    #[wasm_bindgen(js_name = facePlane)]
    pub fn face_plane(&self, face: u32) -> Vec<f64> {
        match self.doc.face(FId(face)) {
            Some(f) => {
                let n = f.plane.normal;
                vec![n.x, n.y, n.z, f.plane.d, f.owner.0 as f64, self.doc.face_area(FId(face))]
            }
            None => Vec::new(),
        }
    }

    /// Edge ids bounding a face (outer loop and holes).
    #[wasm_bindgen(js_name = faceEdges)]
    pub fn face_edges(&self, face: u32) -> Vec<u32> {
        self.doc
            .face(FId(face))
            .map(|f| self.doc.face_edges(f).iter().map(|e| e.0).collect())
            .unwrap_or_default()
    }

    /// Outer loop of a face as flat xyz, for highlighting.
    #[wasm_bindgen(js_name = faceOuter)]
    pub fn face_outer(&self, face: u32) -> Vec<f64> {
        let Some(f) = self.doc.face(FId(face)) else { return Vec::new() };
        f.outer.iter().flat_map(|&v| <[f64; 3]>::from(self.doc.pos(v))).collect()
    }

    /// `[ax, ay, az, bx, by, bz, owner]` for an edge, or empty.
    #[wasm_bindgen(js_name = edgeInfo)]
    pub fn edge_info(&self, edge: u32) -> Vec<f64> {
        let Some(e) = self.doc.edge(EId(edge)) else { return Vec::new() };
        let (a, b) = (self.doc.pos(e.v[0]), self.doc.pos(e.v[1]));
        vec![a.x, a.y, a.z, b.x, b.y, b.z, e.owner.0 as f64]
    }

    /// Faces bordering an edge.
    #[wasm_bindgen(js_name = edgeFaces)]
    pub fn edge_faces(&self, edge: u32) -> Vec<u32> {
        self.doc.edge(EId(edge)).map(|e| e.faces.iter().map(|f| f.0).collect()).unwrap_or_default()
    }

    /// `[faces, edges, vertices, instances]` across the whole document.
    pub fn stats(&self) -> Vec<u32> {
        vec![
            self.doc.faces.count() as u32,
            self.doc.edges.count() as u32,
            self.doc.vertices.count() as u32,
            self.doc.instances.count() as u32,
        ]
    }
}

fn target(kind: &str, id: u32) -> Result<AttrTarget, JsError> {
    Ok(match kind {
        "definition" => AttrTarget::Definition(DefId(id)),
        "instance" => AttrTarget::Instance(InstId(id)),
        "face" => AttrTarget::Face(FId(id)),
        _ => return Err(JsError::new("kind must be definition, instance or face")),
    })
}
