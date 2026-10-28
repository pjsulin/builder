# Feature survey

This survey covers SketchUp and the other tools people use to model small buildings. It groups the features and tags each one with the tier we plan to build it in. The tags decide build order. They do not rank which features matter more.

| Tier | Meaning |
| --- | --- |
| **Core** | Needed for the first version someone could use to model a shed, deck or bookcase from start to finish. |
| **Later** | Valuable once the core is solid. Most SketchUp Pro users rely on several of these. |
| **Full app** | The long-range vision: building data (BIM), drawings, collaboration. |

The architecture has to leave room for every tier, including Full app. Only Core gets built first.

## Tools surveyed

| Tool | What it is | What we take from it |
| --- | --- | --- |
| **SketchUp** (Free web, Go, Pro, Studio) | The reference. Edge-and-face modeling with push/pull, inference and typed dimensions. Pro adds LayOut, Style Builder, solid tools and the desktop extension platform. | The core interaction model, almost unchanged. |
| **SketchUp LayOut** | A 2D sheet editor whose viewports stay linked to the 3D model. Adds dimensions, labels, title blocks and PDF/DWG output. | The plan for drawings: live model viewports on sheets rather than a separate drafting app. |
| **Popular SketchUp extensions** | Fredo6 (RoundCorner, JointPushPull, Curviloft), ThomThom (CleanUp³, Vertex Tools, Solid Inspector²), 1001bit and Profile Builder (architecture), CutList and OpenCutList (woodworking), Skimp (import), Enscape, V-Ray and Twinmotion (rendering), PlusSpec and Medeek (framing and BIM). | Proof that the plugin ecosystem is a big part of why people stay. It also shows what the base app lacks: cut lists, framing, cleanup, curved surfaces and rendering. |
| **Shapr3D** | Parasolid-based direct modeler for iPad, Mac and Windows. Sketch-then-extrude workflow, excellent touch and pencil input, history-free editing. | Making direct modeling feel calm and precise on touch. Its drawings and visualization features are a model for later work. |
| **Plasticity** | NURBS direct modeler aimed at concept artists. Very fast fillets and booleans, keyboard-driven. | Snappy feedback and a clean command set. Curved solids are a Later or Full app concern for us. |
| **Snaptrude** | Browser BIM. Sketch-style modeling that produces real walls, slabs and rooms, with Revit round-trip and real-time collaboration. | Proof that a browser modeler can carry building data and multi-user editing. |
| **Autodesk Forma** | Cloud early-stage site and massing tool with environmental analysis (sun, wind, noise, daylight). | Site context and analysis as Full app ideas. Not a modeling-feel reference. |
| **Bonsai** (formerly BlenderBIM) | IFC-native BIM inside Blender, built on IfcOpenShell. | IFC as the native data model for building objects. IfcOpenShell is the obvious library for IFC import and export. |
| **Chief Architect / Home Designer** | Residential design that is object-first (walls, roofs, framing, cabinets), with automatic plans, elevations and material lists. | What "building objects" mean to homeowners and small builders: auto roofs, framing, stairs, cost lists. |
| **FreeCAD** (Arch/BIM workbench) | Open-source parametric CAD on OpenCASCADE, with IFC support. | What not to copy in the UX, and what to borrow (OpenCASCADE, IfcOpenShell) when we need exact solids and IFC. |
| **Revit / Archicad** | Industry BIM. Parametric families, schedules and documentation, with heavy workflows. | The data model end state (types, instances, parameters, schedules), at a much lighter weight. |

## What makes SketchUp feel easy

Users don't praise SketchUp for its feature count. They praise a small number of behaviors that remove decisions. Our Core must reproduce these, because without them the app will feel like other CAD tools no matter how many features it has.

