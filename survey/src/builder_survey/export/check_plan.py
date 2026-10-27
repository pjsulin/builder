"""check_plan.png: rooms, implied walls and every failed check drawn where it happens."""
from ..materials import rgb
from ..spec.checks import SEVERITY, severity
from ..units import ftin


def write_check_plan(out, report, mats):
    """Plan for finding where measurements don't line up: rooms with their
    sizes, the wall each pair of neighbours implies, and every failed check
    drawn where it happens, coloured by how far off it is."""
    placed = report.get("layout")
    if not placed:
        return
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle

    def box(r, **kw):  # (west, north, east, south) in inches -> patch in feet
        w, n, e, s = (v / 12 for v in r)
        return Rectangle((w, -s), e - w, s - n, **kw)

    fig, ax = plt.subplots(figsize=(11, 13))
    for name, p in placed.items():
        ax.add_patch(box((p["west"], p["north"], p["east"], p["south"]), fc="#f4f4f4",
                         ec="#555", lw=1, ls="--" if p["placeholder"] else "-"))
        cx, cy = (p["west"] + p["east"]) / 24, -(p["north"] + p["south"]) / 24
        ax.text(cx, cy, f"{name}{' (~)' if p['placeholder'] else ''}\n"
                f"{ftin(p['W'])} x {ftin(p['L'])}", ha="center", va="center", fontsize=9)

    fixtures = report.get("fixtures", {})
    for name, f in fixtures.items():
        ax.add_patch(box((f["west"], f["north"], f["east"], f["south"]), fc="#e3cfa8",
                         ec="#8b5a2b", lw=0.8, ls="--" if f["placeholder"] else "-",
                         hatch="///" if f["type"] == "stairs" else None, alpha=0.8))
        ax.text((f["west"] + f["east"]) / 24, -(f["north"] + f["south"]) / 24,
                f"{name}{' (~)' if f['placeholder'] else ''}\n{ftin(f['W'])} x {ftin(f['L'])}",
                ha="center", va="center", fontsize=7, color="#5a3a1a",
                bbox=dict(fc="white", ec="none", pad=0.5, alpha=0.7))

    for g in report["gaps"]:
        color = severity(g["short"])[1] if g["note"] else "#555"
        ax.add_patch(box(g["rect"], fc=color if g["note"] else "#c8c8c8", ec="none",
                         alpha=0.9 if g["note"] else 0.7))
        w, n, e, s = g["rect"]
        vertical = g["dirn"] == "east"
        ax.text((w + e) / 24, -(n + s) / 24, ftin(g["gap"]), ha="center", va="center",
                fontsize=7, color=color, rotation=90 if vertical else 0,
                bbox=dict(fc="white", ec="none", pad=0.5, alpha=0.8))

    doors = {d["name"]: d for d in report.get("doors", []) if "across" in d}
    for d in doors.values():  # clear opening in brown, frames in tan
        c0, c1 = d["across"]
        ns = d["side"] in ("east", "west")
        for (a, b), fc in (((d["lo"] - d["frame"], d["hi"] + d["frame"]), "#c8a26a"),
                           ((d["lo"], d["hi"]), "#7a4a1a")):
            ax.add_patch(box((c0, a, c1, b) if ns else (a, c0, b, c1), fc=fc, ec="none"))
        lx, ly = ((c0 + c1) / 24, -(d["lo"] + d["hi"]) / 24) if ns else \
                 ((d["lo"] + d["hi"]) / 24, -(c0 + c1) / 24)
        ax.text(lx, ly, f"{d['name']} {ftin(d['width'])}", ha="center", va="center", fontsize=6,
                color="#7a4a1a", rotation=90 if ns else 0,
                bbox=dict(fc="white", ec="none", pad=0.3, alpha=0.8))

    # Pipes: built runs as lines in their material's colour (dashed = uses a ~
    # value); every corner placed in plan as a dot, so measuring shows progress.
    for r in report.get("pipes", []):
        if "a" in r:
            ax.plot([r["a"][0] / 12, r["b"][0] / 12], [-r["a"][1] / 12, -r["b"][1] / 12],
                    color=rgb(mats, r["material"]), lw=3, ls="--" if r["placeholder"] else "-",
                    solid_capstyle="butt", zorder=5)
    for key, (vals, ph) in report.get("pipe_corners", {}).items():
        if vals[0] is None or vals[1] is None:
            continue
        e, s = vals[0][0] / 12, -vals[1][0] / 12
        ax.plot([e], [s], "o", ms=5, mfc="white", mec="#333", zorder=6)
        ax.text(e + 0.2, s + 0.2, key.split(".", 1)[1] + (" (~)" if ph else ""), fontsize=6,
                va="bottom", color="#333", zorder=6)

    for c in report["conflicts"]:
        geom = c["geom"]
        if not geom:
            continue
        color = severity(c["off"])[1]
        if geom["kind"] == "area":
            ax.add_patch(box(geom["rect"], fc=color, ec=color, alpha=0.5, lw=2))
            continue
        if geom["kind"] == "door":
            d = doors.get(geom["door"])
            if not d:
                continue
            label = f"door {geom['door']}.{geom['edge']}\noff {ftin(abs(c['off']))}"
            u = sum(d["across"]) / 24
            if d["side"] in ("east", "west"):
                ys = (-geom["placed"] / 12, -geom["got"] / 12)
                ax.annotate("", (u, ys[1]), (u, ys[0]), arrowprops=dict(arrowstyle="<->", color=color, lw=2))
                ax.text(u + 0.5, sum(ys) / 2, label, ha="left", va="center", color=color,
                        fontsize=8, weight="bold")
            else:
                xs = (geom["placed"] / 12, geom["got"] / 12)
                ax.annotate("", (xs[1], -u), (xs[0], -u), arrowprops=dict(arrowstyle="<->", color=color, lw=2))
                ax.text(sum(xs) / 2, -u - 0.5, label, ha="center", va="top", color=color,
                        fontsize=8, weight="bold")
            continue
        p = placed.get(geom["room"]) or fixtures[geom["room"]]
        label = f"{geom['room']}.{geom['edge']}\noff {ftin(abs(c['off']))}"
        if geom["edge"] in ("west", "east"):
            y = -(p["north"] + p["south"]) / 24
            xs = (geom["placed"] / 12, geom["got"] / 12)
            ax.annotate("", (xs[1], y), (xs[0], y), arrowprops=dict(arrowstyle="<->", color=color, lw=2))
            ax.plot([xs[1]] * 2, [y - 1.5, y + 1.5], color=color, lw=2, ls=":")
            ax.text(sum(xs) / 2, y + 0.4, label, ha="center", va="bottom", color=color,
                    fontsize=9, weight="bold")
        else:
            x = (p["west"] + p["east"]) / 24
            ys = (-geom["placed"] / 12, -geom["got"] / 12)
            ax.annotate("", (x, ys[1]), (x, ys[0]), arrowprops=dict(arrowstyle="<->", color=color, lw=2))
            ax.plot([x - 1.5, x + 1.5], [ys[1]] * 2, color=color, lw=2, ls=":")
            ax.text(x + 1.8, sum(ys) / 2 - 0.8, label, ha="left", va="top", color=color,
                    fontsize=9, weight="bold")

    handles = [Rectangle((0, 0), 1, 1, fc=c, alpha=0.6) for _, _, c in SEVERITY]
    ax.legend(handles, [f"{n} (≤ {lim:g}\")" if lim != float("inf") else f"{n} (> 6\")"
                        for lim, n, _ in SEVERITY], loc="lower right", title="miss")
    ax.set_aspect("equal")
    ax.autoscale()
    ax.margins(0.04)
    ax.grid(True, lw=0.3)
    ax.set_xlabel("east (ft)")
    ax.set_ylabel("north (ft)  [origin = office inside NW corner]")
    ax.set_title("Check plan — numbers in walls = thickness the measurements imply\n"
                 "dashed room = uses a ~ value; arrows = where a check lands vs. where the room was placed")
    fig.savefig(out / "check_plan.png", dpi=110, bbox_inches="tight")
    plt.close(fig)
