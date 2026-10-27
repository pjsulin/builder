---
created: 2026-10-27
sprint: SurveyToolkit
start: e444aa9
started: '2026-10-27'
---

# Requirements: SurveyToolkit

## Background

20SPierson built a survey compiler for one real house: geometry is never drawn, it is compiled from Patrick's measured numbers, and every number keeps its provenance (unknown = `MISSING`, guesses = `~`, conflicts reported, never adjusted). That code now lives in Builder as `survey/` (package `builder-survey`, 18486df), and 20SPierson depends on it by path and keeps only house data. The golden-master check (`survey/tests/golden.py` against 20SPierson `tests/golden/`) shows 0 differences.

What was learned getting here:
- Builder and survey are two halves of one tool. Builder is direct manipulation (the person draws). Survey is measured, checked existing conditions (the person measures, the tool compiles). Survey mode is where they meet: locked existing conditions that the person designs on top of.
- The measure app was used on the phone, not the iPad, because the camera is better. Its form fields were dropped in favour of plain-text answers that Claude reads into the spec, citing the entry folder.
- Builder has its foundation (kernel, `.builder` v1, the basic tools, groups, undo) but none of Milestones 1–3, so the UI that survey mode needs (tags, lock, Entity Info) does not exist yet.

Patrick's statement of the goal: survey becomes a Builder-hosted toolkit, the basement opens in Builder, and he walks the house with a phone, dictates, and the model changes. He wants this as one sprint: requirements that say what the whole thing is for and what done means end to end, a spec that decides the real questions up front, and phases of a day or more executed without stopping. He chose (2026-10-27) to build the minimal survey-mode UI here rather than wait for Milestone 3.

## Summary

Make `survey/` a self-standing toolkit with its own docs, add namespaced attributes to Builder's kernel and file format, have survey write a `.builder` file that opens the basement in Builder with its phases and provenance visible and the existing conditions locked, export work drawn on the Proposed tag back to a survey plan file, and rebuild the capture app so a phone photo plus a dictated note is a complete measurement entry.

## Goals

### Primary Goal

End to end: Patrick photographs and dictates a measurement on his phone; the entry (photo, audio, transcript) lands in 20SPierson `measurements/`; a Claude session takes the number into `spec.yaml` citing the entry; `survey build` produces the updated outputs including `basement.builder` (named from the spec); the file opens in Builder with existing conditions locked, approximate values marked, and each element's source visible; whatever he draws on the Proposed tag exports to `model/plans/NAME.yaml`, and `survey build --plan NAME` builds it.

### Secondary Goals

- Toolkit: no house-specific names, materials or paths left in survey's code; outputs go where the project says.
- Format: attributes are a documented, journaled, round-tripping part of the `.builder` format, usable later by classification, curves and plugins.
- Trust: survey's outputs are only changed on purpose. Every change is either 0 differences on the golden check or a reference update in 20SPierson with a stated reason.
- Records: an ADR for "survey code lives in the builder repo"; toolkit docs live with the toolkit.

## Features

### Feature 1: Survey code in Builder (ADR)

**What:** An ADR recording that the survey toolkit lives in the builder repo under `survey/`, with 20SPierson on a path dependency until `builder-survey` 0.1.0.
**Why:** Decided 2026-10-27 with no record; the `.builder` exporter and format must change together, which is the reason.
**Details:** Context, decision, consequences (one repo for format and exporter; Python and Rust/TS side by side; uv-only Python tooling; release at 0.1.0).
**Integration:** First ADR in `.flux/decisions/`.

### Feature 2: Toolkit follow-ups

