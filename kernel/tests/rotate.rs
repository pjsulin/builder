mod common;
use builder_kernel::math::{mat_apply, mat_mul, mat_rotation, mat_translation};
use builder_kernel::*;
use common::*;
use std::f64::consts::PI;

fn all(d: &Document, ctx: DefId) -> (Vec<FId>, Vec<EId>) {
    (faces(d, ctx), d.edges_in(ctx).map(|(id, _)| id).collect())
}

fn all_vertices(d: &Document, ctx: DefId) -> Vec<VId> {
    d.vertices_in(ctx).map(|(id, _)| id).collect()
}

#[test]
fn a_box_rotated_whole_stays_closed_with_its_volume() {
    let mut d = Document::new();
    make_box(&mut d, 120.0, 96.0, 96.0);
    d.commit();
    let before = d.to_json();
    let verts = all_vertices(&d, ROOT);
    let m = mat_rotation(V3::ZERO, V3::Z, 37f64.to_radians()).unwrap();
    d.begin("Rotate");
    d.transform_and_integrate(&verts, &m).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert_eq!(edge_count(&d, ROOT), 12);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 120.0 * 96.0 * 96.0));
    assert!(d.find_vertex(ROOT, V3::ZERO).is_some(), "the corner on the axis stays put");
    let far = mat_apply(&m, v(120.0, 96.0, 96.0));
    assert!(d.find_vertex(ROOT, far).is_some());
    validate(&d);
    // Past 90°: a fully rotated face carries its normal through the rotation, so
    // turning the box upside down is not "inside out".
    let flip = mat_rotation(v(60.0, 48.0, 48.0), V3::X, PI).unwrap();
    let verts = all_vertices(&d, ROOT);
    d.transform_and_integrate(&verts, &flip).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 120.0 * 96.0 * 96.0), "every face still points out");
    validate(&d);
    assert!(d.commit());
    assert_eq!(d.undo(), Some("Rotate".to_string()));
    assert_eq!(d.to_json(), before);
}

#[test]
fn a_box_top_rotated_about_its_front_edge_tilts_without_folding() {
    let mut d = Document::new();
    make_box(&mut d, 120.0, 96.0, 96.0);
    let top = face_at(&d, ROOT, v(60.0, 48.0, 96.0), V3::Z);
    let verts = d.vertices_of(&[top], &[]);
    // The front top edge runs along X at y = 0, z = 96; the back of the top lifts.
    let m = mat_rotation(v(0.0, 0.0, 96.0), V3::X, 10f64.to_radians()).unwrap();
    d.transform_and_integrate(&verts, &m).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 6, "the side walls stay planar: nothing folds");
    assert_eq!(edge_count(&d, ROOT), 12);
    assert!(is_closed(&d, ROOT));
    let lifted = v(120.0, 96.0 * 10f64.to_radians().cos(), 96.0 + 96.0 * 10f64.to_radians().sin());
    assert!(d.find_vertex(ROOT, lifted).is_some());
    assert!(d.find_vertex(ROOT, v(120.0, 0.0, 96.0)).is_some(), "the hinge stays");
    let top = d.face_containing(ROOT, mat_apply(&m, v(60.0, 48.0, 96.0)), V3::Z);
    assert!(top.is_some(), "the top still faces up");
    validate(&d);
}

#[test]
fn a_top_edge_rotated_folds_the_walls_it_bends() {
    let mut d = Document::new();
    make_box(&mut d, 120.0, 96.0, 96.0);
    let a = d.find_vertex(ROOT, v(120.0, 0.0, 96.0)).unwrap();
    let b = d.find_vertex(ROOT, v(120.0, 96.0, 96.0)).unwrap();
    let edge = d.edge_between(a, b).unwrap();
    let verts = d.vertices_of(&[], &[edge]);
    // Swing the right top edge inward about the vertical through its front end.
    let m = mat_rotation(v(120.0, 0.0, 96.0), V3::Z, 20f64.to_radians()).unwrap();
    d.transform_and_integrate(&verts, &m).unwrap();
    // The top stays flat (one corner moved within z = 96); the right wall and the
    // back wall can no longer be planar, so each folds in two along a diagonal.
    assert_eq!(faces(&d, ROOT).len(), 8);
    assert_eq!(edge_count(&d, ROOT), 14);
    assert!(is_closed(&d, ROOT));
    let moved = mat_apply(&m, v(120.0, 96.0, 96.0));
    assert!(d.find_vertex(ROOT, moved).is_some());
    validate(&d);
}

#[test]
fn a_copy_rotated_half_a_turn_about_a_shared_face_welds_into_one_solid() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.commit();
    let (f, e) = all(&d, ROOT);
    // Half a turn about the horizontal line through the middle of the x = 10 side
    // maps the box onto [10, 20] × [0, 10] × [0, 10], sharing that side.
    let m = mat_rotation(v(10.0, 0.0, 5.0), V3::Y, PI).unwrap();
    d.begin("Copy");
    let c = d.copy_geometry_transformed(ROOT, &f, &e, &m).unwrap();
    assert!(d.commit());
    assert_eq!(faces(&d, ROOT).len(), 6, "the shared sides cancel, the coplanar ones merge");
    assert_eq!(vertex_count(&d, ROOT), 8);
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 2000.0));
    assert!(c.faces.iter().all(|&x| d.face(x).is_some()));
    assert!(c.edges.iter().all(|&x| d.edge(x).is_some()));
    validate(&d);
    assert_eq!(d.undo(), Some("Copy".into()));
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert!(approx(volume(&d, ROOT), 1000.0));
    validate(&d);
}

#[test]
fn a_rotated_copy_of_a_group_is_rotation_times_transform() {
    let mut d = Document::new();
    make_box(&mut d, 2.0, 120.0, 10.0);
    let (f, e) = all(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let t = mat_translation(v(30.0, 0.0, 0.0));
    d.set_transform(g, t).unwrap();
    let def = d.instance(g).unwrap().definition;
    let r = mat_rotation(v(30.0, 0.0, 0.0), V3::Z, 37f64.to_radians()).unwrap();
    let g2 = d.copy_instance_transformed(g, &r).unwrap();
    let (i1, i2) = (d.instance(g).cloned().unwrap(), d.instance(g2).cloned().unwrap());
    assert_eq!(i2.transform, mat_mul(&r, &t));
    assert_eq!(i1.transform, t, "the original is where it was");
    assert_ne!(i2.definition, def);
    assert_eq!(faces(&d, i2.definition).len(), 6);
    assert!(approx(volume(&d, i2.definition), 2400.0));
    assert!(d.copy_instance_transformed(g, &[f64::NAN; 16]).is_err());
    validate(&d);
}

#[test]
fn a_locked_definition_is_not_rotated() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    let tag = d.new_tag("Existing");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    d.commit();
    let before = d.to_json();
    let verts = all_vertices(&d, def);
    let m = mat_rotation(V3::ZERO, V3::Z, 1.0).unwrap();
    d.begin("Rotate");
    assert_eq!(d.transform_and_integrate(&verts, &m), Err(Error::Locked));
    assert_eq!(d.transform_vertices(&verts, &m), Err(Error::Locked));
    assert_eq!(d.copy_instance_transformed(g, &m), Err(Error::Locked));
    assert!(matches!(d.copy_geometry_transformed(def, &faces(&d, def), &[], &m), Err(Error::Locked)));
    assert!(!d.commit(), "nothing was written");
    assert_eq!(d.to_json(), before);
}
