# Sprint Kickoff: SurveyToolkit

**Captured from conversation:** 2026-10-27

## Context

The survey compiler (`survey/`, package `builder-survey`) moved from 20SPierson into Builder with its history (18486df); 20SPierson now depends on it by path and keeps only house data. Patrick wants the rest of the work, steps 4–9 of 20SPierson's old plan, as one sprint: survey becomes a Builder-hosted toolkit, the basement opens in Builder, and Patrick walks the house with a phone, dictates, and the model changes. Builder itself has its foundation (kernel, `.builder` v1, Line / Rectangle / Push-Pull / Select / Move / Erase, groups, undo) but none of Milestones 1–3 yet.

## Decisions

- **Survey code lives in the builder repo (`survey/`), not a third repo:** the `.builder` exporter and the file format must change together, and survey mode is a Builder feature (Patrick, 2026-10-27; needs an ADR, none exists yet).
- **20SPierson uses a path dependency (`../builder/survey`, editable) until `builder-survey` 0.1.0:** no release process before the toolkit settles.
- **20SPierson's `model/out/` stays committed:** it is the house's visible record.
- **Survey stays Python:** porting the spec solver to Rust pays off only for in-browser regeneration, which is not a goal here.
- **Capture is phone-first, photo + voice note, no form fields:** that is how the measure app was actually used (better camera; plain-text answers). Marks stay optional; the checklist becomes open questions with an optional reference photo; the answer is the transcript.
- **Transcription runs on the Mac when an entry arrives (local model through the uv project):** the phone only records.
- **The geometry rule is the contract for survey mode:** numbers come only from Patrick; unknown = `MISSING`, guesses = `~`, conflicts are reported, never adjusted. No inferred floor-plan geometry.
- **Golden master stays the guard:** any change to survey's outputs keeps `survey/tests/golden.py` at 0 differences against 20SPierson `tests/golden/`, or updates that reference in 20SPierson with the reason for each difference.
- **One sprint, phases of a day or more, executed without stopping between phases;** ask Patrick only on real decisions.
- **Capture comes last:** Patrick tests it by changing the model on his return.
- **This sprint builds the minimal survey-mode UI itself (Patrick, 2026-10-27, option a):** Milestones 1–3 have not started, so the Existing / Demo / Proposed visibility and lock, a read-only attribute view and the Proposed → plan export are built here, kept minimal, so the full Milestone 3 panels can later replace them.
- **"Cloud" on the attributes step in the old plan is where it was sketched, not a constraint.**

## Scope

**In scope:**

- ADR: survey code lives in the builder repo.
- Toolkit follow-ups: output names from the spec (no `basement.*`), `kind` in `mesh.json`, house materials into a spec `materials:` section (walnut, iron, landscape_block, boiler_green, sauna_wood, wh_jacket; Blender-side worn grey paint, stucco), configurable out dir; decide `survey/uv.lock`.
- Docs split: toolkit docs under `survey/docs/` (spec format, plans format, capture README and process, 2D modeler idea, SH3D `dropOnTopElevation` finding, render notes); house history stays in 20SPierson.
- Namespaced attributes on definitions, instances and faces in the kernel (journaled, undoable), the wasm API and `.builder` format, with `docs/file-format.md` updated.
- `.builder` export from survey: one group per element, tags per phase (Existing / Demo / Proposed), materials, `survey:*` attributes (kind, approx, source); the basement opens in Builder.
- Phone + voice capture app rebuilt around the phone camera and voice notes.
- Builder survey mode: lock existing conditions, survey attributes visible in the UI, Proposed geometry exported to `model/plans/*.yaml`.

**Out of scope:**

- Survey photos as reference images in Builder: needs Builder's images-as-reference (Later tier).
- Porting the spec solver to Rust: only needed for live in-browser regeneration.
- Types and clearance rules as a Builder plugin (old step 4 of the integration list): needs standard views and the plugin API.
- 20SPierson-side edits (reference updates, its plan.md): the 20SPierson host conversation does them.

## Technical Approach

- Survey writes `.builder` directly from the element list, like the other exporters; the kernel's `format.rs` reader is the acceptance test (the file loads and validates).
- Attributes are part of the document model, not `x-` extension keys: the `.builder` reader keeps them, the journal records their writes, and unknown namespaces round-trip untouched.
- Proposed → plan export reads groups on the Proposed tag and writes `add:` entries the survey build already understands; the survey build stays the one source of the house's geometry.
- Golden check runs after every survey change; output renames are made once, with the 20SPierson reference updated in the same step.

## Open Questions

- How small the survey-mode UI can be while still being replaceable by Milestone 3's tag panel, Entity Info and Outliner without rework.
- Attribute model: value types (string / number / bool / nested?), namespace syntax, where they sit in the JSON, whether this bumps the format to version 2 or is an additive v1 change, and the wasm API shape.
- Capture: where the app lives (`survey/src/builder_survey/capture/` served from the Mac, reached from the phone over the LAN?), how the phone reaches it (HTTPS is needed for in-page audio recording on iOS Safari; or use the native recorder through a file input), which local transcription model, and how a new entry reaches the model (a Claude session reading `measurements/` as today, or something that triggers it).
- Rust/WASM boundary: confirm survey never calls the kernel (writes JSON only), and whether the Proposed → plan export runs in the browser (TS over the wasm document) or in Python reading a saved `.builder`.
- Golden coverage for the new outputs: does the reference include the `.builder` file, and which survey outputs are compared byte for byte vs. by content once names change.
- Which free geometry on the Proposed tag can map to plan `add:` entries (boxes and typed fixtures as numbers) and what happens to the rest (mesh object or refused with a message).

## References

- `.flux/docs/extract-to-builder.html` (extraction plan, data model mapping, integration order, decisions)
- `.flux/docs/handoff-survey-refactor.md`
- `survey/README.md`, `survey/tests/golden.py`, `survey/tests/plans/testplan.yaml`
- `docs/file-format.md`, `kernel/src/format.rs`, `kernel/src/doc.rs`, `docs/architecture.md` §§ document model and plugins (attributes slot)
- `docs/roadmap.md`, `docs/sprints.md` (Milestone 3: Sprints 3.1–3.3), `HANDOFF.md`
- 20SPierson (`/Users/psulin/repos/workspaces/20SPierson`): `model/HANDOFF.md` (Rebuild, Spec conventions), `CLAUDE.md` (geometry rule), `measure/checklist.yaml`, `measurements/<date>/<time>-<id>/entry.json`, `tests/golden/`
