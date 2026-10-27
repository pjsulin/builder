"""Fixtures placed like rooms (edges, size, checks); they make no walls."""
import math
import sys

from ...elements import element
from .appliance import appliance_parts
from .boiler import boiler_parts
from .cabinet_doors import cabinet_door_parts
from .sauna import sauna_parts
from .shelving import shelving_parts
from .stairs import stair_detail, stair_parts
from .water_heater import water_heater_parts
from ...geometry import prism, rect, xy
from ...spec.ctx import Blocked, Ctx, Missing
from ...spec.refs import check_rels, place_rect, zval


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
