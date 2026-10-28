---
created: 2026-10-28
sprint: MovesThatStick
start: aac0bb8
started: '2026-10-28'
step: '2'
---

# Requirements: MovesThatStick

## Background

`Document::move_vertices` (kernel/src/edit.rs) displaces vertices and fails when a face would stop being planar or flip; it never welds what it moved to the geometry it lands on. So a face moved onto another face overlaps silently, and a corner moved up is refused, which `docs/roadmap.md` 1.4 calls "feels broken". Drawing a line already welds, splits and heals (`add_line`), and push/pull already settles a cap against an opposite face (`settle`). Patrick's statement (2026-10-28): plan Milestone 1 sprints 1.1–1.3 and 2.1 as flux sprints for Claude Code cloud sessions; everything verifiable with cargo and npm.

## Summary

Move behaves like SketchUp's: moved vertices and edges weld to geometry they land on, a face landing on a coplanar face merges or cancels, and a move that would bend a face folds it into planar triangles instead of being refused.

## Goals

### Primary Goal

After any move, the model is as if the geometry had been drawn there: welded, split, healed, with every topology invariant holding.

### Secondary Goals

- Folding replaces the planarity error.
- Preview stays as fast as today; integration runs only at commit.

## Features

### Feature 1: Weld after Move

**What:** On commit, moved vertices merge with coincident vertices, moved edges split edges they cross or touch (and are split by them), and every touched plane is healed so faces split the same way `add_line` does.
**Why:** The silent overlap in Background.
**Details:** Reuses `insert_segment`-style welding and `heal_around`. Moving a group instance onto loose geometry never sticks.
**Integration:** A post-move integrate step in `edit.rs`, called from the committed transaction (`Model.commit` path), not from the per-pointer-move preview.

### Feature 2: Coplanar landing

**What:** A face landing on a coplanar face cancels against it (opposite normals, matching outline) or merges with it, as push/pull's `settle` does.
**Why:** Moving a box until it touches another must join them with no internal face.
**Integration:** Reuses `cancel_against_opposite` and `remove_coincident_faces` from pushpull.rs, made shareable.

### Feature 3: Fold instead of reject

**What:** When a move would make a face non-planar, the face is split into flat triangles along new edges before the move, and the move proceeds.
**Why:** Roadmap 1.4.
**Details:** Diagonal choice decided at plan time. If a `soft` edge flag is added to the format, fold edges carry it; otherwise they are ordinary edges this sprint.
**Integration:** `move_vertices` signature stays for preview; a `move_and_integrate` (name at plan time) does fold + move + integrate at commit. The Move tool drops any app-side pre-check that would block a fold.

## Success Criteria

### For Feature 1

- [x] Kernel test: moving the shed's ridge up and sideways keeps the gable walls and roof connected and watertight (`is_closed`), `validate` passes. Evidence: `kernel/tests/move.rs` `ridge_lifted_and_nudged_stays_closed` (7 faces, closed, volume checked, `validate`).
- [x] Kernel test: moving an instance onto loose geometry leaves the loose geometry unchanged. Evidence: `instance_moved_onto_loose_geometry_never_sticks` (root face and edge ids unchanged after `set_transform`).

### For Feature 2

- [x] Kernel test: moving a box until its face touches another box's face gives one solid with no internal face. Evidence: `box_face_moved_onto_box_face_joins_them` (one closed 20-inch box: 6 faces, 12 edges, 8 vertices, volume 2000, `face_containing` at the join is none).

### For Feature 3

- [x] Kernel test: moving a single corner of a box up produces a folded top (two triangles), no error. Evidence: `lifting_a_corner_folds_the_top` (7 faces, 13 edges, hinge between the corner's neighbours, closed) and `edit.rs` unit test `fold_hinges_between_the_lifted_corners_neighbours`.

### For all

- [x] Undo returns the exact previous model in each case (byte-equal JSON). Evidence: `undo_after_each_integrated_move_restores_the_file` (ridge, box onto box, instance) and `lifting_a_corner_folds_the_top` (`to_json` equal after `undo`).
- [x] Headless tool test: the Move tool commits a fold and a weld through wasm. Evidence: `app/test/tools.test.ts` "commits a fold when a top edge is pushed sideways" (8 faces, undo to 6) and "welds a face moved onto another" (6 faces spanning both boxes, undo to 12); npm test 8 files, 98 tests.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `docs/architecture.md` — kernel edit section: integrate step, folding
- `docs/features.md` — Move row
- `docs/file-format.md` — only if a `soft` flag is added
- `docs/roadmap.md` — 1.2 and 1.4 status

### ADRs

- mvr2op7t (format additions stay version 1) cited if a `soft` flag is added.

### Backlog

- #mvr7ne51 out of scope

## Scope

### In Scope

**Must Have:** Features 1–3 with kernel tests.
**Should Have:** `soft` flag on fold edges.

### Out of Scope

- Intersect Faces (sprint 1.3).
- Rendering soft edges differently (styles, 5.3).
- Rotate welding (2.2).

### Open Questions

- Fold diagonal choice.
- `soft` flag now or later.
- Integration context for moves inside a group.
- Weld tolerance for moves.
