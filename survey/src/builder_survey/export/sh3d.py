"""basement.sh3d: the model as a Sweet Home 3D home."""
from ..geometry import part_mesh
from ..materials import MATERIALS
from ..units import ftin


def _png(w, h, rgba):
    """A plain w x h RGBA PNG of one colour (the catalog icon Sweet Home 3D needs)."""
    import struct
    import zlib

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + \
            struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    rows = b"".join(b"\0" + bytes(rgba) * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def _shift_z(part, dz):
    """A copy of a part moved up by dz."""
    if part["kind"] == "prism":
        out = dict(part, z=[z + dz for z in part["z"]])
        if part.get("ztop"):
            out["ztop"] = [z + dz for z in part["ztop"]]
        return out
    if part["kind"] == "mesh":
        return dict(part, verts=[(x, y, z + dz) for x, y, z in part["verts"]])
    return dict(part, a=[*part["a"][:2], part["a"][2] + dz], b=[*part["b"][:2], part["b"][2] + dz])


def write_sh3d(out, elements, floor_z=0.0, movable=()):
    """basement.sh3d: the model as a Sweet Home 3D home (cm; x = east, y = south,
    the same axes as the spec), for laying out furniture by hand.
      - full-height wall runs -> Sweet Home 3D walls (magnetism, dimensions)
      - each room -> a room with its name and area
      - everything else -> one locked piece per object (ledges, stairs,
        appliances, pipes, door / window parts, the wall above and below
        openings, raised floors). Joists are left out; demo work too.
      - pieces named in `movable` (the appliances) can be dragged and turned
      - a dropped box lands only on a raised floor or a movable piece
      - pieces have a transparent plan icon (outline only), so walls drawn
        over them stay visible
    Nothing below `floor_z` (inches; Sweet Home 3D's floor, the slab) is kept."""
    import zipfile
    from xml.sax.saxutils import quoteattr

    CM = 2.54
    els = [el for el in elements if el["phase"] != "demo" and el["base"] != "joist"]
    if floor_z:     # Sweet Home 3D's floor is z = 0: measure everything from the datum
        els = [dict(el, parts=[_shift_z(p, -floor_z) for p in el["parts"]]) for el in els]

    def group(el):
        n = el["name"]
        if n.startswith("door "):
            return " ".join(n.split()[:2])
        # Pipes stay one piece per straight run: a piece acts as its whole
        # bounding box (magnetism lifts a dropped box onto it), and a pipe
        # wrapping a room would cover the room.
        return n[: -len(el["base"]) - 1] if n.endswith(" " + el["base"]) else n

    def clamp(part):
        """Cut a part at z = 0. Only flat-bottomed prisms reach below it (slabs)."""
        if part["kind"] == "prism":
            z0, z1 = part["z"]
            if z1 <= 0:
                return None
            return dict(part, z=[max(z0, 0.0), z1])
        verts = part["verts"] if part["kind"] == "mesh" else None
        lo = min(v[2] for v in verts) if verts else min(part["a"][2], part["b"][2]) - part["r"]
        if lo < -1e-6:
            raise SystemExit(f"write_sh3d: a {part['kind']} part goes below the floor datum (sh3d_floor_z)")
        return part

    pieces, walls, rooms = {}, [], []
    for el in els:
        if el["name"] == "walls":
            spans = {}
            for part in el["parts"]:
                (x0, y0), _, (x1, y1), _ = part["pts"]
                spans.setdefault((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), []).append(part)
            top = max(p["z"][1] for p in el["parts"])
            for (x0, y0, x1, y1), parts in spans.items():
                if len(parts) == 1 and parts[0]["z"][0] <= 1e-6 and parts[0]["z"][1] >= top - 1e-6:
                    walls.append((x0, -y1, x1, -y0, top))      # east / south extents
                else:   # around a door or window: wall pieces above / below it
                    pieces.setdefault("wall at opening", []).append(
                        (el, parts, f"wall at {ftin(x0)} {ftin(-y1)}"))
            continue
        if el["name"].endswith(" floor") and el.get("label"):
            rooms.append((el["name"][:-6], el["parts"][0]["pts"]))
        parts = [p for p in (clamp(p) for p in el["parts"]) if p]
        if parts:
            pieces.setdefault(group(el), []).append((el, parts, None))

    # Wall pieces around openings: one piece per wall cell column, not one big one.
    split = {}
    for name, items in pieces.items():
        for el, parts, sub in items:
            split.setdefault(sub or name, []).append((el, parts))

    # Sweet Home 3D lifts a box dragged at elevation 0 onto the highest piece
    # whose footprint holds it (overhead pipes, the stair landing). Only the
    # raised floors and the movable pieces take things on top.
    drop_off = " dropOnTopElevation='-1'"
    files, furniture = {}, []
    for k, (name, items) in enumerate(split.items()):
        catches = name.endswith(" floor") or name in movable
        verts, faces = [], []   # OBJ: X = east, Y = up, Z = south
        for el, parts in items:
            for part in parts:
                v, t = part_mesh(part)
                base = len(verts)
                verts += [(x, z, -y) for x, y, z in v]
                faces.append((el["base"], [(a + base, b + base, c + base) for a, b, c in t]))
        xs, ys, zs = zip(*verts)   # east, up, south
        box = [min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)]
        size = [max(hi - lo, 0.05) for lo, hi in zip(box[::2], box[1::2])]  # width, height, depth
        obj = [f"mtllib model.mtl"] + [f"v {x * CM:.3f} {y * CM:.3f} {z * CM:.3f}" for x, y, z in verts]
        for mat, tris in faces:
            obj.append(f"usemtl {mat}")
            obj += [f"f {a + 1} {b + 1} {c + 1}" for a, b, c in tris]
        mats = dict.fromkeys(m for m, _ in faces)
        mtl = []
        for m in mats:
            r, g, b = MATERIALS[m]
            mtl += [f"newmtl {m}", f"Kd {r / 255:.3f} {g / 255:.3f} {b / 255:.3f}", "illum 1", ""]
        files[f"{k}/model.obj"] = "\n".join(obj) + "\n"
        files[f"{k}/model.mtl"] = "\n".join(mtl)
        furniture.append(
            f"<pieceOfFurniture name={quoteattr(name)} model='{k}/model.obj' icon='icon.png' "
            f"x='{(box[0] + box[1]) / 2 * CM:.3f}' y='{(box[4] + box[5]) / 2 * CM:.3f}' "
            f"elevation='{box[2] * CM:.3f}' width='{size[0] * CM:.3f}' depth='{size[2] * CM:.3f}' "
            f"height='{size[1] * CM:.3f}' movable='{str(name in movable).lower()}' "
            f"resizable='false'{'' if catches else drop_off}/>")

    xml = ["<?xml version='1.0'?>",
           f"<home version='7000' name='basement' wallHeight='{max(w[4] for w in walls) * CM:.3f}' "
           "basePlanLocked='true'>"]
    xml += furniture
    for i, (x0, s0, x1, s1, h) in enumerate(walls):
        if x1 - x0 >= s1 - s0:   # runs east-west
            a, b, t = (x0, (s0 + s1) / 2), (x1, (s0 + s1) / 2), s1 - s0
        else:
            a, b, t = ((x0 + x1) / 2, s0), ((x0 + x1) / 2, s1), x1 - x0
        xml.append(f"<wall id='wall{i}' xStart='{a[0] * CM:.3f}' yStart='{a[1] * CM:.3f}' "
                   f"xEnd='{b[0] * CM:.3f}' yEnd='{b[1] * CM:.3f}' height='{h * CM:.3f}' "
                   f"thickness='{t * CM:.3f}' pattern='hatchUp'/>")
    for name, pts in rooms:
        xml.append(f"<room name={quoteattr(name)} areaVisible='true' floorVisible='true' "
                   "ceilingVisible='false'>")
        xml += [f"  <point x='{x * CM:.3f}' y='{-y * CM:.3f}'/>" for x, y in pts]
        xml.append("</room>")
    xml.append("</home>")

    path = out / "basement.sh3d"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Home.xml", "\n".join(xml) + "\n")
        # Transparent: the plan paints furniture over walls, so an opaque icon
        # stretched over each floor slab hid every wall drawn on top of it.
        z.writestr("icon.png", _png(16, 16, (0, 0, 0, 0)))
        for name, text in files.items():
            z.writestr(name, text)
    return len(walls), len(furniture), len(rooms)
