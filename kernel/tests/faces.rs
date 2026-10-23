mod common;
use builder_kernel::*;
use common::*;

#[test]
fn closing_a_loop_creates_a_face() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0))
        .unwrap();
    d.add_line(ROOT, v(10.0, 0.0, 0.0), v(10.0, 8.0, 0.0))
        .unwrap();
    d.add_line(ROOT, v(10.0, 8.0, 0.0), v(0.0, 8.0, 0.0))
        .unwrap();
    assert!(faces(&d, ROOT).is_empty(), "no face until the loop closes");
    d.add_line(ROOT, v(0.0, 8.0, 0.0), v(0.0, 0.0, 0.0))
        .unwrap();
    let f = only_face(&d, ROOT);
    assert!(approx(d.face_area(f), 80.0));
    validate(&d);
}

#[test]
fn ground_faces_face_down_and_raised_faces_face_up() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    assert!(d.face(f).unwrap().plane.normal.z < -0.99);
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 30.0);
    let f = only_face(&d, ROOT);
    assert!(d.face(f).unwrap().plane.normal.z > 0.99);
}

#[test]
fn tilted_triangle_gets_a_face() {
    let mut d = Document::new();
    poly(
        &mut d,
        ROOT,
        &[v(0.0, 0.0, 0.0), v(10.0, 0.0, 5.0), v(0.0, 10.0, 3.0)],
    );
    let f = only_face(&d, ROOT);
    let n = d.face(f).unwrap().plane.normal;
    assert!((n.len() - 1.0).abs() < 1e-9);
    validate(&d);
}

#[test]
fn non_planar_loop_gets_no_face() {
    let mut d = Document::new();
    poly(
        &mut d,
        ROOT,
        &[
            v(0.0, 0.0, 0.0),
            v(10.0, 0.0, 0.0),
            v(10.0, 10.0, 4.0),
            v(0.0, 10.0, 0.0),
        ],
    );
    assert!(faces(&d, ROOT).is_empty());
    validate(&d);
}

#[test]
fn rectangles_sharing_an_edge_make_two_faces() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    rect_xy(&mut d, ROOT, 10.0, 0.0, 20.0, 10.0, 0.0);
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert_eq!(edge_count(&d, ROOT), 7);
    assert!(approx(total_area(&d, ROOT), 200.0));
    validate(&d);
}

#[test]
fn line_across_a_face_splits_it() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.add_line(ROOT, v(4.0, 0.0, 0.0), v(4.0, 10.0, 0.0))
        .unwrap();
    let f = faces(&d, ROOT);
    assert_eq!(f.len(), 2);
    let mut areas: Vec<f64> = f.iter().map(|&x| d.face_area(x)).collect();
    areas.sort_by(f64::total_cmp);
    assert!(approx(areas[0], 40.0) && approx(areas[1], 60.0));
    for &x in &f {
        assert!(
            d.face(x).unwrap().plane.normal.z < -0.99,
            "split pieces keep the facing"
        );
    }
    validate(&d);
}

#[test]
fn diagonal_line_splits_into_triangles() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 10.0, 0.0))
        .unwrap();
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert!(approx(total_area(&d, ROOT), 100.0));
    validate(&d);
}

#[test]
fn splitting_keeps_material() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    let m = d.next_mat();
    d.set_material(
        m,
        Some(Material {
            name: "Oak".into(),
            color: [160, 120, 80],
            opacity: 1.0,
        }),
    );
    let mut face = d.face(f).cloned().unwrap();
    face.material = Some(m);
    d.set_face(f, Some(face));
    d.add_line(ROOT, v(5.0, 0.0, 0.0), v(5.0, 10.0, 0.0))
        .unwrap();
    for x in faces(&d, ROOT) {
        assert_eq!(d.face(x).unwrap().material, Some(m));
    }
}

#[test]
fn rectangle_inside_a_face_makes_a_hole() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 20.0, 20.0, 0.0);
    rect_xy(&mut d, ROOT, 5.0, 5.0, 10.0, 10.0, 0.0);
    let f = faces(&d, ROOT);
    assert_eq!(f.len(), 2);
    let outer = face_at(&d, ROOT, v(1.0, 1.0, 0.0), -V3::Z);
    let inner = face_at(&d, ROOT, v(7.0, 7.0, 0.0), -V3::Z);
    assert_eq!(d.face(outer).unwrap().holes.len(), 1);
    assert!(approx(d.face_area(outer), 375.0));
    assert!(approx(d.face_area(inner), 25.0));
    validate(&d);
}

