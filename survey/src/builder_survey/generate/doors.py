"""Doors and windows: openings placed in a room's wall, and their frames, leaves and glazing."""
import math

from ..elements import element
from ..geometry import extrude, xy
from ..spec.checks import TOLERANCE, conflict
from ..spec.ctx import Blocked, Ctx, Missing
from ..spec.refs import edge_rels, edge_value, zval
from ..units import ftin


def place_doors(spec, report, placed, refs):
    """Openings in a room's wall. `room` + `side` name the wall; one edge
    along the wall places the clear opening, any others are checks."""
    doors = []
    for name, d in ((spec.get("layout") or {}).get("doors") or {}).items():
        ctx = Ctx(spec, report, f"layout.doors.{name}")
        room, side = d["room"], d["side"]
        if room not in placed:
            report["missing"].append(f"layout.doors.{name} (room `{room}` not placed)")
            continue
        p = placed[room]
        ends = ("north", "south") if side in ("east", "west") else ("west", "east")
        rels = [rel for rel in edge_rels(d) if rel[0] in ends]
        try:
            if not rels:
                ctx.len(None, ends[0])
            width = ctx.len(d["width"], "width")
            height = ctx.len(d["height"], "height")
            frame = ctx.len(d.get("frame", 0), "frame")
            depth = ctx.len(d["depth"], "depth") if "depth" in d else None
            zb = zval(ctx, d.get("bottom", p["fz"]), "bottom")
            k, v, field = rels[0]
            at = edge_value(v, ctx, field, refs)
        except Missing:
            continue
        except Blocked as b:
            report["missing"].append(f"layout.doors.{name} (not placed: waits on `{b}`)")
            continue
        lo, hi = (at, at + width) if k in ("north", "west") else (at - width, at)
        doors.append(dict(name=name, room=room, side=side, face=p[side], lo=lo, hi=hi,
                          width=width, frame=frame, zb=zb, height=height, depth=depth,
                          placeholder=ctx.placeholder, ctx=ctx, phase=d.get("phase", "existing"),
                          glass=d.get("glass"), leaf=d.get("leaf")))
        for k2, v2, f2 in rels[1:]:
            c = Ctx(spec, report, f"layout.doors.{name}")
            try:
                got = edge_value(v2, c, f2, refs)
            except Blocked as b:
                conflict(report, f"`door {name}.{k2}: {v2}` unchecked — `{b}` not placed")
                continue
            except Missing:
                continue
            want = lo if k2 in ("north", "west") else hi
            if abs(got - want) > TOLERANCE:
                conflict(report, f"`door {name}.{k2}`: opening edge at {ftin(want)}, but `{v2}` "
                         f"gives {ftin(got)} (off by {ftin(abs(got - want))})", got - want,
                         dict(kind="door", door=name, edge=k2, placed=want, got=got))
    report["doors"] = doors
    return doors


def clip_rect(poly, a0, a1, b0, b1):
    """Sutherland-Hodgman: a convex polygon [(a, b), ...] clipped to a box."""
    for axis, lim, keep_lo in ((0, a0, True), (0, a1, False), (1, b0, True), (1, b1, False)):
        out = []
        for j, p in enumerate(poly):
            q = poly[j - 1]
            pin = p[axis] >= lim if keep_lo else p[axis] <= lim
            qin = q[axis] >= lim if keep_lo else q[axis] <= lim
            if pin != qin:
                t = (lim - q[axis]) / (p[axis] - q[axis])
                out.append(tuple(q[m] + t * (p[m] - q[m]) for m in (0, 1)))
            if pin:
                out.append(p)
        poly = out
        if not poly:
            break
    return poly


