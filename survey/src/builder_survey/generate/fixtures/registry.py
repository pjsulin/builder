"""Fixture type registry.

A type module registers its builder with a decorator; `place_fixtures` looks the
spec's `type:` up here, so a new type is one new module (imported in __init__).

    @fixture_type("sauna")                 builder(ctx, p, f, z0, z1)
    @fixture_type("stairs", own_z=True)    builder(ctx, p, f) -> (built, (z0, z1))

z0, z1 are the fixture's `z: [bottom, top]`, resolved. `built` is a list of
parts (one material: the fixture's `material`, default wood) or a dict
{material: parts}.
"""
import sys

TYPES = {}


def fixture_type(name, own_z=False):
    def register(builder):
        if name in TYPES:
            sys.exit(f"fixture type {name!r} is registered twice")
        TYPES[name] = (builder, own_z)
        return builder
    return register
