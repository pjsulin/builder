"""Floor joists from the spec's `joists:` regions."""
from ..elements import element
from ..geometry import prism, rect
from ..spec.ctx import Blocked, Ctx, Missing
from ..spec.refs import edge_value, zval


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
