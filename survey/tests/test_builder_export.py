"""The .builder exporter: part -> faces (planar, wound outward) and the file's shape."""
import json

from builder_survey.export.builder import area, builder_json, normal, part_faces, planar
from builder_survey.geometry import extrude, prism, rect


def centroid(faces):
    pts = [p for f in faces for p in f]
    return [sum(p[k] for p in pts) / len(pts) for k in range(3)]


def check_outward(faces):
    """Every face is planar, has area, and its normal points away from the part's centroid."""
    c = centroid(faces)
    for f in faces:
        assert planar(f) and area(f) > 1e-9
        n = normal(f)
        mid = [sum(p[k] for p in f) / len(f) for k in range(3)]
        assert sum(n[k] * (mid[k] - c[k]) for k in range(3)) > 0, f


def test_prism_faces():
    faces = part_faces(prism(rect(0, 0, 10, 20), 0, 30))
    assert len(faces) == 6
    assert sorted(len(f) for f in faces) == [4] * 6
    check_outward(faces)
    assert normal(faces[0])[2] < 0 and normal(faces[1])[2] > 0


def test_prism_with_clockwise_points_is_still_outward():
    faces = part_faces(prism(list(reversed(rect(0, 0, 10, 20))), 0, 30))
    check_outward(faces)


def test_sloped_top_is_triangulated():
    p = prism(rect(0, 0, 10, 20), 0, 30)
    p["ztop"] = [30, 30, 40, 36]      # not planar
    faces = part_faces(p)
    assert len(faces) == 1 + 2 + 4
    check_outward(faces)
    assert sum(len(f) == 3 for f in faces) == 2


def test_cylinder_faces():
    faces = part_faces({"kind": "cylinder", "a": [0, 0, 0], "b": [0, 0, 50], "r": 2})
    assert len(faces) == 2 + 16
    check_outward(faces)
    tilted = part_faces({"kind": "cylinder", "a": [0, 0, 0], "b": [30, 10, 50], "r": 1.5})
    check_outward(tilted)
    assert part_faces({"kind": "cylinder", "a": [0, 0, 0], "b": [0, 0, 0], "r": 2}) == []


def test_mesh_faces():
    part = extrude([(0, 0), (10, 0), (10, 5), (0, 5)], lambda a, b, c: (a, c, b), 8)
    faces = part_faces(part)
    assert all(len(f) == 3 for f in faces)
    check_outward(faces)


def element(name, phase, parts, kind="object", material="block", placeholder=False, source=None):
    return {"name": name, "phase": phase, "material": material, "base": material,
            "placeholder": placeholder, "parts": parts, "kind": kind, "source": source}


def test_file_shape():
    mats = {"block": (190, 190, 185), "proposed": (90, 150, 220)}
    els = [
        element("north wall", "existing", [prism(rect(0, 0, 100, 8), 0, 90)], kind="wall",
                source="measurements/2026-10-23/103127-zone_b"),
        element("vanity", "proposed", [prism(rect(10, 10, 40, 31), 0, 34)], material="proposed",
                placeholder=True),
        element("skipped", "demo", []),
    ]
    text = builder_json("House", els, mats)
    assert text == builder_json("House", els, mats)
    f = json.loads(text)
    assert f["format"] == "builder" and f["version"] == 1 and f["units"] == "inch"
    assert f["generator"].startswith("builder-survey ")
    assert f["tags"] == [{"name": "Existing", "visible": True, "locked": True},
                         {"name": "Demo", "visible": True, "locked": True},
                         {"name": "Proposed", "visible": True, "locked": False}]
    assert f["materials"] == [{"name": "block", "color": [190, 190, 185], "opacity": 1},
                              {"name": "proposed", "color": [90, 150, 220], "opacity": 1}]
    names = [d["name"] for d in f["definitions"]]
    assert names == ["House", "north wall", "north wall part 1", "vanity", "vanity part 1"]
    wall = f["definitions"][1]
    assert wall["attributes"] == {"survey": {"kind": "wall", "approx": False, "phase": "existing",
                                             "base_material": "block",
                                             "source": "measurements/2026-10-23/103127-zone_b"}}
    assert wall["faces"] == [] and "attributes" not in f["definitions"][2]
    assert len(f["definitions"][4]["faces"]) == 6 and len(f["definitions"][4]["vertices"]) == 8
    assert len(f["definitions"][4]["edges"]) == 12
    inst = f["instances"]
    assert inst[0] == {"definition": 1, "parent": 0, "name": "north wall", "material": 0, "tag": 0,
                       "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]}
    assert inst[1]["parent"] == 1 and "tag" not in inst[1] and "material" not in inst[1]
    assert inst[2]["tag"] == 2 and inst[2]["material"] == 1
    assert f["definitions"][3]["attributes"]["survey"]["approx"] is True
    assert sorted(f) == list(f)
