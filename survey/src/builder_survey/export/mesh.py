"""mesh.json: triangle meshes and finishes for the Blender build."""
import json

from ..geometry import part_mesh
from ..materials import MATERIALS


def write_mesh_json(out, elements, cams, face, ceilings, daylight):
    """Triangle meshes for blender_build.py (same geometry as the DAE), with
    each triangle's finish and the render-only ceilings."""
    data = {"materials": MATERIALS, "elements": [], "cameras": cams, "ceilings": ceilings,
            "daylight": daylight}
    for el in elements:
        verts, tris = [], []
        for part in el["parts"]:
            v, t = part_mesh(part)
            base = len(verts)
            verts += v
            tris += [(a + base, b + base, c + base) for a, b, c in t]
        fins = [face(el, [verts[i] for i in t]) for t in tris]
        data["elements"].append({k: el[k] for k in ("name", "phase", "material", "base")}
                                | {"verts": verts, "tris": tris}
                                | ({"finish": fins} if any(fins) else {}))
    (out / "mesh.json").write_text(json.dumps(data))
