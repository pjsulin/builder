# Build outputs

Every file `survey build` writes, who reads it, and what each one leaves out.

All go in the out dir (`--out`, else `survey.yaml` `out_dir`, else `DIR/model/out`), or `out/plans/NAME/` with `--plan`. `STEM` is `output_stem` from `survey.yaml`, else the spec `name:` slugged. Every exporter reads the same element list and the same material table (`materials.material_table`), so the geometry is identical across files; only what each format can carry differs. Axes: `east`, `south` in the spec; exporters convert.

| File | Written by | Read by |
|---|---|---|
| `mesh.json` | `export/mesh.py` | `survey render` (`render/blender_build.py`) |
| `STEM.dae` | `export/dae.py` | SketchUp Go or Pro, File > Import |
| `STEM.sh3d` | `export/sh3d.py` | Sweet Home 3D |
| `STEM.rb` | `export/ruby.py` | SketchUp Pro, Window > Ruby Console, `load '/path/to/STEM.rb'` |
| `report.md` | `export/report.py` | people and agents, after every build |
| `plan.png`, `view3d.png` | `export/previews.py` | quick look, no Blender needed |
| `check_plan.png` | `export/check_plan.py` | the main review view for measurements |
| `<room>_plan.html` | `layout2d/space_plan.py` | a browser, one per `layout_pages:` entry |
| `STEM.builder` | | see the Builder file format docs; written by a later phase |

## `mesh.json`

Keys: `stem`, `materials` (name -> RGB), `recipes` (the spec's `render:` entries), `elements`, `cameras`, `ceilings`, `daylight`. Each element has `name`, `phase`, `material` (`placeholder` or `proposed` when flagged), `base` (the real material), `kind` (`floor`, `sill`, `joists`, `wall`, `named_wall`, `ledge`, `door`, `pipe`, `object`, `fixture`), `verts`, `tris`, and `finish` (one finish name or null per triangle) when any triangle has one. Ceilings and daylight are render-only. Element order follows the generators, so the file changes when the spec does, not between identical builds.

## `STEM.dae`

COLLADA 1.4.1, inches, Z up. One lambert material per table entry, one geometry node per element, nested under Existing / Demo / Proposed so a phase can be tagged at once in SketchUp. No finishes.

## `STEM.sh3d`

A Sweet Home 3D home (cm; x east, y south) for laying out furniture by hand:

- full-height runs of the generated walls become native walls (magnetism and dimensions work), each room a room with its name and area;
- everything else becomes one locked, non-resizable piece per object (OBJ + MTL inside the zip): ledges, stairs, appliances, pipes (one piece per straight run), door and window parts, the wall above and below each opening, raised floors. Joists and `demo` elements are left out;
- fixtures of type `appliance` are movable; the rest are locked;
- pieces carry a transparent 16 x 16 plan icon so walls drawn over them stay visible;
- `sh3d_floor_z` (inches, `survey.yaml`) shifts everything down so that height is Sweet Home 3D's floor 0. Flat-bottomed prisms are cut at 0; any other part below it stops the export with `write_sh3d: a <kind> part goes below the floor datum`.

`dropOnTopElevation`: while a piece at elevation exactly 0 is dragged, Sweet Home 3D lifts it onto the highest piece whose footprint contains all its corners (from the decompiled `FurnitureController.getSurroundingFurniture` and `PlanController.adjustPieceOfFurnitureElevation`), unless that piece has `dropOnTopElevation < 0`. Overhead pipes and stair landings have footprints that cover whole rooms, so a dropped box kept jumping onto them. The export therefore writes `dropOnTopElevation='-1'` on every piece except raised floors (`* floor` pieces) and the movable appliances: a dropped box lands only on those. A piece already at a non-zero elevation is never re-lifted while moving. Grouping pipes into one piece per pipe was tried first and was not enough, because a grouped piece acts as its whole bounding box.

## `STEM.rb`

A SketchUp Ruby script embedding the same element list. Running it erases the previous generated group (found by attribute `ruby_module` lower-cased), adds materials by name, tags Existing / Demo / Proposed, and builds one group per element. `ruby_module` in `survey.yaml` sets the module name (default `Survey`). Does not carry `kind` or `source`.

## `report.md`

In order: element count and how many used placeholders; `## CONFLICTS` sorted largest first, each with its severity (minor up to 2", check up to 6", major beyond, see [spec-format.md](spec-format.md)); the placed rooms (inside faces from the origin); the walls implied between neighbours and their thickness; fixtures; doors (clear opening and frame); pipe runs with what each unbuilt one waits on; `## MISSING`; `## PLACEHOLDER`. Nothing is adjusted: the report describes the spec as built. Known limits: a shared `~` value is listed once per use.

## `plan.png`, `view3d.png`

Matplotlib previews of the element list in their flat colours: a plan and an axonometric. Placeholder elements are orange.

## `check_plan.png`

The review drawing: rooms with their sizes (dashed if placed from a `~` value), fixtures (hatched for stairs), door openings (brown) with frames (tan), built pipe runs (dashed if placeholder) and every placed pipe corner as a dot, the wall implied between each pair of neighbours labelled with its thickness (grey, or coloured by severity when thinner than declared), and every CONFLICT that has a place: an arrow from where the edge was placed to where the check says it should be, labelled with the miss, coloured grey / amber / red by severity. Only written when `layout:` placed at least one room.

## `<room>_plan.html`

One self-contained page per `layout_pages:` entry in `survey.yaml` (`room` and `ceiling`, a spec level that is the room's ceiling). The page is an SVG plan of the room with a margin, and every `existing` element in view as an obstacle with its height range above the room's floor (floors, joists and sills are skipped; ledge faces become the effective walls at the floor). Pieces to arrange (fixtures, walls, doors, with optional clearances `front`, `side`, `around`, `swing`) start from `DIR/model/space/<room>.json` (`presets`, `pieces`, `view`), are dragged, resized and rotated in the browser, and are kept in the browser's localStorage; Export puts the layout in the page's text box for pasting back into `space/<room>.json`. A piece only hits what overlaps its own height; problems are listed as red (hits something), orange (a clearance zone is cut into) or green.

The idea behind it: the build supplies every existing obstacle, so the page, Blender and Sweet Home 3D agree; the person places pieces and the tool checks them, never the other way round. Next steps noted for it: clearance rules keyed by object type with their code citation instead of fields on each piece; exporting a layout as a plan file (`model/plans/<name>.yaml`, proposed fixtures and walls) so it appears in the after renders; drawing measured walls on the page and saving them to the spec as numbers. None of that is built; `view` supports only `north` today.
