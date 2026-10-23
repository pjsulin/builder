# Handoff

This document carries the project from the first conversation into ongoing work in this repo. Read it before planning.

## Why this exists

SketchUp is still the fastest way to sketch a building in 3D, but its owner (Trimble) has moved it to pricey annual subscriptions, cut the free desktop version, and frustrated a lot of users. The alternatives each miss something:

- Blender and FreeCAD are free but hard to learn and don't feel like SketchUp.
- Shapr3D and Plasticity are pleasant but aimed at product design, not buildings.
- Revit, Archicad and Snaptrude do real building data (BIM) but are heavier, pricey, or both.
- Bonsai (open-source BIM inside Blender) is capable but inherits Blender's learning curve.

The gap: nobody ships an easy, SketchUp-feeling modeler with an open file format and a fair business model, that can grow into building data later.

## What the prototype proved

`prototype/index.html` is a small Three.js demo. It shows that a browser modeler can feel responsive for the core loop: draw a rectangle, push-pull it, snap to corners, type exact sizes. The user's verdict was that it "feels very good to use."

Its limits are deliberate shortcuts, not a foundation to build on:

- **Geometry is a list of axis-aligned boxes and rectangles.** There are no real edges or faces, no arbitrary shapes, no face splitting, no merging. Push/pull only works on axis-aligned faces.
- **Every shape is its own Three.js mesh.** Draw time grows with object count; the 2,000-box stress test shows it.
- **One file, no build, no tests.**

Keep the prototype in `prototype/` as a reference for the feel (inference markers, typed dimensions, VCB retyping, hint text). Don't extend it.

## Next steps, in order

### 1. Feature list

Write `docs/features.md`. Survey SketchUp (Make/Free/Pro, LayOut, popular extensions) and other building tools (Shapr3D, Plasticity, Snaptrude, Forma, Bonsai, Chief Architect, FreeCAD Arch/BIM). Group the features and tag each one with a tier:

- **Core**: needed for the first useful version (e.g. line, rectangle, circle, arc, push/pull, move, rotate, scale, offset, follow-me, tape measure and guides, inference engine, groups and components, layers/tags, materials, undo, save/open, import/export).
- **Later**: valuable once the core is solid (e.g. scenes, sections, dimensions and text, 2D drawing output, solid tools, extension/plugin API, components library).
- **Full app**: the long-range vision (e.g. BIM objects such as walls, doors and windows; IFC import/export; schedules and material takeoffs; collaboration; rendering).

Note which SketchUp behaviors make it feel easy, since those matter more than feature count: sticky geometry, auto face creation when edges close a loop, edges splitting faces, the inference engine and its locks (arrow keys, Shift), the Measurements box, and groups/components as the way to stop geometry sticking.

### 2. Architecture

Write `docs/architecture.md`. Design a basic first version that won't need to be thrown away when the full app arrives. Questions to settle:

- **Geometry kernel.** SketchUp-style geometry is a half-edge (or similar) boundary-representation mesh of planar faces with holes, plus edges that may exist without faces. Decide whether to write this ourselves (likely, since sticky geometry is the core behavior) and what to borrow for later solid and curved work (OpenCASCADE, Manifold, or similar). Plan for floating-point tolerance and robustness from the start.
- **Language and targets.** The recommendation from the first conversation: write the kernel in a compiled language (Rust or C++) that builds to WebAssembly for the browser and natively for a desktop app later. The UI and rendering can start on the web (TypeScript + Three.js or WebGPU). Weigh this against starting in TypeScript only and porting the kernel later.
- **Document model.** Entities, groups, component definitions and instances, tags, materials. Undo/redo as transactions on the document.
- **File format.** An open, documented native format. Plan for import/export of glTF, OBJ, STL and DXF early, and IFC later. `.skp` can only be read through Trimble's closed SDK, so treat it as optional.
- **Rendering.** Batch geometry instead of one mesh per object. Separate picking (what's under the cursor) from drawing.
- **Tools and inference.** A tool framework where each tool is a state machine, sharing one inference engine and one Measurements box.
- **Extensibility.** Leave room for a plugin API, since extensions are a big part of why people stay on SketchUp.
- **License.** Choose one deliberately (e.g. MPL-2.0 or GPL for the app, a permissive license for the file format spec).

### 3. Build

Set up the project (TypeScript, Vite, a test runner, and the kernel toolchain if using Rust/C++). Then build in this order, with tests for the geometry at every step:

1. Kernel: vertices, edges, faces with holes; draw a line; auto face creation from a closed loop; an edge drawn across a face splits it.
2. Viewport with batched rendering, orbit/pan/zoom, picking.
3. Inference engine and the Measurements box.
4. Line, Rectangle and Push/Pull on any planar face, not just axis-aligned ones.
5. Select, Move, Erase, undo/redo.
6. Groups.
7. Save/open in the native format.

Match or beat the prototype's feel at each step before moving on.

## Conventions

- Units: store lengths in inches internally (as the prototype does) or in a clearly documented unit; display in feet/inches or metric by preference.
- Z is up.
- Keep functions small and the geometry core free of rendering code so it can move to WebAssembly or native later.
