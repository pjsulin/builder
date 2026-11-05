# Implementation Plan: CurvesScaleAndFlip

## Overview

Eight phases, one commit each: edge attributes in the kernel and the file; curves and soft edges in the kernel; soft edges and back faces in the view; the Circle, Polygon and Arc tools with the centre inference and curve-wide selection; scale, mirror and orientation in the kernel with fuzz ops; the Scale, Flip, Reverse Faces and Orient Faces tools and the resize prompt; the rotated rectangle; the deck walkthrough's round posts and the docs. Phases 1, 2 and 5 are kernel work and can be reviewed on `cargo test` alone; 3, 4, 6 and 7 are app work driven headlessly; 8 closes the docs.

## Tasks

### Phase 1: Edge Attributes and the File

**Status:** pending
**Dependencies:** none

#### Task 1.1: Attributes on Edge

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/doc.rs
  - Modify: kernel/src/topo.rs
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `attributes` to `Edge` and `AttrTarget::Edge`, extend `attributes` and `set_attribute`, add `BUILDER_NS`, `CURVE_KEY`, `SOFT_KEY`, `edge_curve`, `edge_soft`; the one `Edge { .. }` literal (topo `add_edge`) starts empty; `split_edge` copies the split edge's attributes to both halves; `copy_geometry_transformed` (edit.rs), `make_group` and `explode` (group.rs), which create their edges through `add_edge`, copy the source edge's attributes onto the new edge afterwards as they already copy face attributes.

#### Task 1.2: edge_attributes in the file

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/format.rs
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** `FileEdgeAttributes` and `FileDefinition.edge_attributes` (skipped when empty, sorted by edge on write); read with `read_attributes` under the path `definitions[d].edge_attributes[k].attributes` and `Error::Format` for an edge index out of range.

#### Task 1.3: Wasm and Model attribute kind "edge"

- **Type:** implement
- **Status:** pending
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `attributes` and `set_attribute` accept kind `"edge"`; `AttrKind` gains `"edge"`.

#### Task 1.4: Edge attribute tests and fixture

- **Type:** test
- **Status:** pending
- **Dependencies:** [1.2, 1.3]
- **Files:**
  - Modify: kernel/tests/attributes.rs
  - Modify: kernel/tests/format.rs
  - Create: kernel/tests/fixtures/edge-attributes.builder
  - Modify: app/test/check.test.ts
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** Set, read, undo, redo an edge attribute; a split edge's halves both carry it; the fixture round-trips byte-identically; a file without the key loads with none and saves without it (byte-identical to the existing fixtures); bad index and bad value rejected with their path; the app reads `attributes("edge", id)`.

#### Task 1.5: File format doc

- **Type:** document
- **Status:** pending
- **Dependencies:** [1.2]
- **Files:**
  - Modify: docs/file-format.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** § Definitions gains `edge_attributes`; § Attributes says edges carry them and documents the reserved `builder` namespace with `curve` and `soft`.

### Phase 2: Curves and Soft Edges in the Kernel

**Status:** pending
**Dependencies:** [Phase 1]

#### Task 2.1: curve.rs

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 1]
- **Files:**
  - Create: kernel/src/curve.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `add_curve`, `next_curve_id`, `curve_of` (chain order by walking shared vertices among edges with the same curve id), `curve_center`, `mark_curve`, `set_soft`, `explode_curves_touching`; the lib.rs doc list gains them.

#### Task 2.2: Curves through transform, push/pull and offset

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/pushpull.rs
  - Modify: kernel/src/offset.rs
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `remap_curve_ids`, called by `copy_geometry_transformed` and `explode` so a copied or exploded curve never shares an id with one already in its context; `transform_vertices` explodes curves it bends; `fold_for_move` softens its diagonals; `extrude` gives the cap's edges a new curve id per base curve and softens side edges standing on a vertex shared by two segments of one curve; `offset_edges` and `offset_face` mark their output a new curve per input curve.

#### Task 2.3: validate and check for curves

- **Type:** implement
- **Status:** pending
- **Dependencies:** [2.1]
- **Files:**
  - Modify: kernel/tests/common/mod.rs
  - Modify: kernel/src/check.rs
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** `validate` asserts each curve id's segments are one chain in one definition and `soft` is only ever `true`; `check` gains `FindingKind::BrokenCurve` (`broken_curve`), and the app's `Finding.kind` union gains it.

#### Task 2.4: Curve kernel tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [2.2, 2.3]
- **Files:**
  - Create: kernel/tests/curves.rs
  - Modify: kernel/tests/check.rs
  - Modify: kernel/tests/format.rs
  - Create: kernel/tests/fixtures/curves.builder
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** The Feature 2 criteria: 24-segment circle and its face, `curve_of` from any segment, `curve_center`, split by a crossing line, erase, offset, push/pull cap and 24 soft sides against a box's none, explode on a partial move and survival on a whole move, a copy beside its source and an exploded group keeping distinct curve ids, `validate` on a planted broken curve, `check` reporting it, a cylinder fixture round-tripping byte-identically.

