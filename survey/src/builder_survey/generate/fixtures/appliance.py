"""Fixture type `appliance`: washer / dryer."""
import sys

from ...geometry import disc, local_frame
from .registry import fixture_type


@fixture_type("appliance")
def appliance_parts(ctx, p, f, z0, z1):
    """A washer (top-loader) or dryer (front door), front toward `facing`. The
    placed box is its width x depth, z to the top of the console (the raised
    control panel along the back, `console: {height, depth}`). The kick
    recess, lid, door and dial are drawn inside that box, for looks only."""
    W, D, box, to_plan = local_frame(p, f["facing"])
    ch = ctx.len(f["console"]["height"], "console.height")
    cd = ctx.len(f["console"]["depth"], "console.depth")
    zt = z1 - ch                                      # the deck, under the console
    dial = disc(to_plan, W / 2, D - cd - 1, D - cd, zt + ch / 2, min(1.25, ch / 2 - 0.5))
    kick = box(1, W - 1, 2, D, z0, z0 + 3)
    if f["kind"] == "washer":
        return {"enamel": [box(0, W, 0, D, z0 + 3, zt),
                           box(2, W - 2, 2, D - cd - 1.5, zt, zt + 0.5)],     # lid
                "appliance_grey": [box(0, W, D - cd, D, zt, z1)],
                "rubber": [kick, dial]}
    if f["kind"] == "dryer":
        h = zt - z0 - 3
        dz0, dz1 = z0 + 3 + 0.2 * h, z0 + 3 + 0.8 * h
        return {"enamel": [box(0, W, 0.75, D, z0 + 3, zt), box(0, W, D - cd, D, zt, z1),
                           box(3, W - 3, 0.25, 0.75, dz0, dz1)],              # door
                "appliance_grey": [box(4, 5, 0, 0.25, (dz0 + dz1) / 2 - 3, (dz0 + dz1) / 2 + 3)],
                "rubber": [kick, dial]}
    sys.exit(f"appliance kind {f['kind']!r}: washer or dryer")
