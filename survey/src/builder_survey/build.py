#!/usr/bin/env python3
"""Build the basement model from spec.yaml.

Outputs (in model/out/):
  basement.dae  COLLADA model — SketchUp Go or Pro: File > Import
  mesh.json     triangle meshes for blender_build.py
  basement.rb   SketchUp Ruby script — in SketchUp: Window > Ruby Console,
                then  load '/path/to/basement.rb'
  plan.png      top-down preview
  view3d.png    axonometric preview
  report.md     every MISSING and PLACEHOLDER value, by spec path
  bathroom_plan.html  2D layout page: drag pieces around the existing walls and
                pipes (space_plan.py; starting pieces in space/bathroom.json)

Nothing is inferred. MISSING values skip their element; "~" values build in
orange. Run:  uv run survey build --project DIR
A plan (plans/NAME.yaml, see apply_plan) layers onto the spec:
              uv run survey build --project DIR --plan NAME   outputs in out/plans/NAME/
"""
import math
import sys

from .elements import element
from .export.check_plan import write_check_plan
from .export.dae import write_dae
from .export.mesh import write_mesh_json
from .export.previews import write_previews
from .export.report import write_report
from .export.ruby import write_ruby
from .export.sh3d import write_sh3d
from .geometry import disc, extrude, local_frame, prism, rect, xy
from .materials import MATERIALS
from .project import Project
from .spec.checks import TOLERANCE, conflict
from .spec.ctx import Blocked, Ctx, Missing
from .spec.layout import solve_layout
from .spec.plan import apply_plan
from .spec.refs import EDGES, REF_RE, check_rels, edge_rels, edge_value, place_rect, zval
from .units import ftin


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


def appliance_parts(ctx, p, f, z0, z1):
    """A washer (top-loader) or dryer (front door), front toward `facing`. The
    placed box is its width x depth, z to the top of the console (the raised
    control panel along the back, `console: {height, depth}`). The kick
    recess, lid, door and dial are drawn inside that box, for looks only."""
    W, D, box, to_plan = local_frame(p, f["facing"])
    ch = ctx.len(f["console"]["height"], "console.height")
    cd = ctx.len(f["console"]["depth"], "console.depth")
    zt = z1 - ch                                      # the deck, under the console
    dial = disc(to_plan, W / 2, D - cd - 1, D - cd, zt + ch / 2, min(1.25, ch / 2 - 0.5))
    kick = box(1, W - 1, 2, D, z0, z0 + 3)
    if f["kind"] == "washer":
        return {"enamel": [box(0, W, 0, D, z0 + 3, zt),
                           box(2, W - 2, 2, D - cd - 1.5, zt, zt + 0.5)],     # lid
                "appliance_grey": [box(0, W, D - cd, D, zt, z1)],
                "rubber": [kick, dial]}
    if f["kind"] == "dryer":
        h = zt - z0 - 3
        dz0, dz1 = z0 + 3 + 0.2 * h, z0 + 3 + 0.8 * h
        return {"enamel": [box(0, W, 0.75, D, z0 + 3, zt), box(0, W, D - cd, D, zt, z1),
                           box(3, W - 3, 0.25, 0.75, dz0, dz1)],              # door
                "appliance_grey": [box(4, 5, 0, 0.25, (dz0 + dz1) / 2 - 3, (dz0 + dz1) / 2 + 3)],
                "rubber": [kick, dial]}
    sys.exit(f"appliance kind {f['kind']!r}: washer or dryer")


def boiler_parts(ctx, p, f, z0, z1):
    """A cabinet boiler, front toward `facing`: jacket, front access panel, a
    top cover with a small overhang, a recessed base, a name plate. All inside
    the measured box."""
    W, D, box, _ = local_frame(p, f["facing"])
    return {"boiler_green": [box(0, W, 0.35, D, z0 + 3, z1 - 1.5),
                             box(0.5, W - 0.5, 0.1, 0.35, z0 + 4, z1 - 3),
                             box(0, W, 0, D, z1 - 1.5, z1)],
            "steel": [box(1, W - 1, 1, D, z0, z0 + 3)],
            "enamel": [box(W / 2 - 4, W / 2 + 4, 0, 0.1, z1 - 12, z1 - 9.5)]}


