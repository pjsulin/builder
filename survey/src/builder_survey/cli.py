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
    b.add_argument("--out", type=Path, help="out dir (default: survey.yaml out_dir, else model/out)")

    r = sub.add_parser("render", help="run Blender on out/mesh.json; options after --")
    r.add_argument("--project", required=True, type=Path)
    r.add_argument("--out", type=Path, help="out dir (default: survey.yaml out_dir, else model/out)")
    r.add_argument("--blender", default=BLENDER)
    r.add_argument("blender_args", nargs=argparse.REMAINDER, help="after --: --render, --quick, --plan ...")

    c = sub.add_parser("capture", help="serve the phone capture page")
    c.add_argument("--project", required=True, type=Path)
    c.add_argument("--port", type=int, default=8000)
    c.add_argument("--cert", type=Path, help="TLS certificate (PEM); with --key serves HTTPS")
    c.add_argument("--key", type=Path, help="TLS private key (PEM)")

    e = sub.add_parser("entries", help="list measurement entries with transcripts")
    e.add_argument("--project", required=True, type=Path)
    e.add_argument("--uncited", action="store_true", help="only entries the spec and plans don't cite")

    args = ap.parse_args()
    if args.cmd == "build":
        from .build import build
        build(args.project, args.plan, args.out)
    elif args.cmd == "render":
        script = Path(__file__).parent / "render" / "blender_build.py"
        extra = args.blender_args[1:] if args.blender_args[:1] == ["--"] else args.blender_args
        if not Path(args.blender).is_file():
            sys.exit(f"survey render: no Blender at {args.blender} (use --blender PATH)")
        from .project import Project
        out = Project(args.project, args.out).out
        cmd = [args.blender, "-b", "-P", str(script), "--", "--project", str(args.project.resolve()),
               "--out", str(out), *extra]
        sys.exit(subprocess.run(cmd).returncode)
    elif args.cmd == "entries":
        from .capture.entries import print_entries
        from .project import Project
        print_entries(Project(args.project), args.uncited)
    else:
        from .capture.serve import serve
        serve(args.project, args.port, args.cert, args.key)


if __name__ == "__main__":
    main()
