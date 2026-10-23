//! Healing a plane: the one routine behind auto face creation, face splitting,
//! holes and merging coplanar faces. See docs/architecture.md, "Sticky geometry".

use std::collections::{HashMap, HashSet, VecDeque};

use crate::doc::*;
use crate::math::{point_in_polygon, point_segment, signed_area2, to_2d, Plane, P2, V3};
use crate::tol;
use crate::Error;

/// A face region that existed before an edit and should be refilled afterwards.
#[derive(Clone, Debug)]
pub struct OldRegion {
    pub outer: Vec<P2>,
    pub holes: Vec<Vec<P2>>,
    /// The old face's normal agreed with the healed plane's normal.
    pub front: bool,
    pub material: Option<MatId>,
    pub back_material: Option<MatId>,
}

impl OldRegion {
    fn contains(&self, p: P2) -> bool {
        point_in_polygon(p, &self.outer) && !self.holes.iter().any(|h| point_in_polygon(p, h))
    }
}

/// A region found by the arrangement walk: an outer loop and its holes, as vertex ids.
struct Region {
    outer: Vec<VId>,
    holes: Vec<Vec<VId>>,
    component: usize,
    uses_fresh: bool,
    area: f64,
}

impl Document {
    /// Capture a face as an [`OldRegion`] relative to `plane`.
    pub fn old_region(&self, f: FId, plane: &Plane) -> Option<OldRegion> {
        let face = self.face(f)?;
        let (u, v) = plane.basis();
        let to = |lp: &Vec<VId>| {
            lp.iter()
                .map(|&x| to_2d(self.pos(x), u, v))
                .collect::<Vec<P2>>()
        };
        Some(OldRegion {
            outer: to(&face.outer),
            holes: face.holes.iter().map(to).collect(),
            front: face.plane.normal.dot(plane.normal) > 0.0,
            material: face.material,
            back_material: face.back_material,
        })
    }

    pub(crate) fn face_region_contains(&self, face: &Face, p: P2, u: V3, v: V3) -> bool {
        let poly = |lp: &Vec<VId>| {
            lp.iter()
                .map(|&x| to_2d(self.pos(x), u, v))
                .collect::<Vec<P2>>()
        };
        point_in_polygon(p, &poly(&face.outer))
            && !face.holes.iter().any(|h| point_in_polygon(p, &poly(h)))
    }

    fn near_face_boundary(&self, face: &Face, p: V3) -> bool {
        face.loops().any(|lp| {
            (0..lp.len()).any(|i| {
                point_segment(p, self.pos(lp[i]), self.pos(lp[(i + 1) % lp.len()])).0 <= tol::LENGTH
            })
        })
    }