def water_heater_parts(ctx, p, f, z0, z1):
    """An upright tank inscribed in the placed rectangle: jacket, top cap, base
    ring, and on the front (`facing`) the burner access cover and the gas
    control valve, which stick out ~3" past the jacket as on the real one."""
    W, D, box, to_plan = local_frame(p, f["facing"])
    rad, cu, cv = min(W, D) / 2, W / 2, D / 2

    def ring(rr, za, zb, seg=32):
        return prism([xy(*to_plan(cu + rr * math.cos(2 * math.pi * i / seg),
                                  cv + rr * math.sin(2 * math.pi * i / seg))) for i in range(seg)],
                     za, zb)
    return {"wh_jacket": [ring(rad, z0 + 1.5, z1 - 2), ring(rad - 0.15, z1 - 2, z1)],
            "steel": [ring(rad - 0.3, z0, z0 + 1.5), box(cu - 3.5, cu + 3.5, -0.3, 1.5, z0 + 3, z0 + 9)],
            "rubber": [box(cu - 2, cu + 2, -2.5, 3, z0 + 11, z0 + 16)]}


def cabinet_door_parts(ctx, p, f, z0, z1):
    """Two cabinet doors closing an opening, their fronts on the fixture's
    front face (`facing`). `left` = the left door's width (seen facing them);
    the right one takes the rest, less a 1/8" gap. `styles` per door, left
    then right: shaker (a frame and two recessed panels) or slats (a frame,
    two bays of vertical slats crossed by horizontal battens, open between)."""
    W, D, box, _ = local_frame(p, f["facing"])
    sw = ctx.len(f["stile"], "stile")
    left = ctx.len(f["left"], "left")
    zm = (z0 + z1) / 2
    parts = []
    for (u0, u1), style in zip(((0, left), (left + 1 / 8, W)), f["styles"]):
        parts += [box(u0, u0 + sw, 0, D, z0, z1), box(u1 - sw, u1, 0, D, z0, z1),
                  box(u0 + sw, u1 - sw, 0, D, z0, z0 + sw), box(u0 + sw, u1 - sw, 0, D, z1 - sw, z1),
                  box(u0 + sw, u1 - sw, 0, D, zm - sw / 2, zm + sw / 2)]
        for za, zb in ((z0 + sw, zm - sw / 2), (zm + sw / 2, z1 - sw)):
            if style == "shaker":
                parts.append(box(u0 + sw, u1 - sw, D / 3, D, za, zb))
            elif style == "slats":
                inner = u1 - u0 - 2 * sw
                n = max(2, round(inner / 3))
                for i in range(n):
                    c = u0 + sw + inner * (i + 0.5) / n
                    parts.append(box(c - 0.6, c + 0.6, D / 2, D, za, zb))
                for i in (1, 2):
                    zc = za + (zb - za) * i / 3
                    parts.append(box(u0 + sw, u1 - sw, 0, D / 2, zc - 0.5, zc + 0.5))
            else:
                sys.exit(f"cabinet door style {style!r}: shaker or slats")
    return {f.get("material", "pine"): parts}


def shelving_parts(ctx, p, f, z0, z1):
    """An open shelving unit, front toward `facing`: an angle-iron post at each
    corner (casters under them), boards at `shelves` heights (their tops,
    from the floor) on an iron rail front and back."""
    W, D, box, _ = local_frame(p, f["facing"])
    post = ctx.len(f["post"], "post")
    board = ctx.len(f["board"], "board")
    caster = ctx.len(f["caster"], "caster")
    iron, wood, rubber = [], [], []
    for u0 in (0, W - post):
        for v0 in (0, D - post):
            iron.append(box(u0, u0 + post, v0, v0 + post, z0 + caster, z1))
            rubber.append(box(u0, u0 + post, v0, v0 + post, z0, z0 + caster))
    for i, h in enumerate(f["shelves"]):
        zt = z0 + ctx.len(h, f"shelves[{i}]")
        wood.append(box(post, W - post, 0, D, zt - board, zt))
        for v0 in (0, D - post):
            iron.append(box(post, W - post, v0, v0 + post, zt - board - post, zt - board))
    return {f.get("frame_material", "iron"): iron, f.get("material", "walnut"): wood,
            "rubber": rubber}