1. **Edges make faces.** When edges close a flat loop, a face appears. You never ask for a face. Drawing four lines on the ground gives you a floor.
2. **Edges split faces.** A line drawn across a face cuts it in two, and a rectangle drawn on a face becomes its own face with a hole in the original. The face you just made is immediately something you can push or pull. This is how you put a door on a wall.
3. **Sticky geometry.** Geometry that touches is joined: shared vertices and edges, no "merge" step. Move one face of a box and the box stretches. The flip side is that geometry sticks when you don't want it to, which is what groups are for.
4. **Groups and components are the way to stop sticking.** Wrap geometry in a group and it stops merging with everything around it. Double-click to edit inside it. Components add "edit one, change all." That gives you one simple rule, where other modelers ask you to manage bodies, parts and layers.
5. **Push/pull on any flat face.** One tool covers extrude, cut, offset-a-wall and through-hole. Push a face fully through a solid and it leaves an opening. Double-click repeats the last distance.
6. **The inference engine.** The cursor snaps to endpoints, midpoints, edges, faces and the red, green and blue axes. Colored markers and tooltips tell you what it found. Hovering a point and then moving away gives dotted "from point" alignment. You rarely need a grid.
7. **Inference locks.** Arrow keys lock to an axis (Right is red/X, Left is green/Y, Up is blue/Z, Down is parallel or perpendicular to the last edge). Holding Shift locks whatever is currently inferred, so you can reach another point to take its height.
8. **The Measurements box (VCB).** Type a number at any time without clicking into anything, then press Enter. It understands `8'6"`, `30 1/2"`, `2.4m` and `10',8'`. You can retype right after an operation and the last rectangle or push/pull is corrected, with no undo.
9. **Tools that tell you what to do.** The status bar hint changes with each step of a tool. The cursor icon shows the tool. The model never hides what will happen.
10. **Forgiving undo.** Every model change can be undone in order, and a live tool can be cancelled with Esc at any step. Undo is cheap, so experimenting is cheap.
11. **Few modes.** Select, draw, modify and navigate are each one key away (Space, L, R, P, M, O, H, E). Middle-drag orbits from any tool without leaving it.

## Features by group

### Drawing

| Feature | Tier | Notes |
| --- | --- | --- |
| Line (chained, closing loops makes faces) | Core | Built now. |
| Rectangle on ground or on any face | Core | Built now, with the "square" hint. The "golden section" hint is next. |
| Rotated rectangle (three-point) | Core | |
| Circle and polygon (segmented, with segment count in the VCB) | Core | Stored as an edge "curve" so it selects as one item. |
| Arc (two-point, three-point, pie) | Core | Same curve object. |
| Freehand | Later | |
| Offset (faces and edge chains) | Core | Key for wall thickness, trim and frames. |
| Text, 3D text | Later | |

### Modifying

