# The `.builder` file format, version 1

This document specifies the native file format of Builder. The format is open: anyone may read and write it, in any software, for any purpose.

*This specification is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The reference implementation is `kernel/src/format.rs`.*

## Overview

A `.builder` file is a UTF-8 JSON document. It stores the model as boundary geometry (vertices, edges and planar faces with holes) grouped into **definitions**, plus **instances** that place definitions inside other definitions.

```json
{
  "format": "builder",
  "version": 1,
  "units": "inch",
  "generator": "Builder 0.1.0",
  "definitions": [
    {
      "name": "Model",
      "kind": "root",
      "vertices": [[0, 0, 0], [120, 0, 0], [120, 96, 0], [0, 96, 0]],
      "edges": [[0, 1], [1, 2], [2, 3], [3, 0]],
      "faces": [{ "outer": [0, 3, 2, 1] }]
    }
  ],
  "instances": [],
  "materials": [],
  "tags": []
}
```

## Top level

| Key | Type | Required | Meaning |
| --- | --- | --- | --- |
| `format` | string | yes | Always `"builder"`. |
| `version` | integer | yes | Format version. This document describes `1`. A reader must refuse a version newer than it supports. |
| `units` | string | yes | Length unit of all coordinates: `"inch"`, `"mm"` or `"m"`. Builder writes `"inch"`. |
| `generator` | string | no | Name and version of the writing application. |
| `definitions` | array | yes | At least one. The first must have kind `"root"`. No other may be root. |
| `instances` | array | no | Placements of definitions. |
| `materials` | array | no | Referenced by index from faces and instances. |
| `tags` | array | no | Referenced by index from instances. |

Coordinates are right-handed with **Z up**.

## Definitions

A definition is a self-contained piece of geometry: the model root, a group, or a component.

| Key | Type | Meaning |
| --- | --- | --- |
| `name` | string | Display name. |
| `kind` | `"root"`, `"group"` or `"component"` | A group has exactly one instance. A component may have many, and all of them share its geometry. |
| `vertices` | array of `[x, y, z]` | Positions in the definition's own coordinates. |
| `edges` | array of `[a, b]` | Vertex indices (into this definition's `vertices`). Includes the edges of faces as well as loose edges. |
| `faces` | array of face objects | Planar polygons with optional holes. |

Indices in a definition refer only to that definition's arrays.

### Faces

| Key | Type | Meaning |
| --- | --- | --- |
| `outer` | array of vertex indices | The boundary loop, **counter-clockwise seen from the front** of the face. The front normal follows the right-hand rule. |
| `holes` | array of loops | Optional. Inner loops. Readers must accept either winding and re-wind them. Writers should write them clockwise seen from the front. |
| `material` | integer | Optional. Index into `materials` for the front side. |
| `back_material` | integer | Optional. Index for the back side. |

Rules every face must satisfy:

- All loop vertices lie on one plane, within 0.001 inch.
- A loop has at least three vertices and no repeated vertex.
- The outer loop has non-zero area, and holes lie inside it.
- Consecutive loop vertices are joined by an edge. If an edge is missing from `edges`, readers create it.

Readers should reject a file that breaks these rules rather than repairing it silently.

## Instances

| Key | Type | Meaning |
| --- | --- | --- |
| `definition` | integer | Index of the placed definition. Must not be 0 (the root). |
| `parent` | integer | Index of the definition this instance is placed in. |
| `transform` | array of 16 numbers | Column-major 4×4 affine matrix from the definition's coordinates to the parent's. The translation is in elements 12–14, in the file's `units`. |
| `name` | string | Optional. |
| `material` | integer | Optional. Applied to faces in the definition that have no material. |
| `tag` | integer | Optional. Index into `tags`. |

Instances must not form a cycle (a definition may not contain itself, directly or indirectly).

## Materials

| Key | Type | Meaning |
| --- | --- | --- |
| `name` | string | Display name. |
| `color` | `[r, g, b]` | sRGB, 0–255. |
| `opacity` | number | 0 (clear) to 1 (opaque). |

## Tags

| Key | Type | Meaning |
| --- | --- | --- |
| `name` | string | Display name. |
| `visible` | boolean | Whether tagged instances are shown. |

## Compatibility rules

- Readers must ignore keys they do not understand. Writers may add keys, namespaced with a prefix such as `"x-myplugin"`, for their own data.
- A future version 2 is planned as a zip container holding this JSON plus binary vertex buffers and texture images. It will keep the same structure.
- Lengths are always stored in the file's `units`. Builder converts on read and always writes inches, at full `f64` precision.
