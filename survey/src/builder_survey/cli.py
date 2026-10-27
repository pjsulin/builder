"""survey build | render | capture, each with --project DIR."""
import argparse
import subprocess
import sys
from pathlib import Path

BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"


def main():
    ap = argparse.ArgumentParser(prog="survey", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="spec -> model/out (report, dae, sh3d, mesh.json, previews)")
    b.add_argument("--project", required=True, type=Path)
    b.add_argument("--plan", help="layer model/plans/PLAN.yaml; outputs go to out/plans/PLAN/")

    r = sub.add_parser("render", help="run Blender on out/mesh.json; options after --")
    r.add_argument("--project", required=True, type=Path)
    r.add_argument("--blender", default=BLENDER)
    r.add_argument("blender_args", nargs=argparse.REMAINDER, help="after --: --render, --quick, --plan ...")

    c = sub.add_parser("capture", help="serve the measure app")
    c.add_argument("--project", required=True, type=Path)
    c.add_argument("--port", type=int, default=8000)

    args = ap.parse_args()
    if args.cmd == "build":
        from .build import build
        build(args.project, args.plan)
    elif args.cmd == "render":
        script = Path(__file__).parent / "render" / "blender_build.py"
        extra = args.blender_args[1:] if args.blender_args[:1] == ["--"] else args.blender_args
        if not Path(args.blender).is_file():
            sys.exit(f"survey render: no Blender at {args.blender} (use --blender PATH)")
        cmd = [args.blender, "-b", "-P", str(script), "--", "--project", str(args.project.resolve()), *extra]
        sys.exit(subprocess.run(cmd).returncode)
    else:
        from .capture.serve import serve
        serve(args.project, args.port)
