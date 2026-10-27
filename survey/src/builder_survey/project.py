"""A survey project: the directory that supplies the data and receives the outputs.

    <project>/model/spec.yaml     the spec (only source of geometry)
    <project>/model/plans/        plans layered onto the spec
    <project>/model/space/        2D layout page pieces (<room>.json)
    <project>/model/out/          build outputs (plans in out/plans/NAME/)
    <project>/measure/checklist.yaml, photos/, measurements/   capture app data
    <project>/survey.yaml         optional settings for the exporters and layout pages

survey.yaml keys:
    ruby_module: Pierson     SketchUp Ruby module name (and attribute dictionary,
                             lower-cased); default Survey
    sh3d_floor_z: 0          z (inches) of Sweet Home 3D's floor: nothing below is
                             kept in basement.sh3d; default 0
    layout_pages:            2D layout pages written as out/<room>_plan.html
      - room: bathroom
        ceiling: joist_bottom    a spec level: the ceiling height above the room's floor
"""
import sys
from pathlib import Path

import yaml

CONFIG_KEYS = {"ruby_module", "sh3d_floor_z", "layout_pages"}


class Project:
    def __init__(self, root):
        self.root = Path(root).resolve()
        if not self.root.is_dir():
            sys.exit(f"--project {root}: not a directory")
        self.model = self.root / "model"
        self.spec_path = self.model / "spec.yaml"
        self.plans = self.model / "plans"
        self.space = self.model / "space"
        self.out = self.model / "out"
        if not self.spec_path.is_file():
            sys.exit(f"--project {root}: no {self.spec_path.relative_to(self.root)}")
        cfg_path = self.root / "survey.yaml"
        self.config = (yaml.safe_load(cfg_path.read_text()) or {}) if cfg_path.is_file() else {}
        unknown = set(self.config) - CONFIG_KEYS
        if unknown:
            sys.exit(f"survey.yaml: unknown keys {sorted(unknown)}; known: {sorted(CONFIG_KEYS)}")

    def load_spec(self):
        spec = yaml.safe_load(self.spec_path.read_text())
        if not spec.get("name"):
            sys.exit(f"{self.spec_path}: needs a top-level `name:` (shown in the DAE and the SketchUp model)")
        return spec