def sauna_parts(ctx, p, f, z0, z1):
    """A sauna cabin in the placed rectangle, its front (door side) toward
    `facing`. Parts are laid out in the cabin's own frame: u across the front
    from its left end (as seen standing outside, facing it), v from the front
    toward the back. Returns {material: parts}."""
    width, depth, box, _ = local_frame(p, f["facing"])
    t = ctx.len(f["wall"], "wall")
    d, win = f["door"], f["window"]
    du0 = ctx.len(d["from_left"], "door.from_left")
    du1 = du0 + ctx.len(d["width"], "door.width")
    dz1 = z0 + ctx.len(d["height"], "door.height")
    wu1 = width - ctx.len(win["from_right"], "window.from_right")
    wu0 = wu1 - ctx.len(win["width"], "window.width")
    wz0 = z0 + ctx.len(win["bottom"], "window.bottom")
    wz1 = wz0 + ctx.len(win["height"], "window.height")
    if not (0 < du0 < du1 < wu0 < wu1 < width and dz1 < z1 and wz1 < z1):
        sys.exit(f"layout.fixtures: sauna door / window don't fit its {ftin(width)} front")
    # Pieces meet face to face and never overlap: overlapping solids leave
    # coincident surfaces, which render as black streaks.
    trim, band = 1.5, 3.0   # frame inside each opening; top trim band (within the height)
    zt = z1 - band          # walls stop under the top trim
    wood = [box(t, width - t, depth - t, depth, z0, zt),       # back
            box(0, t, 0, depth, z0, zt), box(width - t, width, 0, depth, z0, zt),  # sides
            box(t, width - t, t, depth - t, zt - t, zt),        # roof
            box(t, du0, 0, t, z0, zt), box(du1, wu0, 0, t, z0, zt),               # front
            box(wu1, width - t, 0, t, z0, zt), box(du0, du1, 0, t, dz1, zt),
            box(wu0, wu1, 0, t, z0, wz0), box(wu0, wu1, 0, t, wz1, zt),
            box(-1, width + 1, -1, depth, zt, z1)]               # top trim
    glass = []
    for u0, u1, za, zb in ((du0, du1, z0, dz1), (wu0, wu1, wz0, wz1)):
        wood += [box(u0, u0 + trim, -0.75, t, za, zb), box(u1 - trim, u1, -0.75, t, za, zb),
                 box(u0 + trim, u1 - trim, -0.75, t, zb - trim, zb),
                 box(u0 + trim, u1 - trim, -0.75, t, za, za + trim)]
        glass.append(box(u0 + trim, u1 - trim, t / 2 - 0.25, t / 2 + 0.25, za + trim, zb - trim))
    glow = []
    for i, b in enumerate(f["benches"]):      # depth from the back wall; 2" boards
        top = z0 + ctx.len(b["top"], f"benches[{i}].top")
        reach = ctx.len(b["depth"], f"benches[{i}].depth")
        front = depth - t - reach
        wood += [box(t, width - t, front, depth - t, top - 2, top),
                 box(t, width - t, front, front + 1, z0 if i == 0 else top - 12, top - 2)]  # apron
        glow.append(box(t + 2, width - t - 2, depth - t - 1, depth - t, top + 14, top + 15))  # LED strip
                                                                    # on the back wall above it
    return {"sauna_wood": wood, "glass": glass, "glow": glow}


# Fixture types built from parts in several materials: type -> f(ctx, p, f, z0, z1)
BUILDERS = {"sauna": sauna_parts, "appliance": appliance_parts, "boiler": boiler_parts,
            "water_heater": water_heater_parts, "cabinet_doors": cabinet_door_parts,
            "shelving": shelving_parts}


def place_fixtures(spec, report, placed):
    """Boxes and stair flights, placed like rooms (edges, size, checks) but
    they make no walls. They can refer to rooms and to each other."""
    refs, fixtures, waits = dict(placed), {}, {}
    todo = dict((spec.get("layout") or {}).get("fixtures") or {})
    progress = True
    while progress:
        progress = False
        for name, f in list(todo.items()):
            ctx = Ctx(spec, report, f"layout.fixtures.{name}")
            try:
                p = place_rect(ctx, f, refs)
                groups = None                   # {material: parts} for multi-material types
                if f["type"] == "stairs":
                    if int(f["risers"]) < 2:
                        sys.exit(f"layout.fixtures.{name}: a flight needs at least 2 risers")
                    zb = zval(ctx, f["bottom"], "bottom")
                    rise = ctx.len(f["rise"], "rise")
                    if "detail" in f:
                        groups = stair_detail(ctx, p, f, zb, rise)
                    else:
                        parts = stair_parts(p, f["up"], int(f["risers"]), zb, rise)
                    p["z"] = (zb, zb + rise)
                elif f["type"] == "box":
                    z = [zval(ctx, v, f"z[{i}]") for i, v in enumerate(f["z"])]
                    parts = [prism(rect(p["west"], p["north"], p["east"], p["south"]), *z)]
                    p["z"] = tuple(z)
                elif f["type"] in BUILDERS:
                    z = [zval(ctx, v, f"z[{i}]") for i, v in enumerate(f["z"])]
                    groups = BUILDERS[f["type"]](ctx, p, f, *z)
                    p["z"] = tuple(z)
                elif f["type"] == "cylinder":   # upright, inscribed in the placed rect
                    z = [zval(ctx, v, f"z[{i}]") for i, v in enumerate(f["z"])]
                    ce, cs = (p["west"] + p["east"]) / 2, (p["north"] + p["south"]) / 2
                    re_, rs = (p["east"] - p["west"]) / 2, (p["south"] - p["north"]) / 2
                    pts = [xy(ce + re_ * math.cos(2 * math.pi * i / 24),
                              cs + rs * math.sin(2 * math.pi * i / 24)) for i in range(24)]
                    parts = [prism(pts, *z)]
                    p["z"] = tuple(z)
                else:
                    sys.exit(f"layout.fixtures.{name}: unknown type {f['type']!r}")
            except Blocked as b:
                waits[name] = str(b)
                continue
            except Missing:
                del todo[name]
                continue
            phase = f.get("phase", "existing")
            if groups is not None:
                els = [element(f"{name} {mat}", phase, mat, ctx, ps)
                       for mat, ps in groups.items() if ps]
            else:
                els = [element(name, phase, f.get("material", "wood"), ctx, parts)]
            p.update(placeholder=ctx.placeholder, type=f["type"], elements=els)
            fixtures[name] = refs[name] = p
            del todo[name]
            progress = True
    for name in todo:
        report["missing"].append(f"layout.fixtures.{name} (not placed: waits on `{waits[name]}`)")
    for name, p in fixtures.items():
        check_rels(spec, report, name, p, refs, f"layout.fixtures.{name}")
    report["fixtures"] = fixtures
    return refs


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


