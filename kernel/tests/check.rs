mod common;
use builder_kernel::check::{check, Finding, FindingKind};
use builder_kernel::*;
use common::*;

/// A box with a problem of every kind the reader accepts: an edge drawn along the
/// bottom front edge without sharing its vertices (overlapping, and faceless), and
/// a vertex a hair from a corner joined by a faceless edge (duplicate vertices).
/// Raw setters, as a file from another tool could carry.
fn bad_box(d: &mut Document) -> (EId, EId, VId, VId) {
    make_box(d, 10.0, 10.0, 10.0);
    d.commit();
    let a = d.add_vertex(ROOT, v(2.0, 0.0, 0.0));
    let b = d.add_vertex(ROOT, v(8.0, 0.0, 0.0));
    let along = d.add_edge(a, b).unwrap();
    let corner = d.find_vertex(ROOT, v(10.0, 10.0, 0.0)).unwrap();
    let twin = d.add_vertex(ROOT, v(10.0, 10.0, 0.0004));
    let far = d.add_vertex(ROOT, v(10.0, 10.0, -5.0));
    let stray = d.add_edge(twin, far).unwrap();
    (along, stray, corner, twin)
}

fn kinds(findings: &[Finding]) -> Vec<FindingKind> {
    findings.iter().map(|f| f.kind).collect()
}

#[test]
fn a_clean_box_has_no_findings() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    assert_eq!(check(&d), Vec::new());
    // A line across the top splits it; the kernel's own output stays clean.
    d.add_line(ROOT, v(0.0, 5.0, 10.0), v(10.0, 5.0, 10.0)).unwrap();
    assert_eq!(check(&d), Vec::new());
    assert_eq!(check(&Document::new()), Vec::new());
}

#[test]
fn problems_are_reported_with_their_ids_and_positions() {
    let mut d = Document::new();
    let (along, stray, corner, twin) = bad_box(&mut d);
    let bottom_front = d
        .edge_between(
            d.find_vertex(ROOT, v(0.0, 0.0, 0.0)).unwrap(),
            d.find_vertex(ROOT, v(10.0, 0.0, 0.0)).unwrap(),
        )
        .unwrap();
    let findings = check(&d);
    assert_eq!(
        kinds(&findings),
        vec![
            FindingKind::FacelessEdge,
            FindingKind::FacelessEdge,
            FindingKind::OverlappingEdges,
            FindingKind::DuplicateVertices
        ]
    );
    assert_eq!(findings[0].edges, vec![along]);
    assert_eq!(findings[1].edges, vec![stray]);
    let overlap = &findings[2];
    assert_eq!(overlap.edges, vec![bottom_front, along]);
    assert_eq!(overlap.owner, ROOT);
    assert!(overlap.position.dist(v(5.0, 0.0, 0.0)) < 1e-9);
    let dup = &findings[3];
    assert_eq!(dup.vertices, vec![corner, twin]);
    assert_eq!(dup.position, v(10.0, 10.0, 0.0));
    assert_eq!(
        overlap.to_string(),
        format!("overlapping_edges in definition 0 at (5, 0, 0): edges {}, {}", bottom_front.0, along.0)
    );
    assert_eq!(
        overlap.to_json(),
        serde_json::json!({
            "kind": "overlapping_edges", "owner": 0, "faces": [], "edges": [bottom_front.0, along.0],
            "vertices": [], "position": [5.0, 0.0, 0.0]
        })
    );
}

#[test]
fn a_face_bent_in_memory_is_non_planar() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    // Push one vertex off the plane through the raw setter: nothing the editing
    // operations do, but a kernel bug could.
    let v0 = d.face(top).unwrap().outer[0];
    let mut vx = d.vertex(v0).cloned().unwrap();
    vx.pos.z += 0.5;
    d.set_vertex(v0, Some(vx));
    let findings = check(&d);
    // The walls using the vertex contain the z direction, so they stay planar.
    assert_eq!(findings.len(), 1);
    let on_top = &findings[0];
    assert_eq!(on_top.kind, FindingKind::NonPlanarFace);
    assert_eq!(on_top.faces, vec![top]);
    assert_eq!(on_top.position, d.pos(v0));
    assert_eq!(
        on_top.to_string(),
        format!("non_planar_face in definition 0 at (0, 0, 10.5): faces {}", top.0)
    );
    // The reader refuses such a face, so a file never carries one (docs/file-format.md).
    assert!(matches!(Document::from_json(&d.to_json()), Err(Error::Format(_))));
}

#[test]
fn the_fixtures_load_and_report_as_built() {
    let mut d = Document::new();
    bad_box(&mut d);
    let bad = include_str!("fixtures/bad.builder");
    assert_eq!(d.to_json(), bad, "regenerate kernel/tests/fixtures/bad.builder from bad_box");
    let loaded = Document::from_json(bad).unwrap();
    assert_eq!(check(&loaded), check(&d));
    assert_eq!(
        kinds(&check(&loaded)),
        vec![
            FindingKind::FacelessEdge,
            FindingKind::FacelessEdge,
            FindingKind::OverlappingEdges,
            FindingKind::DuplicateVertices
        ]
    );

    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let clean = include_str!("fixtures/clean.builder");
    assert_eq!(d.to_json(), clean, "regenerate kernel/tests/fixtures/clean.builder from make_box");
    assert_eq!(check(&Document::from_json(clean).unwrap()), Vec::new());
}

#[test]
fn findings_are_per_definition() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let all = faces(&d, ROOT);
    let g = d.make_group(ROOT, &all, &[], &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    // A root vertex at a group corner is not a duplicate: different definitions.
    let a = d.add_vertex(ROOT, v(10.0, 10.0, 0.0));
    let b = d.add_vertex(ROOT, v(10.0, 10.0, 5.0));
    let e = d.add_edge(a, b).unwrap();
    let findings = check(&d);
    assert_eq!(kinds(&findings), vec![FindingKind::FacelessEdge]);
    assert_eq!(findings[0].edges, vec![e]);
    assert_eq!(findings[0].owner, ROOT);
    assert!(def != ROOT);
    validate(&d);
}
