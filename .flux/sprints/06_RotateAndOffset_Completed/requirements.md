---
created: 2026-10-28
sprint: RotateAndOffset
start: 4f22f3b
started: '2026-11-04'
step: '5'
---

# Requirements: RotateAndOffset

## Background

Milestone 1 (sprints 1.1–1.3) and sprint 2.1 CopyAndArrays are merged on `main`. The Milestone 2 test project (a 12' × 10' deck on posts, a rotated stair, railings by Offset and Copy) needs angled parts and thickened outlines next, and the kernel has neither: Move only translates (`move_vertices` and `move_and_integrate` take an offset, `copy_geometry` and `copy_instance` too), the only instance operation is `set_transform`, and nothing offsets an outline. `docs/sprints.md` § Sprint 2.2 is the plan: "angled parts and thickened outlines", done when "a stair stringer can be rotated to 37° by typing it", "offsetting a wall's face inward 4" and pushing the ring makes a wall thickness", "offsetting a window rectangle outward 3" and pulling makes trim", and both tools retype from the Measurements box. The kickoff (2026-10-28, `kickoff.md`) bundles Rotate and Offset in one sprint as the sprint doc does, and corrects the roadmap's row numbering (Rotate 2.2, Offset 2.3 become one row 2.2).

## Summary

A kernel transform path shared by Move and the new Rotate (fold, move, weld and settle under any rigid transform), a kernel offset of a face outline or an edge chain that refuses self-intersecting results, a Rotate tool with an on-screen protractor, rotate-copy and radial arrays through the 2.1 array path, an Offset tool, fuzz operations for both, and the deck walkthrough's stair and railing steps.

## Goals

### Primary Goal

Angled parts and thickened outlines: a stair stringer rotated to 37° by typing it, a wall thickened by an inward offset, window trim by an outward one.

### Secondary Goals

- Rotate-copy with the 2.1 modifier and `6x` / `/6` radial arrays, as one undo step.
- Rotate and Offset retype from the Measurements box like every other tool.
- The randomized kernel test covers rotation and offset, and that becomes the standing rule for later tool sprints.

## Features

### Feature 1: Kernel transform path

**What:** `transform_vertices(verts, m)` (preview) and `transform_and_integrate(verts, m)` (commit) take a `Mat4`; `move_vertices` and `move_and_integrate` become their translation wrappers, so there is one fold rule (`fold_for_move` generalised to a per-vertex target position) and one `integrate_moved`. `mat_rotation(center, axis, angle)` in `math.rs` builds the rotation both loose geometry and instances (`set_transform`) use. `copy_geometry_transformed` and `copy_instance_transformed` place a copy under a `Mat4`; the offset forms wrap them. Every new entry point checks the tag lock (ADR mvr2opid).
**Why:** Rotating loose geometry must weld and fold exactly as Move does (Background: "Rotating loose geometry welds like Move. Rotation that would bend faces folds them"), without duplicating the move path.
**Details:** A face all of whose vertices are transformed carries its normal through the transform (a 180° rotation is not "inside out"); a face partly transformed keeps its normal and folds or is refused as under Move. Fold diagonals are judged in the face's pre-transform plane, as today.
**Integration:** `kernel/src/edit.rs`, `kernel/src/group.rs`, `kernel/src/math.rs`; wasm exports; `Model` wrappers; `fuzz.rs` `Op::Rotate`.

### Feature 2: Kernel offset

**What:** `offset_face(f, distance)` offsets a face's outer loop and holes in the face's plane (positive outward, negative inward, mitred corners) and draws the result through `insert_segment` and `heal_around`, so an inward offset splits the face into a ring and an inner face and an outward one adds a ring. `offset_edges(ctx, edges, distance)` offsets a connected coplanar chain of edges the same way without closing it. A result that self-intersects, reverses an edge or loses its area is refused with a new `Error::SelfIntersecting`; nothing is written.
**Why:** Wall thickness, frames and trim (Background); the deck railings.
**Details:** Pure 2D `offset_loop` in a new `kernel/src/offset.rs`, tested on its own; the kickoff decision "a self-intersecting offset is refused" (trimming to valid loops is deferred).
**Integration:** `kernel/src/offset.rs`, `lib.rs` (`Error`), wasm exports, `Model` wrappers, `fuzz.rs` `Op::Offset`.

### Feature 3: Rotate tool with a protractor

**What:** Pick a centre, a start direction, then sweep or type the angle. The protractor's plane comes from the face under the cursor, from a face using the hovered edge (the one facing the camera when two do), else the ground; the arrow keys override it with the red, green or blue axis. 15° snapping when the cursor is on nothing; a point inference (endpoint, midpoint, on edge) wins exactly. The preview is the cheap displacement; the commit folds, welds and settles. Retype after commit.
**Why:** "A stair stringer can be rotated to 37° by typing it" (Background).
**Details:** `RotateTool` mirrors `MoveTool`: a `rotating` record, one Rotate transaction, `last` for retyping. Protractor data in `Overlay.protractor`, rendered by the app. Angle parsing (`37`, `37°`, `-15`, `22.5`) in `units.ts`.
**Integration:** `app/src/tools/rotate.ts`, `app/src/tools/tool.ts` (`Overlay`), `app/src/app.ts`, `app/index.html`, shortcut Q.

