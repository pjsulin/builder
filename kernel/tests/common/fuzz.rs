//! The randomized kernel test's harness: a seeded RNG, geometric operations, a
//! generator that picks live targets, a runner that validates after every step,
//! a delta-debugging shrinker and a renderer that prints a failing sequence as a
//! regression test. Shared by `tests/fuzz.rs` and `tests/fuzz_regressions.rs`.

use builder_kernel::*;
use std::panic::{catch_unwind, AssertUnwindSafe};

use super::validate;

/// xorshift64*: deterministic, no dependency.
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Rng {
        Rng(if seed == 0 { 0x9e37_79b9_7f4a_7c15 } else { seed })
    }
    pub fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }
    /// `[0, 1)`.
    pub fn f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
    /// An integer in `[lo, hi]`.
    pub fn range(&mut self, lo: i64, hi: i64) -> i64 {
        lo + (self.next_u64() % ((hi - lo + 1) as u64)) as i64
    }
    pub fn choose<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
        if items.is_empty() {
            None
        } else {
            Some(&items[(self.next_u64() % items.len() as u64) as usize])
        }
    }
}

/// One operation, described by geometry so that it stays meaningful after the
/// operations before it change or when a shrinker removes them.
#[derive(Clone, Debug, PartialEq)]
pub enum Op {
    Line {
        a: V3,
        b: V3,
    },
    Rect {
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        z: f64,
    },
    /// The face found by `face_containing(ROOT, point, normal)`, if any.
    PushPull {
        point: V3,
        normal: V3,
        distance: f64,
    },
    /// Vertices of the face found as above, moved by `offset`.
    MoveFace {
        point: V3,
        normal: V3,
        offset: V3,
    },
    EraseFace {
        point: V3,
        normal: V3,
    },
    /// The edge whose midpoint is nearest `point` within `tol::LENGTH * 10`.
    EraseEdge {
        point: V3,
    },
    /// Group the face found as above, with its edges.
    GroupFace {
        point: V3,
        normal: V3,
    },
    /// Intersect every face of ROOT with the model.
    Intersect,
    Undo,
    Redo,
}

impl Op {
    fn name(&self) -> &'static str {
        match self {
            Op::Line { .. } => "Line",
            Op::Rect { .. } => "Rectangle",
            Op::PushPull { .. } => "Push/Pull",
            Op::MoveFace { .. } => "Move",
            Op::EraseFace { .. } | Op::EraseEdge { .. } => "Erase",
            Op::GroupFace { .. } => "Make Group",
            Op::Intersect => "Intersect Faces",
            Op::Undo => "Undo",
            Op::Redo => "Redo",
        }
    }
}

fn nearest_edge(doc: &Document, p: V3) -> Option<EId> {
    doc.edges_in(ROOT)
        .map(|(id, e)| (id, doc.pos(e.v[0]).lerp(doc.pos(e.v[1]), 0.5).dist(p)))
        .filter(|&(_, d)| d <= tol::LENGTH * 10.0)
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map(|(id, _)| id)
}

