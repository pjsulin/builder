mod common;
use builder_kernel::math::{mat_translation, IDENTITY};
use builder_kernel::*;
use common::*;
use std::time::Instant;

fn all(d: &Document, ctx: DefId) -> (Vec<FId>, Vec<EId>) {
    (faces(d, ctx), d.edges_in(ctx).map(|(id, _)| id).collect())
}

#[test]
fn a_box_copied_flush_welds_into_one_solid() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.commit();
    let (f, e) = all(&d, ROOT);
    d.begin("Copy");
    let c = d.copy_geometry(ROOT, &f, &e, v(10.0, 0.0, 0.0)).unwrap();
    assert!(d.commit());
    // The copy's left side landed on the original's right side and cancelled with
    // it, and the copy's other sides merged with the original's coplanar ones: one
    // 20 x 10 x 10 box. Only the copy's far side keeps its id.
    assert_eq!(c.faces.len(), 1);
    assert_eq!(c.faces[0], face_at(&d, ROOT, v(20.0, 5.0, 5.0), V3::X));
    assert!(c.edges.iter().all(|&x| d.edge(x).is_some()));
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert_eq!(vertex_count(&d, ROOT), 8, "the seam's vertices dissolved");
    assert!(is_closed(&d, ROOT));
    assert!(approx(volume(&d, ROOT), 2000.0));
    validate(&d);
    assert_eq!(d.undo(), Some("Copy".into()));
    assert_eq!(faces(&d, ROOT).len(), 6);
    assert!(approx(volume(&d, ROOT), 1000.0));
    validate(&d);
}

#[test]
fn a_copy_clear_of_the_original_is_independent() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all(&d, ROOT);
    let c = d.copy_geometry(ROOT, &f, &e, v(20.0, 0.0, 0.0)).unwrap();
    assert_eq!(c.faces.len(), 6);
    assert_eq!(c.edges.len(), 12);
    assert_eq!(faces(&d, ROOT).len(), 12);
    assert_eq!(edge_count(&d, ROOT), 24);
    assert!(approx(volume(&d, ROOT), 2000.0));
    validate(&d);
    // Edges alone copy too, and a face brings its edges even when none are listed.
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    let c = d.copy_geometry(ROOT, &[top], &[], v(0.0, 0.0, 20.0)).unwrap();
    assert_eq!((c.faces.len(), c.edges.len()), (1, 4));
    let c = d.copy_geometry(ROOT, &[], &e[..1], v(0.0, 0.0, 40.0)).unwrap();
    assert_eq!((c.faces.len(), c.edges.len()), (0, 1));
    validate(&d);
    assert!(matches!(d.copy_geometry(ROOT, &[], &[], v(1.0, 0.0, 0.0)), Err(Error::Empty)));
    assert!(d.copy_geometry(ROOT, &[top], &[], v(f64::NAN, 0.0, 0.0)).is_err());
}

#[test]
fn a_copied_group_gets_its_own_equal_definition() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all(&d, ROOT);
    let mat = d.next_mat();
    d.set_material(mat, Some(Material { name: "Pine".into(), color: [200, 170, 120], opacity: 1.0 }));
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    let mut face = d.face(top).cloned().unwrap();
    face.material = Some(mat);
    d.set_face(top, Some(face));
    d.set_attribute(AttrTarget::Face(top), "survey", "kind", Some("deck".into())).unwrap();
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let tag = d.new_tag("Proposed");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_attribute(AttrTarget::Instance(g), "survey", "id", Some("J1".into())).unwrap();
    let def = d.instance(g).unwrap().definition;
    d.set_attribute(AttrTarget::Definition(def), "survey", "kind", Some("joist".into())).unwrap();
    d.commit();

    d.begin("Copy");
    let g2 = d.copy_instance(g, v(16.0, 0.0, 0.0)).unwrap();
    d.commit();
    let (i1, i2) = (d.instance(g).cloned().unwrap(), d.instance(g2).cloned().unwrap());
    assert_ne!(i2.definition, def);
    assert_eq!(i2.parent, ROOT);
    assert_eq!(i2.transform, mat_translation(v(16.0, 0.0, 0.0)));
    assert_eq!(i1.transform, IDENTITY);
    assert_eq!((i2.name, i2.material, i2.tag), (i1.name, i1.material, i1.tag));
    assert_eq!(i2.attributes, i1.attributes);
    let (d1, d2) = (d.definition(def).unwrap(), d.definition(i2.definition).unwrap());
    assert_eq!(
        (d2.name.clone(), d2.kind, d2.attributes.clone()),
        (d1.name.clone(), d1.kind, d1.attributes.clone())
    );
    assert_eq!(faces(&d, i2.definition).len(), 6);
    assert_eq!(edge_count(&d, i2.definition), 12);
    assert_eq!(vertex_count(&d, i2.definition), 8);
    assert!(approx(volume(&d, i2.definition), 1000.0));
    let copied_top = face_at(&d, i2.definition, v(5.0, 5.0, 10.0), V3::Z);
    let grouped_top = face_at(&d, def, v(5.0, 5.0, 10.0), V3::Z);
    let ct = d.face(copied_top).unwrap();
    assert_eq!(ct.material, Some(mat));
    assert_eq!(ct.attributes, d.face(grouped_top).unwrap().attributes);
    assert_eq!(ct.attributes["survey"]["kind"], "deck");
    validate(&d);

    assert_eq!(d.undo(), Some("Copy".into()));
    assert!(d.instance(g2).is_none());
    assert!(d.definition(i2.definition).is_none());
    assert!(faces(&d, i2.definition).is_empty());
    assert!(d.instance(g).is_some());
    validate(&d);
}

