# Implementation Plan: RotateAndOffset

## Overview

Eight phases, one commit each. Phases 1–3 are kernel work: the transform path (`transform_vertices`, `transform_and_integrate`, `mat_rotation`) that rotation shares with Move, the copy forms that take a transform with their wasm and `Model` wrappers, and the offset module (`offset_face`, `offset_edges`, `edge_chain`) with its wrappers. Phase 4 adds the two fuzz ops and re-measures the CI run. Phase 5 prepares the app: the copy replay shared by Move and Rotate moves to `copies.ts`, `rotation()`, `parseAngle`, `Overlay.protractor` and `ToolHost.toWorld`. Phases 6 and 7 are the Rotate and Offset tools with their headless tests, toolbar buttons and doc rows. Phase 8 renumbers the roadmap, drops the two stale known-limits bullets (backlog #mvscxby4) and writes the deck walkthrough with a headless test behind its counts. Everything is checked with `cargo test --workspace`, `npm run build:kernel`, `npm run typecheck` and `npm test`; Patrick's browser run of the walkthrough's stair and railing steps is the only manual step.

## Tasks

### Phase 1: Kernel Transform Path

**Status:** pending
**Dependencies:** none

#### Task 1.1: Rotation and direction transforms in math.rs

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/math.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `mat_apply_dir(m, d)` (the linear part of `m`, next to `mat_apply`) and `mat_rotation(center, axis, angle) -> Option<Mat4>` (Rodrigues about the unit axis, translated so `center` is fixed; `None` for a zero or non-finite axis), with unit tests in the module's `tests`: red to green by 90° about blue through the origin, a centre off the origin stays put, `mat_apply_dir` ignores translation, a zero axis is `None`.

#### Task 1.2: transform_vertices and transform_and_integrate in edit.rs

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Decisions](spec.md#decisions)
- **Description:** Generalise the move path to a `Mat4`: `transform_vertices(verts, m)` (lock check per owner as today, `Error::Degenerate("transform is not a number")` for a non-finite matrix, targets at `mat_apply(m, pos)`; a face whose every loop vertex is in the set gets its stored normal set to `mat_apply_dir(m, normal)` through `with_face` before `refresh_face`, a partly moved face is refreshed as today with `NotPlanar` tolerated), `transform_and_integrate(verts, m)` (owner check, `fold_for_transform`, `transform_vertices`, `integrate_moved`), and rename `fold_for_move` to `fold_for_transform(verts, m)` with targets at `mat_apply(m, pos)`. `move_vertices` and `move_and_integrate` become one-line `mat_translation` wrappers. Update the crate docs list in lib.rs and the doc comments that name `fold_for_move`.

#### Task 1.3: Kernel rotation tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [1.2]
- **Files:**
  - Create: kernel/tests/rotate.rs
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** With `common::validate`: a whole box rotated 30° about blue keeps 6 faces, 12 edges, volume 1000; a 2 × 48 stringer face standing on the ground rotated 37° about its own normal keeps area 96 and one face; a vertical face rotated 120° about blue keeps its front side (normal rotated, not flipped, no `Collapsed`); one top corner of a box rotated about a horizontal axis through a neighbour folds the faces that would bend (face count grows, `validate`); a box rotated 90° about blue so it lands flush against another welds into one solid (`is_closed`, volume 2000); `set_transform(g, mat_rotation(..))` on a grouped box puts `mat_apply(world_transform, corner)` where the loose rotation puts the same corner; undo after a committed rotation restores `to_json` byte for byte; `Error::Locked` on a locked tag; a NaN matrix is `Degenerate` and leaves the document unchanged; two owners refused. The existing `kernel/tests/move.rs`, `edit.rs`, `attributes.rs` and `fuzz_regressions.rs` must pass unchanged.

#### Task 1.4: Architecture: the transform path

- **Type:** document
- **Status:** pending
- **Dependencies:** [1.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Decisions](spec.md#decisions)
- **Description:** In § 2 "Sticky geometry: the operations", rewrite the Move bullet as the transform path: preview `transform_vertices` (the fully-moved face keeps its front side), commit `transform_and_integrate` (`fold_for_transform`, transform, `integrate_moved`), with Move as the translation and Rotate as the rotation of the same path, diagonals judged on the pre-transform loop; instances rotate through `set_transform` with the same matrix.

### Phase 2: Copy With a Transform, Wasm and Model

**Status:** pending
**Dependencies:** [Phase 1]

#### Task 2.1: copy_geometry_with and copy_instance_with

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.2]
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `copy_geometry_with(ctx, faces, edges, m)`: the body of today's `copy_geometry` with new vertices at `mat_apply(m, pos)` and `add_face(.., Some(mat_apply_dir(m, face.plane.normal)))`, non-finite `m` refused; `copy_geometry` calls it with `mat_translation(offset)`. `copy_instance_with(inst, m)`: today's `copy_instance` with `x.transform = mat_mul(&m, &src.transform)`; `copy_instance` calls it with `mat_translation(offset)`. Lock checks unchanged.

#### Task 2.2: Rotate-copy kernel tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel/tests/copy.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** `copy_instance_with(g, &R)` with `R = mat_rotation(..)` gives a new definition with equal geometry and transform `mat_mul(&R, &T)`; `copy_geometry_with` of a face by `R` keeps its area and has its normal `mat_apply_dir(R, n)`; both `validate` and undo as one step. The existing copy tests pass unchanged.

#### Task 2.3: Wasm bindings for transform and copy-with

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** A `mat(m: Vec<f64>) -> Result<Mat4, JsError>` helper (the 16-number check `set_transform` does today, reused by it), then `transformVertices`, `transformAndIntegrate`, `copyGeometryWith` (JSON `{faces, edges}` as `copyGeometry`) and `copyInstanceWith`.

#### Task 2.4: Model wrappers for transform and copy-with

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.3]
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `transformVertices(verts, m)`, `transformAndIntegrate(verts, m)`, `copyGeometryWith(ctx, faces, edges, m)`, `copyInstanceWith(inst, m)`, each through `changed()` with `Float64Array.from(m)` as `setTransform` does.

