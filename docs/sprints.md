# Sprints

This breaks each milestone in [roadmap.md](roadmap.md) into two-week sprints. Each sprint says **what** it delivers and how we'll know it's done, not exactly **how**. The open questions are settled when we plan that milestone in detail, one milestone at a time. Later milestones will shift as we learn.

Every sprint also carries the standing rules: kernel changes come with kernel tests, tool changes with headless tool tests, the browser walkthrough of the milestone's test project still works, and CI stays green.

| Milestone | Sprints | Weeks |
| --- | --- | --- |
| 1. Safe and solid | 1.1 – 1.3 | 6 |
| 2. Everyday tools | 2.1 – 2.4 | 8 |
| 3. Organized models | 3.1 – 3.3 | 6 |
| 4. Share and build | 4.1 – 4.3 | 6 |
| 5. Feels like home | 5.1 – 5.3 | 6 |

---

## Milestone 1: Safe and solid

**Test project:** a 10' × 8' shed with a gable roof, a door and a window cut through the walls. Close the tab mid-way and recover. Move the ridge and have the walls follow.

### Sprint 1.1: Never lose work

**Goal:** a model survives a closed tab, a crash or a reload, and anyone can use the app from a link.

Delivers:
- Autosave of the open model to browser storage after each change, debounced to a few seconds after the last edit.
- The last few autosaves kept as versions, labeled with the time and the last operation ("Push/Pull, 2 min ago").
- On start, an offer to restore when the last session ended with unsaved changes, plus a way to browse and open older versions.
- The file name and an unsaved-changes indicator in the header.
- A hosted build at a public URL, deployed automatically from `main`.
- Offline support: after the first visit, the app loads and works with no network.

Done when:
- Killing the browser mid-model and reopening restores the model as of the last change, with undo history starting fresh.
- Autosave never makes a drag or push/pull preview stutter on the stress model.
- The hosted URL works on Chrome, Firefox and Safari, including offline after one visit.

Open questions: where to host (GitHub Pages, Cloudflare Pages, other); how many versions to keep and how much storage they may use; whether autosave also keeps undo history.

### Sprint 1.2: Moves that stick

**Goal:** Move behaves like SketchUp's: what you move joins what it lands on, and moves that bend a face fold it instead of being refused.

Delivers:
- After a move, moved vertices and edges weld to geometry they land on, splitting edges and faces the same way drawing a line does.
- A face landing on a coplanar face cancels or merges, matching push/pull's settling.
- When a move would make a face non-planar, the face is split into flat triangles along new edges. Those edges are hidden (soft) by default so the surface still reads as one.
- Moving a group onto loose geometry still never sticks.

Done when:
- Moving the shed's ridge up or sideways keeps the gable walls and roof connected and watertight (every edge has two faces).
- Moving a single corner of a box up produces a folded top, not an error.
- Moving a box until its face touches another box's face joins them into one solid with no internal face left over.
- Undo returns the exact previous model in all of these cases.

Open questions: how to choose fold diagonals so results look natural; whether the soft-edge flag lands now in the kernel and format or waits for styles (5.x).

### Sprint 1.3: Intersect and harden

**Goal:** overlapping shapes can be cut into each other, and the kernel holds up to random use.

Delivers:
- **Intersect Faces** with model and with selection, from a menu and the context menu: everywhere two faces cross, a new edge is added and both faces split.
- Lines that pierce a face (rather than lying in it) cut it where they pass through.
- A randomized kernel test that runs thousands of mixed operations (draw, push/pull, move, erase, group, undo, redo) and checks every topology invariant after each step, with failures reduced to a short replayable script.
- A "Report a problem" action that saves the model plus the last operations to a file when an operation fails.
- A model-check command that finds and reports bad geometry (overlapping edges, non-planar faces) in loaded files.

Done when:
- A gable roof made as a separate group and intersected with the walls gives clean roof–wall edges that can be pushed and erased normally.
- The randomized test runs in CI for a fixed number of steps with no invariant failures, and every bug it found this sprint has a regression test.
- The shed test project can be done start to finish in the browser, including recovery after a closed tab.

Open questions: how much exact arithmetic (robust predicates) is needed to make intersection reliable; how long the randomized test runs in CI versus nightly.

---

## Milestone 2: Everyday tools

**Test project:** a 12' × 10' deck on posts, with joists at 16" centers by array, a rotated stair, railings made with Offset and Copy, and round posts.

### Sprint 2.1: Copy and arrays

**Goal:** repeated parts are fast: joists, rafters, deck boards, fence posts.

Delivers:
- Copy by holding Ctrl (Option on Mac) during Move. The status bar and cursor show copy mode.
- Linear arrays: after a copy, typing `5x` makes five copies at the same spacing, and `/5` spaces five copies evenly across the distance. Retyping changes the count until the next operation.
- Copies of groups are new groups. Copies of loose geometry stick wherever they land, using the 1.2 welding.
- Copying many groups stays fast (no slowdown when drawing 50 joists).

Done when:
- In the browser: draw a 2×8 joist as a group, copy it 16" along the red axis, type `9x`, and get ten evenly spaced joists in one undo step.
- `/9` across a 12' span gives ten joists, end to end.

