"""Fixture type `stairs`: solid or open (detailed) flights."""
import sys

from ...geometry import extrude, prism, rect
from ...spec.refs import zval


def stair_parts(p, up, risers, zb, rise):
    """Solid steps across the footprint, climbing toward `up`. The top riser
    lands on whatever comes next, so there are risers - 1 treads."""
    treads = risers - 1
    r = rise / risers
    ew = up in ("east", "west")
    lo, hi = (p["west"], p["east"]) if ew else (p["north"], p["south"])
    d = (hi - lo) / treads
    parts = []
    for i in range(treads):
        a, b = (lo + i * d, lo + (i + 1) * d) if up in ("east", "south") else \
               (hi - (i + 1) * d, hi - i * d)
        box = (a, p["north"], b, p["south"]) if ew else (p["west"], a, p["east"], b)
        parts.append(prism(rect(*box), zb, zb + (i + 1) * r))
    return parts


def stair_detail(ctx, p, f, zb, rise):
    """Open stairs built from boards (Patrick: painted white, open underneath,
    spindles on both sides): treads, risers between two cut stringers, rubber
    tread covers, and on each of `rails.sides` a guard of spindles between a
    bottom rail (along the tread tops) and a top rail (parallel to the nosings).
    `detail.material` sets the boards' material (default white_paint).
    Returns {material: parts}."""
    dt, risers = f["detail"], int(f["risers"])
    treads, r = risers - 1, rise / risers
    ew, fwd = f["up"] in ("east", "west"), f["up"] in ("east", "south")
    lo, hi = (p["west"], p["east"]) if ew else (p["north"], p["south"])
    a0, a1 = (p["north"], p["south"]) if ew else (p["west"], p["east"])
    run, width = hi - lo, a1 - a0
    d = run / treads

    def solid(profile, w0, w1):
        """profile in (u = along from the bottom riser, z), from across w0 to w1
        (across from the north / west edge)."""
        def to3d(u, z, c):
            along, w = (lo + u if fwd else hi - u), a0 + w0 + c
            return (along, w, z) if ew else (w, along, z)
        return extrude(profile, to3d, w1 - w0)

    def blk(u0, u1, z0, z1, w0, w1):
        return solid([(u0, z0), (u1, z0), (u1, z1), (u0, z1)], w0, w1)

    t = ctx.len(dt["tread"], "detail.tread")
    rt = ctx.len(dt["riser"], "detail.riser")
    st = ctx.len(dt["stringer"], "detail.stringer")
    throat = ctx.len(dt["throat"], "detail.throat")
    white, black = [], []
    for k in range(treads):
        top = zb + (k + 1) * r
        white.append(blk(k * d, (k + 1) * d, top - t, top, 0, width))
        white.append(blk(k * d, k * d + rt, zb if k == 0 else zb + k * r - t, top - t,
                         st, width - st))
    # Cut stringers: notched under each tread, a straight bottom edge `throat`
    # below the notches; they stop against the landing.
    prof = [(0, zb)]
    for k in range(treads):
        prof += [(k * d, zb + (k + 1) * r - t), ((k + 1) * d, zb + (k + 1) * r - t)]
    prof += [(run, zb + treads * r - t - throat), ((t + throat) * d / r, zb)]
    white += [solid(prof, 0, st), solid(prof, width - st, width)]

    if "covers" in dt:                       # black rubber, centred, from the nosing back
        c = dt["covers"]
        cw = ctx.len(c["width"], "detail.covers.width")
        cd = ctx.len(c["depth"], "detail.covers.depth")
        ct = ctx.len(c["thickness"], "detail.covers.thickness")
        for k in range(treads):
            top = zb + (k + 1) * r
            black.append(blk(k * d, k * d + cd, top, top + ct, (width - cw) / 2, (width + cw) / 2))

    if "rails" in dt:
        g = dt["rails"]
        bw = ctx.len(g["width"], "detail.rails.width")
        height = ctx.len(g["height"], "detail.rails.height")
        sw = ctx.len(g["spindle"], "detail.rails.spindle")
        sp = ctx.len(g["spacing"], "detail.rails.spacing")
        rh = ctx.len(g["rail"], "detail.rails.rail")
        low = "north" if ew else "west"
        def L(u):                            # through the tread tops at their backs
            return zb + u * r / d
        def H(u):                            # top rail's underside
            return zb + r + u * r / d + height - rh
        level = {s: zval(ctx, v, f"detail.rails.level_top.{s}")
                 for s, v in g.get("level_top", {}).items()}
        for side in g["sides"]:
            if side not in ((("north", "south") if ew else ("west", "east"))):
                sys.exit(f"stairs going {f['up']}: rails can't be on the {side} side")
            w0, w1 = (-bw, 0) if side == low else (width, width + bw)
            # level_top: that side's top rail runs level at that height (its top),
            # the whole run, instead of parallel to the nosings
            cap = level.get(side)
            def Hc(u):
                return H(u) if cap is None else cap - rh
            us = [0, run]
            white.append(solid([(0, zb), (rh * d / r, zb), (run, L(run) - rh), (run, L(run))],
                               w0, w1))
            white.append(solid([(u, Hc(u)) for u in us] + [(u, Hc(u) + rh) for u in reversed(us)],
                               w0, w1))
            u = sp / 2
            while u + sw / 2 <= run:
                u0, u1 = u - sw / 2, u + sw / 2
                white.append(solid([(u0, L(u0)), (u1, L(u1)), (u1, Hc(u1)), (u0, Hc(u0))], w0, w1))
                u += sp
    return {dt.get("material", "white_paint"): white, "rubber": black}
