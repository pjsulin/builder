# spec.yaml format

What `survey build` reads from `DIR/model/spec.yaml`: every key, the length syntax, references, checks, and what `MISSING`, `~` and CONFLICTS do to the outputs.

The spec is the only source of geometry. Nothing is inferred from it: a value that is not written is not built. See [contract.md](contract.md) for the rule, [README.md](../README.md) for the project directory, `survey.yaml` and the `materials:` section.

## Coordinates and lengths

- Plan points are `[east, south]` from an origin the spec chooses (a convenient inside corner). `east` grows east, `south` grows south. Heights (`z`) grow up from the base slab, `0`.
- A length is a number (inches) or text: `10'11.5"`, `9 1/4"`, `6"`, `2'0"`. The parser (`units.parse_length`) accepts feet, decimal inches, and a fraction; anything else stops the build with `Can't read length '...' at <path>`.
- A height is a length, a level name, or a level with `+` / `-` terms: `joist_bottom - 6"`, `hall_floor + 65"`.
- Lengths in the report and the check plan come back as feet-inches rounded to 1/8".

## Top-level keys

| Key | Required | What it is |
|---|---|---|
| `name` | yes | the model's name; slugged for the output stem unless `survey.yaml` sets `output_stem` |
| `levels` | no | `name: height` datums any length field can name (`base_slab: 0`, `joist_bottom: 7'9"`) |
| `joist` | if `joists:` is used | `{depth, width, spacing}` shared by every joist region |
| `materials` | no | house materials added to the library; see [README.md](../README.md#materials) |
| `layout` | no | `wall`, `wall_z`, `rooms`, `fixtures`, `doors`: the plan |
| `walls` | no | named axis-aligned walls given by endpoints, for walls the room solver does not generate |
| `finishes` | no | render finishes per room face; `default_wall` |
| `pipes` | no | named corners and the runs between them |
| `joists` | no | joist regions |
| `objects` | no | boxes and cylinders at absolute coordinates |
| `cameras` | no | named render views |
| `rooms` | no | flat-polygon floors at absolute points (`floor: [[e, s], ...]`, `floor_z`, `phase`); older than `layout:` and not placed by references |

Any entry that becomes an element may carry `source: measurements/<date>/<time>-<id>`; see [README.md](../README.md#element-provenance).

Phases: every entry is `existing` unless it says `phase: demo` or `phase: proposed` (`objects`, `joists`, `walls`, `rooms` require `phase:`; the rest default to `existing`). Plans set phases without editing the spec; see [plans.md](plans.md).

## levels

```yaml
levels:
  base_slab: 0
  hall_floor: 8"
  joist_bottom: 7'9"
```

Wherever a length is expected, a level name resolves to its value. A `~` before a level name (`~joist_bottom`) marks the use as a placeholder.

## layout

```yaml
layout:
  wall: 8"                       # default wall thickness around indoor rooms
  wall_z: [base_slab, joist_bottom]
  rooms:
    office:
      size: [10'11.5", 6'8"]     # [east-west, north-south], inside faces
      west: 0
      north: 0
      walls: {west: 1'}          # this room's outer wall on that side
    storage:
      size: [20'3", 7'5"]
      floor: hall_floor          # default base_slab
      west: office.east + 4 1/2"
      north: office.north - 1'
      ledges:
        north: {depth: 4", height: 5', slope: 35}
    hall:
      size: [edges, 9'10.5"]     # width from its two placed edges
      floor: hall_floor
      west: [storage.west + ~2', office.east + 2']   # first places, second is a check
      east: storage.east
      north: storage.south + 8"
    patio:
      size: [12'5", MISSING]
      outside: true              # no walls generated around it
      west: hall.west
      north: hall.south + 8"
```

Rooms are rectangles. Each needs `size` and one placed edge per axis: `west` or `east`, and `north` or `south`. A dimension of `edges` takes that axis from both its edges instead. The solver (`spec/layout.py`) places rooms in any order, chasing references until every room that can be placed is; a room whose reference never resolves is listed under MISSING as `not placed: waits on <room>`.

Generated walls: every point within `wall` of an indoor room that is not inside any room becomes wall, from `wall_z[0]` to `wall_z[1]`. A shared wall is built once and its thickness is the gap between the two rooms. `walls: {side: thickness}` changes that room's own outer wall on one side. `outside: true` rooms get no walls and do not cut walls that stand on their edge.

Checks the solver makes: a later relationship on an edge, rooms that overlap, and an implied wall between neighbours (gap of 1/2" to 24") thinner than the declared or default thickness. Each is a CONFLICT.

### Ledges

`ledges: {side: {depth, height, slope, from?, length?}}`. `size` is measured below the ledge, so the room edge on that side is the wall face above it and the rectangle is widened by `depth`. The ledge is its own block element: vertical to `height` above the floor, then its top rises toward the wall at `slope` degrees. `from: <end>` with `length:` limits it to one run from that end (`from: south, length: 80"`); `length` without a valid `from` stops the build. A door in that wall below the ledge top cuts it.

### fixtures

```yaml
  fixtures:
    bench:
      type: box
      material: walnut
      size: [4', 18"]
      west: storage.west + 1'
      north: storage.north + 1'
      z: [hall_floor, hall_floor + 18"]
```

Fixtures are placed like rooms (`size`, edges, list checks) and may refer to rooms and to each other, but make no walls. `z: [bottom, top]` for every type except `stairs`, which has its own heights (`up`, `risers`, `bottom`, `rise`; `detail:` builds it from boards). Types registered in `generate/fixtures/`: `box`, `cylinder` (upright, inscribed in the rectangle), `stairs`, `appliance` (movable in the `.sh3d`), `shelving`, `sauna`, `boiler`, `water_heater`, `cabinet_doors`. An unknown type stops the build and lists the known ones.

### doors

```yaml
  doors:
    office_storage:
      room: storage
      side: west
      north: storage.north + 33"   # one edge along the wall places the clear opening
      width: 36"
      height: 76"
      frame: 1 1/2"                # each side; default 0
```

`room` + `side` name the wall; one edge along it (`north`/`south` for an east or west wall, `west`/`east` otherwise) places the clear opening and any further edge is a check. `bottom` defaults to the room floor; a door at floor level gets a sill of the room's floor through the wall. The cut runs through the generated wall out to the first cell that is not wall, or `depth:` into it for a recess. Optional `glass: {lites: [across, up], sash, setback, muntin?}` builds a sash and a daylight record; `leaf: {setback, thickness, stile, rail, glass: {bottom, top}, lites, leaves?, casing?}` a panelled door, or `leaf: {style: chevron, setback, thickness, board, leaves?}` board doors. A door with no wall behind it is a CONFLICT.

## walls

```yaml
walls:
  partition:
    phase: existing
    from: [12', 20']
    to: [12', 28']
    thickness: 4 1/2"
    grows: east                  # east/west for a north-south wall, north/south for east-west
    z: [hall_floor, joist_bottom]
    material: framed             # default block
    openings:                    # optional; at = distance from `from`, sill from opening_base
      - {at: 2', width: 30", height: 80"}
```

Only axis-aligned walls. `opening_base` (default the wall bottom) is where `sill` is measured from.

## joists

```yaml
joist: {depth: 9 1/4", width: 1 1/2", spacing: 16"}
joists:
  office:
    phase: existing
    run: ns                      # ns or ew
    region: [office.west, office.north, office.east, office.south]
    from: east                   # side `first` is measured from; default west / north
    first: 15"
    z_bottom: joist_bottom
    # origin: office.east        # continue another region's grid
```

A region waiting on an unplaced room is listed under MISSING.

## pipes

```yaml
pipes:
  main:
    diameter: 2 3/8"             # the pipe's own; a run may override
    material: steel              # default pipe
    corners:
      tee: [storage.east - 7'4", storage.north + 9'8", joist_bottom - 6"]
      elbow:
        - west: storage.west + 9"                        # a face instead of the centre
        - [storage.north + 9'8", storage.north + 9'9"]   # first places, rest are checks
        - top: joist_bottom - 5 1/2"
    runs:
      - {from: tee, to: elbow}
      - {from: elbow, to: other_pipe.corner, material: copper, diameter: ~2 1/8"}
```

A corner is `[east, south, z]`. Each value is the centre line, or a face of the pipe (`west`/`east`, `north`/`south`, `top`/`bottom`) that the radius moves to the centre. References may name rooms, fixtures, and doors as `door_<name>` (edges along the wall are the frame's outside edges; across the wall, the wall's faces). A run names corners of its own pipe or `pipe.corner` of another, and builds when both corners and a diameter are known; otherwise the report lists what it waits on. A check must measure the same face as the placing value, else the build stops.

## objects

```yaml
objects:
  can:
    type: cylinder               # or box: at [east, south, z], size [W, L, H]
    phase: existing
    from: [3', 2', 7'8"]
    to: [3', 2', ~7'3"]
    diameter: 6"
    material: white_paint
```

Absolute coordinates only; no references.

## finishes and cameras

```yaml
finishes:
  default_wall: painted block    # any indoor wall face with nothing recorded
  office:
    north: drywall
    floor: dark grey floor
    ceiling: drywall             # render-only ceiling
cameras:
  office:
    at: [10', 5'10", 5'8"]       # [east, south, z]
    look_at: [10", 5", 4'2"]
    lens: 16                     # default 18
    show: before                 # before (existing + demo) or after (existing + proposed)
```

Finishes only affect the Blender render (through `mesh.json`); every other export uses the material's flat colour. A finish name must be a generic finish in `render/blender_build.py` or a `materials:` entry with `render:`. Cameras go into the `.blend` and render on request; see [render.md](render.md).

## References and chained offsets

`room.edge` with any number of `+` / `-` terms: `office.east + 4 1/2"`, `bathroom.south + 8" - 6'`. Each term is a length or level. A reference to a room (or fixture) that is not placed blocks the entry until it is; if it never is, the entry is MISSING. A `~` in front (`~office.east + 2'`) or in a term (`office.east + ~2'`) marks the value as a placeholder.

## MISSING, `~`, CONFLICTS

- `MISSING` (or an absent required value): the element is skipped and the path is listed under `## MISSING` in `report.md`. Nothing is built in its place.
- `~value`: a stand-in. The element builds with material `placeholder` (orange in every export and `--check` render, dashed in `check_plan.png`), its real material is kept as `base` in `mesh.json` so realistic renders still show the finish, and the use is listed under `## PLACEHOLDER`. A room placed from a `~` value passes the flag to everything placed from it, and to the generated walls.
- CONFLICTS: two relationships that disagree by more than `TOLERANCE` (1/2", `spec/checks.py`). The first value stands; nothing is averaged or moved. Each is listed in `report.md` with a severity and drawn in `check_plan.png`:

| Severity | Miss |
|---|---|
| minor | up to 2" (block walls wander) |
| check | up to 6" |
| major | over 6", and any conflict without a measured size (unchecked reference, door with no wall) |

The build's last line counts them: `N elements built; C CONFLICTS, M MISSING, P placeholder values.` A CONFLICT never stops the build; a malformed value does.

## materials and source

`materials:` adds house materials by name (`color` for flat exports, `render` for a Blender recipe); an element whose material is not in the library or the spec stops the build. `source:` on any element entry names the capture folder its numbers came from and must exist under the project. Both are documented in [README.md](../README.md).
