mod common;
use builder_kernel::math::mat_translation;
use builder_kernel::*;
use common::*;

fn sample() -> Document {
    let mut d = Document::new();
    make_box(&mut d, 40.0, 6.0, 30.0);
    poly(&mut d, ROOT, &[v(10.0, 0.0, 10.0), v(20.0, 0.0, 10.0), v(20.0, 0.0, 20.0), v(10.0, 0.0, 20.0)]);
    let win = face_at(&d, ROOT, v(15.0, 0.0, 15.0), -V3::Y);
    d.push_pull(win, -6.0).unwrap();
    rect_xy(&mut d, ROOT, 60.0, 0.0, 70.0, 10.0, 0.0);
    let f = face_at(&d, ROOT, v(65.0, 5.0, 0.0), -V3::Z);
    d.push_pull(f, -10.0).unwrap();
    // The second box: every face with all its vertices at x >= 60.
    let pad: Vec<FId> = d
        .faces_in(ROOT)
        .filter(|(_, x)| x.loops().flatten().all(|&p| d.pos(p).x >= 60.0))
        .map(|(id, _)| id)
        .collect();
    assert_eq!(pad.len(), 6);
    let g = d.make_group(ROOT, &pad, &[], &[]).unwrap();
    d.set_transform(g, mat_translation(v(0.0, 30.0, 0.0))).unwrap();
    let m = d.next_mat();
    d.set_material(m, Some(Material { name: "Brick".into(), color: [150, 70, 50], opacity: 1.0 }));
    let wall = face_at(&d, ROOT, v(5.0, 0.0, 5.0), -V3::Y);
    let mut face = d.face(wall).cloned().unwrap();
    face.material = Some(m);
    d.set_face(wall, Some(face));
    d.add_line(ROOT, v(-10.0, -10.0, 0.0), v(-10.0, -20.0, 0.0)).unwrap();
    d
}

#[test]
fn round_trip_preserves_the_model() {
    let d = sample();
    validate(&d);
    let text = d.to_json();
    let back = Document::from_json(&text).unwrap();
    validate(&back);
    assert_eq!(back.to_json(), text);
    assert_eq!(back.faces.count(), d.faces.count());
    assert_eq!(back.edges.count(), d.edges.count());
    assert_eq!(back.instances.count(), 1);
    assert!(approx(volume(&back, ROOT), volume(&d, ROOT)));
    let wall = face_at(&back, ROOT, v(5.0, 0.0, 5.0), -V3::Y);
    assert_eq!(back.face(wall).unwrap().holes.len(), 1, "the window is a hole in the wall");
    assert_eq!(
        back.face(wall).unwrap().material.map(|m| back.material(m).unwrap().name.clone()),
        Some("Brick".to_string())
    );
    assert!(!back.can_undo(), "a loaded file starts with empty history");
}

#[test]
fn file_header_is_checked() {
    assert!(matches!(Document::from_json("{}"), Err(Error::Format(_))));
    let newer =
        r#"{"format":"builder","version":99,"units":"inch","definitions":[{"name":"Model","kind":"root"}]}"#;
    assert!(Document::from_json(newer).unwrap_err().to_string().contains("newer"));
    let other =
        r#"{"format":"other","version":1,"units":"inch","definitions":[{"name":"Model","kind":"root"}]}"#;
    assert!(Document::from_json(other).is_err());
}

#[test]
fn bad_indices_are_rejected_not_trusted() {
    let bad_edge = r#"{"format":"builder","version":1,"units":"inch","definitions":[{"name":"Model","kind":"root","vertices":[[0,0,0]],"edges":[[0,5]]}]}"#;
    assert!(Document::from_json(bad_edge).is_err());
    let bad_face = r#"{"format":"builder","version":1,"units":"inch","definitions":[{"name":"Model","kind":"root","vertices":[[0,0,0],[1,0,0],[0,1,0]],"faces":[{"outer":[0,1,9]}]}]}"#;
    assert!(Document::from_json(bad_face).is_err());
    let flat_face = r#"{"format":"builder","version":1,"units":"inch","definitions":[{"name":"Model","kind":"root","vertices":[[0,0,0],[1,0,0],[2,0,0]],"faces":[{"outer":[0,1,2]}]}]}"#;
    assert!(Document::from_json(flat_face).is_err());
}

#[test]
fn metric_files_are_converted_to_inches() {
    let mm = r#"{"format":"builder","version":1,"units":"mm","definitions":[{"name":"Model","kind":"root","vertices":[[0,0,0],[254,0,0]],"edges":[[0,1]]}]}"#;
    let d = Document::from_json(mm).unwrap();
    assert!(d.find_vertex(ROOT, v(10.0, 0.0, 0.0)).is_some());
}

