"""The element record every generator produces.

`kind` says what the element is, so exporters and the 2D layout page filter on it
rather than on the name: floor, sill, joists, wall (the generated walls), named_wall
(spec `walls:`), ledge, door (frames, leaves, glazing, infill), pipe, object, fixture.
mesh.json and the .builder file carry it; the Ruby script doesn't.

`source` is the spec entry's optional `source:` key: the measurement entry folder
(`measurements/<date>/<time>-<id>`) the numbers came from. The build checks the
folder exists under the project; the .builder export writes it as `survey:source`.
"""


def element(name, phase, material, ctx, parts, *, kind, notes=None, source=None):
    base = material                # the real material, for realistic renders
    if phase == "proposed" and material not in ("placeholder",):
        material = "proposed"
    return {
        "name": name,
        "phase": phase,
        "material": "placeholder" if ctx.placeholder else material,
        "base": base,
        "placeholder": ctx.placeholder,
        "parts": parts,
        "kind": kind,
        "source": source,
    }
