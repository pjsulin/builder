"""basement.dae: COLLADA model for SketchUp (File > Import)."""
from ..geometry import part_mesh
from ..materials import MATERIALS


def write_dae(out_dir, model_name, elements):
    """COLLADA file for SketchUp Go/Pro: File > Import. One node per element,
    nested under Existing / Demo / Proposed so each phase can be tagged at once."""
    import re as _re
    from xml.sax.saxutils import escape, quoteattr

    def ident(s):
        return _re.sub(r"[^A-Za-z0-9_]", "_", s)

    out = ['<?xml version="1.0" encoding="utf-8"?>',
           '<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">',
           '<asset><unit name="inch" meter="0.0254"/><up_axis>Z_UP</up_axis></asset>',
           '<library_effects>']
    for name, (r, g, b) in MATERIALS.items():
        out.append(f'<effect id="fx-{name}"><profile_COMMON><technique sid="t"><lambert>'
                   f'<diffuse><color>{r / 255:.3f} {g / 255:.3f} {b / 255:.3f} 1</color></diffuse>'
                   '</lambert></technique></profile_COMMON></effect>')
    out.append('</library_effects><library_materials>')
    for name in MATERIALS:
        out.append(f'<material id="mat-{name}" name="{name}">'
                   f'<instance_effect url="#fx-{name}"/></material>')
    out.append('</library_materials><library_geometries>')

    nodes = {"existing": [], "demo": [], "proposed": []}
    for k, el in enumerate(elements):
        verts, tris = [], []
        for part in el["parts"]:
            v, t = part_mesh(part)
            base = len(verts)
            verts += v
            tris += [(a + base, b + base, c + base) for a, b, c in t]
        gid = f"g{k}-{ident(el['name'])}"
        pos = " ".join(f"{c:.4f}" for p in verts for c in p)
        idx = " ".join(str(i) for t in tris for i in t)
        out.append(
            f'<geometry id="{gid}"><mesh>'
            f'<source id="{gid}-pos"><float_array id="{gid}-arr" count="{len(verts) * 3}">{pos}</float_array>'
            f'<technique_common><accessor source="#{gid}-arr" count="{len(verts)}" stride="3">'
            '<param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>'
            '</accessor></technique_common></source>'
            f'<vertices id="{gid}-vtx"><input semantic="POSITION" source="#{gid}-pos"/></vertices>'
            f'<triangles material="m" count="{len(tris)}">'
            f'<input semantic="VERTEX" source="#{gid}-vtx" offset="0"/><p>{idx}</p></triangles>'
            '</mesh></geometry>')
        nodes[el["phase"]].append(
            f'<node id="n{k}" name={quoteattr(el["name"])}><instance_geometry url="#{gid}">'
            '<bind_material><technique_common>'
            f'<instance_material symbol="m" target="#mat-{el["material"]}"/>'
            '</technique_common></bind_material></instance_geometry></node>')
    out.append('</library_geometries><library_visual_scenes><visual_scene id="scene">'
               f'<node id="root" name={quoteattr(model_name)}>')
    for phase, children in nodes.items():
        if children:
            out.append(f'<node id="phase-{phase}" name="{escape(phase.capitalize())}">')
            out += children
            out.append('</node>')
    out.append('</node></visual_scene></library_visual_scenes>'
               '<scene><instance_visual_scene url="#scene"/></scene></COLLADA>')
    (out_dir / "basement.dae").write_text("\n".join(out) + "\n")
