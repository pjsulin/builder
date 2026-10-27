"""Cameras and per-wall-face finishes, for the Blender build."""
import math

from ..geometry import rect, xy
from ..spec.ctx import Ctx, Missing
from ..spec.refs import EDGES, zval


def cameras(spec, report):
    """Named interior views: at / look_at are [east, south, z]."""
    out = {}
    for name, c in (spec.get("cameras") or {}).items():
        ctx = Ctx(spec, report, f"cameras.{name}")
        try:
            at = ctx.pt(c["at"], "at")
            look = ctx.pt(c["look_at"], "look_at")
        except Missing:
            continue
        out[name] = {"at": [*xy(at[0], at[1]), at[2]], "look_at": [*xy(look[0], look[1]), look[2]],
                     "lens": float(c.get("lens", 18)), "show": c.get("show", "before")}
    return out


def finishes(spec, report):
    """Finish lookups for realistic renders: a function giving each triangle's
    finish name (or None = unknown), and render-only ceilings per indoor room."""
    fin = spec.get("finishes") or {}
    placed = report.get("layout") or {}
    default_wall = fin.get("default_wall")   # wall faces of indoor rooms with nothing recorded

    def lookup(room, side):
        got = (fin.get(room) or {}).get(side)
        if got is None and side in EDGES and room in placed and not placed[room]["outside"]:
            return default_wall
        return got

    def room_at(e, s):
        return next((n for n, p in placed.items()
                     if p["west"] < e < p["east"] and p["north"] < s < p["south"]), None)

    def face(el, tri):
        how = el.get("finish_of")
        if how is None:
            return None
        if how != "probe":
            return lookup(*how)
        a, b, c = tri  # outward winding; x = east, y = north
        u = [b[i] - a[i] for i in range(3)]
        v = [c[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        ln = math.sqrt(sum(k * k for k in n)) or 1
        nx, ny, nz = (k / ln for k in n)
        # A wall face with no room in front of it (outside faces, door
        # reveals, wall ends and tops) is painted block too, not bare grey.
        if abs(nz) > 0.5:
            return default_wall
        side = "west" if nx > 0.7 else "east" if nx < -0.7 else \
               "south" if ny > 0.7 else "north" if ny < -0.7 else None
        cx, cy = (a[0] + b[0] + c[0]) / 3 + nx, (a[1] + b[1] + c[1]) / 3 + ny  # 1" into the room
        return lookup(room_at(cx, -cy), side) or default_wall

    # Ceilings: render-only caps so interior views aren't open to the sky. At
    # the top of the modelled joists where there are some, else the wall top.
    try:
        wall_top = zval(Ctx(spec, report, "layout"), spec["layout"]["wall_z"][1], "wall_z[1]")
    except Missing:
        return face, []
    ceilings = []
    for name, p in placed.items():
        if p["outside"]:
            continue
        cx, cy = (p["west"] + p["east"]) / 2, (p["north"] + p["south"]) / 2
        z = next((zt for e0, s0, e1, s1, zt in report.get("joist_regions", [])
                  if e0 <= cx <= e1 and s0 <= cy <= s1), wall_top)
        ceilings.append(dict(room=name, pts=rect(p["west"], p["north"], p["east"], p["south"]),
                             z=z, finish=(fin.get(name) or {}).get("ceiling")))
    return face, ceilings
