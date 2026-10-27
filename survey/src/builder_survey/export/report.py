"""report.md: CONFLICTS, placed rooms, implied walls, MISSING and ~ values."""
from ..units import ftin


def write_report(out, report, elements):
    lines = ["# Model build report", "",
             f"Built {len(elements)} elements "
             f"({sum(e['placeholder'] for e in elements)} using placeholder values).", "",
             f"## CONFLICTS ({len(report['conflicts'])}) — relationships that disagree; "
             "nothing was adjusted", ""]
    lines += [f"- [ ] **{c['severity']}** {c['text']}" for c in sorted(
        report["conflicts"], key=lambda c: -abs(c["off"]) if c["off"] is not None else -1e9)] \
        or ["(none)"]
    lines += ["", "Severity: minor ≤ 2\" (block wander), check ≤ 6\", major > 6\". "
              "See out/check_plan.png."]
    if report.get("layout"):
        lines += ["", "## Layout — rooms placed (inside faces, from the origin)", "",
                  "| room | W x L | west | east | north | south |",
                  "|---|---|---|---|---|---|"]
        lines += [f"| {n}{' (~)' if p['placeholder'] else ''} | {ftin(p['W'])} x {ftin(p['L'])} | "
                  f"{ftin(p['west'])} | {ftin(p['east'])} | {ftin(p['north'])} | {ftin(p['south'])} |"
                  for n, p in report["layout"].items()]
        lines += ["", "## Walls implied between rooms (gap between inside faces)", "",
                  "| between | | wall | along | |", "|---|---|---|---|---|"]
        lines += [f"| {g['a']} | {g['b']} ({g['dirn']} of {g['a']}) | {ftin(g['gap'])} | "
                  f"{ftin(g['run'])} | {g['note']} |" for g in report["gaps"]]
    if report.get("fixtures"):
        lines += ["", "## Fixtures (stairs, landing, shelving)", "",
                  "| fixture | W x L | west | east | north | south | z |",
                  "|---|---|---|---|---|---|---|"]
        lines += [f"| {n}{' (~)' if f['placeholder'] else ''} | {ftin(f['W'])} x {ftin(f['L'])} | "
                  f"{ftin(f['west'])} | {ftin(f['east'])} | {ftin(f['north'])} | {ftin(f['south'])} | "
                  f"{ftin(f['z'][0])}–{ftin(f['z'][1])} |" for n, f in report["fixtures"].items()]
    if report.get("doors"):
        lines += ["", "## Doors (clear opening; frame is on each side)", "",
                  "| door | wall | opening from | to | width | frame | bottom | height |",
                  "|---|---|---|---|---|---|---|---|"]
        lines += [f"| {d['name']}{' (~)' if d['placeholder'] else ''} | {d['room']}.{d['side']} | "
                  f"{ftin(d['lo'])} | {ftin(d['hi'])} | {ftin(d['width'])} | {ftin(d['frame'])} | "
                  f"{ftin(d['zb'])} | {ftin(d['height'])} |" for d in report["doors"]]
    if report.get("pipes"):
        lines += ["", "## Pipes (runs between corners; a run builds once both ends and its "
                  "diameter are known)", "",
                  "| pipe | run | material | diameter | from [east, south, z] | to | built |",
                  "|---|---|---|---|---|---|---|"]
        for r in report["pipes"]:
            ends = " | ".join(", ".join(ftin(v) for v in r[k]) if k in r else "" for k in ("a", "b"))
            status = "yes" + (" (~)" if r["placeholder"] else "") if "a" in r else \
                "waits on " + ", ".join(f"`{w}`" for w in r["waits"])
            mat = "not given" if r["material"] == "pipe" else r["material"]
            lines.append(f"| {r['pipe']} | {r['frm']} → {r['to']} | {mat} | "
                         f"{ftin(r['d']) if r['d'] is not None else '—'} | {ends} | {status} |")
    lines += ["", f"## MISSING ({len(report['missing'])}) — element skipped until filled", ""]
    lines += [f"- [ ] `{m}`" for m in report["missing"]] or ["(none)"]
    lines += ["", f"## PLACEHOLDER ({len(report['placeholder'])}) — built in orange, needs measuring", ""]
    lines += [f"- [ ] `{p}`" for p in dict.fromkeys(report["placeholder"])] or ["(none)"]
    (out / "report.md").write_text("\n".join(lines) + "\n")