def ledge(name, p, lg, doors):
    """Block ledge along one wall: vertical face up to `height`, then a top
    rising toward the wall at `slope` degrees from horizontal over `depth`.
    A door in that wall cuts it: gone under an existing door, demo under a
    proposed one. (Under a removed door the ledge isn't rebuilt.)"""
    import math
    d, h, side = lg["depth"], lg["height"], lg["side"]
    w, n, e, s = p["west"], p["north"], p["east"], p["south"]
    # `length` from one end of the wall (`from`) shortens the ledge; default full run.
    if lg["length"] is not None:
        L = lg["length"]
        n, s = {"north": (n, n + L), "south": (s - L, s)}.get(lg["start"], (n, s))
        w, e = {"west": (w, w + L), "east": (e - L, e)}.get(lg["start"], (w, e))
    ns = side in ("west", "east")
    spans = [((n, s) if ns else (w, e)) + ("existing", "")]
    for dr in doors:  # windows above the ledge don't cut it
        if dr["room"] != name or dr["side"] != side or dr["zb"] >= p["fz"] + h:
            continue
        lo, hi = dr["lo"] - dr["frame"], dr["hi"] + dr["frame"]
        cut = []
        for a, b, ph, tag in spans:
            if hi <= a or lo >= b or ph != "existing":
                cut.append((a, b, ph, tag))
                continue
            if lo > a:
                cut.append((a, lo, ph, tag))
            if dr["phase"] == "proposed":
                cut.append((max(a, lo), min(b, hi), "demo", f" (door {dr['name']})"))
            if hi < b:
                cut.append((hi, b, ph, tag))
        spans = cut

    wall_x, wall_y = {"west": (w, None), "east": (e, None),
                      "north": (None, n), "south": (None, s)}[side]
    front, back = p["fz"] + h, p["fz"] + h + d * math.tan(math.radians(lg["slope"]))
    ctx = type("C", (), {"placeholder": lg["placeholder"] or p["placeholder"]})()
    out = []
    for a, b, ph, tag in spans:
        strip = {"west": (w, a, w + d, b), "east": (e - d, a, e, b),
                 "north": (a, n, b, n + d), "south": (a, s - d, b, s)}[side]
        pts = rect(*strip)
        ztop = []
        for x, y in pts:  # back = the points on the wall face
            at_wall = (wall_x is not None and abs(x - wall_x) < 1e-6) or \
                      (wall_y is not None and abs(-y - wall_y) < 1e-6)
            ztop.append(back if at_wall else front)
        part = prism(pts, p["fz"], front)
        part["ztop"] = ztop
        el = element(f"{name} {side} ledge{tag}", ph, "block", ctx, [part])
        el["finish_of"] = (name, side)
        out.append(el)
    return out


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


