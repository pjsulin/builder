mod common;
use builder_kernel::math::{mat_translation, IDENTITY};
use builder_kernel::*;
use common::*;

fn all_faces_and_edges(d: &Document, ctx: DefId) -> (Vec<FId>, Vec<EId>) {
    (faces(d, ctx), d.edges_in(ctx).map(|(id, _)| id).collect())
}

#[test]
fn grouping_a_box_moves_its_geometry_out_of_the_root() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    assert!(faces(&d, ROOT).is_empty());
    assert_eq!(edge_count(&d, ROOT), 0);
    let def = d.instance(g).unwrap().definition;
    assert_eq!(faces(&d, def).len(), 6);
    assert!(is_closed(&d, def));
    assert!(approx(volume(&d, def), 1000.0));
    validate(&d);
}

#[test]
fn grouped_geometry_does_not_stick_to_new_lines() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    // A line straight across the group's top face, drawn in the root context.
    d.add_line(ROOT, v(5.0, -5.0, 10.0), v(5.0, 15.0, 10.0)).unwrap();
    assert_eq!(faces(&d, def).len(), 6, "group faces are not split");
    assert_eq!(edge_count(&d, ROOT), 1);
    validate(&d);
}

#[test]
fn grouping_part_of_a_box_leaves_the_rest_closed_on_its_edges() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    let g = d.make_group(ROOT, &[top], &[], &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    assert_eq!(faces(&d, ROOT).len(), 5);
    assert_eq!(edge_count(&d, ROOT), 12, "the open box keeps its rim");
    assert_eq!(faces(&d, def).len(), 1);
    assert_eq!(edge_count(&d, def), 4);
    validate(&d);
}

#[test]
fn explode_puts_geometry_back_through_the_transform() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    d.set_transform(g, mat_translation(v(100.0, 0.0, 0.0))).unwrap();
    let def = d.instance(g).unwrap().definition;
    let out = d.explode(g).unwrap();
    assert_eq!(out.faces.len(), 6);
    assert!(d.instance(g).is_none());
    assert!(d.definition(def).is_none());
    assert!(d.find_vertex(ROOT, v(110.0, 10.0, 10.0)).is_some());
    assert!(approx(volume(&d, ROOT), 1000.0));
    validate(&d);
}

#[test]
fn nested_groups_keep_their_instances_on_explode() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let inner = d.make_group(ROOT, &f, &e, &[]).unwrap();
    d.set_transform(inner, mat_translation(v(0.0, 0.0, 5.0))).unwrap();
    let outer = d.make_group(ROOT, &[], &[], &[inner]).unwrap();
    d.set_transform(outer, mat_translation(v(20.0, 0.0, 0.0))).unwrap();
    let outer_def = d.instance(outer).unwrap().definition;
    assert_eq!(d.instance(inner).unwrap().parent, outer_def);
    let out = d.explode(outer).unwrap();
    assert_eq!(out.instances, vec![inner]);
    let t = d.instance(inner).unwrap().transform;
    assert_eq!((t[12], t[13], t[14]), (20.0, 0.0, 5.0));
    validate(&d);
}

#[test]
fn erasing_an_instance_deletes_the_group() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all_faces_and_edges(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    d.erase_instance(g).unwrap();
    assert_eq!(d.faces.count(), 0);
    assert_eq!(d.definitions.count(), 1);
    validate(&d);
}

#[test]
fn grouping_nothing_is_an_error() {
    let mut d = Document::new();
    assert_eq!(d.make_group(ROOT, &[], &[], &[]).unwrap_err(), Error::Empty);
    let _ = IDENTITY;
}
