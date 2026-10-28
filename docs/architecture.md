# Architecture

This document describes the first version of Builder and how it grows into the full app. Each section states the decision, the reasons, and what would change it.

```
┌────────────────────────── browser ───────────────────────────┐
│  app/ (TypeScript)                                           │
│   ui/        toolbar, hints, Measurements box, panels        │
│   tools/     Line, Rectangle, Push/Pull, Select, Move, ...   │
│   inference/ snapping engine + locks (pure TS, tested)       │
│   view/      camera, batched Three.js renderer, picking      │
│   kernel/    thin typed wrapper over the WebAssembly module  │
│        │  typed arrays (positions, ids) ▲  ids, commands ▼   │
│  kernel-wasm/ (Rust → wasm32, wasm-bindgen)                  │
│        │                                                     │
│  kernel/ (pure Rust: no rendering, no JS, no I/O)            │
│   model     vertices, edges, faces with holes, definitions,  │
│             instances, materials, tags                       │
│   store     journaled arenas → transactions, undo/redo       │
│   ops       add_line, heal (auto faces, splitting), push/pull│
│             move, erase, make group, explode                 │
│   mesh      triangulation + render/pick buffers              │
│   format    .builder JSON reader/writer                      │
└──────────────────────────────────────────────────────────────┘
```

## 1. Language and targets

**Decision:** The geometry kernel is Rust, compiled to WebAssembly for the browser and natively for tests, a future desktop app and server-side tools. The UI is TypeScript, built with Vite, rendering with Three.js.

Why Rust rather than TypeScript-first:

- The kernel is the part we least want to rewrite. A TypeScript kernel would be fast to start but would need porting the day we want a native desktop build, a headless converter or heavy boolean work. Porting a geometry kernel means re-finding all of its tolerance bugs.
- Rust gives us `f64` math with predictable performance in WebAssembly, no garbage collection pauses during drags, and a test runner (`cargo test`) that runs the geometry tests in milliseconds, with no browser.
- Rust over C++: memory safety in code that handles untrusted files, Cargo for builds and dependencies, and good WebAssembly tooling (`wasm-bindgen`). C++ libraries we want later (OpenCASCADE, Manifold) can still be linked in. Manifold already ships WebAssembly builds.
- The costs: a second toolchain, and a boundary between JS and the kernel. We keep the boundary narrow (commands in, ids and typed arrays out) so crossing it stays cheap.

What would change this: if the WebAssembly boundary turns out to dominate frame time during drags. The mitigation is to move more of the drag loop (inference queries) into the kernel, not to move the kernel into JS.

**Crate layout.** `kernel/` is pure Rust with only `serde`, `serde_json` and `earcutr` as dependencies. It knows nothing about rendering or JavaScript, so it can be built for any target. `kernel-wasm/` is a thin `wasm-bindgen` wrapper that converts between kernel types and flat arrays. A desktop build later would wrap the same kernel with Tauri, and a CLI converter would link it directly.

**Units and axes.** Lengths are `f64` inches internally, as in the prototype. Z is up. Display units (feet and inches, or metric) are a UI concern.

## 2. Geometry kernel

### Representation

SketchUp geometry is not a solid. It is a set of vertices, edges and planar faces where:

- edges can exist without faces (a single line),
- an edge can border any number of faces (a T-junction where a wall meets a floor has three),
- faces are planar polygons that can have holes,
- faces are one-sided in meaning (front and back) but drawn two-sided.

A classic half-edge structure assumes each edge has exactly two faces (a 2-manifold). That fails for loose edges and T-junctions, which SketchUp users create constantly. So the kernel uses an incidence model closer to a radial-edge structure, simplified:

```
Vertex { pos: [f64; 3], edges: [EdgeId], owner: DefId }
Edge   { v: [VertexId; 2], faces: [FaceId], owner: DefId }
Face   { outer: [VertexId], holes: [[VertexId]], normal, d,
         material, back_material, tris (cached triangulation), owner: DefId }
```

Each face loop is a cycle of vertex ids. The edges of a loop are found by vertex pair. Each edge lists the faces that use it, and each vertex lists its edges. That gives the same adjacency queries a half-edge structure would, without restricting topology. Outer loops run counter-clockwise when viewed from the front of the face (looking against `normal`), and holes run clockwise.

