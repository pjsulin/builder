# Implementation Plan: RotateAndOffset

## Overview

Eight phases, one commit each. Phases 1–3 are kernel only: the transform path (`mat_rotation`, `transform_vertices`, `transform_and_integrate`, the transformed copy forms, with Move's offset forms as wrappers), the offset module (`offset_loop`, `offset_face`, `offset_edges`, `Error::SelfIntersecting`) and the two fuzz operations. Phase 4 exposes the new operations over wasm and `Model` and adds `rotation`, `parseAngle` and `formatAngle` to the app, all independent of any tool. Phase 5 is the Rotate tool with its protractor overlay and app wiring; Phase 6 adds the copy modifier and radial arrays to it; Phase 7 is the Offset tool; Phase 8 writes the deck walkthrough and renumbers the roadmap. Everything is checked with `cargo test --workspace`, `npm test` and `npm run typecheck`; Patrick's browser run of the deck walkthrough's stair and railing steps is the only manual step.

## Tasks

### Phase 1: Kernel Transform Path

**Status:** completed
**Dependencies:** none

#### Task 1.1: Rotation matrix in math.rs

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/math.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `mat_rotation(center, axis, angle) -> Option<Mat4>` (Rodrigues, column-major, next to `mat_translation` at math.rs:264), `mat_apply_dir(m, d)` and `mat_is_finite(m)`, with unit tests in the existing `tests` module: 90° about Z maps X to Y, the centre stays fixed, angle 0 is `IDENTITY`, a zero axis is `None`.

#### Task 1.2: transform_vertices and transform_and_integrate

- **Type:** implement
- **Status:** completed
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** Rewrite `move_vertices` (edit.rs:84) as `transform_vertices(verts, m)`: the lock check per owner as today, a non-finite matrix refused, each vertex set to `mat_apply(m, pos)`, and before `refresh_face` each touched face whose every loop vertex is in the set gets its plane normal replaced by `mat_apply_dir(m, normal)` (the `explode` rule, group.rs:118) so a rotation past 90° is not `Collapsed`; `move_vertices(verts, offset)` becomes the `mat_translation` wrapper. `move_and_integrate` (edit.rs:107) likewise becomes `transform_and_integrate(verts, m)` plus a wrapper. `fold_for_move` (edit.rs:132) takes `m: &Mat4` and computes the target points as `mat_apply(m, pos)`; its diagonal test is unchanged. The lib.rs crate doc (lib.rs:9) names the transform forms.

#### Task 1.3: Transformed copies

- **Type:** implement
- **Status:** completed
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** `copy_geometry` (edit.rs:25) becomes `copy_geometry_transformed(ctx, faces, edges, m)`: `map_v` places vertices at `mat_apply(m, pos)` and `add_face` takes `mat_apply_dir(m, face.plane.normal)` as its hint; `copy_geometry(ctx, faces, edges, offset)` wraps it with `mat_translation`. `copy_instance` (group.rs:182) becomes `copy_instance_transformed(inst, m)` with `x.transform = mat_mul(m, &src.transform)` and the same lock checks; `copy_instance(inst, offset)` wraps it. Doc comments on both wrappers point at the transformed form.

#### Task 1.4: Kernel rotate tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [1.2, 1.3]
- **Files:**
  - Create: kernel/tests/rotate.rs
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Using `tests/common`: a 120 × 96 × 96 box rotated whole by 37° about Z through its origin corner stays closed with the same volume and the corner fixed; its top face rotated 10° about X through the front top edge is a closed 6-face solid (no fold: the walls stay planar); a top edge rotated about the vertical through one end folds the walls as the move fold test does (`kernel/tests/move.rs` pattern); a 10-inch box's faces copied with a 180° rotation about its x = 10 edge weld into one 20-inch solid (volume 2000, `validate`, undo back to 6 faces); `copy_instance_transformed` gives `mat_mul(rotation, transform)` and a different definition; `transform_and_integrate` on a locked definition is `Error::Locked`; `validate` after each.

#### Task 1.5: Architecture doc for the transform path

- **Type:** document
- **Status:** completed
- **Dependencies:** [1.2, 1.3]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Rewrite the Move paragraph (architecture.md:122) around `transform_vertices` / `transform_and_integrate` with Move as the translation case and rotation as the other, the fully-moved-face normal rule and the pre-transform fold plane; extend the Copy paragraph (:126) with the transformed forms; add the new entry points to the tag-lock list (:170).

### Phase 2: Kernel Offset

**Status:** pending
**Dependencies:** none

#### Task 2.1: offset_loop and Error::SelfIntersecting

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Create: kernel/src/offset.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** New module `offset` with the pure `offset_loop(pts, d, closed) -> Option<Vec<P2>>`: right-hand edge normals `(dy, -dx)`, mitred corners by line intersection, collinear corners moved straight, open-chain ends offset perpendicular to their edge; `None` on a self-intersection (segment pairs, the `is_diagonal` tolerance style of edit.rs:339), a reversed edge (negative dot with the original), coincident consecutive points or a closed loop whose signed area changes sign or drops under `tol::AREA`. Unit tests in the module: a square inward and outward, a triangle, a collinear corner, an open chain, a thin rectangle offset inward past its half width is `None`. `Error::SelfIntersecting` in lib.rs with Display "that offset would cross itself"; `pub mod offset`.

#### Task 2.2: offset_face and offset_edges

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel/src/offset.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** `Document::offset_face(f, distance)`: lock check on the owner, distance finite and over `tol::LENGTH`, loops to `P2` in `plane.basis()` (outer counter-clockwise, holes clockwise as stored), `offset_loop` on every loop before anything is written (any `None` is `SelfIntersecting`), back to 3D, each loop's segments through `insert_segment` (line.rs:30) and all drawn edges through one `heal_around` (line.rs:191); returns the edges. `Document::offset_edges(ctx, edges, distance)`: lock check on `ctx`, the edges ordered into one path by shared vertices (`Degenerate("edges are not one chain")` otherwise), the plane from `Plane::from_loop` of the path's points or, when that is `None`, from a face a chain edge bounds (`Degenerate("edges do not lie in one plane")` when neither), `offset_loop(pts, d, closed)` with d positive to the right of the chain (the same side as for a loop), then drawn and healed the same way.

#### Task 2.3: Kernel offset tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.2]
- **Files:**
  - Create: kernel/tests/offset.rs
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Using `tests/common`: a 120 × 96 ground rectangle offset -4 gives 2 faces and 8 edges, an inner face of area 112 × 88 and a ring of the remainder; offset +3 gives a 126 × 102 ring around the original; a wall with a window hole offset inward moves the hole outline with it (hole count kept, areas); an L-shaped face offset inward past its notch width returns `Error::SelfIntersecting` and leaves face, edge and vertex counts unchanged; two edges forming an L on the ground offset 2 add exactly two edges and no face; the same chain drawn on a face splits the face; three edges that do not connect are `Degenerate`; a locked definition is `Locked`; undo after an offset restores the counts; `validate` after each.

#### Task 2.4: Architecture doc for offset

- **Type:** document
- **Status:** pending
- **Dependencies:** [2.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Add an Offset paragraph to § 2 "Sticky geometry: the operations" after Copy: offset in the face's plane basis, mitred corners, drawn through the segment path and healed so the face splits into ring and inner, refused when self-intersecting (trimming deferred); add `offset_face` and `offset_edges` to the tag-lock list (:170) and `Error::SelfIntersecting` where errors are listed.

### Phase 3: Fuzz Operations

**Status:** pending
**Dependencies:** [Phase 1, Phase 2]

#### Task 3.1: Rotate and Offset ops in the harness

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 1, Phase 2]
- **Files:**
  - Modify: kernel/tests/common/fuzz.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** `Op::Rotate { point, normal, axis, angle }` and `Op::Offset { point, normal, distance }` (fuzz.rs:47), their names, `apply` arms (the face found as `MoveFace` does, `transform_and_integrate` with `mat_rotation(point, axis, angle)`; `offset_face(f, distance)`), `render_op` arms, and two generator slots with weights `[12, 20, 15, 8, 6, 8, 3, 5, 4, 3, 4, 4]` (zero when crowded): Rotate picks an axis from X, Y, Z or the face normal and an angle from ±15°, ±30°, ±45°, ±90°, ±180° or a random one; Offset a whole-inch distance in [-12, 12] other than 0. Both fall back to a `Line` when no face exists, as `MoveFace` does.

#### Task 3.2: Fuzz run time check

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: kernel/tests/fuzz.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Run `random_operations_keep_invariants` and record its time in the test's comment (fuzz.rs:31); if it exceeds 40 s in a debug build, lower the step count or the new weights until it is under; any failure found is shrunk and pasted into `kernel/tests/fuzz_regressions.rs` with its fix in this phase's commit.

#### Task 3.3: The fuzz rule in the architecture doc

- **Type:** document
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** § 9 "Randomized test" (architecture.md:286) lists rotate and offset among the operations and states the rule: every sprint that adds a kernel editing operation adds it to the fuzz `Op` enum in the same sprint.

### Phase 4: Wasm, Model and App Math

**Status:** pending
**Dependencies:** [Phase 1, Phase 2]

#### Task 4.1: Wasm exports

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 1, Phase 2]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `transformVertices`, `transformAndIntegrate`, `copyGeometryTransformed`, `copyInstanceTransformed` (the 16-number check of `setTransform`, lib.rs:233; JSON as `copyGeometry`, :190), `offsetFace` and `offsetEdges` (edge ids as `addLine` returns them); errors through `js()`; the existing exports unchanged.

