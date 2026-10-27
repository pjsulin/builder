"""Build the basement in Blender from out/mesh.json (written by survey build).

Run headless:   uv run survey render --project DIR -- [options]
  (wraps  blender -b -P blender_build.py -- --project DIR [options])
  (no options)             build and save basement.blend only; no renders
  --render NAME ...        render: before, after, a spec camera name, or all
  --look E,S,Z E,S,Z       render one view from / toward [east, south, z] in
                           inches, to out/view_check.png
  --quick                  low samples and half size (for checking geometry)
  --cpu                    render on the CPU (default: the GPU through Metal)
  --check                  flat check colours (orange = ~ values) instead of
                           the realistic finishes
  --plan NAME              use out/plans/NAME/ (after survey build --plan NAME)
Outputs (DIR/model/out/, or DIR/model/out/plans/NAME/):
  basement.blend       open in Blender; collections Existing / Demo / Proposed
  render_before.png    Existing + Demo
  render_after.png     Existing + Proposed
  view_<name>.png      spec cameras; view_check.png for --look

Re-run after every survey build; it starts from an empty scene each time.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = None  # set in main() from --project
INCH = 0.0254  # spec is in inches, Blender works in meters

SCENES = {"before": ("existing", "demo"), "after": ("existing", "proposed")}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "IMPERIAL"
    scene.unit_settings.length_unit = "FEET"
    return scene


def make_materials(spec):
    """Flat check materials: one colour per spec material, orange = ~ values."""
    mats = {}
    for name, (r, g, b) in spec["materials"].items():
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (r / 255, g / 255, b / 255, 1)
        bsdf.inputs["Roughness"].default_value = 0.8
        m.diffuse_color = (r / 255, g / 255, b / 255, 1)  # viewport solid mode
        mats[name] = m
    return mats


# ── Realistic materials (procedural, nothing to download) ──────────────────
# Keyed by finish name (spec `finishes:`) or spec material. Colours are from
# the photos in ../photos/. A face with no recorded finish uses its spec
# material: bare grey block for walls, plain concrete for floors.

def _nodes(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    return m, nt, bsdf, coord


def _ramp(nt, fac, c0, c1, lo=0.3, hi=0.7):
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = lo, hi
    ramp.color_ramp.elements[0].color = (*c0, 1)
    ramp.color_ramp.elements[1].color = (*c1, 1)
    nt.links.new(fac, ramp.inputs["Fac"])
    return ramp.outputs["Color"]


def _noise(nt, coord, scale, detail=6.0, rough=0.6):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    nt.links.new(coord.outputs["Object"], n.inputs["Vector"])
    return n.outputs["Fac"]


def _bump(nt, bsdf, height, strength, distance=0.002):
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = strength
    b.inputs["Distance"].default_value = distance
    nt.links.new(height, b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])


def concrete(name, c0, c1, rough, bump):
    """Troweled or poured concrete: soft blotches, a fine grainy surface."""
    m, nt, bsdf, coord = _nodes(name)
    nt.links.new(_ramp(nt, _noise(nt, coord, 2.5, 10, 0.7), c0, c1, 0.38, 0.62),
                 bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    # trowel marks: broad low waves plus a fine grain
    trowel = nt.nodes.new("ShaderNodeMath")
    trowel.operation = "MULTIPLY_ADD"
    nt.links.new(_noise(nt, coord, 6, 4, 0.5), trowel.inputs[0])
    trowel.inputs[1].default_value = 3.0
    nt.links.new(_noise(nt, coord, 90, 3, 0.7), trowel.inputs[2])
    _bump(nt, bsdf, trowel.outputs["Value"], bump)
    return m


def block(name, face, mortar, rough, bump):
    """Concrete block, 16" x 8" coursing, on axis-aligned walls: the pattern
    runs along the wall (x + y) and up (z)."""
    m, nt, bsdf, coord = _nodes(name)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    nt.links.new(sep.outputs["X"], add.inputs[0])
    nt.links.new(sep.outputs["Y"], add.inputs[1])
    uv = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(add.outputs["Value"], uv.inputs["X"])
    nt.links.new(sep.outputs["Z"], uv.inputs["Y"])
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Brick Width"].default_value = 16 * INCH
    brick.inputs["Row Height"].default_value = 8 * INCH
    brick.inputs["Mortar Size"].default_value = 0.006
    brick.inputs["Mortar Smooth"].default_value = 0.3
    brick.inputs["Color1"].default_value = (*face, 1)
    brick.inputs["Color2"].default_value = (*[c * 0.96 for c in face], 1)
    brick.inputs["Mortar"].default_value = (*mortar, 1)
    nt.links.new(uv.outputs["Vector"], brick.inputs["Vector"])
    # Blotchy wear over the block faces
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(brick.outputs["Color"], mix.inputs["A"])
    nt.links.new(_ramp(nt, _noise(nt, coord, 2.0, 6, 0.6), (0.9, 0.9, 0.88), (1, 1, 1)),
                 mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(brick.outputs["Fac"], inv.inputs[1])   # mortar sits back
    grain = nt.nodes.new("ShaderNodeMath")
    grain.operation = "MULTIPLY_ADD"
    nt.links.new(_noise(nt, coord, 80, 3, 0.7), grain.inputs[0])
    grain.inputs[1].default_value = 0.15
    nt.links.new(inv.outputs["Value"], grain.inputs[2])
    _bump(nt, bsdf, grain.outputs["Value"], bump)
    return m


def painted_block(name):
    """White paint over block, as in the photos: the 16 x 8 coursing shows
    through, the paint is blotchy and greyed, and there's grime and water
    staining low on the wall that fades out by ~3' up."""
    m = block(name, (0.92, 0.92, 0.90), (0.84, 0.84, 0.82), 0.75, 0.3)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeTexCoord")
    base = bsdf.inputs["Base Color"].links[0].from_socket
    # Grime: blotches everywhere, much stronger near the floor (world height).
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])
    low = nt.nodes.new("ShaderNodeMapRange")       # 1 at the floor -> 0 at ~3' up
    low.inputs["From Min"].default_value = 0.1
    low.inputs["From Max"].default_value = 0.8
    low.inputs["To Min"].default_value = 1.0
    low.inputs["To Max"].default_value = 0.0
    nt.links.new(sep.outputs["Z"], low.inputs["Value"])
    streak = nt.nodes.new("ShaderNodeTexNoise")     # stretched up: drips and wicking
    streak.inputs["Scale"].default_value = 3.0
    streak.inputs["Detail"].default_value = 8.0
    stretch = nt.nodes.new("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (2.5, 2.5, 0.6)
    nt.links.new(coord.outputs["Object"], stretch.inputs["Vector"])
    nt.links.new(stretch.outputs["Vector"], streak.inputs["Vector"])
    dirt = nt.nodes.new("ShaderNodeMath")
    dirt.operation = "MULTIPLY_ADD"                 # streaks x low + overall blotch
    nt.links.new(streak.outputs["Fac"], dirt.inputs[0])
    nt.links.new(low.outputs["Result"], dirt.inputs[1])
    blot = nt.nodes.new("ShaderNodeMath")
    blot.operation = "MULTIPLY"
    nt.links.new(_noise(nt, coord, 1.2, 6, 0.65), blot.inputs[0])
    blot.inputs[1].default_value = 0.2
    nt.links.new(blot.outputs["Value"], dirt.inputs[2])
    amount = nt.nodes.new("ShaderNodeMapRange")
    amount.inputs["From Min"].default_value = 0.4
    amount.inputs["From Max"].default_value = 0.8
    amount.inputs["To Max"].default_value = 0.45
    nt.links.new(dirt.outputs["Value"], amount.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    nt.links.new(amount.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(base, mix.inputs["A"])
    mix.inputs["B"].default_value = (0.38, 0.31, 0.21, 1)    # brown grime
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return m


def worn_paint_floor(name):
    """Blue-grey floor paint scuffed through, as in the storage photo: bare
    tan concrete in flaky patches (heavier in large areas), light dusty grey
    haze between, small white flecks."""
    m = concrete(name, (0.08, 0.10, 0.13), (0.12, 0.14, 0.17), 0.6, 0.05)  # the paint
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeTexCoord")
    paint = bsdf.inputs["Base Color"].links[0].from_socket

    def over(base, fac, color):
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(fac, mix.inputs["Factor"])
        nt.links.new(base, mix.inputs["A"])
        mix.inputs["B"].default_value = (*color, 1)
        return mix.outputs["Result"]

    def where(large, fine, lo, hi):
        """Flaky mask: large regions (wear zones) x fine edges (chips)."""
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "MULTIPLY_ADD"
        nt.links.new(_noise(nt, coord, fine, 8, 0.75), add.inputs[0])
        add.inputs[1].default_value = 0.5
        nt.links.new(_noise(nt, coord, large, 4, 0.5), add.inputs[2])
        r = nt.nodes.new("ShaderNodeMapRange")
        r.inputs["From Min"].default_value = lo
        r.inputs["From Max"].default_value = hi
        nt.links.new(add.outputs["Value"], r.inputs["Value"])
        return r.outputs["Result"]

    haze = over(paint, where(0.8, 6, 0.62, 0.90), (0.30, 0.30, 0.28))      # dusty grey
    bare = over(haze, where(0.6, 20, 0.78, 0.81), (0.42, 0.30, 0.18))      # tan concrete
    flecks = over(bare, where(200, 120, 0.95, 0.96), (0.70, 0.70, 0.68))   # white flecks
    nt.links.new(flecks, bsdf.inputs["Base Color"])
    return m


def pavers(name):
    """Grey concrete pavers in a mixed pattern (patio photo): two brick
    courses of different sizes laid over each other give rectangles and
    squares; dark joints, per-paver shade, weathered blotches."""
    m, nt, bsdf, coord = _nodes(name)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    uv = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs["X"], uv.inputs["X"])
    nt.links.new(sep.outputs["Y"], uv.inputs["Y"])
    courses = []
    for w, h, off in ((12, 6, 0.5), (18, 12, 0.33)):
        b = nt.nodes.new("ShaderNodeTexBrick")
        b.offset = off
        b.inputs["Scale"].default_value = 1.0
        b.inputs["Brick Width"].default_value = w * INCH
        b.inputs["Row Height"].default_value = h * INCH
        b.inputs["Mortar Size"].default_value = 0.004
        b.inputs["Color1"].default_value = (0.30, 0.30, 0.30, 1)
        b.inputs["Color2"].default_value = (0.20, 0.20, 0.205, 1)
        b.inputs["Mortar"].default_value = (0.04, 0.04, 0.035, 1)
        nt.links.new(uv.outputs["Vector"], b.inputs["Vector"])
        courses.append(b)
    # the larger course in some zones, the smaller in others
    zone = _ramp(nt, _noise(nt, coord, 1.0, 2, 0.5), (0, 0, 0), (1, 1, 1), 0.48, 0.52)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(zone, mix.inputs["Factor"])
    nt.links.new(courses[0].outputs["Color"], mix.inputs["A"])
    nt.links.new(courses[1].outputs["Color"], mix.inputs["B"])
    wear = nt.nodes.new("ShaderNodeMix")
    wear.data_type = "RGBA"
    wear.blend_type = "MULTIPLY"
    wear.inputs["Factor"].default_value = 1.0
    nt.links.new(mix.outputs["Result"], wear.inputs["A"])
    nt.links.new(_ramp(nt, _noise(nt, coord, 4, 6, 0.6), (0.8, 0.8, 0.8), (1.25, 1.25, 1.22)),
                 wear.inputs["B"])
    nt.links.new(wear.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(courses[0].outputs["Fac"], inv.inputs[1])
    _bump(nt, bsdf, inv.outputs["Value"], 0.3)
    return m


def plain(name, color, rough, metallic=0.0):
    m, nt, bsdf, coord = _nodes(name)
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    return m


def wood(name, c0, c1):
    m, nt, bsdf, coord = _nodes(name)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 1.5
    wave.inputs["Distortion"].default_value = 1.5
    wave.inputs["Detail"].default_value = 2
    nt.links.new(coord.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(_ramp(nt, wave.outputs["Fac"], c0, c1, 0.2, 0.8), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.65
    return m


def pine(name):
    """Light tongue-and-groove pine: vertical boards ~4 1/2" wide with dark
    grooves, a little grain and scattered knots."""
    m, nt, bsdf, coord = _nodes(name)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    nt.links.new(sep.outputs["X"], add.inputs[0])
    nt.links.new(sep.outputs["Y"], add.inputs[1])
    uv = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(add.outputs["Value"], uv.inputs["X"])
    lift = nt.nodes.new("ShaderNodeMath")              # keep the row break out of sight
    lift.inputs[1].default_value = 10.0
    nt.links.new(sep.outputs["Z"], lift.inputs[0])
    nt.links.new(lift.outputs["Value"], uv.inputs["Y"])
    boards = nt.nodes.new("ShaderNodeTexBrick")       # one tall "brick" per board
    boards.offset = 0.0
    boards.inputs["Scale"].default_value = 1.0
    boards.inputs["Brick Width"].default_value = 4.5 * INCH
    boards.inputs["Row Height"].default_value = 20.0
    boards.inputs["Mortar Size"].default_value = 0.002
    boards.inputs["Color1"].default_value = (0.86, 0.72, 0.52, 1)
    boards.inputs["Color2"].default_value = (0.82, 0.68, 0.48, 1)
    boards.inputs["Mortar"].default_value = (0.45, 0.33, 0.20, 1)
    nt.links.new(uv.outputs["Vector"], boards.inputs["Vector"])
    knots = _ramp(nt, _noise(nt, coord, 9, 2, 0.5), (1, 1, 1), (0.55, 0.40, 0.25), 0.72, 0.78)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(boards.outputs["Color"], mix.inputs["A"])
    nt.links.new(knots, mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(boards.outputs["Fac"], inv.inputs[1])
    _bump(nt, bsdf, inv.outputs["Value"], 0.4)
    return m


def glass(name):
    m, nt, bsdf, coord = _nodes(name)
    bsdf.inputs["Base Color"].default_value = (0.92, 0.88, 0.80, 1)   # bronze tint
    bsdf.inputs["Roughness"].default_value = 0.0
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["IOR"].default_value = 1.5
    return m


def glow(name, color, strength):
    m, nt, bsdf, coord = _nodes(name)
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = strength
    return m


def make_real_materials():
    real = {
        # finishes (spec `finishes:`)
        "troweled concrete": concrete("troweled concrete", (0.13, 0.13, 0.125), (0.22, 0.22, 0.21), 0.8, 0.12),
        "smooth concrete": concrete("smooth concrete", (0.12, 0.12, 0.115), (0.19, 0.19, 0.18), 0.45, 0.03),
        "painted block": painted_block("painted block"),
        "worn grey paint": worn_paint_floor("worn grey floor paint"),
        "stucco": concrete("stucco", (0.42, 0.40, 0.36), (0.55, 0.52, 0.47), 0.9, 0.35),
        "pavers": pavers("pavers"),
        "light grey floor": plain("light grey floor", (0.30, 0.30, 0.29), 0.8),   # shed
        "dark grey floor": plain("dark grey floor", (0.08, 0.08, 0.08), 0.8),     # office
        "landscape_block": concrete("landscape block", (0.30, 0.27, 0.22), (0.40, 0.37, 0.31), 0.9, 0.4),
        "grass": concrete("grass", (0.05, 0.10, 0.03), (0.10, 0.18, 0.05), 0.95, 0.5),
        "flagstone": concrete("flagstone", (0.22, 0.20, 0.17), (0.34, 0.31, 0.27), 0.85, 0.6),
        "drywall": plain("drywall", (0.87, 0.84, 0.72), 0.9),    # off-white toward yellow
        # spec materials, where no finish is recorded
        "block": block("block (bare)", (0.50, 0.50, 0.48), (0.42, 0.42, 0.40), 0.85, 0.35),
        "slab": concrete("concrete slab", (0.14, 0.14, 0.135), (0.23, 0.23, 0.22), 0.7, 0.05),
        "framed": plain("framed", (0.85, 0.84, 0.80), 0.9),
        "wood": wood("wood", (0.42, 0.28, 0.16), (0.50, 0.35, 0.21)),
        "object": plain("equipment", (0.78, 0.78, 0.76), 0.4),
        "pipe": plain("pipe", (0.12, 0.12, 0.12), 0.5, 0.6),
        "steel": plain("steel", (0.18, 0.18, 0.19), 0.45, 0.8),
        "copper": plain("copper", (0.72, 0.42, 0.24), 0.35, 1.0),
        "pvc": plain("pvc", (0.88, 0.88, 0.86), 0.35),
        "cast_iron": plain("cast iron", (0.08, 0.07, 0.07), 0.6, 0.5),
        "proposed": plain("proposed", (0.60, 0.75, 0.90), 0.8),
        "sauna_wood": pine("sauna pine"),
        "glass": glass("glass"),
        "glow": glow("LED strip", (1.0, 0.62, 0.30), 60.0),
        "white_paint": plain("white paint", (0.80, 0.80, 0.77), 0.45),
        "rubber": plain("rubber", (0.025, 0.025, 0.025), 0.7),
        "iron": plain("black iron", (0.02, 0.02, 0.02), 0.5, 0.6),
        "walnut": wood("walnut", (0.035, 0.018, 0.009), (0.07, 0.036, 0.018)),
        "pine": wood("clear pine", (0.78, 0.56, 0.33), (0.86, 0.66, 0.42)),
        "enamel": plain("appliance enamel", (0.86, 0.86, 0.84), 0.25),
        "appliance_grey": plain("appliance grey", (0.35, 0.37, 0.40), 0.35),
        "boiler_green": plain("boiler green", (0.05, 0.20, 0.10), 0.35),
        "wh_jacket": plain("water heater jacket", (0.62, 0.62, 0.60), 0.35, 0.3),
        "placeholder": plain("placeholder", (1.0, 0.55, 0.0), 0.8),
        # render-only ceiling where none is recorded: the dark underside of
        # the old floor framing (the photos show exposed joists)
        "ceiling": concrete("exposed framing", (0.07, 0.045, 0.03), (0.15, 0.10, 0.06), 0.8, 0.1),
    }
    real["joist"] = real["ceiling"]   # the joists are the same dark brown (Patrick)
    return real


def make_object(el, mats, coll, real=None):
    """`real` = realistic materials: each triangle takes its finish, or the
    element's real spec material. Without it, one flat check material."""
    mesh = bpy.data.meshes.new(el["name"])
    mesh.from_pydata([tuple(c * INCH for c in v) for v in el["verts"]], [], el["tris"])
    if real:
        keys = [f if f in real else el["base"] for f in el.get("finish") or [None] * len(el["tris"])]
        for f in keys:
            if f not in real:
                sys.exit(f"{el['name']}: no realistic material for {f!r}")
        slots = list(dict.fromkeys(keys))
        for poly, k in zip(mesh.polygons, keys):
            poly.material_index = slots.index(k)
    # Merge the triangles back into clean flat faces for editing.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=bm.verts, edges=bm.edges,
                             delimit={"MATERIAL"})
    # Origin at the object's own center (not the spec origin) so framing,
    # rotating and orbit-around-selection behave.
    center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    bmesh.ops.translate(bm, vec=-center, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    for m in ([real[k] for k in slots] if real else [mats[el["material"]]]):
        mesh.materials.append(m)
    obj = bpy.data.objects.new(el["name"], mesh)
    obj.location = center
    # Solid viewport mode shows the check colours (orange = ~ values) even when
    # the materials are realistic; Material Preview / renders show the finishes.
    obj.color = mats[el["material"]].diffuse_color
    coll.objects.link(obj)
    return obj


def add_ceilings(spec, real, scene):
    """Render-only ceilings (spec rooms have none) and one soft ceiling light
    per room. Hidden in the viewport so the rooms stay open from above."""
    coll = bpy.data.collections.new("Ceilings & room lights (render)")
    scene.collection.children.link(coll)
    for c in spec.get("ceilings", []):
        mesh = bpy.data.meshes.new(f"{c['room']} ceiling")
        z = c["z"] * INCH
        pts = [(x * INCH, y * INCH, z) for x, y in c["pts"]]
        mesh.from_pydata(pts, [], [list(range(len(pts)))[::-1]])   # faces down
        mesh.materials.append(real[c["finish"]] if c["finish"] in real else real["ceiling"])
        obj = bpy.data.objects.new(f"{c['room']} ceiling", mesh)
        coll.objects.link(obj)
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        w, d = max(xs) - min(xs), max(ys) - min(ys)
        light = bpy.data.lights.new(f"{c['room']} light", "AREA")
        light.shape = "RECTANGLE"
        light.size, light.size_y = w * 0.5, d * 0.5
        light.energy = 3.5 * w * d          # watts per m² of floor
        light.color = (1.0, 0.95, 0.88)
        lo = bpy.data.objects.new(f"{c['room']} light", light)
        lo.location = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, z - 2 * INCH)
        coll.objects.link(lo)
    add_daylight(spec, coll)
    bpy.context.view_layer.layer_collection.children[coll.name].hide_viewport = True
    return coll


def add_daylight(spec, coll):
    """Each glazed opening: a bright sky plane just behind the glass (what you
    see through it) and an area light on the room side of the sash (what lights
    the room; Cycles' shadow rays don't pass through the glass)."""
    sky = glow("daylight sky", (0.85, 0.92, 1.0), 4.0)
    for i, d in enumerate(spec.get("daylight", [])):
        pts = [Vector(p) * INCH for p in d["sky"]]
        mesh = bpy.data.meshes.new(f"window sky {i}")
        mesh.from_pydata(pts, [], [[0, 1, 2, 3]])
        mesh.materials.append(sky)
        obj = bpy.data.objects.new(f"window sky {i}", mesh)
        obj.visible_diffuse = False          # seen, but the light below does the lighting
        coll.objects.link(obj)
        lp = [Vector(p) * INCH for p in d["light"]]
        w, h = (lp[1] - lp[0]).length, (lp[3] - lp[0]).length
        light = bpy.data.lights.new(f"window light {i}", "AREA")
        light.shape = "RECTANGLE"
        light.size, light.size_y = w, h
        light.energy = 400 * w * h           # watts per m² of glass
        light.color = (0.90, 0.95, 1.0)
        lo = bpy.data.objects.new(f"window light {i}", light)
        lo.location = sum(lp, Vector()) / 4
        into = Vector(d["into_room"])
        # An area light shines along its local -Z; local X runs along the opening.
        x = (lp[1] - lp[0]).normalized()
        z = -into
        y = z.cross(x)
        lo.matrix_world = Matrix.Translation(lo.location) @ Matrix((
            (x.x, y.x, z.x, 0), (x.y, y.y, z.y, 0), (x.z, y.z, z.z, 0), (0, 0, 0, 1)))
        lo.visible_camera = False
        coll.objects.link(lo)


def bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in objs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def setup_view(scene, objs):
    bpy.context.view_layer.update()  # apply object locations to matrix_world
    lo, hi = bounds(objs)
    center, size = (lo + hi) / 2, (hi - lo).length

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    cam.data.lens = 28
    scene.collection.objects.link(cam)
    cam.location = center + Vector((0.9, -1.3, 1.1)).normalized() * size * 1.3
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.0
    sun.data.angle = 0.2
    sun.rotation_euler = (0.8, 0.2, 0.6)
    scene.collection.objects.link(sun)

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.85, 0.88, 0.92, 1)
    bg.inputs["Strength"].default_value = 0.7
    scene.world = world

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1000

    # Open with every 3D viewport framed on the model, looking from the overview
    # camera's direction, so nobody has to move the model to find it.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.clip_end = max(space.clip_end, size * 10)
            r3d = space.region_3d
            r3d.view_perspective = "PERSP"
            r3d.view_location = center
            r3d.view_rotation = cam.rotation_euler.to_quaternion()
            r3d.view_distance = size * 0.9
            space.shading.color_type = "OBJECT"   # solid mode: check colours


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="blender_build.py")
    ap.add_argument("--render", nargs="+", default=[])
    ap.add_argument("--look", nargs=2, metavar=("AT", "LOOK_AT"))
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--cpu", action="store_true")
    ap.add_argument("--project", required=True, type=Path, help="project directory (set by `survey render`)")
    ap.add_argument("--plan", help="read and write out/plans/PLAN/ (survey build --plan PLAN first)")
    return ap.parse_args(argv)


def use_device(scene, cpu):
    """Cycles on the Mac's GPU (Metal), or the CPU with --cpu. The choice is
    saved in the .blend's scene; the GPU setting itself is per install."""
    if cpu:
        scene.cycles.device = "CPU"
        return
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    gpus = [d for d in prefs.devices if d.type == "METAL"]
    if not gpus:
        sys.exit("No Metal GPU found for Cycles; run with --cpu")
    for d in prefs.devices:
        d.use = d.type == "METAL"
    scene.cycles.device = "GPU"
    print("Rendering on", ", ".join(d.name for d in gpus))


def render(scene, path):
    t = time.time()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path.name} in {time.time() - t:.1f} s")


def add_camera(scene, name, at, look_at, lens):
    cam = bpy.data.objects.new(name, bpy.data.cameras.new(name))
    cam.data.lens = lens
    scene.collection.objects.link(cam)
    cam.location = Vector(at) * INCH
    cam.rotation_euler = (Vector(look_at) * INCH - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def main():
    global OUT
    opt = args()
    OUT = opt.project / "model" / "out"
    if opt.plan:
        OUT = OUT / "plans" / opt.plan
        if not (OUT / "mesh.json").exists():
            sys.exit(f"{OUT / 'mesh.json'} not found: run  uv run survey build --project {opt.project} --plan {opt.plan}")
    t0 = time.time()
    spec = json.loads((OUT / "mesh.json").read_text())
    scene = reset()
    mats = make_materials(spec)
    real = None if opt.check else make_real_materials()
    use_device(scene, opt.cpu)
    colls = {}
    for phase in ("existing", "demo", "proposed"):
        colls[phase] = bpy.data.collections.new(phase.capitalize())
        scene.collection.children.link(colls[phase])
    objs = [make_object(el, mats, colls[el["phase"]], real) for el in spec["elements"]]
    setup_view(scene, objs)
    scene.view_settings.view_transform = "AgX"
    ceilings = add_ceilings(spec, real, scene) if real else None
    sun, bg = bpy.data.objects["Sun"], scene.world.node_tree.nodes["Background"]

    def interior(on):
        """Interior views: ceilings and room lights on, sun and sky off.
        Overviews look in from above, so no ceilings."""
        if ceilings is None:
            return
        ceilings.hide_render = not on
        sun.hide_render = on
        bg.inputs["Strength"].default_value = 0.02 if on else 0.7
    if opt.quick:
        scene.cycles.samples = 16
        scene.render.resolution_percentage = 50
    print(f"Built scene in {time.time() - t0:.1f} s")

    cams = spec.get("cameras", {})
    want = set(opt.render)
    if "all" in want:
        want = set(SCENES) | set(cams)
    unknown = want - set(SCENES) - set(cams)
    if unknown:
        sys.exit(f"--render: unknown view(s) {sorted(unknown)}; "
                 f"choose from {sorted(set(SCENES) | set(cams))} or all")

    interior(False)
    for name, phases in SCENES.items():
        if name in want:
            for phase, coll in colls.items():
                coll.hide_render = phase not in phases
            render(scene, OUT / f"render_{name}.png")

    # Named interior views from spec.yaml `cameras:` (existing conditions).
    # The cameras are always added to the .blend; they render only on request.
    overview = scene.camera
    interior(True)
    for name, c in cams.items():
        scene.camera = add_camera(scene, name, c["at"], c["look_at"], c["lens"])
        if name in want:
            if c["show"] not in SCENES:
                sys.exit(f"cameras.{name}.show: {c['show']!r} isn't one of {sorted(SCENES)}")
            for phase, coll in colls.items():
                coll.hide_render = phase not in SCENES[c["show"]]
            render(scene, OUT / f"view_{name}.png")
    for phase, coll in colls.items():
        coll.hide_render = phase not in SCENES["before"]
    if opt.look:
        at, look = ([float(v) for v in s.split(",")] for s in opt.look)
        scene.camera = add_camera(scene, "check", [at[0], -at[1], at[2]],
                                  [look[0], -look[1], look[2]], 16)
        render(scene, OUT / "view_check.png")
        bpy.data.objects.remove(scene.camera)
    scene.camera = overview
    interior(False)

    for coll in colls.values():
        coll.hide_render = False
    # Cameras and the sun go in their own collection, hidden in the viewport
    # (eye icon) so they don't clutter the rooms; renders still use them.
    rig = bpy.data.collections.new("Cameras & lights")
    scene.collection.children.link(rig)
    for o in [o for o in scene.collection.objects if o.type in ("CAMERA", "LIGHT")]:
        scene.collection.objects.unlink(o)
        rig.objects.link(o)
    bpy.context.view_layer.layer_collection.children[rig.name].hide_viewport = True
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "basement.blend"))
    print(f"Built {len(objs)} objects; saved basement.blend. Total {time.time() - t0:.1f} s")


main()