def build_layout(spec, report, out):
    placed = solve_layout(spec, report)
    if not placed:
        return
    lay = spec["layout"]
    for name, p in placed.items():
        el = element(f"{name} floor", "existing", "slab", p["ctx"],
                     [prism(rect(p["west"], p["north"], p["east"], p["south"]), p["fz"] - 4, p["fz"])])
        el["label"] = xy((p["west"] + p["east"]) / 2, (p["north"] + p["south"]) / 2)
        el["finish_of"] = (name, "floor")
        out.append(el)
    refs = place_fixtures(spec, report, placed)
    out += [el for f in report["fixtures"].values() for el in f["elements"]]
    doors = place_doors(spec, report, placed, refs)
    for name, p in placed.items():
        for lg in p["ledges"]:
            out += ledge(name, p, lg, doors)

    # Walls: every point within `wall` of an indoor room that isn't inside any
    # room. Shared walls come out once and corners close.
    ctx = Ctx(spec, report, "layout")
    try:
        t = ctx.len(lay.get("wall"), "wall")
        z0 = ctx.len(lay["wall_z"][0], "wall_z[0]")
        z1 = ctx.len(lay["wall_z"][1], "wall_z[1]")
    except Missing:
        return
    inner = [(p["west"], p["north"], p["east"], p["south"]) for p in placed.values()]
    def side(p, s):
        return p["sides"].get(s, (t, False))[0]

    outer = [(p["west"] - side(p, "west"), p["north"] - side(p, "north"),
              p["east"] + side(p, "east"), p["south"] + side(p, "south"))
             for p in placed.values() if not p["outside"]]
    xs = {v for r in inner + outer for v in (r[0], r[2])}
    ys = {v for r in inner + outer for v in (r[1], r[3])}
    for dr in doors:  # grid lines at each rough opening's ends (frame included)
        ns = dr["side"] in ("east", "west")
        (ys if ns else xs).update((dr["lo"] - dr["frame"], dr["hi"] + dr["frame"]))
        if dr["depth"] is not None:  # a recess stops `depth` into the wall
            step = 1 if dr["side"] in ("east", "south") else -1
            (xs if ns else ys).add(dr["face"] + step * dr["depth"])
    xs, ys = sorted(xs), sorted(ys)

    def within(r, x, y):
        return r[0] < x < r[2] and r[1] < y < r[3]

    # An outside area (the patio) doesn't cut walls: a wall standing on its
    # edge, like the shed's east wall past the garage, stays.
    indoor = [(p["west"], p["north"], p["east"], p["south"])
              for p in placed.values() if not p["outside"]]

    def is_wall(x, y):
        return any(within(r, x, y) for r in outer) and not any(within(r, x, y) for r in indoor)

    # A door cuts through the wall cells behind its face, out to the first cell
    # that isn't wall, from its bottom to the top of its frame.
    holes = []
    for dr in doors:
        lo, hi = dr["lo"] - dr["frame"], dr["hi"] + dr["frame"]
        mid, ns = (lo + hi) / 2, dr["side"] in ("east", "west")
        lines, step = (xs if ns else ys), (1 if dr["side"] in ("east", "south") else -1)
        i, far = lines.index(dr["face"]), dr["face"]
        while 0 <= i + min(step, 0) and i + max(step, 0) < len(lines):
            a, b = sorted((lines[i], lines[i + step]))
            if not (is_wall((a + b) / 2, mid) if ns else is_wall(mid, (a + b) / 2)):
                break
            if dr["depth"] is not None and abs(lines[i + step] - dr["face"]) > dr["depth"] + 1e-6:
                break
            far, i = lines[i + step], i + step
        if far == dr["face"]:
            conflict(report, f"door `{dr['name']}`: no wall behind `{dr['room']}.{dr['side']}` "
                     f"at {ftin(lo)}–{ftin(hi)}")
            continue
        c0, c1 = sorted((dr["face"], far))
        dr["across"] = (c0, c1)
        box = (c0, lo, c1, hi) if ns else (lo, c0, hi, c1)
        top = dr["zb"] + dr["height"] + dr["frame"]
        holes.append((box, dr["zb"], top))
        if dr["phase"] != "existing":
            # A new door's opening is block taken out (demo); a removed door's
            # opening is filled in (proposed). The cut wall shows neither.
            fill = element(f"door {dr['name']} {'opening' if dr['phase'] == 'proposed' else 'infill'}",
                           "demo" if dr["phase"] == "proposed" else "proposed", "block", dr["ctx"],
                           [prism(rect(*box), max(dr["zb"], z0), min(top, z1))])
            fill["finish_of"] = "probe"
            out.append(fill)
        room = placed[dr["room"]]
        if dr["depth"] is None and abs(dr["zb"] - room["fz"]) < 1e-6:
            # A door at floor level: the room's floor runs out through the
            # opening to the far face of the wall (no threshold gap).
            sill = element(f"door {dr['name']} sill", dr["phase"], "slab", dr["ctx"],
                           [prism(rect(*box), room["fz"] - 4, room["fz"])])
            sill["finish_of"] = (dr["room"], "floor")
            out.append(sill)
        f = dr["frame"]
        if f > 0:  # jambs and head, the depth of the wall
            def piece(u0, u1, za, zb_):
                return prism(rect(*((c0, u0, c1, u1) if ns else (u0, c0, u1, c1))), za, zb_)
            out.append(element(f"door {dr['name']} frame", dr["phase"], "wood", dr["ctx"], [
                piece(lo, lo + f, dr["zb"], top), piece(hi - f, hi, dr["zb"], top),
                piece(lo + f, hi - f, top - f, top)]))
        glazing(dr, report, out)

    def profile(x, y):
        """z spans of wall left in this cell after door holes."""
        segs = [(z0, z1)]
        for (w_, n_, e_, s_), ha, hb in holes:
            if w_ < x < e_ and n_ < y < s_:
                segs = [s for a, b in segs for s in ((a, min(b, ha)), (max(a, hb), b))
                        if s[1] - s[0] > 1e-6]
        return tuple(segs) or None

    runs = {}  # (x0, x1, z spans) -> list of [y0, y1] spans, merged down the rows
    for y0, y1 in zip(ys, ys[1:]):
        cy, row, start, cur = (y0 + y1) / 2, [], None, None
        for x0, x1 in zip(xs, xs[1:]):
            cx = (x0 + x1) / 2
            prof = profile(cx, cy) if is_wall(cx, cy) else None
            if prof != cur:
                if cur is not None:
                    row.append((start, x0, cur))
                start, cur = x0, prof
        if cur is not None:
            row.append((start, xs[-1], cur))
        for run in row:
            spans = runs.setdefault(run, [])
            if spans and spans[-1][1] == y0:
                spans[-1][1] = y1
            else:
                spans.append([y0, y1])
    parts = [prism(rect(x0, s0, x1, s1), za, zb_)
             for (x0, x1, prof), spans in runs.items() for s0, s1 in spans for za, zb_ in prof]
    ctx.placeholder = any(p["placeholder"] or any(ph for _, ph in p["sides"].values())
                          for p in placed.values() if not p["outside"])
    walls = element("walls", "existing", "block", ctx, parts)
    walls["finish_of"] = "probe"   # each face takes the finish of the room it faces
    out.append(walls)


