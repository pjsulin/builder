# Builder

An open, approachable 3D modeler for building things: sheds, decks, furniture, rooms and small buildings. The goal is the speed and ease of SketchUp's push-pull workflow without the subscription lock-in, with room to grow into precise drawings and building data later.

## Status

Early prototype. `prototype/index.html` is a single-file browser demo built on Three.js. It has:

- Rectangle tool that draws on the ground plane or on any face
- Push/Pull that extrudes rectangles into boxes and moves box faces in or out
- Inference snapping to endpoints, midpoints and the origin, plus a "Square" lock while drawing
- Push/Pull height matching by hovering another shape's corner
- Measurements box that takes feet/inches (`10'`, `8' 6"`, `30 1/2"`), metric (`2.4m`, `600mm`), and `width, depth` for rectangles, including retyping after a tool finishes
- Select, Eraser, Orbit, Pan, zoom to cursor, zoom extents, undo/redo
- Light and dark themes
- A stress test that adds 2,000 boxes

Run it by opening `prototype/index.html` in a browser. It loads Three.js r128 and Google Fonts from CDNs, so it needs a network connection.

See [HANDOFF.md](HANDOFF.md) for where this is going and what to do next.