### Phase 3: Soft Edges and Back Faces in the View

**Status:** pending
**Dependencies:** [Phase 2]

#### Task 3.1: Averaged normals and soft flags in the buffers

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 2]
- **Files:**
  - Modify: kernel/src/mesh.rs
  - Modify: kernel-wasm/src/lib.rs
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `face_buffers` averages normals across soft edges around each corner vertex; `EdgeBuffers.soft`; wasm `Buffers.edge_soft`; `DefBuffers.edgeSoft`.

#### Task 3.2: Viewport and scene

- **Type:** implement
- **Status:** pending
- **Dependencies:** [3.1]
- **Files:**
  - Modify: app/src/view/viewport.ts
  - Modify: app/src/view/scene.ts
  - Modify: app/src/style.css
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** The line set omits soft edges and the hover highlight still draws one; the scene index keeps `segSoft` and every edge pickable; a mirrored item's face normals carry sign(det); `--back` in both themes becomes a clearer blue-grey.

#### Task 3.3: Buffer and scene tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [3.2]
- **Files:**
  - Modify: kernel/tests/curves.rs
  - Modify: app/test/scene.test.ts
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** Averaged normals on the cylinder, flat on a box, `soft` true for the 24 sides only; the scene keeps soft edges pickable while the viewport's line count drops by 24; a mirrored instance picks with a mirrored normal.

### Phase 4: Circle, Polygon and Arc Tools

**Status:** pending
**Dependencies:** [Phase 3]

#### Task 4.1: Model and wasm curve methods, segment parsing

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 3]
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
  - Modify: app/src/kernel/model.ts
  - Modify: app/src/units.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `add_curve`, `curve_of`, `curve_center` wrappers and `Model.addCurve`, `curveOf`, `curveCenter`; `parseSegments` and `parseRadius`.

#### Task 4.2: Centre inference and curve expansion

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/inference/engine.ts
  - Modify: app/src/tools/pick.ts
  - Modify: app/src/tools/select.ts
  - Modify: app/src/tools/erase.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `center` kind from a hovered curve segment; `expandCurve`; Select and Erase expand a picked segment to its curve (single click, Shift toggle, Ctrl add, double-click's edges of a face unchanged).

#### Task 4.3: Circle, Polygon and Arc tools

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Create: app/src/tools/circle.ts
  - Create: app/src/tools/arc.ts
  - Modify: app/src/tools/rectangle.ts
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `planeFor` exported from rectangle.ts; `CircleTool`, `PolygonTool`, `ArcTool` (modes arc2, arc3) with typed radius, bulge, `r` radius, `Ns` segment count, sticky counts, retype; registered with keys C and A and toolbar buttons.

#### Task 4.4: Curve tool tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.2, 4.3]
- **Files:**
  - Create: app/test/curves.test.ts
  - Modify: app/test/inference.test.ts
  - Modify: app/test/units.test.ts
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** The Feature 4 criteria: the round post, `Center`, `12s` retype, polygon, both arcs, `Half Circle`, Erase and Select expansion; `parseSegments` and `parseRadius`.

### Phase 5: Scale, Mirror and Orientation in the Kernel

**Status:** pending
**Dependencies:** [Phase 2]

#### Task 5.1: Scale and mirror matrices through the transform path

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 2]
- **Files:**
  - Modify: kernel/src/math.rs
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `mat_scale`, `mat_mirror`, `mat_det`; `transform_vertices` carries normals with the determinant's sign and refuses a singular matrix; `copy_geometry_transformed` the same; `set_transform` accepts a mirrored matrix.

#### Task 5.2: orient.rs

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Create: kernel/src/orient.rs
  - Modify: kernel/src/lib.rs
  - Modify: kernel-wasm/src/lib.rs
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `reverse_faces`, `orient_faces`; wasm and `Model.reverseFaces`, `orientFaces`.

#### Task 5.3: Fuzz ops

- **Type:** implement
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Modify: kernel/tests/common/fuzz.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Op::Circle`, `Op::Scale`, `Op::Flip`, `Op::Orient` in the enum, `name`, `apply`, `generate` and the trace printer.

#### Task 5.4: Scale, mirror, orient tests and the fuzz run

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.3]
- **Files:**
  - Create: kernel/tests/scale.rs
  - Create: kernel/tests/orient.rs
  - Modify: kernel/tests/fuzz.rs
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** The Feature 5 criteria, and the randomized run under a minute at the CI seed with the new ops traced.

### Phase 6: Scale, Flip, Orientation Commands and the Resize Prompt

**Status:** pending
**Dependencies:** [Phase 4, Phase 5]

#### Task 6.1: Overlay grips and planes, host confirm, app math

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 4, Phase 5]
- **Files:**
  - Modify: app/src/tools/tool.ts
  - Modify: app/src/math.ts
  - Modify: app/src/view/viewport.ts
  - Modify: app/src/app.ts
  - Modify: app/test/toolhost.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Overlay.grips`, `Overlay.planes`, `ToolHost.confirm`; `scaling`, `mirror`, `det`; the viewport draws grips and planes; the app's `confirm` is `window.confirm`; the test host's is scripted.

