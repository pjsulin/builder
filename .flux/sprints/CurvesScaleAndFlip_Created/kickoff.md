# Sprint Kickoff: CurvesScaleAndFlip

**Captured from conversation:** 2026-11-05

## Context

Sprint 2.3 (MeasureAndGuide, sprint 07) is Completed and merged; Milestone 2's deck test project (`docs/walkthrough-deck.md`) has everything but its round posts, which "wait for the curves sprint". Sprint 2.4 in `docs/sprints.md` is the last sprint of Milestone 2: Circle, Polygon and Arc stored as curves, soft edges, Scale, Flip and Orient Faces, and the rotated rectangle. It was planned together with 2.3 in the 2.3 kickoff (2026-11-04), which settled the shared questions (edge attributes as one format change, soft edges rendered in 2.4, resize-the-model with Scale) and said 2.4 "is created and planned after this sprint closes". That creation had not happened; the user asked on 2026-11-05 to "kick off and then plan it".

## Decisions

- **The sprint is the four items `docs/sprints.md` § 2.4 lists, as one sprint:** curves (Circle, Polygon, Arc), soft edges, Scale with Flip and Orient Faces, rotated rectangle. Roadmap rows 2.4, 2.6 and 2.7 are delivered by it; the deck walkthrough gets its round posts and the Milestone 2 "done when" is met.
- **Edges gain `attributes`, one format change:** carried from the 2.3 kickoff. `Edge` today has no attributes (definitions, instances and faces do, ADR `mvr2op7t`); curves and the soft flag both need them, so `AttrTarget::Edge` is added once, under the same namespace and scalar-value rules, and the file change is additive so sprint-07 readers still open 2.4 files.
- **A curve is an edge attribute grouping segments, not a new entity:** `docs/architecture.md` § 2 and `docs/features.md` rows 54–55 prescribe it. Segments stay ordinary edges in the topology (welding, healing, push/pull unchanged); the attribute is what makes them select, erase, measure and offset as one and gives the centre inference.
- **Soft edges render in 2.4, styles stay in 5.6:** carried from the 2.3 kickoff. The side edges of a pulled curve and the fold diagonals `fold_for_move` creates get a soft flag, drawn not-at-all but pickable so the surface reads as one; x-ray, hidden-line and back-edge styles remain Milestone 5.
- **Scale and Flip go through the one transform path Move and Rotate share:** `transform_vertices` / `transform_and_integrate` for loose geometry and `set_transform` for instances take any `Mat4`; Scale passes a scale matrix about a fixed point, Flip a mirror. A mirror reverses winding, so the kernel reorients faces on commit; Orient Faces and Reverse Faces are the same reorientation exposed as operations.
- **Rotated rectangle is a tool-only change:** three clicks (edge, then width) and the existing `add_face` path; no kernel work.
- **Resize-the-model from Tape Measure lands here:** deferred from 2.3 as "a scale operation"; it is a uniform Scale of the context about its origin by typed ÷ measured, offered after a measure-only measurement.
- **Open questions are settled from SketchUp's defaults during planning**, as 2.3's were, not left to the sprint.
- **Tool sprints add fuzz operations:** the standing rule since 2.2; curves, scale and flip get `Op`s in `kernel/tests/common/fuzz.rs`.
- **Milestone 3 is planned whole after this sprint**, as `docs/sprints.md` prescribes and the 2.3 kickoff repeated.

## Scope

**In scope:**

- Kernel and format: `attributes` on edges (`AttrTarget::Edge`); a `curve` grouping (an id and segment order) and a `soft` flag as edge attributes; the additive file change; `validate` and `check` rules for them; split, weld and heal carry curve membership and softness sensibly.
- Kernel ops: `add_curve` (closed or open polyline that is one curve), a scale/mirror matrix through the transform path with face reorientation on mirror, `reverse_face`, `orient_faces` (make every face of a connected shell agree with a seed), curve-aware erase, measure and offset.
- Tools: Circle (C), Polygon, Arc (two-point bulge and three-point), each with a typed radius and typed segment count (`24s`, `6s`) in the Measurements box; Scale (S) on a selection or group with grips, typed factors and typed lengths; Flip; rotated rectangle inside Rectangle (R); Orient Faces and Reverse Faces as commands.
- Inference: `center` (curve centre), and curves as one hover and selection target.
- Rendering: soft edges not drawn; smooth shading across soft edges so a pulled circle reads as a cylinder; a clearer back-face colour.
- Push/pull of a curved face: side edges soft, the sides one surface.
- Fuzz ops, headless tool tests, kernel tests, docs (architecture § 2, 3, 6, 9, 10; file-format; features; README; roadmap rows 2.4, 2.6, 2.7; sprints § 2.4 resolutions) and the deck walkthrough's round posts.

**Out of scope:**

- Pie arcs and Follow Me: `docs/sprints.md` § 2.4 lists two-point and three-point arcs only; Follow Me is not a Milestone 2 item.
- Styles (x-ray, hidden line, back edges): 5.6.
- Exact curved solids, fillets, round corners: Full app, a different kernel (`docs/architecture.md` § Alternatives).
- Editing a curve as a curve (dragging it keeps it round): SketchUp explodes a curve whose segment is edited; so does Builder.
- Components and the Scale of a definition shared by instances: 3.1; scaling an instance scales that instance's transform only.
- A Scale that sets a non-uniform transform on an instance and then edits inside it: as SketchUp, edits happen in definition coordinates; no special handling.
- Dimensions: 4.2.

## Technical Approach

