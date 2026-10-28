//! The randomized kernel test: thousands of mixed operations with `validate` after
//! each. A failure prints the seed, the step, the panic and a shrunk, pasteable
//! regression test. See docs/architecture.md § Build, test and run.
mod common;
use builder_kernel::*;
use common::fuzz::*;
use std::time::Instant;

/// Generate `steps` ops from `seed`, validating after each; on a failure (generation
/// stops at the failing op), replay for the message, shrink and panic with the replay
/// as a test body.
fn fuzz(seed: u64, steps: usize) {
    let mut rng = Rng::new(seed);
    let mut doc = Document::new();
    let ops = generate(&mut rng, steps, &mut doc);
    if ops.len() == steps {
        return;
    }
    if let Err((i, message)) = run(&ops) {
        let head = format!("seed={seed:#x} steps={steps} failed at op {i}: {message}");
        eprintln!("{head}");
        eprintln!("{:?}", ops[i]);
        let short = shrink(ops);
        let body = render_test(&format!("shrunk_seed_{seed:#x}"), &short);
        eprintln!("shrunk to {} ops:\n{body}", short.len());
        panic!("{head}\n{body}");
    }
}

/// CI: a fixed seed and step count, under a minute in a debug build (about 22 s
/// here; 2,000 steps took 29.5 s, too close to the 30 s headroom rule).
#[test]
fn random_operations_keep_invariants() {
    let t = Instant::now();
    fuzz(0x5eed_2026, 1_500);
    let elapsed = t.elapsed();
    eprintln!("fuzz: 1500 steps in {elapsed:?}");
    assert!(elapsed.as_secs() < 60, "fuzz run took {elapsed:?}");
}

/// Nightly use: `cargo test -p builder-kernel --test fuzz -- --ignored`, seed from
/// `BUILDER_FUZZ_SEED` (default 1).
#[test]
#[ignore]
fn random_operations_long() {
    let seed = std::env::var("BUILDER_FUZZ_SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(1);
    fuzz(seed, 50_000);
}