def build_rooms(spec, report, out):
    for name, r in (spec.get("rooms") or {}).items():
        ctx = Ctx(spec, report, f"rooms.{name}")
        for key, val in r.items():
            if val == "MISSING":
                report["missing"].append(f"rooms.{name}.{key}")
        try:
            fz = ctx.len(r["floor_z"], "floor_z")
            pts = [xy(*ctx.pt(p, f"floor[{i}]")) for i, p in enumerate(r["floor"])]
        except Missing:
            continue
        out.append(element(f"{name} floor", r["phase"], "slab", ctx, [prism(pts, fz - 4, fz)]))


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
        out.append(element(name, w["phase"], w.get("material", "block"), ctx, parts))


def build_joists(spec, report, out):
    """region = [west, north, east, south], numbers or room edges. `first` is
    the gap from the `from` side (default west / north) to the first joist."""
    jspec = spec["joist"]
    refs = {**(report.get("layout") or {}), **report.get("fixtures", {})}
    for name, j in (spec.get("joists") or {}).items():
        ctx = Ctx(spec, report, f"joists.{name}")
        try:
            e0, s0, e1, s1 = (edge_value(v, ctx, f"region[{i}]", refs)
                              for i, v in enumerate(j["region"]))
            first = ctx.len(j["first"], "first")
            zb = zval(ctx, j["z_bottom"], "z_bottom")
            depth = ctx.len(jspec["depth"], "joist.depth")
            width = ctx.len(jspec["width"], "joist.width")
            spacing = ctx.len(jspec["spacing"], "joist.spacing")
        except Missing:
            continue
        except Blocked as b:
            report["missing"].append(f"joists.{name} (waits on `{b}`)")
            continue
        ns = j["run"] == "ns"
        lo, hi = (e0, e1) if ns else (s0, s1)
        backward = j.get("from") in ("east", "south")
        # `origin` (default: the region's `from` edge) is where `first` is
        # measured from, so a second region can continue the same grid.
        try:
            origin = edge_value(j["origin"], ctx, "origin", refs) if "origin" in j else \
                (hi if backward else lo)
        except (Missing, Blocked):
            continue
        parts, u = [], first
        while True:
            a, b = (origin - u - width, origin - u) if backward else (origin + u, origin + u + width)
            if (a < lo - 1e-6) if backward else (b > hi + 1e-6):
                break
            if a >= lo - 1e-6 and b <= hi + 1e-6:
                parts.append(prism(rect(*((a, s0, b, s1) if ns else (e0, a, e1, b))), zb, zb + depth))
            u += spacing
        report.setdefault("joist_regions", []).append((e0, s0, e1, s1, zb + depth))
        out.append(element(f"{name} joists", j["phase"], "joist", ctx, parts))