Faces cache their triangulation (computed with `earcutr`, a port of Mapbox's earcut, in the face's own 2D basis). The cache lives in the face record, so undo restores it with the face and render buffers can be rebuilt without re-triangulating anything.

Every entity carries an `owner`, which is the definition (the model root, a group or a component) it belongs to. All kernel operations take a context definition and only see entities in it. That is the whole mechanism behind "groups stop geometry sticking."

### Sticky geometry: the operations

All editing goes through a few operations, and each one keeps the topology valid.

**`add_line(ctx, a, b)`**

1. Weld `a` and `b` to existing vertices within tolerance.
2. Find every place the segment touches existing geometry in `ctx`: vertices lying on it, edges it crosses (coplanar crossing), and edges it overlaps (collinear). Split those edges at the touch points. Splitting an edge updates every face loop that uses it, so faces stay closed.
3. Cut the segment at all touch points and create the missing pieces as edges, reusing edges that already exist. Drawing over an existing edge is a no-op for topology, but it still counts as "touched," which is how redrawing one edge heals a deleted face.
4. **Heal** every plane the new edges lie in.

**`heal(ctx, plane, seeds, old_regions)`** is the single routine behind auto face creation, face splitting, holes, and merging. It works on one plane at a time:

1. Collect the in-plane edge graph: every edge in the plane connected to a seed edge, plus the boundaries of existing faces in the plane whose bounding box overlaps it.
2. Faces in the plane that contain a seed edge in their interior are *affected*. They are removed, and their regions become `old_regions`, with their material and orientation.
3. Project the graph to 2D and compute the planar arrangement: for each directed edge, the next edge is the most clockwise turn at its end vertex. That walk yields every bounded region (counter-clockwise cycles) and the outer boundary of each connected piece (clockwise cycles).
4. Strip spikes and bridges. Edges walked in both directions within one cycle (a dangling line inside a face, or a line joining an inner loop to an outer loop) are not face boundaries. Removing them can split a cycle into an outer loop plus holes.
5. Nest unconnected pieces: a clockwise outer boundary lying inside a region becomes a hole of that region.
6. Create a face for each region that either (a) uses a seed edge and is not already covered by an existing face, or (b) lies inside an old region, inheriting its material and orientation.

This gives the SketchUp behaviors directly:

| User does | `heal` sees | Result |
| --- | --- | --- |
| Closes a loop of lines | A new region whose boundary uses a seed edge | New face |
| Draws a line across a face | The face is affected; two regions inside its old region | Two faces, same material |
| Draws a rectangle inside a face | The face is affected; the rectangle region plus the old region with a hole | Inner face, outer face with hole |
| Erases the edge between two coplanar faces | No seeds; both faces are old regions; the walk finds one region | Merged face |
| Redraws an edge of a deleted face | A region using a seed edge, not covered | Face restored |
| Leaves a dangling line on a face | A spike | The face is unchanged; the line stays a loose edge |

**`push_pull(ctx, face, distance)`** has two modes, chosen per face:

- *Stretch*: every edge of the face is shared with faces that contain the push direction (for example, the top of a box, whose sides are vertical). The face's vertices move along the normal. Every face that shares a vertex stays planar.
- *Extrude*: anything else (a free face, a face drawn on another face). A cap face is created at the offset, with a side face for every edge of every loop, holes included. A free-standing face stays as the bottom, facing away. A face inset in a larger face is consumed, so the walls join the surrounding face's hole.

After either mode, the new or moved geometry is **settled** into what it touches:

1. Its edges are merged with existing edges they overlap, and faces whose loops now touch themselves are re-healed into separate pieces.
2. A new face that lands on an opposite-facing coplanar face cancels against it. The other face is cut along the outline and both overlapping pieces are removed. Pushing a door outline through a wall leaves an opening, including the notch where the door meets the floor.
3. A new face that lands beside a coplanar face facing the same way merges with it, so pulling a shape flush with a wall doesn't leave a seam.

This works on any planar face. The prototype only handled axis-aligned ones.

**`intersect_faces(ctx, faces, instances, with)`** draws the edges where faces cross each other, so a roof plane through a wall or a beam through a post can then be pushed and erased like anything drawn by hand:

