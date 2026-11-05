---
sprint: CurvesScaleAndFlip
created: 2026-11-05
start: null    # commit; set by `flux sprint move <Name> Current`, close diffs against it
started: null  # date; set by the same move
step: '7'
---
# Requirements: CurvesScaleAndFlip

## Background

Sprints 1.1–2.3 are merged. The deck test project (`docs/walkthrough-deck.md`) is complete except for its round posts, which "wait for the curves sprint"; `docs/roadmap.md` names round posts, arched doors and table tops as what curves are for, resizing components as what Scale is for, and inside-out faces (exports, 3D printing) as what Flip and Orient Faces fix. `docs/sprints.md` § Sprint 2.4 is the plan: "round shapes, resizing, and fixing face direction", done when "a round 4" post: draw a circle on the ground, type a radius, pull it up 8'. It reads as smooth and selects as one curve", "scaling a bench group to 1.5× along red only changes its length", and "the deck test project can be done start to finish". The 2.3 kickoff planned 2.3 and 2.4 together and settled the shared questions for this sprint: edges get attributes as one additive format change, soft edges render here (styles stay in 5.6), and resizing the model from a Tape Measure measurement is a Scale operation that lands here. The user asked on 2026-11-05 to "kick off and then plan it", after finding the sprint had never been created; the open questions are settled from SketchUp's defaults as 2.3's were (kickoff.md).

The kernel's `Edge` carries no attributes (definitions, instances and faces do, ADR `mvr2op7t`), the file writes edges as bare `[a, b]` pairs, `transform_vertices` carries a wholly transformed face's normal through the matrix but would take a mirrored face for one turned inside out, the mesher writes one flat normal per face and every edge into the edge buffer, and the app has no context menu.

## Summary

Add attributes to edges in the kernel and the file; store circles, polygons and arcs as curves (an edge attribute grouping segments) that select, erase, measure and offset as one and give a centre inference; soften the side edges of a pulled curve so a cylinder reads smooth; add Scale, Flip, Reverse Faces and Orient Faces through the one transform path; add the rotated rectangle; finish the deck walkthrough with its round posts.

## Goals

### Primary Goal

A round 4" post: Circle on the ground, type `2"`, Push/Pull `8'`. The result reads as a smooth cylinder, its rim selects as one curve, and the deck walkthrough runs start to finish headlessly with round posts.

### Secondary Goals

- Kernel and format: `attributes` on edges, written additively; a `builder.curve` grouping and a `builder.soft` flag; curve membership survives splitting and is dropped when a curve is bent.
- Tools: Circle (C), Polygon, 2-Point Arc (A) and 3-Point Arc with typed radius and typed segment count; Scale (S) with grips, typed factors and typed lengths; Flip with three planes; Rotated Rectangle; Reverse Faces and Orient Faces commands; the Tape Measure's resize-the-model prompt.
- View: soft edges not drawn, smooth shading across them, a clearer back-face colour.
- Standing rules: fuzz ops for every new kernel operation, headless tool tests, docs, the walkthrough.

## Features

### Feature 1: Edge attributes and the file

**What:** `Edge` gains `attributes: Attributes`; `AttrTarget::Edge(EId)`; `set_attribute` and `attributes` cover edges; the wasm `attributes("edge", id)` and `Model.attributes("edge", id)`. The file keeps `edges: [[a, b], ...]` and adds, per definition, an optional `edge_attributes: [{ "edge": i, "attributes": {...} }, ...]` sorted by edge index, written only when some edge has attributes.
**Why:** Background: curves and the soft flag both need edge data, and the 2.3 kickoff decided one additive format change for both. A file with no edge attributes is byte-identical to what sprint 07 writes.
**Details:** Namespace and value rules are ADR `mvr2op7t`'s. `split_edge` gives both halves the split edge's attributes; `add_edge` returning an existing edge keeps that edge's attributes; `merge_vertex_into` and `insert_segment` go through `split_edge` and `add_edge` and need no special case. `read_attributes` names the path `definitions[d].edge_attributes[k].attributes.ns.key`; an `edge` index out of range is `Error::Format`. A proposed ADR extends `mvr2op7t` to edges.
**Integration:** `doc.rs`, `format.rs`, `topo.rs`; `kernel-wasm/src/lib.rs` `attributes`/`set_attribute` kind `"edge"`; `app/src/kernel/model.ts` `AttrKind`; `kernel/tests/attributes.rs`, `format.rs`, a fixture.

