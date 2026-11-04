# Implementation Plan: MeasureAndGuide

## Overview

Sprint 2.3 of Milestone 2: guides as a kernel entity saved under an additive `guides` key, a guide draw layer and picking, the parallel, perpendicular, from-point, intersection and guide inferences with the Down-arrow cycle, the Tape Measure and Protractor tools, Delete Guides and saved visibility, fuzz ops, docs and the deck walkthrough's layout step. Eight phases, one commit each, `feat(sprint-07):` style once the sprint is Current.

## Tasks

### Phase 1: Kernel Guides

**Status:** pending
**Dependencies:** none

#### Task 1.1: Guide entity, arena and journal

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/doc.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `GuideId`, `GuideShape`, `Guide`, the `guides` arena, `guides_visible`, `Change::Guide` and `Change::GuidesVisible` with their `apply` arms, the `setter!` pair, `next_guide`, `guide`, `guides_in`, `guides_visible`, `set_guides_visible`. `clear_history` and `new` unchanged in shape.

#### Task 1.2: Guide operations with lock checks

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.1]
- **Files:**
  - Create: kernel/src/guide.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `add_guide_line` (normalises `dir`, `Degenerate("guide direction")` on zero), `add_guide_point`, `erase_guides`, `erase_all_guides`, each checking the owner's lock the way `offset_face` does before writing; `pub mod guide` in `lib.rs`.

#### Task 1.3: Check and validate know guides

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/check.rs
  - Modify: kernel/tests/common/mod.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `FindingKind::BadGuide` with its `name` and Display; `check` reports a guide whose owner is gone or whose direction is not unit; `validate` asserts the same.

#### Task 1.4: Kernel guide tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [1.2, 1.3]
- **Files:**
  - Create: kernel/tests/guides.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Create and erase a line and a point, undo and redo restore them, erase-all is one journal entry and leaves locked owners' guides, a locked owner refuses, a zero direction is Degenerate, a guide inside a group is owned by that definition, `check` reports a planted bad guide.

#### Task 1.5: Architecture: guides are not topology

- **Type:** document
- **Status:** pending
- **Dependencies:** [1.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** § 2 says guides are a separate entity outside welding, healing and push/pull; § 3 lists the arena and journal entries; the tag-lock list gains `add_guide_line`, `add_guide_point`, `erase_guides`.

### Phase 2: File Format

**Status:** pending
**Dependencies:** [Phase 1]

#### Task 2.1: Read and write `guides` and `guides_visible`

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 1]
- **Files:**
  - Modify: kernel/src/format.rs
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** `FileGuide` tagged enum and the two `File` fields with the skip rules; `to_json` writes guides sorted by id with unit `dir`; `from_json` validates the definition index and a non-zero direction, naming the path in `Error::Format`.

#### Task 2.2: Format round-trip tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel/tests/format.rs
  - Create: kernel/tests/fixtures/guides.builder
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Byte-identical round trip of a file with a line, a point in a group and `guides_visible: false`; a file without the keys loads with no guides and visible; a bad definition index and a zero direction are refused with the path.

#### Task 2.3: File format doc

- **Type:** document
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: docs/file-format.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** New § Guides with the table and the additive-change paragraph, the two keys in § Top level; architecture § 4 names them.

### Phase 3: Wasm and Model Wrappers

**Status:** pending
**Dependencies:** [Phase 2]

#### Task 3.1: Wasm exports

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 2]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `add_guide_line`, `add_guide_point`, `erase_guides`, `erase_all_guides`, `guides(def)` as the flat array, `guides_visible`, `set_guides_visible`, following the error mapping of `offset_face`.

#### Task 3.2: Model wrappers and the guide entity kind

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: app/src/kernel/model.ts
  - Modify: app/src/tools/tool.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `EntityKind` gains `"guide"`, `GuideRecord`, the seven wrappers, `exists` answers for guides; `Selection.ids("guide")` works unchanged; `Selection.prune` drops erased guides.

#### Task 3.3: Wrapper tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.2]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Add, list, erase and erase-all through `Model` against the real wasm; `setGuidesVisible` undoes as one step; `exists` for a guide before and after erase.

### Phase 4: Guide Layer, Picking and Housekeeping