Open questions: whether copies of groups should become components automatically (they will in 3.1).

### Sprint 2.2: Rotate and Offset

**Goal:** angled parts and thickened outlines.

Delivers:
- **Rotate** with an on-screen protractor. Pick a center and a start direction, then sweep or type an angle. The protractor aligns to the face under the cursor or a locked axis. 15° snapping when not typing.
- Rotate-copy with Ctrl, including radial arrays (`6x`, `/6`).
- **Offset** of a face's outline (inward or outward) or of a chain of selected edges, with typed distance and retype.
- Rotating loose geometry welds like Move. Rotation that would bend faces folds them.

Done when:
- A stair stringer can be rotated to 37° by typing it.
- Offsetting a wall's face inward 4" and pushing the ring makes a wall thickness. Offsetting a window rectangle outward 3" and pulling makes trim.
- Rotate and Offset have the same Measurements-box retyping as the other tools.

Open questions: protractor plane choice when hovering edges; how Offset handles self-intersecting results on concave shapes.

### Sprint 2.3: Measure and guide

**Goal:** lay out a design precisely before drawing it.

Delivers:
- **Tape Measure**: measure between any two inferred points, and click an edge then drag to create a parallel guide line at a typed distance. Clicking a point creates a guide point.
- **Protractor**: angled guide lines from a point.
- Guides are snapping targets (on guide, guide intersections), are saved in the file, can be erased and hidden, and are not part of geometry.
- New inferences: **parallel** and **perpendicular** to a hovered edge (magenta, like SketchUp), **from-point** alignment along axes from a recently hovered point, and **intersection** of edges and guides.
- Down arrow locks parallel/perpendicular, matching SketchUp.

Done when:
- Laying out post positions at 4' from two edges using guides, then drawing posts at the guide intersections, works by snapping alone.
- Drawing a line parallel to an angled edge snaps and shows the parallel cue.

Open questions: how long guides show (always vs. on a guides tag); whether the file format gets a `guides` key now (yes, likely, a backward-compatible addition).

### Sprint 2.4: Curves, Scale and Flip

**Goal:** round shapes, resizing, and fixing face direction.

Delivers:
- **Circle** and **Polygon** (center, radius, typed segment count) and **Arc** (two-point bulge and three-point).
- Curves are stored as an edge attribute grouping segments: they select, erase, measure and offset as one, and push/pull of a circle makes a smooth-looking cylinder (side edges soft).
- **Scale** of a selection or group, with grips: uniform, along one axis, or in a plane; typed factors and typed lengths.
- **Flip** and **Orient faces** (make all faces of a solid point out), plus clearer back-face color.
- Rotated (three-point) rectangle.

Done when:
- A round 4" post: draw a circle on the ground, type a radius, pull it up 8'. It reads as smooth and selects as one curve.
- Scaling a bench group to 1.5× along red only changes its length.
- The deck test project can be done start to finish.

Open questions: default segment counts; how curves store in the file format (an additive change); whether soft edges render differently now or wait for styles.

---

## Milestone 3: Organized models

**Test project:** a bookcase built from board components with real thicknesses, colored by material, each part named, with the board list readable from Entity Info and the Outliner.

### Sprint 3.1: Components

**Goal:** edit one part and every copy changes.

