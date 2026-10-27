# Plans

A plan is a YAML file layered onto `spec.yaml` at build time, so one base spec can carry several proposals without being edited.

## Files and commands

```
DIR/model/plans/NAME.yaml      the plan
DIR/model/out/plans/NAME/      its outputs (same set as the base build; see exports.md)
```

```bash
uv run survey build  --project DIR --plan NAME              # spec + plan -> out/plans/NAME/
uv run survey render --project DIR -- --plan NAME --render all
```

A missing plan file stops the build: `plan 'NAME': no file .../model/plans/NAME.yaml`. The base build (`survey build` without `--plan`) is unchanged by the existence of plans. With `--out`, outputs go to `OUT/plans/NAME/`.

## Format

```yaml
description: half bath in the storage room

add:                  # same shape as spec.yaml; every entry becomes `proposed`
  layout:
    fixtures:
      vanity:
        type: box
        material: wood
        size: [30", 21"]
        west: storage.west + 4"
        south: storage.south - 4"
        z: [hall_floor, hall_floor + 34"]
    doors:
      new_door: {room: storage, side: south, west: storage.west + 3', width: 30", height: 6'8"}
  cameras:            # default show: after
    vanity_view: {at: [27', 22', 5'], look_at: [24', 30', 4'], lens: 18}

remove:               # spec paths of existing entries; they become `demo`
  - pipes.main
  - layout.doors.office_storage
```

Only `description`, `add` and `remove` are allowed at the top level. `survey/tests/plans/testplan.yaml` is a complete example used by the golden test.

## Rules (`spec/plan.py`, each stops the build with a message)

- `add:` may only contain `layout.fixtures`, `layout.doors`, `pipes`, `joists`, `objects`, `cameras`. Rooms, ledges and the walls they generate are the base; a plan cannot move or remove them. Cut them with a door, or add a `box` fixture for a new partition.
- An added name must not already exist in the spec. To change an existing item, `remove` it and `add` the new version under a new name.
- Added entries get `phase: proposed`; writing any other `phase` is an error. Added cameras get `show: after` unless they say otherwise.
- `remove:` takes dotted spec paths from the same sections except `cameras`. The entry must exist and be `existing` (not already `demo` or `proposed`); it becomes `demo`.
- Added entries use the same value rules as the spec (`~`, `MISSING`, references to base rooms and fixtures); see [spec-format.md](spec-format.md).

## What the phases produce

- `proposed` elements take the `proposed` material (blue) in flat exports and the Proposed collection in Blender; `demo` elements go in the Demo collection. Scenes: before = existing + demo, after = existing + proposed. `render_before.png` and `render_after.png` are these two scenes.
- A proposed door's opening is cut and the block it removes is built as a `demo` element; a removed door's opening is filled with a `proposed` infill. A ledge under a proposed door gets a `demo` piece; under a removed door it is not rebuilt.
- The `.sh3d` leaves demo elements out, so it shows the after state. The 2D layout page shows only `existing` obstacles.
