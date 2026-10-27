# Builder

An open, approachable 3D modeler for building things: sheds, decks, furniture, rooms and small buildings. The goal is the speed and ease of SketchUp's push-pull workflow without the subscription lock-in, with room to grow into precise drawings and building data later.

## Status

Early, but the core loop works on real geometry:

- A Rust geometry kernel, compiled to WebAssembly, with **sticky geometry**. Lines weld and split each other, closed flat loops become faces, lines across faces split them, and shapes drawn inside faces become holes. Erasing a dividing edge merges faces.
- **Push/Pull on any flat face**, including tilted roofs. Faces stretch or extrude, and pushing a door outline through a wall leaves an opening.
- **Inference**: endpoints, midpoints, edges, faces and the red, green and blue axes. Arrow keys lock an axis, and Shift locks the current inference.
- **Measurements box**: just type `10'`, `8' 6"`, `30 1/2"`, `2.4m`, or `10', 8'` for rectangles. Retype right after an operation to change it.
- Tools: Select (click, Shift-toggle, window and crossing boxes), Line, Rectangle, Push/Pull, Move, Eraser, Orbit and Pan.
- **Groups**: make, double-click to edit inside, explode. Grouped geometry stops sticking to everything else.
- Undo/redo for every change, and save/open in the open `.builder` format.
- **Attributes and tags** in the kernel and format: namespaced key–value data on definitions, instances and faces; tags with visibility and a lock the kernel enforces; material colours in the viewport.
- **Survey mode**: a model written by `survey/` (below) opens with existing conditions locked, a tag strip, an attribute panel, and an export of what you draw back to a survey plan file.

`prototype/index.html` is the original single-file demo, kept as a reference for how the app should feel.

## Survey toolkit (`survey/`)

`survey/` is a Python package, `builder-survey`, that compiles measured facts (a YAML spec; nothing inferred) into a checked 3D model: a `.builder` file for this app, plus COLLADA, Sweet Home 3D, SketchUp Ruby, Blender renders, reports and 2D layout pages. It is the measured half of the tool; Builder is the drawn half, and survey mode is where they meet. A house project depends on it by path (`uv add --editable ../builder/survey`).

```sh
uv run --project survey survey build --project ../house        # writes ../house/model/out/<stem>.builder and the rest
cargo run -p builder-kernel --example validate -- ../house/model/out/<stem>.builder
make start                                                     # then File > Open the .builder in the app
uv run --project survey survey capture --project ../house --cert ... --key ...   # phone photo + voice note capture
uv run --project survey pytest survey/tests                    # its tests
```

See [survey/README.md](survey/README.md) and [survey/docs/](survey/docs/) (spec format, plans, the survey contract, render, exports, capture).

## Run it

You need Rust ([rustup.rs](https://rustup.rs)), Node 20 or newer, and `make`.

```sh
make install   # one-time: wasm32 target, wasm-bindgen-cli 0.2.129, npm packages
make start     # build the kernel and start the dev server in the background
make stop      # stop it
```

`make start` prints the URL (http://localhost:5173/ by default). The app opens with a sample shed: try pushing the door in with Push/Pull (P).

| Command | What it does |
| --- | --- |
| `make install` | One-time setup. Safe to re-run; skips what is already installed. |
| `make start` / `make stop` / `make restart` | Run the dev server in the background. Its pid and log are in `.run/`. |
| `make status` / `make logs` | Check whether it is running, or follow its log. |
| `make dev` | Run the dev server in the foreground (Ctrl+C stops it). |
| `make test` | Kernel tests, type-check, app tests (including tools driven against the real kernel), and the survey toolkit's tests. |
| `make build` | Production build into `dist/`. |
| `make clean` | Stop the server and remove build output. |
| `cargo run --release --example bench` | Kernel timings on a 2,000-box model. |

Use `make start PORT=8080` or `HOST=0.0.0.0` to change the address. Run `make` with no target to list everything.

## Keys

| Key | Action |
| --- | --- |
| Space, L, R, P, M, E, O, H | Select, Line, Rectangle, Push/Pull, Move, Eraser, Orbit, Pan |
| Middle or right drag; Shift + middle drag; scroll | Orbit; pan; zoom to cursor |
| Right / Left / Up arrow | Lock to the red / green / blue axis. Down clears the lock. |
| Shift (while drawing) | Lock the current inference |
| Digits | Type into the Measurements box. Enter applies. |
| G | Make a group from the selection |
| Double-click | Edit a group, select a face with its edges, or repeat the last push/pull |
| Esc | Cancel, clear the selection, or close the group being edited |
| Delete | Erase the selection |
| Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+O, Ctrl+A | Undo, redo, save, open, select all |
| Shift+Z | Zoom extents |

## Layout

```
kernel/        Rust geometry kernel (no rendering, no JS) and its tests
kernel-wasm/   wasm-bindgen bindings
app/           TypeScript app: tools, inference, viewport, UI
docs/          features.md, architecture.md, file-format.md
survey/        the survey toolkit (Python): spec -> .builder and other outputs, phone capture
prototype/     the original single-file prototype
```

## Docs

- [docs/features.md](docs/features.md): a feature survey of SketchUp and other building tools, tagged Core, Later or Full app, and the behaviors that make SketchUp feel easy.
- [docs/architecture.md](docs/architecture.md): the kernel, document model, file format, rendering, tools and inference, plugins and license, plus current limits.
- [docs/file-format.md](docs/file-format.md): the `.builder` format specification.
- [docs/roadmap.md](docs/roadmap.md): the prioritized plan to a workable application, split into sprints in [docs/sprints.md](docs/sprints.md).
- [HANDOFF.md](HANDOFF.md): where the project came from.

## License

The app and kernel are licensed under the [Mozilla Public License 2.0](LICENSE). The file format specification is licensed under CC BY 4.0, so anyone can read and write `.builder` files.
