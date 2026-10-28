# Roadmap to a workable application

"Workable" means someone can take a real small project from an empty file to something they can build from, without hitting a wall. Each milestone below ends with a test project that must be possible start to finish.

The order follows three rules:

1. **Don't lose work and don't get stuck.** Data loss or geometry the user can't fix ends trust faster than any missing tool.
2. **Then the tools every project needs.** Copy, Rotate, Offset and curves are on the critical path for sheds, decks and furniture alike.
3. **Then getting the result out.** Exports, measurements and printable views are why people model in the first place.

Sizes are rough guesses for one developer: **S** ≈ 1–2 days, **M** ≈ 1 week, **L** ≈ 2–3 weeks. Status is tracked in `docs/features.md`. The milestones are split into two-week sprints in [sprints.md](sprints.md).

## Milestone 1: Safe and solid

Make what already exists trustworthy.

| # | Item | Size | Why now |
| --- | --- | --- | --- |
| 1.1 | **Autosave and crash recovery** (IndexedDB, keep the last few versions, offer to restore on start). Done, sprint NeverLoseWork, 2026-10. | S | Today nothing is saved until you click Save. One closed tab loses everything. |
| 1.2 | **Weld after Move** (moved vertices and edges merge with geometry they land on, like push/pull already does). Done, sprint MovesThatStick, 2026-10. | M | Moving a face onto another face should join them. Today it overlaps silently. |
| 1.3 | **Intersect Faces** (with model and with selection; also lets a line that pierces a face cut it). Done, sprint IntersectAndHarden, 2026-10: writes into the open context, with context is Later. | L | Roofs meeting walls, a beam through a post, any two shapes that cross. Without it users can't fix overlapping geometry. |
| 1.4 | **Fold instead of reject** when Move would bend a face (split it into planar triangles, as SketchUp does). Done, sprint MovesThatStick, 2026-10; fold edges are ordinary edges, a soft flag waits for styles (5.6). | M | Today the move just stops, which feels broken. |
| 1.5 | **Robustness pass**: randomized kernel tests (draw, push, erase, undo in random order and check invariants), plus a "report this model" export when an operation fails. Done, sprint IntersectAndHarden, 2026-10: `kernel/tests/fuzz.rs` in CI, the problem report download, and the model check. | M | Finds the tolerance bugs real users will hit, before they do. |
| 1.6 | **Hosted build and offline install** (static deploy of `dist/`, plus a service worker so it works offline). Done, sprint NeverLoseWork, 2026-10: https://pjsulin.github.io/builder/ | S | People can use it from a link, with no Rust or Node toolchain. |

**Test project:** draw a 10' × 8' shed with a gable roof, a door and a window cut through the walls. Close the tab mid-way and recover. Move the roof ridge and have the walls follow.

## Milestone 2: The everyday tools

The tools every real model uses, in order of how often they're needed.

| # | Item | Size | Why |
| --- | --- | --- | --- |
| 2.1 | **Copy** (Ctrl with Move) and **arrays** (`5x`, `/5` in the Measurements box). Done, sprint CopyAndArrays, 2026-10: Option on a Mac, copies of groups are independent groups until 3.1. | S | Joists, rafters, deck boards, shelves, fence posts. The most-repeated action in building models. |
| 2.2 | **Rotate** with a protractor, plus rotate-copy | M | Turning furniture, angled walls, roof pitches. |
| 2.3 | **Offset** (faces and edge chains) | M | Wall thickness, window frames, trim, table aprons. |
| 2.4 | **Tape Measure and guides** (guide lines and points, measured distances) | M | How SketchUp users lay out positions before drawing. |
| 2.5 | **Circle, Polygon and Arc**, stored as curves that select as one | L | Round posts, arched doors, table tops. Needs an edge-curve attribute in the kernel. |
| 2.6 | **More inference**: parallel, perpendicular, from-point alignment, intersections, guide snaps | M | Makes everything above precise without typing. |
| 2.7 | **Scale** (uniform and per axis, typed factors) | M | Resizing components and quick shape edits. |
| 2.8 | **Flip and orient faces** | S | Fixes inside-out faces, which matter for exports and 3D printing. |

**Test project:** a 12' × 10' deck on posts, with joists at 16" centers by array, a rotated stair, railings made with Offset and Copy, and round posts.

