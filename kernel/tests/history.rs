mod common;
use builder_kernel::*;
use common::*;

#[test]
fn undo_and_redo_walk_through_transactions() {
    let mut d = Document::new();
    let empty = d.to_json();
    d.begin("Rectangle");
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.commit();
    let one = d.to_json();
    d.begin("Push/Pull");
    let f = only_face(&d, ROOT);
    d.push_pull(f, -5.0).unwrap();
    d.commit();
    let two = d.to_json();

    assert_eq!(d.undo_name(), Some("Push/Pull"));
    assert_eq!(d.undo().as_deref(), Some("Push/Pull"));
    assert_eq!(d.to_json(), one);
    assert_eq!(d.undo().as_deref(), Some("Rectangle"));
    assert_eq!(d.to_json(), empty);
    assert!(!d.can_undo());
    assert!(d.undo().is_none());
    d.redo();
    d.redo();
    assert_eq!(d.to_json(), two);
    assert!(!d.can_redo());
    validate(&d);
}

#[test]
fn a_new_edit_clears_redo() {
    let mut d = Document::new();
    d.begin("Line");
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(1.0, 0.0, 0.0)).unwrap();
    d.commit();
    d.undo();
    assert!(d.can_redo());
    d.begin("Line");
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(0.0, 1.0, 0.0)).unwrap();
    d.commit();
    assert!(!d.can_redo());
}

#[test]
fn empty_transactions_are_not_recorded() {
    let mut d = Document::new();
    d.begin("Nothing");
    assert!(!d.commit());
    assert!(!d.can_undo());
}

#[test]
fn ids_are_stable_across_undo_and_redo() {
    let mut d = Document::new();
    d.begin("Rectangle");
    rect_xy(&mut d, ROOT, 0.0, 0.0, 10.0, 10.0, 0.0);
    d.commit();
    let f = only_face(&d, ROOT);
    d.undo();
    assert!(d.face(f).is_none());
    d.redo();
    assert!(d.face(f).is_some());
    // New entities never reuse ids, even after undo.
    d.undo();
    d.begin("Line");
    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(1.0, 0.0, 0.0)).unwrap();
    d.commit();
    assert!(e[0].0 >= 4, "edge ids keep counting up");
}
