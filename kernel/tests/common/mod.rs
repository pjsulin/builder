#![allow(dead_code)]

pub mod fuzz;

use builder_kernel::math::{signed_area2, to_2d};
use builder_kernel::*;
use std::collections::HashSet;

pub fn v(x: f64, y: f64, z: f64) -> V3 {
    V3::new(x, y, z)
}

/// Draw a closed polyline.
pub fn poly(doc: &mut Document, ctx: DefId, pts: &[V3]) {
    for i in 0..pts.len() {
        doc.add_line(ctx, pts[i], pts[(i + 1) % pts.len()]).expect("line");
    }
}

/// Axis-aligned rectangle on the plane z.
pub fn rect_xy(doc: &mut Document, ctx: DefId, x0: f64, y0: f64, x1: f64, y1: f64, z: f64) {
    poly(doc, ctx, &[v(x0, y0, z), v(x1, y0, z), v(x1, y1, z), v(x0, y1, z)]);
}

/// A w × d × h box with its base at the origin, made by pulling a rectangle up.
/// Ground faces point down, so pulling up is a negative distance along the normal.
pub fn make_box(doc: &mut Document, w: f64, d: f64, h: f64) {
    rect_xy(doc, ROOT, 0.0, 0.0, w, d, 0.0);
    let f = only_face(doc, ROOT);
    doc.push_pull(f, -h).expect("pull");
}

pub fn faces(doc: &Document, ctx: DefId) -> Vec<FId> {
    doc.faces_in(ctx).map(|(id, _)| id).collect()
}

pub fn only_face(doc: &Document, ctx: DefId) -> FId {
    let f = faces(doc, ctx);
    assert_eq!(f.len(), 1, "expected one face, got {}", f.len());
    f[0]
}

/// The face whose plane contains `p` with the given normal.
pub fn face_at(doc: &Document, ctx: DefId, p: V3, normal: V3) -> FId {
    let found: Vec<FId> = doc
        .faces_in(ctx)
        .filter(|(id, f)| {
            f.plane.normal.dot(normal) > 0.999 && f.plane.contains(p) && contains_point(doc, *id, p)
        })
        .map(|(id, _)| id)
        .collect();
    assert_eq!(found.len(), 1, "expected one face at {p:?} facing {normal:?}, found {}", found.len());
    found[0]
}

pub fn contains_point(doc: &Document, f: FId, p: V3) -> bool {
    let face = doc.face(f).unwrap();
    let (u, w) = face.plane.basis();
    let poly = |lp: &Vec<VId>| lp.iter().map(|&x| to_2d(doc.pos(x), u, w)).collect::<Vec<_>>();
    let q = to_2d(p, u, w);
    math::point_in_polygon(q, &poly(&face.outer))
        && !face.holes.iter().any(|h| math::point_in_polygon(q, &poly(h)))
}

pub fn edge_count(doc: &Document, ctx: DefId) -> usize {
    doc.edges_in(ctx).count()
}

pub fn vertex_count(doc: &Document, ctx: DefId) -> usize {
    doc.vertices_in(ctx).count()
}

pub fn total_area(doc: &Document, ctx: DefId) -> f64 {
    faces(doc, ctx).iter().map(|&f| doc.face_area(f)).sum()
}

pub fn approx(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-6
}

/// Every edge borders exactly two faces: a closed solid.
pub fn is_closed(doc: &Document, ctx: DefId) -> bool {
    doc.edges_in(ctx).all(|(_, e)| e.faces.len() == 2)
}

/// Signed volume by the divergence theorem. Positive when every face points out.
pub fn volume(doc: &Document, ctx: DefId) -> f64 {
    let mut vol = 0.0;
    for (_, f) in doc.faces_in(ctx) {
        let verts = f.flat_vertices();
        for t in f.tris.chunks(3) {
            let a = doc.pos(verts[t[0] as usize]);
            let b = doc.pos(verts[t[1] as usize]);
            let c = doc.pos(verts[t[2] as usize]);
            vol += a.dot(b.cross(c)) / 6.0;
        }
    }
    vol
}