1. Candidate faces are the faces of `ctx` and, placed through their composed transforms into `ctx` coordinates, every face inside the instances of `ctx` (with *Model*) or inside the selected instances (with *Selection*). A pair is tried when at least one of its faces is selected, their bounding boxes overlap and their planes are not parallel within `INTERSECT_SIN`.
2. The pair's plane–plane line is cut where it meets each face's loop edges; each piece is kept when its midpoint lies inside both faces. A piece that runs along both faces' boundaries (two faces of a box sharing an edge) is not a cut; one along a face's edge but inside the other face is, so a wall standing on a slab cuts the slab.
3. Every cut is drawn into `ctx` with `insert_segment` and the planes the new edges lie in are healed, which splits the faces of `ctx` they cross. Only `ctx`'s definition is written: an instance's faces are read and never changed, and the other side of the cut is made by repeating the command inside that group (SketchUp's rule). Edges whose cut lies only in instance faces stay as loose edges in `ctx`.

**`move_vertices`**, **`move_and_integrate`**, **`erase`**, **`make_group`** and **`explode`** follow the same pattern: change the raw records, then re-validate.

- Move has a preview and a committed form. `move_vertices` (every pointer move) only displaces vertices and re-derives the faces that stay planar; a face the move would bend is left as it was, so the drag still shows, and a face that would collapse or turn inside out fails the move. `move_and_integrate` (the commit) first runs `fold_for_move`, which replaces each face that would bend with planar pieces along diagonals chosen so the hinge runs between the moved vertex's neighbours and one piece stays in the old plane (materials and attributes are kept, and a face with holes that would bend is refused); then moves the vertices; then `integrate_moved`: a moved vertex that lands on another vertex merges into it, the moved edges are re-inserted as segments so they split and are split by edges they cross or overlap, every plane they lie in is healed, and `settle_faces`, the settle steps shared with push/pull, cancels a face that landed on an opposite face and merges coplanar neighbours. The result is as if the geometry had been drawn there. Moving a group instance (`set_transform`) never welds. Fold diagonals are ordinary edges; a soft-edge flag waits for styles.
- Erase removes the faces bounded by an erased edge, heals the plane to merge coplanar neighbors, and dissolves vertices left between two collinear edges.
- Make group copies the selected faces and edges into a new definition, adds an instance with an identity transform, and removes the originals. Edges still used by faces left outside stay, so the remaining geometry keeps its boundary.
- Explode copies the definition's geometry back through the instance transform, welding to touching vertices, so the geometry sticks again.

### Tolerance and robustness

Floating-point tolerance is part of the design from the start rather than patched in later:

- One tolerance policy in `kernel/src/tol.rs`: `LENGTH = 1e-3` inches for welding points and point-on-line tests (SketchUp uses a thousandth of an inch too), `PLANE = 1e-3` inches for point-on-plane, `ANGLE = 1e-9` (as `1 − |cos θ|`, about 0.003°) for parallel planes, `AREA = 1e-6` square inches for degenerate faces, and `INTERSECT_SIN = 1e-2` (the sine of the angle between two planes) below which Intersect Faces treats the planes as parallel and draws nothing: a `PLANE`-sized error in either plane moves their intersection line by up to `PLANE / INTERSECT_SIN`, so a smaller bound would put the line anywhere.
- Points are welded on creation, so two vertices are never closer than `LENGTH`. All later tests can then compare vertex ids instead of coordinates.
- Planes are stored as a normal and offset, recomputed with Newell's method from the loop so long thin faces stay stable.
- 2D arrangement work uses each face's own orthonormal basis, so precision does not depend on where the face sits in world space.
- Operations validate their result (planarity, non-degenerate loops) and fail cleanly with an error. The caller aborts the transaction, which restores the previous state exactly.

Later, when models get large or a user's file hits a hard case, we can add exact predicates (Shewchuk's orientation tests, available as the `robust` crate) to the 2D arrangement. The structure does not need to change for that.

### What we borrow later

| Need | Library | Notes |
| --- | --- | --- |
| Booleans on closed groups (solid tools) | **Manifold** (Apache-2.0, C++, has WebAssembly builds) | Convert a closed group to a triangle mesh, run the boolean, then merge coplanar triangles back into planar faces with `heal`. |
| Exact curved solids, fillets, STEP | **OpenCASCADE** (LGPL-2.1 with exception) or **truck** (Rust, Apache-2.0) | Full app. Curved objects would live in their own entity type next to the planar mesh, not replace it. |
| IFC | **IfcOpenShell** (LGPL-3.0) | Full app. Runs as a separate WebAssembly module or server-side. |
| Exact predicates | **robust** crate | When needed. |

