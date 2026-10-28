# Close: MovesThatStick

- Start: aac0bb8
- Close: the commit whose message is `close(sprint-03): MovesThatStick`
- Tests: `flux test` at Gate 1 and Gate 6: exit code rule, exit 0 (cargo test 13 suites including the new kernel/tests/move.rs, npm test 8 files / 98 tests, survey pytest 27 passed). Branch `sprint/moves-that-stick` on `main` aac0bb8; `git log aac0bb8..HEAD --invert-grep -F --grep='(sprint-03):'` is empty, so no other work stream is in the range.

## Gate 2: Interface

`flux repomap --diff aac0bb8 --record sprint-03`: 29 added, 3 changed, 1 removed, 0 outside the record.

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `pushpull.rs` `integrate_edges`, `cancel_against_opposite`, `remove_coincident_faces` | changed (now `pub(crate)`) | In spec, matches | None |
| `pushpull.rs` `settle_faces` | added | In spec, matches | None; `settle` keeps its signature (below resolution, kernel/src/pushpull.rs:158-162) |
| `edit.rs` `move_vertices` | below resolution (signature unchanged, body tolerates `NotPlanar`) | In spec, matches | Verified at kernel/src/edit.rs:28-33 and the rewritten `moving_one_corner_up_previews_without_folding` |
| `edit.rs` `move_and_integrate`, `integrate_moved`, `edges_of_vertices`, `merge_vertex_into`, `fold_for_move` | added | In spec, matches | None |
| `edit.rs` `fold_diagonals` | added (`pub`) | In spec, differs (`pub` for `pub(crate)`) | spec.md § Interfaces amended in Phase 3: a crate-private wrapper used only by tests fails clippy's dead-code lint |
| `edit.rs` `fold_pieces`, `split_piece`, `is_planar` | added | Not in spec: private helpers | Recorded under spec.md § Added during implementation |
| `edit.rs` `tests` module and its two unit tests | added | Not in spec: test code | Recorded, one line |
| `kernel-wasm` `move_and_integrate` (`moveAndIntegrate`) | added | In spec, matches | None |
| `model.ts` `moveAndIntegrate` | added | In spec, matches | None |
| `move.ts` `commit()` body | below resolution | In spec, matches | Verified at app/src/tools/move.ts:157-172: abort, begin, `moveAndIntegrate`, `setTransform` per instance, commit, flash on error |
| `kernel/tests/move.rs` tests and helpers | added | Not in spec: test code | Recorded, one line; the box-onto-box numbers are amended in spec.md § Examples and Task 2.4 |
| `kernel/tests/edit.rs` `moving_one_corner_up_fails_because_faces_would_bend` | removed | In spec (Task 3.3 rewrite) | Replaced by `moving_one_corner_up_previews_without_folding` |
| Data models | no change | In spec, matches | No record or format change; fold diagonals are plain edges |

## Gate 3: ADRs

No proposed ADRs in this sprint (spec.md § Decisions: no `soft` flag, so no format ADR).

- mvr2opid Tag lock enforced by the kernel: `move_and_integrate` calls `check_def_unlocked` on the vertices' definition before folding or moving (kernel/src/edit.rs); `move_and_integrate_into_a_locked_definition_is_refused` proves `Error::Locked` with nothing written. docs/architecture.md § tag lock now lists it among the entry points.
- mvr2op7t Namespaced attributes in the builder format: no format change; faces re-created by a fold keep `material`, `back_material` and `attributes` (`fold_for_move`); `a_folded_face_keeps_its_material_and_attributes` proves it.
- mvr2ooxl Survey code lives in the builder repo: `survey/` untouched; its tests run in `flux test`.

## Gate 4: Project docs

Document task 4.3: `git diff --stat aac0bb8` shows docs/architecture.md (2 lines, plus the tag-lock list at close), docs/features.md (Move row) and docs/roadmap.md (1.2, 1.4), matching the task. docs/file-format.md unchanged, as Impact says for no `soft` flag. README.md unchanged.

`/verify-docs` over the changed lines (docs/architecture.md 114, 116, 163; docs/features.md 65; docs/roadmap.md 20, 22):

### Verified
- Preview `move_vertices` leaves a bent face as it was, fails on collapse: kernel/src/edit.rs:28-33, `moving_one_corner_up_previews_without_folding`
- `move_and_integrate` folds (`fold_for_move`), moves, then `integrate_moved`: kernel/src/edit.rs `move_and_integrate` body
- Hinge between the moved vertex's neighbours, one piece in the old plane: `split_piece` score (largest maximum dot), `fold_hinges_between_the_lifted_corners_neighbours`, `lifting_a_corner_folds_the_top`
- Materials and attributes kept, holed face refused: `fold_for_move` (`with_face`, `Error::NotPlanar`), `a_folded_face_keeps_its_material_and_attributes`
- Merge onto a vertex, re-insert as segments, heal, `settle_faces`: `integrate_moved` body; `vertex_moved_onto_a_vertex_merges_into_it`, `box_face_moved_onto_box_face_joins_them`
- `set_transform` never welds: `instance_moved_onto_loose_geometry_never_sticks`
- Soft-edge flag waits for styles, roadmap 5.6: docs/roadmap.md:88
- `move_and_integrate` returns `Error::Locked`: `move_and_integrate_into_a_locked_definition_is_refused`
- features.md Move row: welding and folding as above; copy and arrays are sprint 2.1

### Unverified
- None.

### Stale
- None. Changed symbols (`integrate_edges`, `cancel_against_opposite`, `remove_coincident_faces`) are not named in any project doc.

Out-of-scope drift: none seen in the changed units; no backlog item filed.

## Gate 5: Criteria

`flux tasks --record sprint-03`: 13 tasks, 13 completed (exit 0).

| Criterion | Evidence |
|---|---|
| F1 ridge lifted and nudged stays closed | [x] `ridge_lifted_and_nudged_stays_closed` |
| F1 instance onto loose geometry never sticks | [x] `instance_moved_onto_loose_geometry_never_sticks` |
| F2 box onto box gives one solid, no internal face | [x] `box_face_moved_onto_box_face_joins_them` (6 faces, closed, volume 2000) |
| F3 corner lifted folds the top, no error | [x] `lifting_a_corner_folds_the_top` (7 faces, 13 edges) |
| All: undo byte-equal | [x] `undo_after_each_integrated_move_restores_the_file`, `lifting_a_corner_folds_the_top` |
| All: headless tool test for a fold and a weld | [x] tools.test.ts "commits a fold when a top edge is pushed sideways", "welds a face moved onto another" |

Backlog under Impact: #mvr7ne51 (phone capture test) is cited as out of scope, not as work this sprint delivers; left open, not archived.

Backlog archived: none. Backlog created: none.

Spec's manual check (lift the shed ridge with the Move tool in the browser, undo, redo) is not a criterion; the same operation runs headlessly in `ridge_lifted_and_nudged_stays_closed` and the tool tests.
