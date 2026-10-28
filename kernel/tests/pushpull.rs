mod common;
use builder_kernel::*;
use common::*;

#[test]
fn pulling_a_free_rectangle_makes_a_closed_box() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 8.0, 6.0);
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert_eq!(edge_count(&d, ROOT), 12);
    assert_eq!(vertex_count(&d, ROOT), 8);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 480.0), "all faces point out");
    validate(&d);
}

#[test]
fn pushing_a_free_rectangle_down_also_points_out() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    d.push_pull(f, 5.0).unwrap(); // along the downward normal
    assert!(approx(volume(&d, ROOT), 500.0));
    let bottom = face_at(&d, ROOT, v(5.0, 5.0, -5.0), -V3::Z);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 0.0), V3::Z);
    assert_ne!(bottom, top);
    validate(&d);
}

#[test]
fn pulling_the_top_of_a_box_stretches_it() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    let r = d.push_pull(top, 4.0).unwrap();
    assert_eq!(r.mode, PushPullMode::Stretch);
    assert_eq!(r.face, Some(top));
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert!(approx(volume(&d, ROOT), 1400.0));
    validate(&d);
}

#[test]
fn pushing_a_box_flat_fails_cleanly() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.commit();
    let before = d.to_json();
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    d.begin("Push/Pull");
    assert_eq!(d.push_pull(top, -10.0).unwrap_err(), Error::Collapsed);
    d.abort();
    assert_eq!(d.to_json(), before);
}

#[test]
fn pulling_a_side_face_stretches_horizontally() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let side = face_at(&d, ROOT, v(10.0, 5.0, 5.0), V3::X);
    d.push_pull(side, 5.0).unwrap();
    assert!(approx(volume(&d, ROOT), 1500.0));
    assert!(d.find_vertex(ROOT, v(15.0, 10.0, 10.0)).is_some());
    validate(&d);
}

#[test]
fn pulling_a_rectangle_drawn_on_top_adds_a_block() {
    let mut d = Document::new();
    make_box(&mut d, 20.0, 20.0, 10.0);
    rect_xy(&mut d, ROOT, 5.0, 5.0, 10.0, 10.0, 10.0);
    assert_eq!(faces(&d, ROOT).len(), 7);
    let inner = face_at(&d, ROOT, v(7.0, 7.0, 10.0), V3::Z);
    let r = d.push_pull(inner, 3.0).unwrap();
    assert_eq!(r.mode, PushPullMode::Extrude);
    assert_eq!(faces(&d, ROOT).len(), 11);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 4000.0 + 75.0));
    validate(&d);
}

#[test]
fn pushing_a_rectangle_into_a_box_makes_a_pocket() {
    let mut d = Document::new();
    make_box(&mut d, 20.0, 20.0, 10.0);
    rect_xy(&mut d, ROOT, 5.0, 5.0, 10.0, 10.0, 10.0);
    let inner = face_at(&d, ROOT, v(7.0, 7.0, 10.0), V3::Z);
    d.push_pull(inner, -4.0).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 11);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 4000.0 - 100.0), "pocket walls face into the pocket");
    face_at(&d, ROOT, v(7.0, 7.0, 6.0), V3::Z);
    validate(&d);
}

#[test]
fn pushing_a_door_through_a_wall_leaves_an_opening() {
    let mut d = Document::new();
    // A wall 6" thick: x 0..40, y 0..6, z 0..30.
    make_box(&mut d, 40.0, 6.0, 30.0);
    // Door outline on the front face (y = 0), touching the bottom edge.
    poly(&mut d, ROOT, &[v(10.0, 0.0, 0.0), v(20.0, 0.0, 0.0), v(20.0, 0.0, 20.0), v(10.0, 0.0, 20.0)]);
    let door = face_at(&d, ROOT, v(15.0, 0.0, 10.0), -V3::Y);
    let r = d.push_pull(door, -6.0).unwrap();
    assert_eq!(r.mode, PushPullMode::Through);
    assert!(r.face.is_none());
    assert!(is_closed(&d, ROOT), "every edge still has two faces");
    assert!(approx(volume(&d, ROOT), 40.0 * 6.0 * 30.0 - 10.0 * 6.0 * 20.0));
    // No face covers the opening on either side.
    assert!(!d
        .faces_in(ROOT)
        .any(|(id, f)| f.plane.contains(v(15.0, 0.0, 10.0)) && contains_point(&d, id, v(15.0, 0.0, 10.0))));
    assert!(!d
        .faces_in(ROOT)
        .any(|(id, f)| f.plane.contains(v(15.0, 6.0, 10.0)) && contains_point(&d, id, v(15.0, 6.0, 10.0))));
    validate(&d);
}

