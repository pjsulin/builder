"""A survey project: the directory that supplies the data and receives the outputs.

    <project>/model/spec.yaml     the spec (only source of geometry)
    <project>/model/plans/        plans layered onto the spec
    <project>/model/space/        2D layout page pieces (<room>.json)
    <project>/model/out/          build outputs (plans in out/plans/NAME/); see out_dir
    <project>/measure/checklist.yaml, photos/, measurements/   capture app data
    <project>/survey.yaml         optional settings for the exporters and layout pages

survey.yaml keys:
    output_stem: house       file name stem of the .dae, .sh3d, .rb, .builder and .blend
                             outputs; default the spec `name:` slugged (lowercase, -)
    out_dir: model/out       where outputs go, relative to the project; --out overrides
    ruby_module: Survey      SketchUp Ruby module name (and attribute dictionary,
                             lower-cased); default Survey
    sh3d_floor_z: 0          z (inches) of Sweet Home 3D's floor: nothing below is
                             kept in the .sh3d; default 0
    layout_pages:            2D layout pages written as out/<room>_plan.html
      - room: bathroom
        ceiling: joist_bottom    a spec level: the ceiling height above the room's floor
"""
import re
import sys
from pathlib import Path

import yaml

CONFIG_KEYS = {"ruby_module", "sh3d_floor_z", "layout_pages", "output_stem", "out_dir"}


def slug(name):
    """'Elm St garage' -> 'elm-st-garage'."""
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not s:
        sys.exit(f"spec name {name!r} gives an empty file name; set output_stem in survey.yaml")
    return s


class Project:
    def __init__(self, root, out=None):
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            sys.exit(f"--project {root}: not a directory")
        self.model = self.root / "model"
        self.spec_path = self.model / "spec.yaml"
        self.plans = self.model / "plans"
        self.space = self.model / "space"
        self.measurements = self.root / "measurements"
        self.photos = self.root / "photos"
        self.checklist = self.root / "measure" / "checklist.yaml"
        if not self.spec_path.is_file():
            sys.exit(f"--project {root}: no {self.spec_path.relative_to(self.root)}")
        cfg_path = self.root / "survey.yaml"
        self.config = (yaml.safe_load(cfg_path.read_text()) or {}) if cfg_path.is_file() else {}
        unknown = set(self.config) - CONFIG_KEYS
        if unknown:
            sys.exit(f"survey.yaml: unknown keys {sorted(unknown)}; known: {sorted(CONFIG_KEYS)}")
        if out is not None:
            self.out = Path(out).resolve()
        else:
            self.out = self.root / self.config.get("out_dir", "model/out")

    def load_spec(self):
        spec = yaml.safe_load(self.spec_path.read_text())
        if not spec.get("name"):
            sys.exit(f"{self.spec_path}: needs a top-level `name:` (shown in the DAE and the SketchUp model)")
        return spec

    def stem(self, spec):
        stem = self.config.get("output_stem")
        if stem is None:
            return slug(spec["name"])
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", str(stem)):
            sys.exit(f"survey.yaml: output_stem {stem!r} is not a plain file name")
        return str(stem)
