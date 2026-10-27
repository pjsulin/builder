"""Ledges: the block a wall carries above the floor, with its sloped top."""
from ..elements import element
from ..geometry import prism, rect


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
        el = element(f"{name} {side} ledge{tag}", ph, "block", ctx, [part], kind="ledge")
        el["finish_of"] = (name, side)
        out.append(el)
    return out