| Feature | Tier | Notes |
| --- | --- | --- |
| Push/Pull on any planar face (stretch, extrude, cut through) | Core | Built now. Ctrl to always create new faces is Later. |
| Move and copy (Ctrl), with arrays (`5x`, `/5` in the VCB) | Core | Built now: Move welds what it moves to what it lands on and folds a face that would bend; with Ctrl (Option on Mac) held it copies instead, and `5x` or `/5` typed after a copy makes a linear array as one undo step. Copies of groups are independent groups until components (3.1). |
| Rotate with protractor, copy-rotate arrays | Core | |
| Scale (uniform and per axis, typed factors) | Core | |
| Follow Me (sweep a face along a path) | Core | Gutters, trim, handrails. |
| Erase (with hide and soften modifiers) | Core | Erase built now. Erasing the edge between coplanar faces merges them. |
| Intersect Faces (with model, with selection, with context) | Core | Built now: with model and with selection, from the toolbar, writing the edges into the open context (a group's faces are read, not cut; repeat inside the group). With context is Later. A line that pierces a face gets a vertex on it, so edges drawn through the piercing points cut the face. |
| Flip, reverse faces, orient faces | Core | |
| Soften/smooth edges | Later | |
| Solid tools (union, subtract, intersect, trim, split, outer shell) | Later | Use a manifold boolean library on closed groups. |
| Sandbox (terrain from contours, smoove, drape) | Later | |
| Round corners, chamfers, curved surfaces (Fredo6-style) | Full app | Needs a different kernel for exact curves, or very good polygon tools. |

### Measuring and construction

| Feature | Tier | Notes |
| --- | --- | --- |
| Inference engine (point, linear and from-point inferences) | Core | Built now: endpoint, midpoint, on edge, on face, origin, axes from the anchor. Parallel, perpendicular and from-point come next. |
| Inference locks (arrow keys, Shift) | Core | Built now. |
| Measurements box with imperial and metric parsing and retyping | Core | Built now. |
| Tape Measure and guide lines and points | Core | |
| Protractor and angled guides | Core | |
| Model units, precision and snapping settings | Core | |
| Dimensions and text labels in 3D | Later | |
| Area and volume readouts (Entity Info) | Core | Area is easy now that faces are real. |
| Axes tool (move or rotate the drawing axes) | Later | |

### Organizing

| Feature | Tier | Notes |
| --- | --- | --- |
| Groups (make, open for editing, close, explode) | Core | Built now: make, enter, exit, explode. |
| Components (definitions with many instances, edit one changes all, make unique) | Core | The data model supports it now. UI next. |
| Tags/layers (visibility, color by tag) | Core | Visibility and lock are in the kernel and file format, enforced by the kernel (`Error::Locked`). The survey panel's tag strip is the only UI; the full tag panel is Milestone 3. |
| Outliner (tree of groups and components) | Core | |
| Entity Info panel | Core | The survey panel shows the selection's attributes read-only; Entity Info proper is Milestone 3. |
| Hide, unhide, isolate | Core | |
| Components library and 3D Warehouse equivalent | Later | An open library of doors, windows and lumber is a good community project. |
| Dynamic or parametric components (attributes and formulas) | Later | A small expression language over component attributes. |
| Live components (configurable, like SketchUp's newer ones) | Full app | |

### Appearance

| Feature | Tier | Notes |
| --- | --- | --- |
| Materials (color, texture, opacity) and Paint Bucket | Core | Colour and opacity render now (face material, else instance material, else theme). No Paint Bucket yet. |
| Texture positioning on faces | Later | |
| Styles (edge display, face style, x-ray, back edges, sketchy edges) | Later | X-ray and hidden-line are Core-lite because they help modeling. |
| Shadows with geolocation and time of day | Later | |
| Fog, watermarks, environment and sky | Later | |
| Photoreal rendering (path tracing) | Full app | Perhaps a WebGPU path tracer, or export to Blender. |

### Viewing and navigation

| Feature | Tier | Notes |
| --- | --- | --- |
| Orbit, pan, zoom to cursor, zoom extents | Core | Built now. |
| Standard views (top, front, iso), perspective and parallel projection | Core | |
| Scenes (saved cameras plus visibility) and animation | Later | |
| Section planes and section fills | Later | Important for interiors and drawings. |
| Walk, look around, position camera | Later | |
| VR and AR viewing | Full app | |

### Files and data exchange

| Feature | Tier | Notes |
| --- | --- | --- |
| Native open file format with save and open | Core | Built now. See `docs/file-format.md`. |
| Autosave and recovery | Core | Built now. IndexedDB ring of the last 10 versions, written 3 s after each change; restore prompt on start and a Versions dialog. |
| Export glTF/GLB, OBJ, STL | Core | glTF for web and AR, STL for 3D printing, OBJ for everything. |
| Import OBJ, STL, glTF | Core | As triangle meshes, merged into planar faces where coplanar. |
| DXF/DWG 2D import (site plans, floor plans) and export | Later | DXF first. DWG needs the ODA SDK or LibreDWG. |
| Images as reference (Match Photo is Later) | Later | |
| `.skp` import | Later (optional) | Only possible through Trimble's closed SDK, which has license limits. Treat as optional. |
| IFC import/export | Full app | Through IfcOpenShell, with our BIM objects mapping to IFC classes. |
| Geolocation and terrain import | Later | |

### Drawings (LayOut equivalent)

| Feature | Tier | Notes |
| --- | --- | --- |
| Print or export the current view to PDF/PNG at scale | Later | |
| Sheets with live model viewports, dimensions, labels, title blocks | Later | |
| Hidden-line vector output (true vector PDF/SVG/DXF) | Later | Needs a hidden-line-removal pass in the kernel. |
| Automatic plans, sections and elevations from BIM objects | Full app | |

### Survey mode

| Feature | Tier | Notes |
| --- | --- | --- |
| Open a `.builder` written by `survey build` (one group per element, Existing / Demo / Proposed tags, `survey:*` attributes) | Core | Built now. A file with those three tags is a survey model. |
| Existing and Demo locked: no move, push/pull, erase, explode, group or drawing into them | Core | Built now, enforced by the kernel; the message names the tag (`Locked: Existing`). Locked geometry still snaps and selects. |
| Tag strip: show/hide and lock/unlock each tag, journaled | Core | Built now, minimal. Replaced by Milestone 3's tag panel. |
| Read-only attribute view for the selection, `~` elements marked | Core | Built now: `survey:approx` is shown in orange; placeholder elements render in the placeholder material. |
| New groups land on Proposed | Core | Built now (`Make group` at the root of a survey model). |
| Export Proposed boxes to a survey plan file (`model/plans/NAME.yaml`) | Core | Built now: axis-aligned box groups only; everything else is listed in the message and left out. |

### Building data (BIM)

| Feature | Tier | Notes |
| --- | --- | --- |
| Classify groups and components (wall, door, slab, joist) | Later | Cheap way into BIM: attributes on existing objects. Maps to IFC classes. The attribute slot is built: namespaced scalar attributes on definitions, instances and faces, journaled and saved (`docs/file-format.md`). |
| Cut lists and board-foot takeoffs from grouped parts | Later | A big win for furniture and deck builders (OpenCutList shows demand). |
| Parametric walls, doors, windows, roofs, stairs, slabs | Full app | Built as kernel plugins that generate geometry inside components. |
| Framing generators (studs, joists, rafters) | Full app | |
| Schedules, material takeoffs and cost estimates | Full app | |
| Levels, grids, rooms and areas | Full app | |
| IFC as the exchange model | Full app | |

### Platform

| Feature | Tier | Notes |
| --- | --- | --- |
| Undo/redo of every model change | Core | Built now as kernel transactions. |
| Runs in the browser with no install | Core | Built now. GitHub Pages deploy of `dist/` from `main`: https://pjsulin.github.io/builder/ |
| Works offline (installable PWA) | Core | Built now. A service worker precaches every built file (`app/sw.js`, filled in by the build); no manifest yet, so not installable. |
| Touch and pencil input | Later | Shapr3D shows how. |
| Desktop app | Later | Tauri around the same web UI with the kernel built natively. |
| Extension/plugin API | Later | Designed now, opened up after Core. See the architecture doc. |
| Extension store | Full app | |
| Real-time collaboration and comments | Full app | The transaction log is the starting point. |
| Version history and branching of models | Full app | |
| Command palette and search for tools | Core | Cheap, and it helps new users. |
| Customizable shortcuts | Core | |

## Core, in one list

For the first useful version: Line, Rectangle (incl. rotated), Circle, Polygon, Arc, Offset, Push/Pull, Move/Copy/Array, Rotate, Scale, Follow Me, Erase, Intersect Faces, Tape Measure with guides, Protractor, the inference engine with locks, the Measurements box, groups, components, tags, materials with Paint Bucket, Entity Info, Outliner, hide/isolate, orbit/pan/zoom, standard views, undo/redo, native save/open with autosave, glTF/OBJ/STL import and export, offline browser app, command palette.

This branch builds the foundation of that list: the kernel with auto faces and face splitting, Line, Rectangle, Push/Pull, Select, Move, Erase, undo/redo, groups, save/open, the inference engine and the Measurements box.
