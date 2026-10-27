"""Layout -> elements: room floors, ledges, doors / glazing, fixtures."""
from ..elements import element
from .doors import glazing, place_doors
from .fixtures import place_fixtures
from .ledges import ledge
from ..geometry import prism, rect, xy
from ..spec.checks import conflict
from ..spec.ctx import Ctx, Missing
from ..spec.layout import solve_layout
from ..units import ftin


def build_layout(spec, report, out):
    placed = solve_layout(spec, report)
    if not placed:
        return
    lay = spec["layout"]
    for name, p in placed.items():
        el = element(f"{name} floor", "existing", "slab", p["ctx"],
                     [prism(rect(p["west"], p["north"], p["east"], p["south"]), p["fz"] - 4, p["fz"])], kind="floor")
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
                           [prism(rect(*box), max(dr["zb"], z0), min(top, z1))], kind="door")
            fill["finish_of"] = "probe"
            out.append(fill)
        room = placed[dr["room"]]
        if dr["depth"] is None and abs(dr["zb"] - room["fz"]) < 1e-6:
            # A door at floor level: the room's floor runs out through the
            # opening to the far face of the wall (no threshold gap).
            sill = element(f"door {dr['name']} sill", dr["phase"], "slab", dr["ctx"],
                           [prism(rect(*box), room["fz"] - 4, room["fz"])], kind="sill")
            sill["finish_of"] = (dr["room"], "floor")
            out.append(sill)
        f = dr["frame"]
        if f > 0:  # jambs and head, the depth of the wall
            def piece(u0, u1, za, zb_):
                return prism(rect(*((c0, u0, c1, u1) if ns else (u0, c0, u1, c1))), za, zb_)
            out.append(element(f"door {dr['name']} frame", dr["phase"], "wood", dr["ctx"], [
                piece(lo, lo + f, dr["zb"], top), piece(hi - f, hi, dr["zb"], top),
                piece(lo + f, hi - f, top - f, top)], kind="door"))
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
    walls = element("walls", "existing", "block", ctx, parts, kind="wall")
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
        out.append(element(f"{name} floor", r["phase"], "slab", ctx, [prism(pts, fz - 4, fz)],
                           kind="floor", source=r.get("source")))
