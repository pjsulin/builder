"""Pipes: corners and runs, placed by face or centre."""
import math
import sys

from ..elements import element
from ..geometry import xy
from ..materials import MATERIALS
from ..spec.checks import TOLERANCE, conflict
from ..spec.ctx import Blocked, Ctx, Missing
from ..spec.refs import REF_RE, edge_value, zval
from ..units import ftin


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
                                                "b": [*xy(b[0], b[1]), b[2]], "r": rad}],
                               kind="pipe"))
    report["pipes"] = runs
    report["pipe_corners"] = corners
