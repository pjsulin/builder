"""Fixture type `box`: a prism on the placed rectangle, `z: [bottom, top]`."""
from ...geometry import prism, rect
from .registry import fixture_type


@fixture_type("box")
def box_parts(ctx, p, f, z0, z1):
    return [prism(rect(p["west"], p["north"], p["east"], p["south"]), z0, z1)]
