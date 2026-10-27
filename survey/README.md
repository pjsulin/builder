# builder-survey

Survey compiler: measured facts in a YAML spec -> checked geometry -> 3D model, reports and 2D layout pages.
Nothing is inferred; unknown values are `MISSING`, guesses are `~value`, disagreements are reported as CONFLICTS.

## Commands

```bash
uv run survey build   --project DIR [--plan NAME] [--out DIR]   # spec -> out dir (or out/plans/NAME/)
uv run survey render  --project DIR [--out DIR] -- [options]    # runs Blender (-b -P) on out/mesh.json; options after --
uv run survey capture --project DIR [--port N] [--cert F --key F]   # phone capture page (HTTPS for voice notes)
uv run survey entries --project DIR [--uncited]                 # entries with transcripts; which the spec cites
```

`survey build` writes `mesh.json`, `STEM.dae`, `STEM.sh3d`, `STEM.rb`, `STEM.builder` (opens in Builder; one group
per element, phases as tags, `survey:*` attributes), `report.md`, `plan.png`, `view3d.png`, `check_plan.png`, and one `<room>_plan.html` per `layout_pages:` entry. `STEM` is `output_stem` from `survey.yaml`,
else the spec `name:` slugged (lowercase, runs of other characters become `-`: `Elm St garage` -> `elm-st-garage`).
The out dir is `--out`, else `survey.yaml` `out_dir`, else `DIR/model/out`.
`survey render` needs Blender at `/Applications/Blender.app/Contents/MacOS/Blender` (`--blender PATH` to change)
and writes `STEM.blend` next to `mesh.json`.

```
$ uv run survey build --project ../house
basement.sh3d: 31 walls, 121 pieces, 9 rooms
133 elements built; 5 CONFLICTS, 0 MISSING, 122 placeholder values. See ../house/model/out/report.md
```

## Project directory

```
DIR/model/spec.yaml          the only source of geometry; needs a top-level `name:`
DIR/model/plans/NAME.yaml    plans layered onto the spec (add: -> proposed, remove: -> demo)
DIR/model/space/ROOM.json    starting pieces for a 2D layout page
DIR/model/out/               outputs (see out_dir)
DIR/measure/checklist.yaml   capture questions; DIR/photos/ reference photos; DIR/measurements/ entries
DIR/survey.yaml              optional settings, see below
```

`survey.yaml` keys:

| Key | Meaning | Default |
|---|---|---|
| `output_stem` | file stem of the `.dae`, `.sh3d`, `.rb`, `.builder` and `.blend` outputs; a plain file name | spec `name:` slugged |
| `out_dir` | where outputs go, relative to the project; `--out` overrides it | `model/out` |
| `ruby_module` | SketchUp Ruby module name | `Survey` |
| `sh3d_floor_z` | inches; what Sweet Home 3D treats as its floor. Everything is shifted down by it and parts below it are an error | `0` |
| `layout_pages` | `- {room: bathroom, ceiling: joist_bottom}`: the room and the spec level that is its ceiling | none |
| `capture_tls` | `{cert, key}` PEM files for `survey capture` over HTTPS (iOS needs it to record); `--cert`/`--key` override | none (HTTP) |
| `transcribe_model` | faster-whisper model for voice notes (`uv sync --extra transcribe`) | `small.en` |

Unknown keys stop the build.

## Materials

`materials.py` `LIBRARY` holds the generic materials (block, framed, slab, wood, glass, pipe, copper, pvc, ...) as
`name -> (r, g, b)`. A spec `materials:` section adds or overrides entries by name:

```yaml
materials:
  walnut:          {color: [110, 70, 40], render: {recipe: wood, label: walnut, args: [[0.035, 0.018, 0.009], [0.07, 0.036, 0.018]]}}
  boiler_green:    {color: [30, 90, 55],  render: {recipe: plain, label: boiler green, args: [[0.05, 0.20, 0.10], 0.35]}}
  worn grey paint: {render: {recipe: worn_paint_floor, label: worn grey floor paint}}   # finish only
```

- `color` is sRGB 0–255: the flat colour used by every export (`.dae`, `.sh3d`, `.rb`, previews, `mesh.json`).
- `render` names a Blender recipe (`concrete`, `block`, `painted_block`, `worn_paint_floor`, `pavers`, `plain`,
  `wood`, `pine`, `glass`, `glow`: the functions in `render/blender_build.py`), with its positional `args` after the
  label. `mesh.json` carries these as `recipes`, and the Blender script builds them after its generic materials, so
  a spec can override a generic finish by name.
- An entry with only `render` is a finish (`finishes:` in the spec) and has no flat colour.

