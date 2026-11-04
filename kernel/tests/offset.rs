mod common;
use builder_kernel::*;
use common::*;

fn ground_rect(d: &mut Document) -> FId {
    rect_xy(d, ROOT, 0.0, 0.0, 120.0, 96.0, 0.0);
    only_face(d, ROOT)
}

/// Areas of the faces of ROOT facing `normal`, smallest first.
fn areas(d: &Document, normal: V3) -> Vec<f64> {
    let mut a: Vec<f64> = d
        .faces_in(ROOT)
        .filter(|(_, f)| f.plane.normal.dot(normal) > 0.999)
        .map(|(id, _)| d.face_area(id))
        .collect();
    a.sort_by(|x, y| x.total_cmp(y));
    a
}

#[test]
fn a_rectangle_offset_inward_splits_into_a_ring_and_an_inner_face() {
    let mut d = Document::new();
    let f = ground_rect(&mut d);
    d.commit();
    d.begin("Offset");
    let drawn = d.offset_face(f, -4.0).unwrap();
    assert!(d.commit());
    assert_eq!(drawn.len(), 4);
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert_eq!(edge_count(&d, ROOT), 8);
    assert_eq!(vertex_count(&d, ROOT), 8);
    let a = areas(&d, -V3::Z);
    assert!(approx(a[0], 120.0 * 96.0 - 112.0 * 88.0), "ring: {a:?}");
    assert!(approx(a[1], 112.0 * 88.0), "inner face: {a:?}");
    let inner = face_at(&d, ROOT, v(60.0, 48.0, 0.0), -V3::Z);
    assert!(d.face(inner).unwrap().holes.is_empty());
    let ring = face_at(&d, ROOT, v(2.0, 48.0, 0.0), -V3::Z);
    assert_eq!(d.face(ring).unwrap().holes.len(), 1);
    assert!(d.find_vertex(ROOT, v(4.0, 4.0, 0.0)).is_some());
    validate(&d);
    assert_eq!(d.undo(), Some("Offset".into()));
    assert_eq!(faces(&d, ROOT).len(), 1);
    assert_eq!(edge_count(&d, ROOT), 4);
    validate(&d);
}

#[test]
fn a_rectangle_offset_outward_gets_a_ring_around_it() {
    let mut d = Document::new();
    let f = ground_rect(&mut d);
    let drawn = d.offset_face(f, 3.0).unwrap();
    assert_eq!(drawn.len(), 4);
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert_eq!(edge_count(&d, ROOT), 8);
    let a = areas(&d, -V3::Z);
    assert!(approx(a[0], 126.0 * 102.0 - 120.0 * 96.0), "the ring: {a:?}");
    assert!(approx(a[1], 120.0 * 96.0), "the original: {a:?}");
    assert!(d.find_vertex(ROOT, v(-3.0, -3.0, 0.0)).is_some());
    assert!(d.find_vertex(ROOT, v(123.0, 99.0, 0.0)).is_some());
    assert!(d.face(f).is_some(), "the original face is untouched");
    validate(&d);
}

#[test]
fn a_face_with_a_hole_offsets_the_hole_with_it() {
    let mut d = Document::new();
    make_box(&mut d, 120.0, 96.0, 96.0);
    // A 30-inch window on the front wall (y = 0, facing -Y), then erased to a hole.
    poly(&mut d, ROOT, &[v(30.0, 0.0, 30.0), v(60.0, 0.0, 30.0), v(60.0, 0.0, 60.0), v(30.0, 0.0, 60.0)]);
    let window = face_at(&d, ROOT, v(45.0, 0.0, 45.0), -V3::Y);
    d.erase(&[window], &[]).unwrap();
    let wall = face_at(&d, ROOT, v(10.0, 0.0, 10.0), -V3::Y);
    assert_eq!(d.face(wall).unwrap().holes.len(), 1);
    let before = faces(&d, ROOT).len();
    let drawn = d.offset_face(wall, -4.0).unwrap();
    assert_eq!(drawn.len(), 8, "four edges inside the outline, four around the window");
    // The wall plane now holds three rings: outline to inner loop, inner loop to
    // the window's offset, and the window frame; each has one hole.
    let rings: Vec<FId> =
        d.faces_in(ROOT).filter(|(_, f)| f.plane.normal.dot(-V3::Y) > 0.999).map(|(id, _)| id).collect();
    assert_eq!(rings.len(), 3);
    assert_eq!(faces(&d, ROOT).len(), before + 2);
    for &r in &rings {
        assert_eq!(d.face(r).unwrap().holes.len(), 1, "face {r:?}");
    }
    let a = areas(&d, -V3::Y);
    assert!(approx(a[0], 38.0 * 38.0 - 30.0 * 30.0), "window frame: {a:?}");
    assert!(approx(a[1], 120.0 * 96.0 - 112.0 * 88.0), "outer ring: {a:?}");
    assert!(approx(a[2], 112.0 * 88.0 - 38.0 * 38.0), "between: {a:?}");
    assert!(d.find_vertex(ROOT, v(26.0, 0.0, 26.0)).is_some());
    assert!(d.find_vertex(ROOT, v(4.0, 0.0, 4.0)).is_some());
    validate(&d);
}

