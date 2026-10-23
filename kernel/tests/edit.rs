mod common;
use builder_kernel::*;
use common::*;

#[test]
fn moving_the_top_face_of_a_box_stretches_it() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    let verts = d.vertices_of(&[top], &[]);
    d.move_vertices(&verts, v(3.0, 0.0, 2.0)).unwrap();
    assert!(approx(volume(&d, ROOT), 1200.0), "a sheared box keeps base × height");
    validate(&d);
}

#[test]
fn moving_one_corner_up_fails_because_faces_would_bend() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.commit();
    let before = d.to_json();
    let corner = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
    d.begin("Move");
    assert_eq!(d.move_vertices(&[corner], v(0.0, 0.0, 3.0)).unwrap_err(), Error::NotPlanar);
    d.abort();
    assert_eq!(d.to_json(), before);
}

#[test]
fn moving_a_loose_rectangle_moves_everything() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    let verts = d.vertices_of(&[f], &[]);
    d.move_vertices(&verts, v(50.0, 0.0, 0.0)).unwrap();
    assert!(d.find_vertex(ROOT, v(60.0, 10.0, 0.0)).is_some());
    assert!(d.find_vertex(ROOT, v(0.0, 0.0, 0.0)).is_none());
    validate(&d);
}

#[test]
fn erasing_a_box_edge_removes_its_two_faces() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let a = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
    let b = d.find_vertex(ROOT, v(0.0, 10.0, 10.0)).unwrap();
    let e = d.edge_between(a, b).unwrap();
    d.erase(&[], &[e]).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 4);
    assert_eq!(edge_count(&d, ROOT), 11);
    validate(&d);
}

#[test]
fn erasing_a_face_keeps_its_edges() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    d.erase(&[top], &[]).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 5);
    assert_eq!(edge_count(&d, ROOT), 12);
    validate(&d);
}

#[test]
fn erasing_a_lone_edge_removes_its_vertices() {
    let mut d = Document::new();
    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(5.0, 0.0, 0.0)).unwrap();
    d.erase(&[], &e).unwrap();
    assert_eq!(vertex_count(&d, ROOT), 0);
    validate(&d);
}

#[test]
fn erasing_the_line_that_split_a_box_side_heals_it() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let e = d.add_line(ROOT, v(5.0, 0.0, 0.0), v(5.0, 0.0, 10.0)).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 7);
    d.erase(&[], &e).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert_eq!(edge_count(&d, ROOT), 12);
    assert_eq!(vertex_count(&d, ROOT), 8);
    assert!(is_closed(&d, ROOT));
    validate(&d);
}