### Feature 2: Curves in the kernel

**What:** `add_curve(ctx, pts, closed) -> Result<Vec<EId>, Error>` draws a polyline through `add_line` and marks every resulting segment `builder.curve = id` (a number unique in `ctx`, one more than the highest in use); `curve_of(e) -> Vec<EId>` returns the curve's live segments in chain order (any start for a closed curve); `curve_center(e) -> Option<V3>` is the circumcentre of three consecutive vertices. `erase` of any segment is given the whole curve by the caller (`curve_of`), `offset_edges` of a curve's segments marks its output as a new curve, `push_pull` of a face bounded by a curve copies the curve to the cap's matching edges with a new id and sets `builder.soft = true` on each side edge that stands on a vertex shared by two segments of one curve. A transform that moves some but not all vertices of a curve (`transform_vertices`, the preview path, so the drag shows it) removes `builder.curve` from that curve's segments: the curve explodes, as in SketchUp. `validate` asserts every curve's segments form one chain in one definition.
**Why:** `docs/architecture.md` § 2 and `docs/features.md` rows 54–55: a curve is an edge attribute grouping segments, so welding, healing and push/pull are unchanged and the thing SketchUp users expect to select as one does.
**Details:** `add_line` is what draws the segments, so a circle drawn across existing edges welds and splits as any line does and the pieces keep `builder.curve` through `split_edge`. A curve id is per definition; `make_group` and `explode` move edges with their attributes already. Offset of an open curve (an arc) gives an open curve; a closed one a closed one. `soft` is one flag meaning both soft and smooth (Open Questions). Fold diagonals from `fold_for_move` get `builder.soft = true` too, closing the "waits for styles" note in architecture § 2.
**Integration:** new `kernel/src/curve.rs` (`add_curve`, `curve_of`, `curve_center`, `next_curve_id`, `explode_curves_touching`), `edit.rs` (`transform_vertices` explode step, `fold_for_move` soft diagonals), `pushpull.rs` (`extrude` cap and side marking), `offset.rs` (`offset_edges` output marking), `kernel/tests/common/mod.rs` `validate`, `kernel/tests/curves.rs`.

### Feature 3: Soft edges and back faces in the view

**What:** `EdgeBuffers` gains `soft: Vec<bool>` per edge; the viewport's line set omits soft edges; the scene index keeps every edge for picking and inference. `face_buffers` writes, at each triangle corner, the average of the normals of the faces around that vertex that are joined to this face across soft edges only (hard edges break the average), so a pulled circle shades as a cylinder and a box stays faceted. The `--back` colour in `app/src/style.css` changes in both themes to a blue-grey that reads as "back" next to the face colour, as SketchUp's does. Picking and face normals of an instance whose transform has a negative determinant (a flipped group) use the mirrored normal.
**Why:** Background and the 2.3 kickoff: "drawn not-at-all but pickable so the surface reads as one"; the sprint goal "reads as smooth"; roadmap row 2.7's "inside-out faces" are easier to see with a clearer back colour.
**Details:** Normals are averaged in definition coordinates by the kernel so the renderer stays a buffer uploader. A soft edge still answers On Edge, Midpoint and Endpoint and can be erased (which, for a side edge of a cylinder, merges nothing: the neighbours are not coplanar) or selected. Hover highlight of a soft edge draws it, so the user can find it.
**Integration:** `mesh.rs`, `kernel-wasm/src/lib.rs` `Buffers` (`edge_soft`), `app/src/kernel/model.ts` `DefBuffers`, `app/src/view/viewport.ts`, `app/src/view/scene.ts` (`segSoft`, mirrored normals), `app/src/style.css`, `app/test/scene.test.ts`.