def glazing(dr, report, out):
    """A window sash (`glass:`) or a door leaf (`leaf:`) in a cut opening, and a
    daylight record for the render (a sky plane behind the glass and a light
    on the room side). Built in the opening's own frame: a along the wall,
    z up, q from the room face into the wall."""
    ctx, ns = dr["ctx"], dr["side"] in ("east", "west")
    step = 1 if dr["side"] in ("east", "south") else -1
    face, lo, hi, zb = dr["face"], dr["lo"], dr["hi"], dr["zb"]
    zt = zb + dr["height"]
    cut = dr["across"][1] - dr["across"][0]

    def to3d(a, z, q):
        x = face + step * q
        return (x, a, z) if ns else (a, x, z)

    def blk(a0, a1, z0, z1, q0, q1):
        return extrude([(a0, z0), (a1, z0), (a1, z1), (a0, z1)],
                       lambda a, z, c: to3d(a, z, q0 + c), q1 - q0)

    def lites(a0, a1, z0, z1, q0, q1, cols, rows, bar):
        """Muntins splitting [a0, a1] x [z0, z1] into cols x rows, and the pane."""
        ps = [blk(a0 + (a1 - a0) * i / cols - bar / 2, a0 + (a1 - a0) * i / cols + bar / 2,
                  z0, z1, q0, q1) for i in range(1, cols)]
        ps += [blk(a0, a1, z0 + (z1 - z0) * j / rows - bar / 2, z0 + (z1 - z0) * j / rows + bar / 2,
                   q0, q1) for j in range(1, rows)]
        qm = (q0 + q1) / 2
        return ps, [blk(a0, a1, z0, z1, qm - 1 / 8, qm + 1 / 8)]

    white, glass, skies, wood = [], [], [], []
    try:
        if dr["glass"]:
            g = dr["glass"]
            sw = ctx.len(g["sash"], "glass.sash")
            sb = ctx.len(g["setback"], "glass.setback")
            mb = ctx.len(g.get("muntin", 0.75), "glass.muntin")
            q0, q1 = sb, sb + 1.5
            white += [blk(lo, lo + sw, zb, zt, q0, q1), blk(hi - sw, hi, zb, zt, q0, q1),
                      blk(lo + sw, hi - sw, zb, zb + sw, q0, q1),
                      blk(lo + sw, hi - sw, zt - sw, zt, q0, q1)]
            m, pane = lites(lo + sw, hi - sw, zb + sw, zt - sw, q0, q1, *g["lites"], mb)
            white += m
            glass += pane
            skies.append((lo + sw, hi - sw, zb + sw, zt - sw, q0, q1))
        if dr["leaf"] and dr["leaf"].get("style") == "chevron":
            # Board doors (shed): each leaf a slab of diagonal boards, mirrored
            # so they meet in a chevron (point up) at the centre line.
            lf = dr["leaf"]
            sb = ctx.len(lf["setback"], "leaf.setback")
            th = ctx.len(lf["thickness"], "leaf.thickness")
            bw = ctx.len(lf["board"], "leaf.board")
            n = int(lf.get("leaves", 2))
            gap = 1 / 4                               # groove between boards
            for i in range(n):
                l0, l1 = lo + (hi - lo) * i / n, lo + (hi - lo) * (i + 1) / n
                sgn = 1 if (l0 + l1) / 2 < (lo + hi) / 2 else -1   # rise toward the centre
                pitch = bw * math.sqrt(2)                          # board width along z
                k = -math.ceil((l1 - l0) / pitch) - 1
                while True:
                    # band between the lines z = zb + sgn*(a - l0) + k*pitch (+ pitch - gap)
                    c0, c1 = zb + k * pitch, zb + (k + 1) * pitch - gap * math.sqrt(2)
                    if c0 > zt:
                        break
                    def line(c, a):
                        return c + sgn * (a - (l0 if sgn > 0 else l1))
                    poly = [(l0, line(c0, l0)), (l1, line(c0, l1)), (l1, line(c1, l1)), (l0, line(c1, l0))]
                    poly = clip_rect(poly, l0, l1, zb, zt)
                    if len(poly) >= 3:
                        wood.append(extrude(poly, lambda a, z, c: to3d(a, z, sb + c), th))
                    k += 1
        elif dr["leaf"]:
            lf = dr["leaf"]
            sb = ctx.len(lf["setback"], "leaf.setback")
            th = ctx.len(lf["thickness"], "leaf.thickness")
            sw = ctx.len(lf["stile"], "leaf.stile")
            br = ctx.len(lf["rail"], "leaf.rail")
            gb = zb + ctx.len(lf["glass"]["bottom"], "leaf.glass.bottom")
            gt = zb + ctx.len(lf["glass"]["top"], "leaf.glass.top")
            n = int(lf.get("leaves", 1))          # a pair (french doors) splits the opening
            q0, q1 = sb, sb + th
            for i in range(n):
                l0, l1 = lo + (hi - lo) * i / n, lo + (hi - lo) * (i + 1) / n
                white += [blk(l0, l0 + sw, zb, zt, q0, q1), blk(l1 - sw, l1, zb, zt, q0, q1),
                          blk(l0 + sw, l1 - sw, zb, zb + br, q0, q1),      # bottom rail
                          blk(l0 + sw, l1 - sw, gt, zt, q0, q1)]           # top rail
                if gb > zb + br + sw:                 # panels below the glass
                    mid = (l0 + l1) / 2
                    white += [blk(l0 + sw, l1 - sw, gb - sw, gb, q0, q1),  # lock rail
                              blk(mid - sw / 2, mid + sw / 2, zb + br, gb - sw, q0, q1)]
                    for a0, a1 in ((l0 + sw, mid - sw / 2), (mid + sw / 2, l1 - sw)):
                        white.append(blk(a0, a1, zb + br, gb - sw, q0 + th / 3, q1 - th / 3))
                g0 = max(gb, zb + br)
                m, pane = lites(l0 + sw, l1 - sw, g0, gt, q0, q1, *lf["lites"], 0.75)
                white += m
                glass += pane
                skies.append((l0 + sw, l1 - sw, g0, gt, q0, q1))
            if "casing" in lf:                    # flat trim on the room face, over the frame
                cw = ctx.len(lf["casing"], "leaf.casing")
                fr, ct = dr["frame"], 0.75
                white += [blk(lo - fr - cw, lo, zb, zt + fr + cw, -ct, 0),
                          blk(hi, hi + fr + cw, zb, zt + fr + cw, -ct, 0),
                          blk(lo, hi, zt, zt + fr + cw, -ct, 0)]
    except Missing:
        return
    tag = type("C", (), {"placeholder": dr["placeholder"] or ctx.placeholder})()
    for mat, ps in (("white_paint", white), ("glass", glass), ("wood", wood)):
        if ps:
            out.append(element(f"door {dr['name']} {mat}", dr["phase"], mat, tag, ps))
    for a0, a1, z0, z1, q0, q1 in skies:
        def sk(a, z, q):
            e, s, zz = to3d(a, z, q)
            return [*xy(e, s), zz]
        qs = min(q1 + 2, cut + 1)            # sky: just behind the glass
        report.setdefault("daylight", []).append({
            "into_room": [-step, 0, 0] if ns else [0, step, 0],   # SketchUp x east, y north
            "sky": [sk(a0, z0, qs), sk(a1, z0, qs), sk(a1, z1, qs), sk(a0, z1, qs)],
            "light": [sk(a0, z0, q0 - 0.5), sk(a1, z0, q0 - 0.5), sk(a1, z1, q0 - 0.5),
                      sk(a0, z1, q0 - 0.5)]})
