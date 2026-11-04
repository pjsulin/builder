# Sprint Kickoff: MeasureAndGuide

**Captured from conversation:** 2026-11-04

## Context

Sprints 1.1–2.2 are Completed and merged; the deck test project of Milestone 2 has its frame, posts, joists, a rotated stringer and a railing (`docs/walkthrough-deck.md`), and lays those out by typed distances alone because nothing can be measured or marked before drawing. Sprint 2.3 in `docs/sprints.md` adds the Tape Measure, Protractor guides and the next inferences. It was planned together with 2.4 (Curves, Scale and Flip) so the two file-format additions and the soft-edge question are settled once; 2.4 is created and planned after this sprint closes.

## Decisions

- **Plan 2.3 and 2.4 together, run them one after the other:** both close out Milestone 2 and share the format and soft-edge questions; Milestone 3 is planned as a whole after 2.4, as `docs/sprints.md` prescribes, because the renovation ADR (`mw27k22l`) left the clearance check's placement open.
- **Guides are a new top-level `guides` key in the version 1 format, not geometry:** a guide line (point and direction, unbounded) or guide point lives in the file as an additive key readers before this sprint ignore; guides are not edges, do not take part in welding, healing or push/pull, and are erased, hidden and journaled like anything else. Infinite lines match SketchUp; a guide carries no definition membership beyond the context it was drawn in.
- **Edge attributes wait for 2.4:** edges carry no `attributes` today (definitions, instances and faces do). The curve grouping and a soft flag both need them, so 2.4 adds edge attributes as one format change; 2.3 adds nothing to edges.
- **Soft edges render in 2.4, styles stay in 5.6:** the fold edges 1.4 left as ordinary edges and the side edges of a pulled circle get a soft flag in 2.4, drawn as not-drawn-but-pickable so the surface reads as one; x-ray, hidden-line and back-edge styles remain Milestone 5. 2.3 does not touch rendering of edges.
- **Tape Measure measures and makes guides, Protractor makes angled guides:** two tools, matching `docs/sprints.md`. Click two points to measure (result in the Measurements box, no geometry); click an edge then drag off it for a parallel guide line at a dragged or typed distance; click a point for a guide point. Protractor: centre, base direction, swept or typed angle, writes a guide line.
- **New inferences are parallel, perpendicular, from-point and intersection; Down arrow locks parallel/perpendicular:** the engine gains these kinds with SketchUp's magenta cue; Down arrow, which today locks the current inference, keeps that behaviour and in Line, Move and Rotate prefers a parallel/perpendicular lock when the hovered edge gives one. Guides are snapping targets (on guide, guide intersection).
- **Tool sprints add fuzz operations:** the standing rule from 2.2 holds; guides get an `Op` in `kernel/tests/common/fuzz.rs` (create, erase, with undo) so the invariant check covers them, even though they never touch topology.

## Scope

**In scope:**

