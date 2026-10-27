# Rendering with Blender

`survey render` runs Blender headless on `out/mesh.json`, saves a `.blend`, and renders the views you ask for.

## Usage

```bash
uv run survey render --project DIR [--out DIR] [--blender PATH] -- [options]
```

`survey render` resolves the out dir the same way as `survey build` (`--out`, else `survey.yaml` `out_dir`, else `DIR/model/out`) and runs `blender -b -P render/blender_build.py -- --project DIR --out OUT <options>`. Blender is expected at `/Applications/Blender.app/Contents/MacOS/Blender`; `--blender PATH` changes that. Run `survey build` first, and again after every spec change: the script starts from an empty scene and reads only `mesh.json`.

Options after `--` (from the docstring of `render/blender_build.py`):

| Option | Effect |
|---|---|
| (none) | build and save `STEM.blend` only; no renders (about a second) |
| `--render NAME ...` | render `before`, `after`, a spec camera name, or `all` |
| `--look E,S,Z E,S,Z` | render one view from the first point toward the second, inches, `[east, south, z]`, to `view_check.png` |
| `--quick` | 16 samples and half resolution, for checking geometry |
| `--cpu` | render on the CPU; default is the GPU through Metal (the script exits if there is none) |
| `--check` | flat check colours instead of the realistic finishes |
| `--plan NAME` | read and write `out/plans/NAME/` (after `survey build --plan NAME`) |

An unknown `--render` name stops with the list of valid ones. A camera renders the scene its `show:` names (`before` by default, `after` for plan cameras).

## Outputs (in the out dir, or `out/plans/NAME/`)

| File | What it is |
|---|---|
| `STEM.blend` | collections Existing / Demo / Proposed; a hidden "Ceilings & room lights (render)" collection; a hidden "Cameras & lights" collection with the overview camera, the sun and every spec camera. Each object's origin is its own centre. Units imperial, feet. |
| `render_before.png` | Existing + Demo, overview, sun and sky |
| `render_after.png` | Existing + Proposed, overview |
| `view_<name>.png` | a spec camera; interior: ceilings and room lights on, sun off |
| `view_check.png` | the `--look` view, 16 mm lens |

`STEM` comes from `mesh.json` (`output_stem` or the slugged spec name).

## Materials

Without `--check`, every triangle takes its finish from `mesh.json` (`finishes:` in the spec, probed per wall face), else the element's real material (`base`). The generic finishes and materials are built in `make_real_materials` in `blender_build.py` (`troweled concrete`, `smooth concrete`, `painted block`, `pavers`, `drywall`, `block`, `slab`, `wood`, `steel`, `copper`, `glass`, `glow`, `placeholder`, ...). The spec's `materials:` entries with `render:` arrive as `mesh.json` `recipes` and are built after the generic ones, so a spec can add a material or override a generic finish by name; a recipe is one of `concrete`, `block`, `painted_block`, `worn_paint_floor`, `pavers`, `plain`, `wood`, `pine`, `glass`, `glow` with its positional `args` after the label. A finish with no material stops the render: `<element>: no realistic material for '<name>'`. See [README.md](../README.md#materials).

Rooms get render-only ceilings at the top of their joists where joists are modelled, else the wall top, with one soft light each; windows (`glass:`) get a sky plane and an area light. These are not in any other export.

## `--check` colours

`--check` uses one flat material per spec material from the `mesh.json` colour table, so the render shows what the flat exports show: `placeholder` orange (255, 140, 0) for every element that used a `~` value, `proposed` blue (90, 150, 220), the library colours for the rest. Without `--check`, Solid viewport mode in the saved `.blend` still shows these colours (object colour), while Material Preview and renders show the finishes.

## Metal kernels and a GUI Blender

- Cycles compiles its Metal kernels once per Blender install and caches them under `$TMPDIR/../C/org.blenderfoundation.blender/com.apple.metal/`. The first GPU render after a Blender update pays that (about 1.5 min). Adding new materials makes the first render rebuild kernels on the CPU, which can take over ten minutes; expect it, and try `--quick --render before` first.
- Never put a timeout on a render or cancel one during a kernel rebuild: a cancelled rebuild is paid again next time.
- Close any GUI Blender before a headless render (`ps aux | grep -i '[B]lender'`; a GUI instance has no `-b`). A GUI window in Rendered viewport mode shares the GPU and slows the headless render badly; Solid mode is expected to be fine.
- Typical times once kernels are cached, Apple Silicon GPU: 5-18 s per view, about 2 min for `--render all` on a house-sized model; `--quick --look` a few seconds. `--cpu` is roughly ten times slower per view.