### Feature 4: Circle, Polygon and Arc tools, centre inference, curve selection

**What:** Circle (key C): click a centre on the ground or a face (the plane rules of `RectangleTool.planeFor`), move or type a radius, 24 segments by default; Polygon (no key): centre and radius (to a vertex), 6 sides; 2-Point Arc (key A): start, end, then bulge (drag or typed), 12 segments; 3-Point Arc: start, a point on the arc, end. While a tool is active or right after its commit, `Ns` typed (`24s`) sets the segment count and retypes the last shape; a plain length retypes the radius (or the bulge). The count sticks per tool for the session. `InferenceKind` gains `center` (label `Center`, ranked with endpoint and midpoint), offered when a curve segment is hovered. Select on a curve segment selects every segment of the curve; Erase expands likewise; `Selection` and `boxSelect` are unchanged (a box takes the segments it contains, as SketchUp's does when the whole curve is inside).
**Why:** `docs/sprints.md` § 2.4's first deliverable and the done-when; SketchUp's defaults for counts and keys (Open Questions).
**Details:** Each tool commits one transaction (`Circle`, `Polygon`, `Arc`) through `Model.addCurve`. The circle and polygon lie in the plane of the centre's face; the arcs lie in the plane of the start's face, or the plane the three points define. A circle whose radius is below `tol::LENGTH * 10` is refused with a flash. Inference during the radius step is on the plane with the centre as anchor, so On Red Axis and typed lengths work as in Rectangle. The 2-point arc's bulge is the sagitta; typing `r` followed by a length (`r12"`) sets the radius instead, as SketchUp does. Half-circle snap (`Half Circle` label) when the bulge is within 4% of the half chord.
**Integration:** new `app/src/tools/circle.ts` (`CircleTool`, `PolygonTool` sharing a base), `app/src/tools/arc.ts`; `app/src/inference/engine.ts` (`center`), `app/src/tools/select.ts`, `erase.ts`, `pick.ts` (`expandCurve`), `app/src/kernel/model.ts` (`addCurve`, `curveOf`, `curveCenter`), `app/src/app.ts` and `app/index.html` (tools, keys C and A), `app/src/units.ts` (`parseSegments`), tests `app/test/curves.test.ts`.

### Feature 5: Scale, mirror and face orientation in the kernel

**What:** `mat_scale(center: V3, factors: [f64; 3]) -> Mat4` and `mat_mirror(point: V3, normal: V3) -> Mat4` in `math.rs`. `transform_vertices` multiplies a wholly transformed face's carried normal by the sign of the matrix's determinant, so a mirrored solid keeps its faces pointing out; a degenerate matrix (a zero factor) is `Error::Degenerate`. `reverse_faces(faces)` flips each (the existing `flip_face`); `orient_faces(seed: FId) -> usize` walks the connected faces of the seed's definition across shared two-face edges and flips every face whose winding along the shared edge agrees with its neighbour's instead of opposing it, returning the count flipped. `set_transform` accepts a mirrored matrix. Fuzz: `Op::Circle { center, radius, segments }`, `Op::Scale { point, normal, factors }`, `Op::Flip { point, normal, axis }`, `Op::Orient { point, normal }`.
**Why:** The kickoff: Scale and Flip go through the one transform path; `docs/roadmap.md` row 2.7; the standing fuzz rule.
**Details:** Scaling loose geometry is `transform_and_integrate` with a scale matrix, so what lands on other geometry welds, as a move does; a face scaled to zero area fails with `Error::Collapsed` and the tool aborts. Scaling an instance is `set_transform(mul(S, T))`. `orient_faces` leaves a face with no two-face edge path to the seed untouched and a non-manifold edge (three or more faces) is a boundary of the walk.
**Integration:** `math.rs`, `edit.rs`, `topo.rs` (`flip_face` stays), new `kernel/src/orient.rs`, `kernel-wasm/src/lib.rs` (`reverse_faces`, `orient_faces`, `curve_of`, `curve_center`, `add_curve`), `kernel/tests/common/fuzz.rs`, `kernel/tests/scale.rs`, `orient.rs`.

### Feature 6: Scale, Flip, Reverse Faces, Orient Faces and the resize prompt

**What:** Scale (key S): with a selection, shows its bounding box in the editing context's axes (a single instance: that instance's own axes) with 26 grips: 8 corners scale uniformly, 12 edge midpoints scale two axes, 6 face centres scale one axis; drag a grip, or type factors (`1.5`, `1.5,1`, `1.5,1,1`) or lengths with units (`3'`, one per scaled axis), opposite grip fixed; Ctrl tapped or held scales about the centre; Shift held toggles uniform. Preview through `transformVertices` and `setTransform`; retype right after amends in one undo step. Flip (no key, toolbar): with a selection, three translucent planes through the bounding box centre, one per axis; hover highlights, click mirrors across it (`mat_mirror`), typed nothing. Edit › Reverse Faces (selected faces) and Edit › Orient Faces (connected to the selected face) as toolbar buttons. Tape Measure: after a measure-only measurement, a typed length asks "Resize the model to make this N?" and on OK scales every vertex of the editing context and every instance in it uniformly about the origin by typed ÷ measured, one undo step named `Resize`.
**Why:** `docs/sprints.md` § 2.4's "Scale ... with grips: uniform, along one axis, or in a plane; typed factors and typed lengths", "Flip and Orient faces"; the 2.3 deferral of the resize prompt.
**Details:** The resize prompt uses `window.confirm` through a `ToolHost.confirm` hook the test host answers. The bench criterion: a group scaled `1.5` along red only changes its length. A locked context refuses with the toast before any grip shows. Grips are picked in screen space (12 px), drawn as the overlay's `grips` list; the planes of Flip as the overlay's `planes` list.
**Integration:** new `app/src/tools/scale.ts`, `app/src/tools/flip.ts`; `app/src/tools/tool.ts` (`Overlay.grips`, `Overlay.planes`, `ToolHost.confirm`); `app/src/tools/measure.ts`; `app/src/app.ts`, `app/index.html` (tools, buttons `reverseBtn`, `orientBtn`, key S), `app/src/view/viewport.ts` (grip and plane drawing), `app/src/math.ts` (`scaling`, `mirror`), `app/src/kernel/model.ts` (`reverseFaces`, `orientFaces`), `app/test/toolhost.ts`, tests `app/test/scale.test.ts`, `flip.test.ts`.

