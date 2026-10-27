#!/usr/bin/env python3
"""Golden-master check: rebuild a project and diff every output against saved ones.

    uv run python ../builder/survey/tests/golden.py --golden DIR --project . [--extra-plan FILE]

The project must have builder-survey installed (`survey` runs from its env).

DIR holds `base/` (a base build's out/) and, per extra plan, `<plan name>/`
(that plan's out/plans/<name>/). The project is copied to a scratch dir first,
so the project's own out/ is never touched; --extra-plan files are copied into
the scratch copy's model/plans/ (a synthetic plan to exercise `--plan`).

Files compare byte for byte, except basement.sh3d: it is a zip with timestamps,
so its members are compared instead.
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
    names = sorted({p.name for p in gold.iterdir() if p.is_file()} |
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", required=True, type=Path)
    ap.add_argument("--project", required=True, type=Path)
    ap.add_argument("--extra-plan", action="append", default=[], type=Path)
    args = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="survey-golden-"))
    proj = tmp / "project"
    shutil.copytree(args.project, proj, ignore=shutil.ignore_patterns(
        ".git", ".venv", "out", "photos", "measurements", "docs", ".flux", "survey"))
    for plan in args.extra_plan:
        shutil.copy(plan, proj / "model" / "plans" / plan.name)

    runs = [("base", [], proj / "model" / "out")]
    runs += [(p.stem, ["--plan", p.stem], proj / "model" / "out" / "plans" / p.stem)
             for p in args.extra_plan]
    allbad = []
    for label, extra, out in runs:
        # The project's own env has builder-survey installed (a path dependency).
        cmd = ["uv", "run", "--project", str(args.project), "survey",
               "build", "--project", str(proj), *extra]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"{label}: build failed\n{r.stdout}\n{r.stderr}")
        gold = args.golden / label
        names, bad = diff_dirs(label, gold, out)
        allbad += bad
        print(f"{label}: {len(names)} files compared, {len(bad)} differ")
    for b in allbad:
        print("  DIFF", b)
    shutil.rmtree(tmp)
    sys.exit(1 if allbad else 0)


if __name__ == "__main__":
    main()
