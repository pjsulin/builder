"""plan.png and view3d.png: quick matplotlib previews."""
from ..materials import rgb


def write_previews(out, elements):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon
    from mpl_toolkits.mplot3d.art3d import Line3DCollection, Poly3DCollection

    # Plan: draw low things first so walls sit on top.
    fig, ax = plt.subplots(figsize=(10, 10))
    order = sorted(elements, key=lambda el: max(
        (p["z"][1] for p in el["parts"] if p["kind"] == "prism"), default=0))
    for el in order:
        for p in el["parts"]:
            if p["kind"] == "prism":
                pts = [(x / 12, y / 12) for x, y in p["pts"]]
                ax.add_patch(Polygon(pts, closed=True, fc=rgb(el["material"], 0.6),
                                     ec="k", lw=0.5))
            elif p["kind"] == "mesh":
                xs, ys = [v[0] / 12 for v in p["verts"]], [v[1] / 12 for v in p["verts"]]
                ax.add_patch(Polygon([(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)),
                                      (min(xs), max(ys))], closed=True,
                                     fc=rgb(el["material"], 0.6), ec="k", lw=0.5))
            else:
                ax.plot([p["a"][0] / 12, p["b"][0] / 12], [p["a"][1] / 12, p["b"][1] / 12],
                        color=rgb(el["material"]), lw=2)
    for el in elements:
        if "label" in el:
            ax.text(el["label"][0] / 12, el["label"][1] / 12, el["name"].removesuffix(" floor"),
                    ha="center", va="center", fontsize=10)
    ax.set_aspect("equal")
    ax.autoscale()
    ax.grid(True, lw=0.3)
    ax.set_xlabel("east (ft)")
    ax.set_ylabel("north (ft)  [origin = office inside NW corner]")
    ax.set_title("Plan preview (orange = placeholder values)")
    fig.savefig(out / "plan.png", dpi=110, bbox_inches="tight")
    plt.close(fig)

    # Axonometric. autolim=False on every collection: Poly3DCollection pads a
    # ragged face list (the 24/32-gon pipe tops with 4-gon sides) with
    # np.empty, i.e. uninitialised memory, and add_collection3d's autolim
    # feeds the padding into the data limits. A stale value above ~1.76e308
    # overflows the 1/48 view margin to inf and set_zlim raises "Axis limits
    # cannot be NaN or Inf" (seen ~1 build in 100 on Linux). The limits are
    # set below from the real corners, so autolim has nothing to add.
    fig = plt.figure(figsize=(11, 9))
    ax = fig.add_subplot(projection="3d")
    lo, hi = [1e9] * 3, [-1e9] * 3
    for el in elements:
        for p in el["parts"]:
            if p["kind"] == "prism":
                z0, z1 = p["z"]
                bot = [(x, y, z0) for x, y in p["pts"]]
                top = [(x, y, z) for (x, y), z in zip(p["pts"], p.get("ztop") or [z1] * len(bot))]
                n = len(bot)
                faces = [bot, top] + [[bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]]
                                      for i in range(n)]
                ax.add_collection3d(Poly3DCollection(
                    faces, facecolor=rgb(el["material"], 0.85), edgecolor=(0, 0, 0, 0.3), lw=0.3),
                    autolim=False)
                corners = bot + top
            elif p["kind"] == "mesh":
                v = p["verts"]
                ax.add_collection3d(Poly3DCollection(
                    [[v[i] for i in t] for t in p["tris"]], facecolor=rgb(el["material"], 0.85),
                    edgecolor="none"), autolim=False)
                corners = v
            else:
                ax.add_collection3d(Line3DCollection([[p["a"], p["b"]]],
                                                     colors=[rgb(el["material"])], lw=2),
                                     autolim=False)
                corners = [p["a"], p["b"]]
            for c in corners:
                for i in range(3):
                    lo[i], hi[i] = min(lo[i], c[i]), max(hi[i], c[i])
    span = max(h - l for l, h in zip(lo, hi)) or 1
    for setter, l, h in zip((ax.set_xlim, ax.set_ylim, ax.set_zlim), lo, hi):
        mid = (l + h) / 2
        setter(mid - span / 2, mid + span / 2)
    ax.view_init(elev=35, azim=-60)
    ax.set_axis_off()
    ax.set_title("3D preview (inches; orange = placeholder values)")
    fig.savefig(out / "view3d.png", dpi=110, bbox_inches="tight")
    plt.close(fig)