- Kernel: a `Guide` entity (line or point) in the document, journaled, with create, erase, hide and query; serialised as the `guides` key; `validate` checks guides reference a live definition; tag lock refuses guide edits inside a locked context (ADR `mvr2opid`).
- Tape Measure tool: measure, parallel guide from an edge, guide point; typed distance and retype.
- Protractor tool: angled guide line from a centre and base direction; 15° snapping and typed angle, reusing Rotate's protractor overlay and `parseAngle`.
- Inference engine: parallel, perpendicular, from-point alignment and intersection kinds; guides as targets; Down-arrow lock behaviour; drawing of the magenta cues and dashed guide lines.
- Erase removes guides; a guides-visible toggle (shown/hidden) persisted in the file.
- Headless tool tests, kernel tests, fuzz op, docs (architecture § 2, 3, 4, 6; file-format; features; README; roadmap row 2.3 done) and the deck walkthrough gains a guides step (post positions at 4' from two edges).

**Out of scope:**

- Edge attributes, curves, soft edges: 2.4, one format change.
- Scale, Flip, Orient faces, rotated rectangle: 2.4.
- A guides tag or layer: guides are a document list with one visibility flag; grouping by tag waits for the tag panel (3.3).
- Dimensions (placed, saved, updating): 4.2.
- Guide lines bounded to a segment: SketchUp's are infinite; none needed.
- Resizing the model from a Tape Measure measurement: a scale operation, added with Scale in 2.4.

## Technical Approach

- Guides live beside vertices and edges in the kernel document, owned by a `DefId`, as `Guide::Line { origin, dir }` and `Guide::Point { pos }` in the definition's coordinates, stored in a journaled arena like faces so undo and redo restore them; no entry in `topo.rs`, no faces.
- `format.rs` writes `guides: [{ "definition": i, "kind": "line", "origin": [..], "dir": [..] } | { "kind": "point", "pos": [..] }, ...]` plus a top-level `guides_visible` boolean, both additive under the compatibility rules of `docs/file-format.md`; absent means none and visible.
- The app renders guides as a dashed line layer like the axis lines (`app/src/view/`), clipped to the viewport, so infinite lines cost nothing in buffers; picking of guides is a screen-space line distance in the inference engine, not the scene picker.
- `InferenceKind` gains `"parallel" | "perpendicular" | "fromPoint" | "intersection" | "onGuide"`; parallel and perpendicular come from the most recently hovered edge (kept as a recent-edge memory like the from-point memory), intersection from pairs of edges and guides in screen radius; all four are ranked below endpoint and midpoint.
- Tape Measure and Protractor are `Tool` implementations mirroring `OffsetTool` and `RotateTool` state records; the Measurements box shows a measured length read-only and accepts a distance or angle to place the guide, through `parseLength` and `parseAngle`.
- Fuzz: `Op::Guide { point, normal, distance }` creates a guide from a random face edge; `Op::EraseGuide`; the shrinker and renderer unchanged.

## Open Questions

Resolved 2026-11-04 from SketchUp's documented defaults (help.sketchup.com "Measuring angles and distances", "Using guides"; community sources for the Down-arrow sequence), read through search summaries because the help site is outside this session's network.

- **Guide cues:** a guide point is a point inference labelled `Guide Point`, ranked with endpoint and midpoint; a guide line gives `On Guide` (ranked with On Edge) and crossings of guides with guides or edges give `Intersection`. SketchUp shows a guide point as a short dashed stub with an x, a guide line as an infinite dotted line; Builder draws the same.
- **Reference edges and from-point memory:** one referenced edge, the last one hovered long enough to show its On Edge cue, feeds parallel and perpendicular, as in SketchUp. Down arrow cycles parallel, perpendicular, off; Shift holds whatever cue is showing. From-point memory holds the last hovered point until the next click.
- **Guides visibility is saved in the file:** SketchUp keeps View > Guides in the style stored with the model, so hiding survives save. `guides_visible` is a top-level file key; Edit > Delete Guides erases all guides in one undo step and is in scope.
- **Tape Measure's resize-the-model prompt is out of scope:** SketchUp offers it when a typed length follows a two-point measurement. It is a scale operation and waits for Scale in 2.4, where the same prompt can be added on top of `scale`. Measure mode only reports.
- **Hidden reference edges are skipped:** parallel and perpendicular cues come only from a hovered edge, and the engine already skips points behind faces, so an edge that cannot be hovered cannot be referenced. No special case.
- **Adopted defaults (SketchUp):** Tape Measure starts in guide-create mode with a `+` cursor; Ctrl (Option on a Mac) toggles measure-only, the same tap toggle Move and Rotate use for copy. Clicking an endpoint makes a guide point; clicking a midpoint, an edge or a face and dragging makes a parallel infinite guide line at the dragged or typed distance; clicking a guide point or line as the first point measures from it. Protractor snaps to its 15° ticks near the centre and measures finer farther out, accepts a decimal angle or a slope such as `3:12`, lies on the face under the cursor, and Shift or the arrow keys lock its plane, reusing Rotate's rules. Tape Measure's key is T; Protractor has no default shortcut in SketchUp, so Builder leaves it a toolbar button until the command palette (5.x).
- **Guides belong to their editing context:** a guide drawn inside a group is owned by that definition and moves with its instances, which the kernel's `DefId` ownership gives for free; this closes the "guides inside groups" item that was out of scope.

## References

- `docs/sprints.md` § Sprint 2.3 and § 2.4, `docs/roadmap.md` rows 2.3–2.7, `docs/features.md` rows Tape Measure, Protractor, Soften/smooth edges
- `docs/file-format.md` § Attributes and § Compatibility rules (additive keys), `docs/architecture.md` § 2, § 3, § 4, § 6 (inference ranking, point inferences list)
- `kernel/src/doc.rs` (`Edge`, `Attributes`, `AttrTarget`), `kernel/src/format.rs`, `kernel/src/check.rs`, `kernel/tests/common/fuzz.rs` (`Op`), `kernel/tests/common/mod.rs` `validate`
- `app/src/inference/engine.ts` (`InferenceKind`, `InferOptions`, `toggleAxisLock`, `lockCurrent`), `app/src/app.ts` arrow-key handling (~line 845), `app/src/tools/rotate.ts` (protractor overlay, `parseAngle`), `app/src/tools/offset.ts`, `app/src/units.ts`
- `.flux/sprints/06_RotateAndOffset_Completed/` (kickoff and close: tool-state pattern, fuzz rule, repomap still at e41a3ad), `.flux/decisions/mvr2opid-tag-lock-enforced-by-the-kernel.md`, `.flux/decisions/mw27k22l-survey-record-is-the-source-of-truth.md` (why Milestone 3 is planned whole)
