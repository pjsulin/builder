# Implementation Plan: MovesThatStick

## Overview

Make Move behave like SketchUp's: a committed move welds moved vertices and edges to what they land on, a face landing on a coplanar face cancels or merges, and a face that would bend folds into planar triangles instead of being refused. Four phases, each one commit: share push/pull's settle steps, add `Document::move_and_integrate` with its wasm and `Model` wrappers, add folding, then switch the Move tool's commit path and update the docs. Everything is verified by `cargo test --workspace` and `npm test`; the preview path (`move_vertices`) stays as fast as today.

## Tasks

### Phase 1: Shareable Settle

**Status:** pending
**Dependencies:** none

#### Task 1.1: Widen the settle helpers to pub(crate)

- **Type:** refactor
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/pushpull.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Change `integrate_edges` (:204), `cancel_against_opposite` (:246) and `remove_coincident_faces` (:287) from private to `pub(crate)` with their bodies untouched, so `edit.rs` can call them.

#### Task 1.2: Extract settle_faces from settle

- **Type:** refactor
- **Status:** pending
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/pushpull.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Examples](spec.md#examples)
- **Description:** Move the body of `settle` (:165; its one call site is :152) into `pub(crate) fn settle_faces(ctx, faces) -> Result<Vec<FId>, Error>` returning the cancelled faces; `settle` keeps its signature and becomes `settle_faces` plus `cancelled.contains(&cap)`.

#### Task 1.3: Push/pull regression gate

- **Type:** test
- **Status:** pending
- **Dependencies:** [1.2]
- **Files:**
  - Modify: kernel/tests/pushpull.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Run `cargo test --workspace`; every existing push/pull test (`pulling_flush_with_a_side_merges_the_walls`, `pushing_a_door_on_a_thick_wall_twice_keeps_valid_topology`, the through and pocket cases) must pass unchanged. No test is edited; the file is listed so the phase names its gate. If anything fails the refactor is wrong, not the test.

### Phase 2: Integrate After Move

**Status:** pending
**Dependencies:** [Phase 1]

#### Task 2.1: integrate_moved and edges_of_vertices

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 1]
- **Files:**
  - Modify: kernel/src/edit.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** Add `pub(crate) fn edges_of_vertices(&self, verts) -> Vec<EId>`, `pub(crate) fn merge_vertex_into(&mut self, from, into)` (re-point every edge and face loop using `from` to `into`, drop an edge that would duplicate an existing `into` edge, remove `from`; all through `set_*` so it journals) and `pub(crate) fn integrate_moved(&mut self, def, edges)`: for each vertex of `edges`, if `find_vertex(def, pos)` returns a different id, `merge_vertex_into(v, found)`; then `integrate_edges(def, edges)` on the edges that still exist, then `heal_around(def, edges)` on the edges that still exist, then `settle_faces(def, touched)` where touched is every face of every edge incident to the edges' vertices. Named as a reusable step because CopyAndArrays calls it for copied geometry.

#### Task 2.2: Document::move_and_integrate

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** Add `pub fn move_and_integrate(&mut self, verts, offset)`: derive the one owner from `Vertex.owner` (`Error::Degenerate("vertices belong to more than one definition")` on a mix, `Missing("vertex")` on a dead id), `check_def_unlocked`, `move_vertices`, then `integrate_moved(def, edges_of_vertices(verts))`. The fold call is inserted in Task 3.2. Add `move_and_integrate` to the crate doc comment at kernel/src/lib.rs:9 beside `move_vertices`.

#### Task 2.3: wasm and Model wrappers

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.2]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `Kernel::move_and_integrate` (`js_name = moveAndIntegrate`) beside `move_vertices` at kernel-wasm/src/lib.rs:141 and `Model.moveAndIntegrate(verts, d)` beside `moveVertices` at app/src/kernel/model.ts:142, both mirroring the existing pair.

