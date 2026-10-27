"""The layout solver: places every room from its edges and size, chasing references between rooms until all are placed; list-valued edges are checks."""
from .checks import TOLERANCE, conflict
from .ctx import Blocked, Ctx, Missing
from .refs import EDGES, check_rels, edge_value
from ..units import ftin


def solve_layout(spec, report):
    """Place each rectangle from its edge relationships. The first relationship
    on each axis places the room; every later one is only checked. A size of
    `edges` takes that dimension from the first relationship on both edges."""
    lay = spec.get("layout") or {}
    todo = {}
    for name, r in (lay.get("rooms") or {}).items():
        ctx = Ctx(spec, report, f"layout.rooms.{name}")
        rels = [(k, r[k], k) for k in EDGES if k in r and not isinstance(r[k], list)]
        rels += [(k, v, f"{k}[{i}]") for k in EDGES if isinstance(r.get(k), list)
                 for i, v in enumerate(r[k])]
        first = {}
        for rel in rels:
            first.setdefault(rel[0], rel)
        size = r.get("size")
        try:
            if size is None or size == "MISSING":
                ctx.len(None, "size")
            dims = [None if v == "edges" else ctx.len(v, f"size[{i}]") for i, v in enumerate(size)]
            fz = ctx.len(r.get("floor", "base_slab"), "floor")
            defs = []
            for (lo, hi), d in zip((("west", "east"), ("north", "south")), dims):
                need = [lo, hi] if d is None else [next((k for k, *_ in rels if k in (lo, hi)), lo)]
                for k in need:
                    if k not in first:
                        ctx.len(None, k)
                    defs.append(first[k])
        except Missing:
            continue
        sides = {}
        for side, v in (r.get("walls") or {}).items():
            wctx = Ctx(spec, report, f"layout.rooms.{name}.walls")
            try:
                sides[side] = (wctx.len(v, side), wctx.placeholder)
            except Missing:
                sides[side] = (0.0, False)
        # Ledges: `size` is measured below the ledge; the room's edges are the
        # wall faces above it, so each ledge widens the rectangle by its depth.
        ledges = []
        for side, lg in (r.get("ledges") or {}).items():
            lctx = Ctx(spec, report, f"layout.rooms.{name}.ledges.{side}")
            try:
                length = lctx.len(lg["length"], "length") if "length" in lg else None
                ends = ("north", "south") if side in ("west", "east") else ("west", "east")
                if length is not None and lg.get("from") not in ends:
                    raise SystemExit(f"layout.rooms.{name}.ledges.{side}: `length` needs "
                                     f"`from:` {' or '.join(ends)}")
                ledges.append(dict(side=side, depth=lctx.len(lg["depth"], "depth"),
                                   height=lctx.len(lg["height"], "height"),
                                   slope=float(lg["slope"]), length=length, start=lg.get("from"),
                                   placeholder=lctx.placeholder))
            except Missing:
                continue
        for lg in ledges:
            i = 0 if lg["side"] in ("west", "east") else 1
            if dims[i] is not None:
                dims[i] += lg["depth"]
        todo[name] = dict(ctx=ctx, W=dims[0], L=dims[1], fz=fz, defs=defs, rels=rels,
                          outside=bool(r.get("outside")), sides=sides, ledges=ledges)

    placed, waits = {}, {}
    progress = True
    while progress:
        progress = False
        for name, t in list(todo.items()):
            ctx, pos = t["ctx"], {}
            try:
                for k, v, field in t["defs"]:
                    pos[k] = edge_value(v, ctx, field, placed)
            except Blocked as b:
                waits[name] = str(b)
                continue
            except Missing:
                del todo[name]
                continue
            W = t["W"] if t["W"] is not None else pos["east"] - pos["west"]
            L = t["L"] if t["L"] is not None else pos["south"] - pos["north"]
            w = pos["west"] if "west" in pos else pos["east"] - W
            n = pos["north"] if "north" in pos else pos["south"] - L
            placed[name] = dict(west=w, east=w + W, north=n, south=n + L, fz=t["fz"],
                                outside=t["outside"], placeholder=ctx.placeholder,
                                W=W, L=L, rels=t["rels"], defs=t["defs"], ctx=ctx,
                                sides=t["sides"], ledges=t["ledges"])
            del todo[name]
            waits.pop(name, None)
            progress = True
    for name in todo:
        report["missing"].append(f"layout.rooms.{name} (not placed: waits on `{waits[name]}`)")

    # Checks: later relationships, then overlaps.
    for name, p in placed.items():
        check_rels(spec, report, name, p, placed, f"layout.rooms.{name}")
    names = list(placed)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            A, B = placed[a], placed[b]
            ow = min(A["east"], B["east"]) - max(A["west"], B["west"])
            ol = min(A["south"], B["south"]) - max(A["north"], B["north"])
            if ow > TOLERANCE and ol > TOLERANCE:
                conflict(report, f"`{a}` and `{b}` overlap by {ftin(ow)} W x {ftin(ol)} L",
                         min(ow, ol), dict(kind="area", rect=(
                             max(A["west"], B["west"]), max(A["north"], B["north"]),
                             min(A["east"], B["east"]), min(A["south"], B["south"]))))
    # Walls implied between neighbours: the gap between facing inside faces.
    try:
        default = Ctx(spec, report, "layout").len(lay.get("wall"), "wall")
    except Missing:
        default = 0.0
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            for A_, B_, an, bn in ((placed[a], placed[b], a, b), (placed[b], placed[a], b, a)):
                for near, far, lo, hi, dirn in (("east", "west", "north", "south", "east"),
                                                ("south", "north", "west", "east", "south")):
                    gap = B_[far] - A_[near]
                    run = min(A_[hi], B_[hi]) - max(A_[lo], B_[lo])
                    if not (TOLERANCE < gap <= 24 and run > TOLERANCE):
                        continue
                    declared = [s[side][0] for s, side in ((A_["sides"], near), (B_["sides"], far))
                                if side in s]
                    want = max(declared) if declared else default
                    note = f"thinner than the {ftin(want)} wall" if gap < want - TOLERANCE else ""
                    a0, a1 = max(A_[lo], B_[lo]), min(A_[hi], B_[hi])
                    if near == "east":
                        r = (A_["east"], a0, B_["west"], a1)
                    else:
                        r = (a0, A_["south"], a1, B_["north"])
                    report["gaps"].append(dict(a=an, b=bn, dirn=dirn, gap=gap, run=run,
                                               note=note, rect=r, short=want - gap))
                    if note:
                        conflict(report, f"wall `{an}` | `{bn}` is {ftin(gap)} — {note}",
                                 want - gap, dict(kind="area", rect=r))
    report["layout"] = placed
    return placed
