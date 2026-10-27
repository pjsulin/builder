"""The material library (name -> RGB) and the spec's `materials:` section, which adds
or overrides entries:

    materials:
      walnut: {color: [110, 70, 40], render: {recipe: wood, args: [[0.035, 0.018, 0.009], [0.07, 0.036, 0.018]]}}
      worn grey paint: {render: {recipe: worn_paint_floor, label: worn grey floor paint}}

`color` is sRGB 0-255 (flat colours in every export). `render` names one of the
Blender recipes in render/blender_build.py with its arguments; an entry with only
`render` is a finish (spec `finishes:`) and has no flat colour."""
import sys


LIBRARY = {  # name -> RGB
    "block": (190, 190, 185),
    "framed": (235, 225, 205),
    "slab": (160, 160, 160),
    "wood": (200, 160, 110),
    "joist": (200, 160, 110),          # old floor framing; dark brown in renders
    "glass": (200, 225, 235),
    "glow": (255, 190, 110),           # LED strips; emit light in renders
    "white_paint": (240, 240, 235),    # painted wood: stairs, window sashes, doors
    "rubber": (35, 35, 35),            # stair tread covers
    "pine": (230, 195, 140),           # clear-finished pine (panel cabinet doors)
    "grass": (95, 140, 70),            # lawn
    "flagstone": (150, 140, 125),      # big flat rocks
    "enamel": (238, 238, 234),         # white appliance enamel
    "appliance_grey": (150, 155, 160),
    "object": (120, 140, 160),
    "pipe": (40, 40, 40),              # pipe of unknown material
    "steel": (60, 60, 65),
    "copper": (184, 115, 51),
    "pvc": (235, 235, 230),
    "cast_iron": (30, 28, 26),
    "proposed": (90, 150, 220),
    "placeholder": (255, 140, 0),
}

# Blender recipes a spec `render:` may name (functions in render/blender_build.py).
RECIPES = ("concrete", "block", "painted_block", "worn_paint_floor", "pavers", "plain",
           "wood", "pine", "glass", "glow")


def _spec_materials(spec):
    entries = spec.get("materials") or {}
    if not isinstance(entries, dict):
        sys.exit("materials: must be a mapping of name -> {color, render}")
    for name, m in entries.items():
        where = f"materials.{name}"
        if not isinstance(m, dict) or not m or set(m) - {"color", "render"}:
            sys.exit(f"{where}: needs `color` and/or `render`, nothing else")
        c = m.get("color")
        if c is not None and not (isinstance(c, list) and len(c) == 3
                                  and all(isinstance(v, int) and 0 <= v <= 255 for v in c)):
            sys.exit(f"{where}.color: three integers 0-255, got {c!r}")
        r = m.get("render")
        if r is not None:
            if not isinstance(r, dict) or set(r) - {"recipe", "label", "args"}:
                sys.exit(f"{where}.render: keys are recipe, label, args")
            if r.get("recipe") not in RECIPES:
                sys.exit(f"{where}.render.recipe: one of {', '.join(RECIPES)}, got {r.get('recipe')!r}")
            if not isinstance(r.get("args", []), list):
                sys.exit(f"{where}.render.args: must be a list")
    return entries


def material_table(spec):
    """Library colours, then the spec's, as name -> (r, g, b). Spec entries override."""
    table = dict(LIBRARY)
    for name, m in _spec_materials(spec).items():
        if m.get("color") is not None:
            table[name] = tuple(m["color"])
    return table


def render_recipes(spec):
    """The spec's Blender recipes: name -> {recipe, label, args}."""
    return {name: {"recipe": m["render"]["recipe"], "label": m["render"].get("label", name),
                   "args": m["render"].get("args", [])}
            for name, m in _spec_materials(spec).items() if m.get("render")}


def rgb(table, name, alpha=1.0):
    r, g, b = table[name]
    return (r / 255, g / 255, b / 255, alpha)
