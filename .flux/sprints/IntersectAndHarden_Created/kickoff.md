# Sprint Kickoff: IntersectAndHarden

**Captured from conversation:** 2026-10-28

## Context

Two faces that cross each other (a roof plane through a wall, a beam through a post) have no way to cut each other: healing only runs within one plane. The kernel's tests are hand-written cases; nothing exercises random sequences of operations, and a user whose operation fails has no way to send the model. Milestone 1 sprint 1.3 in `docs/sprints.md`, third of four sprints planned on 2026-10-28, to be executed by a Claude Code cloud session.

## Decisions

- **Kernel first, UI thin:** Intersect Faces is a `Document` method with kernel tests; the app adds a menu and context-menu entry that calls it over wasm. The randomized test and model check are kernel-only.
- **Randomized test runs in CI at a fixed step count:** `cargo test` gets a deterministic, seeded fuzz test (fixed steps so CI time stays bounded); a longer run is an `--ignored` test or an example for nightly use.
- **Failures reduce to a replayable script:** the fuzz test records the operation list and, on an invariant failure, shrinks it and prints a script that becomes a regression test.
- **Report a problem is a file download:** model JSON plus the journal's last operations, saved by the app, no network.

## Scope

**In scope:**

- `intersect_faces(ctx, faces, with: Model | Selection)`: everywhere two faces cross, add the intersection segment as edges to both faces' planes and heal, so both faces split.
- A line that pierces a face (not lying in it) cuts the face where it passes through: a vertex on the face at the piercing point, welded into the face's plane.
- Menu and context-menu entries in the app; keyboard-free is fine.
- Randomized kernel test: thousands of mixed operations (draw, push/pull, move, erase, group, undo, redo) with `validate` after each step; shrinking to a short script on failure; every bug it finds this sprint gets a regression test.
- "Report a problem" action in the app: on a failed operation, offer to download the model and the recent journal.
- Model check: a kernel function (and `kernel/examples/validate.rs` extension) that reports overlapping edges, non-planar faces, edges with no faces, and duplicate vertices in a loaded file; exposed in the app as a command that lists the findings.
- Browser walkthrough of the shed test project (10' × 8' shed, gable roof as a separate group intersected with the walls, door and window cut through, close the tab and recover) recorded in `docs/`.

**Out of scope:**

- Solid tools (union, subtract): need a manifold boolean library; Later tier.
- Exact arithmetic across the kernel: only what intersection needs (see Open Questions).
- Autosave itself (1.1) and move welding (1.2); this sprint's walkthrough relies on both being merged.

## Technical Approach

- Intersection: for each pair of candidate faces (bbox overlap, non-parallel planes) clip the plane–plane line to each face's region (`face_region_contains`, `interior_point` helpers in heal.rs) to get the common segment; insert it with `insert_segment` into each face's definition and heal both planes with `heal_around`. With-selection restricts pairs to the selection; with-model pairs selection against everything in the context.
- Piercing: in `add_line` / `insert_segment`, test the segment against faces it crosses, split the segment at the piercing point and add that vertex to the face's plane so healing splits it.
- Fuzz: a `kernel/tests/fuzz.rs` with a small seeded RNG (no new crate if `rand` is not already a dependency), an operation enum, a generator that picks valid targets from the current document, `validate` after each step, and a delta-debugging shrinker over the operation list.
- Model check lives in `kernel/src/check.rs` returning a list of findings with ids and positions; `validate.rs` prints them; wasm exposes it; the app lists them in a flash or dialog.

## Open Questions

- How much robust-predicate arithmetic plane–plane intersection needs to be reliable at `tol::LENGTH`; whether existing `tol.rs` epsilons suffice.
- Steps per CI fuzz run versus a nightly `--ignored` run; target under a minute in CI.
- Whether the shrinker is worth writing this sprint or a printed seed plus step count is enough to replay.
- Context rules: intersect within one group's definition only, or across the open context and its children.

## References

- `docs/sprints.md` § Sprint 1.3, `docs/roadmap.md` 1.3 and 1.5
- `kernel/src/heal.rs` (`heal`, `arrangement`, `face_region_contains`, `interior_point`), `kernel/src/line.rs` (`insert_segment`, `heal_around`), `kernel/src/tol.rs`, `kernel/src/math.rs`
- `kernel/tests/common/mod.rs` `validate`, `kernel/examples/validate.rs`, `kernel/examples/bench.rs`
- `app/src/app.ts` (menu buttons, `flash`, `save`), `kernel-wasm/src/lib.rs`
- `docs/architecture.md` § tests and § picking
