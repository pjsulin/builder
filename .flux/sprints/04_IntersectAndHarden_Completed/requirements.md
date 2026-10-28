---
created: 2026-10-28
sprint: IntersectAndHarden
start: 480b033
started: '2026-10-28'
step: '3'
---

# Requirements: IntersectAndHarden

## Background

Healing runs within one plane (`kernel/src/heal.rs`), so two faces that cross each other never cut each other: a roof plane through a wall, a beam through a post. Users can't fix overlapping geometry. The kernel's tests are hand-written cases checked against `validate` (`kernel/tests/common/mod.rs`); nothing exercises random sequences, and a failed operation leaves the user with no way to report the model. `docs/roadmap.md` 1.3 and 1.5. Patrick's statement (2026-10-28): plan Milestone 1 sprints 1.1–1.3 and 2.1 as flux sprints for Claude Code cloud sessions; everything verifiable with cargo and npm.

## Summary

Intersect Faces cuts crossing faces into each other, piercing lines cut faces, a seeded randomized kernel test runs in CI with failures reduced to a replayable script, the app can save a problem report, and a model check reports bad geometry in loaded files.

## Goals

### Primary Goal

Overlapping shapes can be cut into each other and then pushed and erased normally.

### Secondary Goals

- The kernel holds up to random use, verified in CI.
- Bugs users hit can be reproduced from a file.

## Features

### Feature 1: Intersect Faces

**What:** `Document::intersect_faces` with model and with selection: everywhere two faces cross, the intersection segment is added as edges in the open context and every face of that context it lies in splits (faces inside instances are read, not written; repeating the command inside the group cuts them). Toolbar entries in the app; no context menu this sprint.
**Why:** Roof–wall edges and beams through posts (Background).
**Details:** Candidate pairs by bbox overlap and non-parallel planes; the plane–plane line clipped to both face regions; inserted with `insert_segment` and healed with `heal_around`. Context rule decided at plan time.
**Integration:** kernel method, wasm export, `Model` wrapper, app menu.

### Feature 2: Piercing lines cut faces

**What:** A line that passes through a face (not lying in its plane) is split at the piercing point and a vertex welded onto the face's plane there; the face itself splits when an in-plane edge passes through that vertex.
**Why:** Sprint text; needed so drawn edges and intersections agree.
**Details:** An endpoint resting on the face's plane, or a segment lying in it, is not a piercing. The piercing vertex alone does not split the face.
**Integration:** `insert_segment` / `heal_around` in line.rs.

### Feature 3: Randomized kernel test

**What:** A seeded test running thousands of mixed operations (draw, push/pull, move, erase, group, undo, redo) with `validate` after each step, fixed step count in CI, longer run `--ignored`; failures reduce to a short replayable script.
**Why:** Roadmap 1.5: find the tolerance bugs before users do.
**Details:** Every bug it finds this sprint gets a regression test.
**Integration:** `kernel/tests/fuzz.rs`; CI's `cargo test --workspace`.

### Feature 4: Report a problem

**What:** When an operation fails, the app offers to download the model JSON plus the last operations from the journal.
**Why:** Roadmap 1.5.
**Integration:** `app.ts` flash/error path; no network.

### Feature 5: Model check

**What:** A kernel function reporting overlapping edges, non-planar faces, faceless edges and duplicate vertices in a loaded document; printed by `kernel/examples/validate.rs`, exposed over wasm, listed by an app command.
**Why:** Sprint text; lets loaded files from any source be diagnosed.
**Integration:** `kernel/src/check.rs`, validate example, wasm, app.

### Feature 6: Shed walkthrough

**What:** The Milestone 1 test project done start to finish in the browser (10' × 8' shed, gable roof as a separate group intersected with the walls, door and window cut through, close the tab and recover), recorded in `docs/`.
**Why:** The milestone's exit criterion.
**Integration:** Depends on NeverLoseWork and MovesThatStick being merged.

## Success Criteria

### For Feature 1

