//! Model check: problems a loaded document may carry that the editing operations
//! never create. `check` reads and reports; it never writes.

use crate::doc::*;
use crate::math::{bbox, bbox_overlap_3d, V3};
use crate::tol;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FindingKind {
    /// Two edges of one definition overlap along a length greater than `tol::LENGTH`.
    OverlappingEdges,
    /// A face has a vertex farther than `tol::PLANE` from its plane.
    NonPlanarFace,
    /// An edge borders no face.
    FacelessEdge,
    /// Two vertices of one definition are closer than `tol::LENGTH`.
    DuplicateVertices,
}

impl FindingKind {
    /// The snake_case name used in JSON and printed reports.
    pub fn name(self) -> &'static str {
        match self {
            FindingKind::OverlappingEdges => "overlapping_edges",
            FindingKind::NonPlanarFace => "non_planar_face",
            FindingKind::FacelessEdge => "faceless_edge",
            FindingKind::DuplicateVertices => "duplicate_vertices",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Finding {
    pub kind: FindingKind,
    pub owner: DefId,
    pub faces: Vec<FId>,
    pub edges: Vec<EId>,
    pub vertices: Vec<VId>,
    /// A point near the problem, in the owner definition's coordinates.
    pub position: V3,
}

impl std::fmt::Display for Finding {
    /// `non_planar_face in definition 0 at (0, 0, 10.5): faces 4`
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let p = self.position;
        write!(f, "{} in definition {} at ({}, {}, {}):", self.kind.name(), self.owner.0, p.x, p.y, p.z)?;
        let list = |ids: Vec<u32>| ids.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(", ");
        let mut parts = Vec::new();
        if !self.faces.is_empty() {
            parts.push(format!("faces {}", list(self.faces.iter().map(|x| x.0).collect())));
        }
        if !self.edges.is_empty() {
            parts.push(format!("edges {}", list(self.edges.iter().map(|x| x.0).collect())));
        }
        if !self.vertices.is_empty() {
            parts.push(format!("vertices {}", list(self.vertices.iter().map(|x| x.0).collect())));
        }
        write!(f, " {}", parts.join("; "))
    }
}

impl Finding {
    /// Serialize as JSON `{kind, owner, faces, edges, vertices, position: [x, y, z]}`
    /// (`kind` is the snake_case variant name).
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "kind": self.kind.name(),
            "owner": self.owner.0,
            "faces": self.faces.iter().map(|x| x.0).collect::<Vec<_>>(),
            "edges": self.edges.iter().map(|x| x.0).collect::<Vec<_>>(),
            "vertices": self.vertices.iter().map(|x| x.0).collect::<Vec<_>>(),
            "position": [self.position.x, self.position.y, self.position.z],
        })
    }
}

/// Report problems a loaded document may carry that the editing operations never
/// create. Never writes. An empty vector means clean. Findings come in the order
/// non-planar faces, faceless edges, overlapping edges, duplicate vertices, each by
/// ascending id.
pub fn check(doc: &Document) -> Vec<Finding> {
    let mut out = Vec::new();

    for (i, face) in doc.faces.iter() {
        let worst = face
            .loops()
            .flatten()
            .map(|&v| (face.plane.dist(doc.pos(v)).abs(), v))
            .max_by(|a, b| a.0.total_cmp(&b.0));
        if let Some((d, v)) = worst {
            if d > tol::PLANE {
                out.push(Finding {
                    kind: FindingKind::NonPlanarFace,
                    owner: face.owner,
                    faces: vec![FId(i as u32)],
                    edges: Vec::new(),
                    vertices: Vec::new(),
                    position: doc.pos(v),
                });
            }
        }
    }

    for (i, edge) in doc.edges.iter() {
        if edge.faces.is_empty() {
            out.push(Finding {
                kind: FindingKind::FacelessEdge,
                owner: edge.owner,
                faces: Vec::new(),
                edges: vec![EId(i as u32)],
                vertices: Vec::new(),
                position: doc.pos(edge.v[0]).lerp(doc.pos(edge.v[1]), 0.5),
            });
        }
    }

    // Edges sorted by the low x of their box, so each edge is only compared with
    // the ones whose box can still reach it.
    let mut edges: Vec<Span> = doc
        .edges
        .iter()
        .map(|(i, e)| {
            let (p, q) = (doc.pos(e.v[0]), doc.pos(e.v[1]));
            Span {
                id: EId(i as u32),
                owner: e.owner,
                p,
                q,
                bbox: bbox([p, q].into_iter()).expect("two points"),
            }
        })
        .collect();
    edges.sort_by(|a, b| a.bbox.0.x.total_cmp(&b.bbox.0.x).then(a.id.cmp(&b.id)));
    for i in 0..edges.len() {
        let a = &edges[i];
        for b in &edges[i + 1..] {
            if b.bbox.0.x > a.bbox.1.x + tol::LENGTH {
                break;
            }
            if b.owner != a.owner || !bbox_overlap_3d(a.bbox, b.bbox) {
                continue;
            }
            if let Some(mid) = overlap_midpoint(a.p, a.q, b.p, b.q) {
                let (lo, hi) = if a.id < b.id { (a.id, b.id) } else { (b.id, a.id) };
                let owner = a.owner;
                out.push(Finding {
                    kind: FindingKind::OverlappingEdges,
                    owner,
                    faces: Vec::new(),
                    edges: vec![lo, hi],
                    vertices: Vec::new(),
                    position: mid,
                });
            }
        }
    }

    let mut verts: Vec<(VId, DefId, V3)> =
        doc.vertices.iter().map(|(i, v)| (VId(i as u32), v.owner, v.pos)).collect();
    verts.sort_by(|a, b| a.2.x.total_cmp(&b.2.x).then(a.0.cmp(&b.0)));
    for i in 0..verts.len() {
        let (v1, owner, p) = verts[i];
        for &(v2, owner2, q) in &verts[i + 1..] {
            if q.x > p.x + tol::LENGTH {
                break;
            }
            if owner2 == owner && p.dist(q) <= tol::LENGTH {
                let (lo, hi) = if v1 < v2 { (v1, v2) } else { (v2, v1) };
                out.push(Finding {
                    kind: FindingKind::DuplicateVertices,
                    owner,
                    faces: Vec::new(),
                    edges: Vec::new(),
                    vertices: vec![lo, hi],
                    position: p,
                });
            }
        }
    }
    out
}

/// An edge's endpoints and box, for the overlap sweep.
struct Span {
    id: EId,
    owner: DefId,
    p: V3,
    q: V3,
    bbox: (V3, V3),
}

/// The midpoint of the stretch where segment `p`–`q` and segment `r`–`s` run along
/// each other for more than `tol::LENGTH`, or `None`.
fn overlap_midpoint(p: V3, q: V3, r: V3, s: V3) -> Option<V3> {
    let d = q - p;
    let len = d.len();
    let dir = d.unit()?;
    let off_line = |x: V3| (x - p - dir * (x - p).dot(dir)).len() > tol::LENGTH;
    if off_line(r) || off_line(s) {
        return None;
    }
    let (tr, ts) = ((r - p).dot(dir), (s - p).dot(dir));
    let (lo, hi) = (tr.min(ts).max(0.0), tr.max(ts).min(len));
    (hi - lo > tol::LENGTH).then(|| p + dir * ((lo + hi) / 2.0))
}