**Status:** pending
**Dependencies:** [Phase 3]

#### Task 4.1: Guides in the scene index and viewport

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 3]
- **Files:**
  - Modify: app/src/view/scene.ts
  - Modify: app/src/view/viewport.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `flatten` collects `WorldGuide`s through each item's matrix; `SceneIndex.guides()`; `Viewport.setGuides` draws a dashed `guides` layer clipped to the camera's far planes, a point as a stub with an x; hidden guides produce an empty layer and an empty list.

#### Task 4.2: Pick guides, erase guides

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/tools/pick.ts
  - Modify: app/src/tools/erase.ts
  - Modify: app/src/tools/select.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `pickEntity` returns a guide within the edge radius of a line or the point radius of a point, after geometry; `EraseTool.up` erases `ids("guide")` through `eraseGuides` in the same transaction; Select highlights a guide and Delete erases it with the selection.

#### Task 4.3: View › Guides and Edit › Delete Guides

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `guidesBtn` toggles visibility in a `Guides` transaction and relabels; `deleteGuidesBtn` runs `eraseAllGuides` in one transaction and flashes the count; `drawOverlay` feeds `setGuides`; `eraseSelection` includes guides.

#### Task 4.4: Scene and housekeeping tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.2, 4.3]
- **Files:**
  - Modify: app/test/scene.test.ts
  - Modify: app/test/tools.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** A guide in a moved group flattens through the instance matrix; hidden gives an empty list; `pickEntity` finds a guide line and a point and prefers an edge over a guide at the same pixel; Erase removes a guide; delete-all is one undo step.

### Phase 5: Inference Kinds and Locks

**Status:** pending
**Dependencies:** [Phase 4]

#### Task 5.1: Reference edge, from-point memory and the edge-lock cycle

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 4]
- **Files:**
  - Modify: app/src/inference/engine.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `referencedEdge` set by an On Edge result, from-point memory set by any point snap and ended by `clicked()`, `cycleEdgeLock`, `edgeLock`, `reset`; the `parallel` and `perpendicular` kinds as line constraints from the anchor along or across the referenced edge (perpendicular in the working plane, else the plane of the edge and the anchor), magenta, with the Shift lock holding them through `lockCurrent`.

#### Task 5.2: From-point, intersection and guide snaps

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Modify: app/src/inference/engine.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `fromPoint` cue when the cursor aligns on an axis with the remembered point (dotted, from that point); `intersection` of edge–edge, edge–guide and guide–guide pairs in screen radius, as a point snap below endpoint and midpoint; `guidePoint` with the point snaps; `onGuide` with on-edge; all honouring `visible` and the working plane like the existing snaps.

#### Task 5.3: Down arrow and reset in the app

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/src/style.css
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `ArrowDown` calls `cycleEdgeLock` and falls back to `unlock` when nothing is referenced; `setTool` and Esc call `reset`; every tool's `down` calls `inference.clicked()` through the host; `MARKER_CLASS` and the stylesheet gain the magenta, from-point and guide marker styles; `drawGuide` draws the magenta line from the anchor.

#### Task 5.4: Engine tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.2, 5.3]
- **Files:**
  - Modify: app/test/inference.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Hover an angled edge, draw from an anchor: `Parallel to Edge` and `Perpendicular to Edge` within radius and not outside; Down cycles parallel, perpendicular, off and Shift holds; two crossing guides give `Intersection`, a guide point `Guide Point`, a point on a line `On Guide`; from-point from the last hovered point ends at a click; `reset` clears everything.

#### Task 5.5: Architecture § 6 inference

- **Type:** document
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** The ranked list gains the six kinds with labels and colours, the Locks paragraph says Down cycles parallel, perpendicular, off, and the reference-edge and from-point memories are described.

### Phase 6: Tape Measure Tool

**Status:** pending
**Dependencies:** [Phase 5]

#### Task 6.1: TapeMeasureTool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 5]
- **Files:**
  - Create: app/src/tools/measure.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** State record, the Ctrl tap toggle through `modifier` as `MoveTool` does, endpoint or guide point → guide point, midpoint, edge or face → parallel guide line at the dragged or typed distance, measure-only mode reports the length read-only, locked context refused before preview, `lastGuide` retype through undo and redo, Esc cancels.

