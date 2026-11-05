---
created: 2026-11-04
sprint: MeasureAndGuide
start: e025cc7
started: '2026-11-05'
step: '6'
---

# Requirements: MeasureAndGuide

## Background

Sprints 1.1–2.2 are merged. The deck test project (`docs/walkthrough-deck.md`) has its frame, posts, joists, stringer and railing, but every position in it is typed as an offset from the last click, because nothing can be measured or marked before drawing. `docs/sprints.md` § Sprint 2.3 is the plan: "lay out a design precisely before drawing it", done when "laying out post positions at 4' from two edges using guides, then drawing posts at the guide intersections, works by snapping alone" and "drawing a line parallel to an angled edge snaps and shows the parallel cue". The user asked to "plan the next few sprints", chose to plan 2.3 and 2.4 together and run them in order, and asked that the open questions be settled from "what is currently done in SketchUp as a default" (kickoff.md, 2026-11-04). The kernel has no guide entity, edges carry no attributes, and the inference engine knows endpoint, midpoint, origin, on-edge, on-face, axis, line, plane and ground only.

## Summary

Add guides (lines and points) as a journaled kernel entity saved under a new additive `guides` key, a Tape Measure tool that measures and places guides, a Protractor tool that places angled guides, and the parallel, perpendicular, from-point, intersection and on-guide inferences with Down-arrow and Shift locks, matching SketchUp's defaults.

## Goals

### Primary Goal

Positions can be laid out by snapping alone: the deck's posts at 4' from two edges land on guide intersections without typing an offset.

### Secondary Goals

- Kernel and format: guides as entities, owned by a definition, journaled, serialised additively, validated and lock-checked.
- Tools: Tape Measure (measure, guide line, guide point, Ctrl toggle, typed distance and retype) and Protractor (angled guide, 15° ticks, typed angle or slope).
- Inference: parallel and perpendicular to a referenced edge (magenta), from-point alignment, intersection, guide point and on-guide; Down arrow cycles parallel, perpendicular, off.
- Housekeeping: hide guides (saved), Delete Guides, Erase removes a guide, a fuzz op, docs and the deck walkthrough's layout step.

## Features

### Feature 1: Guides in the kernel and the file

**What:** `Guide::Line { origin, dir }` and `Guide::Point { pos }` in a journaled arena, each owned by a `DefId`, with create, erase, erase-all and query; `guides` and `guides_visible` keys in format version 1.
**Why:** Background: nothing can be marked before drawing, and the format must stay readable by earlier readers.
**Details:** Guides take no part in topology, welding, healing or push/pull. `validate` checks every guide's owner is a live definition and its direction is a unit vector. Create and erase refuse when the owner is locked (ADR `mvr2opid`). Absent keys mean no guides and visible. Guides move with their definition's instances because they are in definition coordinates.
**Integration:** `doc.rs` arena next to vertices and edges, `format.rs` read and write, `check.rs`, kernel-wasm wrappers and `Model` methods, following the shape of the attribute work in sprint 01.

### Feature 2: Tape Measure tool

**What:** Key T. Guide-create mode by default (`+` cursor); Ctrl, Option on a Mac, is a tap toggle to measure-only. First click on an endpoint then a second click places a guide point at the typed or clicked distance along that direction; first click on a midpoint, an edge or a face then a drag places a parallel infinite guide line at the dragged or typed distance; any two points in measure-only mode show the length in the Measurements box and change nothing. Retyping amends the last guide.
**Why:** Background: lay out before drawing, by SketchUp's defaults.
**Details:** The distance is read-only text while measuring and a `parseLength` value when placing. Esc cancels. A locked context refuses with a toast before any preview. Resizing the model from a measurement is out of scope (2.4).
**Integration:** A `Tool` mirroring `OffsetTool`'s state record and `MoveTool`'s copy-key toggle; overlay segments for the preview; the retype path through undo and redo like every other tool.

### Feature 3: Protractor tool

