# Sprint Kickoff: MovesThatStick

**Captured from conversation:** 2026-10-28

## Context

`Document::move_vertices` (kernel/src/edit.rs) moves vertices and fails when a face would stop being planar; nothing it moves welds to geometry it lands on, so a face moved onto another face overlaps silently, and a corner moved up is refused rather than folded. Milestone 1 sprint 1.2 in `docs/sprints.md`: Move behaves like SketchUp's. Second of four sprints planned on 2026-10-28, to be executed by a Claude Code cloud session.

## Decisions

- **Kernel-only sprint with kernel tests:** the Move tool (`app/src/tools/move.ts`) already previews through `move_vertices` and commits a transaction; the behaviour changes land in the kernel so headless `cargo test` verifies every "done when" item without a browser.
- **Reuse line drawing's welding:** `add_line` welds endpoints (`find_vertex`/`vertex_at`), splits crossed edges and heals planes (`heal_around`); push/pull `settle` cancels a cap against an opposite coplanar face. Move after commit reuses these paths rather than a new welder.
- **Fold, don't refuse:** when a moved face can't stay planar it is split into planar triangles along new edges, as SketchUp does. The soft/hidden flag on those edges is decided at plan time (see Open Questions).

## Scope

**In scope:**

- After a move, moved vertices and edges weld to geometry they land on: coincident vertices merge, edges crossing or touching existing edges split them, the planes touched are healed so faces split the same way `add_line` does.
- A face landing on a coplanar face cancels or merges, matching push/pull's `settle` / `cancel_against_opposite` / `remove_coincident_faces`.
- A move that would make a face non-planar folds it into flat triangles along new edges instead of returning an error.
- Moving a group instance (`set_transform`) onto loose geometry still never sticks.
- Kernel tests for the four "done when" cases (shed ridge stays watertight via `is_closed`; box corner folds; box face onto box face joins with no internal face; undo returns the exact previous model), each checking `validate` invariants.
- Move tool: remove any app-side planarity pre-check that now blocks a fold; preview still shows the unfolded drag.

**Out of scope:**

- Intersect Faces (1.3): welding here covers vertices and edges that land on geometry, not faces crossing faces mid-air.
- Styles that render soft edges differently (5.3): the flag may be stored, not drawn specially.
- Rotate welding (2.2) reuses this work later.

## Technical Approach

- Split `move_vertices` into the displacement and a post-move `integrate` step run on commit: collect the moved edges, run them through the segment insertion and `heal_around` path used by `add_line`, then run the coplanar settle used by push/pull on faces whose plane now contains other faces.
- Fold: before moving, for each face that would go non-planar, triangulate it from the moved positions (fan or ear-clip on the 3D polygon), add the diagonals as edges, then move; the diagonals get a `soft` flag if the format gains one this sprint.
- Preview path (`move_vertices` per pointer move) stays cheap: integration and folding run only in the committed transaction so drag stays smooth on the stress model.
- Transactions already journal every edit, so undo of the integrated move needs no new code; a test proves it.

## Open Questions

- Diagonal choice when folding a quad or n-gon so results look natural (shortest diagonal, or the one that keeps both triangles' normals closest to the original).
- Whether a `soft` edge flag enters `kernel/src/doc.rs` and `format.rs` now (additive, like `attributes` was) or waits for styles.
- Where integration runs when the moved vertices belong to a group: in the group's definition only (SketchUp's rule), with a test.
- Tolerance for "lands on": reuse `tol::LENGTH`, or a looser weld tolerance for moves.

## References

- `docs/sprints.md` § Sprint 1.2, `docs/roadmap.md` 1.2 and 1.4
- `kernel/src/edit.rs` (`move_vertices`, `vertices_of`), `kernel/src/line.rs` (`add_line`, `insert_segment`, `heal_around`), `kernel/src/pushpull.rs` (`settle`, `integrate_edges`, `cancel_against_opposite`, `remove_coincident_faces`), `kernel/src/heal.rs`, `kernel/src/topo.rs` (`find_vertex`, `vertex_at`, `add_edge`)
- `kernel/tests/common/mod.rs` (`validate`, `is_closed`, `make_box`), `kernel/tests/edit.rs`, `kernel/tests/pushpull.rs`
- `app/src/tools/move.ts` (`commit`), `kernel-wasm/src/lib.rs` `move_vertices`
- ADR mvr2op7t (format additions stay version 1, empty fields not written) as the precedent for a `soft` flag