The planar mesh stays our own code because sticky geometry is the core behavior, and none of these libraries model it.

## 3. Document model

```
Document
 ├─ definitions: Arena<Definition>    id 0 is the model root
 │    Definition { name, kind: Root | Group | Component, instances }
 ├─ instances:   Arena<Instance>
 │    Instance { definition, parent (owning definition), transform: [f64; 16],
 │               name, tag, material, attributes }
 ├─ vertices / edges / faces: Arena<…>  (each with an owner definition;
 │                            Face also carries attributes)
 ├─ materials:   Arena<Material { name, color, opacity }>
 └─ tags:        Arena<Tag { name, visible, locked }>
```

- A **group** is a definition with exactly one instance, like in SketchUp. A **component** is the same thing with many instances. Edit one, and every instance changes, because they all draw the same definition. Making a group unique, or a component from a group, only changes the definition kind.
- **Tags** control visibility on instances. **Materials** go on faces (front and back) and on instances (inherited by faces with no material). Both are in the kernel and the file format now. Their panels are next.
- Ids are indexes into arenas and are **never reused**. A deleted slot becomes a tombstone. That keeps ids stable across undo and redo, so the UI can hold a selection by id.
- **Attributes** are namespaced key–value maps (`Attributes = BTreeMap<namespace, BTreeMap<key, scalar>>`) on definitions, instances and faces. `set_attribute(target, ns, key, value)` is a journaled write like any other, so attributes undo, redo and save with the geometry (`docs/file-format.md` § Attributes). A split face gives each half its attributes, push/pull copies them onto the faces it creates, and faces with different attributes do not weld. The survey toolkit is the first user (`survey:*` provenance). Building data (BIM) will use the same slot: a `classification` namespace with an IFC class such as `IfcWallStandardCase`, and plugin namespaces for parametric objects whose geometry a plugin generates from their parameters.
- **Tag lock** is enforced by the kernel, not the UI: `Tag.locked` makes every edit entry point (`add_line`, `push_pull`, `move_vertices`, `move_and_integrate`, `erase`, `erase_instance`, `make_group`, `explode`, `set_transform`) return `Error::Locked` when it would touch an instance on that tag, the geometry in its definition, or a group that contains one. `is_locked_def` answers the question for a definition; tools use it to skip locked geometry as an edit target while still snapping to it.

### Transactions and undo

Every arena write goes through one journal. A write records `(arena, slot, before, after)`. A transaction is the list of writes between `begin(name)` and `commit()`.

- **Undo** restores the `before` values in reverse order. **Redo** applies the `after` values in order.
- **Abort** undoes an uncommitted transaction. Tools use this for live previews. Each mouse move during push/pull aborts the previous preview and applies a new one, so dragging never piles up history and never rebuilds geometry from scratch.
- Because derived data (adjacency lists, cached triangulation) lives inside the records, undo can never leave an index out of sync.
- The journal is also the natural feed for autosave deltas, and later for collaboration (send transactions to peers, rebase on conflict) and version history.

Memory cost is proportional to what changed, not to model size, unlike the prototype's full JSON snapshots.

### Storage

Autosave keeps the open model in the browser, in one IndexedDB database named `builder` (`app/src/store/autosave.ts`). A `versions` store holds a ring of autosaved versions keyed by an auto-increment id, each with the time, the file name, the name of the last operation and the whole `Model.toJson()` string; a `meta` store holds one `dirty` flag, true when a version was written after the last Save or load, which is what the restore prompt on start checks.

The ring keeps at most 10 versions and 50 MB: after each write the oldest is dropped until both hold, and the version just written is never dropped. The stress model's JSON is 1,014,815 bytes, so 50 MB holds about 50 stress saves and the count limit binds first for anything; 10 versions is enough to step back past a bad edit without the dialog becoming a history browser. A version is the whole JSON, not journal deltas: `toJson()` is already the file format, restoring one is `Model.fromJson`, and the journal stays free to change shape.

