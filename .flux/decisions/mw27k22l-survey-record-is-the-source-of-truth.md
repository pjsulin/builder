---
adr: "mw27k22l"
title: "The survey record is the source of truth; Builder is where it is viewed and proposals are drawn"
status: accepted
supersedes: null
superseded_by: null
created: 2026-11-04
---
# The survey record is the source of truth; Builder is where it is viewed and proposals are drawn

## Context

The survey toolkit began because measuring an existing structure, a basement in particular, needed a permanent, standard record of what was measured, what was guessed and what is still unknown. The spec (`survey/docs/spec-format.md`), the capture entries it cites and the report are that record. No off-the-shelf tool kept it; SketchUp was unavailable, so Blender became the viewer and renderer and Sweet Home 3D and the 2D layout page became the planners. Each was a stand-in for a tool to look at the record and draw against it, not a home for the record itself.

Builder now opens the survey's `.builder` output in survey mode: existing conditions locked, proposals drawn on the Proposed tag, and a plan export back to the spec. The roadmap (`docs/roadmap.md`) still frames survey mode as work done ahead of Milestone 3. It is the renovation workflow, which is where the survey toolkit and Builder meet, and SketchUp's usual new-build case is the simpler one.

The contract (`survey/docs/contract.md`) already says that geometry comes from the person measuring and that the model is derived from the spec. This decision records how the applications divide the work around that rule.

## Decision

1. The survey record (`model/spec.yaml`, `model/plans/*.yaml`, `measurements/` entries, `report.md`) is the only permanent, authoritative description of an existing structure and of proposed changes to it. Every model file is derived from it by `survey build` and can be regenerated.
2. Builder is the one place the record is viewed in 3D and proposals are drawn. Drawn geometry reaches the record only through the plan export (`app/src/survey/plan-export.ts`, `survey/docs/plans.md`), as spec entries the person accepts. Builder never becomes a second source of geometry for a surveyed structure.
3. The 2D layout page (`survey/src/builder_survey/layout2d/`) and Sweet Home 3D are planning stand-ins. Their jobs, height-aware placement with clearance checks and marking existing elements for removal, move into Builder (backlog `#mw27k22m`, `#mw27k22n`). The page is retired when both exist in Builder, not before.
4. Blender is a renderer, used for realistic views and nothing else. Once Builder exports glTF (Sprint 4.1), that export plus Blender's own importer is the supported path, with no survey-specific Blender integration added. The existing `mesh.json` exporter and `render/blender_build.py` stay as they are until Patrick has confirmed by hand that the glTF path covers what the renders are used for; only then are they deprecated.
5. No path from Blender or Sweet Home 3D into the spec is built. Nothing done in those tools is a measurement.

## Consequences

- Work that helps a renovation (demo marking, clearance checks, wider plan export) is planned as Builder survey-mode work and sits before or inside Milestone 3, not after Milestone 4.
- `survey build` keeps writing every current output, including `mesh.json`, `.sh3d` and `.dae`, until each is confirmed unused. Removing one is its own ad-hoc with Patrick's confirmation in the record.
- The capture entries stay the raw data. Anything that would place geometry from a photo or a scan without a stated number is outside this decision and would need a new ADR that revisits the contract.
- `docs/roadmap.md` describes survey mode as the renovation workflow, and `docs/sprints.md` carries the thread into Sprints 3.2, 3.3, 4.1 and 4.2 and adds the basement renovation test project to Milestone 3. Both were updated with this decision.
