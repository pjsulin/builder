"""The element record every generator produces.

`kind` says what the element is, so exporters and the 2D layout page filter on it
rather than on the name: floor, sill, joists, wall (the generated walls), named_wall
(spec `walls:`), ledge, door (frames, leaves, glazing, infill), pipe, object, fixture.
It stays in memory; mesh.json and the Ruby script don't carry it.
"""


def element(name, phase, material, ctx, parts, *, kind, notes=None):
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
    }