Writes hang off the model's commit points, not its `revision` counter: `Model.onCommit` fires from `commit()`, `undo()` and `redo()` (labeled `Undo <name>` / `Redo <name>`), never from `abort()`, and `changed()` bumps `revision` on every preview step, so a drag that aborts and re-applies its preview per pointer move schedules nothing. The `Autosaver` (`app/src/store/autosaver.ts`) restarts a 3 s debounce on each commit; its timer callback is the only place `toJson()` runs (12 ms warm, 30 ms cold on the stress model), and the store write is awaited outside the render loop. Save and loading a file clear the dirty flag and cancel a pending write.

The hosted build works offline through a hand-written service worker, `app/sw.js`. An inline Vite plugin (`precachePlugin` in `vite.config.ts`) copies it into `dist/` at build time with `__PRECACHE__` replaced by the list of every built file and `__CACHE_VERSION__` by a hash of their contents, so the worker is deterministic and each build is its own cache. Install precaches the list, activate drops older `builder-*` caches, and fetch serves same-origin GETs cache-first with navigations mapped to `index.html`. `main.ts` registers it only in production builds, so `vite` dev and the Node tests never see one. The Google Fonts stylesheet is cross-origin and not cached; offline, the fonts fall back to system fonts.

## 4. File format

**Decision:** an open, documented JSON format, `.builder`, written and read by the kernel. The spec lives in `docs/file-format.md`.

```json
{
  "format": "builder",
  "version": 1,
  "units": "inch",
  "definitions": [{ "id": 0, "name": "Model", "kind": "root" }],
  "vertices": [[0, 0, 0], [120, 0, 0]],
  "edges":    [{ "v": [0, 1], "owner": 0 }],
  "faces":    [{ "outer": [0, 1, 2, 3], "holes": [], "owner": 0, "material": null }],
  "instances": [],
  "materials": [],
  "tags": []
}
```

