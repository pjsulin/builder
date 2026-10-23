//! Drawing lines into sticky geometry.

use crate::doc::*;
use crate::math::{point_segment, segment_segment, Plane, V3};
use crate::tol;
use crate::Error;

impl Document {
    /// Draw a line from `a` to `b` in context `ctx`.
    ///
    /// Endpoints weld to nearby vertices, edges the line touches or crosses are split,
    /// the line is cut at every touch point, and then every plane the new edges lie
    /// in is healed, which creates faces for closed loops and splits faces the line
    /// crosses. Returns the edges that make up the line, in order from `a` to `b`.
    pub fn add_line(&mut self, ctx: DefId, a: V3, b: V3) -> Result<Vec<EId>, Error> {
        let edges = self.insert_segment(ctx, a, b)?;
        self.heal_around(ctx, &edges)?;
        Ok(edges)
    }

    /// Insert a segment's edges without healing faces.
    pub fn insert_segment(&mut self, ctx: DefId, a: V3, b: V3) -> Result<Vec<EId>, Error> {
        if !a.is_finite() || !b.is_finite() {
            return Err(Error::Degenerate("line has a non-finite point"));
        }
        if a.dist(b) <= tol::LENGTH {
            return Err(Error::Degenerate("line is too short"));
        }
        // Weld the endpoints to existing points first so the rest works with ids.
        let a = self.find_vertex(ctx, a).map(|v| self.pos(v)).unwrap_or(a);
        let b = self.find_vertex(ctx, b).map(|v| self.pos(v)).unwrap_or(b);
        let dir = b - a;
        let len2 = dir.dot(dir);

        // Touch points along the new segment as (t, vertex).
        let mut cuts: Vec<(f64, VId)> = Vec::new();

        // 1. Existing vertices lying on the segment.
        for (id, v) in self.vertices_in(ctx) {
            let (d, t) = point_segment(v.pos, a, b);
            if d <= tol::LENGTH {
                cuts.push((t, id));
            }
        }

        // 2. Existing edges the segment crosses: split both at the crossing.
        let existing: Vec<EId> = self.edges_in(ctx).map(|(id, _)| id).collect();
        let mut collinear: Vec<EId> = Vec::new();
        for &e in &existing {
            let Some(edge) = self.edge(e).cloned() else { continue };
            let (p, q) = (self.pos(edge.v[0]), self.pos(edge.v[1]));
            match segment_segment(a, b, p, q) {
                Some((s, _, d)) if d <= tol::LENGTH => {
                    let w = self.split_edge(e, a + dir * s)?;
                    cuts.push((point_segment(self.pos(w), a, b).1, w));
                }
                Some(_) => {}
                None => {
                    let touches = |x: V3, s: V3, t: V3| point_segment(x, s, t).0 <= tol::LENGTH;
                    if touches(p, a, b) || touches(q, a, b) || touches(a, p, q) || touches(b, p, q) {
                        collinear.push(e);
                    }
                }
            }
        }

        // 3. Existing edges the segment overlaps: split them at our endpoints and at
        //    every touch point inside them, so overlapping pieces become one edge.
        for e in collinear {
            if self.edge(e).is_none() {
                continue;
            }
            let mut pts: Vec<V3> = vec![a, b];
            pts.extend(cuts.iter().map(|&(_, v)| self.pos(v)));
            for w in self.split_edge_at(e, &pts)? {
                cuts.push((point_segment(self.pos(w), a, b).1, w));
            }
        }

        // 4. The endpoints themselves.
        let va = self.vertex_at(ctx, a);
        let vb = self.vertex_at(ctx, b);
        cuts.push((0.0, va));
        cuts.push((1.0, vb));

        cuts.sort_by(|x, y| x.0.total_cmp(&y.0));
        let min_dt = if len2 > 0.0 { tol::LENGTH / len2.sqrt() } else { 1.0 };
        let mut chain: Vec<VId> = Vec::new();
        for (t, v) in cuts {
            if chain.last() == Some(&v) {
                continue;
            }
            if let Some(&last) = chain.last() {
                let (_, lt) = point_segment(self.pos(last), a, b);
                if (t - lt).abs() < min_dt {
                    continue;
                }
            }
            chain.push(v);
        }
        let mut edges = Vec::new();
        for w in chain.windows(2) {
            edges.push(self.add_edge(w[0], w[1])?);
        }
        Ok(edges)
    }

