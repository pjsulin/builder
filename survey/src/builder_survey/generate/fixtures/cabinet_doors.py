"""Fixture type `cabinet_doors`."""
import sys

from ...geometry import local_frame


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