# A face of the pipe in place of its center: axis, and which way the center
# lies from that face (center = value + sign * radius).
FACES = {"west": (0, 1), "east": (0, -1), "north": (1, 1), "south": (1, -1),
         "top": (2, -1), "bottom": (2, 1)}
AXES = ("east", "south", "z")


def coord(ctx, expr, field, refs):
    """A room / fixture / door edge with + / - terms, or a height (level and terms)."""
    if isinstance(expr, str) and REF_RE.match(expr):
        return edge_value(expr, ctx, field, refs)
    return zval(ctx, expr, field)


def pipe_refs(report):
    """Rooms, fixtures, and doors as `door_<name>`. A door's edges along its wall
    are the outside edges of its frame; across the wall, the wall's two faces."""
    refs = {**(report.get("layout") or {}), **report.get("fixtures", {})}
    for d in report.get("doors", []):
        if "across" not in d:
            continue
        ns = d["side"] in ("east", "west")
        along = dict(zip(("north", "south") if ns else ("west", "east"),
                         (d["lo"] - d["frame"], d["hi"] + d["frame"])))
        across = dict(zip(("west", "east") if ns else ("north", "south"), d["across"]))
        refs[f"door_{d['name']}"] = {**along, **across, "placeholder": d["placeholder"]}
    return refs


def build_pipes(spec, report, out):
    """Straight runs between named corners. A corner is [east, south, z]; each
    value is the center line, or a face of the pipe ({west: ...}, {top: ...}),
    which is moved to the center by the radius of each run that meets it.
    A list places with its first value and only checks the rest (CONFLICTS).
    A run builds when both its corners and its diameter are known."""
    refs = pipe_refs(report)
    corners = {}   # "pipe.corner" -> [(value, sign) or None per axis], placeholder
    pipes = (spec.get("pipes") or {}).items()
    for name, p in pipes:
        cs = p.get("corners")
        if cs is None or cs == "MISSING":
            report["missing"].append(f"pipes.{name}.corners")
            continue
        for cname, c in cs.items():
            path = f"pipes.{name}.corners.{cname}"
            if c == "MISSING" or (isinstance(c, list) and all(v == "MISSING" for v in c)):
                report["missing"].append(path)
                corners[f"{name}.{cname}"] = ([None] * 3, False)
                continue
            if not isinstance(c, list) or len(c) != 3:
                sys.exit(f"{path}: a corner is [east, south, z]")
            vals, ph = [], False
            for axis, v in enumerate(c):
                checks = []
                if isinstance(v, list):      # the first value places it, the rest are only checked
                    v, *checks = v
                face = None
                if isinstance(v, dict):
                    (face, v), = v.items()
                    if face not in FACES or FACES[face][0] != axis:
                        sys.exit(f"{path}: `{face}` isn't a face along {AXES[axis]}")
                ctx = Ctx(spec, report, path)
                try:
                    vals.append((coord(ctx, v, AXES[axis], refs), FACES[face][1] if face else 0))
                except Missing:
                    vals.append(None)
                except Blocked as b:
                    report["missing"].append(f"{path}.{AXES[axis]} (waits on `{b}`)")
                    vals.append(None)
                ph |= ctx.placeholder
                for chk in checks:
                    cface = None
                    if isinstance(chk, dict):
                        (cface, chk), = chk.items()
                    if cface != face:
                        sys.exit(f"{path}.{AXES[axis]}: a check must measure the same face as "
                                 f"the first value ({face or 'center'})")
                    if vals[-1] is None:
                        continue
                    try:
                        got = coord(Ctx(spec, report, path), chk, AXES[axis], refs)
                    except (Missing, Blocked):
                        continue
                    placed = vals[-1][0]
                    if abs(got - placed) > TOLERANCE:
                        conflict(report, f"`{path}.{AXES[axis]}`: placed at {ftin(placed)}, but "
                                 f"`{chk}` gives {ftin(got)} (off by {ftin(abs(got - placed))})",
                                 got - placed)
            corners[f"{name}.{cname}"] = (vals, ph)

    runs = []
    for name, p in pipes:
        rs = p.get("runs")
        if rs is None or rs == "MISSING":
            if p.get("corners") not in (None, "MISSING"):
                report["missing"].append(f"pipes.{name}.runs")
            continue
        if any("diameter" not in r for r in rs):   # the pipe's own, reported once
            try:
                pipe_d = Ctx(spec, report, f"pipes.{name}").len(p.get("diameter"), "diameter")
            except Missing:
                pipe_d = None
        for i, r in enumerate(rs):
            path = f"pipes.{name}.runs[{i}]"
            ends = [e if "." in e else f"{name}.{e}" for e in (r["from"], r["to"])]
            for e in ends:
                if e not in corners:
                    sys.exit(f"{path}: no corner `{e}`")
            material = r.get("material", p.get("material", "pipe"))
            if material not in MATERIALS:
                sys.exit(f"{path}: unknown material {material!r}")
            ctx = Ctx(spec, report, path)
            run = dict(pipe=name, frm=r["from"], to=r["to"], material=material, d=None)
            runs.append(run)
            if "diameter" in r:
                try:
                    run["d"] = ctx.len(r["diameter"], "diameter")
                except Missing:
                    pass
            else:
                run["d"] = pipe_d
                ctx.placeholder |= isinstance(p["diameter"], str) and p["diameter"].startswith("~")
            unknown = []
            for e in ends:
                gaps = [AXES[k] for k, v in enumerate(corners[e][0]) if v is None]
                label = e if e.split(".")[0] != name else e.split(".", 1)[1]
                unknown += [label] if len(gaps) == 3 else [f"{label}.{g}" for g in gaps]
            if unknown or run["d"] is None:
                run["waits"] = unknown + ([] if run["d"] is not None else ["diameter"])
                continue
            ctx.placeholder |= any(corners[e][1] for e in ends)
            rad = run["d"] / 2
            a, b = ([v + s * rad for v, s in corners[e][0]] for e in ends)
            if math.dist(a, b) < TOLERANCE:
                conflict(report, f"`{path}`: `{r['from']}` and `{r['to']}` are the same point")
                run["waits"] = ["a length"]
                continue
            run.update(a=a, b=b, placeholder=ctx.placeholder)
            out.append(element(f"pipe {name} {r['from']}-{r['to']}", p.get("phase", "existing"),
                               material, ctx, [{"kind": "cylinder", "a": [*xy(a[0], a[1]), a[2]],
                                                "b": [*xy(b[0], b[1]), b[2]], "r": rad}]))
    report["pipes"] = runs
    report["pipe_corners"] = corners