**What:** Toolbar button, no default key. Click a centre, click a base direction, sweep or type an angle (decimal, or a slope such as `3:12`), and a guide line is placed through the centre at that angle. Snaps to 15° ticks near the protractor's centre, finer farther out.
**Why:** Background: angled layout (the stringer's pitch) before drawing it.
**Details:** The protractor lies on the face under the cursor, on a face of a hovered edge, else the ground; Shift holds the plane, arrow keys lock an axis, exactly Rotate's rules. Retyping amends the last guide.
**Integration:** Reuses `Overlay.protractor`, `parseAngle` (extended with slope syntax) and the plane rules in `rotate.ts`.

### Feature 4: New inferences and locks

**What:** `InferenceKind` gains `parallel`, `perpendicular`, `fromPoint`, `intersection`, `guidePoint`, `onGuide`. The last edge hovered long enough to show On Edge is the referenced edge; parallel and perpendicular cues to it draw magenta with labels `Parallel to Edge` and `Perpendicular to Edge`. From-point draws a dotted line from the last hovered point (until the next click) along an axis. Intersection is found where two edges, two guides or an edge and a guide cross within the screen radius. Down arrow cycles parallel, perpendicular, off; Shift holds any cue, as today.
**Why:** Background: the second done-when line, and the guides are useless unless they snap.
**Details:** Ranking: guide point with endpoint and midpoint; intersection next; parallel, perpendicular and from-point with the axis inferences; on-guide with on-edge. The referenced edge and the from-point memory are engine state, cleared on tool change. Edges behind faces cannot be hovered, so they are never referenced.
**Integration:** `engine.ts` over the existing scene-query interface; `app.ts` arrow handling at the Down key; every tool that calls `infer` gets the new cues without change.

### Feature 5: Housekeeping, tests and docs

**What:** View menu toggle for guides saved as `guides_visible`; Edit > Delete Guides as one undo step; Erase on a guide; a dashed guide layer in the view clipped to the viewport; `Op::Guide` and `Op::EraseGuide` in the fuzz test; headless tests for both tools and the engine; docs.
**Why:** The standing rules of every sprint, plus SketchUp's own guide housekeeping.
**Details:** Docs: `docs/architecture.md` § 2, 3, 4, 6; `docs/file-format.md` new Guides section; `docs/features.md` rows Tape Measure and Protractor; `README.md` tools, keys and bullets; `docs/roadmap.md` row 2.3 done; `docs/walkthrough-deck.md` gains the post layout by guides before the posts step.
**Integration:** `app/src/view/` layer like the axis lines; `kernel/tests/common/fuzz.rs`.

## Success Criteria

### For Feature 1

- [ ] Kernel tests: create and erase a guide line and a guide point, undo and redo restore them, erase-all is one journal entry, a locked owner refuses, `validate` rejects a guide with a dead owner or a zero direction.
- [ ] A file with guides round-trips byte-identically through save and load; a file without the keys loads with no guides and visible; a guide inside a group reads back in that definition.

### For Feature 2

- [ ] Headless: click an edge of the deck rim, drag off it, type `4'`, a guide line parallel to the edge at 4' exists; retype `3'` moves it in one undo step.
- [ ] Headless: click an endpoint, click a second point, type `2'`, a guide point 2' along that direction exists.
- [ ] Headless: Ctrl, then two points, shows the length in the Measurements box and the model revision is unchanged.
- [ ] Headless: a locked context refuses with the toast before preview.

### For Feature 3

- [ ] Headless: centre, base along red, type `37`, a guide line at 37° exists; type `3:12`, it is at atan(3/12); sweep to 22° near the centre snaps to 15°.
- [ ] Headless: plane follows the hovered face, the arrow keys lock an axis.

### For Feature 4

- [ ] Engine tests: hovering an edge then moving from an anchor gives `Parallel to Edge` and `Perpendicular to Edge` within the radius; Down cycles parallel, perpendicular, off; Shift holds.
- [ ] Engine tests: two guide lines crossing give `Intersection`; a guide point gives `Guide Point`; a point on a guide line gives `On Guide`; from-point gives a dotted cue from the last hovered point.
- [ ] Headless: two guides at 4' from two rim edges, then Rectangle snapping to their intersection draws a post footprint whose corner is exactly at the intersection, no typing.

### For Feature 5

- [ ] Guides hidden, saved, reopened: still hidden. Delete Guides removes all in one undo step. Erase on a guide removes it.
- [ ] The fuzz run with the new ops stays under a minute at the CI seed with no invariant failure.
- [ ] Docs under Impact changed and checked against the code; the deck walkthrough's new step replays headlessly.
- [ ] Browser check by Patrick: the walkthrough's layout step in the hosted build.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `README.md` — Tools line, Tape Measure and Protractor bullets, Keys row T, Edit and View menu items
- `docs/architecture.md` — § 2 (guides are not topology), § 3 (guide arena, journal), § 4 (keys), § 6 (inference list and locks: Down now cycles parallel and perpendicular)
- `docs/file-format.md` — new Guides section and top-level keys `guides`, `guides_visible`
- `docs/features.md` — rows Tape Measure and guides, Protractor and angled guides to built
- `docs/roadmap.md` — row 2.3 done, row 2.5 inference merged into it
- `docs/sprints.md` — § 2.3 resolutions
- `docs/walkthrough-deck.md` — layout step by guides

### ADRs

- `mvr2opid` tag lock enforced by the kernel: guide create and erase check the owner
- `mvr2op7t` namespaced attributes: not used; guides are their own key, not attributes, and 2.4's edge attributes follow this ADR

### Backlog

- none closed; `#mvr7ne51` phone capture test out of scope; `#mw27k22m` clearance check and `#mw27k22n` demo marking are Milestone 3 survey-mode work, out of scope, untouched by guides

## Scope

### In Scope

**Must Have:** Features 1–4, the view layer, Erase on guides, fuzz op, docs.
**Should Have:** Delete Guides and the saved visibility toggle; the slope syntax in `parseAngle`.

### Out of Scope

- Edge attributes, curves, soft edges, Scale, Flip, rotated rectangle, resize-the-model from Tape Measure: 2.4.
- Dimensions: 4.2. A guides tag: 3.3. Finite guide lines: not in SketchUp either.

### Open Questions

None. The kickoff's questions were resolved from SketchUp's defaults on 2026-11-04 (kickoff.md § Open Questions).