#[test]
fn window_through_a_wall_leaves_a_hole() {
    let mut d = Document::new();
    make_box(&mut d, 40.0, 6.0, 30.0);
    poly(&mut d, ROOT, &[v(10.0, 0.0, 10.0), v(20.0, 0.0, 10.0), v(20.0, 0.0, 20.0), v(10.0, 0.0, 20.0)]);
    let win = face_at(&d, ROOT, v(15.0, 0.0, 15.0), -V3::Y);
    let r = d.push_pull(win, -6.0).unwrap();
    assert_eq!(r.mode, PushPullMode::Through);
    assert!(is_closed(&d, ROOT));
    let back = face_at(&d, ROOT, v(5.0, 6.0, 5.0), V3::Y);
    assert_eq!(d.face(back).unwrap().holes.len(), 1);
    assert!(approx(volume(&d, ROOT), 40.0 * 6.0 * 30.0 - 600.0));
    validate(&d);
}

#[test]
fn push_pull_works_on_a_tilted_face() {
    let mut d = Document::new();
    let s = std::f64::consts::FRAC_1_SQRT_2;
    let p = |x: f64, t: f64| v(x, t * s, 10.0 + t * s);
    poly(&mut d, ROOT, &[p(0.0, 0.0), p(20.0, 0.0), p(20.0, 10.0), p(0.0, 10.0)]);
    let f = only_face(&d, ROOT);
    let n = d.face(f).unwrap().plane.normal;
    d.push_pull(f, 3.0).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 600.0));
    // The cap sits 3" along the original normal.
    assert!(d.find_vertex(ROOT, p(0.0, 0.0) + n * 3.0).is_some());
    validate(&d);
}

#[test]
fn stretching_a_tilted_box_face() {
    let mut d = Document::new();
    let s = std::f64::consts::FRAC_1_SQRT_2;
    let p = |x: f64, t: f64| v(x, t * s, t * s);
    poly(&mut d, ROOT, &[p(0.0, 0.0), p(20.0, 0.0), p(20.0, 10.0), p(0.0, 10.0)]);
    let f = only_face(&d, ROOT);
    let n = d.face(f).unwrap().plane.normal;
    let r = d.push_pull(f, 5.0).unwrap();
    let cap = r.face.unwrap();
    let r2 = d.push_pull(cap, 5.0).unwrap();
    assert_eq!(r2.mode, PushPullMode::Stretch);
    assert!(approx(volume(&d, ROOT), 2000.0));
    assert!(d.find_vertex(ROOT, p(0.0, 0.0) + n * 10.0).is_some());
    validate(&d);
}

#[test]
fn face_with_a_hole_extrudes_into_a_tube() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 20.0, 20.0, 0.0);
    rect_xy(&mut d, ROOT, 5.0, 5.0, 15.0, 15.0, 0.0);
    let inner = face_at(&d, ROOT, v(10.0, 10.0, 0.0), -V3::Z);
    d.erase(&[inner], &[]).unwrap();
    let ring = only_face(&d, ROOT);
    d.push_pull(ring, -10.0).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 10);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 3000.0));
    validate(&d);
}

#[test]
fn live_preview_by_abort_leaves_no_trace() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.commit();
    let before = d.to_json();
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    for i in 1..20 {
        d.begin("Push/Pull");
        d.push_pull(top, i as f64).unwrap();
        d.abort();
    }
    assert_eq!(d.to_json(), before);
    d.begin("Push/Pull");
    d.push_pull(top, 2.0).unwrap();
    d.commit();
    d.undo();
    assert_eq!(d.to_json(), before);
}