#### Task 2.5: Model rotate-copy test

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.4]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** In the "Model copy" describe: `copyInstanceWith` with a 90° rotation about blue through a corner inside `transact("Copy")` gives a second instance whose transform equals `mul(R, T)` and undoes as one step; `transformVertices` then `transformAndIntegrate` of a loose face by the same `R` keeps the face count and area.

#### Task 2.6: Architecture: copy with a transform

- **Type:** document
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** In the Copy bullet of § 2, name `copy_geometry_with` and `copy_instance_with` as the forms that take a transform (a rotate-copy), with the offset forms as their translation case.

### Phase 3: Kernel Offset

**Status:** pending
**Dependencies:** none

#### Task 3.1: offset.rs: edge_chain, offset_face, offset_edges

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Create: kernel/src/offset.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Decisions](spec.md#decisions)
- **Description:** New module with `Offset`, `Chain`, the pure `offset_loop(pts, distance, closed)` (mitred: each vertex to the meeting point of its two edges' lines offset to the right of the walk; collinear neighbours straight across; open ends straight across) and `is_simple(pts, closed)`, and the `Document` methods: `edge_chain` (ordering and plane rules of the spec, its five errors), `offset_face` (lock check, distance checks, loops in `face.plane.basis()`, offset, the refusal checks on the 2D loops before any write: area and orientation kept, simple, no edge within `tol::LENGTH` of collapsing, loops disjoint and holes inside the outer; then `insert_segment` per loop edge and `heal_around`, returning the live edges and the faces bordering them) and `offset_edges` (chain, orientation, offset, checks, draw). `lib.rs`: `pub mod offset;`, `pub use offset::{Chain, Offset};`, the crate docs line.

#### Task 3.2: Kernel offset tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Create: kernel/tests/offset.rs
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** With `common::validate`: a 120 × 96 face offset inward 4" gives a ring with one hole and an inner face whose areas add up, and `push_pull` of the ring closes a solid of volume 120·96·96 − 112·88·96; a window rectangle drawn on a box's wall offset outward 3" gives a trim ring and the wall remainder, and pulling the ring works; a face with a hole offset inward grows the hole; the L (20 × 20 missing a 10 × 10 corner) offset inward 6" is `Err(Error::Degenerate(_))` with `to_json` unchanged; an open three-edge chain gives three new edges and no face; a closed four-edge chain with no face offset outward gives a ring face; `edge_chain` errors for disconnected edges, two owners, a straight chain with no face, a non-planar chain; `Error::Locked`; `|distance| <= tol::LENGTH` refused.

#### Task 3.3: Wasm bindings for offset

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `offsetFace` and `offsetEdges` returning JSON `{edges, faces}` (the `copyGeometry` pattern), `edgeChain` returning JSON `{points, closed, normal}`.

#### Task 3.4: Model wrappers for offset

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.3]
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `ChainInfo`, `offsetFace`, `offsetEdges` (through `changed()`, `JSON.parse`) and `edgeChain` (a query, no `changed()`).

#### Task 3.5: Model offset test

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.4]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A "Model offset" describe: `offsetFace` of a box's wall inward 4" inside `transact("Offset")` gives seven faces and one undo restores six; `edgeChain` of three connected wall edges returns them ordered with `closed: false` and the wall's normal, and throws for two disconnected edges; `offsetEdges` of that chain adds three edges.