#[test]
fn a_nested_group_is_copied_recursively() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all(&d, ROOT);
    let inner = d.make_group(ROOT, &f, &e, &[]).unwrap();
    d.set_transform(inner, mat_translation(v(0.0, 0.0, 5.0))).unwrap();
    rect_xy(&mut d, ROOT, 20.0, 0.0, 30.0, 10.0, 0.0);
    let pad = only_face(&d, ROOT);
    let outer = d.make_group(ROOT, &[pad], &[], &[inner]).unwrap();
    let outer_def = d.instance(outer).unwrap().definition;
    assert_eq!(d.instance(inner).unwrap().parent, outer_def);

    let copy = d.copy_instance(outer, v(0.0, 50.0, 0.0)).unwrap();
    let copy_def = d.instance(copy).unwrap().definition;
    assert_ne!(copy_def, outer_def);
    assert_eq!(faces(&d, copy_def).len(), 1);
    let children: Vec<&Instance> = d.instances_in(copy_def).map(|(_, i)| i).collect();
    assert_eq!(children.len(), 1);
    let child = children[0];
    assert_ne!(child.definition, d.instance(inner).unwrap().definition);
    assert_eq!(child.transform, mat_translation(v(0.0, 0.0, 5.0)), "a child keeps its own transform");
    assert_eq!(faces(&d, child.definition).len(), 6);
    assert_eq!(d.instances_in(ROOT).count(), 2);
    validate(&d);
}

#[test]
fn locked_geometry_is_not_copied() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let (f, e) = all(&d, ROOT);
    let inner = d.make_group(ROOT, &f, &e, &[]).unwrap();
    let outer = d.make_group(ROOT, &[], &[], &[inner]).unwrap();
    let outer_def = d.instance(outer).unwrap().definition;
    let inner_def = d.instance(inner).unwrap().definition;
    let tag = d.new_tag("Existing");
    d.set_tag(outer, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    assert_eq!(d.copy_instance(outer, v(1.0, 0.0, 0.0)), Err(Error::Locked));
    // The inner instance is on no tag, but its parent definition is locked.
    assert_eq!(d.copy_instance(inner, v(1.0, 0.0, 0.0)), Err(Error::Locked));
    let inner_faces = faces(&d, inner_def);
    assert!(matches!(d.copy_geometry(inner_def, &inner_faces, &[], v(1.0, 0.0, 0.0)), Err(Error::Locked)));
    assert_eq!(d.instances_in(ROOT).count(), 1);
    assert_eq!(d.instances_in(outer_def).count(), 1);
    d.set_tag_flags(tag, true, false).unwrap();
    assert!(d.copy_instance(inner, v(1.0, 0.0, 0.0)).is_ok());
    assert!(d.copy_geometry(inner_def, &inner_faces, &[], v(20.0, 0.0, 0.0)).is_ok());
    validate(&d);
}

#[test]
fn fifty_instance_copies_commit_quickly() {
    let mut d = Document::new();
    make_box(&mut d, 1.5, 96.0, 7.25);
    let (f, e) = all(&d, ROOT);
    let g = d.make_group(ROOT, &f, &e, &[]).unwrap();
    d.commit();
    let t = Instant::now();
    d.begin("Copy");
    for k in 1..=50 {
        d.copy_instance(g, v(16.0 * k as f64, 0.0, 0.0)).unwrap();
    }
    assert!(d.commit());
    let elapsed = t.elapsed();
    assert_eq!(d.instances_in(ROOT).count(), 51);
    assert!(elapsed.as_millis() < 100, "50 copies took {elapsed:?}");
    validate(&d);
    assert_eq!(d.undo(), Some("Copy".into()));
    assert_eq!(d.instances_in(ROOT).count(), 1);
}
