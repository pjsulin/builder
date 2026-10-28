# Sprint Kickoff: CopyAndArrays

**Captured from conversation:** 2026-10-28

## Context

Every repeated part (joists, rafters, deck boards, posts) is drawn one at a time: the Move tool (`app/src/tools/move.ts`) has no copy modifier, and the kernel has no operation that duplicates geometry or instances. Milestone 2 sprint 2.1 in `docs/sprints.md`, the most-used action in building models. Fourth of four sprints planned on 2026-10-28, to be executed by a Claude Code cloud session; it follows 1.2 because copies of loose geometry stick using that sprint's welding.

## Decisions

- **Copy is a Move modifier, not a new tool:** Ctrl (Option on Mac) held while moving copies, as in SketchUp; the Move tool's preview, inference and Measurements-box retyping carry over unchanged.
- **Arrays are retyping:** after a copy, typing `5x` or `/5` into the Measurements box re-runs the last copy as an array, through the same `typed` path push/pull and move use for retyping (`tool.ts`), until the next operation.
- **One undo step per array:** the copy and its array are one transaction, so `9x` undoes as one.
- **Copies of groups are new groups, not components:** components arrive in 3.1; a kernel `copy_instance` makes a new instance of the same definition (which is what a group copy is in the data model already).

## Scope

**In scope:**

- Kernel: `copy_vertices`/`copy_geometry(ctx, faces, edges, offset)` that duplicates loose geometry translated by `offset` and integrates it (1.2's welding), and `copy_instance(inst, offset)` for groups; journaled.
- Move tool: Ctrl toggles copy mode before or during a drag; status bar text and cursor show it; release commits a copy.
- Linear arrays: `Nx` makes N copies at the last spacing, `/N` spaces N copies evenly across the last distance; retyping replaces the previous array in the same transaction.
- Copying many groups stays fast: 50 joists copied in one array without a visible pause (measured by a timed kernel test and the wasm bench).
- Headless tool tests in `app/test/` for copy, `9x`, `/9`, and undo as one step; kernel tests for the copy operations and their invariants.
- Browser check: draw a 2×8 joist as a group, copy 16" along red, type `9x`; `/9` across 12'.

**Out of scope:**

- Rotate-copy and radial arrays (2.2).
- Components and make-unique (3.1): copies of groups stay independent groups.
- Copying between contexts (into a different open group): copies land in the context they came from.

## Technical Approach

- Kernel: copying loose geometry maps selected vertices to new vertices at `pos + offset`, recreates edges and faces with the same materials and attributes, then runs the 1.2 integration on the new edges. Instances copy via `new_instance(def, parent)` plus `set_transform` with the translated matrix.
- Wasm exposes `copy_geometry` and `copy_instance`; `Model` wraps them with journal-aware `changed()`.
- Move tool state gains `copy: boolean` and `lastCopy: {items, offset}`; `typed("5x")` and `typed("/5")` are parsed in `units.ts` next to the length parser and dispatched to an `array` method that aborts the open transaction and replays N copies.
- Performance: an array of instances is N `copy_instance` calls in one transaction; buffers rebuild once at commit.

## Open Questions

- Whether `Nx` after a plain (non-copy) move should also array, as SketchUp allows, or require a copy first.
- Parsing `5x` vs `x5` and `/5`; whether `*5` is accepted too.
- Whether copies of groups should become components automatically (3.1 says yes later; no here).
- How the cursor and status bar show copy mode on Mac where Ctrl is the context-click key.

## References

- `docs/sprints.md` § Sprint 2.1, `docs/roadmap.md` 2.1, `docs/features.md` move/copy row
- `app/src/tools/move.ts` (`commit`, `last`, preview), `app/src/tools/tool.ts` (`typed`), `app/src/tools/pushpull.ts` (retyping pattern), `app/src/units.ts`
- `kernel/src/doc.rs` (`new_instance`, `begin`), `kernel/src/group.rs` (`set_transform`, `make_group`), `kernel/src/edit.rs`
- `kernel-wasm/src/lib.rs`, `app/src/kernel/model.ts` (`changed`, `commit`, `abort`)
- Sprint MovesThatStick kickoff (integration step this sprint reuses)