`material_table(spec)` returns library colours then the spec's; `render_recipes(spec)` the spec's recipes. A build
stops at the first element whose material or base material is not in the table: `shelving: unknown material 'teak' (add it to the spec's `materials:`)`.

## Element provenance

Every spec entry that becomes an element (`rooms`, `walls`, `joists`, `pipes` and their `runs`, fixtures, `objects`)
accepts an optional `source: measurements/<date>/<time>-<id>`, the capture entry folder the numbers came from. The
build fails when that folder is not under the project. `mesh.json` records each element's `kind` (`floor`, `sill`,
`joists`, `wall`, `named_wall`, `ledge`, `door`, `pipe`, `object`, `fixture`).

## Modules (`src/builder_survey/`)

| Path | What it does |
|---|---|
| `project.py` | `Project(root, out)`: the project's paths, `survey.yaml`, `stem(spec)`; `slug()` |
| `materials.py` | `LIBRARY`, `material_table(spec)`, `render_recipes(spec)`, `rgb(table, name)` |
| `units.py` | `parse_length` (`10'11.5"`, `9 1/4"`, inches), `ftin` |
| `spec/ctx.py`, `checks.py`, `refs.py` | MISSING / `~` bookkeeping and levels; CONFLICT severity; edge references with chained offsets, rectangle placement |
| `spec/layout.py`, `plan.py` | the room solver (list-valued edges are checks); plan overlay |
| `generate/` | rooms -> walls, ledges, doors / glazing, joists, pipes, objects, finishes, cameras; `fixtures/` is a registry, one module per type |
| `export/` | `mesh`, `dae`, `sh3d`, `ruby`, `builder`, `previews`, `check_plan`, `report` |
| `render/blender_build.py` | run by Blender; reads `out/mesh.json` |
| `layout2d/space_plan.py` | the 2D layout page with clearance checks |
| `capture/` | `serve.py` (HTTP/HTTPS server, v2 entries) + `index.html` (phone page); `transcribe.py` (faster-whisper); `entries.py` (`survey entries`) |

Each generator appends elements (`elements.element(...)`, with a `kind` and `source`) to one list; exporters only
read that list and the material table.

### Adding a fixture type

Create `generate/fixtures/NAME.py` with `@fixture_type("NAME")` on `def f(ctx, p, f, z0, z1)` returning a list of parts or
`{material: parts}` (or `own_z=True` and `def f(ctx, p, f) -> (built, (z0, z1))`), and import the module in
`generate/fixtures/__init__.py`. Material names a fixture uses must be in the library or the spec's `materials:`.

## Tests

```bash
uv run --project survey pytest survey/tests          # unit tests (pytest is in the `dev` group; uv syncs it)
uv run --project survey python survey/tests/golden.py --golden GOLDEN_DIR --project HOUSE \
    --extra-plan survey/tests/plans/testplan.yaml [--write]
```

`golden.py` rebuilds a scratch copy of the project (base and the synthetic plan) and compares every output byte for
byte with `GOLDEN_DIR/base/` and `GOLDEN_DIR/testplan/` (the `.sh3d` zip by member, because its timestamps vary).
It runs the build with the interpreter it was started from, so start it from an environment that has
`builder-survey` installed. `--write` prints the differences, then copies the new outputs over `GOLDEN_DIR`; list each
difference and its reason in the commit that updates the reference.

```
$ uv run --project survey python survey/tests/golden.py --golden ../house/tests/golden --project ../house \
    --extra-plan survey/tests/plans/testplan.yaml
base: 9 files compared, 0 differ
testplan: 9 files compared, 0 differ
```

`survey/uv.lock` is committed: `survey/` is its own uv project with a CLI. A house project that depends on it by
path keeps its own lock.

## Docs

- [docs/spec-format.md](docs/spec-format.md): every `spec.yaml` key, length and reference syntax, checks, and what `MISSING`, `~` and CONFLICTS do.
- [docs/plans.md](docs/plans.md): `model/plans/NAME.yaml` (`add:` / `remove:`), `survey build --plan`, and the phases a plan produces.
- [docs/contract.md](docs/contract.md): the geometry rule for survey mode and for agents editing a spec.
- [docs/render.md](docs/render.md): `survey render` options, outputs, materials and recipes, Metal kernel cache and GUI-Blender notes.
- [docs/walkthrough.md](docs/walkthrough.md): the end-to-end run on a real house: build, validate, open in Builder, lock, tags, attributes, draw, export, build the plan.
- [docs/capture.md](docs/capture.md): phone photo + voice note capture, the mkcert HTTPS setup, the entry layout, `survey entries` and the loop from entry to `source:`.
- [docs/exports.md](docs/exports.md): each output file including `STEM.builder`, who reads it, the Sweet Home 3D `dropOnTopElevation` finding, the 2D layout page.