#### Task 4.2: Model wrappers

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `transformVertices`, `transformAndIntegrate`, `copyGeometryTransformed`, `copyInstanceTransformed`, `offsetFace`, `offsetEdges` next to their offset forms (model.ts:147-166), all through `changed()`, matrices as `Float64Array.from(m)`.

#### Task 4.3: rotation, parseAngle and formatAngle

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: app/src/math.ts
  - Modify: app/src/units.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `rotation(center, axis, angle)` in math.ts next to `translation` (math.ts:100), column-major and equal to the kernel's `mat_rotation`; `parseAngle(text)` (degrees; `37`, `37°`, `37deg`, `-15`, `22.5`, fractions through the existing `number` helper; NaN otherwise) and `formatAngle(degrees)` in units.ts next to `parseArray`.

#### Task 4.4: Math and units tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.3]
- **Files:**
  - Modify: app/test/math.test.ts
  - Modify: app/test/units.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** math.test.ts: `rotation` 90° about Z through the origin maps X to Y, a rotation about an off-origin centre keeps the centre fixed, `invert(rotation(...))` is the opposite rotation. units.test.ts: a `parseAngle` describe with the accepted spellings and NaN cases (`5x`, `""`, `abc`); `formatAngle(37)` is `37°`, `formatAngle(-22.5)` is `-22.5°`.

