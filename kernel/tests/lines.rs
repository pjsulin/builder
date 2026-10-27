mod common;
use builder_kernel::*;
use common::*;

#[test]
fn single_line_makes_one_edge_and_no_face() {
    let mut d = Document::new();
    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(edge_count(&d, ROOT), 1);
    assert_eq!(vertex_count(&d, ROOT), 2);
    assert!(faces(&d, ROOT).is_empty());
    validate(&d);
}

#[test]
fn endpoints_weld_within_tolerance() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    d.add_line(ROOT, v(10.0004, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    assert_eq!(vertex_count(&d, ROOT), 3);
    assert_eq!(edge_count(&d, ROOT), 2);
    validate(&d);
}

#[test]
fn crossing_lines_split_each_other() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(0.0, 10.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2, "new line is cut at the crossing");
    assert_eq!(edge_count(&d, ROOT), 4);
    assert_eq!(vertex_count(&d, ROOT), 5);
    assert!(d.find_vertex(ROOT, v(5.0, 5.0, 0.0)).is_some());
    validate(&d);
}

#[test]
fn line_ending_on_an_edge_splits_it() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    d.add_line(ROOT, v(4.0, 0.0, 0.0), v(4.0, 6.0, 0.0)).unwrap();
    assert_eq!(edge_count(&d, ROOT), 3);
    assert_eq!(vertex_count(&d, ROOT), 4);
    validate(&d);
}

#[test]
fn skew_lines_in_3d_do_not_split() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 10.0, 0.0)).unwrap();
    d.add_line(ROOT, v(0.0, 10.0, 1.0), v(10.0, 0.0, 1.0)).unwrap();
    assert_eq!(edge_count(&d, ROOT), 2);
    validate(&d);
}

#[test]
fn collinear_overlap_merges_into_shared_edges() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(5.0, 0.0, 0.0), v(15.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2, "overlap reuses 5..10 and adds 10..15");
    assert_eq!(edge_count(&d, ROOT), 3);
    validate(&d);
}

#[test]
fn line_inside_an_existing_edge_splits_it_twice() {
    let mut d = Document::new();
    d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(3.0, 0.0, 0.0), v(7.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 1);
    assert_eq!(edge_count(&d, ROOT), 3);
    assert_eq!(vertex_count(&d, ROOT), 4);
    validate(&d);
}

#[test]
fn redrawing_an_edge_adds_nothing() {
    let mut d = Document::new();
    let a = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    let b = d.add_line(ROOT, v(10.0, 0.0, 0.0), v(0.0, 0.0, 0.0)).unwrap();
    assert_eq!(a, b);
    assert_eq!(edge_count(&d, ROOT), 1);
}

#[test]
fn zero_length_line_is_rejected() {
    let mut d = Document::new();
    assert!(d.add_line(ROOT, v(1.0, 1.0, 1.0), v(1.0, 1.0, 1.0005)).is_err());
    assert!(d.add_line(ROOT, v(f64::NAN, 0.0, 0.0), v(1.0, 0.0, 0.0)).is_err());
}

#[test]
fn line_through_a_vertex_is_cut_there() {
    let mut d = Document::new();
    d.add_line(ROOT, v(5.0, 0.0, 0.0), v(5.0, 5.0, 0.0)).unwrap();
    let e = d.add_line(ROOT, v(0.0, 0.0, 0.0), v(10.0, 0.0, 0.0)).unwrap();
    assert_eq!(e.len(), 2);
    validate(&d);
}
