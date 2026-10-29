---
sprint: "RotateAndOffset"
created: 2026-10-28
start: null    # commit; set by `flux sprint move <Name> Current`, close diffs against it
started: null  # date; set by the same move
step: '5'
---
# Requirements: RotateAndOffset

## Background

Milestone 1 (sprints 1.1–1.3) and sprint 2.1 CopyAndArrays are merged on `main`. The Milestone 2 test project (`docs/roadmap.md`: "a 12' × 10' deck on posts, with joists at 16" centers by array, a rotated stair, railings made with Offset and Copy, and round posts") can now have its joists but not its stair or railings: the kernel has no rotation (Move only translates: `move_vertices` and `move_and_integrate` in `kernel/src/edit.rs` take an offset, and the only instance operation is `set_transform`), and nothing offsets an outline. `docs/sprints.md` § Sprint 2.2 states the goal: "angled parts and thickened outlines", done when "a stair stringer can be rotated to 37° by typing it", "offsetting a wall's face inward 4" and pushing the ring makes a wall thickness", "offsetting a window rectangle outward 3" and pulling makes trim" and both tools have the Measurements-box retyping of the other tools. Patrick's statement (kickoff, 2026-10-28): Sprint 2.2 is planned as a flux sprint for a Claude Code cloud session as the earlier sprints were; Rotate and Offset together, with the kickoff's decisions settled: rotate-copies of groups are independent groups, the protractor plane comes from the hovered face else the ground with arrow-key locks, self-intersecting offsets are refused, rotate-copy and radial arrays mirror 2.1's Move copy and `parseArray`, and new tools get fuzz operations.

## Summary

A Rotate tool with an on-screen protractor (centre, start direction, sweep or type the angle, 15° snapping) whose committed rotation of loose geometry folds, welds and settles exactly as a committed Move does, with the copy modifier and `6x` / `/6` radial arrays; an Offset tool that thickens a face's outline or a selected edge chain by a dragged or typed distance and refuses a result that would cross itself; both covered by kernel tests, headless tool tests and the randomized kernel test.

## Goals

### Primary Goal

Angled parts and thickened outlines for the deck test project: a stair stringer rotated to 37° by typing it, and a wall face offset inward 4" whose ring, pushed, becomes a wall thickness.

### Secondary Goals

- Rotate-copy and radial arrays have the same shape as 2.1's Move copy: the copy modifier during a rotate copies, and `6x` or `/6` typed afterwards replays the last rotate-copy as one undo step.
- Rotate and Offset retype from the Measurements box like the other tools.
- The randomized kernel test covers rotate and offset, and that becomes the standing rule for later tool sprints.
- The deck test project's stair and railing steps are written down in a walkthrough that Patrick can repeat in the browser.

## Features

### Feature 1: Kernel transform path

**What:** The kernel's move path generalises from an offset to a per-vertex target position given by a `Mat4`: `transform_vertices(verts, m)` (preview) and `transform_and_integrate(verts, m)` (commit: fold faces that would bend, move, weld and settle in the vertices' own definition) with `move_vertices` and `move_and_integrate` kept as the translation case. A rotation about an arbitrary axis through a point is a `Mat4` built in `kernel/src/math.rs` next to `mat_translation`, so an instance rotates by `set_transform` with the same matrix the loose geometry uses. A face whose every vertex moves keeps its front side (its normal is transformed with the matrix); a face that bends folds along inside diagonals under the one fold rule.
**Why:** Rotating loose geometry must weld like Move and fold what would bend (Background, sprint text); one path keeps one fold rule and one `integrate_moved`.
**Details:** The fold judges its inside diagonals on the face as it is before the transform, in its own plane, as the move fold does. `Error::Locked` for a locked definition (ADR mvr2opid); a non-finite matrix is refused.
**Integration:** `kernel/src/edit.rs`, `kernel/src/math.rs`; wasm `transformVertices` / `transformAndIntegrate`; `Model.transformVertices` / `Model.transformAndIntegrate`; `set_transform` unchanged.

### Feature 2: Kernel copy with a transform

