mod common;
use builder_kernel::check::{check, FindingKind};
use builder_kernel::*;
use common::*;

fn guide_ids(d: &Document, ctx: DefId) -> Vec<GuideId> {
    d.guides_in(ctx).map(|(id, _)| id).collect()
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
fn a_line_and_a_point_are_created_erased_undone_and_redone() {
    let mut d = Document::new();
    d.begin("guides");
    let line = d.add_guide_line(ROOT, v(48.0, 0.0, 0.0), v(0.0, 2.0, 0.0)).unwrap();
    let point = d.add_guide_point(ROOT, v(0.0, 24.0, 0.0)).unwrap();
    d.commit();
    assert_eq!(
        d.guide(line),
        Some(&Guide { owner: ROOT, shape: GuideShape::Line { origin: v(48.0, 0.0, 0.0), dir: V3::Y } }),
        "the direction is stored unit"
    );
    assert_eq!(
        d.guide(point),
        Some(&Guide { owner: ROOT, shape: GuideShape::Point { pos: v(0.0, 24.0, 0.0) } })
    );
    assert_eq!(guide_ids(&d, ROOT), vec![line, point]);
    assert!(d.guides_visible());
    validate(&d);

    d.begin("erase");
    d.erase_guides(&[line]).unwrap();
    d.commit();
    assert_eq!(guide_ids(&d, ROOT), vec![point]);
    assert_eq!(d.undo(), Some("erase".into()));
    assert_eq!(guide_ids(&d, ROOT), vec![line, point]);
    assert_eq!(d.undo(), Some("guides".into()));
    assert!(guide_ids(&d, ROOT).is_empty());
    d.redo();
    assert_eq!(guide_ids(&d, ROOT), vec![line, point]);
    d.redo();
    assert_eq!(guide_ids(&d, ROOT), vec![point]);
    assert_eq!(d.erase_guides(&[line]), Err(Error::Missing("guide")));
    validate(&d);
}

#[test]
fn visibility_is_journaled() {
    let mut d = Document::new();
    d.begin("Guides");
    d.set_guides_visible(false);
    assert!(d.commit());
    assert!(!d.guides_visible());
    d.undo();
    assert!(d.guides_visible());
    d.redo();
    assert!(!d.guides_visible());
}

#[test]
fn erase_all_is_one_entry_and_leaves_locked_owners_guides() {
    let mut d = Document::new();
    let g = grouped_box(&mut d);
    let def = d.instance(g).unwrap().definition;
    d.begin("guides");
    d.add_guide_line(ROOT, V3::ZERO, V3::X).unwrap();
    d.add_guide_point(ROOT, v(1.0, 1.0, 1.0)).unwrap();
    let inside = d.add_guide_point(def, v(5.0, 5.0, 10.0)).unwrap();
    d.commit();
    assert_eq!(
        d.guide(inside).unwrap().owner,
        def,
        "a guide drawn inside a group is owned by its definition"
    );
    let tag = d.new_tag("Existing");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    d.commit();

    d.begin("Delete Guides");
    assert_eq!(d.erase_all_guides(), 2);
    assert!(d.commit());
    assert!(guide_ids(&d, ROOT).is_empty());
    assert_eq!(guide_ids(&d, def), vec![inside]);
    assert_eq!(d.undo(), Some("Delete Guides".into()));
    assert_eq!(d.guides.count(), 3);
    validate(&d);
}

#[test]
fn a_locked_owner_refuses() {
    let mut d = Document::new();
    let g = grouped_box(&mut d);
    let def = d.instance(g).unwrap().definition;
    d.begin("guide");
    let inside = d.add_guide_point(def, v(5.0, 5.0, 10.0)).unwrap();
    d.commit();
    let tag = d.new_tag("Existing");
    d.set_tag(g, Some(tag)).unwrap();
    d.set_tag_flags(tag, true, true).unwrap();
    d.commit();

    d.begin("edits");
    assert_eq!(d.add_guide_line(def, V3::ZERO, V3::X), Err(Error::Locked));
    assert_eq!(d.add_guide_point(def, V3::ZERO), Err(Error::Locked));
    assert_eq!(d.erase_guides(&[inside]), Err(Error::Locked));
    assert!(!d.commit(), "nothing was written");
    assert!(d.guide(inside).is_some());
    // Loose guides outside the locked group are still editable.
    d.begin("outside");
    d.add_guide_point(ROOT, V3::ZERO).unwrap();
    assert!(d.commit());
}

#[test]
fn a_zero_direction_and_a_missing_owner_are_refused() {
    let mut d = Document::new();
    assert_eq!(d.add_guide_line(ROOT, V3::ZERO, V3::ZERO), Err(Error::Degenerate("guide direction")));
    assert_eq!(d.add_guide_line(DefId(7), V3::ZERO, V3::X), Err(Error::Missing("definition")));
    assert_eq!(d.add_guide_point(DefId(7), V3::ZERO), Err(Error::Missing("definition")));
    assert_eq!(d.guides.count(), 0);
}

#[test]
fn check_reports_a_planted_bad_guide() {
    let mut d = Document::new();
    make_box(&mut d, 10.0, 10.0, 10.0);
    d.add_guide_line(ROOT, V3::ZERO, V3::X).unwrap();
    assert_eq!(check(&d), Vec::new());
    // Raw setters, as a file from another tool could carry.
    let orphan = d.next_guide();
    d.set_guide(orphan, Some(Guide { owner: DefId(9), shape: GuideShape::Point { pos: v(1.0, 2.0, 3.0) } }));
    let skewed = d.next_guide();
    d.set_guide(
        skewed,
        Some(Guide { owner: ROOT, shape: GuideShape::Line { origin: V3::ZERO, dir: v(0.0, 2.0, 0.0) } }),
    );
    let findings = check(&d);
    assert_eq!(
        findings.iter().map(|f| f.kind).collect::<Vec<_>>(),
        vec![FindingKind::BadGuide, FindingKind::BadGuide]
    );
    assert_eq!(findings[0].guides, vec![orphan]);
    assert_eq!(findings[0].owner, DefId(9));
    assert_eq!(findings[0].position, v(1.0, 2.0, 3.0));
    assert_eq!(findings[1].guides, vec![skewed]);
    assert_eq!(
        findings[0].to_string(),
        format!("bad_guide in definition 9 at (1, 2, 3): guides {}", orphan.0)
    );
}