### Feature 7: Rotated rectangle

**What:** Rotated Rectangle (no key, toolbar): click a corner, click or type the length of the first edge in any direction in the plane (the plane rules of Rectangle), then click or type the width, perpendicular to that edge; `length, width` typed at the third step sets both. Retype right after amends.
**Why:** `docs/sprints.md` § 2.4's last deliverable and `docs/features.md` row 53.
**Details:** Reuses `RectangleTool`'s commit and plane logic through a shared module; four `addLine`s in one `Rectangle` transaction, so it welds as the axis-aligned one does.
**Integration:** `app/src/tools/rectangle.ts` (shared `commitRect`, `planeFor` exported), new `app/src/tools/rotrect.ts`, `app/src/app.ts`, `app/index.html`, tests in `app/test/tools.test.ts`.

### Feature 8: Walkthrough, docs and roadmap

**What:** The deck walkthrough's four corner posts become round 4" posts (Circle, `2"`, Push/Pull `3'`, as the step says) and the headless replay in `app/test/offset.test.ts` "Deck walkthrough" runs the new steps with updated counts; docs under Impact.
**Why:** The sprint's done-when; the standing rule that every sprint leaves the docs true.
**Details:** `docs/roadmap.md` rows 2.4, 2.6, 2.7 done; `docs/sprints.md` § 2.4 "Resolved in the sprint"; `docs/architecture.md` § 2 (curves, soft edges, orientation under a mirror), § 3 (edge attributes), § 4 (`edge_attributes`), § 5 (soft edges omitted from the line set, averaged normals), § 6 (centre inference, the new tools), § 9 (fuzz op list), § 10 (status); `docs/file-format.md` § Definitions (`edge_attributes`) and § Attributes; `docs/features.md` rows 53, 54, 55, 67, 71, 72; `README.md` tools, keys (C, A, S), buttons.
**Integration:** docs only, plus the test.

## Success Criteria

### For Feature 1

- [ ] Kernel tests: an edge attribute is set, read, undone and redone; a split edge's halves both carry it; a file with edge attributes round-trips byte-identically against a fixture; a file without `edge_attributes` loads with none and saves without the key; a bad edge index or value is rejected with its path.

### For Feature 2

- [ ] Kernel tests: `add_curve` of 24 points closed gives 24 segments with one curve id and a face; `curve_of` from any segment returns all 24 in chain order; `curve_center` is the centre within `tol::LENGTH`; a line drawn across the circle splits two segments and `curve_of` still returns every piece; erasing the curve's segments removes the face; `offset_edges` of the circle gives a new closed curve; `push_pull` of the circle's face gives a cap curve, 24 side faces and 24 soft side edges, and the box's push/pull gives none; moving one vertex of the circle explodes it (no `builder.curve` left) and moving all 24 keeps it; `validate` fails on a planted curve split across two chains.

### For Feature 3

- [ ] Kernel test: `face_buffers` of the pulled circle has, at a side vertex, a normal that is the average of its two side faces' normals, and `edge_buffers.soft` is true for the 24 side edges only; a box's normals are flat.
- [ ] App test (`scene.test.ts`): the scene index keeps soft edges pickable and the viewport line set excludes them; a mirrored instance's picked face normal is mirrored.
- [ ] Browser check by Patrick: the cylinder reads smooth and the back colour is distinguishable in both themes.

### For Feature 4

- [ ] Headless: Circle on the ground, type `2"`, Push/Pull `8'`: 24 side faces, the rim selects as one curve on one click, `Center` is offered when its segment is hovered; `12s` retypes the circle to 12 segments in one undo step.
- [ ] Headless: Polygon with `6s` and a radius gives 6 segments; 2-Point Arc with a typed bulge and with `r` radius gives 12 segments on the right circle; 3-Point Arc through three points passes through all three; `Half Circle` snaps.
- [ ] Headless: Erase on one segment removes the curve; Select, Shift-click toggles the whole curve.

