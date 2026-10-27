"""Fixture type `sauna`."""
import sys

from ...geometry import local_frame
from ...units import ftin
from .registry import fixture_type


@fixture_type("sauna")
def sauna_parts(ctx, p, f, z0, z1):
    """A sauna cabin in the placed rectangle, its front (door side) toward
    `facing`. Parts are laid out in the cabin's own frame: u across the front
    from its left end (as seen standing outside, facing it), v from the front
    toward the back. Returns {material: parts}."""
    width, depth, box, _ = local_frame(p, f["facing"])
    t = ctx.len(f["wall"], "wall")
    d, win = f["door"], f["window"]
    du0 = ctx.len(d["from_left"], "door.from_left")
    du1 = du0 + ctx.len(d["width"], "door.width")
    dz1 = z0 + ctx.len(d["height"], "door.height")
    wu1 = width - ctx.len(win["from_right"], "window.from_right")
    wu0 = wu1 - ctx.len(win["width"], "window.width")
    wz0 = z0 + ctx.len(win["bottom"], "window.bottom")
    wz1 = wz0 + ctx.len(win["height"], "window.height")
    if not (0 < du0 < du1 < wu0 < wu1 < width and dz1 < z1 and wz1 < z1):
        sys.exit(f"layout.fixtures: sauna door / window don't fit its {ftin(width)} front")
    # Pieces meet face to face and never overlap: overlapping solids leave
    # coincident surfaces, which render as black streaks.
    trim, band = 1.5, 3.0   # frame inside each opening; top trim band (within the height)
    zt = z1 - band          # walls stop under the top trim
    wood = [box(t, width - t, depth - t, depth, z0, zt),       # back
            box(0, t, 0, depth, z0, zt), box(width - t, width, 0, depth, z0, zt),  # sides
            box(t, width - t, t, depth - t, zt - t, zt),        # roof
            box(t, du0, 0, t, z0, zt), box(du1, wu0, 0, t, z0, zt),               # front
            box(wu1, width - t, 0, t, z0, zt), box(du0, du1, 0, t, dz1, zt),
            box(wu0, wu1, 0, t, z0, wz0), box(wu0, wu1, 0, t, wz1, zt),
            box(-1, width + 1, -1, depth, zt, z1)]               # top trim
    glass = []
    for u0, u1, za, zb in ((du0, du1, z0, dz1), (wu0, wu1, wz0, wz1)):
        wood += [box(u0, u0 + trim, -0.75, t, za, zb), box(u1 - trim, u1, -0.75, t, za, zb),
                 box(u0 + trim, u1 - trim, -0.75, t, zb - trim, zb),
                 box(u0 + trim, u1 - trim, -0.75, t, za, za + trim)]
        glass.append(box(u0 + trim, u1 - trim, t / 2 - 0.25, t / 2 + 0.25, za + trim, zb - trim))
    glow = []
    for i, b in enumerate(f["benches"]):      # depth from the back wall; 2" boards
        top = z0 + ctx.len(b["top"], f"benches[{i}].top")
        reach = ctx.len(b["depth"], f"benches[{i}].depth")
        front = depth - t - reach
        wood += [box(t, width - t, front, depth - t, top - 2, top),
                 box(t, width - t, front, front + 1, z0 if i == 0 else top - 12, top - 2)]  # apron
        glow.append(box(t + 2, width - t - 2, depth - t - 1, depth - t, top + 14, top + 15))  # LED strip
                                                                    # on the back wall above it
    return {"sauna_wood": wood, "glass": glass, "glow": glow}
