---
title: Mark existing elements as demo from Builder
status: pending
description: 'The plan export sends proposed boxes to the spec but a renovation also removes things. A "mark for removal" action on a locked Existing element writes a remove: line with the element''s spec path into the exported plan, so the plan file is complete from Builder without hand edits.'
created: '2026-11-04T00:00:00Z'
---

Today the only way an existing element becomes `demo` is a hand-written `remove:` line in `model/plans/NAME.yaml` (`survey/docs/plans.md`). Builder's plan export (`app/src/survey/plan-export.ts`) writes `add:` only. In a basement renovation the first thing drawn is usually what comes out, so the loop is open at its first step.

Proposed shape: a survey-panel action on a selected Existing group that marks it for removal without unlocking it (an instance attribute such as `survey:remove: true`, journaled, shown in the panel and drawn distinctly); the plan export adds a `remove:` entry per marked element. The spec path is not in the `.builder` today; the survey exporter should write it as `survey:path` (for example `pipes.main`, `layout.doors.office_storage`) so the export can cite it exactly. Elements whose section a plan cannot remove (rooms, ledges, generated walls, per `spec/plan.py`) are refused with the reason, matching how the box export skips what it cannot express.

Done when a plan exported from Builder with one removal and one added box builds with `survey build --plan` and the removed element shows in the Demo collection and the before render only.