#[test]
fn an_offset_past_a_notch_is_refused_and_writes_nothing() {
    let mut d = Document::new();
    // An L, 20 x 20 missing its lower-left 10 x 10 corner: arms 10 wide.
    poly(
        &mut d,
        ROOT,
        &[
            v(10.0, 0.0, 0.0),
            v(20.0, 0.0, 0.0),
            v(20.0, 20.0, 0.0),
            v(0.0, 20.0, 0.0),
            v(0.0, 10.0, 0.0),
            v(10.0, 10.0, 0.0),
        ],
    );
    let f = only_face(&d, ROOT);
    d.commit();
    let before = d.to_json();
    d.begin("Offset");
    assert_eq!(d.offset_face(f, -6.0), Err(Error::SelfIntersecting));
    assert!(!d.commit(), "nothing was written");
    assert_eq!(d.to_json(), before);
    assert_eq!((faces(&d, ROOT).len(), edge_count(&d, ROOT), vertex_count(&d, ROOT)), (1, 6, 6));
    assert_eq!(Error::SelfIntersecting.to_string(), "that offset would cross itself");
    // Within the arms it works: the L becomes a ring and an inner L.
    d.offset_face(f, -2.0).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert!(d.offset_face(f, f64::NAN).is_err());
    assert!(d.offset_face(f, 0.0).is_err());
    validate(&d);
}

