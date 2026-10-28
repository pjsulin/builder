//! Replays of sequences the randomized test (`tests/fuzz.rs`) found, one test per
//! bug, each the `render_test` output with its seed. Add a new one by pasting the
//! body a failing fuzz run prints.
mod common;
use builder_kernel::*;
use common::fuzz::*;
use common::*;

/// seed 0x5eed2026, op 222: moving a face that shares edges with a coplanar
/// neighbour folded the neighbour, and the folded pieces' loops repeated a vertex.
#[test]
fn move_of_a_face_beside_a_coplanar_neighbour() {
    let mut d = Document::new();
    let ops = [
        Op::Rect { x0: 77.0, y0: 104.0, x1: 14.0, y1: 5.0, z: 0.0 },
        Op::Line { a: V3::new(69.0, 6.746031746031746, 0.0), b: V3::new(119.0, 6.746031746031746, 0.0) },
        Op::Rect { x0: 105.0, y0: 18.0, x1: 54.0, y1: 16.0, z: 0.0 },
        Op::Rect { x0: 41.0, y0: 43.0, x1: 2.0, y1: 1.0, z: 0.0 },
        Op::MoveFace {
            point: V3::new(6.0, 29.0, 0.0),
            normal: V3::new(-0.0, -0.0, -1.0),
            offset: V3::new(0.0, 0.0, -1.0),
        },
    ];
    for op in &ops {
        apply(&mut d, op).ok();
        validate(&d);
    }
}

/// seed 0x5eed2026, op 216: after push/pulls, moves and intersections around a
/// thin slab, moving a face down by an inch left a face loop repeating a vertex.
#[test]
fn move_onto_geometry_after_intersections() {
    let mut d = Document::new();
    let ops = [
        Op::Rect { x0: 43.0, y0: 113.0, x1: 75.0, y1: 114.0, z: 113.0 },
        Op::PushPull {
            point: V3::new(64.33333333333333, 113.33333333333333, 113.0),
            normal: V3::new(0.0, 0.0, 1.0),
            distance: -32.0,
        },
        Op::EraseEdge { point: V3::new(75.0, 113.5, 81.0) },
        Op::PushPull {
            point: V3::new(67.0, 113.0, 91.66666666666667),
            normal: V3::new(0.0, -1.0, 0.0),
            distance: -10.0,
        },
        Op::MoveFace {
            point: V3::new(59.0, 116.66666666666667, 81.0),
            normal: V3::new(0.0, 0.0, 1.0),
            offset: V3::new(3.0, 0.0, 0.0),
        },
        Op::PushPull {
            point: V3::new(61.0, 114.0, 91.66666666666667),
            normal: V3::new(0.0, 1.0, 0.0),
            distance: 6.0,
        },
        Op::PushPull { point: V3::new(67.0, 122.0, 113.0), normal: V3::new(0.0, 0.0, -1.0), distance: -14.0 },
        Op::MoveFace {
            point: V3::new(76.00000000000001, 120.99999999999997, 102.3333333333333),
            normal: V3::new(-0.9956342260592881, 0.0, -0.09334070869305826),
            offset: V3::new(-1.0, 0.0, 0.0),
        },
        Op::PushPull {
            point: V3::new(69.0, 113.0, 91.66666666666667),
            normal: V3::new(-0.0, -1.0, -0.0),
            distance: -29.0,
        },
        Op::Intersect,
        Op::GroupFace {
            point: V3::new(75.33333333333334, 117.66666666666667, 102.33333333333334),
            normal: V3::new(-0.9857134818684251, -0.1408162116954893, -0.09241063892516485),
        },
        Op::MoveFace {
            point: V3::new(74.33333333333334, 121.0, 117.66666666666667),
            normal: V3::new(-0.997458699830735, 0.0, 0.07124704998790965),
            offset: V3::new(10.0, 0.0, 0.0),
        },
        Op::PushPull {
            point: V3::new(67.0, 117.66666666666667, 113.0),
            normal: V3::new(0.0, 0.0, -1.0),
            distance: 32.0,
        },
        Op::PushPull {
            point: V3::new(78.00000000000003, 115.33333333333336, 102.33333333333337),
            normal: V3::new(0.6139406135149204, -0.7893522173763263, -3.115936022293757e-16),
            distance: 29.0,
        },
        Op::PushPull {
            point: V3::new(67.66666666666667, 120.0, 102.33333333333333),
            normal: V3::new(0.0, 1.0, 0.0),
            distance: -31.0,
        },
        Op::PushPull {
            point: V3::new(61.66666666666668, 97.0, 81.00000000000001),
            normal: V3::new(1.5944858025472093e-16, 0.0, 1.0),
            distance: 9.0,
        },
        Op::Intersect,
        Op::EraseEdge { point: V3::new(76.0, 111.71428571428575, 90.0) },
        Op::MoveFace {
            point: V3::new(84.33333333333333, 120.0, 125.66666666666667),
            normal: V3::new(0.0, 1.0, 0.0),
            offset: V3::new(0.0, 0.0, -1.0),
        },
    ];
    for op in &ops {
        apply(&mut d, op).ok();
        validate(&d);
    }
}
