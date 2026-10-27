"""Part builders (prisms, extrusions, discs) and part -> triangle mesh.

Plan points are [east, south] in the spec; parts use SketchUp axes (x east, y north)."""
import math
import sys


def xy(east, south):
    """Spec [east, south] -> SketchUp x (east), y (north)."""
    return [east, -south]


def rect(e0, s0, e1, s1):
    return [xy(e0, s0), xy(e1, s0), xy(e1, s1), xy(e0, s1)]


def prism(pts, z0, z1):
    return {"kind": "prism", "pts": pts, "z": [z0, z1]}


def extrude(profile, to3d, depth):
    """A solid from a 2D polygon `profile` [(a, b), ...] (may be concave),
    pushed `depth` along c. to3d(a, b, c) -> spec [east, south, z] must be
    affine. Used for parts that aren't vertical prisms: sloped stringers and
    rails, spindles with sloped ends, door and window parts in a wall."""
    pts = [tuple(p) for p in profile]
    if signed_area(pts) < 0:
        pts.reverse()
    def sk(a, b, c):                       # -> SketchUp coordinates
        e, s, z = to3d(a, b, c)
        return (*xy(e, s), z)
    o = sk(0, 0, 0)
    A, B, C = ([q - r for q, r in zip(sk(*u), o)] for u in ((1, 0, 0), (0, 1, 0), (0, 0, 1)))
    n = len(pts)
    verts = [sk(a, b, 0) for a, b in pts] + [sk(a, b, depth) for a, b in pts]

    def tri(i, j, k, out):
        """Wind (i, j, k) so its normal points along `out`."""
        p, q, r = verts[i], verts[j], verts[k]
        u = [q[m] - p[m] for m in range(3)]
        v = [r[m] - p[m] for m in range(3)]
        nrm = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        return (i, j, k) if sum(x * y for x, y in zip(nrm, out)) > 0 else (k, j, i)

    tris = []
    for a, b, c in triangulate(pts):
        tris += [tri(a, b, c, [-x for x in C]), tri(a + n, b + n, c + n, C)]
    for i in range(n):
        j = (i + 1) % n
        da, db = pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]
        out = [db * x - da * y for x, y in zip(A, B)]   # outward for a CCW profile
        tris += [tri(i, j, j + n, out), tri(i, j + n, i + n, out)]
    return {"kind": "mesh", "verts": verts, "tris": tris}


def local_frame(p, facing):
    """A fixture's own frame: u across its front from the left end (seen
    standing outside, facing it), v from the front toward the back.
    Returns (width, depth, box, to_plan); box(u0, u1, v0, v1, za, zb) -> prism."""
    w, n, e, s = p["west"], p["north"], p["east"], p["south"]
    width, depth = ((s - n, e - w) if facing in ("east", "west") else (e - w, s - n))
    to_plan = {"east": lambda u, v: (e - v, s - u), "west": lambda u, v: (w + v, n + u),
               "north": lambda u, v: (e - u, n + v), "south": lambda u, v: (w + u, s - v)}[facing]

    def box(u0, u1, v0, v1, za, zb):
        (e0, s0), (e1, s1) = to_plan(u0, v0), to_plan(u1, v1)
        return prism(rect(min(e0, e1), min(s0, s1), max(e0, e1), max(s0, s1)), za, zb)
    return width, depth, box, to_plan


def disc(to_plan, u, v0, v1, z, r, seg=24):
    """A short horizontal cylinder (a knob or dial) through the front, axis along v."""
    pts = [(u + r * math.cos(2 * math.pi * i / seg), z + r * math.sin(2 * math.pi * i / seg))
           for i in range(seg)]
    return extrude(pts, lambda a, b, c: (*to_plan(a, v0 + c), b), v1 - v0)


def signed_area(pts):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / 2


def triangulate(pts):
    """Ear-clip a simple CCW polygon; returns index triples."""
    idx = list(range(len(pts)))
    tris = []

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(p, a, b, c):
        return cross(a, b, p) >= 0 and cross(b, c, p) >= 0 and cross(c, a, p) >= 0

    while len(idx) > 3:
        for k in range(len(idx)):
            i, j, m = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = pts[i], pts[j], pts[m]
            if cross(a, b, c) <= 1e-9:
                continue
            if any(inside(pts[q], a, b, c) for q in idx if q not in (i, j, m)):
                continue
            tris.append((i, j, m))
            idx.pop(k)
            break
        else:
            sys.exit("Could not triangulate a polygon (self-intersecting?)")
    tris.append(tuple(idx))
    return tris


def part_mesh(part):
    """Part -> (vertices, triangles) with outward-facing (CCW) winding."""
    if part["kind"] == "mesh":                   # already triangulated (extrude)
        return [tuple(v) for v in part["verts"]], [tuple(t) for t in part["tris"]]
    if part["kind"] == "prism":
        pts = [tuple(p) for p in part["pts"]]
        z0, z1 = part["z"]
        n = len(pts)
        ztop = list(part.get("ztop") or [z1] * n)
        if signed_area(pts) < 0:
            pts.reverse()
            ztop.reverse()
        verts = [(x, y, z0) for x, y in pts] + [(x, y, z) for (x, y), z in zip(pts, ztop)]
        tris = []
        for a, b, c in triangulate(pts):
            tris.append((a + n, b + n, c + n))   # top, faces up
            tris.append((c, b, a))               # bottom, faces down
        for i in range(n):
            j = (i + 1) % n
            tris += [(i, j, j + n), (i, j + n, i + n)]
        return verts, tris

    import math
    a, b, r, seg = part["a"], part["b"], part["r"], 16
    w = [b[i] - a[i] for i in range(3)]
    wl = math.sqrt(sum(c * c for c in w))
    w = [c / wl for c in w]
    helper = (0, 0, 1) if abs(w[2]) < 0.9 else (1, 0, 0)
    u = [helper[1] * w[2] - helper[2] * w[1], helper[2] * w[0] - helper[0] * w[2],
         helper[0] * w[1] - helper[1] * w[0]]
    ul = math.sqrt(sum(c * c for c in u))
    u = [c / ul for c in u]
    v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]]
    ring = [[r * (math.cos(t) * u[k] + math.sin(t) * v[k]) for k in range(3)]
            for t in (2 * math.pi * i / seg for i in range(seg))]
    verts = [tuple(a[k] + p[k] for k in range(3)) for p in ring] + \
            [tuple(b[k] + p[k] for k in range(3)) for p in ring] + [tuple(a), tuple(b)]
    ca, cb = 2 * seg, 2 * seg + 1
    tris = []
    for i in range(seg):
        j = (i + 1) % seg
        tris += [(i, j, j + seg), (i, j + seg, i + seg), (cb, i + seg, j + seg), (ca, j, i)]
    return verts, tris
