mod common;
use builder_kernel::math::mat_translation;
use builder_kernel::*;
use common::*;
use serde_json::json;

fn attr(d: &Document, t: AttrTarget, ns: &str, key: &str) -> Option<AttrValue> {
    d.attributes(t)?.get(ns)?.get(key).cloned()
}

/// A 10-inch box grouped into its own definition, committed as its own
/// transaction so undo stops at it. Returns the instance.
fn grouped_box(d: &mut Document) -> InstId {
    make_box(d, 10.0, 10.0, 10.0);
    let f = faces(d, ROOT);
    let g = d.make_group(ROOT, &f, &[], &[]).unwrap();
    d.commit();
    g
}

#[test]
fn set_and_delete_are_undone_and_redone() {
    let mut d = Document::new();
    let g = grouped_box(&mut d);
    let def = d.instance(g).unwrap().definition;
    let t = AttrTarget::Definition(def);

    d.begin("set");
    d.set_attribute(t, "survey", "kind", Some(json!("wall"))).unwrap();
    d.set_attribute(t, "survey", "approx", Some(json!(true))).unwrap();
    d.commit();
    d.begin("delete");
    d.set_attribute(t, "survey", "kind", None).unwrap();
    d.set_attribute(t, "survey", "approx", None).unwrap();
    d.commit();
    assert!(d.attributes(t).unwrap().is_empty(), "an emptied namespace is removed");

    d.undo();
    assert_eq!(attr(&d, t, "survey", "kind"), Some(json!("wall")));
    assert_eq!(attr(&d, t, "survey", "approx"), Some(json!(true)));
    d.undo();
    assert!(d.attributes(t).unwrap().is_empty());
    d.redo();
    assert_eq!(attr(&d, t, "survey", "kind"), Some(json!("wall")));
    d.redo();
    assert!(d.attributes(t).unwrap().is_empty());
}

#[test]
fn instance_and_face_attributes_are_journaled() {
    let mut d = Document::new();
    let g = grouped_box(&mut d);
    let def = d.instance(g).unwrap().definition;
    let f = faces(&d, def)[0];
    d.begin("set");
    d.set_attribute(AttrTarget::Instance(g), "survey", "phase", Some(json!("existing"))).unwrap();
    d.set_attribute(AttrTarget::Face(f), "acme", "rating", Some(json!(4.5))).unwrap();
    d.commit();
    assert_eq!(attr(&d, AttrTarget::Instance(g), "survey", "phase"), Some(json!("existing")));
    assert_eq!(attr(&d, AttrTarget::Face(f), "acme", "rating"), Some(json!(4.5)));
    d.undo();
    assert!(d.attributes(AttrTarget::Instance(g)).unwrap().is_empty());
    assert!(d.attributes(AttrTarget::Face(f)).unwrap().is_empty());
}

#[test]
fn bad_attributes_are_refused() {
    let mut d = Document::new();
    let t = AttrTarget::Definition(ROOT);
    for v in [json!([1, 2]), json!({"a": 1}), json!(null)] {
        let e = d.set_attribute(t, "survey", "kind", Some(v)).unwrap_err();
        assert!(matches!(&e, Error::Attribute(m) if m.contains("survey.kind")), "{e:?}");
    }
    for ns in ["", "Survey", "1x", "a b"] {
        assert!(matches!(d.set_attribute(t, ns, "k", Some(json!(1))), Err(Error::Attribute(_))));
    }
    assert!(matches!(d.set_attribute(t, "survey", "", Some(json!(1))), Err(Error::Attribute(_))));
    assert!(matches!(
        d.set_attribute(AttrTarget::Face(FId(99)), "survey", "k", Some(json!(1))),
        Err(Error::Missing(_))
    ));
    assert!(d.attributes(t).unwrap().is_empty());
    assert!(d.attributes(AttrTarget::Instance(InstId(99))).is_none());
}

#[test]
fn split_face_keeps_its_attributes() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 20.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    d.set_attribute(AttrTarget::Face(f), "survey", "kind", Some(json!("slab"))).unwrap();
    d.add_line(ROOT, v(10.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    let halves = faces(&d, ROOT);
    assert_eq!(halves.len(), 2);
    for h in halves {
        assert_eq!(attr(&d, AttrTarget::Face(h), "survey", "kind"), Some(json!("slab")));
    }
    validate(&d);
}

#[test]
fn faces_with_different_attributes_do_not_merge() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 20.0, 10.0, 0.0);
    let e = d.add_line(ROOT, v(10.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    let left = face_at(&d, ROOT, v(5.0, 5.0, 0.0), -V3::Z);
    d.set_attribute(AttrTarget::Face(left), "survey", "kind", Some(json!("slab"))).unwrap();
    d.erase(&[], &e).unwrap();
    assert!(faces(&d, ROOT).is_empty(), "the faces are erased with their edge, not merged");
}

#[test]
fn pulled_face_passes_attributes_to_the_new_faces() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    d.set_attribute(AttrTarget::Face(f), "survey", "kind", Some(json!("pad"))).unwrap();
    d.push_pull(f, -5.0).unwrap();
    assert_eq!(faces(&d, ROOT).len(), 6);
    for g in faces(&d, ROOT) {
        assert_eq!(attr(&d, AttrTarget::Face(g), "survey", "kind"), Some(json!("pad")));
    }
}

