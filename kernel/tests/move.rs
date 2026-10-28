mod common;
use builder_kernel::math::mat_translation;
use builder_kernel::*;
use common::*;

/// A 120 × 96 × 96 box with a ridge line across its top.
fn shed(d: &mut Document) -> Vec<EId> {
    make_box(d, 120.0, 96.0, 96.0);
    d.add_line(ROOT, v(0.0, 48.0, 96.0), v(120.0, 48.0, 96.0)).unwrap()
}

/// Two 10-inch boxes with a 10-inch gap between them along x.
fn two_boxes(d: &mut Document) {
    make_box(d, 10.0, 10.0, 10.0);
    rect_xy(d, ROOT, 20.0, 0.0, 30.0, 10.0, 0.0);
    let f = face_at(d, ROOT, v(25.0, 5.0, 0.0), -V3::Z);
    d.push_pull(f, -10.0).unwrap();
}

fn all_faces_and_edges(d: &Document, ctx: DefId) -> (Vec<FId>, Vec<EId>) {
    (faces(d, ctx), d.edges_in(ctx).map(|(id, _)| id).collect())
}

#[test]
fn ridge_lifted_and_nudged_stays_closed() {
    let mut d = Document::new();
    let ridge = shed(&mut d);
    let verts = d.vertices_of(&[], &ridge);
    d.move_and_integrate(&verts, v(0.0, 0.0, 36.0)).unwrap();
    d.move_and_integrate(&verts, v(0.0, 10.0, 0.0)).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 7, "four walls, a floor and two roof planes");
    assert!(d.find_vertex(ROOT, v(0.0, 58.0, 132.0)).is_some());
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 120.0 * 96.0 * 96.0 + 120.0 * 96.0 * 36.0 / 2.0));
    validate(&d);
}

#[test]
fn box_face_moved_onto_box_face_joins_them() {
    let mut d = Document::new();
    two_boxes(&mut d);
    assert_eq!(faces(&d, ROOT).len(), 12);
    let second: Vec<VId> = d.vertices_in(ROOT).filter(|(_, x)| x.pos.x > 15.0).map(|(id, _)| id).collect();
    assert_eq!(second.len(), 8);
    d.move_and_integrate(&second, v(-10.0, 0.0, 0.0)).unwrap();
    // The two facing sides cancel and the coplanar sides merge: one 20-inch box.
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert_eq!(edge_count(&d, ROOT), 12);
    assert_eq!(vertex_count(&d, ROOT), 8);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 2000.0));
    assert!(d.face_containing(ROOT, v(10.0, 5.0, 5.0), V3::X).is_none(), "no internal face");
    validate(&d);
}

#[test]
fn instance_moved_onto_loose_geometry_never_sticks() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    rect_xy(&mut d, ROOT, 20.0, 0.0, 30.0, 10.0, 0.0);
    let (faces_before, edges_before) = all_faces_and_edges(&d, ROOT);
    d.set_transform(g, mat_translation(v(20.0, 0.0, 0.0))).unwrap();
    assert_eq!(all_faces_and_edges(&d, ROOT), (faces_before, edges_before));
    let def = d.instance(g).unwrap().definition;
    assert_eq!(faces(&d, def).len(), 6);
    validate(&d);
}

#[test]
fn undo_after_each_integrated_move_restores_the_file() {
    let mut d = Document::new();
    let ridge = shed(&mut d);
    d.commit();
    let before = d.to_json();
    let verts = d.vertices_of(&[], &ridge);
    d.begin("Move");
    d.move_and_integrate(&verts, v(0.0, 0.0, 36.0)).unwrap();
    assert!(d.commit());
    assert_eq!(d.undo(), Some("Move".to_string()));
    assert_eq!(d.to_json(), before);

    let mut d = Document::new();
    two_boxes(&mut d);
    d.commit();
    let before = d.to_json();
    let second: Vec<VId> = d.vertices_in(ROOT).filter(|(_, x)| x.pos.x > 15.0).map(|(id, _)| id).collect();
    d.begin("Move");
    d.move_and_integrate(&second, v(-10.0, 0.0, 0.0)).unwrap();
    assert!(d.commit());
    assert_eq!(d.undo(), Some("Move".to_string()));
    assert_eq!(d.to_json(), before);

    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    rect_xy(&mut d, ROOT, 20.0, 0.0, 30.0, 10.0, 0.0);
    d.commit();
    let before = d.to_json();
    d.begin("Move");
    d.set_transform(g, mat_translation(v(20.0, 0.0, 0.0))).unwrap();
    assert!(d.commit());
    assert_eq!(d.undo(), Some("Move".to_string()));
    assert_eq!(d.to_json(), before);
}