## Milestone 3: Organized models

Bigger models need structure, and building from them needs numbers.

| # | Item | Size | Why |
| --- | --- | --- | --- |
| 3.1 | **Components**: make component, place copies, edit one to change all, make unique | M | The kernel already supports many instances. Without the UI, every joist is edited separately. |
| 3.2 | **Entity Info panel** (length, area, volume, name, tag, material of the selection) | S | Answers "how big is this?" without the tape measure. |
| 3.3 | **Outliner** (tree of groups and components; select, rename, hide) | M | Finding things once a model has 50+ parts. |
| 3.4 | **Tags** (visibility and color by tag) and **Hide / Isolate** | M | Working on the roof without the walls in the way. |
| 3.5 | **Materials and Paint Bucket** (colors and opacity first, textures later) | M | Already in the kernel and file format; needs rendering and a picker. |
| 3.6 | **Model settings** (units, display precision, snap length) | S | Metric users and fine woodworking both need it. |

**Test project:** a bookcase built from board components with real thicknesses, colored by material, each part named, with the board list readable from Entity Info and the Outliner.

**Survey mode (built ahead of this milestone, sprint SurveyToolkit, 2026-10):** the `survey/` toolkit writes `.builder` files with Existing / Demo / Proposed tags and `survey:*` attributes, and the app opens them in survey mode: a minimal tag strip (show/hide, lock), a read-only attribute view, material colours in the viewport, tag lock enforced by the kernel, and a Proposed → plan export. That UI is deliberately small; 3.2 (Entity Info) replaces the attribute view, 3.4 (Tags) replaces the tag strip, and 3.5 (Materials) adds the picker on top of the colour rendering already done. The kernel pieces they need (attributes, `Tag.locked`, material colours in the scene) are in place.

## Milestone 4: Share and build from it

Getting the model out of the app.

| # | Item | Size | Why |
| --- | --- | --- | --- |
| 4.1 | **Export STL, OBJ, glTF/GLB** | S | 3D printing, other 3D apps, web and AR viewers. The render buffers already hold the triangles. |
| 4.2 | **Standard views** (top, front, side, iso) and **parallel projection** | S | Plans and elevations need flat, undistorted views. |
| 4.3 | **Export the view to PNG and PDF at scale** | M | Printing a plan for the lumber yard or a permit sketch. |
| 4.4 | **Import STL, OBJ, glTF** (merging coplanar triangles back into faces) | M | Using downloaded models and furniture. |
| 4.5 | **Cut list** (board sizes and counts from components; board-feet totals) | M | A big reason woodworkers and deck builders use SketchUp extensions. |
| 4.6 | **Scenes** (saved views with visibility) | M | Returning to the same views, and the basis for later drawing sheets. |

**Test project:** export the deck as STL and print it. Print a dimensioned top view to PDF at 1/4" = 1'. Get a cut list for the bookcase.

## Milestone 5: Feels like home

Polish that makes people stay.

| # | Item | Size |
| --- | --- | --- |
| 5.1 | Follow Me (gutters, trim, handrails) | M |
| 5.2 | Command palette and searchable tools | S |
| 5.3 | Customizable shortcuts | S |
| 5.4 | First-run tutorial built on the sample shed | M |
| 5.5 | Performance: spatial index in the kernel, rebuild only changed buffers, BVH picking | M |
| 5.6 | Styles: x-ray, hidden line, back edges | M |
| 5.7 | Touch and pencil input | L |

## After a workable app

These come from the Later and Full app tiers in `docs/features.md`. Their order depends on who the first users are.

- Section planes, then drawing sheets with live viewports and dimensions (the LayOut equivalent).
- Solid tools (union, subtract), using a manifold boolean library on closed groups.
- The plugin API, already designed in `docs/architecture.md`.
- Desktop app (Tauri), DXF import and export, terrain.
- Building data: classification, schedules, parametric walls, doors and windows, IFC.

## Rough total

Milestones 1–4 are about 4–6 months for one developer (13 two-week sprints in `sprints.md`, with some slack), or about half that for two working in parallel on the kernel (1.2–1.5, 2.5) and the app (1.1, 1.6, 2.1–2.4, Milestone 3). After Milestone 4, Builder covers what most people use SketchUp Free for.
