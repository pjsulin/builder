# Close: IntersectAndHarden

- Start: 480b033
- Close: the commit whose message is `close(sprint-04): IntersectAndHarden`
- Tests: `flux test` at Gate 1 and Gate 6: exit code rule, exit 0 in 24.8s at Gate 1 and exit 0 at Gate 6 (no `test.junit`); `cargo test --workspace` includes `random_operations_keep_invariants` (1,500 steps, about 22 s in debug); `random_operations_long` run once at seed 1, 50,000 steps, passed in 562 s in a release build

## Gate 2: Interface

`flux repomap --diff 480b033 --record sprint-04`: 93 added, 3 changed, 0 removed, 0 outside the record.

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `tol.rs` `INTERSECT_SIN` | not shown (constant) | In spec, below diff resolution | `kernel/src/tol.rs:19` |
| `math.rs` `Plane::intersect`, `bbox`, `bbox_overlap_3d` | added | In spec, matches | none |
| `heal.rs` `face_contains_point` | added | In spec, matches | none |
| `heal.rs` `near_face_boundary` | changed (`pub(crate)`) | Not in spec | Recorded under spec.md § Added during implementation |
| `intersect.rs` `IntersectWith`, `Cut`, `intersect_faces`, `intersection_cuts` | added | In spec, matches | none |
| `intersect.rs` `Placed`, `Span`, `contains`, `near_boundary`, `spans`, `place`, `place_instance` | added | Not in spec: private helpers | Recorded under § Added during implementation |
| `lib.rs` `pub mod check`, `pub mod intersect`, `pub use intersect::{Cut, IntersectWith}` | added (`pub use` below resolution) | In spec, matches | `kernel/src/lib.rs:19,25,34` |
| `line.rs` `insert_segment` | unchanged signature | In spec, below diff resolution (behaviour) | piercing step at `kernel/src/line.rs:77`–97, tests in lines.rs and pushpull.rs |
| `check.rs` `FindingKind`, `Finding`, `fmt` (Display), `to_json`, `check` | added | In spec, matches | none |
| `check.rs` `FindingKind::name`, `Span`, `overlap_midpoint` | added | Not in spec: one `pub fn name` and private helpers | Recorded under § Added during implementation |
| `examples/validate.rs` findings and exit code | below resolution | In spec, below diff resolution | run on both fixtures in Gate 5 evidence |
| `tests/common/fuzz.rs` `Rng` (+ `new`, `next_u64`, `f64`, `range`, `choose`), `Op`, `apply`, `generate`, `run`, `shrink`, `render_test` | added | In spec, differs (location: `common/fuzz.rs` instead of `fuzz.rs`, so `fuzz_regressions.rs` can replay) | spec.md Phase 5 note (2026-10-28) |
| `tests/common/fuzz.rs` `grid`, `pick_face`, `nearest_edge`, `panic_message`, `fails_quietly`, `render_op`, `v3`, `Op::name` | added | Not in spec: private helpers | Recorded under § Added during implementation |
| `tests/fuzz.rs` `random_operations_keep_invariants` (1,500 steps), `random_operations_long`, `fuzz` | added | In spec, differs (step count 2,000 → 1,500 by Task 5.2's rule) | spec.md updated |
| `tests/fuzz_regressions.rs` two tests | added | In spec, matches (one per bug found) | none |
| `edit.rs` `fold_pieces`, `split_piece` | changed (extra `flat: &[P2]`) | Not in spec: private, fuzz bug fix | Recorded under § Added during implementation |
| `edit.rs` `is_diagonal`, `area2` | added | Not in spec: private, fuzz bug fix | Recorded under § Added during implementation |
| `kernel-wasm` `intersect_faces`, `check_model` | added | In spec, matches | none |
| `model.ts` `Finding`, `intersectFaces`, `checkModel` | added | In spec, matches | none |
| `model.ts` `journal`, `JOURNAL_SIZE` | below resolution / added const | In spec (journal), `JOURNAL_SIZE` exported const not in spec | `app/src/kernel/model.ts:84,94,119`; recorded under § Added during implementation |
| `app.ts` `intersect`, `checkModel`, `offerReport` | added | In spec, matches | none |
| `app.ts` `updateButtons` | unchanged signature | In spec, below diff resolution | `app/src/app.ts:625`–626 |
| `app.ts` `describeFinding` | added (exported) | Not in spec: new exported helper for the dialog and its test | Recorded under § Added during implementation; Patrick to confirm it stays exported |
| `index.html` three buttons and `findings` dialog | below resolution | In spec, below diff resolution | `app/index.html:25`–27, 69–71 |
| `report.ts` `ProblemReport`, `buildReport`, `reportFileName` | added | In spec, matches | none |
| test functions in math.rs, edit.rs, intersect.rs, lines.rs, pushpull.rs, check.rs, fuzz_regressions.rs, intersect.test.ts | added | Not in spec: tests | Recorded one per line under § Added during implementation |

## Gate 3: ADRs

No proposed ADRs (the sprint has no `decisions/`); none of the accepted ADRs carries an ast-grep rule.

- mvr2ooxl Survey code lives in the builder repo: not touched; the sprint changes nothing under `survey/`.
- mvr2op7t Namespaced attributes in the builder format: not touched; no attribute or format change (`git diff --stat 480b033 -- kernel/src/format.rs docs/file-format.md` is empty).
- mvr2opid Tag lock enforced by the kernel: `intersect_faces` calls `check_def_unlocked(ctx)` before any write (`kernel/src/intersect.rs:131`); `kernel/tests/intersect.rs::a_locked_context_and_bad_ids_are_refused` asserts `Error::Locked` on a locked group's definition. `check::check` only reads.

## Gate 4: Project docs

Document tasks 1.4, 2.4, 3.3, 4.4, 5.4, 6.5, 7.4, 8.1, 8.2: `docs/architecture.md` (+13/−3), `docs/features.md`, `docs/roadmap.md`, `README.md` (+8), `docs/walkthrough-shed.md` (new) all changed since 480b033 and match their tasks. `/verify-docs` over the changed lines of those docs and the README: every claim verified (flash texts, button ids, step counts, env var, tolerances, file names, example output). Out of scope, filed before any fix: `docs/architecture.md` § 10 still lists "moved vertices do not weld" and "a move that would bend a face is rejected", both done by MovesThatStick: #mvscxby4 (line numbers at bda40f8). Changed symbols `fold_pieces`, `split_piece`, `near_face_boundary` appear in no project doc; the prose on folding and on the arrangement walk in `docs/architecture.md` § 2 gained the inside-diagonal and pinched-loop clauses.

## Gate 5: Criteria

`flux tasks --record sprint-04`: 30 tasks, 30 completed (exit 0).

| Criterion | Evidence |
|---|---|
| F1 gable roof group cuts the walls; push and erase; validate | [x] `kernel/tests/intersect.rs::a_gable_roof_group_cuts_the_walls_it_passes_through` |
| F1 selection only cuts selected pairs | [x] `with_selection_only_the_selected_pair_is_cut` |
| F2 piercing vertex, in-plane line splits, endpoint is a touch | [x] `kernel/tests/lines.rs::a_line_through_a_face_is_cut_where_it_pierces`, `an_endpoint_on_a_face_is_a_touch_not_a_piercing` (the in-plane line runs across the face through both piercing vertices; a line between two interior points is a spike, plan Task 3.2 note) |
| F3 CI fuzz under a minute, no failure | [x] `random_operations_keep_invariants`: seed 0x5eed2026, 1,500 steps, 22 s debug (2,000 took 29.5 s, lowered by Task 5.2's rule); long run seed 1, 50,000 steps, ok in 562 s release |
| F3 regression test per bug | [x] `kernel/tests/fuzz_regressions.rs`: two bugs, both in MovesThatStick's code (fold diagonal across a notch; pinched hole loop), fixed in edit.rs and heal.rs |
| F4 failed operation offers the report | [x] `app/test/report.test.ts`; `App.offerReport` at five catch sites |
| F5 validate reports a non-planar face and a duplicate vertex from a file | [x] as amended (2026-10-28): the reader refuses a non-planar face per docs/file-format.md, so `bad.builder` carries a duplicate vertex, overlapping edges and faceless edges and the example reports all four findings, exit 1; the non-planar finding is covered on the live document by `kernel/tests/check.rs::a_face_bent_in_memory_is_non_planar`. **Patrick to confirm the amended criterion** |
| F6 walkthrough recorded; Patrick repeats it | [ ] `docs/walkthrough-shed.md` written with the counts from the kernel run of its steps; **waiting on Patrick's browser run** (both prerequisite sprints are on main) |

Backlog under Impact: #mvr7ne51 (phone capture test) is cited as out of scope, not as work this sprint delivers; left open, not archived.

Backlog archived: none. Backlog created: #mvscxby4 (Gate 4 doc drift).

Waiting on Patrick after the merge: run `docs/walkthrough-shed.md` in the browser at https://pjsulin.github.io/builder/ and check the flashes and face counts against its Results; confirm the amended Feature 5 criterion and that `describeFinding` may stay exported.