#[test]
fn pulling_flush_with_a_side_merges_the_walls() {
    let mut d = Document::new();
    make_box(&mut d, 20.0, 20.0, 10.0);
    // A rectangle on top touching the x = 0 edge.
    rect_xy(&mut d, ROOT, 0.0, 5.0, 5.0, 10.0, 10.0);
    let inner = face_at(&d, ROOT, v(2.0, 7.0, 10.0), V3::Z);
    let r = d.push_pull(inner, 5.0).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 10, "the new wall merged into the box side");
    let side = face_at(&d, ROOT, v(0.0, 7.0, 12.0), -V3::X);
    assert!(contains_point(&d, side, v(0.0, 1.0, 1.0)));
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 4000.0 + 125.0));
    assert!(r.face.is_some());
    validate(&d);
}

#[test]
fn pushing_a_door_on_a_thick_wall_twice_keeps_valid_topology() {
    let mut d = Document::new();
    make_box(&mut d, 40.0, 12.0, 30.0);
    poly(&mut d, ROOT, &[v(10.0, 0.0, 0.0), v(20.0, 0.0, 0.0), v(20.0, 0.0, 20.0), v(10.0, 0.0, 20.0)]);
    let door = face_at(&d, ROOT, v(15.0, 0.0, 10.0), -V3::Y);
    let r = d.push_pull(door, -4.0).unwrap();
    assert_eq!(r.mode, PushPullMode::Extrude);
    validate(&d);
    let r = d.push_pull(r.face.unwrap(), -8.0).unwrap();
    assert_eq!(r.mode, PushPullMode::Through);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 40.0 * 12.0 * 30.0 - 10.0 * 12.0 * 20.0));
    validate(&d);
}

#[test]
fn a_box_pulled_through_a_loose_face_settles_with_piercing_vertices() {
    let mut d = Document::new();
    // A loose horizontal face at z = 5, then a box pulled up through it.
    rect_xy(&mut d, ROOT, -5.0, -5.0, 15.0, 15.0, 5.0);
    let shelf = only_face(&d, ROOT);
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let ground = face_at(&d, ROOT, v(5.0, 5.0, 0.0), -V3::Z);
    d.push_pull(ground, -10.0).unwrap();
    validate(&d);
    assert_eq!(faces(&d, ROOT).len(), 7);
    // The four vertical edges pierce the shelf: a vertex on its plane at each corner.
    for (x, y) in [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)] {
        let w = d.find_vertex(ROOT, v(x, y, 5.0)).expect("piercing vertex");
        assert_eq!(d.vertex(w).unwrap().edges.len(), 2);
    }
    assert_eq!(edge_count(&d, ROOT), 20, "each vertical edge is in two pieces");
    assert_eq!(d.face(shelf).unwrap().outer.len(), 4, "the shelf is not split by vertices alone");
    // The pierced box still stretches, carrying the shelf's piercing vertices along
    // its vertical edges.
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    d.push_pull(top, 4.0).unwrap();
    validate(&d);
    assert_eq!(faces(&d, ROOT).len(), 7);
    assert_eq!(edge_count(&d, ROOT), 20);
    // Intersecting the box with the shelf cuts the shelf around the box and the
    // walls along the shelf, after which the shelf inside the box can be erased.
    let walls = faces(&d, ROOT);
    let edges = d.intersect_faces(ROOT, &walls, &[], IntersectWith::Model).unwrap();
    assert_eq!(edges.len(), 4);
    validate(&d);
    let inner = face_at(&d, ROOT, v(5.0, 5.0, 5.0), V3::Z);
    d.erase(&[inner], &[]).unwrap();
    validate(&d);
    let outer = face_at(&d, ROOT, v(-2.0, -2.0, 5.0), V3::Z);
    assert_eq!(d.face(outer).unwrap().holes.len(), 1);
}
