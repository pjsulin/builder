"""Edge references with chained offsets (`office.east + 4 1/2"`), heights, rectangle placement."""
import re

from .checks import TOLERANCE, conflict
from .ctx import Blocked, Ctx, Missing
from ..units import ftin


EDGES = ("west", "east", "north", "south")
AXIS = {"west": "ew", "east": "ew", "north": "ns", "south": "ns"}
REF_RE = re.compile(r"^\s*(~)?\s*([A-Za-z_]\w*)\.(north|south|east|west)\s*((?:[+-][^+-]+)*)$")
TERM_RE = re.compile(r"([+-])\s*([^+-]+?)\s*(?=[+-]|$)")


def edge_value(expr, ctx, field, placed):
    """'office.east + 4 1/2"' or 'bathroom.south + 8" - 6'' -> number,
    using already-placed rooms."""
    m = REF_RE.match(str(expr)) if isinstance(expr, str) else None
    if not m:
        return ctx.len(expr, field)
    tilde, room, edge, rest = m.groups()
    if room not in placed:
        raise Blocked(room)
    if tilde:
        ctx.placeholder = True
        ctx.report["placeholder"].append(f"{ctx.path}.{field} = {expr}")
    ctx.placeholder |= placed[room]["placeholder"]
    v = placed[room][edge]
    for sign, term in TERM_RE.findall(rest):
        d = ctx.len(term, field)
        v += d if sign == "+" else -d
    return v


def zval(ctx, expr, field):
    """Height: a length or level name, optionally with + / - terms,
    e.g. 'laundry_floor + 65"'."""
    if not isinstance(expr, str):
        return ctx.len(expr, field)
    return sum((1 if sign == "+" else -1) * ctx.len(term, field)
               for sign, term in TERM_RE.findall("+" + expr.strip()))


def edge_rels(r):
    """Edge relationships in placing order: plain values first, then list items."""
    rels = [(k, r[k], k) for k in EDGES if k in r and not isinstance(r[k], list)]
    rels += [(k, v, f"{k}[{i}]") for k in EDGES if isinstance(r.get(k), list)
             for i, v in enumerate(r[k])]
    return rels


def check_rels(spec, report, name, p, refs, path):
    """Every relationship that didn't place `p` is only checked."""
    for k, v, field in p["rels"]:
        if (k, v, field) in p["defs"]:
            continue
        ctx = Ctx(spec, report, path)
        try:
            got = edge_value(v, ctx, field, refs)
        except Blocked as b:
            conflict(report, f"`{name}.{k}: {v}` unchecked — `{b}` not placed")
            continue
        except Missing:
            continue
        if abs(got - p[k]) > TOLERANCE:
            conflict(report, f"`{name}.{k}`: placed at {ftin(p[k])}, but `{v}` gives "
                     f"{ftin(got)} (off by {ftin(abs(got - p[k]))})", got - p[k],
                     dict(kind="edge", room=name, edge=k, placed=p[k], got=got))


def place_rect(ctx, r, refs):
    """A rectangle from `size` and its edge relationships (as for rooms).
    Raises Missing or Blocked."""
    rels = edge_rels(r)
    first = {}
    for rel in rels:
        first.setdefault(rel[0], rel)
    size = r.get("size")
    if size is None or size == "MISSING":
        ctx.len(None, "size")
    dims = [None if v == "edges" else ctx.len(v, f"size[{i}]") for i, v in enumerate(size)]
    defs = []
    for (lo, hi), d in zip((("west", "east"), ("north", "south")), dims):
        need = [lo, hi] if d is None else [next((k for k, *_ in rels if k in (lo, hi)), lo)]
        for k in need:
            if k not in first:
                ctx.len(None, k)
            defs.append(first[k])
    pos = {k: edge_value(v, ctx, field, refs) for k, v, field in defs}
    W = dims[0] if dims[0] is not None else pos["east"] - pos["west"]
    L = dims[1] if dims[1] is not None else pos["south"] - pos["north"]
    w = pos["west"] if "west" in pos else pos["east"] - W
    n = pos["north"] if "north" in pos else pos["south"] - L
    return dict(west=w, east=w + W, north=n, south=n + L, W=W, L=L, rels=rels, defs=defs)