### Phase 5: Rotate Tool

**Status:** pending
**Dependencies:** [Phase 4]

#### Task 5.1: Protractor in the overlay

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 4]
- **Files:**
  - Modify: app/src/tools/tool.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Overlay.protractor` with `center`, `normal`, `radius`, optional `start` and `angle` (tool.ts:24).

#### Task 5.2: RotateTool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Create: app/src/tools/rotate.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Examples](spec.md#examples)
- **Description:** The three-state tool of spec.md § Rotate tool without the copy branch: idle hover with `hoverEntity` and the protractor preview from `protractorNormal(r)` (face, camera-facing face of a hovered edge, ground, arrow-key axis), centre pick-up with Move's selection and lock rules (move.ts:98-108), start direction, sweep with 15° snapping on `ground` / `plane` / `onFace` results, `apply(angle)` as `MoveTool.apply` with `transformVertices` and `setTransform`, `commit()` with `transformAndIntegrate` in one "Rotate" transaction, `vcb` with `parseAngle` (during the sweep, and the undo-and-redo retype after a commit), hints, `vcbLabel` "Angle", Escape, `deactivate`.

#### Task 5.3: App wiring and protractor drawing

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `rotate: new RotateTool(this)` in `tools` (app.ts:78), `q: "rotate"` in `keys` (:850), a Rotate (Q) button after Move in index.html (:43); `drawOverlay` (:535) renders `o.protractor` into a `"protractor"` segment layer: a 72-segment circle, ticks every 15° (longer every 90°), the start ray and the swept arc, cleared when absent.

#### Task 5.4: Rotate tool tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Create: app/test/rotate.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** With `TestHost` and the `grouped` / `box` helpers' pattern from tools.test.ts: a 2 × 10 stringer group rotated by clicking its corner on the ground, a start direction along red, then `rotate.vcb("37")` has a transform equal to `rotation(corner, Z, 37°)` applied to the original (`toBeCloseTo` per element), retyping `30` changes it and one `undo()` returns "Rotate"; a sweep to a point 22° round with the cursor on nothing commits 15° and `overlay.dims[0].text` reads `15°` before the commit, a sweep to an endpoint of another edge commits the exact angle; `overlay.protractor.normal` is the hovered wall's normal flipped toward the camera, a hovered edge's camera-facing face's normal, `[0, 0, 1]` over empty ground, and the locked axis after `inference.toggleAxisLock(0)`; the box's top face rotated `10` about its front edge stays 6 faces with no flash; Escape mid-rotate leaves the model unchanged; a group on a locked tag flashes the locked-tag toast.

#### Task 5.5: Rotate docs

- **Type:** document
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Modify: docs/features.md
  - Modify: README.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** features.md Rotate row (:66) "Built now" with the protractor-plane and snapping rules; README Tools list (:13) and Keys table (:69) gain Rotate (Q) with the 37° stringer example; architecture.md § 6 overlay sentence names the protractor data and § 10 status (:295) lists Rotate; the two stale § 10 bullets (:297 "Moved vertices do not weld", :299 "A move that would bend a face is rejected"), done by MovesThatStick, are dropped (backlog #mvscxby4).

### Phase 6: Rotate-Copy and Radial Arrays

**Status:** pending
**Dependencies:** [Phase 5]

#### Task 6.1: Copy modifier and array replay in RotateTool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 5]
- **Files:**
  - Modify: app/src/tools/rotate.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** `modifier(copy)` and `pendingCopy` as in Move (move.ts:62-65), `cursor` "copy" while copying, the copy hint naming `6x` / `/6`; `commit()`'s copy branch aborts the preview and runs `makeCopies(selection, [m])` through `copyGeometryTransformed` / `copyInstanceTransformed` in one "Copy" transaction, selecting the copies and recording `lastCopy` with the revision; `vcb` tries `parseArray` first and `array(spec)` undoes the last Copy and replays `rotation(center, normal, angle * k)` (times) or `angle * k / n` (divide) for `k = 1..n` in one transaction with the revision guard and "Copy something first"; a typed angle after a copy retypes it as a copy only while it is the last step (`copyIsLastStep`).

#### Task 6.2: Rotate-copy tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Modify: app/test/rotate.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A post group rotate-copied 60° about a centre with `copyClick` leaves the original and adds one instance whose transform is `rotation × original`; `5x` then gives six instances at 60° steps as one undo step (`undo()` returns "Copy" and leaves one); `/6` after a 180° copy gives six evenly spread (transforms at 30° steps); `6x` after a plain rotate flashes "Copy something first"; `modifier(true)` mid-rotate switches to a copy and `cursor` reads "copy"; a loose face rotate-copied about a shared edge welds (face count by `stats()`).

#### Task 6.3: Rotate-copy docs

- **Type:** document
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Modify: README.md
  - Modify: docs/features.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** README's copy-and-arrays paragraph (:14) and Keys row (:73) say the modifier works in Rotate too, with the `6x` / `/6` radial example (six posts around a table); features.md Rotate row names copy-rotate arrays as built.

### Phase 7: Offset Tool

**Status:** pending
**Dependencies:** [Phase 4]

#### Task 7.1: OffsetTool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 4]
- **Files:**
  - Create: app/src/tools/offset.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Examples](spec.md#examples)
- **Description:** The tool of spec.md § Offset tool: face pick as `PushPullTool.pickFace` (pushpull.ts:50) or the selected edge chain, `ref` from the boundary edge nearest the first click (face) or the chain's first edge, the plane from the hit or the chain's points (Newell through `planeFrom`; a collinear chain takes a bounding face's plane), `apply(d)` previewing with the real `offsetFace(face, -d)` / `offsetEdges(ctx, edges, -d)` (the tool's sign is inward / left, the kernel's outward / right) in a "Offset" transaction as Push/Pull does (pushpull.ts:79), one flash per distinct kernel message, `commit()` committing the preview and recording `last`, `vcb` with `parseLength` (sign follows the preview; retype after a commit as `PushPullTool.vcb`, :128), hints, Escape, `deactivate`.

#### Task 7.2: App wiring

- **Type:** implement
- **Status:** pending
- **Dependencies:** [7.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `offset: new OffsetTool(this)` in `tools`, `f: "offset"` in `keys`, an Offset (F) button after Rotate in index.html.

#### Task 7.3: Offset tool tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [7.1]
- **Files:**
  - Create: app/test/offset.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** With the shed box: hover the front wall, click near its bottom edge, hover inward, `offset.vcb('4"')` adds one face and the inner face measures 112 × 88 (by `facePlane().area`); a Push/Pull of the ring then succeeds; retyping `6"` changes the inner area and one `undo()` returns "Offset"; a window rectangle drawn on the back wall offset outward `3"` adds a ring (face count); `-3"` typed during the preview flips the direction; two edges forming an L drawn on the ground, selected with Select, offset `2"` add exactly two edges and no face; an L-shaped face offset inward past its notch flashes "that offset would cross itself" and leaves `stats()` unchanged; Escape mid-offset leaves the model unchanged.

#### Task 7.4: Offset docs

- **Type:** document
- **Status:** pending
- **Dependencies:** [7.1]
- **Files:**
  - Modify: docs/features.md
  - Modify: README.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** features.md Offset row (:57) "Built now" with the sign and refusal rules; README Tools list and Keys table gain Offset (F) with the wall-thickness and trim examples; architecture.md § 10 status lists Offset and the self-intersecting refusal under known limits.

### Phase 8: Deck Walkthrough and Roadmap

**Status:** pending
**Dependencies:** [Phase 6, Phase 7]

#### Task 8.1: Deck walkthrough

- **Type:** document
- **Status:** pending
- **Dependencies:** [Phase 6, Phase 7]
- **Files:**
  - Create: docs/walkthrough-deck.md
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** In `walkthrough-shed.md`'s format (Prerequisites, numbered Steps naming the tool, click, typed value and expected result, Results, Known gaps): the 12' × 10' frame on 4 × 4 posts, joists at 16" centres by `9x` (2.1), the stair stringer drawn flat and rotated to `37` with the protractor on the ground, the railing: a rectangle on the deck edge offset inward `1 1/2"`, the ring pulled `36"`, balusters copied with `/5`; a Known gaps line that round posts wait for the curves sprint.

#### Task 8.2: Roadmap, sprints and status docs

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.1]
- **Files:**
  - Modify: docs/roadmap.md
  - Modify: docs/sprints.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** roadmap.md rows (:35-41): 2.2 becomes "Rotate with a protractor, rotate-copy and arrays, Offset (faces and edge chains). Done, sprint RotateAndOffset, 2026-11", rows 2.4–2.8 renumbered 2.3–2.7, the Milestone 2 test-project line points at `walkthrough-deck.md`; sprints.md § Sprint 2.2 open questions replaced by the resolutions (protractor plane rule, refused self-intersection); architecture.md § 11 row (:310) drops rotate and offset.

#### Task 8.3: Walkthrough check

- **Type:** test
- **Status:** pending
- **Dependencies:** [8.1]
- **Files:**
  - Modify: app/test/offset.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A headless replay of the walkthrough's railing steps (rectangle on the deck edge, Offset `1 1/2"`, Push/Pull the ring `36"`, `/5` copies of a baluster group) asserting the face and instance counts the walkthrough states, so the document's numbers are checked by `npm test`.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.

## Plan Review

**Reviewed:** 2026-11-04

- [x] Requirements to Spec traced
- [x] Spec to Plan traced
- [x] Proposed ADRs checked against accepted
- [x] Checklist passed (2 warnings accepted: Tasks 5.3 and 7.2 change `app.ts` and `index.html` wiring with no test, as keydown and the toolbar are DOM-bound and untested today; 1 blocking issue fixed: the chain offset sign in `offset_edges` said left while `offset_loop` offsets to the right, now right in both, with the tool passing `-d` for chains as for faces)

**Plan Status:** Ready for implementation