### Feature 4: Rotate-copy and radial arrays

**What:** The copy modifier (Option on Mac, Ctrl elsewhere) during a rotate copies instead; `6x` or `/6` typed afterwards replays the last rotate-copy as a radial array in one undo step, through `parseArray`. Rotate-copies of groups are independent groups (the 2.1 rule).
**Why:** Sprint text: "Rotate-copy with Ctrl, including radial arrays (`6x`, `/6`)".
**Details:** The same shape as Move in 2.1: `lastCopy` with the model revision guards the replay; the array is one `Copy` transaction.
**Integration:** `RotateTool.modifier`, `copyGeometryTransformed` / `copyInstanceTransformed`.

### Feature 5: Offset tool

**What:** Hover a face (or have an edge chain selected), click, move or type the distance, click. The distance is the cursor's travel perpendicular to the boundary edge nearest the first click, into the face; for a chain, to the cursor's side of the chain. A typed positive value goes the way the preview goes (inward for a face, before any movement), a negative one the other way. A refused offset flashes the kernel's message and keeps the last good preview. Retype after commit.
**Why:** "Offsetting a wall's face inward 4" and pushing the ring makes a wall thickness. Offsetting a window rectangle outward 3" and pulling makes trim" (Background).
**Details:** `OffsetTool` previews with the real operation like Push/Pull (`begin` / `abort`, `commit`), `last` for retyping.
**Integration:** `app/src/tools/offset.ts`, `app/src/app.ts`, `app/index.html`, shortcut F.

### Feature 6: Fuzz operations and docs

**What:** `Op::Rotate { point, normal, axis, angle }` and `Op::Offset { point, normal, distance }` in `kernel/tests/common/fuzz.rs`, generated at small weights so the CI run stays under a minute; the rule that every tool sprint adds its kernel operations to the fuzz `Op` enum is written into `docs/architecture.md` § 9. Docs: architecture (operations, lock list, status), features rows, README tools and keys, roadmap renumbering, a new `docs/walkthrough-deck.md` with the deck steps so far (frame, joists by array, rotated stair, railing by Offset and Copy), finished when round posts arrive.
**Why:** Kickoff decision "New tools get fuzz operations"; the deck test project is how the sprint is checked in the browser.
**Integration:** `kernel/tests/common/fuzz.rs`, `docs/`, `README.md`.

## Success Criteria

### For Feature 1

- [x] Kernel tests: a box rotated whole about a corner stays closed with the same volume; a box's top rotated about its front edge gives a closed wedge with no folds; a top edge rotated so a wall would bend folds it; a copy rotated 180° about a shared edge welds into one solid; `copy_instance_transformed` gives `rotation × transform`; `move_and_integrate` tests unchanged and passing; `Error::Locked` on a locked definition; `validate` after each. (`kernel/tests/rotate.rs`: six tests, `cargo test --test rotate` 6 passed; `move.rs` 10 and `copy.rs` 7 passed through the wrappers)
- [x] `mat_rotation` unit tests: 90° about Z maps X to Y, the centre stays fixed, angle 0 is the identity, a zero axis is `None`. (`math::tests::rotation_about_z_maps_x_to_y_and_keeps_the_centre`, `zero_angle_is_the_identity_and_a_zero_axis_is_none`)

### For Feature 2

- [x] Kernel tests: a 120 × 96 rectangle offset inward 4" gives a ring and a 112 × 88 inner face; outward 3" gives a 126 × 102 ring around it; a face with a hole offsets the hole with it; an L-shaped face offset inward past its notch is refused with `Error::SelfIntersecting` and the document is unchanged; a two-edge chain offset 2" adds two edges and no face; the chain offset on a face splits the face; non-chain edges are refused; locked refused; undo removes the offset. (`kernel/tests/offset.rs`: eight tests, 8 passed)
- [x] `offset_loop` unit tests: a square inward and outward, a triangle, collinear points, a closed loop versus an open chain. (`offset::tests`: five tests including the thin rectangle and the L past its notch as `None`)

### For Feature 3

- [x] Headless tool test: a 2 × 10 stringer group rotated by typing `37` about the ground plane has a transform equal to `rotation(centre, Z, 37°)` applied to the original; retyping `30` changes it; one undo returns "Rotate". (`rotate.test.ts` "rotates a stringer group by a typed angle about the ground plane, retypes it and undoes as one step")
- [x] Headless tool test: a sweep at 22° with the cursor on nothing commits 15° and the dims label reads `15°`; a sweep to an endpoint commits the exact angle. ("snaps a sweep over nothing to 15° and takes an endpoint exactly": dims and VCB read `15°`, the endpoint commits 22°)
- [x] Headless tool test: the protractor overlay carries the hovered face's plane, a hovered edge's camera-facing face's plane, the ground otherwise, and the locked axis when an arrow key is down. ("puts the protractor on the hovered face, a hovered edge's camera-facing face, the ground, or the locked axis")
- [x] Headless tool test: a box's top face rotated 10° about its front edge by typing stays a 6-face solid; Esc cancels with no change; a locked group is refused with the locked-tag toast. ("tilts a box's top about its front edge by a typed angle without folding": 6 faces, 12 edges, no flash; "cancels with Escape and refuses a locked group")

