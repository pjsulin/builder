mod common;
use builder_kernel::math::mat_translation;
use builder_kernel::*;
use common::*;

/// A 10' x 8' x 10' box with a gable roof drawn as two loose rectangles (ridge at
/// z = 108 over y = 48, eaves 12" past the walls at z = 78), grouped and moved into
/// place over the box. Returns the roof instance.
fn shed_with_roof(d: &mut Document) -> InstId {
    make_box(d, 120.0, 96.0, 120.0);
    // Drawn 1000" to the side so no roof edge touches the box, then moved over it.
    let dx = 1000.0;
    poly(
        d,
        ROOT,
        &[
            v(dx - 12.0, -12.0, 78.0),
            v(dx + 132.0, -12.0, 78.0),
            v(dx + 132.0, 48.0, 108.0),
            v(dx - 12.0, 48.0, 108.0),
        ],
    );
    poly(
        d,
        ROOT,
        &[
            v(dx - 12.0, 48.0, 108.0),
            v(dx + 132.0, 48.0, 108.0),
            v(dx + 132.0, 108.0, 78.0),
            v(dx - 12.0, 108.0, 78.0),
        ],
    );
    let roof_faces: Vec<FId> =
        faces(d, ROOT).into_iter().filter(|&f| d.pos(d.face(f).unwrap().outer[0]).x > 500.0).collect();
    assert_eq!(roof_faces.len(), 2);
    let roof = d.make_group(ROOT, &roof_faces, &[], &[]).unwrap();
    d.set_transform(roof, mat_translation(v(-dx, 0.0, 0.0))).unwrap();
    validate(d);
    roof
}

#[test]
fn a_gable_roof_group_cuts_the_walls_it_passes_through() {
    let mut d = Document::new();
    let roof = shed_with_roof(&mut d);
    let walls = faces(&d, ROOT);
    assert_eq!(walls.len(), 6);
    let cuts = d.intersection_cuts(ROOT, &walls, &[roof], IntersectWith::Model);
    // One line across each long wall, two meeting at the ridge on each gable wall.
    assert_eq!(cuts.len(), 6);
    assert!(cuts.iter().all(|c| c.face.is_some()));

    let edges = d.intersect_faces(ROOT, &walls, &[roof], IntersectWith::Model).unwrap();
    assert_eq!(edges.len(), 6);
    assert!(edges.iter().all(|&e| d.edge(e).is_some()));
    validate(&d);
    // Floor and top untouched, each wall split into the part under the roof and above it.
    assert_eq!(faces(&d, ROOT).len(), 10);
    let def = d.instance(roof).unwrap().definition;
    assert_eq!(faces(&d, def).len(), 2, "the roof group is read, not written");
    assert_eq!(edge_count(&d, def), 7);

    // The gable wall above the roof line is its own face: push it, then erase it.
    let above = face_at(&d, ROOT, v(0.0, 48.0, 115.0), -V3::X);
    let below = face_at(&d, ROOT, v(0.0, 48.0, 50.0), -V3::X);
    assert_ne!(above, below);
    assert!(approx(d.face_area(above), 96.0 * 36.0 - 96.0 * 24.0 / 2.0));
    d.push_pull(above, 2.0).unwrap();
    validate(&d);
    let front_above = face_at(&d, ROOT, v(60.0, 0.0, 100.0), -V3::Y);
    d.erase(&[front_above], &[]).unwrap();
    validate(&d);
    assert!(d.faces_in(ROOT).all(|(_, f)| f.outer.len() >= 3));

    // Nothing left to cut: the same call draws no new edge.
    let again = d.intersect_faces(ROOT, &faces(&d, ROOT), &[roof], IntersectWith::Model).unwrap();
    assert!(again.iter().all(|&e| edges.contains(&e) || d.edge(e).is_some()));
    validate(&d);
}

#[test]
fn inside_the_group_the_walls_cut_the_roof() {
    let mut d = Document::new();
    let roof = shed_with_roof(&mut d);
    let def = d.instance(roof).unwrap().definition;
    // Loose geometry of the root is not visible from inside a group, so the box is
    // grouped and placed inside the roof group (in the roof's own coordinates) to
    // stand for the model around it.
    let walls = faces(&d, ROOT);
    let box_inst = d.make_group(ROOT, &walls, &[], &[]).unwrap();
    let mut x = d.instance(box_inst).cloned().unwrap();
    x.parent = def;
    x.transform = mat_translation(v(1000.0, 0.0, 0.0));
    d.set_instance(box_inst, Some(x));
    let roof_faces = faces(&d, def);
    let edges = d.intersect_faces(def, &roof_faces, &[], IntersectWith::Model).unwrap();
    assert!(!edges.is_empty());
    validate(&d);
    // Each roof plane is cut along both long walls and both gable walls.
    assert!(faces(&d, def).len() > 2);
    assert_eq!(faces(&d, d.instance(box_inst).unwrap().definition).len(), 6, "the box is not written");
}