#[test]
fn grouping_and_exploding_keep_face_attributes() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    d.set_attribute(AttrTarget::Face(top), "survey", "kind", Some(json!("lid"))).unwrap();
    let f = faces(&d, ROOT);
    let g = d.make_group(ROOT, &f, &[], &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    let top = face_at(&d, def, v(5.0, 5.0, 10.0), V3::Z);
    assert_eq!(attr(&d, AttrTarget::Face(top), "survey", "kind"), Some(json!("lid")));
    d.explode(g).unwrap();
    let top = face_at(&d, ROOT, v(5.0, 5.0, 10.0), V3::Z);
    assert_eq!(attr(&d, AttrTarget::Face(top), "survey", "kind"), Some(json!("lid")));
}

#[test]
fn every_edit_of_locked_geometry_is_refused() {
    let mut d = Document::new();
    let g = grouped_box(&mut d);
    let def = d.instance(g).unwrap().definition;
    let tag = d.new_tag("Existing");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    d.commit();
    assert!(d.is_locked_def(def));
    assert!(!d.is_locked_def(ROOT));

    let f = faces(&d, def)[0];
    let e = d.edges_in(def).map(|(id, _)| id).next().unwrap();
    let vx = d.vertices_in(def).map(|(id, _)| id).next().unwrap();
    let before = d.to_json();
    d.begin("edits");
    assert_eq!(d.add_line(def, v(0.0, 0.0, 0.0), v(5.0, 5.0, 0.0)), Err(Error::Locked));
    assert_eq!(d.push_pull(f, 2.0).unwrap_err(), Error::Locked);
    assert_eq!(d.move_vertices(&[vx], v(1.0, 0.0, 0.0)), Err(Error::Locked));
    assert_eq!(d.erase(&[f], &[]), Err(Error::Locked));
    assert_eq!(d.erase(&[], &[e]), Err(Error::Locked));
    assert_eq!(d.make_group(def, &[f], &[], &[]), Err(Error::Locked));
    assert_eq!(d.make_group(ROOT, &[], &[], &[g]), Err(Error::Locked));
    assert_eq!(d.set_transform(g, mat_translation(v(5.0, 0.0, 0.0))), Err(Error::Locked));
    assert_eq!(d.explode(g).unwrap_err(), Error::Locked);
    assert_eq!(d.erase_instance(g), Err(Error::Locked));
    assert!(!d.commit(), "nothing was written");
    assert_eq!(d.to_json(), before);

    // Loose geometry outside the locked group is still editable.
    d.add_line(ROOT, v(20.0, 0.0, 0.0), v(30.0, 0.0, 0.0)).unwrap();

    // Unlocking is a journaled write, so undo locks it again.
    d.commit();
    d.begin("unlock");
    d.set_tag_flags(tag, true, false).unwrap();
    d.commit();
    d.set_transform(g, mat_translation(v(5.0, 0.0, 0.0))).unwrap();
    d.commit();
    d.undo();
    d.undo();
    assert!(d.tag(tag).unwrap().locked);
    assert_eq!(d.set_transform(g, mat_translation(v(5.0, 0.0, 0.0))), Err(Error::Locked));
}

#[test]
fn locks_reach_nested_groups_and_their_parents() {
    let mut d = Document::new();
    let inner = grouped_box(&mut d);
    let outer = d.make_group(ROOT, &[], &[], &[inner]).unwrap();
    let inner_def = d.instance(inner).unwrap().definition;
    let outer_def = d.instance(outer).unwrap().definition;
    let tag = d.new_tag("Existing");
    d.set_tag_flags(tag, true, true).unwrap();

    // A locked outer group locks the geometry inside its children.
    d.set_tag(outer, Some(tag)).unwrap();
    assert!(d.is_locked_def(outer_def) && d.is_locked_def(inner_def));
    let f = faces(&d, inner_def)[0];
    assert_eq!(d.push_pull(f, 1.0).unwrap_err(), Error::Locked);
    assert_eq!(d.set_transform(inner, mat_translation(v(1.0, 0.0, 0.0))), Err(Error::Locked));

    // A locked child refuses moving, exploding or erasing the unlocked group around it.
    d.set_tag(outer, None).unwrap();
    d.set_tag(inner, Some(tag)).unwrap();
    assert!(!d.is_locked_def(outer_def) && d.is_locked_def(inner_def));
    assert_eq!(d.set_transform(outer, mat_translation(v(1.0, 0.0, 0.0))), Err(Error::Locked));
    assert_eq!(d.explode(outer).unwrap_err(), Error::Locked);
    assert_eq!(d.erase_instance(outer), Err(Error::Locked));
    // The outer group's own geometry stays editable.
    d.add_line(outer_def, v(20.0, 0.0, 0.0), v(30.0, 0.0, 0.0)).unwrap();
}

#[test]
fn tags_are_created_assigned_and_checked() {
    let mut d = Document::new();
    let g = grouped_box(&mut d);
    let t = d.new_tag("Proposed");
    assert_eq!(d.tag(t), Some(&Tag { name: "Proposed".into(), visible: true, locked: false }));
    d.commit();
    d.begin("tag");
    d.set_tag(g, Some(t)).unwrap();
    d.set_tag_flags(t, false, true).unwrap();
    d.commit();
    assert_eq!(d.instance(g).unwrap().tag, Some(t));
    assert!(!d.tag(t).unwrap().visible && d.tag(t).unwrap().locked);
    d.undo();
    assert_eq!(d.instance(g).unwrap().tag, None);
    assert!(d.tag(t).unwrap().visible && !d.tag(t).unwrap().locked);
    assert_eq!(d.set_tag(g, Some(TagId(9))), Err(Error::Missing("tag")));
    assert_eq!(d.set_tag(InstId(9), None), Err(Error::Missing("instance")));
    assert_eq!(d.set_tag_flags(TagId(9), true, true), Err(Error::Missing("tag")));
}