### For Feature 4

- [x] Headless tool test: a group rotate-copied 60° then `5x` gives six instances around the centre as one undo step; `/6` after a 180° copy gives six evenly spread; `6x` after a plain rotate flashes "Copy something first". ("leaves the original and places a rotated copy, then 5x makes six posts around the centre as one step"; "spreads six copies evenly with /6 after a half-turn copy, and retypes the count"; "refuses an array after a plain rotation or once the model changed")

### For Feature 5

- [x] Headless tool test: the front wall of the shed offset inward by typing `4"` has one more face (ring plus inner) and the inner face measures 112" × 88"; the Push/Pull of the ring then works; retyping `6"` changes the inner face. (`offset.test.ts` "thickens the front wall inward by a typed distance, retypes it and undoes as one step": 112 × 88 then 108 × 84; "pushes the ring the offset made, giving the wall a reveal")
- [x] Headless tool test: a window rectangle on a wall offset outward `3"` gives a ring around it; a negative typed value flips the direction. ("offsets a window outline outward for trim, and a minus flips the direction": a 42 × 30 ring)
- [x] Headless tool test: two selected edges forming an L offset 2" add two edges; an L-shaped face offset too far flashes the kernel message and leaves the model unchanged. ("offsets two selected edges forming an L and adds no face"; "refuses an L-shaped face offset past its notch, with one flash, and leaves the model unchanged")

### For Feature 6

- [x] `random_operations_keep_invariants` generates `Op::Rotate` and `Op::Offset` and still finishes under a minute in a debug build; `render_test` prints both ops. (10 Rotate and 17 Offset ops at the CI seed, `BUILDER_FUZZ_TRACE=1`; 25.2 s in a debug build; `render_op` has both arms; a 25-minute run at seed 7 found nothing)
- [x] Docs updated per Impact; `docs/walkthrough-deck.md` exists with the stair and railing steps. (Gate 4 below: every Impact doc changed and verified; `docs/walkthrough-deck.md` steps 11 and 12, replayed by "Deck walkthrough" in `offset.test.ts`)

### For all

- [ ] Browser check by Patrick: the deck walkthrough's stair and railing steps in the hosted build. (waiting on Patrick after the merge)

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `docs/architecture.md` — § 2 operations (transform path, offset), § 3 tag-lock entry-point list, § 6 `Overlay` protractor, § 9 fuzz rule, § 10 status, § 11 table row
- `docs/features.md` — rows Rotate (:66) and Offset (:57) become "Built now"
- `docs/roadmap.md` — row 2.2 becomes Rotate and Offset (done), rows 2.3–2.8 renumbered from the old 2.4–2.8
- `docs/sprints.md` — § Sprint 2.2 open questions resolved
- `README.md` — Tools list, Keys table (Q, F), Rotate and Offset usage with the stair and railing examples
- `docs/walkthrough-deck.md` — new: the deck test project so far

### ADRs

- `mvr2opid Tag lock enforced by the kernel`: every new kernel entry point checks the lock
- `mvr2op7t Namespaced attributes in the builder format`: transformed copies keep attributes
- None superseded; none proposed

### Backlog

- #mvr7ne51 Phone capture test by Patrick: out of scope (survey)
- #mvscxby4 Doc drift in docs/architecture.md: closes (Task 5.5 drops the two stale § 10 bullets the item names while it edits that section)

## Scope

### In Scope

**Must Have:** Features 1–5.
**Should Have:** Feature 6's fuzz operations and the deck walkthrough.

### Out of Scope

- Trimming self-intersecting offsets to their valid loops: its own research; refused for now.
- Shared definitions for rotate-copies: Components (3.1).
- A click-drag protractor axis gesture: the face plane and axis locks cover the deck project.
- Scale, Flip, the rotated rectangle, curves: later rows.
- Guides and the Protractor guide tool: 2.3 Tape Measure and guides.

### Open Questions

Resolved at plan time (2026-11-03), recorded in spec.md § Decisions:

- Snapping: 15° applies when the cursor is on nothing (ground, plane, on face); an endpoint, midpoint or on-edge inference wins exactly. Shift keeps its inference-lock role and does not release the snap.
- Offset direction for a chain: the cursor's side of the chain; typed positive follows the preview, negative flips it; before any movement positive is inward for a face and to the left of the chain's direction for edges.
- Fold plane under rotation: the face's pre-transform plane, as `fold_for_move` does today.
- The deck steps go in a new `docs/walkthrough-deck.md`, started this sprint and finished when round posts arrive.