    /// Rebuild the faces of one plane.
    ///
    /// * `fresh`: edges just drawn or touched. Faces whose interior they cross are
    ///   split, and new closed regions bounded by them get faces.
    /// * `extra`: more edges to start the search from, without counting as fresh.
    /// * `old`: regions to refill (with their material and orientation) wherever the
    ///   new arrangement has a region inside them, as when merging faces.
    ///
    /// Returns the faces created.
    pub fn heal(
        &mut self,
        ctx: DefId,
        plane: &Plane,
        fresh: &[EId],
        extra: &[EId],
        mut old: Vec<OldRegion>,
    ) -> Result<Vec<FId>, Error> {
        let (u, v) = plane.basis();
        let fresh_set: HashSet<EId> = fresh.iter().copied().collect();

        // 1. The in-plane edge graph around the seeds, plus faces in the plane nearby.
        let mut graph: HashSet<EId> = HashSet::new();
        let mut queue: VecDeque<EId> = fresh.iter().chain(extra).copied().collect();
        let plane_faces: Vec<FId> = self
            .faces_in(ctx)
            .filter(|(_, f)| f.plane.same_surface(plane))
            .map(|(id, _)| id)
            .collect();
        let mut included_faces: HashSet<FId> = HashSet::new();
        loop {
            while let Some(e) = queue.pop_front() {
                if graph.contains(&e) || !self.edge_in_plane(e, plane) {
                    continue;
                }
                let Some(edge) = self.edge(e) else { continue };
                if edge.owner != ctx {
                    continue;
                }
                graph.insert(e);
                for &end in &edge.v {
                    if let Some(vx) = self.vertex(end) {
                        queue.extend(vx.edges.iter().copied().filter(|x| !graph.contains(x)));
                    }
                }
            }
            let bbox = self.bbox_2d(&graph, u, v);
            let mut grew = false;
            for &f in &plane_faces {
                if included_faces.contains(&f) {
                    continue;
                }
                let Some(face) = self.face(f) else { continue };
                let fb = self.loop_bbox(&face.outer, u, v);
                if bbox_overlap(bbox, fb) {
                    included_faces.insert(f);
                    queue.extend(self.face_edges(face));
                    grew = true;
                }
            }
            if !grew {
                break;
            }
        }
        if graph.is_empty() {
            return Ok(Vec::new());
        }

        // 2. Faces whose interior a fresh edge crosses are replaced.
        for &f in &plane_faces {
            let Some(face) = self.face(f) else { continue };
            let boundary: HashSet<EId> = self.face_edges(face).into_iter().collect();
            let crossed = fresh.iter().any(|&e| {
                if boundary.contains(&e) {
                    return false;
                }
                let Some(ed) = self.edge(e) else { return false };
                let mid = self.pos(ed.v[0]).lerp(self.pos(ed.v[1]), 0.5);
                !self.near_face_boundary(face, mid)
                    && self.face_region_contains(face, to_2d(mid, u, v), u, v)
            });
            if crossed {
                if let Some(r) = self.old_region(f, plane) {
                    old.push(r);
                }
                self.remove_face(f);
            }
        }

        // 3. Planar arrangement walk.
        let regions = self.arrangement(&graph, &fresh_set, u, v);

        // 4. Create faces where they belong.
        let mut created = Vec::new();
        for r in regions {
            let to = |lp: &Vec<VId>| {
                lp.iter()
                    .map(|&x| to_2d(self.pos(x), u, v))
                    .collect::<Vec<P2>>()
            };
            let outer2 = to(&r.outer);
            let holes2: Vec<Vec<P2>> = r.holes.iter().map(to).collect();
            let Some(pt) = interior_point(&outer2, &holes2) else {
                continue;
            };
            let in_old = old.iter().find(|o| o.contains(pt)).cloned();
            if in_old.is_none() && !r.uses_fresh {
                continue;
            }
            let covered = self.faces_in(ctx).any(|(_, f)| {
                f.plane.same_surface(plane) && self.face_region_contains(f, pt, u, v)
            });
            if covered {
                continue;
            }
            let normal = match &in_old {
                Some(o) if o.front => plane.normal,
                Some(_) => -plane.normal,
                None => self.default_normal(plane, &r.outer),
            };
            match self.add_face(ctx, r.outer.clone(), r.holes.clone(), Some(normal)) {
                Ok(f) => {
                    if let Some(o) = &in_old {
                        let mut face = self.face(f).cloned().ok_or(Error::Missing("face"))?;
                        face.material = o.material;
                        face.back_material = o.back_material;
                        self.set_face(f, Some(face));
                    }
                    created.push(f);
                }
                // A sliver that fails to triangulate is left as edges, not an error.
                Err(Error::Degenerate(_)) | Err(Error::NotPlanar) => {}
                Err(e) => return Err(e),
            }
        }
        Ok(created)
    }

    fn bbox_2d(&self, edges: &HashSet<EId>, u: V3, v: V3) -> [f64; 4] {
        let mut b = [
            f64::INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NEG_INFINITY,
        ];
        for &e in edges {
            if let Some(ed) = self.edge(e) {
                for &x in &ed.v {
                    grow(&mut b, to_2d(self.pos(x), u, v));
                }
            }
        }
        b
    }

    fn loop_bbox(&self, lp: &[VId], u: V3, v: V3) -> [f64; 4] {
        let mut b = [
            f64::INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NEG_INFINITY,
        ];
        for &x in lp {
            grow(&mut b, to_2d(self.pos(x), u, v));
        }
        b
    }

