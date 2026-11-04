---
title: Clearance check for proposed groups in Builder
status: pending
description: 'Carry the 2D layout page''s one feature Builder lacks: clearance zones (front, side, around, door swing) on a proposed group, and a check that reports what each zone or body overlaps, height-aware. Prerequisite for retiring survey''s layout2d page (ADR mw27k22l).'
created: '2026-11-04T00:00:00Z'
---

The 2D layout page (`survey/src/builder_survey/layout2d/space_plan.py`, `<room>_plan.html`) is used for basement planning because it filters existing obstacles by height and warns when a dragged piece hits something or when its clearance zone is cut into (red, orange, green). Builder gets the top view and parallel projection in Sprint 4.2 and already hides by tag, and in 3D a box under a pipe either intersects it or not. What Builder has no equivalent for is the clearance check.

Proposed shape: clearances as attributes on a proposed group (`survey:clearance_front`, `_side`, `_around`, `_swing`, inches), carried to the plan export; a check command that lists, for each Proposed group, the Existing elements its body or any zone overlaps, by name, with the overlap distance. The 2D page's rule set (a piece only hits what overlaps its own height range; swing is a quarter circle at the hinge side) is the reference behaviour. The page's unbuilt next step, clearance rules keyed by object type with a code citation, belongs here rather than in the page.

Done when a basement layout that the page flags red and orange is flagged the same way in Builder from the same `.builder` file, and the page can be retired (ADR mw27k22l, item 3).
