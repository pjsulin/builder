"""Walls generated from the rooms: anything within `wall` of an indoor room that isn't inside a room."""
import sys

from ..elements import element
from ..geometry import prism, rect
from ..spec.ctx import Ctx, Missing


def build_walls(spec, report, out):
    for name, w in (spec.get("walls") or {}).items():
        ctx = Ctx(spec, report, f"walls.{name}")
        try:
            a = ctx.pt(w["from"], "from")
            b = ctx.pt(w["to"], "to")
            t = ctx.len(w["thickness"], "thickness")
            z0 = ctx.len(w["z"][0], "z[0]")
            z1 = ctx.len(w["z"][1], "z[1]")
        except Missing:
            continue
        grows = w["grows"]
        if a[1] == b[1]:  # runs east-west; thickness grows north or south
            if grows not in ("north", "south"):
                sys.exit(f"walls.{name}: east-west wall must grow north or south")
            lo, hi = sorted((a[0], b[0]))
            s_face = a[1]
            s_back = s_face - t if grows == "north" else s_face + t
            along_start = a[0]
            direction = 1 if b[0] >= a[0] else -1

            def piece(u0, u1, z_lo, z_hi):
                e0, e1 = sorted((along_start + direction * u0, along_start + direction * u1))
                return prism(rect(e0, s_face, e1, s_back), z_lo, z_hi)
        elif a[0] == b[0]:  # runs north-south; grows east or west
            if grows not in ("east", "west"):
                sys.exit(f"walls.{name}: north-south wall must grow east or west")
            lo, hi = sorted((a[1], b[1]))
            e_face = a[0]
            e_back = e_face + t if grows == "east" else e_face - t
            along_start = a[1]
            direction = 1 if b[1] >= a[1] else -1

            def piece(u0, u1, z_lo, z_hi):
                s0, s1 = sorted((along_start + direction * u0, along_start + direction * u1))
                return prism(rect(e_face, s0, e_back, s1), z_lo, z_hi)
        else:
            sys.exit(f"walls.{name}: only axis-aligned walls are supported")
        length = hi - lo

        # Openings (sill/height measured from opening_base, default wall bottom).
        base = z0
        if "opening_base" in w:
            try:
                base = ctx.len(w["opening_base"], "opening_base")
            except Missing:
                pass
        holes = []
        for i, o in enumerate(w.get("openings") or []):
            octx = Ctx(spec, report, f"walls.{name}.openings[{i}]")
            try:
                at = octx.len(o["at"], "at")
                width = octx.len(o["width"], "width")
                sill = octx.len(o.get("sill", 0), "sill")
                height = octx.len(o["height"], "height")
            except Missing:
                continue
            ctx.placeholder |= octx.placeholder
            holes.append((at, at + width, base + sill, base + sill + height))
        holes.sort()

        parts, u = [], 0.0
        for h0, h1, zs, zh in holes:
            if h0 > u:
                parts.append(piece(u, h0, z0, z1))
            if zs > z0:
                parts.append(piece(h0, h1, z0, zs))
            if zh < z1:
                parts.append(piece(h0, h1, zh, z1))
            u = h1
        if u < length:
            parts.append(piece(u, length, z0, z1))
        out.append(element(name, w["phase"], w.get("material", "block"), ctx, parts, kind="named_wall",
                           source=w.get("source")))
