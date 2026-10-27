#!/usr/bin/env python3
"""Golden-master check: rebuild a project and diff every output against saved ones.

    uv run python ../builder/survey/tests/golden.py --golden DIR --project . [--extra-plan FILE] [--write]

Run it from an environment with builder-survey installed (the project's own
`uv run`, or `uv run --project builder/survey`): the build runs as
`python -m builder_survey.cli` with this interpreter.

DIR holds `base/` (a base build's out/) and, per extra plan, `<plan name>/`
(that plan's out/plans/<name>/). The project is copied to a scratch dir first,
so the project's own out/ is never touched; --extra-plan files are copied into
the scratch copy's model/plans/ (a synthetic plan to exercise `--plan`).

Files compare byte for byte, except `.sh3d`: it is a zip with timestamps, so
its members are compared instead.

--write prints the differences, then copies the new outputs over DIR so the
reference matches. Use it when the differences are intended, and list each one
with its reason in the commit that updates DIR.
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


def zip_members(path):
    with zipfile.ZipFile(path) as z:
        return {n: z.read(n) for n in sorted(z.namelist())}


def diff_dirs(label, gold, new):
    bad = []
    names = sorted(({p.name for p in gold.iterdir() if p.is_file()} if gold.is_dir() else set()) |
                   {p.name for p in new.iterdir() if p.is_file()})
    for n in names:
        g, b = gold / n, new / n
        if not g.exists() or not b.exists():
            bad.append(f"{label}/{n}: {'missing in golden' if not g.exists() else 'not built'}")
        elif n.endswith(".sh3d"):
            gm, bm = zip_members(g), zip_members(b)
            if gm != bm:
                for m in sorted(set(gm) | set(bm)):
                    if gm.get(m) != bm.get(m):
                        bad.append(f"{label}/{n}:{m} differs")
        elif g.read_bytes() != b.read_bytes():
            bad.append(f"{label}/{n} differs")
    return names, bad


def write_reference(gold, new):
    """Replace gold's files with new's (files only; nothing else is kept)."""
    if gold.is_dir():
        for p in gold.iterdir():
            if p.is_file():
                p.unlink()
    gold.mkdir(parents=True, exist_ok=True)
    for p in sorted(new.iterdir()):
        if p.is_file():
            shutil.copy(p, gold / p.name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", required=True, type=Path)
    ap.add_argument("--project", required=True, type=Path)
    ap.add_argument("--extra-plan", action="append", default=[], type=Path)
    ap.add_argument("--write", action="store_true", help="copy the new outputs over --golden")
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="survey-golden-"))
    proj = tmp / "project"
    shutil.copytree(args.project, proj, ignore=shutil.ignore_patterns(
        ".git", ".venv", "out", "photos", "measurements", "docs", ".flux", "survey"))
    # Entry folders without their files, so `source:` keys still resolve.
    measurements = args.project / "measurements"
    if measurements.is_dir():
        for d in measurements.rglob("*"):
            if d.is_dir():
                (proj / d.relative_to(args.project)).mkdir(parents=True, exist_ok=True)
    for plan in args.extra_plan:
        shutil.copy(plan, proj / "model" / "plans" / plan.name)

    runs = [("base", [], proj / "model" / "out")]
    runs += [(p.stem, ["--plan", p.stem], proj / "model" / "out" / "plans" / p.stem)
             for p in args.extra_plan]
    allbad = []
    for label, extra, out in runs:
        cmd = [sys.executable, "-m", "builder_survey.cli", "build", "--project", str(proj), *extra]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"{label}: build failed\n{r.stdout}\n{r.stderr}")
        gold = args.golden / label
        names, bad = diff_dirs(label, gold, out)
        allbad += bad
        print(f"{label}: {len(names)} files compared, {len(bad)} differ")
        if args.write:
            write_reference(gold, out)
    for b in allbad:
        print("  DIFF", b)
    if args.write and allbad:
        print(f"wrote {args.golden}")
    shutil.rmtree(tmp)
    sys.exit(1 if allbad and not args.write else 0)


if __name__ == "__main__":
    main()