/// Apply one op inside a transaction. Ops whose target no longer exists are skipped
/// (return `Ok(false)`); a kernel `Error` is tolerated and aborts the transaction;
/// a panic or a `validate` failure is the bug the test looks for.
pub fn apply(doc: &mut Document, op: &Op) -> Result<bool, Error> {
    match op {
        Op::Undo => return Ok(doc.undo().is_some()),
        Op::Redo => return Ok(doc.redo().is_some()),
        _ => {}
    }
    let face = |doc: &Document, point: V3, normal: V3| doc.face_containing(ROOT, point, normal);
    doc.begin(op.name());
    let result: Result<bool, Error> = (|| match *op {
        Op::Line { a, b } => doc.add_line(ROOT, a, b).map(|_| true),
        Op::Rect { x0, y0, x1, y1, z } => {
            let p = [V3::new(x0, y0, z), V3::new(x1, y0, z), V3::new(x1, y1, z), V3::new(x0, y1, z)];
            for i in 0..4 {
                doc.add_line(ROOT, p[i], p[(i + 1) % 4])?;
            }
            Ok(true)
        }
        Op::PushPull { point, normal, distance } => match face(doc, point, normal) {
            Some(f) => doc.push_pull(f, distance).map(|_| true),
            None => Ok(false),
        },
        Op::MoveFace { point, normal, offset } => match face(doc, point, normal) {
            Some(f) => {
                let verts = doc.vertices_of(&[f], &[]);
                doc.move_and_integrate(&verts, offset).map(|_| true)
            }
            None => Ok(false),
        },
        Op::EraseFace { point, normal } => match face(doc, point, normal) {
            Some(f) => doc.erase(&[f], &[]).map(|_| true),
            None => Ok(false),
        },
        Op::EraseEdge { point } => match nearest_edge(doc, point) {
            Some(e) => doc.erase(&[], &[e]).map(|_| true),
            None => Ok(false),
        },
        Op::GroupFace { point, normal } => match face(doc, point, normal) {
            Some(f) => doc.make_group(ROOT, &[f], &[], &[]).map(|_| true),
            None => Ok(false),
        },
        Op::Intersect => {
            let faces: Vec<FId> = doc.faces_in(ROOT).map(|(id, _)| id).collect();
            if faces.is_empty() {
                Ok(false)
            } else {
                doc.intersect_faces(ROOT, &faces, &[], IntersectWith::Model).map(|_| true)
            }
        }
        Op::Undo | Op::Redo => unreachable!(),
    })();
    match result {
        Ok(did) => {
            doc.commit();
            Ok(did)
        }
        Err(e) => {
            doc.abort();
            Err(e)
        }
    }
}

/// A whole-inch coordinate in `[0, 120]`.
fn grid(rng: &mut Rng) -> f64 {
    rng.range(0, 120) as f64
}

/// A random live face of ROOT as (interior point, normal).
fn pick_face(rng: &mut Rng, doc: &Document) -> Option<(V3, V3)> {
    let faces: Vec<FId> = doc.faces_in(ROOT).map(|(id, _)| id).collect();
    let f = *rng.choose(&faces)?;
    let point = doc.face_interior_point(f)?;
    Some((point, doc.face_normal(f)?))
}