- `Edge` gets `attributes: Attributes`, `AttrTarget::Edge(EId)`, and `set_attribute` covers it; `format.rs` keeps `edges: [[a, b], ...]` for readers before this sprint and adds an additive, sparse `edge_attributes` list (or per-edge objects, settled in planning by `docs/file-format.md` § Compatibility rules). The `builder` namespace holds `curve` (a per-definition curve id and the segment's index) and `soft` (boolean); unknown namespaces still round-trip.
- Curve bookkeeping is a kernel concern: `add_curve` writes the segments with one id; `add_edge` splitting a curve segment copies the attribute to both halves; moving a curve's vertex (`transform_and_integrate` with only some of the curve's vertices) drops the curve id from its segments (explode), as SketchUp does; `curve_of(EId) -> Vec<EId>` is the query selection, erase, measure and offset use.
- Push/pull: side edges between two side faces born from consecutive segments of one curve are marked `soft`. The mesher (`mesh.rs`) averages normals across soft edges so the surface shades smooth; the edge buffer omits soft edges; picking of a soft edge stays in the picker so Erase can unsoften later.
- Scale: `mat_scale(center, [sx, sy, sz])` in `math.rs`; a mirror is a scale with one negative factor. `transform_vertices` already carries a wholly transformed face's normal through the matrix (`mat_apply_dir`); a mirror needs `det < 0` handling so the carried normal is flipped and the loop reversed on commit. Orient Faces walks a shell across shared edges, flipping faces whose winding disagrees with the seed.
- Scale tool: a bounding box of the selection in the editing context, 26 grips as SketchUp (8 corners uniform, 12 edge midpoints two-axis, 6 face centres one-axis), drag or typed `1.5`, `1.5,1,1`, or a length `3'` for the dragged dimension; Ctrl scales about the centre, Shift toggles uniform; preview through `transform_vertices` like Move and Rotate.
- Flip: SketchUp 2023's Flip tool, three planes on the selection's bounding box, click one to mirror, Ctrl for a mirrored copy.
- Circle, Polygon, Arc tools follow `RectangleTool`'s shape (two clicks, typed override, retype amends); segment count typed as `Ns` is sticky per tool, as in SketchUp.
- Inference: `InferenceKind` gains `center`, found from a hovered curve's segments (circumcentre of three vertices), ranked with endpoint and midpoint; selecting a curve segment selects its curve.

## Open Questions

To resolve from SketchUp's defaults during `/plan`, as 2.3's were:

- **Default segment counts:** SketchUp uses 24 for Circle, 6 for Polygon, 12 for Arc; Builder adopts them unless planning finds a reason not to.
- **File shape for edge attributes:** sparse `edge_attributes: [{ "edge": i, "attributes": {...} }]` beside the unchanged `edges` array, or `edges` entries that may be objects. The sparse list keeps byte-identical output for files without curves; planning picks one and the ADR records it.
- **Soft versus smooth:** SketchUp distinguishes soft (edge hidden, faces form a surface) from smooth (shading blends). A pulled circle needs both; does Builder keep one flag that means both, or two? Lean: one `soft` flag meaning both, until styles need the split.
- **What selects as one:** a curve's segments, yes; also the side faces of a pulled curve as one surface (SketchUp selects a surface as one)? Lean: curve segments only in this sprint; surface selection waits.
- **What happens to a curve under edits:** erasing one segment erases the curve; splitting a segment by a crossing line keeps the curve; moving one of its vertices explodes it; Offset of a curve gives a curve; Intersect Faces through it keeps the pieces as curve segments? Settle each from SketchUp.
- **Grips and modifiers for Scale** and the Flip tool's form: confirm the 26-grip set, Ctrl-about-centre, Shift-uniform, and whether an older "Flip Along" axis menu is wanted in addition to the plane tool.
- **Back-face colour:** which colour reads clearly against the face and edge colours in both themes.
- **Orient Faces and Reverse Faces entry points:** Builder has no context menu (`app.ts` cancels `contextmenu`); the Edit menu, or a context menu added now.

## References

- `docs/sprints.md` § Sprint 2.4 and § 2.3 "Resolved in the sprint", `docs/roadmap.md` rows 2.4, 2.6, 2.7 and the Milestone 2 test project, `docs/features.md` rows 53–55, 67, 71, 72
- `docs/architecture.md` § 2 (curves as an edge attribute), § Transform path (fold diagonals "a soft-edge flag waits for styles"), § Batched drawing (back faces), § Inference (centre inference), § Alternatives (exact curves)
- `docs/file-format.md` § Attributes and § Compatibility rules, `docs/walkthrough-deck.md` (round posts)
- `kernel/src/doc.rs` (`Edge`, `Attributes`, `AttrTarget`, `set_attribute`), `kernel/src/format.rs` (`edges: Vec<[u32; 2]>`, `write_attributes`, `read_attributes`), `kernel/src/edit.rs` (`transform_vertices`, `transform_and_integrate`, `fold_for_move`), `kernel/src/math.rs` (`mat_translation`, `mat_rotation`, `mat_apply_dir`), `kernel/src/pushpull.rs`, `kernel/src/offset.rs` (`offset_edges`), `kernel/src/mesh.rs`, `kernel/src/check.rs`, `kernel/tests/common/fuzz.rs` (`Op`)
- `app/src/tools/rectangle.ts`, `rotate.ts`, `move.ts`, `measure.ts`, `select.ts`, `erase.ts`, `app/src/inference/engine.ts` (`InferenceKind`), `app/src/view/viewport.ts` (materials, `back`), `app/src/units.ts` (`parseLength`, `parseLengths`, `parseAngle`)
- `.flux/sprints/07_MeasureAndGuide_Completed/kickoff.md` (the 2.3 decisions this sprint carries), `.flux/decisions/mvr2op7t-namespaced-attributes-in-the-builder-format.md` (to be extended to edges by a proposed ADR), `.flux/decisions/mvr2opid-tag-lock-enforced-by-the-kernel.md`