**What:** Output file names from the spec's `name:`, a `kind` field per element in `mesh.json`, a spec `materials:` section that adds to or overrides the toolkit library (the house materials move there), a configurable output directory, and a decision on `survey/uv.lock`.
**Why:** The house name, its materials and its paths are still in the toolkit's code; a toolkit must not know the house.
**Details:** House materials: walnut, iron, landscape_block, boiler_green, sauna_wood, wh_jacket, and on the Blender side worn grey paint and stucco. The Blender render reads materials from `mesh.json`/spec rather than its own house list.
**Integration:** Exporters in `survey/src/builder_survey/export/`, `render/blender_build.py`, the golden check, 20SPierson `spec.yaml` (edited by the 20SPierson conversation).

### Feature 3: Docs split

**What:** Toolkit docs under `survey/docs/`: spec format, plan format, capture app, capture process, the 2D layout idea, the SH3D `dropOnTopElevation` finding, render notes, and the geometry rule as the contract for survey mode.
**Why:** The format docs are in 20SPierson's house history; anyone using the toolkit needs them without the house.
**Details:** Taken from 20SPierson `model/HANDOFF.md` (Spec conventions, Rebuild), `model/plans/README.md`, `measure/README.md` and friends; 20SPierson keeps the session history and links here.
**Integration:** `survey/README.md` links each doc.

### Feature 4: Attributes in the kernel and `.builder` format

**What:** Namespaced key–value attributes on definitions, instances and faces, in the kernel's document, its journal (undoable), the wasm API, the `.builder` reader and writer, and `docs/file-format.md`.
**Why:** Survey's provenance (`kind`, `~`, source entry) has to travel with the geometry, and `docs/architecture.md` already reserves this slot for classification and plugins.
**Details:** Unknown namespaces round-trip unchanged. Value types, namespace syntax and the format version are decided in the spec.
**Integration:** `kernel/src/doc.rs`, `format.rs`, `kernel-wasm`, the app's kernel bindings.

### Feature 5: `.builder` export from survey

**What:** `survey build` writes `<name>.builder`: one group per element, tags Existing / Demo / Proposed by phase, materials from the spec, and `survey:*` attributes (kind, approximate values, source entry).
**Why:** The basement has to open in Builder; this is the bridge between the two halves.
**Details:** Same coordinates (inches, Z up, east = +X, south = −Y). Built for the base model and for each plan.
**Integration:** A new exporter next to `mesh`, `dae`, `sh3d`; the kernel's reader is its acceptance test; the golden check compares it.

### Feature 6: Survey mode in Builder

**What:** Minimal UI to work on a survey model: show/hide each tag, Existing locked (cannot be selected for editing, moved, erased or pushed), new geometry goes on Proposed, a read-only panel showing the selection's attributes, approximate (`~`) elements shown in a distinct colour, and an export of Proposed groups to a plan YAML file.
**Why:** Patrick chose to build this now (Milestone 3 has not started); without it the model opens but cannot be designed on safely or sent back to survey.
**Details:** Kept minimal so Milestone 3's tag panel, Entity Info and Outliner replace it without rework. Proposed geometry that cannot be expressed as plan entries is reported, not dropped silently.
**Integration:** `app/src` tools and view, the kernel's tag and attribute data; the exported YAML is read by `survey build --plan`.

### Feature 7: Phone + voice capture

**What:** The capture app rebuilt phone-first: take a photo (or several) with the phone camera, record a voice note, save. Marks (tap-two-points lines, insets) stay optional. The checklist becomes open questions with an optional reference photo. The Mac transcribes each note with a local model and stores the audio and transcript in the entry.
**Why:** That is how the app was actually used; dictation is faster than typing on site.
**Details:** One-handed layout; works over the home LAN from the Mac; no form fields. Entries keep the `measurements/<date>/<time>-<id>/` layout so past entries stay readable.
**Integration:** `survey capture --project DIR`; entries feed the existing Claude-reads-measurements loop. Last in the sprint; Patrick tests it by changing the model.

## Success Criteria

### For Feature 1

- [x] An accepted ADR states that survey code lives in `builder/survey`, why, and the path-dependency-until-0.1.0 rule. Evidence: `.flux/decisions/mvr2ooxl-survey-code-lives-in-the-builder-repo.md`, status accepted at close.