#[test]
fn rectangle_around_a_face_holes_around_it() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 5.0, 5.0, 10.0, 10.0, 0.0);
    rect_xy(&mut d, ROOT, 0.0, 0.0, 20.0, 20.0, 0.0);
    assert_eq!(faces(&d, ROOT).len(), 2);
    let outer = face_at(&d, ROOT, v(1.0, 1.0, 0.0), -V3::Z);
    assert_eq!(d.face(outer).unwrap().holes.len(), 1);
    assert!(approx(total_area(&d, ROOT), 400.0));
    validate(&d);
}

#[test]
fn rectangle_touching_a_face_edge_splits_it() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 20.0, 20.0, 0.0);
    // A notch sharing part of the bottom edge.
    rect_xy(&mut d, ROOT, 5.0, 0.0, 10.0, 6.0, 0.0);
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert!(approx(total_area(&d, ROOT), 400.0));
    for f in faces(&d, ROOT) {
        assert!(d.face(f).unwrap().holes.is_empty());
    }
    validate(&d);
}

#[test]
fn dangling_line_on_a_face_does_not_split_it() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.add_line(ROOT, v(0.0, 5.0, 0.0), v(5.0, 5.0, 0.0))
        .unwrap();
    let f = only_face(&d, ROOT);
    assert!(approx(d.face_area(f), 100.0));
    d.add_line(ROOT, v(2.0, 2.0, 0.0), v(4.0, 3.0, 0.0))
        .unwrap();
    let f = only_face(&d, ROOT);
    assert!(approx(d.face_area(f), 100.0));
    validate(&d);
}

#[test]
fn completing_a_dangling_line_splits_the_face() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.add_line(ROOT, v(0.0, 5.0, 0.0), v(5.0, 5.0, 0.0))
        .unwrap();
    d.add_line(ROOT, v(5.0, 5.0, 0.0), v(10.0, 5.0, 0.0))
        .unwrap();
    assert_eq!(faces(&d, ROOT).len(), 2);
    validate(&d);
}

#[test]
fn redrawing_an_edge_restores_a_deleted_face() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    d.erase(&[f], &[]).unwrap();
    assert!(faces(&d, ROOT).is_empty());
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0))
        .unwrap();
    only_face(&d, ROOT);
    validate(&d);
}

#[test]
fn line_across_two_coplanar_faces_splits_both() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    rect_xy(&mut d, ROOT, 10.0, 0.0, 20.0, 10.0, 0.0);
    d.add_line(ROOT, v(0.0, 5.0, 0.0), v(20.0, 5.0, 0.0))
        .unwrap();
    assert_eq!(faces(&d, ROOT).len(), 4);
    assert!(approx(total_area(&d, ROOT), 200.0));
    validate(&d);
}

#[test]
fn line_on_a_box_side_splits_the_wall() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    // Vertical line on the front wall (y = 0).
    d.add_line(ROOT, v(5.0, 0.0, 0.0), v(5.0, 0.0, 10.0))
        .unwrap();
    assert_eq!(faces(&d, ROOT).len(), 7);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 1000.0));
    validate(&d);
}

#[test]
fn rectangle_on_a_tilted_face_splits_it() {
    let mut d = Document::new();
    // A 45° roof plane.
    let s = std::f64::consts::FRAC_1_SQRT_2;
    let p = |x: f64, t: f64| v(x, t * s, t * s);
    poly(
        &mut d,
        ROOT,
        &[p(0.0, 0.0), p(20.0, 0.0), p(20.0, 20.0), p(0.0, 20.0)],
    );
    only_face(&d, ROOT);
    poly(
        &mut d,
        ROOT,
        &[p(5.0, 5.0), p(10.0, 5.0), p(10.0, 10.0), p(5.0, 10.0)],
    );
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert!((total_area(&d, ROOT) - 400.0).abs() < 1e-6);
    validate(&d);
}

#[test]
fn erasing_the_dividing_edge_merges_coplanar_faces() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let e = d
        .add_line(ROOT, v(4.0, 0.0, 0.0), v(4.0, 10.0, 0.0))
        .unwrap();
    assert_eq!(faces(&d, ROOT).len(), 2);
    d.erase(&[], &e).unwrap();
    let f = only_face(&d, ROOT);
    assert!(approx(d.face_area(f), 100.0));
    assert_eq!(
        d.face(f).unwrap().outer.len(),
        4,
        "leftover vertices are dissolved"
    );
    assert_eq!(edge_count(&d, ROOT), 4);
    validate(&d);
}

#[test]
fn face_splitting_is_undone_exactly() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.commit();
    let before = d.to_json();
    d.begin("Line");
    d.add_line(ROOT, v(4.0, 0.0, 0.0), v(4.0, 10.0, 0.0))
        .unwrap();
    d.commit();
    assert_eq!(faces(&d, ROOT).len(), 2);
    d.undo();
    assert_eq!(d.to_json(), before);
    validate(&d);
    d.redo();
    assert_eq!(faces(&d, ROOT).len(), 2);
    validate(&d);
}