#[test]
fn moving_vertices_from_two_definitions_is_refused() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    rect_xy(&mut d, ROOT, 20.0, 0.0, 30.0, 10.0, 0.0);
    let inner = d.vertices_in(def).map(|(id, _)| id).next().unwrap();
    let outer = d.vertices_in(ROOT).map(|(id, _)| id).next().unwrap();
    assert_eq!(
        d.move_and_integrate(&[inner, outer], v(1.0, 0.0, 0.0)),
        Err(Error::Degenerate("vertices belong to more than one definition"))
    );
    assert_eq!(d.move_and_integrate(&[VId(999)], v(1.0, 0.0, 0.0)), Err(Error::Missing("vertex")));
}

#[test]
fn move_and_integrate_into_a_locked_definition_is_refused() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    let t = d.new_tag("Existing");
    d.set_tag(g, Some(t)).unwrap();
    d.set_tag_flags(t, true, true).unwrap();
    d.commit();
    let before = d.to_json();
    let vx = d.vertices_in(def).map(|(id, _)| id).next().unwrap();
    d.begin("Move");
    assert_eq!(d.move_and_integrate(&[vx], v(1.0, 0.0, 0.0)), Err(Error::Locked));
    assert!(!d.commit(), "nothing was written");
    assert_eq!(d.to_json(), before);
}

#[test]
fn vertex_moved_onto_a_vertex_merges_into_it() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let line = d.add_line(ROOT, v(15.0, 5.0, 0.0), v(20.0, 5.0, 0.0)).unwrap();
    assert_eq!(vertex_count(&d, ROOT), 6);
    let end = d.find_vertex(ROOT, v(15.0, 5.0, 0.0)).unwrap();
    d.move_and_integrate(&[end], v(-5.0, 5.0, 0.0)).unwrap();
    assert_eq!(vertex_count(&d, ROOT), 5);
    let corner = d.find_vertex(ROOT, v(10.0, 10.0, 0.0)).unwrap();
    assert!(d.vertex(end).is_none(), "the moved vertex was welded away");
    assert!(d.vertex(corner).unwrap().edges.contains(&line[0]), "the line now ends at the corner");
    assert_eq!(faces(&d, ROOT).len(), 1, "a dangling line adds no face");
    validate(&d);
}

#[test]
fn lifting_a_corner_folds_the_top() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.commit();
    let before = d.to_json();
    let corner = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
    d.begin("Move");
    d.move_and_integrate(&[corner], v(0.0, 0.0, 3.0)).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 7, "five sides stay planar; the top is two triangles");
    assert_eq!(edge_count(&d, ROOT), 13, "one fold diagonal");
    // The hinge runs between the lifted corner's neighbours, so one triangle stays flat.
    let a = d.find_vertex(ROOT, v(10.0, 0.0, 10.0)).unwrap();
    let b = d.find_vertex(ROOT, v(0.0, 10.0, 10.0)).unwrap();
    assert!(d.edge_between(a, b).is_some());
    assert!(d.face_containing(ROOT, v(2.0, 2.0, 10.0), V3::Z).is_some());
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 1000.0 + 50.0));
    validate(&d);
    assert!(d.commit());
    assert_eq!(d.undo(), Some("Move".to_string()));
    assert_eq!(d.to_json(), before);
}

#[test]
fn a_folded_face_keeps_its_material_and_attributes() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    d.set_attribute(AttrTarget::Face(top), "survey", "kind", Some("roof".into())).unwrap();
    let corner = d.find_vertex(ROOT, v(10.0, 10.0, 10.0)).unwrap();
    d.move_and_integrate(&[corner], v(0.0, 0.0, 3.0)).unwrap();
    let roofs: Vec<FId> =
        d.faces_in(ROOT).filter(|(_, f)| f.plane.normal.z > 0.5).map(|(id, _)| id).collect();
    assert_eq!(roofs.len(), 2);
    for f in roofs {
        assert_eq!(d.attributes(AttrTarget::Face(f)).unwrap()["survey"]["kind"], "roof");
    }
    validate(&d);
}