- [x] Kernel test: a gable roof group intersected with the walls gives roof–wall edges; pushing and erasing the resulting faces works; `validate` passes. Evidence: `kernel/tests/intersect.rs::a_gable_roof_group_cuts_the_walls_it_passes_through` (6 cuts, 10 faces, push_pull and erase of the above-roof pieces, `validate` after each step).
- [x] Kernel test: intersect with selection only cuts selected pairs. Evidence: `kernel/tests/intersect.rs::with_selection_only_the_selected_pair_is_cut` (the third face keeps its area; `IntersectWith::Model` then cuts it).

### For Feature 2

- [x] Kernel test: a line through a face is split at the piercing point with one vertex on the face's plane; an in-plane line between two piercing vertices splits the face; an endpoint on the face is a touch, not a piercing. Evidence: `kernel/tests/lines.rs::a_line_through_a_face_is_cut_where_it_pierces` (2 edges, 7 vertices, then an in-plane line across the face through both piercing vertices splits it into 2 faces and 3 edges) and `an_endpoint_on_a_face_is_a_touch_not_a_piercing`.

### For Feature 3

- [x] The randomized test runs in CI at a fixed seed and step count under one minute with no invariant failure. Evidence: `kernel/tests/fuzz.rs::random_operations_keep_invariants`, seed 0x5eed2026, 1,500 steps, 22 s in a debug build on the cloud runner (2,000 took 29.5 s; Task 5.2 lowered it), asserts under 60 s; `random_operations_long` run once at seed 1, 50,000 steps: `test result: ok` in 562 s (release build).
- [x] Each bug found during the sprint has a regression test naming its seed or script. Evidence: `kernel/tests/fuzz_regressions.rs::move_of_a_face_beside_a_coplanar_neighbour` (seed 0x5eed2026 op 222, fold diagonal outside a notched face, fixed in edit.rs) and `move_onto_geometry_after_intersections` (seed 0x5eed2026 op 216, pinched hole loop, fixed in heal.rs), each the shrunk `render_test` body with the seed in its comment.

### For Feature 4

- [x] A failed operation offers a download containing the model and the last operations (headless test of the report builder). Evidence: `app/test/report.test.ts` (operations in order, error, model loads back, file name, 50-name ring); `App.offerReport` at the five catch sites downloads `buildReport` JSON after `confirm`.

### For Feature 5

- [x] `cargo run --example validate` on a file with a known non-planar face and a duplicate vertex reports both. Evidence: `cargo run -p builder-kernel --example validate -- kernel/tests/fixtures/bad.builder` prints `1 definitions, 0 instances, 0 tags: 4 problems`, two `faceless_edge`, one `overlapping_edges`, one `duplicate_vertices`, exit 1; `clean.builder` prints `: ok`, exit 0; the non-planar finding on the live document: `kernel/tests/check.rs::a_face_bent_in_memory_is_non_planar`, whose JSON the reader refuses as docs/file-format.md requires. (2026-10-28: a `.builder` reader must refuse a non-planar face, docs/file-format.md § Faces, so no file can carry one; the fixture carries a duplicate vertex, an overlapping edge and faceless edges and the example reports them all, and the non-planar finding is covered by a kernel test on the live document.)

### For Feature 6

- [ ] The shed walkthrough is recorded in `docs/` with the steps and results; Patrick repeats it in the browser. Evidence for the first half: `docs/walkthrough-shed.md`, 16 steps with the counts from the same operations run through the kernel (14 faces, 45 edges, 1 group, check clean). The browser repeat is Patrick's and is still waiting; recorded in close.md Gate 5.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `docs/architecture.md` — intersection, fuzz test, model check
- `docs/features.md` — Intersect Faces row
- `docs/roadmap.md` — 1.3, 1.5 status
- `docs/` — shed walkthrough
- `README.md` — report a problem, model check command

### ADRs

- None cited; propose one if the fuzz test adds a dependency (`rand`) or if robust predicates are adopted.

### Backlog

- #mvr7ne51 out of scope

## Scope

### In Scope

**Must Have:** Features 1, 2, 3, 5.
**Should Have:** Features 4, 6 (6 needs the other two Milestone 1 sprints merged).

### Out of Scope

- Solid tools (booleans).
- Exact arithmetic beyond what intersection needs.

### Open Questions

- Robust predicates needed or not.
- CI fuzz step count.
- Shrinker vs seed replay.
- Context rule for intersection.