    /// Default facing for a brand-new face: away from neighboring faces it shares
    /// edges with (so closing a box faces out), else down on the ground and up above it,
    /// else toward the default camera.
    fn default_normal(&self, plane: &Plane, outer: &[VId]) -> V3 {
        let n = plane.normal;
        let mut sum = V3::ZERO;
        let mut count = 0.0;
        for i in 0..outer.len() {
            let Some(e) = self.edge_between(outer[i], outer[(i + 1) % outer.len()]) else {
                continue;
            };
            for &f in &self.edge(e).map(|e| e.faces.clone()).unwrap_or_default() {
                let Some(face) = self.face(f) else { continue };
                if face.plane.same_surface(plane) {
                    continue;
                }
                for &x in face.loops().flatten() {
                    let p = self.pos(x);
                    if !plane.contains(p) {
                        sum = sum + p;
                        count += 1.0;
                    }
                }
            }
        }
        if count > 0.0 {
            let s = plane.dist(sum * (1.0 / count));
            if s.abs() > tol::PLANE {
                return if s > 0.0 { -n } else { n };
            }
        }
        if n.z.abs() > 0.99 {
            let z = plane.d / n.z;
            let up = if z.abs() <= tol::PLANE { -V3::Z } else { V3::Z };
            return if n.dot(up) > 0.0 { n } else { -n };
        }
        let viewer = V3::new(-0.46, -0.89, 0.3);
        if n.dot(viewer) >= 0.0 {
            n
        } else {
            -n
        }
    }

    /// Walk the planar arrangement of `graph` and return its bounded regions with holes.
    fn arrangement(&self, graph: &HashSet<EId>, fresh: &HashSet<EId>, u: V3, v: V3) -> Vec<Region> {
        let mut edges: Vec<EId> = graph.iter().copied().collect();
        edges.sort();
        // Half-edge h: 2k is edge k from v[0] to v[1], 2k+1 the reverse.
        let mut from = Vec::with_capacity(edges.len() * 2);
        let mut to = Vec::with_capacity(edges.len() * 2);
        for &e in &edges {
            let ed = self.edge(e).expect("graph edge exists");
            from.extend([ed.v[0], ed.v[1]]);
            to.extend([ed.v[1], ed.v[0]]);
        }
        let p2: HashMap<VId, P2> = from
            .iter()
            .map(|&x| (x, to_2d(self.pos(x), u, v)))
            .collect();
        // Outgoing half-edges per vertex, sorted counter-clockwise by angle.
        let mut out: HashMap<VId, Vec<usize>> = HashMap::new();
        for (h, &f) in from.iter().enumerate() {
            out.entry(f).or_default().push(h);
        }
        let angle = |h: usize| {
            let (a, b) = (p2[&from[h]], p2[&to[h]]);
            (b[1] - a[1]).atan2(b[0] - a[0])
        };
        for list in out.values_mut() {
            list.sort_by(|&x, &y| angle(x).total_cmp(&angle(y)));
        }
        let twin = |h: usize| h ^ 1;
        // Next half-edge: at the end vertex, the first outgoing edge clockwise from
        // the twin. That keeps the region on the left.
        let next = |h: usize| {
            let list = &out[&to[h]];
            let i = list
                .iter()
                .position(|&x| x == twin(h))
                .expect("twin is outgoing");
            list[(i + list.len() - 1) % list.len()]
        };

        // Connected components (union-find over vertices).
        let mut comp: HashMap<VId, usize> = HashMap::new();
        let verts: Vec<VId> = out.keys().copied().collect();
        let mut parent: Vec<usize> = (0..verts.len()).collect();
        let index: HashMap<VId, usize> = verts.iter().enumerate().map(|(i, &x)| (x, i)).collect();
        fn find(p: &mut [usize], x: usize) -> usize {
            let mut r = x;
            while p[r] != r {
                r = p[r];
            }
            let mut c = x;
            while p[c] != r {
                let n = p[c];
                p[c] = r;
                c = n;
            }
            r
        }
        for h in (0..from.len()).step_by(2) {
            let (a, b) = (
                find(&mut parent, index[&from[h]]),
                find(&mut parent, index[&to[h]]),
            );
            parent[a] = b;
        }
        for (i, &x) in verts.iter().enumerate() {
            let r = find(&mut parent, i);
            comp.insert(x, r);
        }

        // Trace every cycle.
        let mut seen = vec![false; from.len()];
        let mut regions: Vec<Region> = Vec::new();
        let mut outlines: Vec<(Vec<VId>, usize)> = Vec::new();
        for start in 0..from.len() {
            if seen[start] {
                continue;
            }
            let mut cycle = Vec::new();
            let mut h = start;
            while !seen[h] {
                seen[h] = true;
                cycle.push(h);
                h = next(h);
            }
            let pts: Vec<P2> = cycle.iter().map(|&h| p2[&from[h]]).collect();
            let area = signed_area2(&pts) / 2.0;
            let component = comp[&from[cycle[0]]];
            // Remove spikes and bridges: edges walked both ways in this cycle.
            let in_cycle: HashSet<usize> = cycle.iter().copied().collect();
            let kept: Vec<usize> = cycle
                .iter()
                .copied()
                .filter(|&h| !in_cycle.contains(&twin(h)))
                .collect();
            let loops = split_loops(&kept, &from, &to);
            if area > tol::AREA {
                let mut outer: Option<(Vec<VId>, f64)> = None;
                let mut holes = Vec::new();
                for lp in loops {
                    let a = signed_area2(&lp.iter().map(|x| p2[x]).collect::<Vec<_>>()) / 2.0;
                    if a > tol::AREA {
                        if outer.as_ref().is_none_or(|(_, oa)| a > *oa) {
                            outer = Some((lp, a));
                        }
                    } else if a < -tol::AREA {
                        holes.push(lp);
                    }
                }
                if let Some((outer, area)) = outer {
                    let uses_fresh = kept.iter().any(|&h| fresh.contains(&edges[h / 2]));
                    regions.push(Region {
                        outer,
                        holes,
                        component,
                        uses_fresh,
                        area,
                    });
                }
            } else {
                for lp in loops {
                    let a = signed_area2(&lp.iter().map(|x| p2[x]).collect::<Vec<_>>()) / 2.0;
                    if a < -tol::AREA {
                        outlines.push((lp, component));
                    }
                }
            }
        }

        // Nest each component's outline as a hole in the smallest region of another
        // component that contains it.
        for (lp, component) in outlines {
            let test = p2[&lp[0]];
            let mut best: Option<(usize, f64)> = None;
            for (i, r) in regions.iter().enumerate() {
                if r.component == component {
                    continue;
                }
                let poly: Vec<P2> = r.outer.iter().map(|x| p2[x]).collect();
                if point_in_polygon(test, &poly) && best.is_none_or(|(_, a)| r.area < a) {
                    best = Some((i, r.area));
                }
            }
            if let Some((i, _)) = best {
                regions[i].holes.push(lp);
            }
        }
        regions
    }
}

