"""Fixture type `shelving`."""
from ...geometry import local_frame
from .registry import fixture_type


@fixture_type("shelving")
def shelving_parts(ctx, p, f, z0, z1):
    """An open shelving unit, front toward `facing`: an angle-iron post at each
    corner (casters under them), boards at `shelves` heights (their tops,
    from the floor) on an iron rail front and back."""
    W, D, box, _ = local_frame(p, f["facing"])
    post = ctx.len(f["post"], "post")
    board = ctx.len(f["board"], "board")
    caster = ctx.len(f["caster"], "caster")
    iron, wood, rubber = [], [], []
    for u0 in (0, W - post):
        for v0 in (0, D - post):
            iron.append(box(u0, u0 + post, v0, v0 + post, z0 + caster, z1))
            rubber.append(box(u0, u0 + post, v0, v0 + post, z0, z0 + caster))
    for i, h in enumerate(f["shelves"]):
        zt = z0 + ctx.len(h, f"shelves[{i}]")
        wood.append(box(post, W - post, 0, D, zt - board, zt))
        for v0 in (0, D - post):
            iron.append(box(post, W - post, v0, v0 + post, zt - board - post, zt - board))
    return {f.get("frame_material", "iron"): iron, f.get("material", "walnut"): wood,
            "rubber": rubber}
