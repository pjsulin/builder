"""Loose objects from the spec's `objects:`."""
import sys

from ..elements import element
from ..geometry import prism, rect, xy
from ..spec.ctx import Ctx, Missing


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
        out.append(element(name, o["phase"], mat, ctx, parts, kind="object"))