- On write, ids are compacted (tombstones dropped) and vertices are written in full `f64` precision. On read, the kernel rebuilds adjacency and planes, and validates everything. A bad file fails with a message instead of producing broken topology.
- Version 1 is plain JSON because it is easy to inspect, diff and write tools for. Version 2 will be a zip container (like glTF's GLB or 3MF) holding the same JSON plus binary vertex buffers and texture images, once files get big. Readers must refuse versions newer than they understand.
- **Interchange.** Export glTF/GLB, OBJ and STL from the triangulated buffers the renderer already uses (Core). Import OBJ, STL and glTF as triangles, merging coplanar triangles with `heal` (Core). DXF is next (Later), then IFC through IfcOpenShell (Full app). `.skp` import needs Trimble's closed SDK and its license terms, so it is optional and would ship as a separate plugin if at all.

## 5. Rendering and picking

**Batched drawing.** The kernel turns each definition into one set of flat buffers: triangle positions, normals and per-triangle face ids, plus edge segments with edge ids. The renderer (`app/src/view/viewport.ts`) uploads one geometry per definition, not per object, and draws each placement of it with three draw calls: front faces, back faces (in SketchUp's blue-gray) and edges. Loose geometry in the root, even 2,000 boxes, is those three draw calls. Instances of a definition share its geometry, each with its own matrix. When there are many instances of the same definition we will switch to `InstancedMesh` or `BatchedMesh`.

Faces keep their triangulation cached, so building buffers is a memory copy, not re-triangulation. Today every definition's buffers are rebuilt after each change. On the 2,000-box stress model (12,000 faces) that takes about 10 ms, and a full push/pull preview step (kernel, buffers, inference) about 17 ms. Rebuilding only the definitions a transaction touched, and updating buffer ranges in place, are the next steps when models outgrow that.

**Picking is separate from drawing.** Picking runs on the CPU over the same buffers, flattened to world space (`app/src/view/scene.ts`). Face picks are an allocation-free ray–triangle scan, about 0.4 ms on the stress model. Edge and point inference scan a screen-space copy of every edge end, cached until the camera moves. A bounding-volume hierarchy per definition is the next step for bigger models. A pick returns `{item (placement), face or edge id, point}`. The item says whether it is editable geometry or an instance to select as a whole. Keeping picking out of the GPU makes it testable, independent of the draw style (x-ray, hidden faces), and usable by inference, which needs edges and vertices as well as faces. A GPU id-buffer can be added later as an accelerator.

**Overlays** (hover highlight, selection, previews, inference markers) are small separate meshes or DOM elements over the canvas, rebuilt only when they change.

**Later:** WebGPU when Three.js's WebGPU renderer is the default, shadows, section planes as clip planes plus cap fill, and hidden-line vector output computed by the kernel for drawings.

## 6. Tools, inference and the Measurements box

**Tools are state machines.** Each tool implements one interface:

```ts
interface Tool {
  id: string;
  hint(): string;                          // status bar text for the current step
  vcbLabel(): string;                      // "Length", "Distance", "Dimensions"
  busy(): boolean;                         // an operation is in progress
  deactivate(): void;                      // must cancel and abort any preview
  move(p: ToolPointer): void;
  down(p: ToolPointer): void;
  up(p: ToolPointer, dragged: boolean): void; // click-move-click and drag both work
  doubleClick?(p: ToolPointer): void;
  key?(key: string, shift: boolean): boolean; // true if handled (Esc)
  vcb(text: string): void;                 // typed value, during or after the op
}
```

Tools never touch Three.js or the DOM. They get a `ToolHost` (`app/src/tools/tool.ts`) with the model, the active context, the camera model, the inference engine, the selection, and calls to show an overlay (plain data: segments, fill, dimension labels, the inference marker) and set the Measurements box. The tests drive every tool through a headless `ToolHost` against the real WebAssembly kernel. Live previews use `begin` / `abort`, and finishing uses `commit`. Every tool gets undo, cancel and preview behavior the same way.

**One inference engine** serves every tool. Given the cursor, the camera, an optional anchor point (the start of the current line) and an optional plane, it returns the best candidate by priority:

1. Point inferences: endpoint, midpoint, origin (later also intersection, center and guide point). Screen-space radius of 12 px. Points hidden behind faces are skipped.
2. Linear inferences from the anchor: along the red, green and blue axes. Next come parallel and perpendicular to a referenced edge, and "from point" alignment with the last hovered point.
3. On edge, on face.
4. The tool's working plane, or the ground.

Each result carries a kind, a color and a label (`Endpoint`, `On Blue Axis`, `On Face`), which the overlay shows like SketchUp's markers. **Locks:** Right/Left/Up arrows lock to the red/green/blue axis. Down clears the lock (in SketchUp it locks parallel/perpendicular, which comes with that inference). Shift locks the current axis, edge direction or face plane while held. With a lock, hovering any point projects it onto the locked line, which is how you match a height. The engine is pure TypeScript with no Three.js dependency, over a small "scene query" interface, so it is unit-tested without a browser.

**One Measurements box** is shared by all tools. It handles typing without focusing (any digit starts typing), parses `8'6"`, `8' 6"`, `30 1/2"`, `2.4m`, `600mm` and `w, d` pairs, and sends the value to the active tool. After an operation finishes, the tool keeps a "last op" handle, so retyping amends it. That is implemented as undo of the last transaction plus redo with the typed value, which keeps the kernel simple.

## 7. Extensibility

Extensions are a big part of why people stay on SketchUp, so the plugin API is designed in from the start, even though we open it after Core.

- **Commands, not internals.** Plugins use the same kernel wrapper the built-in tools use (`addLine`, `pushPull`, `makeGroup`, transactions), plus document queries. Built-in tools are written against the same API, which keeps it honest.
- **Tools** are registered through the same `Tool` interface, with access to the inference engine and the Measurements box.
- **Panels and menus** through a small UI registry.
- **Observers** (selection changed, transaction committed) so plugins like cut lists and Solid Inspector can react.
- **Attributes** on any definition, instance or face (namespaced key–value maps saved in the file; in the kernel and format now, § 3), which is how dynamic components, classification and plugin data persist.
- **Sandboxing.** Plugins are ES modules run in a Web Worker or an iframe with a message-passing API, so a broken plugin cannot freeze the modeler or read the user's files without permission. Performance-heavy plugins (framing generators, booleans) can ship their own WebAssembly.
- **Distribution.** A signed manifest (`builder-plugin.json` with name, version, permissions, entry point). A store or registry is Full app.

## 8. License

**Decision:** the application and kernel are licensed under the **Mozilla Public License 2.0** (MPL-2.0). The file-format specification is licensed under **CC BY 4.0**, and any reference reader/writer for the format that we publish separately will be **Apache-2.0**.

- MPL-2.0 is file-level copyleft. Anyone who changes Builder's own files must share those changes, so the modeler stays open. It does not extend to code that only links to it, so plugins, including commercial ones, can use any license. Hosted or paid editions can also be built on it, which keeps a fair business model possible (a hosted sync service, a components library, support).
- GPL-3.0 was the alternative. It protects the app harder, but it would scare off commercial plugin authors, and AGPL would make a hosted edition awkward. Apache-2.0 or MIT would let a vendor take the kernel closed, which repeats the problem Builder exists to solve.
- The format is deliberately more permissive than the app: anyone, including competitors, should be able to read and write `.builder` files. An open format is the real protection against lock-in.
- Dependencies must be compatible: MIT, Apache-2.0, BSD, ISC, Zlib, MPL-2.0, or LGPL used as a dynamically loaded module (IfcOpenShell, OpenCASCADE). Three.js is MIT and earcutr is ISC.

## 9. Build, test and run

- `npm run build:kernel` builds `kernel-wasm` for `wasm32-unknown-unknown` and runs `wasm-bindgen --target web` into `app/src/kernel/pkg/` (generated, not committed).
- `npm run dev` starts Vite. `npm run build` produces a static site.
- `cargo test` runs the kernel tests: lines, welding, splitting, auto faces, holes, face splitting, push/pull in both modes on tilted faces, openings, move, erase and merge, groups, undo/redo, and file round-trips. Every test checks the full set of topology invariants (`kernel/tests/common/mod.rs`), including that no vertex lies inside an edge it doesn't split. `cargo run --release --example bench` times the stress model.
- `npm test` runs Vitest: unit parsing and formatting, camera and ray math, inference priority and locks, picking, and tool tests that load the real WebAssembly kernel in Node and drive each tool with screen coordinates.
- `npm run check:precache` (`scripts/check-precache.mjs`) reads `dist/sw.js` after a build and fails if any built file is missing from its precache list or any listed file was not built: the headless stand-in for the offline check.
- CI (`.github/workflows/ci.yml`) runs `cargo fmt --check`, `cargo clippy`, `cargo test`, the WebAssembly build, `tsc --noEmit`, `npm test`, `vite build` and the precache check on every push. On a push to `main` a second job deploys `dist/` to GitHub Pages at https://pjsulin.github.io/builder/ (repository setting: Pages source = GitHub Actions).

## 10. Status and known limits

Built and tested: the kernel (lines, welding, splitting, auto faces, holes, face splitting and merging, push/pull in both modes on any planar face, openings, move, erase, groups, undo/redo, file format), the inference engine with locks, the Measurements box with retyping, and the Line, Rectangle, Push/Pull, Select, Move, Erase, Orbit and Pan tools, group editing, and save/open.

Known limits, roughly in the order we plan to address them:

- A line that pierces a face (rather than lying in it) does not cut it. That is Intersect Faces, a Core feature still to build.
- Moved vertices do not weld to geometry they land on. Push/pull does settle its results.
- Push/pull settling handles faces that land exactly on other faces. Partial overlaps with geometry the extrusion passes through are not intersected.
- A move that would bend a face is rejected rather than folding the face into triangles.
- Components (many instances), tags (with lock), materials and attributes exist in the kernel and file format; the UI for them is the survey panel's minimal tag strip and attribute view, pending Milestone 3's panels.
- Vertex and edge lookups are linear scans with bounding-box rejection. A spatial grid will replace them when models grow past the stress test.

## 11. Growing into the full app

| Step | What changes | What stays |
| --- | --- | --- |
| Components, tags, materials UI | UI panels; kernel already models them | Kernel |
| Rotate, scale, offset, follow-me, arcs, circles | New kernel ops and tools; curves become an edge attribute grouping segments | Tool framework, inference |
| Solid tools | Manifold behind a closed-group check | Planar mesh as the editable truth |
| Drawings | Hidden-line pass in the kernel, a sheet editor in the UI | Document model, file format v1 → v2 |
| Desktop | Tauri shell, native kernel build | All of the UI |
| BIM | Classification attributes, then plugin-generated parametric components, IFC via IfcOpenShell | Groups and components are the objects |
| Collaboration | Ship transactions over the network | Journal |