def build_objects(spec, report, out):
    for name, o in (spec.get("objects") or {}).items():
        ctx = Ctx(spec, report, f"objects.{name}")
        try:
            if o["type"] == "box":
                e, s, z = ctx.pt(o["at"], "at")
                W, L, H = ctx.pt(o["size"], "size")
                parts = [prism(rect(e, s, e + W, s + L), z, z + H)]
                mat = o.get("material", "object")
            elif o["type"] == "cylinder":
                a = ctx.pt(o["from"], "from")
                b = ctx.pt(o["to"], "to")
                d = ctx.len(o["diameter"], "diameter")
                parts = [{"kind": "cylinder", "a": [*xy(a[0], a[1]), a[2]],
                          "b": [*xy(b[0], b[1]), b[2]], "r": d / 2}]
                mat = o.get("material", "pipe")
            else:
                sys.exit(f"objects.{name}: unknown type {o['type']!r}")
        except Missing:
            continue
        out.append(element(name, o["phase"], mat, ctx, parts))


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


def build(project_dir, plan=None):
    project = Project(project_dir)
    spec = project.load_spec()
    cfg = project.config
    out = project.out
    if plan:
        apply_plan(spec, plan, project.plans)
        out = out / "plans" / plan
    out.mkdir(parents=True, exist_ok=True)
    report = {"missing": [], "placeholder": [], "conflicts": [], "gaps": []}
    elements = []
    build_layout(spec, report, elements)
    build_rooms(spec, report, elements)
    build_walls(spec, report, elements)
    build_joists(spec, report, elements)
    build_pipes(spec, report, elements)
    build_objects(spec, report, elements)
    write_ruby(out, spec["name"], cfg.get("ruby_module", "Survey"), elements)
    write_dae(out, spec["name"], elements)
    print("basement.sh3d: %d walls, %d pieces, %d rooms" % write_sh3d(
        out, elements, float(cfg.get("sh3d_floor_z", 0)),
        {n for n, f in report["fixtures"].items() if f["type"] == "appliance"}))
    write_mesh_json(out, elements, cameras(spec, report), *finishes(spec, report),
                    report.get("daylight", []))
    write_report(out, report, elements)
    write_previews(out, elements)
    write_check_plan(out, report)
    from .layout2d.space_plan import write_space_plan
    for page in cfg.get("layout_pages", []):
        ceiling = zval(Ctx(spec, report, "levels"), page["ceiling"], page["ceiling"])
        write_space_plan(project.space, report, elements, ceiling, out, room=page["room"])
    print(f"{len(elements)} elements built; {len(report['conflicts'])} CONFLICTS, "
          f"{len(report['missing'])} MISSING, "
          f"{len(dict.fromkeys(report['placeholder']))} placeholder values. See {out}/report.md")