### For Feature 2

- [x] `grep -ri "pierson\|basement" survey/src` finds no house-specific names in code; output names come from `name:`. Evidence: `grep -rniE "pierson|basement" survey/src` exits 1 (nothing); `Project.stem` (survey/src/builder_survey/project.py) and `test_stem_defaults_to_slugged_name`.
- [x] Every element in `mesh.json` has a `kind`. Evidence: survey/src/builder_survey/export/mesh.py writes `kind` per element; the scratch 20SPierson build shows kinds door, fixture, floor, joists, ledge, pipe, sill, wall on all 133 elements.
- [x] The house materials are defined in 20SPierson's spec, not in survey code, and builds and renders use them. Evidence: `LIBRARY` has no walnut/iron/landscape_block/boiler_green/sauna_wood/wh_jacket (Gate 2 diff, materials.py); the `materials:` snippet was sent to the 20SPierson conversation; on the scratch copy with it, `survey build` passes `check_materials` and `survey render` built basement.blend with boiler green, landscape block, stucco, water heater jacket, worn grey floor paint from the recipes.
- [x] The output directory can be set (flag or `survey.yaml`) and defaults to today's `model/out/`. Evidence: `test_out_dir_precedence` (survey/tests/test_project.py); `--out` on build and render (cli.py).
- [x] The golden check is at 0 differences, or 20SPierson's reference has been updated with a list of each difference and its reason. Evidence: the list (mesh.json stem/recipes/kind and material order; basement.rb and .dae material order; new basement.builder in base and testplan) with reasons was sent to the 20SPierson conversation in the Phase 1 and Phase 5 messages; on a scratch copy `golden.py --write` then a re-run gave `base: 10 files compared, 0 differ`, `testplan: 10 files compared, 0 differ`. The reference commit itself is 20SPierson's.

### For Feature 3

- [x] `survey/docs/` holds the spec format, plan format, capture and render docs, and someone with only the builder repo can write a spec and build it from them. Evidence: survey/docs/spec-format.md, plans.md, contract.md, render.md, exports.md, capture.md, walkthrough.md; the YAML examples in spec-format.md and plans.md were built in a scratch project while writing them (Phase 2).
- [ ] 20SPierson's docs point to `survey/docs/` instead of repeating the format. Backlog #mvr7ndvo: the section list was sent to the 20SPierson conversation; the edit is its (Out of Scope below).

### For Feature 4

- [x] Attributes on definitions, instances and faces load, save and round-trip byte-stable through the kernel, including unknown namespaces. Evidence: `attributes_and_locks_round_trip_byte_stable` (kernel/tests/format.rs, namespace `x-myplugin`).
- [x] Setting an attribute is undoable and redoable. Evidence: `set_and_delete_are_undone_and_redone`, `instance_and_face_attributes_are_journaled` (kernel/tests/attributes.rs).
- [x] `docs/file-format.md` documents attributes; files without them still load. Evidence: docs/file-format.md § Attributes; `files_without_attributes_still_load_and_write_none` (kernel/tests/format.rs).

### For Feature 5

- [x] `survey build --project ../20SPierson` writes a `.builder` that the kernel loads without errors, for the base model and the test plan. Evidence: `validate` on the scratch copy: `559 definitions, 558 instances, 3 tags: ok` (base), `622 definitions, 621 instances, 3 tags: ok` (testplan).
- [x] Each element is one group with its phase tag, its materials and `survey:*` attributes for kind, approximate values and source. Evidence: `test_file_shape` (survey/tests/test_builder_export.py).

### For Feature 6