#[test]
fn instance_cycles_are_rejected() {
    let cyclic = r#"{"format":"builder","version":1,"units":"inch","definitions":[
        {"name":"Model","kind":"root"},{"name":"A","kind":"group"},{"name":"B","kind":"group"}],
        "instances":[
          {"definition":1,"parent":0,"transform":[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},
          {"definition":2,"parent":1,"transform":[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},
          {"definition":1,"parent":2,"transform":[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}]}"#;
    assert!(Document::from_json(cyclic).unwrap_err().to_string().contains("contains itself"));
}

#[test]
fn attributes_and_locks_round_trip_byte_stable() {
    use serde_json::json;
    let mut d = sample();
    let g = d.instances_in(ROOT).map(|(i, _)| i).next().unwrap();
    let def = d.instance(g).unwrap().definition;
    let wall = face_at(&d, ROOT, v(5.0, 0.0, 5.0), -V3::Y);
    d.set_attribute(AttrTarget::Definition(def), "survey", "kind", Some(json!("wall"))).unwrap();
    d.set_attribute(AttrTarget::Definition(def), "survey", "approx", Some(json!(false))).unwrap();
    d.set_attribute(AttrTarget::Definition(ROOT), "x-myplugin", "revision", Some(json!(3))).unwrap();
    d.set_attribute(AttrTarget::Instance(g), "survey", "phase", Some(json!("existing"))).unwrap();
    d.set_attribute(AttrTarget::Face(wall), "acme", "rating", Some(json!(4.5))).unwrap();
    let t = d.new_tag("Existing");
    d.set_tag(g, Some(t)).unwrap();
    d.set_tag_flags(t, true, true).unwrap();

    let text = d.to_json();
    assert!(text.contains(r#""attributes":{"survey":{"approx":false,"kind":"wall"}}"#), "sorted keys");
    assert!(text.contains(r#""locked":true"#));
    let back = Document::from_json(&text).unwrap();
    assert_eq!(back.to_json(), text, "one save is byte-stable");
    let g2 = back.instances_in(ROOT).map(|(i, _)| i).next().unwrap();
    let def2 = back.instance(g2).unwrap().definition;
    assert_eq!(back.attributes(AttrTarget::Definition(def2)).unwrap()["survey"]["kind"], json!("wall"));
    assert_eq!(back.attributes(AttrTarget::Definition(ROOT)).unwrap()["x-myplugin"]["revision"], json!(3));
    assert_eq!(back.attributes(AttrTarget::Instance(g2)).unwrap()["survey"]["phase"], json!("existing"));
    let wall2 = face_at(&back, ROOT, v(5.0, 0.0, 5.0), -V3::Y);
    assert_eq!(back.attributes(AttrTarget::Face(wall2)).unwrap()["acme"]["rating"], json!(4.5));
    assert!(back.tag(TagId(0)).unwrap().locked);
    assert!(back.is_locked_def(def2));
}

#[test]
fn files_without_attributes_still_load_and_write_none() {
    let v1 = r#"{"format":"builder","version":1,"units":"inch","definitions":[{"name":"Model","kind":"root","vertices":[[0,0,0],[10,0,0],[10,10,0],[0,10,0]],"edges":[[0,1],[1,2],[2,3],[3,0]],"faces":[{"outer":[0,3,2,1]}]}],"tags":[{"name":"Walls","visible":true}]}"#;
    let d = Document::from_json(v1).unwrap();
    assert!(d.attributes(AttrTarget::Definition(ROOT)).unwrap().is_empty());
    assert!(!d.tag(TagId(0)).unwrap().locked);
    let text = d.to_json();
    assert!(!text.contains("attributes"), "empty attributes are not written");
}

#[test]
fn bad_attributes_are_rejected_with_their_path() {
    let head =
        r#"{"format":"builder","version":1,"units":"inch","definitions":[{"name":"Model","kind":"root""#;
    let nested = format!(r#"{head},"attributes":{{"survey":{{"size":[1,2]}}}}}}]}}"#);
    let e = Document::from_json(&nested).unwrap_err().to_string();
    assert!(e.contains("definitions[0].attributes.survey.size"), "{e}");
    let flat = format!(r#"{head},"attributes":{{"survey":"wall"}}}}]}}"#);
    let e = Document::from_json(&flat).unwrap_err().to_string();
    assert!(e.contains("definitions[0].attributes.survey"), "{e}");
    let bad_ns = format!(r#"{head},"attributes":{{"Survey":{{"kind":"wall"}}}}}}]}}"#);
    assert!(Document::from_json(&bad_ns).is_err());
    let inst = format!(
        r#"{head}}},{{"name":"A","kind":"group"}}],"instances":[{{"definition":1,"parent":0,"transform":[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],"attributes":{{"survey":{{"phase":null}}}}}}]}}"#
    );
    let e = Document::from_json(&inst).unwrap_err().to_string();
    assert!(e.contains("instances[0].attributes.survey.phase"), "{e}");
}
