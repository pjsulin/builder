# Implementation Plan: CopyAndArrays

## Overview

Five phases, one commit each. Phase 1 adds the two journaled kernel copy operations (`copy_geometry` for loose geometry, `copy_instance` as a deep copy into a new group), a bench case and `kernel/tests/copy.rs` with the timed 50-instance array. Phase 2 exposes them over wasm and `Model`. Phase 3 adds the `5x` / `/5` parser in `units.ts`, independent of the kernel. Phase 4 makes copy a Move modifier (Option on Mac, Ctrl elsewhere) with cursor, hint and a `Copy` transaction. Phase 5 turns a typed array count into a replay of the last copy as one undo step. Everything is checked with `cargo test --workspace` and `npm test`; Patrick's browser joist check is the only manual step.

**Prerequisite:** Phase 1 calls the integrate step that the MovesThatStick sprint adds to `kernel/src/edit.rs` (spec.md § Technical Specifications, Prerequisite paragraph). MovesThatStick must be merged on the branch before Task 1.1 starts; Phase 3 can be done beforehand.

## Tasks

### Phase 1: Kernel Copy Operations

**Status:** pending
**Dependencies:** none

#### Task 1.1: copy_geometry in edit.rs

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Technical Specifications](spec.md#technical-specifications), [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `Copied` and `Document::copy_geometry(ctx, faces, edges, offset)`: `check_def_unlocked(ctx)`, filter inputs to `ctx` as `make_group` does (group.rs:31-35), faces bring their edges, a vertex map old→new at `pos + offset` via `vertex_at`, `add_edge` and `add_face` with material, back material and attributes copied through `with_face`, then MovesThatStick's `integrate_moved(ctx, &copied.edges)` on the new edges. `Error::Empty` when nothing is copied. Re-export `Copied` from lib.rs next to `PushPullResult`.

#### Task 1.2: copy_instance in group.rs

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** Add private `copy_definition(def)` (the explode vmap pattern, group.rs:102-125, but into a new `DefKind::Group` definition with the source's name and attributes, recursing into child instances) and `Document::copy_instance(inst, offset)`: `check_instance_unlocked(inst)`, deep-copy the definition, `new_instance` in the same parent, then `set_instance` with the cloned record (name, material, tag, attributes) and the transform translated by `offset`.

#### Task 1.3: Bench copy case

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.1, 1.2]
- **Files:**
  - Modify: kernel/examples/bench.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** After the existing cases, group one box, time 50 `copy_instance` calls in one transaction and 50 `copy_geometry` calls of a loose box in one transaction, printing each as `copy instance ×50` and `copy geometry ×50`; abort both so the model is unchanged.

#### Task 1.4: Kernel copy tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [1.1, 1.2]
- **Files:**
  - Create: kernel/tests/copy.rs
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Using `tests/common`: a box copied flush welds (volume doubles, shared vertices found by `find_vertex`, `validate`); a copy clear of the original is independent; a copied group has a different definition with equal face count, edge count, materials and attributes and the translated transform; nested group copied recursively; undo removes the copy and leaves the original; `Error::Locked` for a copy on a locked tag and for `copy_geometry` in a locked definition; a timed test that 50 instance copies of a 6-face box in one transaction take under 100 ms.

#### Task 1.5: Architecture doc for copy

- **Type:** document
- **Status:** pending
- **Dependencies:** [1.1, 1.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Add `copy_geometry` and `copy_instance` to the kernel operations list (architecture.md:114-119) and to the tag-lock entry-point list (:163): loose copies are recreated at the offset and integrated like a move; group copies deep-copy the definition because `world_transform` takes the first instance.

### Phase 2: Wasm and Model Wrappers

**Status:** pending
**Dependencies:** [Phase 1]

#### Task 2.1: Wasm exports

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 1]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `copyGeometry(ctx, faces, edges, dx, dy, dz)` returning JSON `{faces, edges}` with the `explode` formatting (lib.rs:170-180), and `copyInstance(inst, dx, dy, dz)` returning the id; errors through `js()`.

#### Task 2.2: Model wrappers

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Model.copyGeometry(ctx, faces, edges, d)` and `Model.copyInstance(inst, d)` next to `explode` and `setTransform` (model.ts:151-156), both through `changed()`.

#### Task 2.3: Model copy tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.2]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** With `newModel()`: copy a group and loose geometry inside one `transact("Copy")`, `stats()` show both, one `undo()` returns `"Copy"` and removes both; copying an instance on a locked tag throws and the transaction aborts cleanly.

### Phase 3: Array Parser

**Status:** pending
**Dependencies:** none

#### Task 3.1: parseArray in units.ts

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: app/src/units.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Export `ArraySpec` and `parseArray(text)` accepting `5x`, `x5`, `5*`, `*5` (times) and `/5`, `5/` (divide) with a positive integer, null otherwise. `parseLength` (units.ts:61) is unchanged; it already returns NaN for every array spelling, so callers try `parseArray` first.

#### Task 3.2: Measurements-box auto-focus accepts x and *

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: app/src/app.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** The keydown auto-focus regex (app.ts:669, `/^[0-9.'",\-/]$/`) gains `x` and `*` so typing `9x` or `*9` lands in the box. `x` is not a tool shortcut (app.ts:699 keys are space, l, r, p, m, e, o, h), so nothing else changes.

#### Task 3.3: Parser tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: app/test/units.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A `parseArray` describe: the six accepted spellings with spaces and upper case, `{kind, n}` values; rejects `0x`, `2.5x`, `-3x`, `x`, `5` and `""`; `parseLength("3/4")` is still 0.75 and `parseLength("5x")` is NaN.

### Phase 4: Copy Modifier in Move

**Status:** pending
**Dependencies:** [Phase 2]

#### Task 4.1: Copy modifier in the tool framework and app

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 2]
- **Files:**
  - Modify: app/src/tools/tool.ts
  - Modify: app/src/app.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `ToolPointer.copy` and optional `Tool.modifier?(copy)`. In app.ts a `copyKey(ev)` helper (Option on Mac via `altKey`, Ctrl elsewhere); `pointer()` (app.ts:502) sets `copy`; `keydown` calls `tool.modifier?.(true)` then `hintChanged()` before the `if (mod || ev.altKey) return` guard (app.ts:666); the keyup listener (app.ts:613) calls `tool.modifier?.(false)` and `hintChanged()`; `hintChanged()` also sets `canvas.style.cursor = this.tool.cursor`.

#### Task 4.2: MoveTool copy mode

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/tools/move.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Examples](spec.md#examples)
- **Description:** `Moving` gains `copy` and `selection`; `cursor` becomes a getter returning `"copy"` while copying; `hint()` names the copy and the array syntax; `modifier(copy)` sets the flag during a move and remembers it for the next `down()` (also read from `p.copy` in `down`); `commit()` (move.ts:157) in copy mode aborts the Move preview and runs `copyGeometry`/`copyInstance` at `toLocalDir(good)` in one `transact("Copy")`, selects the copies, sets `lastCopy = {selection, offset: good, count: 1}`; `lastCopy` is cleared in `start()` and `deactivate()`. Errors flash via `errorMessage` as today.

#### Task 4.3: Copy modifier tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.2]
- **Files:**
  - Modify: app/test/toolhost.ts
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** `TestHost.at(p, {copy})` and `copyClick`. Tests: a grouped box copied 16" with the modifier leaves the original at the origin and adds a second instance; a loose box face copy keeps the face count up; `undo()` returns `"Copy"` and removes only the copy; `modifier(true)` mid-move switches to a copy and `cursor` reads `"copy"`; a locked instance is refused with the locked-tag toast.

#### Task 4.4: Copy docs

- **Type:** document
- **Status:** pending
- **Dependencies:** [4.2]
- **Files:**
  - Modify: docs/features.md
  - Modify: README.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** features.md move/copy row (:65) becomes "Built now"; README Tools list (:13) and the shortcut table (:64) say Move copies with Option (Mac) or Ctrl held.

### Phase 5: Linear Arrays

**Status:** pending
**Dependencies:** [Phase 3, Phase 4]

#### Task 5.1: Array replay in MoveTool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 3, Phase 4]
- **Files:**
  - Modify: app/src/tools/move.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** `vcb()` (move.ts:134) tries `parseArray` first and dispatches to `array(spec)`; `array` flashes "Copy something first" without `lastCopy`, else undoes the last Copy transaction and replays N copies at `offset*k` (times) or `offset*k/N` (divide) in one `transact("Copy")`, selects them and updates `lastCopy.count`. Plain moves never array.

#### Task 5.2: Array tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A 2×8 joist group copied 16" then `9x` gives ten instances at 16" steps and one `undo()` leaves one; a 12' copy then `/9` gives ten end to end (last at 144"); `5x` after `9x` leaves six; `9x` after a plain move flashes "Copy something first"; loose geometry arrays too (face count) and the 50-instance array commits in one transaction.

#### Task 5.3: Array docs and roadmap

- **Type:** document
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Modify: README.md
  - Modify: docs/roadmap.md
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** README gains the `5x` / `/5` usage after a copy with the joist example; roadmap.md 2.1 (:34) is marked built.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.