### For Feature 5

- [ ] Kernel tests: `mat_scale` about a corner by `[1.5, 1, 1]` moves only x; a mirrored box through `transform_and_integrate` keeps every face pointing out (`volume` positive, `validate` passes); `orient_faces` on a box with two faces reversed fixes both and returns 2; a mirrored instance's `set_transform` is accepted; `Error::Degenerate` for a zero factor.
- [ ] The fuzz run with the four new ops stays under a minute at the CI seed with no invariant failure.

### For Feature 6

- [ ] Headless: a bench group scaled `1.5` along the red grip only changes its length; a corner grip with `2` doubles all three; Ctrl scales about the centre; typed `3'` on a one-axis grip sets that dimension; retype amends in one undo step; a locked context refuses before any grip shows.
- [ ] Headless: Flip across the red plane mirrors a group (its transform's determinant is negative) and loose geometry (faces still point out); Reverse Faces flips the selected face's normal; Orient Faces after one reversed face returns the count.
- [ ] Headless: measure-only `10'`, type `20'`, confirm: the editing context's vertices and instances are at twice their coordinates in one undo step named `Resize`; cancel changes nothing.

### For Feature 7

- [ ] Headless: a rotated rectangle at 30° with typed `4', 2'` has four edges, one face, and corners at the expected points; retype amends.

### For Feature 8

- [ ] The deck walkthrough replays headlessly with round posts and the counts in the doc match the test's.
- [ ] Docs under Impact changed and checked against the code (close Gate 4).
- [ ] Browser check by Patrick: the walkthrough's round posts and the Scale of the bench in the hosted build.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `README.md` — Tools line, Keys rows (C, A, S), toolbar buttons (Reverse Faces, Orient Faces, Flip, Rotated Rectangle, Polygon, arcs)
- `docs/architecture.md` — § 2 (curves, soft edges incl. fold diagonals, mirror orientation), § 3 (edge attributes), § 4 (`edge_attributes`), § 5 (soft edges, averaged normals, back colour), § 6 (centre inference; Circle, Polygon, Arc, Scale, Flip, Rotated Rectangle), § 9 (fuzz ops), § 10 (status)
- `docs/file-format.md` — § Definitions (`edge_attributes`), § Attributes (edges; the `builder` namespace's `curve` and `soft` keys)
- `docs/features.md` — rows 53, 54, 55, 67, 71, 72 to built
- `docs/roadmap.md` — rows 2.4, 2.6, 2.7 done; the Milestone 2 test project line
- `docs/sprints.md` — § 2.4 "Resolved in the sprint"
- `docs/walkthrough-deck.md` — round posts

### ADRs

- `mvr2op7t` namespaced attributes: extended to edges by the proposed ADR `edge-attributes-and-the-builder-namespace` (sprint `decisions/`), which also reserves the `builder` namespace for the kernel's own keys (`curve`, `soft`)
- `mvr2opid` tag lock enforced by the kernel: every new operation checks the owner (`add_curve`, scale and mirror through the transform path, `reverse_faces`, `orient_faces`)

### Backlog

- none closed; `#mvr7ne51` phone capture test out of scope; `#mw27k22m` clearance check and `#mw27k22n` demo marking are Milestone 3 survey-mode work, untouched; `#mvr7ndvo` and `#mvscxby4` are doc items outside this sprint's docs

## Scope

### In Scope

**Must Have:** Features 1–6 and 8.
**Should Have:** Feature 7 (rotated rectangle); the `r` radius syntax for the 2-point arc; the Tape Measure resize prompt.

### Out of Scope

- Pie arcs, Follow Me: not Milestone 2 items.
- Styles (x-ray, hidden line, back edges): 5.6. A separate smooth flag: one `soft` flag until styles need the split.
- Surface selection (one click selecting every face of a pulled cylinder's side): waits; curve segments select as one, faces do not.
- Editing a curve as a curve: a bent curve explodes, as in SketchUp.
- Scale of a component definition shared by instances: 3.1. A context menu: Reverse and Orient Faces are toolbar buttons; a context menu waits.
- A mirrored copy from Flip (SketchUp's Ctrl): Move's copy and Flip do it in two steps.
- Dimensions: 4.2.

### Open Questions

None. Resolved 2026-11-05 from SketchUp's documented defaults (kickoff.md § Open Questions): default counts 24, 6, 12; file shape is a sparse `edge_attributes` list beside the unchanged `edges` array (byte-identical files when unused); one `soft` flag means soft and smooth; curve segments select as one, surfaces do not; erasing a segment erases the curve, splitting keeps it, bending explodes it, Offset gives a new curve, Intersect's pieces stay in it through `split_edge`; Scale has SketchUp's 26 grips, Ctrl about centre, Shift uniform, typed factors or lengths; Flip is the plane tool (no "Flip Along" menu); the back colour is a blue-grey chosen in the sprint and checked by Patrick; Reverse and Orient Faces are toolbar buttons.