#### Task 2.4: Kernel tests for welding, settling and undo

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.2]
- **Files:**
  - Create: kernel/tests/move.rs
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** New test file using `kernel/tests/common/mod.rs` helpers: `ridge_lifted_and_nudged_stays_closed` (120x96x96 box, ridge line, lift 36 then move 10 in y; `is_closed`, `validate`), `box_face_moved_onto_box_face_joins_them` (two boxes, move the facing side by the gap; 10 faces, `is_closed`, volume 2000, `validate`), `instance_moved_onto_loose_geometry_never_sticks` (group a box, loose rectangle, `set_transform` onto it; root face and edge counts unchanged), `undo_after_each_integrated_move_restores_the_file` (for each of the ridge, box-onto-box and instance cases above: commit, `to_json`, begin, the move, commit, `undo`, `to_json` byte-equal), `moving_vertices_from_two_definitions_is_refused` (`Error::Degenerate`) and `move_and_integrate_into_a_locked_definition_is_refused` (lock the tag of a grouped box as kernel/tests/attributes.rs:160 does, `move_and_integrate` on one of its vertices returns `Error::Locked`, nothing changes) and `vertex_moved_onto_a_vertex_merges_into_it` (a loose rectangle beside a loose line sharing the plane; move the line's free end onto a rectangle corner; `vertex_count` drops by one, `find_vertex` at the corner returns one id whose edges include the line, `validate`).

### Phase 3: Fold Instead of Reject

**Status:** pending
**Dependencies:** [Phase 2]

#### Task 3.1: fold_diagonals and fold_for_move

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 2]
- **Files:**
  - Modify: kernel/src/edit.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Decisions](spec.md#decisions)
- **Description:** Add the pure `fold_diagonals(pts, normal) -> Vec<(usize, usize)>` (pick the diagonal whose two sub-polygon planes have the largest maximum dot with `normal`, so one piece stays as flat as possible and the hinge runs between the moved vertex's neighbours; recurse on sub-polygons not planar within `tol::PLANE`) and `fold_for_move(verts, offset)`: for each face using a moved vertex whose outer loop at post-move positions fails `Plane::contains`, a holed face returns `Error::NotPlanar`; otherwise add the diagonals with `add_edge`, `remove_face`, and `add_face` one triangle per piece with the old normal, material, back_material and attributes.

#### Task 3.2: Fold in move_and_integrate; preview tolerates bent faces

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: kernel/src/edit.rs
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Call `fold_for_move` first in `move_and_integrate`. In `move_vertices` (preview), treat `Err(Error::NotPlanar)` from `refresh_face` as "leave the face unrefreshed" and keep propagating `Collapsed` and every other error; update the doc comment.

#### Task 3.3: Fold tests and rewrite the planarity test

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.2]
- **Files:**
  - Modify: kernel/tests/move.rs
  - Modify: kernel/tests/edit.rs
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** In move.rs add `lifting_a_corner_folds_the_top` (7 faces, 13 edges, `is_closed`, `validate`, undo byte-equal) and a unit test of `fold_diagonals` on the box-corner quad (corner (10,10,10) lifted 3) expecting the single diagonal between the lifted corner's neighbours, so one triangle stays in the old plane (the diagonal through the lifted corner is rejected). In edit.rs rewrite `moving_one_corner_up_fails_because_faces_would_bend` (:24) as `moving_one_corner_up_previews_without_folding`: `move_vertices` returns `Ok`, face count stays 6, abort restores the JSON.

### Phase 4: Move Tool and Docs

**Status:** pending
**Dependencies:** [Phase 3]

#### Task 4.1: Move tool commits through moveAndIntegrate

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 3]
- **Files:**
  - Modify: app/src/tools/move.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Examples](spec.md#examples)
- **Description:** In `commit()` (:156) when `m.good` is a real move: abort the preview transaction, `begin("Move")`, `moveAndIntegrate(m.verts, toLocalDir(m.good))` when there are vertices, `setTransform` per instance as `apply()` does (:77-78), `commit()`; on error abort and flash. `apply()` and the `vcb` re-move path keep using `moveVertices` for preview.

#### Task 4.2: Headless tool tests for a fold and a weld

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** In `describe("Select, Move, Erase and groups")` add "commits a fold when a top edge is pushed sideways" (the `box(h)` shed box; `SelectTool` click on the top edge at [120, 48, 96]; `MoveTool` base [120, 48, 96], hover toward [120, 60, 96], `vcb("1'")`; the end faces y=0 and y=96 can no longer stay planar so each folds: `stats().faces` 8, `undo` restores 6; the tool has no vertex selection, so a single corner cannot be lifted through it) and "welds a face moved onto another" (two rectangles pulled into boxes with a gap, move the facing side by the gap, `stats().faces` 10). Both run through the wasm `moveAndIntegrate`.

#### Task 4.3: Architecture, features and roadmap

- **Type:** document
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: docs/architecture.md
  - Modify: docs/features.md
  - Modify: docs/roadmap.md
- **Context:** [spec.md§Summary](spec.md#summary), [spec.md§Decisions](spec.md#decisions)
- **Description:** architecture.md kernel edit section (:112-117): describe preview `move_vertices` versus committed `move_and_integrate` (fold, move, integrate_moved, settle_faces) and drop the "which we will add later" sentence; features.md Move row (:65) says welding and folding are built; roadmap.md 1.2 (:20) and 1.4 (:22) marked done, soft edges noted as deferred to 5.3.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.

## Plan Review

**Reviewed:** 2026-10-28

- [x] Requirements to Spec traced
- [x] Spec to Plan traced
- [x] Proposed ADRs checked against accepted
- [x] Checklist passed (1 warning accepted)

**Plan Status:** Ready for implementation
