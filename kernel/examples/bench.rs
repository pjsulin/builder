//! Rough timings on the 2,000-box stress model: `cargo run --release --example bench`.
use builder_kernel::*;
use std::time::Instant;

fn main() {
    let mut d = Document::new();
    let mut seed: u64 = 7;
    let mut rnd = || {
        seed = (seed * 16807) % 2147483647;
        seed as f64 / 2147483647.0
    };
    let t = Instant::now();
    let mut tops = Vec::new();
    for i in 0..40 {
        for j in 0..50 {
            let (x0, y0) = (i as f64 * 44.0, j as f64 * 44.0);
            let h = 12.0 + (rnd() * 14.0).floor() * 12.0;
            let p = V3::new;
            let v: Vec<VId> = [(0.0, 0.0), (32.0, 0.0), (32.0, 32.0), (0.0, 32.0)]
                .iter()
                .flat_map(|&(dx, dy)| [p(x0 + dx, y0 + dy, 0.0), p(x0 + dx, y0 + dy, h)])
                .map(|q| d.add_vertex(ROOT, q))
                .collect();
            // v: [b0,t0,b1,t1,b2,t2,b3,t3]
            let (b, tp) = ([v[0], v[2], v[4], v[6]], [v[1], v[3], v[5], v[7]]);
            d.add_face(ROOT, vec![b[0], b[3], b[2], b[1]], vec![], None).unwrap();
            tops.push(d.add_face(ROOT, tp.to_vec(), vec![], None).unwrap());
            for k in 0..4 {
                let n = (k + 1) % 4;
                d.add_face(ROOT, vec![b[k], b[n], tp[n], tp[k]], vec![], None).unwrap();
            }
        }
    }
    d.clear_history();
    println!("build: {:?}, faces {}", t.elapsed(), d.faces.count());
    let f = tops[1000];
    let t = Instant::now();
    for i in 0..10 {
        d.begin("pp");
        d.push_pull(f, 3.0 + i as f64).unwrap();
        d.abort();
    }
    println!("stretch preview: {:?} each", t.elapsed() / 10);
    let t = Instant::now();
    for _ in 0..10 {
        d.begin("line");
        d.add_line(ROOT, V3::new(-50.0, -50.0, 0.0), V3::new(-10.0, -50.0, 0.0)).unwrap();
        d.abort();
    }
    println!("add_line: {:?} each", t.elapsed() / 10);
    let t = Instant::now();
    for _ in 0..10 {
        let _ = d.face_buffers(ROOT);
    }
    println!("face buffers: {:?} each", t.elapsed() / 10);
}
