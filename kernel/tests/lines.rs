mod common;
use builder_kernel::*;
use common::*;

#[test]
fn single_line_makes_one_edge_and_no_face() {
    let mut d = Document::new();
    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(edge_count(&d, ROOT), 1);
    assert_eq!(vertex_count(&d, ROOT), 2);
    assert!(faces(&d, ROOT).is_empty());
    validate(&d);
}

#[test]
fn endpoints_weld_within_tolerance() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    d.add_line(ROOT, v(10.0004, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    assert_eq!(vertex_count(&d, ROOT), 3);
    assert_eq!(edge_count(&d, ROOT), 2);
    validate(&d);
}

#[test]
fn crossing_lines_split_each_other() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(0.0, 10.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2, "new line is cut at the crossing");
    assert_eq!(edge_count(&d, ROOT), 4);
    assert_eq!(vertex_count(&d, ROOT), 5);
    assert!(d.find_vertex(ROOT, v(5.0, 5.0, 0.0)).is_some());
    validate(&d);
}

#[test]
fn line_ending_on_an_edge_splits_it() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    d.add_line(ROOT, v(4.0, 0.0, 0.0), v(4.0, 6.0, 0.0)).unwrap();
    assert_eq!(edge_count(&d, ROOT), 3);
    assert_eq!(vertex_count(&d, ROOT), 4);
    validate(&d);
}

#[test]
fn skew_lines_in_3d_do_not_split() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    d.add_line(ROOT, v(0.0, 10.0, 1.0), v(10.0, 0.0, 1.0)).unwrap();
    assert_eq!(edge_count(&d, ROOT), 2);
    validate(&d);
}

#[test]
fn collinear_overlap_merges_into_shared_edges() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(5.0, 0.0, 0.0), v(15.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2, "overlap reuses 5..10 and adds 10..15");
    assert_eq!(edge_count(&d, ROOT), 3);
    validate(&d);
}

#[test]
fn line_inside_an_existing_edge_splits_it_twice() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(3.0, 0.0, 0.0), v(7.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(edge_count(&d, ROOT), 3);
    assert_eq!(vertex_count(&d, ROOT), 4);
    validate(&d);
}

#[test]
fn redrawing_an_edge_adds_nothing() {
    let mut d = Document::new();
    let a = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    let b = d.add_line(ROOT, v(10.0, 0.0, 0.0), v(0.0, 0.0, 0.0)).unwrap();
    assert_eq!(a, b);
    assert_eq!(edge_count(&d, ROOT), 1);
}

#[test]
fn zero_length_line_is_rejected() {
    let mut d = Document::new();
    assert!(d.add_line(ROOT, v(1.0, 1.0, 1.0), v(1.0, 1.0, 1.0005)).is_err());
    assert!(d.add_line(ROOT, v(f64::NAN, 0.0, 0.0), v(1.0, 0.0, 0.0)).is_err());
}

#[test]
fn line_through_a_vertex_is_cut_there() {
    let mut d = Document::new();
    d.add_line(ROOT, v(5.0, 0.0, 0.0), v(5.0, 5.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2);
    validate(&d);
}

#[test]
fn a_line_through_a_face_is_cut_where_it_pierces() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    let e = d.add_line(ROOT, v(5.0, 5.0, -5.0), v(5.0, 5.0, 5.0)).unwrap();
    assert_eq!(e.len(), 2, "split at the piercing point");
    assert_eq!(vertex_count(&d, ROOT), 7, "4 corners + 2 ends + 1 piercing vertex");
    let w = d.find_vertex(ROOT, v(5.0, 5.0, 0.0)).expect("piercing vertex");
    assert!(d.face(f).unwrap().plane.contains(d.pos(w)));
    assert_eq!(faces(&d, ROOT).len(), 1, "the piercing vertex alone does not split the face");
    assert_eq!(d.face(f).unwrap().outer.len(), 4);
    validate(&d);

    // A second piercing, then a line in the plane through both splits the face
    // and is cut at the piercing vertices.
    d.add_line(ROOT, v(2.0, 5.0, -5.0), v(2.0, 5.0, 5.0)).unwrap();
    assert_eq!(vertex_count(&d, ROOT), 10);
    let e = d.add_line(ROOT, v(0.0, 5.0, 0.0), v(10.0, 5.0, 0.0)).unwrap();
    assert_eq!(e.len(), 3);
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert_eq!(vertex_count(&d, ROOT), 12);
    validate(&d);
}

#[test]
fn an_endpoint_on_a_face_is_a_touch_not_a_piercing() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let e = d.add_line(ROOT, v(5.0, 5.0, 0.0), v(5.0, 5.0, 5.0)).unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(vertex_count(&d, ROOT), 6);
    // A line lying in the plane is not a piercing either; it splits the face.
    let e = d.add_line(ROOT, v(0.0, 5.0, 0.0), v(10.0, 5.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2, "cut at the touching line's foot");
    assert_eq!(faces(&d, ROOT).len(), 2);
    // A line through the plane outside the face does not touch it.
    let e = d.add_line(ROOT, v(20.0, 20.0, -5.0), v(20.0, 20.0, 5.0)).unwrap();
    assert_eq!(e.len(), 1);
    // A line through a hole does not touch the face around it.
    rect_xy(&mut d, ROOT, 6.0, 6.0, 8.0, 8.0, 0.0);
    let hole = face_at(&d, ROOT, v(7.0, 7.0, 0.0), -V3::Z);
    d.erase(&[hole], &[]).unwrap();
    let e = d.add_line(ROOT, v(7.0, 7.0, -5.0), v(7.0, 7.0, 5.0)).unwrap();
    assert_eq!(e.len(), 1);
    validate(&d);
}

#[test]
fn a_line_through_a_grouped_face_does_not_pierce_it() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    d.make_group(ROOT, &[f], &[], &[]).unwrap();
    let e = d.add_line(ROOT, v(5.0, 5.0, -5.0), v(5.0, 5.0, 5.0)).unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(vertex_count(&d, ROOT), 2);
    validate(&d);
}