/// Split a sequence of half-edges (in walk order, spikes removed) into closed loops
/// of vertex ids.
fn split_loops(kept: &[usize], from: &[VId], to: &[VId]) -> Vec<Vec<VId>> {
    let n = kept.len();
    let mut used = vec![false; n];
    let mut loops = Vec::new();
    for s in 0..n {
        if used[s] {
            continue;
        }
        let start_vertex = from[kept[s]];
        let mut lp = Vec::new();
        let mut i = s;
        loop {
            used[i] = true;
            lp.push(from[kept[i]]);
            let end = to[kept[i]];
            if end == start_vertex {
                break;
            }
            // The next unused half-edge leaving `end`, searching forward in walk order.
            let next = (1..n)
                .map(|k| (i + k) % n)
                .find(|&j| !used[j] && from[kept[j]] == end);
            match next {
                Some(j) => i = j,
                None => break,
            }
        }
        if lp.len() >= 3 {
            loops.push(lp);
        }
    }
    loops
}

fn grow(b: &mut [f64; 4], p: P2) {
    b[0] = b[0].min(p[0]);
    b[1] = b[1].min(p[1]);
    b[2] = b[2].max(p[0]);
    b[3] = b[3].max(p[1]);
}

fn bbox_overlap(a: [f64; 4], b: [f64; 4]) -> bool {
    let t = tol::LENGTH;
    a[0] <= b[2] + t && b[0] <= a[2] + t && a[1] <= b[3] + t && b[1] <= a[3] + t
}

/// A point well inside a polygon with holes: the centroid of its largest triangle.
pub fn interior_point(outer: &[P2], holes: &[Vec<P2>]) -> Option<P2> {
    let mut data: Vec<f64> = Vec::new();
    let mut hole_idx = Vec::new();
    for p in outer {
        data.extend_from_slice(p);
    }
    for h in holes {
        hole_idx.push(data.len() / 2);
        for p in h {
            data.extend_from_slice(p);
        }
    }
    let tris = earcutr::earcut(&data, &hole_idx, 2).ok()?;
    let pt = |i: usize| [data[2 * i], data[2 * i + 1]];
    tris.chunks(3)
        .map(|t| {
            let (a, b, c) = (pt(t[0]), pt(t[1]), pt(t[2]));
            (
                signed_area2(&[a, b, c]).abs(),
                [(a[0] + b[0] + c[0]) / 3.0, (a[1] + b[1] + c[1]) / 3.0],
            )
        })
        .max_by(|x, y| x.0.total_cmp(&y.0))
        .map(|(_, c)| c)
}
