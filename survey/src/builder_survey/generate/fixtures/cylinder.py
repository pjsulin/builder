"""Fixture type `cylinder`: an upright 24-sided cylinder inscribed in the placed rectangle."""
import math

from ...geometry import prism, xy
from .registry import fixture_type


@fixture_type("cylinder")
def cylinder_parts(ctx, p, f, z0, z1):
    ce, cs = (p["west"] + p["east"]) / 2, (p["north"] + p["south"]) / 2
    re_, rs = (p["east"] - p["west"]) / 2, (p["south"] - p["north"]) / 2
    pts = [xy(ce + re_ * math.cos(2 * math.pi * i / 24),
              cs + rs * math.sin(2 * math.pi * i / 24)) for i in range(24)]
    return [prism(pts, z0, z1)]