- [x] The basement opens in Builder; Existing / Demo / Proposed can each be hidden and shown. Evidence: survey/docs/walkthrough.md §§ 2 and 5 (headless run); `hides a tag's items and journals the flags` (app/test/survey.test.ts).
- [x] Existing geometry cannot be moved, pushed or erased; drawing works on top of it and lands on Proposed. Evidence: `refuses Move on Existing with a Locked message`, `does not offer locked faces to Push/Pull or the Eraser`, `puts a new group on Proposed and leaves it editable` (app/test/survey.test.ts); walkthrough §§ 4 and 6.
- [x] Selecting an element shows its attributes; `~` elements are visibly marked. Evidence: walkthrough § 3 and survey/docs/img/survey-mode.png (garage floor, `survey:approx true` in orange, element drawn in the placeholder material).
- [x] A box drawn on Proposed exports to `plans/NAME.yaml`, and `survey build --plan NAME` builds it in the right place; geometry that can't be exported is listed in a message. Evidence: walkthrough §§ 7–8 (x 288–318, y −381–−360, z 0–34 in out/plans/vanity/mesh.json); `test_exported_plan_builds_the_box` (survey/tests/test_plan_roundtrip.py); `writes one entry for a box and skips a rotated box and a non-box` (app/test/plan-export.test.ts); `App.exportPlan` flashes the skipped names.

### For Feature 7

- [ ] On an iPhone over the LAN: photo + voice note saved in under 30 seconds with no typing. Backlog #mvr7ne51 (waiting on Patrick; Should Have).
- [x] The entry folder holds the photo(s), the audio, a transcript produced on the Mac, and `entry.json`. Evidence: `test_v2_entry_with_photo_and_audio` (survey/tests/test_capture.py); a spoken m4a transcribed to "Return pipe is 32 and a half inches to the top at the West Wall" (plan.md Task 8.3 note).
- [x] Old entries still list and display. Evidence: `test_v1_items_and_entries_still_list` (survey/tests/test_capture.py); index.html `entryHtml` renders v1 `values`.
- [ ] Patrick changes the model from a dictated entry (a Claude session takes the number into the spec citing the entry, then rebuilds), on his return. Backlog #mvr7ne51 (waiting on Patrick; Should Have).

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `survey/README.md` — commands, output names, out-dir option, links to `survey/docs/`
- `survey/docs/` — new: spec format, plan format, capture, render, SH3D finding, survey-mode contract
- `docs/file-format.md` — attributes section
- `docs/architecture.md` — attributes slot is now real; survey mode as a layer
- `docs/features.md` — attributes, `.builder` from survey, survey mode status
- `docs/roadmap.md` — survey mode placed relative to Milestone 3
- `README.md` — mention `survey/`

### ADRs

- New: survey code lives in the builder repo (Feature 1)
- New if the spec decides it: attributes in the `.builder` format (value model, version)

### Backlog

- None (backlog empty at kickoff)

## Scope

### In Scope

**Must Have:** Features 1–6, Feature 7's capture app and Mac transcription.
**Should Have:** Feature 7's end-to-end test by Patrick (done on his return; the sprint can close with it marked as waiting on him if everything else passes).

### Out of Scope

- Survey photos as reference images in Builder (needs Builder's images-as-reference, Later tier).
- Porting the spec solver to Rust (only for live in-browser regeneration).
- Types and clearance rules as a Builder plugin (needs standard views and the plugin API).
- Milestone 3's full tag panel, Entity Info and Outliner (survey mode builds only the minimal versions).
- 20SPierson-side edits (spec `materials:`, reference updates, its docs): done by the 20SPierson conversation from the lists this sprint produces.

### Open Questions

- Attribute value model, namespace syntax, JSON placement, format version, wasm API shape.
- Capture: in-page recording over LAN HTTPS vs. the phone's native recorder through a file input; which local transcription model.
- Whether Proposed → plan export runs in the browser (TS) or in Python over a saved `.builder`.
- Golden coverage once output names change, and how the `.builder` is compared.
- Which Proposed geometry maps to plan `add:` entries.