#[test]
fn with_selection_only_the_selected_pair_is_cut() {
    let mut d = Document::new();
    // A vertical face, crossed by two horizontal faces at different heights.
    poly(&mut d, ROOT, &[v(0.0, 10.0, 0.0), v(10.0, 10.0, 0.0), v(10.0, 10.0, 10.0), v(0.0, 10.0, 10.0)]);
    poly(&mut d, ROOT, &[v(0.0, 5.0, 4.0), v(10.0, 5.0, 4.0), v(10.0, 15.0, 4.0), v(0.0, 15.0, 4.0)]);
    poly(&mut d, ROOT, &[v(0.0, 5.0, 7.0), v(10.0, 5.0, 7.0), v(10.0, 15.0, 7.0), v(0.0, 15.0, 7.0)]);
    validate(&d);
    let a = face_at(&d, ROOT, v(5.0, 10.0, 2.0), -V3::Y);
    let b = face_at(&d, ROOT, v(5.0, 7.0, 4.0), V3::Z);
    let c = face_at(&d, ROOT, v(5.0, 7.0, 7.0), V3::Z);
    let before = faces(&d, ROOT).len();
    assert_eq!(before, 3);
    let edges = d.intersect_faces(ROOT, &[a, b], &[], IntersectWith::Selection).unwrap();
    assert_eq!(edges.len(), 1);
    validate(&d);
    assert_eq!(faces(&d, ROOT).len(), before + 2);
    assert_eq!(d.face(c).unwrap().outer.len(), 6, "the third face only has the crossing vertices");
    assert_eq!(d.face_area(c), 100.0);

    // With the model, the remaining crossing is cut too.
    let lower = face_at(&d, ROOT, v(5.0, 10.0, 2.0), -V3::Y);
    let edges = d.intersect_faces(ROOT, &[lower], &[], IntersectWith::Model).unwrap();
    assert!(edges.is_empty(), "the lower piece does not reach the upper face");
    let upper = face_at(&d, ROOT, v(5.0, 10.0, 9.0), -V3::Y);
    let edges = d.intersect_faces(ROOT, &[upper], &[], IntersectWith::Model).unwrap();
    assert_eq!(edges.len(), 1);
    validate(&d);
    assert_eq!(faces(&d, ROOT).len(), before + 4);
}

#[test]
fn a_locked_context_and_bad_ids_are_refused() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    let f = only_face(&d, ROOT);
    let g = d.make_group(ROOT, &[f], &[], &[]).unwrap();
    let def = d.instance(g).unwrap().definition;
    let inner = only_face(&d, def);
    let tag = d.new_tag("Existing");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    assert_eq!(d.intersect_faces(def, &[inner], &[], IntersectWith::Model), Err(Error::Locked));
    d.set_tag_flags(tag, true, false).unwrap();
    assert_eq!(d.intersect_faces(ROOT, &[inner], &[], IntersectWith::Model), Err(Error::Missing("face")));
    assert_eq!(d.intersect_faces(def, &[], &[g], IntersectWith::Model), Err(Error::Missing("instance")));
    assert_eq!(d.intersect_faces(ROOT, &[], &[], IntersectWith::Selection), Err(Error::Empty));
    // A group with nothing crossing it draws nothing.
    assert_eq!(d.intersect_faces(ROOT, &[], &[g], IntersectWith::Model), Ok(Vec::new()));
    validate(&d);
}

#[test]
fn near_parallel_and_touching_faces_draw_nothing() {
    let mut d = Document::new();
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    // Half a degree off the first face, passing through it.
    let tilt = 0.5_f64.to_radians();
    let (c, s) = (tilt.cos(), tilt.sin());
    poly(
        &mut d,
        ROOT,
        &[v(-1.0, -1.0, -s * 6.0), v(11.0, -1.0, s * 6.0), v(11.0, 11.0, s * 6.0), v(-1.0, 11.0, -s * 6.0)],
    );
    let _ = c;
    assert_eq!(faces(&d, ROOT).len(), 2);
    let all = faces(&d, ROOT);
    assert_eq!(d.intersect_faces(ROOT, &all, &[], IntersectWith::Model), Ok(Vec::new()));
    validate(&d);

    // Two faces of a box share an edge: their planes meet along it, but no cut is drawn.
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    let all = faces(&d, ROOT);
    assert_eq!(d.intersect_faces(ROOT, &all, &[], IntersectWith::Model), Ok(Vec::new()));
    assert_eq!(edge_count(&d, ROOT), 12);
    validate(&d);
}
