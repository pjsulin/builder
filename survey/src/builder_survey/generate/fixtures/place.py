"""Fixtures placed like rooms (edges, size, checks); they make no walls."""
import sys

from ...elements import element
from ...spec.ctx import Blocked, Ctx, Missing
from ...spec.refs import check_rels, place_rect, zval
from .registry import TYPES


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
                if f["type"] not in TYPES:
                    sys.exit(f"layout.fixtures.{name}: unknown type {f['type']!r} "
                             f"(known: {', '.join(sorted(TYPES))})")
                builder, own_z = TYPES[f["type"]]
                if own_z:
                    built, z = builder(ctx, p, f)
                else:
                    z = [zval(ctx, v, f"z[{i}]") for i, v in enumerate(f["z"])]
                    built = builder(ctx, p, f, *z)
                p["z"] = tuple(z)
                groups = built if isinstance(built, dict) else None   # {material: parts}
                parts = built
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
