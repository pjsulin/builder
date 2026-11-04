# Sprint Kickoff: RotateAndOffset

**Captured from conversation:** 2026-10-28

## Context

Milestone 1 (sprints 1.1–1.3) and sprint 2.1 CopyAndArrays are merged on `main`; the deck test project of Milestone 2 (a 12' × 10' deck on posts, a rotated stair, railings by Offset and Copy) needs angled parts and thickened outlines next. The kernel has no rotation: Move only translates (`move_vertices`, `move_and_integrate` take an offset) and the only instance operation is `set_transform`; nothing offsets an outline. Sprint 2.2 in `docs/sprints.md`, planned for a Claude Code cloud session as the earlier sprints were.

## Decisions

- **Rotate and Offset in one sprint:** `docs/sprints.md` bundles them as Sprint 2.2 while `docs/roadmap.md` lists them as rows 2.2 and 2.3; the sprint doc is the plan, so the sprint carries both and corrects the roadmap's row numbering (2.3 Measure and guide follows).
- **Rotate-copies of groups are independent groups:** the 2.1 rule (`copy_instance` deep-copies the definition) applies to rotate-copy too; shared definitions wait for Components (3.1), which revisits both.
- **Protractor plane from the face under or beside the cursor, else the ground:** hovering a face uses its plane; hovering an edge uses a face that uses it (the one facing the camera when two do); nothing hovered means the ground plane. The arrow keys override with the red, green or blue axis, as Move's locks do. No click-drag axis gesture this sprint.
- **A self-intersecting offset is refused:** when an inward offset of a concave outline folds back on itself, the kernel returns a clear error and the app flashes it; trimming the result to its valid loops is deferred. No fallback, no partial result.
- **Rotate is a tool, rotate-copy is its modifier, radial arrays are retyping:** the same shape as Move in 2.1: the copy modifier (Option on Mac, Ctrl elsewhere) during a rotate copies, and `6x` or `/6` typed afterwards replays the last rotate-copy as a radial array in one undo step, through the `parseArray` path 2.1 added.
- **New tools get fuzz operations:** the randomized kernel test (`kernel/tests/common/fuzz.rs`) only knows the operations of 1.3; this sprint adds a rotate op and an offset op to its `Op` enum so the CI run keeps covering what users do, and that becomes the standing rule for later tool sprints.

## Scope

**In scope:**

- Kernel: a committed transform of loose geometry (rotation about an axis through a point) that folds, welds and settles exactly as `move_and_integrate` does, plus the instance form through `set_transform`; a rotate-copy is a copy followed by the transform.
- Kernel: offset of a face's outline (inward or outward, holes offset with it) and of a chain of selected edges, drawn through `insert_segment` and healed so an inward offset splits the face into a ring and an inner face; refused when the result self-intersects.
- Rotate tool with an on-screen protractor: pick a centre, a start direction, then sweep or type the angle; 15° snapping when not typing; the copy modifier; `6x` and `/6` radial arrays; Measurements-box retyping.
- Offset tool: hover a face or select an edge chain, drag or type the distance; retyping.
- Headless tool tests in `app/test/` for both tools, kernel tests with `validate`, fuzz ops, docs (architecture, features, README, roadmap) and the deck test project's stair and railing steps in a walkthrough or the existing one.

**Out of scope:**

- Trimming self-intersecting offsets to their valid loops: its own research; refused for now.
- Shared definitions for rotate-copies: Components (3.1).
- A click-drag protractor axis gesture: not needed while the face plane and axis locks cover the deck project.
- Scale, Flip and the rotated rectangle: 2.4.
- Guides and the Protractor guide tool: 2.3.

## Technical Approach

- Generalise the move path rather than duplicating it: `fold_for_move` and `move_vertices` take an offset today; the sprint gives the kernel a per-vertex target position form (a `Mat4` or a closure) that both the existing translation and the new rotation use, keeping one fold rule (larger-dot hinge, inside diagonals) and one `integrate_moved`. The preview stays the cheap displacement; the commit folds, moves and integrates.
- Rotation about an arbitrary axis as a `Mat4` built in the kernel's `math.rs` (next to `mat_translation`), so instances rotate by `set_transform` with the same matrix the loose geometry uses.
- Offset in the face's own 2D basis (the plane basis every heal already uses): offset each loop edge by the distance along its in-plane normal, intersect consecutive offset lines for mitred corners, check the result for self-intersection and orientation flips, then draw the loops with `insert_segment` and `heal_around`. An edge chain offsets the same way without closing.
- Rotate tool state mirrors `MoveTool`: a `rotating` record with centre, axis, start direction, current angle, `copy` and `selection`; `commit` runs one transaction; `lastCopy` with the model revision guards the array replay; `parseArray` handles `6x` and `/6`.
- Protractor drawing is overlay data (`Overlay.segments` plus a new arc or a tessellated circle), rendered by the app like the Move preview.
- Fuzz: `Op::Rotate { point, normal, axis, angle }` on the face found as the other ops do, `Op::Offset { point, normal, distance }`; shrinker and renderer unchanged.

## Open Questions

- Snapping granularity: 15° by default; whether Shift releases the snap or the snap only applies when no inference is active.
- How Offset chooses inward vs outward for an edge chain (cursor side of the chain, like SketchUp), and the sign convention typed into the Measurements box.
- Whether a rotated face's fold uses the pre-rotation plane for its inside-diagonal test (as the move fold does) or the post-rotation loop; decide at plan time from `fold_for_move`.
- Where the deck steps (rotated stair, railing by Offset and Copy) get recorded: a new `docs/walkthrough-deck.md` started this sprint and finished in 2.4, or a section per sprint.

## References

- `docs/sprints.md` § Sprint 2.2, `docs/roadmap.md` rows 2.2 and 2.3 (renumbering), `docs/features.md` rows Rotate, Offset
- `kernel/src/edit.rs` (`move_vertices`, `move_and_integrate`, `fold_for_move`, `integrate_moved`, `copy_geometry`), `kernel/src/group.rs` (`set_transform`, `copy_instance`), `kernel/src/math.rs` (`Mat4`, `mat_translation`, `Plane::basis`), `kernel/src/line.rs` (`insert_segment`, `heal_around`), `kernel/src/heal.rs`
- `kernel/tests/common/fuzz.rs` (`Op`, `generate`, `apply`), `kernel/tests/common/mod.rs` `validate`
- `app/src/tools/move.ts` (copy modifier, `lastCopy`, `array`), `app/src/tools/tool.ts` (`ToolPointer.copy`, `Tool.modifier`), `app/src/units.ts` (`parseArray`), `app/src/inference/engine.ts` (locks, `On Face`)
- `.flux/sprints/05_CopyAndArrays_Completed/` (the copy and array decisions this sprint reuses), `.flux/decisions/mvr2opid-tag-lock-enforced-by-the-kernel.md` (every new kernel entry point checks the lock)
