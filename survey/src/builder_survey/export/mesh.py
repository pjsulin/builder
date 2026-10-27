"""mesh.json: triangle meshes and finishes for the Blender build."""
import json

from ..geometry import part_mesh


def write_mesh_json(out, elements, cams, face, ceilings, daylight, mats, recipes, stem):
    """Triangle meshes for blender_build.py (same geometry as the DAE), with
    each triangle's finish, the render-only ceilings, the flat colours, the
    spec's Blender recipes and the output stem (for the .blend)."""
    data = {"stem": stem, "materials": mats, "recipes": recipes, "elements": [], "cameras": cams,
            "ceilings": ceilings, "daylight": daylight}
    for el in elements:
        verts, tris = [], []
        for part in el["parts"]:
            v, t = part_mesh(part)
            base = len(verts)
            verts += v
            tris += [(a + base, b + base, c + base) for a, b, c in t]
        fins = [face(el, [verts[i] for i in t]) for t in tris]
        data["elements"].append({k: el[k] for k in ("name", "phase", "material", "base", "kind")}
                                | {"verts": verts, "tris": tris}
                                | ({"finish": fins} if any(fins) else {}))
    (out / "mesh.json").write_text(json.dumps(data))