Delivers:
- Make Component from a selection, with a name. Copies of a component are instances of it.
- Editing inside any instance changes all of them. Other instances fade while editing, as with groups.
- Make Unique, to split an instance off as its own component; Explode.
- Copy (2.1) of a component makes instances, not new groups.
- A component's axes are set at creation so instances rotate and scale sensibly.
- Drawing a component instance onto a face (gluing, like SketchUp's doors and windows) is out of scope here.

Done when:
- Ten joists as instances: lengthening one lengthens all ten in one undo step.
- Make Unique on one joist then editing it leaves the other nine unchanged.
- Files with components round-trip, and a file's size grows with distinct geometry, not with instance count.

Open questions: naming and numbering rules; whether groups become components behind the scenes later.

### Sprint 3.2: See and find what's in the model

**Goal:** answer "what is this and how big is it?" and find parts in a large model.

Delivers:
- **Entity Info** panel: for an edge its length; for a face its area and material; for a group or component its name, definition, instance count, size of bounding box, and volume when it's a closed solid; for a multi-selection, counts and totals. Name and tag editable here.
- **Outliner**: tree of groups and components, with select-by-click (selects in the viewport and opens the containing group), rename, hide, and search by name.
- **Hide**, **Unhide all**, and **Isolate** (hide everything except the selection).

Done when:
- Clicking a shelf board shows its length, width and thickness, and its volume.
- In a model with 100+ groups, finding and selecting a part by name takes seconds.
- Hidden state saves in the file.

Open questions: panel layout on narrow screens; volume rules for nearly closed solids.

### Sprint 3.3: Tags, materials and settings

**Goal:** organize by category, color the model, and set units.

Delivers:
- **Tags** panel: create, rename, delete, show/hide, and color-by-tag view; assign tags from Entity Info.
- **Materials**: faces render in their material color and opacity, front and back; a default set (woods, metals, concrete, glass); a custom color picker.
- **Paint Bucket**: click to paint a face, Ctrl to paint all connected faces, Shift to paint all matching faces; painting a group paints its default material.
- **Model settings**: display units (feet-inches, inches, mm, cm, m), display precision (1/16" … 0.001"), and snap length; saved in the file.

Done when:
- The bookcase test project can be done start to finish: board components, painted, tagged, with sizes and names readable from Entity Info and the Outliner.
- Metric settings round-trip: a model made in mm reopens in mm.

Open questions: texture support now or later (the roadmap says later); whether settings are per model or per user (likely both, with model overriding).

---

## Milestone 4: Share and build

**Test project:** export the deck as STL and print it; print a dimensioned top view at 1/4" = 1'; get a cut list for the bookcase.

### Sprint 4.1: Export and import

**Goal:** models move in and out of other software.

Delivers:
- Export **STL** (binary, whole model or selection, with a units choice), **OBJ** with materials, and **glTF/GLB** with materials and groups as nodes.
- Import **STL**, **OBJ** and **glTF** into a new group, with a units prompt. Coplanar triangles merge back into faces so imports are push/pull-able.
- Exported solids are checked for holes and inside-out faces, and the export warns when a part isn't watertight.

Done when:
- An exported deck STL opens in a slicer as a watertight solid at the right size.
- A GLB opens correctly in a web viewer with colors.
- Importing an OBJ of a box gives six faces that can be pushed and pulled.

Open questions: import size limits and performance; how much of glTF to support (likely static meshes only).

### Sprint 4.2: Views and printing

**Goal:** flat, measurable views that can be printed.

Delivers:
- **Standard views**: top, bottom, front, back, left, right, iso, from a view menu and shortcuts.
- **Parallel projection** toggle, with zoom by scale ("1/4" = 1'").
- **Dimensions**: linear dimensions placed in the model between inferred points, which update as the model changes and are saved in the file.
- **Print / export view** to PDF and PNG at a chosen paper size and scale, with a simple title block (name, date, scale).

Done when:
- A top view of the deck in parallel projection at 1/4" = 1' prints on letter paper with dimensions, and a measurement off the printout with a ruler matches the model.

Open questions: raster PDF first versus true vector (vector needs hidden-line removal, a later item); dimension style options.

### Sprint 4.3: Cut lists and scenes

**Goal:** turn the model into a shopping and cutting list, and save useful views.

Delivers:
- **Cut list**: for every component and group that is a box-like board, its length × width × thickness, quantity, material and name; totals in board-feet and per material. Grouped by identical parts. Export to CSV and print.
- Parts that aren't box-like are listed separately with their bounding sizes.
- **Scenes**: save the current camera, projection, hidden items and tag visibility as a named scene; switch scenes with a smooth camera move; scenes saved in the file.

Done when:
- The bookcase cut list matches a hand count of boards and sizes, and opens in a spreadsheet.
- The deck test project can be done start to finish, including printing and STL export.

Open questions: how to detect board orientation (grain direction); whether cut-list options (kerf, stock lengths) are in scope now.

---

## Milestone 5: Feels like home

Polish that makes people stay. Planned in detail after Milestone 4, informed by what early users ask for.

### Sprint 5.1: Follow Me and finding tools

Delivers:
- **Follow Me**: sweep a face along a path of edges (gutters, crown molding, handrails, a lathe-style turned leg around a circle).
- **Command palette** (Ctrl+K style), searching every tool and command, with shortcuts shown.
- **Customizable shortcuts**, saved per user.

Done when: a handrail profile swept along a stair's edges, and a turned table leg made by sweeping around a circle, both come out watertight.

### Sprint 5.2: Learn it in ten minutes

Delivers:
- A **first-run tutorial** built on the sample shed: draw, push/pull, inference, typing sizes, groups, saving. Each step checks the user actually did it.
- In-app hints that point out unused features (arrow-key locks, retyping, double-click push/pull) at the right moment, and can be turned off.
- A short help page per tool, opened from the status bar.

Done when: a new user can finish the tutorial without outside help in about ten minutes (tried with real people).

### Sprint 5.3: Fast and good-looking

Delivers:
- Performance: a spatial index in the kernel, rebuilding only changed buffers, and bounding-volume picking. Target: 10× the stress model (20,000 boxes) with smooth orbiting and push/pull.
- **Styles**: x-ray, hidden line, back edges shown dashed, and soft/smooth edge display.
- **Touch and pencil** input for tablets is a stretch goal here, or its own sprint.

Done when: push/pull previews on a 120,000-face model stay above 30 frames per second on a mid-range laptop; each style looks right on the test projects.

---

## How we use this document

- At the start of each milestone we plan its sprints in detail: settle the open questions, write the technical approach, and split the work into tasks.
- At the end of each sprint we demo the "done when" list in the browser, update the status column in `features.md`, and adjust the next sprints.
- If a sprint runs long, we finish it before starting the next rather than leaving half-built tools. Scope moves to a later sprint instead.