**What:** `copy_geometry_with(ctx, faces, edges, m)` and `copy_instance_with(inst, m)` copy loose geometry or a group placed by a `Mat4` (a rotation for rotate-copy), with the 2.1 forms `copy_geometry` and `copy_instance` kept as the translation case. A copied group gets its own definition, as in 2.1.
**Why:** A rotate-copy is a copy followed by the transform (kickoff); shared definitions wait for Components (3.1).
**Details:** Copied faces take their normal through the matrix so a rotated copy keeps its front side; the copy integrates with what it lands on as `copy_geometry` does. Lock checks as in 2.1.
**Integration:** `kernel/src/edit.rs`, `kernel/src/group.rs`; wasm `copyGeometryWith` / `copyInstanceWith`; `Model.copyGeometryWith` / `Model.copyInstanceWith`.

### Feature 3: Kernel offset

**What:** `offset_face(face, distance)` offsets a face's outline by a signed distance in the face's own plane (outer loop and holes together, mitred corners), draws the new loops through `insert_segment` and heals them, so an inward offset splits the face into a ring and an inner face and an outward offset adds a ring around it. `offset_edges(edges, distance)` offsets a connected, planar chain of edges (open or closed) the same way without closing an open chain. `edge_chain(edges)` orders a chain and gives its plane, for tools. A result that would cross itself is refused with a clear error and nothing is drawn.
**Why:** Wall thickness, trim and railings (Background); the sprint's open question on concave shapes is answered by refusing (kickoff decision).
**Details:** Positive distance moves every loop away from the face's material (the outer loop grows, holes shrink); negative moves into it (the outer loop shrinks, holes grow). For a chain the sign is relative to its ordered walk. A collapsed or inverted loop, a loop that crosses itself, or holes that cross the outer loop are the refused cases. `Error::Locked` for a locked definition.
**Integration:** new `kernel/src/offset.rs`, re-exported from `kernel/src/lib.rs`; wasm `offsetFace` / `offsetEdges` / `edgeChain`; `Model.offsetFace` / `Model.offsetEdges` / `Model.edgeChain`.

### Feature 4: Rotate tool

**What:** Rotate (key Q): the protractor follows the cursor before the first click, lying in the plane of the face under the cursor, else a face of the hovered edge (the one facing the camera when two do), else the ground; the arrow keys override it with the red, green or blue plane. Click the centre, click a start direction, then sweep (15° snapping unless the cursor is on a point inference) or type the angle; click or Enter commits. The copy modifier (Option on Mac, Ctrl elsewhere) copies instead; `6x` or `/6` typed after a rotate-copy makes a radial array as one undo step; retyping changes the last rotate or the array count.
**Why:** Sprint text: Rotate with an on-screen protractor, rotate-copy with radial arrays, retyping.
**Details:** The selection rotates (faces and edges through their vertices, groups through `set_transform`); with nothing selected the entity under the cursor at the centre click is picked, as Move does. Preview is the cheap displacement (`transformVertices`); commit folds and welds (`transformAndIntegrate`). Locked geometry is refused before any preview. The angle shows in the Measurements box in degrees.
**Integration:** new `app/src/tools/rotate.ts`; `Overlay.protractor` in `app/src/tools/tool.ts` rendered by `app/src/app.ts`; `rotation(center, axis, angle)` in `app/src/math.ts`; `parseAngle` in `app/src/units.ts`; the copy replay shared with Move moves to `app/src/tools/copies.ts`; toolbar button and key in `app/index.html` and `app/src/app.ts`.

### Feature 5: Offset tool

