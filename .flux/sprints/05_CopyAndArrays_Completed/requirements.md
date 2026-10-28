---
created: 2026-10-28
sprint: CopyAndArrays
start: 480b033
started: '2026-10-28'
step: '4'
---

# Requirements: CopyAndArrays

## Background

Every repeated part (joists, rafters, deck boards, posts) is drawn one at a time: the Move tool (`app/src/tools/move.ts`) has no copy modifier and the kernel has no operation that duplicates geometry or instances. `docs/roadmap.md` 2.1 calls copy and arrays "the most-repeated action in building models." Patrick's statement (2026-10-28): plan Milestone 1 sprints 1.1–1.3 and 2.1 as flux sprints for Claude Code cloud sessions; everything verifiable with cargo and npm. This sprint follows MovesThatStick because copies of loose geometry stick using its welding.

## Summary

Ctrl (Option on Mac) during Move copies; typing `5x` or `/5` afterwards makes a linear array as one undo step; copies of groups are new groups and copying fifty stays fast.

## Goals

### Primary Goal

Repeated parts are fast: a joist drawn once becomes ten evenly spaced joists in one operation.

### Secondary Goals

- Arrays use the same Measurements-box retyping as the other tools.
- Copying many groups has no visible pause.

## Features

### Feature 1: Kernel copy operations

**What:** `copy_geometry(ctx, faces, edges, offset)` duplicates loose geometry (materials and attributes kept) translated by `offset` and integrates it with MovesThatStick's welding; `copy_instance(inst, offset)` deep-copies the group's definition (geometry, materials, attributes, child instances) and clones the instance record at the translated transform. Both journaled.
**Decision (2026-10-28):** copies get their own definition, not a shared one. `world_transform(def)` and `App.setContext` assume one instance per group definition, so a shared copy would open at the wrong transform and editing one joist would edit all; shared definitions arrive with components (3.1).
**Why:** No duplication exists in the kernel (Background).
**Integration:** `kernel/src/edit.rs` and `group.rs`; wasm exports; `Model` wrappers.

### Feature 2: Copy modifier in Move

**What:** Holding Ctrl (Option on Mac) before or during a move drag switches to copy; status bar and cursor show copy mode; release commits a copy.
**Why:** SketchUp's gesture, which users expect.
**Integration:** `MoveTool` state and `commit`.

### Feature 3: Linear arrays

**What:** After a copy, typing `Nx` makes N copies at the same spacing and `/N` spaces N copies evenly across the distance; retyping changes the count until the next operation; the copy and its array are one undo step.
**Why:** Joists at 16" centers by array (Milestone 2 test project).
**Details:** Parsed next to the length parser in `units.ts`; dispatched through the tool's `typed` path.
**Integration:** `MoveTool.typed`, `Model.abort/commit`.

### Feature 4: Performance

**What:** An array of fifty group copies commits without a visible pause.
**Why:** Sprint text.
**Details:** One transaction, buffers rebuilt once at commit; timed kernel test and bench.

## Success Criteria

### For Feature 1

- [x] Kernel tests: copied loose geometry is welded where it lands; a copied group has its own definition with equal geometry, materials and attributes; `validate` passes; undo removes the copy. Evidence: `kernel/tests/copy.rs::a_box_copied_flush_welds_into_one_solid` (one 20 x 10 x 10 box, volume 2000, `validate`, undo back to 6 faces), `a_copied_group_gets_its_own_equal_definition` (different definition, equal faces, edges, vertices, material, face, instance and definition attributes, translated transform, undo removes instance and definition), `a_nested_group_is_copied_recursively`.

### For Feature 2

- [x] Headless tool test: the copy modifier (Option on Mac, Ctrl elsewhere) during a move leaves the original and creates a copy at the offset. Evidence: `app/test/tools.test.ts` \"Move with the copy modifier\": \"leaves the original and places a copy at the typed distance\" (original at the origin, copy at 16\", one `Undo Copy`), \"switches to a copy when the modifier goes down mid-move\"; `copyKey` in app.ts picks `altKey` on Mac, `ctrlKey` elsewhere.

### For Feature 3

- [x] Headless tool test: a 2×8 joist group copied 16" along red, then `9x`, gives ten evenly spaced joists in one undo step. Evidence: \"Linear arrays\" > \"makes ten joists at 16 inch centres from one copy and 9x, as one undo step\" (x = 0, 16, ..., 144; one `undo()` returns \"Copy\" and leaves one).
- [x] Headless tool test: `/9` across 12' gives ten joists end to end. Evidence: \"spreads ten joists end to end with /9 across 12 feet\" (x = 0, 16, ..., 144).

### For Feature 4

- [x] A timed test shows a 50-instance array commits under a threshold set at plan time from the bench (set in spec.md Validation Criteria: 100 ms in a debug build). Evidence: `kernel/tests/copy.rs::fifty_instance_copies_commit_quickly` asserts under 100 ms in a debug build; `cargo run --release --example bench` prints `copy instance ×50: 10.5ms`.

### For all

- [ ] Browser check by Patrick of the joist example. Waiting on Patrick (close.md Gate 5): draw a 2x8 joist, group it, Move with Option (Mac) or Ctrl, type `16"`, then `9x`; Undo, then a 12' copy and `/9`.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `docs/features.md` — move/copy row
- `docs/architecture.md` — copy operations
- `docs/roadmap.md` — 2.1 status
- `README.md` — copy and array usage

### ADRs

- None cited.

### Backlog

- #mvr7ne51 out of scope

## Scope

### In Scope

**Must Have:** Features 1–3.
**Should Have:** Feature 4's timed test.
**Prerequisite:** MovesThatStick merged on the branch: `copy_geometry` calls its `integrate_moved(def, edges)` (spec.md § Technical Specifications). The array parser (plan Phase 3) does not depend on it.

### Out of Scope

- Rotate-copy and radial arrays (2.2).
- Components and make-unique (3.1).
- Copying into a different context.

### Open Questions

Resolved at plan time (2026-10-28), recorded in spec.md:

- `Nx` after a plain move: no; arrays need a prior copy ("Copy something first" otherwise).
- Accepted spellings: `5x`, `x5`, `5*`, `*5` (times) and `/5`, `5/` (divide); integers only.
- Copy key on Mac: Option (`altKey`), since Ctrl is context-click and Ctrl-click orbits; Ctrl elsewhere. Cursor reads `copy` and the hint names the array syntax.
