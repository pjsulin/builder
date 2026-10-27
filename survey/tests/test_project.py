"""Project settings and the material table: pure functions and Project() on a temp dir."""
import pytest

from builder_survey.materials import LIBRARY, material_table, render_recipes
from builder_survey.project import Project, slug


def make_project(tmp_path, survey_yaml=None, name="Elm St garage"):
    (tmp_path / "model").mkdir()
    (tmp_path / "model" / "spec.yaml").write_text(f"name: {name}\n")
    if survey_yaml is not None:
        (tmp_path / "survey.yaml").write_text(survey_yaml)
    return tmp_path


def test_slug():
    assert slug("Elm St garage") == "elm-st-garage"
    assert slug("20 S Pierson basement") == "20-s-pierson-basement"
    assert slug("  A--b__c  ") == "a-b-c"
    with pytest.raises(SystemExit):
        slug("---")


def test_stem_defaults_to_slugged_name(tmp_path):
    p = Project(make_project(tmp_path))
    assert p.stem(p.load_spec()) == "elm-st-garage"


def test_stem_from_output_stem(tmp_path):
    p = Project(make_project(tmp_path, "output_stem: basement\n"))
    assert p.stem(p.load_spec()) == "basement"


def test_output_stem_must_be_a_plain_name(tmp_path):
    p = Project(make_project(tmp_path, "output_stem: ../x\n"))
    with pytest.raises(SystemExit):
        p.stem(p.load_spec())


def test_out_dir_precedence(tmp_path):
    root = make_project(tmp_path)
    assert Project(root).out == root / "model" / "out"
    (root / "survey.yaml").write_text("out_dir: build/here\n")
    assert Project(root).out == root / "build" / "here"
    assert Project(root, tmp_path / "flag").out == (tmp_path / "flag").resolve()


def test_project_paths(tmp_path):
    p = Project(make_project(tmp_path))
    assert p.measurements == tmp_path / "measurements"
    assert p.photos == tmp_path / "photos"
    assert p.checklist == tmp_path / "measure" / "checklist.yaml"


def test_unknown_config_key_fails(tmp_path):
    with pytest.raises(SystemExit):
        Project(make_project(tmp_path, "colour: red\n"))


def test_material_table_adds_and_overrides():
    spec = {"materials": {
        "walnut": {"color": [110, 70, 40], "render": {"recipe": "wood", "args": [[0.1, 0.1, 0.1]]}},
        "block": {"color": [1, 2, 3]},
        "stucco": {"render": {"recipe": "concrete", "label": "stucco"}},
    }}
    table = material_table(spec)
    assert table["walnut"] == (110, 70, 40)
    assert table["block"] == (1, 2, 3) and LIBRARY["block"] != (1, 2, 3)
    assert "stucco" not in table                      # render-only: a finish, no flat colour
    assert list(table)[:len(LIBRARY) - 0][:3] == list(LIBRARY)[:3]   # library first, spec after
    assert render_recipes(spec) == {
        "walnut": {"recipe": "wood", "label": "walnut", "args": [[0.1, 0.1, 0.1]]},
        "stucco": {"recipe": "concrete", "label": "stucco", "args": []},
    }


def test_material_table_without_section_is_the_library():
    assert material_table({}) == LIBRARY
    assert render_recipes({}) == {}


@pytest.mark.parametrize("entry", [
    {"color": [1, 2]},
    {"color": [1, 2, 300]},
    {"render": {"recipe": "marble"}},
    {"render": {"recipe": "wood", "extra": 1}},
    {"paint": "red"},
    {},
])
def test_bad_material_entries_fail(entry):
    with pytest.raises(SystemExit):
        material_table({"materials": {"x": entry}})
