//! Flat buffers for rendering and picking. One set per definition, in that
//! definition's coordinates.

use crate::doc::*;

#[derive(Clone, Debug, Default)]
pub struct FaceBuffers {
    /// xyz per triangle corner.
    pub positions: Vec<f32>,
    /// Front normal per triangle corner.
    pub normals: Vec<f32>,
    /// Face id per triangle.
    pub face_ids: Vec<u32>,
}

#[derive(Clone, Debug, Default)]
pub struct EdgeBuffers {
    /// xyz for each end of each edge.
    pub positions: Vec<f32>,
    /// Edge id per edge.
    pub edge_ids: Vec<u32>,
}

impl Document {
    pub fn face_buffers(&self, def: DefId) -> FaceBuffers {
        let mut b = FaceBuffers::default();
        for (id, face) in self.faces_in(def) {
            let verts = face.flat_vertices();
            let n = face.plane.normal;
            for t in face.tris.chunks(3) {
                for &i in t {
                    let p = self.pos(verts[i as usize]);
                    b.positions.extend([p.x as f32, p.y as f32, p.z as f32]);
                    b.normals.extend([n.x as f32, n.y as f32, n.z as f32]);
                }
                b.face_ids.push(id.0);
            }
        }
        b
    }

    pub fn edge_buffers(&self, def: DefId) -> EdgeBuffers {
        let mut b = EdgeBuffers::default();
        for (id, e) in self.edges_in(def) {
            for v in e.v {
                let p = self.pos(v);
                b.positions.extend([p.x as f32, p.y as f32, p.z as f32]);
            }
            b.edge_ids.push(id.0);
        }
        b
    }
}