    /// Split an edge at every point (among `pts`) that lies strictly inside it.
    /// Returns the vertices at those points.
    pub fn split_edge_at(&mut self, e: EId, pts: &[V3]) -> Result<Vec<VId>, Error> {
        let edge = self.edge(e).cloned().ok_or(Error::Missing("edge"))?;
        let (p, q) = (self.pos(edge.v[0]), self.pos(edge.v[1]));
        let mut inside: Vec<V3> = pts
            .iter()
            .copied()
            .filter(|&x| {
                point_segment(x, p, q).0 <= tol::LENGTH && x.dist(p) > tol::LENGTH && x.dist(q) > tol::LENGTH
            })
            .collect();
        // Split from p toward q so each later point lies on the remaining tail.
        inside.sort_by(|x, y| x.dist(p).total_cmp(&y.dist(p)));
        let tail_end = edge.v[1];
        let mut current = e;
        let mut out = Vec::new();
        for x in inside {
            if out.last().is_some_and(|&w: &VId| self.pos(w).dist(x) <= tol::LENGTH) {
                continue;
            }
            let w = self.split_edge(current, x)?;
            out.push(w);
            match self.edge_between(w, tail_end) {
                Some(next) => current = next,
                None => break,
            }
        }
        Ok(out)
    }

    /// Heal every plane that the given edges lie in.
    pub fn heal_around(&mut self, ctx: DefId, edges: &[EId]) -> Result<(), Error> {
        let planes = self.candidate_planes(ctx, edges);
        for plane in planes {
            let seeds: Vec<EId> = edges
                .iter()
                .copied()
                .filter(|&e| self.edge(e).is_some() && self.edge_in_plane(e, &plane))
                .collect();
            if !seeds.is_empty() {
                self.heal(ctx, &plane, &seeds, &[], Vec::new())?;
            }
        }
        Ok(())
    }

    pub fn edge_in_plane(&self, e: EId, plane: &Plane) -> bool {
        self.edge(e).is_some_and(|ed| ed.v.iter().all(|&v| plane.contains(self.pos(v))))
    }

    /// Planes a set of edges could form faces in: the planes of faces that contain an
    /// edge, and the planes an edge spans with each non-parallel neighbor.
    fn candidate_planes(&self, ctx: DefId, edges: &[EId]) -> Vec<Plane> {
        let mut planes: Vec<Plane> = Vec::new();
        let mut push = |p: Plane| {
            if !planes.iter().any(|q| q.same_surface(&p)) {
                planes.push(p);
            }
        };
        for &e in edges {
            let Some(edge) = self.edge(e) else { continue };
            let (a, b) = (self.pos(edge.v[0]), self.pos(edge.v[1]));
            for (_, f) in self.faces_in(ctx) {
                if f.plane.contains(a) && f.plane.contains(b) {
                    push(f.plane);
                }
            }
            let dir = b - a;
            for &end in &edge.v {
                let Some(vx) = self.vertex(end) else { continue };
                for &n in &vx.edges {
                    if n == e {
                        continue;
                    }
                    let Some(ne) = self.edge(n) else { continue };
                    let other = self.pos(ne.other(end));
                    let nd = other - self.pos(end);
                    if let Some(normal) = dir.cross(nd).unit() {
                        if let Some(p) = Plane::from_point_normal(a, normal) {
                            push(p);
                        }
                    }
                }
            }
        }
        planes
    }
}
