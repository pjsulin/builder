"""The plan file Builder's survey mode exports (app/test/plan-export.test.ts writes the
same fixture) builds through apply_plan + build_objects to the box it came from."""
from pathlib import Path

from builder_survey.generate.objects import build_objects
from builder_survey.spec.plan import apply_plan

FIXTURE = Path(__file__).parent / "fixtures" / "plan_export.yaml"


def test_exported_plan_builds_the_box():
    spec = {"name": "House", "levels": {}}
    apply_plan(spec, "plan_export", FIXTURE.parent)
    assert spec["objects"]["vanity"]["phase"] == "proposed"
    report = {"missing": [], "placeholder": [], "conflicts": [], "gaps": []}
    elements = []
    build_objects(spec, report, elements)
    assert [e["name"] for e in elements] == ["vanity"]
    el = elements[0]
    assert el["phase"] == "proposed" and el["material"] == "proposed" and el["kind"] == "object"
    [part] = el["parts"]
    # at = [24', 30', 0"] east/south, size 30" x 21" x 34": x east, y north (south is -y).
    assert part["kind"] == "prism"
    assert part["pts"] == [[288, -360], [318, -360], [318, -381], [288, -381]]
    assert part["z"] == [0, 34]
    assert report["missing"] == [] and report["conflicts"] == []
