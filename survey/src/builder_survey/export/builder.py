"""STEM.builder: the model as a Builder file (docs/file-format.md in the builder repo).

One group per element, named by the element, on the tag of its phase (Existing and
Demo locked, Proposed not). Each part is a child group inside it, so parts never weld
to each other. The element's material is the group instance's material, and its
provenance goes on the definition as `survey:*` attributes: kind, approx, phase,
base_material, and source when the spec entry has one.

Parts become planar faces: a prism's bottom and top loops and side quads (the top
triangulated when `ztop` makes it non-planar), a cylinder as a 16-segment prism along
its axis, a mesh as its triangles. Coordinates are written as they are (inches, x
east, y north, z up), rounded to 1e-6, with sorted keys, so the output is
deterministic.
"""
import json
import math
from importlib.metadata import version

from ..geometry import signed_area, triangulate

TAGS = ("existing", "demo", "proposed")
LOCKED = {"existing", "demo"}
SEGMENTS = 16
IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def write_builder(out, stem, name, elements, mats):
    (out / f"{stem}.builder").write_text(builder_json(name, elements, mats))


def builder_json(name, elements, mats):
    """The file text for a model `name` of `elements` with the material table `mats`."""
    mat_index = {m: i for i, m in enumerate(mats)}
    definitions = [{"name": name, "kind": "root", "vertices": [], "edges": [], "faces": []}]
    instances = []
    for el in elements:
        if not el["parts"]:
            continue
        group = len(definitions)
        definitions.append({"name": el["name"], "kind": "group", "vertices": [], "edges": [],
                            "faces": [], "attributes": {"survey": attributes(el)}})
        instances.append({"definition": group, "parent": 0, "transform": IDENTITY,
                          "name": el["name"], "material": mat_index[el["material"]],
                          "tag": TAGS.index(el["phase"])})
        for i, part in enumerate(el["parts"]):
            faces = part_faces(part)
            if not faces:
                continue
            definitions.append(definition(f"{el['name']} part {i + 1}", faces))
            instances.append({"definition": len(definitions) - 1, "parent": group,
                              "transform": IDENTITY, "name": f"part {i + 1}"})
    file = {
        "format": "builder",
        "version": 1,
        "units": "inch",
        "generator": f"builder-survey {version('builder-survey')}",
        "definitions": definitions,
        "instances": instances,
        "materials": [{"name": m, "color": list(rgb), "opacity": 1} for m, rgb in mats.items()],
        "tags": [{"name": t.capitalize(), "visible": True, "locked": t in LOCKED} for t in TAGS],
    }
    return json.dumps(file, sort_keys=True, separators=(",", ":")) + "\n"


def attributes(el):
    a = {"kind": el["kind"], "approx": bool(el["placeholder"]), "phase": el["phase"],
         "base_material": el["base"]}
    if el.get("source"):
        a["source"] = el["source"]
    return a


def definition(name, faces):
    """A group definition from face loops (lists of 3D points, CCW seen from the
    front). Equal points share a vertex; every loop edge is listed."""
    index, vertices, edges, out = {}, [], set(), []
    for loop in faces:
        ids = []
        for p in loop:
            q = tuple(round(c, 6) + 0.0 for c in p)
            if q not in index:
                index[q] = len(vertices)
                vertices.append(list(q))
            ids.append(index[q])
        if len(dict.fromkeys(ids)) < 3:
            continue        # collapsed by rounding: no area
        for a, b in zip(ids, ids[1:] + ids[:1]):
            edges.add((min(a, b), max(a, b)))
        out.append({"outer": ids})
    return {"name": name, "kind": "group", "vertices": vertices,
            "edges": [list(e) for e in sorted(edges)], "faces": out}


def part_faces(part):
    """A part's faces as loops of 3D points, each wound counter-clockwise seen from
    outside the part."""
    kind = part["kind"]
    if kind == "mesh":
        verts = [tuple(v) for v in part["verts"]]
        return [loop for t in part["tris"] if area((loop := [verts[i] for i in t])) > 1e-9]
    if kind == "prism":
        return prism_faces(part)
    if kind == "cylinder":
        return cylinder_faces(part)
    raise ValueError(f"unknown part kind {kind!r}")


def prism_faces(part):
    pts = [tuple(p) for p in part["pts"]]
    z0, z1 = part["z"]
    n = len(pts)
    ztop = list(part.get("ztop") or [z1] * n)
    if signed_area(pts) < 0:
        pts.reverse()
        ztop.reverse()
    bottom = [(x, y, z0) for x, y in pts]
    top = [(x, y, z) for (x, y), z in zip(pts, ztop)]
    faces = [list(reversed(bottom))]                      # faces down
    if planar(top):
        faces.append(top)                                  # faces up
    else:
        faces += [[top[a], top[b], top[c]] for a, b, c in triangulate(pts)]
    for i in range(n):
        j = (i + 1) % n
        faces.append([bottom[i], bottom[j], top[j], top[i]])   # outward for a CCW base
    return [f for f in faces if area(f) > 1e-9]


def cylinder_faces(part):
    """A 16-segment prism from `a` to `b`: two caps and the side quads."""
    a, b, r = part["a"], part["b"], part["r"]
    w = [b[i] - a[i] for i in range(3)]
    wl = math.sqrt(sum(c * c for c in w))
    if wl < 1e-9 or r <= 0:
        return []
    w = [c / wl for c in w]
    helper = (0, 0, 1) if abs(w[2]) < 0.9 else (1, 0, 0)
    u = cross(helper, w)
    ul = math.sqrt(sum(c * c for c in u))
    u = [c / ul for c in u]
    v = cross(w, u)
    ring = [[r * (math.cos(t) * u[k] + math.sin(t) * v[k]) for k in range(3)]
            for t in (2 * math.pi * i / SEGMENTS for i in range(SEGMENTS))]
    bottom = [tuple(a[k] + p[k] for k in range(3)) for p in ring]   # CCW seen along -w (from b)
    top = [tuple(b[k] + p[k] for k in range(3)) for p in ring]
    faces = [list(reversed(bottom)), top]
    for i in range(SEGMENTS):
        j = (i + 1) % SEGMENTS
        faces.append([bottom[i], bottom[j], top[j], top[i]])
    return faces


def cross(p, q):
    return [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]


def normal(loop):
    """Newell normal of a loop (unnormalised; its length is twice the area)."""
    nx = ny = nz = 0.0
    for (x0, y0, z0), (x1, y1, z1) in zip(loop, loop[1:] + loop[:1]):
        nx += (y0 - y1) * (z0 + z1)
        ny += (z0 - z1) * (x0 + x1)
        nz += (x0 - x1) * (y0 + y1)
    return [nx, ny, nz]


def area(loop):
    return math.sqrt(sum(c * c for c in normal(loop))) / 2


def planar(loop, tol=1e-4):
    n = normal(loop)
    nl = math.sqrt(sum(c * c for c in n))
    if nl < 1e-12:
        return True
    n = [c / nl for c in n]
    d = sum(c * p for c, p in zip(n, loop[0]))
    return all(abs(sum(c * p for c, p in zip(n, q)) - d) < tol for q in loop)
