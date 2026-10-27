#!/usr/bin/env python3
"""Build a project: spec.yaml (+ optional plan) -> elements -> every output in out/.

Outputs (in the out dir, default DIR/model/out/, or out/plans/NAME/ with --plan;
STEM is survey.yaml `output_stem`, else the spec name slugged):
  STEM.dae      COLLADA model: SketchUp Go or Pro, File > Import
  STEM.sh3d     Sweet Home 3D home
  mesh.json     triangle meshes for render/blender_build.py
  STEM.rb       SketchUp Ruby script (Window > Ruby Console, then load '/path/to/STEM.rb')
  plan.png, view3d.png   quick previews
  check_plan.png, report.md   where measurements disagree; every MISSING and ~ value
  <room>_plan.html   2D layout page per `layout_pages:` entry of survey.yaml

Nothing is inferred. MISSING values skip their element; "~" values build in orange.
"""
import sys

from .export.check_plan import write_check_plan
from .export.dae import write_dae
from .export.mesh import write_mesh_json
from .export.previews import write_previews
from .export.report import write_report
from .export.ruby import write_ruby
from .export.sh3d import write_sh3d
from .generate.finishes import cameras, finishes
from .generate.joists import build_joists
from .generate.layout import build_layout, build_rooms
from .generate.objects import build_objects
from .generate.pipes import build_pipes
from .generate.walls import build_walls
from .materials import material_table, render_recipes
from .project import Project
from .spec.ctx import Ctx
from .spec.plan import apply_plan
from .spec.refs import zval


def build(project_dir, plan=None, out=None):
    project = Project(project_dir, out)
    spec = project.load_spec()
    cfg = project.config
    stem = project.stem(spec)
    mats = material_table(spec)
    out = project.out
    if plan:
        apply_plan(spec, plan, project.plans)
        out = out / "plans" / plan
    out.mkdir(parents=True, exist_ok=True)
    report = {"missing": [], "placeholder": [], "conflicts": [], "gaps": []}
    elements = []
    build_layout(spec, report, elements)
    build_rooms(spec, report, elements)
    build_walls(spec, report, elements)
    build_joists(spec, report, elements)
    build_pipes(spec, report, elements)
    build_objects(spec, report, elements)
    check_materials(elements, mats)
    check_sources(project, elements)
    write_ruby(out, stem, spec["name"], cfg.get("ruby_module", "Survey"), elements, mats)
    write_dae(out, stem, spec["name"], elements, mats)
    print(f"{stem}.sh3d: %d walls, %d pieces, %d rooms" % write_sh3d(
        out, stem, elements, float(cfg.get("sh3d_floor_z", 0)),
        {n for n, f in report["fixtures"].items() if f["type"] == "appliance"}, mats))
    write_mesh_json(out, elements, cameras(spec, report), *finishes(spec, report),
                    report.get("daylight", []), mats, render_recipes(spec), stem)
    write_report(out, report, elements)
    write_previews(out, elements, mats)
    write_check_plan(out, report, mats)
    from .layout2d.space_plan import write_space_plan
    for page in cfg.get("layout_pages", []):
        ceiling = zval(Ctx(spec, report, "levels"), page["ceiling"], page["ceiling"])
        write_space_plan(project.space, report, elements, ceiling, out, room=page["room"])
    print(f"{len(elements)} elements built; {len(report['conflicts'])} CONFLICTS, "
          f"{len(report['missing'])} MISSING, "
          f"{len(dict.fromkeys(report['placeholder']))} placeholder values. See {out}/report.md")


def check_materials(elements, mats):
    for el in elements:
        for m in dict.fromkeys((el["material"], el["base"])):
            if m not in mats:
                sys.exit(f"{el['name']}: unknown material {m!r} (add it to the spec's `materials:`)")


def check_sources(project, elements):
    """A spec entry's `source:` names a measurement entry folder under the project."""
    for el in elements:
        src = el["source"]
        if src is None:
            continue
        if not isinstance(src, str) or not (project.root / src).is_dir():
            sys.exit(f"{el['name']}: source {src!r} is not a folder under {project.root}")
