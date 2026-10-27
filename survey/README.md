# builder-survey

Survey compiler: measured facts in a YAML spec -> checked geometry -> 3D model, reports and 2D layout pages.
Nothing is inferred; unknown values are `MISSING`, guesses are `~value`, disagreements are reported as CONFLICTS.

## Commands

```bash
uv run survey build   --project DIR [--plan NAME]   # spec -> DIR/model/out (or out/plans/NAME/)
uv run survey render  --project DIR -- [options]    # runs Blender (-b -P) on out/mesh.json; options after --
uv run survey capture --project DIR [--port N]      # photo + measurement web app
```

`survey build` writes `mesh.json`, `basement.dae`, `basement.sh3d`, `basement.rb`, `report.md`, `plan.png`,
`view3d.png`, `check_plan.png`, and one `<room>_plan.html` per `layout_pages:` entry.
`survey render` needs Blender at `/Applications/Blender.app/Contents/MacOS/Blender` (`--blender PATH` to change).

## Project directory

```
DIR/model/spec.yaml          the only source of geometry; needs a top-level `name:`
DIR/model/plans/NAME.yaml    plans layered onto the spec (add: -> proposed, remove: -> demo)
DIR/model/space/ROOM.json    starting pieces for a 2D layout page
DIR/model/out/               outputs
DIR/measure/checklist.yaml   capture app items; DIR/photos/, DIR/measurements/
DIR/survey.yaml              optional settings, see below
```

`survey.yaml` keys: `ruby_module` (SketchUp Ruby module name, default `Survey`), `sh3d_floor_z` (inches; what Sweet Home 3D
treats as its floor, default 0; everything is shifted down by it and parts below it are an error), `layout_pages`
(`- {room: bathroom, ceiling: joist_bottom}`: the room and the spec level that is its ceiling).

## Modules (`src/builder_survey/`)

| Path | What it does |
|---|---|
| `units.py` | `parse_length` (`10'11.5"`, `9 1/4"`, inches), `ftin` |
| `spec/ctx.py`, `checks.py`, `refs.py` | MISSING / `~` bookkeeping and levels; CONFLICT severity; edge references with chained offsets, rectangle placement |
| `spec/layout.py`, `plan.py` | the room solver (list-valued edges are checks); plan overlay |
| `generate/` | rooms -> walls, ledges, doors / glazing, joists, pipes, objects, finishes, cameras; `fixtures/` is a registry, one module per type |
| `export/` | `mesh`, `dae`, `sh3d`, `ruby`, `previews`, `check_plan`, `report` |
| `render/blender_build.py` | run by Blender; reads `out/mesh.json` |
| `layout2d/space_plan.py` | the 2D layout page with clearance checks |
| `capture/` | `serve.py` + `index.html` |

Each generator appends elements (`elements.element(...)`, with a `kind`) to one list; exporters only read that list.

### Adding a fixture type

Create `generate/fixtures/NAME.py` with `@fixture_type("NAME")` on `def f(ctx, p, f, z0, z1)` returning a list of parts or
`{material: parts}` (or `own_z=True` and `def f(ctx, p, f) -> (built, (z0, z1))`), and import the module in
`generate/fixtures/__init__.py`.

## Golden-master check

```bash
uv run python survey/tests/golden.py --golden GOLDEN_DIR --project . --extra-plan survey/tests/plans/testplan.yaml
```

Rebuilds a scratch copy of the project (base and the synthetic plan) and compares every output byte for byte with
`GOLDEN_DIR/base/` and `GOLDEN_DIR/testplan/` (the `.sh3d` zip by member, because its timestamps vary). Make
`GOLDEN_DIR` by building with the code you trust and copying `out/`.