/// Check every topology invariant the kernel promises.
pub fn validate(doc: &Document) {
    for (vi, vx) in doc.vertices.iter() {
        let vid = VId(vi as u32);
        assert!(!vx.edges.is_empty(), "vertex {vi} has no edges");
        let unique: HashSet<_> = vx.edges.iter().collect();
        assert_eq!(unique.len(), vx.edges.len(), "vertex {vi} lists an edge twice");
        for &e in &vx.edges {
            let ed = doc.edge(e).unwrap_or_else(|| panic!("vertex {vi} lists missing edge {e:?}"));
            assert!(ed.v.contains(&vid), "edge {e:?} does not use vertex {vi}");
            assert_eq!(ed.owner, vx.owner, "edge and vertex owners differ");
        }
    }
    let mut pairs = HashSet::new();
    for (ei, ed) in doc.edges.iter() {
        let eid = EId(ei as u32);
        assert_ne!(ed.v[0], ed.v[1], "edge {ei} is a loop");
        let key = if ed.v[0] < ed.v[1] { (ed.v[0], ed.v[1]) } else { (ed.v[1], ed.v[0]) };
        assert!(pairs.insert(key), "duplicate edge between {:?}", key);
        assert!(doc.pos(ed.v[0]).dist(doc.pos(ed.v[1])) > tol::LENGTH, "edge {ei} is too short");
        for &v in &ed.v {
            assert!(doc.vertex(v).unwrap().edges.contains(&eid), "vertex {v:?} does not list edge {ei}");
        }
        for &f in &ed.faces {
            let face = doc.face(f).unwrap_or_else(|| panic!("edge {ei} lists missing face {f:?}"));
            assert!(doc.face_edges(face).contains(&eid), "face {f:?} does not use edge {ei}");
        }
    }
    // Sticky geometry: no vertex lies inside an edge of the same context, so edges
    // never overlap or cross without sharing a vertex.
    for (ei, ed) in doc.edges.iter() {
        let (p, q) = (doc.pos(ed.v[0]), doc.pos(ed.v[1]));
        for (vi, vx) in doc.vertices.iter() {
            if vx.owner != ed.owner || ed.v.contains(&VId(vi as u32)) {
                continue;
            }
            let (d, _) = math::point_segment(vx.pos, p, q);
            let inside = vx.pos.dist(p) > tol::LENGTH && vx.pos.dist(q) > tol::LENGTH;
            assert!(!(d <= tol::LENGTH && inside), "vertex {vi} lies inside edge {ei} without splitting it");
        }
    }
    for (fi, face) in doc.faces.iter() {
        let fid = FId(fi as u32);
        let (u, w) = face.plane.basis();
        for (k, lp) in face.loops().enumerate() {
            assert!(lp.len() >= 3, "face {fi} has a short loop");
            let unique: HashSet<_> = lp.iter().collect();
            assert_eq!(unique.len(), lp.len(), "face {fi} loop repeats a vertex");
            for i in 0..lp.len() {
                let (a, b) = (lp[i], lp[(i + 1) % lp.len()]);
                let e = doc
                    .edge_between(a, b)
                    .unwrap_or_else(|| panic!("face {fi} loop has no edge {a:?}-{b:?}"));
                assert!(doc.edge(e).unwrap().faces.contains(&fid), "edge {e:?} does not list face {fi}");
                assert!(face.plane.contains(doc.pos(a)), "face {fi} is not planar");
                assert_eq!(doc.vertex(a).unwrap().owner, face.owner, "face and vertex owners differ");
            }
            let p: Vec<_> = lp.iter().map(|&x| to_2d(doc.pos(x), u, w)).collect();
            let area = signed_area2(&p);
            if k == 0 {
                assert!(area > 0.0, "face {fi} outer loop is not counter-clockwise");
            } else {
                assert!(area < 0.0, "face {fi} hole is not clockwise");
            }
        }
        let n = face.flat_vertices().len() as u32;
        assert!(
            !face.tris.is_empty() && face.tris.iter().all(|&i| i < n),
            "face {fi} has a bad triangulation"
        );
        let tri_area: f64 = face
            .tris
            .chunks(3)
            .map(|t| {
                let verts = face.flat_vertices();
                let q = |i: u32| to_2d(doc.pos(verts[i as usize]), u, w);
                signed_area2(&[q(t[0]), q(t[1]), q(t[2])]) / 2.0
            })
            .sum();
        assert!((tri_area - doc.face_area(fid)).abs() < 1e-6, "face {fi} triangulation area mismatch");
    }
}
