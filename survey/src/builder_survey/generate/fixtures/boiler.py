"""Fixture type `boiler`."""
from ...geometry import local_frame
from .registry import fixture_type


@fixture_type("boiler")
def boiler_parts(ctx, p, f, z0, z1):
    """A cabinet boiler, front toward `facing`: jacket, front access panel, a
    top cover with a small overhang, a recessed base, a name plate. All inside
    the measured box."""
    W, D, box, _ = local_frame(p, f["facing"])
    return {"boiler_green": [box(0, W, 0.35, D, z0 + 3, z1 - 1.5),
                             box(0.5, W - 0.5, 0.1, 0.35, z0 + 4, z1 - 3),
                             box(0, W, 0, D, z1 - 1.5, z1)],
            "steel": [box(1, W - 1, 1, D, z0, z0 + 3)],
            "enamel": [box(W / 2 - 4, W / 2 + 4, 0, 0.1, z1 - 12, z1 - 9.5)]}