**What:** Offset (key F): hover a face and click to start, move the cursor to set the distance (inside the face offsets inward, outside outward) and click again, or type the distance; with an edge chain selected, click to start and the cursor's side of the chain picks the direction. A refused offset (self-intersecting) flashes the kernel's message. Retyping changes the last offset.
**Why:** Sprint text: Offset of a face's outline or of a chain of selected edges, with typed distance and retype.
**Details:** The preview runs the kernel operation each pointer move and keeps the last accepted distance when the kernel refuses one; a typed distance keeps the current direction and a minus reverses it (Push/Pull's rule). After a chain offset the new edges are selected so Offset again works from them.
**Integration:** new `app/src/tools/offset.ts`; toolbar button and key.

### Feature 6: Fuzz operations

**What:** `kernel/tests/common/fuzz.rs` gains `Op::RotateFace` (the face found by geometry, its vertices rotated about an axis through a point) and `Op::OffsetFace` (that face offset by a signed distance), generated, applied, rendered and shrunk like the existing ops; the CI run stays under its time budget.
**Why:** Kickoff decision: new tools get fuzz operations so the CI run keeps covering what users do.
**Integration:** `kernel/tests/common/fuzz.rs`, `kernel/tests/fuzz.rs` (step count re-measured), `docs/architecture.md` § Randomized test.

### Feature 7: Docs and the deck walkthrough

**What:** `docs/architecture.md` describes the transform path, offset and the new fuzz ops and drops its two stale known-limits bullets; `docs/features.md` marks Rotate and Offset built; `docs/roadmap.md` merges rows 2.2 and 2.3 into 2.2 Rotate and Offset and renumbers the rest of Milestone 2 so 2.3 Tape Measure and guides follows, as `docs/sprints.md` has it; `README.md` lists the tools and keys; a new `docs/walkthrough-deck.md` records the deck test project's steps that work now (frame, joists by array, the rotated stair, railings by Offset and Copy), with round posts named as waiting for 2.4, and a headless test runs the same steps so its counts are checked.
**Why:** Kickoff decisions on the roadmap numbering and the walkthrough; close Gate 4.
**Integration:** the docs above, `app/test/deck.test.ts`.

## Success Criteria

### For Feature 1

- [ ] Kernel tests (`kernel/tests/rotate.rs`): a stair stringer face rotated 37° about an axis along its normal stays one planar face of equal area; a whole box rotated 30° about blue keeps 6 faces, 12 edges, its volume and passes `validate`; a vertical face rotated 120° about blue keeps its front side; rotating one corner of a box's top folds the faces that would bend; a rotated part that lands on other geometry welds (one solid, `validate` passes); an instance rotated with `set_transform(mat_rotation(..))` matches the loose geometry's positions; undo after a committed rotation restores the file byte for byte; a locked definition and a non-finite matrix are refused.
- [ ] `move_vertices` and `move_and_integrate` behave as before: the existing move, edit, attributes and fuzz tests pass unchanged.

### For Feature 2

- [ ] Kernel tests (`kernel/tests/copy.rs`): a group rotate-copied 90° about a point has its own definition with equal geometry and transform `R · T`; a loose face rotate-copied keeps its area and has its normal rotated; lock refusal as in 2.1.

### For Feature 3

- [ ] Kernel tests (`kernel/tests/offset.rs`): a 10' × 8' wall face offset inward 4" becomes a ring with a hole and an inner face, the ring's area is the difference, and pushing the ring 8' gives a closed solid of the wall-thickness volume; a window rectangle on a wall offset outward 3" splits the wall into a trim ring and the rest and pulling the ring works; a face with a hole offset inward grows the hole; an L-shaped face offset inward past its notch width is refused with a `Degenerate` error and the document is unchanged; an open three-edge chain offsets to three parallel edges with no new face; a closed chain offsets outward; `edge_chain` refuses edges that do not form one chain and a chain that is not planar; a locked definition is refused; every test calls `validate`.

### For Feature 4

- [ ] Headless tool tests (`app/test/rotate.test.ts`): a stringer group rotated to 37° by typing `37` has the transform of `rotation(center, blue, 37°)`; a loose face swept with the cursor snaps to 15° and the Measurements box shows the angle; the protractor plane is the hovered face's, the ground when nothing is hovered, and the red plane after the right arrow lock; a rotate with the copy modifier leaves the original and places a rotated copy; `6x` after a 60° rotate-copy of a group gives seven groups around the centre as one undo step and `/6` after a 60° copy gives six evenly spaced; retyping the angle changes the last rotate; a locked group is refused with the toast; Escape aborts and leaves the model unchanged.

### For Feature 5

- [ ] Headless tool tests (`app/test/offset.test.ts`): hovering a wall face, clicking, moving the cursor inside it and typing `4"` makes the ring and inner face and Push/Pull of the ring by 8' gives the wall thickness; a window face offset outward `3"` by moving the cursor outside it then Push/Pull of the ring gives trim; a selected three-edge chain offsets to the cursor's side; retyping changes the last offset; an offset the kernel refuses flashes its message and leaves the model unchanged; Escape aborts.

### For Feature 6

- [ ] `kernel/tests/fuzz.rs::random_operations_keep_invariants` runs with the two new ops in the generator and finishes under 60 s in a debug build with the headroom rule of 1.3 (re-measured and recorded in the test's comment); `render_test` prints the new ops so a shrunk failure pastes into `fuzz_regressions.rs`; the existing regression tests pass.

### For Feature 7

- [ ] `docs/roadmap.md` has one row 2.2 Rotate and Offset marked done and rows 2.3–2.7 renumbered to match `docs/sprints.md`; `docs/features.md` Rotate and Offset rows read "Built now"; `docs/architecture.md` has no known-limits bullet contradicting § Sticky geometry (backlog #mvscxby4); `README.md` names Rotate (Q) and Offset (F) and links the deck walkthrough; `docs/walkthrough-deck.md` exists with steps whose counts come from `app/test/deck.test.ts`.

### Overall

- [ ] `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `npm run build:kernel`, `npm run typecheck` and `npm test` pass.
- [ ] Browser check by Patrick: the stair and railing steps of `docs/walkthrough-deck.md` at https://pjsulin.github.io/builder/ after the merge.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `docs/architecture.md` — § Sticky geometry: Move paragraph becomes the transform path (rotate folds, welds and settles like Move), a Copy sentence for the transform forms, a new Offset paragraph with the sign convention and the refusal; § Build, test and run: the fuzz op list; § Status and known limits: drop the two stale bullets (moved vertices do not weld; a bending move is rejected) and name Rotate and Offset among the built tools.
- `docs/features.md` — Rotate with protractor row and Offset row: Built now, with the key facts.
- `docs/roadmap.md` — Milestone 2 table: rows 2.2 and 2.3 merged into 2.2 Rotate and Offset, done note; 2.4–2.8 renumbered to 2.3–2.7; the "Rough total" references to 2.1–2.4 and 2.5 updated.
- `README.md` — Tools line (Rotate, Offset), keys table (Q, F, the copy modifier during a rotate), a Rotate-and-Offset bullet under features, the deck walkthrough in the Docs list.
- `docs/walkthrough-deck.md` — new.
- `.flux/CLAUDE.md` and root `CLAUDE.md` — no change (no agent-guidance change).

### ADRs

- `mvr2opid Tag lock enforced by the kernel`: every new kernel entry point (`transform_vertices`, `transform_and_integrate`, `copy_geometry_with`, `copy_instance_with`, `offset_face`, `offset_edges`) checks the lock first.
- `mvr2op7t Namespaced attributes in the builder format`: fold pieces and copies keep face, definition and instance attributes; offset's refilled faces keep the old face's attributes through `heal`'s old regions.
- None superseded; none proposed.

### Backlog

- #mvscxby4 Doc drift in docs/architecture.md: closes (the two bullets are in the section this sprint edits).
- #mvr7ne51 Phone capture test by Patrick: out of scope.

## Scope

### In Scope

**Must Have:** Features 1–6; Feature 7's roadmap renumbering, architecture, features and README updates, and the stair and railing steps of the deck walkthrough.
**Should Have:** The deck walkthrough's frame and joist steps and the headless deck test that checks its counts.

### Out of Scope

- Trimming self-intersecting offsets to their valid loops: its own research; refused for now.
- Shared definitions for rotate-copies: Components (3.1).
- A click-drag protractor axis gesture: the face plane and the arrow-key locks cover the deck project.
- Scale, Flip and the rotated rectangle: 2.4. Round posts (curves): 2.4.
- Guides and the Protractor guide tool: 2.3.
- Axis colouring of the protractor by plane.

### Open Questions

Resolved at plan time (2026-10-29), recorded in spec.md § Decisions:

- Snapping: 15° unless the cursor is on a point inference (endpoint, midpoint, origin), which wins; Shift keeps its engine meaning and does not release the snap; typing is exact.
- Offset side and sign: the kernel takes a signed distance, positive away from the face's material (outward for a face or a closed chain, to the right of an open chain's walk seen from its plane's normal side); the tool derives the sign from the cursor's side (inside the face is inward) and a typed value keeps that direction, a minus reversing it.
- Fold diagonals for a rotation are judged on the pre-transform loop in the face's own plane, as the move fold does; the shared `fold_for_transform` makes it one rule, and a bending loop has no post-transform plane to judge in.
- The deck steps go in a new `docs/walkthrough-deck.md` started this sprint and finished in 2.4 (round posts), with `app/test/deck.test.ts` running the same steps.