#### Task 6.2: Register the tool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
  - Modify: app/src/style.css
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `tools.measure`, key `t`, toolbar button with icon and `<kbd>T</kbd>`, the `measure` cursor with its `+` badge.

#### Task 6.3: Tape Measure tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [6.2]
- **Files:**
  - Create: app/test/measure.test.ts
  - Modify: app/test/toolhost.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Criteria F2: guide line 4' from an edge then retype 3' in one undo step; guide point 2' from an endpoint; measure-only shows the length and leaves the revision unchanged; locked context toast; `toolhost.ts` gains a `tapKey` helper if the Ctrl tap needs one.

#### Task 6.4: README and features for Tape Measure

- **Type:** document
- **Status:** pending
- **Dependencies:** [6.2]
- **Files:**
  - Modify: README.md
  - Modify: docs/features.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Tools line and a Tape Measure bullet with the Ctrl toggle and guide rules, Keys row T, the View and Edit buttons; features row "Tape Measure and guide lines and points" to built.

### Phase 7: Protractor Tool

**Status:** pending
**Dependencies:** [Phase 5]

#### Task 7.1: Slope syntax in parseAngle

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: app/src/units.ts
  - Modify: app/test/units.test.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `rise:run` parses to `atan(rise/run)` in degrees, negative rise allowed, zero run is NaN; existing forms unchanged; Rotate's typed angle gains it for free.

#### Task 7.2: ProtractorTool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 5, 7.1]
- **Files:**
  - Create: app/src/tools/protractor.ts
  - Modify: app/src/tools/rotate.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Centre, base direction, swept or typed angle, 15° ticks near the centre and finer away using Rotate's `radius` rule, `Overlay.protractor`, the plane rules and axis locks; `protractorNormal` and `radius` move to a shared helper exported from `rotate.ts` so both tools use one copy; commit adds a guide line; retype amends it.

#### Task 7.3: Register the tool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [7.2]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `tools.protractor`, toolbar button with no key.

#### Task 7.4: Protractor tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [7.3]
- **Files:**
  - Create: app/test/protractor.test.ts
  - Modify: app/test/rotate.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Criteria F3: typed 37 and `3:12`, a near-centre sweep snaps to 15°, plane follows the hovered face, arrow keys lock an axis, retype; rotate tests still pass after the helper move.

#### Task 7.5: README and features for Protractor

- **Type:** document
- **Status:** pending
- **Dependencies:** [7.3]
- **Files:**
  - Modify: README.md
  - Modify: docs/features.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Protractor bullet with the slope syntax; features row "Protractor and angled guides" to built; Rotate's row notes typed slopes.

### Phase 8: Fuzz, Walkthrough and Roadmap

**Status:** pending
**Dependencies:** [Phase 6, Phase 7]

#### Task 8.1: Guide ops in the randomized test

- **Type:** test
- **Status:** pending
- **Dependencies:** [Phase 1]
- **Files:**
  - Modify: kernel/tests/common/fuzz.rs
  - Modify: kernel/tests/fuzz.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Op::Guide` from a picked face's edge at a distance, `Op::EraseGuide` of a random live guide, weights to 14 entries, `render_op` for both; CI seed stays under a minute.

#### Task 8.2: Deck walkthrough layout step

- **Type:** document
- **Status:** pending
- **Dependencies:** [Phase 6, Phase 7]
- **Files:**
  - Modify: docs/walkthrough-deck.md
  - Modify: app/test/offset.test.ts
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** A step before the posts: guides 4' in from two rim edges, a post footprint drawn at their intersection by snapping alone; the headless "Deck walkthrough" replay gains the same step and asserts the corner position.

#### Task 8.3: Roadmap, sprints, architecture status

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.1, 8.2]
- **Files:**
  - Modify: docs/roadmap.md
  - Modify: docs/sprints.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Summary](spec.md#summary)
- **Description:** Roadmap row 2.3 done with the date and row 2.5's guide snaps folded in; sprints § 2.3 "Resolved in the sprint" paragraph; architecture § 9 fuzz op list and § 10 status.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.