/// Generate `steps` ops, grid-aligned to whole inches in `[0, 120]`, applying each to
/// `doc` so that later ops can target what exists. Once the document holds more than
/// ~300 edges only erases and undos are generated until it is smaller again, and
/// Intersect (which can add hundreds of edges at once) only runs under 150 edges;
/// without that the model grows without bound and every step slows down with it.
/// Generation stops early when a step panics; the returned ops then end with the
/// failing one, and `run` reproduces it.
pub fn generate(rng: &mut Rng, steps: usize, doc: &mut Document) -> Vec<Op> {
    let mut ops = Vec::with_capacity(steps);
    let trace = std::env::var_os("BUILDER_FUZZ_TRACE").is_some();
    let started = std::time::Instant::now();
    for step in 0..steps {
        if trace && step % 100 == 0 {
            eprintln!(
                "step {step}: {} faces, {} edges, {} instances, {:?}",
                doc.faces.count(),
                doc.edges.count(),
                doc.instances.count(),
                started.elapsed()
            );
        }
        let edges = doc.edges_in(ROOT).count();
        let crowded = edges > 300;
        // Weights: line, rect, push/pull, move, erase face, erase edge, group, intersect, undo, redo.
        let weights: [i64; 10] =
            if crowded { [0, 0, 0, 0, 20, 70, 0, 0, 10, 0] } else { [12, 20, 15, 8, 6, 8, 3, 5, 4, 3] };
        let mut pick = rng.range(0, weights.iter().sum::<i64>() - 1);
        let mut take = |w: i64| {
            let hit = pick < w;
            pick -= w;
            hit
        };
        let op = if take(weights[0]) {
            // Half the lines start at an existing vertex; most are axis-aligned.
            let verts: Vec<V3> = doc.vertices_in(ROOT).map(|(_, v)| v.pos).collect();
            let a = match rng.choose(&verts) {
                Some(&p) if rng.f64() < 0.5 => p,
                _ => V3::new(grid(rng), grid(rng), grid(rng)),
            };
            let b = if rng.f64() < 0.7 {
                let mut b = a;
                let d = grid(rng);
                match rng.range(0, 2) {
                    0 => b.x = d,
                    1 => b.y = d,
                    _ => b.z = d,
                }
                b
            } else {
                V3::new(grid(rng), grid(rng), grid(rng))
            };
            Op::Line { a, b }
        } else if take(weights[1]) {
            let z = if rng.f64() < 0.6 { 0.0 } else { grid(rng) };
            Op::Rect { x0: grid(rng), y0: grid(rng), x1: grid(rng), y1: grid(rng), z }
        } else if take(weights[2]) {
            match pick_face(rng, doc) {
                Some((point, normal)) => {
                    let mut distance = rng.range(-36, 36) as f64;
                    if distance == 0.0 {
                        distance = 6.0;
                    }
                    Op::PushPull { point, normal, distance }
                }
                None => Op::Rect { x0: grid(rng), y0: grid(rng), x1: grid(rng), y1: grid(rng), z: 0.0 },
            }
        } else if take(weights[3]) {
            match pick_face(rng, doc) {
                Some((point, normal)) => {
                    let mut d = rng.range(-12, 12) as f64;
                    if d == 0.0 {
                        d = 3.0;
                    }
                    let offset = if rng.f64() < 0.8 {
                        match rng.range(0, 2) {
                            0 => V3::new(d, 0.0, 0.0),
                            1 => V3::new(0.0, d, 0.0),
                            _ => V3::new(0.0, 0.0, d),
                        }
                    } else {
                        V3::new(d, rng.range(-12, 12) as f64, rng.range(-12, 12) as f64)
                    };
                    Op::MoveFace { point, normal, offset }
                }
                None => {
                    Op::Line { a: V3::new(grid(rng), grid(rng), 0.0), b: V3::new(grid(rng), grid(rng), 0.0) }
                }
            }
        } else if take(weights[4]) || take(weights[5]) {
            // The face slot erases a face when there is one; otherwise, and for the
            // edge slot, a random edge goes.
            let face_slot = pick + weights[5] < 0;
            let mids: Vec<V3> =
                doc.edges_in(ROOT).map(|(_, e)| doc.pos(e.v[0]).lerp(doc.pos(e.v[1]), 0.5)).collect();
            match (face_slot.then(|| pick_face(rng, doc)).flatten(), rng.choose(&mids)) {
                (Some((point, normal)), _) => Op::EraseFace { point, normal },
                (None, Some(&point)) => Op::EraseEdge { point },
                (None, None) => Op::Undo,
            }
        } else if take(weights[6]) {
            match pick_face(rng, doc) {
                Some((point, normal)) => Op::GroupFace { point, normal },
                None => Op::Redo,
            }
        } else if take(weights[7]) {
            if edges <= 250 {
                Op::Intersect
            } else {
                Op::Line { a: V3::new(grid(rng), grid(rng), 0.0), b: V3::new(grid(rng), grid(rng), 0.0) }
            }
        } else if take(weights[8]) {
            Op::Undo
        } else {
            Op::Redo
        };
        if trace {
            eprintln!("op {step}: {op:?}");
        }
        let ok = catch_unwind(AssertUnwindSafe(|| {
            apply(doc, &op).ok();
            validate(doc);
        }))
        .is_ok();
        ops.push(op);
        if !ok {
            break;
        }
    }
    ops
}

fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "panic".to_string()
    }
}

/// Run ops on a fresh document, validating after each. `Err` carries the index of
/// the failing op and the panic message.
pub fn run(ops: &[Op]) -> Result<(), (usize, String)> {
    let mut doc = Document::new();
    for (i, op) in ops.iter().enumerate() {
        let r = catch_unwind(AssertUnwindSafe(|| {
            apply(&mut doc, op).ok();
            validate(&doc);
        }));
        if let Err(payload) = r {
            return Err((i, panic_message(payload)));
        }
    }
    Ok(())
}

/// Run with the panic hook silenced, so a shrinker's many expected failures do not
/// flood the output.
fn fails_quietly(ops: &[Op]) -> bool {
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let failed = run(ops).is_err();
    std::panic::set_hook(hook);
    failed
}

/// Delta debugging (ddmin): a short subsequence of `ops`, in their order, that still
/// fails. Starts from the prefix ending at the failing op.
pub fn shrink(ops: Vec<Op>) -> Vec<Op> {
    let mut ops = match run(&ops) {
        Err((i, _)) => ops[..=i].to_vec(),
        Ok(()) => return ops,
    };
    let mut n = 2;
    while ops.len() >= 2 {
        let chunk = ops.len().div_ceil(n);
        let mut reduced = false;
        let mut start = 0;
        while start < ops.len() {
            let end = (start + chunk).min(ops.len());
            let mut candidate = ops[..start].to_vec();
            candidate.extend_from_slice(&ops[end..]);
            if !candidate.is_empty() && fails_quietly(&candidate) {
                ops = candidate;
                n = (n - 1).max(2);
                reduced = true;
                break;
            }
            start = end;
        }
        if !reduced {
            if n >= ops.len() {
                break;
            }
            n = (n * 2).min(ops.len());
        }
    }
    ops
}

fn v3(p: V3) -> String {
    format!("V3::new({:?}, {:?}, {:?})", p.x, p.y, p.z)
}

fn render_op(op: &Op) -> String {
    match *op {
        Op::Line { a, b } => format!("Op::Line {{ a: {}, b: {} }}", v3(a), v3(b)),
        Op::Rect { x0, y0, x1, y1, z } => {
            format!("Op::Rect {{ x0: {x0:?}, y0: {y0:?}, x1: {x1:?}, y1: {y1:?}, z: {z:?} }}")
        }
        Op::PushPull { point, normal, distance } => {
            format!("Op::PushPull {{ point: {}, normal: {}, distance: {distance:?} }}", v3(point), v3(normal))
        }
        Op::MoveFace { point, normal, offset } => {
            format!("Op::MoveFace {{ point: {}, normal: {}, offset: {} }}", v3(point), v3(normal), v3(offset))
        }
        Op::EraseFace { point, normal } => {
            format!("Op::EraseFace {{ point: {}, normal: {} }}", v3(point), v3(normal))
        }
        Op::EraseEdge { point } => format!("Op::EraseEdge {{ point: {} }}", v3(point)),
        Op::GroupFace { point, normal } => {
            format!("Op::GroupFace {{ point: {}, normal: {} }}", v3(point), v3(normal))
        }
        Op::Intersect => "Op::Intersect".to_string(),
        Op::Undo => "Op::Undo".to_string(),
        Op::Redo => "Op::Redo".to_string(),
    }
}

/// A Rust test body replaying `ops`, ready to paste into fuzz_regressions.rs.
pub fn render_test(name: &str, ops: &[Op]) -> String {
    let mut s = format!("#[test]\nfn {name}() {{\n    let mut d = Document::new();\n    let ops = [\n");
    for op in ops {
        s.push_str(&format!("        {},\n", render_op(op)));
    }
    s.push_str(
        "    ];\n    for op in &ops {\n        apply(&mut d, op).ok();\n        validate(&d);\n    }\n}\n",
    );
    s
}