#[test]
fn a_chain_of_two_edges_offsets_to_two_edges_and_no_face() {
    let mut d = Document::new();
    let e1 = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap()[0];
    let e2 = d.add_line(ROOT, v(10.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap()[0];
    d.commit();
    d.begin("Offset");
    let drawn = d.offset_edges(ROOT, &[e1, e2], 2.0).unwrap();
    assert!(d.commit());
    assert_eq!(drawn.len(), 2);
    assert_eq!(edge_count(&d, ROOT), 4);
    assert_eq!(faces(&d, ROOT).len(), 0);
    // Positive is to the right of the chain's direction about its own plane, whose
    // normal comes from the chain's points closed into a loop: that puts the offset
    // outside the L's corner, with the corner mitred.
    assert!(d.find_vertex(ROOT, v(12.0, -2.0, 0.0)).is_some(), "the offset corner is mitred");
    assert!(d.find_vertex(ROOT, v(0.0, -2.0, 0.0)).is_some(), "the ends are offset square");
    validate(&d);
    assert_eq!(d.undo(), Some("Offset".into()));
    assert_eq!(edge_count(&d, ROOT), 2);
    // A negative distance goes to the other side.
    let other = d.offset_edges(ROOT, &[e1, e2], -2.0).unwrap();
    assert_eq!(other.len(), 2);
    assert!(d.find_vertex(ROOT, v(8.0, 2.0, 0.0)).is_some());
    assert!(d.find_vertex(ROOT, v(12.0, -2.0, 0.0)).is_none());
    validate(&d);
}

#[test]
fn a_chain_across_a_face_splits_it_again() {
    let mut d = Document::new();
    let f = ground_rect(&mut d);
    // A U from the bottom edge up, across and back down; its ends sit on the edge.
    let a = d.add_line(ROOT, v(30.0, 0.0, 0.0), v(30.0, 48.0, 0.0)).unwrap()[0];
    let b = d.add_line(ROOT, v(30.0, 48.0, 0.0), v(90.0, 48.0, 0.0)).unwrap()[0];
    let c = d.add_line(ROOT, v(90.0, 48.0, 0.0), v(90.0, 0.0, 0.0)).unwrap()[0];
    assert_eq!(faces(&d, ROOT).len(), 2);
    assert!(d.face(f).is_none() || faces(&d, ROOT).len() == 2);
    let drawn = d.offset_edges(ROOT, &[a, b, c], 2.0).unwrap();
    assert_eq!(drawn.len(), 3);
    assert_eq!(faces(&d, ROOT).len(), 3, "the inner U splits the face inside the first U");
    // The chain's own plane comes from its points; the ends stay on the bottom edge.
    let has = |x: f64, y: f64| d.find_vertex(ROOT, v(x, y, 0.0)).is_some();
    assert!((has(32.0, 0.0) && has(88.0, 46.0)) || (has(28.0, 0.0) && has(92.0, 50.0)));
    validate(&d);
}

#[test]
fn edges_that_are_not_one_chain_are_refused() {
    let mut d = Document::new();
    let e1 = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap()[0];
    let e2 = d.add_line(ROOT, v(20.0, 0.0, 0.0), v(30.0, 0.0, 0.0)).unwrap()[0];
    let e3 = d.add_line(ROOT, v(40.0, 0.0, 0.0), v(50.0, 10.0, 0.0)).unwrap()[0];
    assert_eq!(d.offset_edges(ROOT, &[e1, e2, e3], 2.0), Err(Error::Degenerate("edges are not one chain")));
    // A fork is not a chain either.
    let e4 = d.add_line(ROOT, v(10.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap()[0];
    let e5 = d.add_line(ROOT, v(10.0, 0.0, 0.0), v(10.0, -10.0, 0.0)).unwrap()[0];
    assert_eq!(d.offset_edges(ROOT, &[e1, e4, e5], 2.0), Err(Error::Degenerate("edges are not one chain")));
    // A single loose edge has no plane of its own and bounds no face.
    assert_eq!(d.offset_edges(ROOT, &[e3], 2.0), Err(Error::Degenerate("edges do not lie in one plane")));
    // A single edge of a face offsets in the face's plane.
    rect_xy(&mut d, ROOT, 100.0, 100.0, 110.0, 110.0, 0.0);
    let bottom = d.find_vertex(ROOT, v(100.0, 100.0, 0.0)).unwrap();
    let right = d.find_vertex(ROOT, v(110.0, 100.0, 0.0)).unwrap();
    let e = d.edge_between(bottom, right).unwrap();
    let faces_before = faces(&d, ROOT).len();
    let drawn = d.offset_edges(ROOT, &[e], 2.0).unwrap();
    assert_eq!(drawn.len(), 1);
    assert_eq!(faces(&d, ROOT).len(), faces_before + 1, "the parallel line splits the square");
    assert_eq!(d.offset_edges(ROOT, &[], 2.0), Err(Error::Empty));
    assert_eq!(d.offset_edges(ROOT, &[EId(999)], 2.0), Err(Error::Missing("edge")));
    validate(&d);
}

#[test]
fn a_locked_definition_is_not_offset() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e): (Vec<FId>, Vec<EId>) = (faces(&d, ROOT), d.edges_in(ROOT).map(|(id, _)| id).collect());
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    let tag = d.new_tag("Existing");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    d.commit();
    let before = d.to_json();
    let top = face_at(&d, def, v(5.0, 5.0, 10.0), V3::Z);
    let edges = d.face_edges(d.face(top).unwrap());
    d.begin("Offset");
    assert_eq!(d.offset_face(top, -2.0), Err(Error::Locked));
    assert_eq!(d.offset_edges(def, &edges[..2], 2.0), Err(Error::Locked));
    assert!(!d.commit());
    assert_eq!(d.to_json(), before);
}
