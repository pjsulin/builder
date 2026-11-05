//! Guides: construction lines and points. They are owned by a definition like
//! geometry and journaled like it, but take no part in welding, healing, push/pull
//! or intersection; they only exist to be snapped to.

use crate::doc::*;
use crate::math::V3;
use crate::Error;

impl Document {
    /// Add an unbounded guide line through `origin` along `dir` to `ctx`. `dir` is
    /// stored unit; `Error::Degenerate("guide direction")` when it has no length,
    /// `Error::Locked` when `ctx` is locked (ADR mvr2opid).
    pub fn add_guide_line(&mut self, ctx: DefId, origin: V3, dir: V3) -> Result<GuideId, Error> {
        self.definition(ctx).ok_or(Error::Missing("definition"))?;
        self.check_def_unlocked(ctx)?;
        if !origin.is_finite() || !dir.is_finite() {
            return Err(Error::Degenerate("guide direction"));
        }
        let dir = dir.unit().ok_or(Error::Degenerate("guide direction"))?;
        let id = self.next_guide();
        self.set_guide(id, Some(Guide { owner: ctx, shape: GuideShape::Line { origin, dir } }));
        Ok(id)
    }

    /// Add a guide point at `pos` to `ctx`. `Error::Locked` when `ctx` is locked.
    pub fn add_guide_point(&mut self, ctx: DefId, pos: V3) -> Result<GuideId, Error> {
        self.definition(ctx).ok_or(Error::Missing("definition"))?;
        self.check_def_unlocked(ctx)?;
        if !pos.is_finite() {
            return Err(Error::Degenerate("guide position"));
        }
        let id = self.next_guide();
        self.set_guide(id, Some(Guide { owner: ctx, shape: GuideShape::Point { pos } }));
        Ok(id)
    }

    /// Erase the given guides. `Error::Missing("guide")` if any is gone,
    /// `Error::Locked` if any owner is locked; nothing is written then.
    pub fn erase_guides(&mut self, guides: &[GuideId]) -> Result<(), Error> {
        for &g in guides {
            let owner = self.guide(g).ok_or(Error::Missing("guide"))?.owner;
            self.check_def_unlocked(owner)?;
        }
        for &g in guides {
            self.set_guide(g, None);
        }
        Ok(())
    }

    /// Erase every guide whose owner is unlocked; locked ones are left, not an
    /// error. Returns how many were erased.
    pub fn erase_all_guides(&mut self) -> usize {
        let doomed: Vec<GuideId> = self
            .guides
            .iter()
            .filter(|(_, g)| !self.is_locked_def(g.owner))
            .map(|(i, _)| GuideId(i as u32))
            .collect();
        for &g in &doomed {
            self.set_guide(g, None);
        }
        doomed.len()
    }
}