#### Task 6.2: Scale tool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Create: app/src/tools/scale.ts
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** `ScaleTool` with the 26 grips, screen-space grip picking, drag and typed factors or lengths, Ctrl about centre, Shift uniform, preview through `transformVertices` and `setTransform`, retype in one undo step, locked refusal; key S.

#### Task 6.3: Flip tool and the orientation buttons

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Create: app/src/tools/flip.ts
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `FlipTool` with three planes and a click to mirror; `reverseBtn` and `orientBtn` on the selection.

#### Task 6.4: Tape Measure resize prompt

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Modify: app/src/tools/measure.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** A typed length after a measure-only measurement confirms and scales the editing context's vertices and instances uniformly about the origin in one `Resize` transaction.

#### Task 6.5: Scale, Flip, orientation and resize tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [6.2, 6.3, 6.4]
- **Files:**
  - Create: app/test/scale.test.ts
  - Create: app/test/flip.test.ts
  - Modify: app/test/measure.test.ts
  - Modify: app/test/tools.test.ts
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** The Feature 6 criteria: the bench along red, a corner grip, Ctrl, typed length, retype, locked refusal; Flip of a group and of loose geometry; Reverse and Orient Faces; the resize prompt confirmed and cancelled.

### Phase 7: Rotated Rectangle

**Status:** pending
**Dependencies:** [Phase 4]

#### Task 7.1: Shared rectangle commit and the tool

- **Type:** implement
- **Status:** pending
- **Dependencies:** [Phase 4]
- **Files:**
  - Modify: app/src/tools/rectangle.ts
  - Create: app/src/tools/rotrect.ts
  - Modify: app/src/app.ts
  - Modify: app/index.html
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `commitRect` shared; `RotatedRectangleTool` with corner, first edge (clicked or typed), perpendicular width (clicked or typed, `length, width`), retype; toolbar button.

#### Task 7.2: Rotated rectangle test

- **Type:** test
- **Status:** pending
- **Dependencies:** [7.1]
- **Files:**
  - Modify: app/test/tools.test.ts
- **Context:** [requirements.md§Success Criteria](requirements.md#success-criteria)
- **Description:** A 30° rectangle with typed `4', 2'`: four edges, one face, the expected corners; retype amends.

### Phase 8: Walkthrough, Docs and Roadmap

**Status:** pending
**Dependencies:** [Phase 6, Phase 7]

#### Task 8.1: Round posts in the deck walkthrough

- **Type:** test
- **Status:** pending
- **Dependencies:** [Phase 6, Phase 7]
- **Files:**
  - Modify: app/test/offset.test.ts
  - Modify: docs/walkthrough-deck.md
- **Context:** [requirements.md§Feature 8: Walkthrough, docs and roadmap](requirements.md#feature-8-walkthrough-docs-and-roadmap)
- **Description:** The corner posts become round posts (Circle `2"`, Push/Pull) in the headless replay and the doc; the counts in Results updated from the test.

#### Task 8.2: Architecture, file format, features, README

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.1]
- **Files:**
  - Modify: docs/architecture.md
  - Modify: docs/file-format.md
  - Modify: docs/features.md
  - Modify: README.md
- **Context:** [requirements.md§Impact](requirements.md#impact)
- **Description:** § 2, 3, 4, 5, 6, 9, 10 of the architecture; the file format's `builder` keys as shipped; features rows 53, 54, 55, 67, 71, 72 to built; README tools, keys C, A, S and buttons, and the `validate` example's list of finding kinds (broken curves).

#### Task 8.3: Roadmap and sprints

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.1]
- **Files:**
  - Modify: docs/roadmap.md
  - Modify: docs/sprints.md
- **Context:** [requirements.md§Impact](requirements.md#impact)
- **Description:** Rows 2.4, 2.6, 2.7 done with the date and the test project line; § 2.4 "Resolved in the sprint" paragraph.

## Plan Review

**Reviewed:** 2026-11-05

- [x] Requirements to Spec traced (8 features, 20 criteria; all covered)
- [x] Spec to Plan traced (every interface, data model and validation item has a task; no task without a spec basis)
- [x] Proposed ADRs checked against accepted (`mwdq3k7a` extends `mvr2op7t`, contradicts nothing; `mvr2opid` honoured by every new operation)
- [x] Checklist passed (3 warnings accepted: viewport grip and plane drawing has no headless test, as the protractor overlay had none; the resize prompt's whole-context `transform_and_integrate` may be slow on a large model and is measured in the sprint; Phase 6 has five tasks, tightly coupled)

Fixed in review: `remap_curve_ids` for copies and exploded groups (spec, Task 2.2, Task 2.4); the app's `Finding.kind` union and the README `validate` line for `broken_curve` (Task 2.3, Task 8.2).

**Plan Status:** Ready for implementation

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.