#### Task 3.6: Architecture: offset

- **Type:** document
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Decisions](spec.md#decisions)
- **Description:** A new Offset bullet in § 2: loops offset in the face's plane basis with mitred corners, the sign convention, the chain rules, the refusal of a self-crossing result before anything is drawn, and the heal that makes the ring and inner face.

### Phase 4: Fuzz Operations

**Status:** pending
**Dependencies:** [Phase 1, Phase 3]

#### Task 4.1: RotateFace and OffsetFace ops

- **Type:** test
- **Status:** pending
- **Dependencies:** [1.2, 3.1]
- **Files:**
  - Modify: kernel/tests/common/fuzz.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add the two `Op` variants with their `name` ("Rotate", "Offset"), `apply` arms (`transform_and_integrate` with `mat_rotation(center, axis, angle)`; `offset_face`), two weight slots in `generate` before Undo and Redo (0 when crowded) with the generator rules of the spec, and `render_op` arms so a shrunk failure pastes into `fuzz_regressions.rs`.

#### Task 4.2: Re-measure the CI fuzz run

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: kernel/tests/fuzz.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Run `random_operations_keep_invariants` in a debug build with the new generator; keep 1,500 steps if it finishes under 30 s, else lower the count until it does, and record the measurement in the test's comment. Run `random_operations_long` once with `BUILDER_FUZZ_SEED=1`; a failure is shrunk and fixed (or recorded in `fuzz_regressions.rs` with the fix) before the phase commits.

#### Task 4.3: Architecture: fuzz ops and the standing rule

- **Type:** document
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** In § "Randomized test", add rotate and offset to the op list, the re-measured time and step count, and the rule that every kernel operation a tool exposes gets an `Op` in the same sprint.

### Phase 5: Shared Copy Replay, Angles and Host Plumbing

**Status:** pending
**Dependencies:** [Phase 2]

#### Task 5.1: copies.ts and the Move refactor

- **Type:** refactor
- **Status:** pending
- **Dependencies:** [2.4]
- **Files:**
  - Create: app/src/tools/copies.ts
  - Modify: app/src/tools/move.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Move `Selected` and `makeCopies` out of `MoveTool` into `copies.ts` as `makeCopies(host, sel, transforms)` over `copyGeometryWith` / `copyInstanceWith` (one "Copy" transaction, select the copies, abort and flash on error). `MoveTool.commit` and `array` call it with `translation(host.toLocalDir(o))` per offset; `copyIsLastStep`, `lastCopy` and `pendingCopy` stay in Move. The Move tests in `app/test/tools.test.ts` pass unchanged.

#### Task 5.2: rotation(), parseAngle and formatAngle

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: app/src/math.ts
  - Modify: app/src/units.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `rotation(center, axis, angle): Mat4` next to `translation`, the same convention as the kernel's `mat_rotation`; `parseAngle(text)` (degrees: `37`, `37.5`, `-37`, `37°`, `37deg`; NaN otherwise, including every `parseArray` spelling) and `formatAngle(degrees)` (`37°`, `37.5°`) next to `parseArray`.

#### Task 5.3: Overlay.protractor and ToolHost.toWorld

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: app/src/tools/tool.ts
  - Modify: app/src/app.ts
  - Modify: app/test/toolhost.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Protractor` and `Overlay.protractor` in tool.ts; `ToolHost.toWorld` / `toWorldDir`, implemented in `App` with `ctxMatrix` and in `TestHost` by keeping the context matrix next to its inverse (set in `enterGroup`, reset in `exitGroup`). No rendering yet; the protractor segments come with Phase 6.

#### Task 5.4: Math, units and host tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.2, 5.3]
- **Files:**
  - Modify: app/test/math.test.ts
  - Modify: app/test/units.test.ts
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** `rotation` maps red to green by 90° about blue, keeps its centre fixed and composes with `translation` as expected; `parseAngle` reads the accepted spellings and is NaN for `6x`, `/6`, empty and words; `formatAngle` prints `37°` and `37.5°`; in the "edits inside a group" test, `toWorld(toLocal(p))` and `toWorldDir(toLocalDir(d))` round-trip after `enterGroup` on a moved group.

### Phase 6: Rotate Tool

**Status:** pending
**Dependencies:** [Phase 5]

#### Task 6.1: RotateTool and protractorSegments

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.1, 5.2, 5.3]
- **Files:**
  - Create: app/src/tools/rotate.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Decisions](spec.md#decisions)
- **Description:** The state machine of the spec's Rotate semantics: idle protractor following the cursor with the plane rule of Decision 7, centre click (selection or hover pick, lock refusal, `begin("Rotate")`), start click, sweep with 15° snapping (Decision 6) previewed through `transformVertices` and `setTransform`, commit through `transformAndIntegrate` or `makeCopies`, `vcb` with `parseArray` (radial array with the revision guard) then `parseAngle` (apply and commit, or the guarded retype), Escape, `modifier`, `cursor`, hints and the "Angle" label; `protractorSegments` as a pure exported function.

#### Task 6.2: Register Rotate in the app

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `rotate: new RotateTool(this)` in the tools map, key `q`, `drawOverlay` draws `protractorSegments(o.protractor)` on a "protractor" layer in the preview style (cleared when absent), and a toolbar button "Rotate (Q)" after Move with an inline SVG icon.

#### Task 6.3: Headless Rotate tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [6.1, 6.2]
- **Files:**
  - Create: app/test/rotate.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A stringer group rotated to 37° by typing has transform `rotation(center, blue, 37°)`; a swept loose face snaps to 15° and the Measurements box reads the angle; the protractor normal is the hovered face's, blue on the ground, red after `h.inference.toggleAxisLock(0)`; rotate-copy leaves the original and places the rotated copy; `6x` after a 60° rotate-copy gives seven groups as one undo and `/6` six evenly spaced; retyping replaces the last rotate; a locked group is refused with the toast; Escape leaves `toJson` unchanged; `protractorSegments` returns segments on the circle and the swept arc.

#### Task 6.4: Features and README: Rotate

- **Type:** document
- **Status:** pending
- **Dependencies:** [6.2]
- **Files:**
  - Modify: docs/features.md
  - Modify: README.md
- **Context:** [spec.md§Decisions](spec.md#decisions)
- **Description:** features.md row "Rotate with protractor, copy-rotate arrays": Built now, with the plane rule, snapping, copy modifier and `6x` / `/6`. README: Rotate in the Tools line, a Rotate bullet under the features, `Q` in the keys table and the copy modifier row extended to rotating.

### Phase 7: Offset Tool

**Status:** pending
**Dependencies:** [Phase 3, Phase 5]

#### Task 7.1: OffsetTool and cursorOffset

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.4, 5.3]
- **Files:**
  - Create: app/src/tools/offset.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Decisions](spec.md#decisions)
- **Description:** The state machine of the spec's Offset semantics: face mode on the hovered face (`PushPullTool.pickFace`'s rule) and chain mode on a selection of edges (`model.edgeChain`), the first click starting an "Offset" transaction, the pointer setting the signed distance through the pure `cursorOffset` (inside the face or the cursor's side of the chain), preview through `offsetFace` / `offsetEdges` keeping the last accepted distance, commit on the second click or drag release, typed distances with Push/Pull's sign rule and the kernel's message flashed on a refusal, the guarded retype with `redo` on failure, Escape, hints and the "Distance" label; chain mode selects the new edges after commit.

#### Task 7.2: Register Offset in the app

- **Type:** implement
- **Status:** pending
- **Dependencies:** [7.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `offset: new OffsetTool(this)` in the tools map, key `f`, and a toolbar button "Offset (F)" after Rotate with an inline SVG icon.

#### Task 7.3: Headless Offset tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [7.1, 7.2]
- **Files:**
  - Create: app/test/offset.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Wall inward `4"` then Push/Pull of the ring by 8' gives a closed solid of the wall-thickness volume; a window rectangle on a wall offset outward `3"` (cursor outside it) then pulled gives trim; a selected three-edge chain offsets to the cursor's side and the new edges are selected; retyping changes the last offset; an L-shaped face offset past its notch flashes "The offset would cross itself" and leaves `toJson` unchanged; Escape aborts; `cursorOffset` signs and magnitudes for a point inside, outside and beside a chain.

#### Task 7.4: Features and README: Offset

- **Type:** document
- **Status:** pending
- **Dependencies:** [7.2]
- **Files:**
  - Modify: docs/features.md
  - Modify: README.md
- **Context:** [spec.md§Decisions](spec.md#decisions)
- **Description:** features.md row "Offset (faces and edge chains)": Built now, inward and outward by the cursor's side, typed distance with a minus reversing, self-crossing results refused. README: Offset in the Tools line, an Offset bullet (wall thickness, trim), `F` in the keys table.

### Phase 8: Roadmap, Known Limits and the Deck Walkthrough

**Status:** pending
**Dependencies:** [Phase 6, Phase 7]

#### Task 8.1: Headless deck walkthrough test

- **Type:** test
- **Status:** pending
- **Dependencies:** [6.3, 7.3]
- **Files:**
  - Create: app/test/deck.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** The walkthrough's steps run through the tools against the real kernel, in order, asserting the face and instance counts after each: a 12' × 10' deck top with 4 × 4 posts pulled 3' and copied to the corners, 2 × 8 joists grouped and arrayed `9x` at 16" (2.1), a 2 × 12 stringer group rotated to 37° by typing, a railing frame made by drawing a 12' × 3' rectangle standing on the deck edge, offsetting it inward 1 1/2", erasing the inner face and pulling the ring 1 1/2", then rotate-copied 90° about the corner post for the short side. The counts the test asserts are the ones Task 8.2 writes down.

#### Task 8.2: docs/walkthrough-deck.md

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.1]
- **Files:**
  - Create: docs/walkthrough-deck.md
- **Context:** [spec.md§Decisions](spec.md#decisions)
- **Description:** In the shape of `docs/walkthrough-shed.md` (prerequisites, numbered steps naming the tool, its key, the click, the typed value and the expected result with the perf line's face count, from Task 8.1's counts): the frame and posts, the joists by array, the rotated stair stringer, the railing by Offset, Push/Pull and rotate-copy; round posts listed as the step 2.4 adds. The stair and railing steps are Patrick's browser check.

#### Task 8.3: Roadmap renumbering, known limits, README docs list

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.2]
- **Files:**
  - Modify: docs/roadmap.md
  - Modify: docs/architecture.md
  - Modify: README.md
- **Context:** [spec.md§Decisions](spec.md#decisions)
- **Description:** roadmap.md Milestone 2 table: rows 2.2 Rotate and 2.3 Offset merged into "2.2 **Rotate** with a protractor and rotate-copy, and **Offset** (faces and edge chains). Done, sprint RotateAndOffset, 2026-10", 2.4–2.8 renumbered 2.3–2.7, and the "Rough total" references (2.1–2.4, 2.5) updated. architecture.md § 10: drop the two stale known-limits bullets (moved vertices do not weld; a bending move is rejected; backlog #mvscxby4) and add Rotate and Offset to the built tools sentence. README Docs list: the deck walkthrough next to the shed one.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.

## Plan Review

**Reviewed:** 2026-10-29

- [x] Requirements to Spec traced
- [x] Spec to Plan traced
- [x] Proposed ADRs checked against accepted
- [x] Checklist passed (2 warnings accepted: the `app/src/app.ts` and `app/index.html` wiring in Tasks 5.3, 6.2 and 7.2 is DOM-bound and untested, as 2.1's keydown change was; the fuzz step count in Task 4.2 is fixed by measurement at execution time, not here)

**Plan Status:** Ready for implementation
