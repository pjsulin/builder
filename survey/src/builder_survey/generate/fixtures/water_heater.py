"""Fixture type `water_heater`."""
import math

from ...geometry import local_frame, prism, xy


def water_heater_parts(ctx, p, f, z0, z1):
    """An upright tank inscribed in the placed rectangle: jacket, top cap, base
    ring, and on the front (`facing`) the burner access cover and the gas
    control valve, which stick out ~3" past the jacket as on the real one."""
    W, D, box, to_plan = local_frame(p, f["facing"])
    rad, cu, cv = min(W, D) / 2, W / 2, D / 2

    def ring(rr, za, zb, seg=32):
        return prism([xy(*to_plan(cu + rr * math.cos(2 * math.pi * i / seg),
                                  cv + rr * math.sin(2 * math.pi * i / seg))) for i in range(seg)],
                     za, zb)
    return {"wh_jacket": [ring(rad, z0 + 1.5, z1 - 2), ring(rad - 0.15, z1 - 2, z1)],
            "steel": [ring(rad - 0.3, z0, z0 + 1.5), box(cu - 3.5, cu + 3.5, -0.3, 1.5, z0 + 3, z0 + 9)],
            "rubber": [box(cu - 2, cu + 2, -2.5, 3, z0 + 11, z0 + 16)]}
