# Implementation Plan: SurveyToolkit

## Overview

Nine phases, each about a day or more and each one commit. Phases 1–2 make `survey/` a toolkit with no house in it and with its own docs. Phases 3–4 add attributes, tag lock and material colours to the kernel, wasm and scene. Phase 5 makes survey write `.builder`. Phases 6–7 build survey mode and the Proposed → plan export in the app. Phase 8 rebuilds capture for phone + voice. Phase 9 updates the project docs and runs the end-to-end walkthrough. Execution runs straight through. The only stops are output changes that need the 20SPierson reference updated (sent to the 20SPierson conversation, verified on a scratch copy meanwhile) and Patrick's phone test in Phase 8.

## Tasks

### Phase 1: Toolkit Settings and Materials

**Status:** completed
**Dependencies:** none

#### Task 1.1: Output stem and out dir

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: survey/src/builder_survey/project.py
  - Modify: survey/src/builder_survey/build.py
  - Modify: survey/src/builder_survey/cli.py
  - Modify: survey/src/builder_survey/export/ruby.py
  - Modify: survey/src/builder_survey/export/dae.py
  - Modify: survey/src/builder_survey/export/sh3d.py
  - Modify: survey/src/builder_survey/render/blender_build.py
  - Modify: survey/src/builder_survey/capture/serve.py
- **Context:** [spec.md§Proposed](spec.md#proposed), [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `output_stem`, `out_dir` and `--out`, and `Project.stem()`. Every exporter and the Blender script take the stem and out dir instead of `basement` and `model/out`. Remove the house names from docstrings.

#### Task 1.2: Material table from library and spec

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: survey/src/builder_survey/materials.py
  - Modify: survey/src/builder_survey/build.py
  - Modify: survey/src/builder_survey/generate/pipes.py
  - Modify: survey/src/builder_survey/export/mesh.py
  - Modify: survey/src/builder_survey/export/dae.py
  - Modify: survey/src/builder_survey/export/ruby.py
  - Modify: survey/src/builder_survey/export/sh3d.py
  - Modify: survey/src/builder_survey/export/previews.py
  - Modify: survey/src/builder_survey/export/check_plan.py
  - Modify: survey/src/builder_survey/render/blender_build.py
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Make `LIBRARY` generic-only and add `material_table(spec)`, which merges in spec `materials:`. Pass the table to every user of `MATERIALS`/`rgb`. Blender builds its materials from the recipes named in `mesh.json`, so it has no house list of its own. An unknown material name stops the build with the element named. (2026-10-27: the spec's Blender recipes come from a separate `render_recipes(spec)`, since `material_table` returns colours only so the exporters keep their `name -> (r, g, b)` shape. `mesh.json` also carries `stem` and `recipes`, so the Blender script, which can't import the project code, names the `.blend` and builds the spec's materials. House materials removed from `LIBRARY` and from Blender's built-in list: walnut, iron, landscape_block, boiler_green, sauna_wood, wh_jacket, worn grey paint, stucco.)

#### Task 1.3: kind and source on elements

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: survey/src/builder_survey/elements.py
  - Modify: survey/src/builder_survey/export/mesh.py
  - Modify: survey/src/builder_survey/spec/ctx.py
  - Modify: survey/src/builder_survey/generate/objects.py
  - Modify: survey/src/builder_survey/generate/layout.py
  - Modify: survey/src/builder_survey/generate/pipes.py
  - Modify: survey/src/builder_survey/generate/joists.py
  - Modify: survey/src/builder_survey/generate/walls.py
  - Modify: survey/src/builder_survey/generate/fixtures/place.py
  - Modify: survey/src/builder_survey/build.py
- **Context:** [spec.md§Proposed](spec.md#proposed)
- **Description:** Write `kind` into each element record of `mesh.json`. Read the optional `source:` key on spec entries and fail when its folder does not exist under the project. (2026-10-27: `kind` in mesh.json is already done as part of 1.2's `mesh.py` edit. `source` is passed explicitly at each `element()` call site from the entry dict: `o` objects, `j` joists, `w` walls, `f` fixtures, `r` rooms floor in layout.py:164, and `r.get("source", p.get("source"))` for pipe runs. Ctx paths are report labels, not spec paths, so `ctx.py` is not changed. `build.py` gets `check_sources(project, elements)`, which fails when a source folder is missing. That is why joists.py, walls.py, fixtures/place.py and build.py were added.)

#### Task 1.4: Golden --write and the lock file

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: survey/tests/golden.py
  - Modify: survey/pyproject.toml
- **Context:** [spec.md§Proposed](spec.md#proposed)
- **Description:** `--write` copies the new outputs over the reference after printing the differences. Keep `survey/uv.lock` committed and add a `dev` group with pytest. (2026-10-27: golden.py now runs the build as `sys.executable -m builder_survey.cli` instead of `uv run --project <project> survey`, so it can be run from any env with builder-survey installed, including this worktree's `survey/.venv` against a scratch copy of 20SPierson whose path dependency points elsewhere; `cli.py` got a `__main__` guard for it. The scratch copy keeps the `measurements/` folder tree, without files, so `source:` keys resolve. Also fixed while running the build: `sh3d.py` shadowed the `mats` parameter with a local; `capture/serve.py` takes its paths from `Project`; `.venv/` added to `.gitignore`.)

#### Task 1.5: Verify against 20SPierson

- **Type:** test
- **Status:** completed
- **Dependencies:** [1.1, 1.2, 1.3, 1.4]
- **Files:**
  - Create: survey/tests/test_project.py
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Add unit tests for the stem slug, out-dir precedence and the material merge. Run golden on a scratch copy of 20SPierson that has `output_stem: basement` and the `materials:` snippet. Expected differences: `mesh.json` (kind, material table). Run `survey render` (Blender is on this Mac) on the scratch copy to confirm `basement.blend` builds with the materials from the table. Send the snippet and the list of differences to the 20SPierson conversation.

#### Task 1.6: README for settings and materials

- **Type:** document
- **Status:** completed
- **Dependencies:** [1.1, 1.2]
- **Files:**
  - Modify: survey/README.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Document the new `survey.yaml` keys, `--out`, spec `materials:` and `source:`, and `golden.py --write`.

### Phase 2: Toolkit Docs

**Status:** completed
**Dependencies:** [Phase 1]

#### Task 2.1: Spec and plan format docs

- **Type:** document
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: survey/docs/spec-format.md
  - Create: survey/docs/plans.md
- **Context:** [requirements.md§Feature 3](requirements.md#feature-3-docs-split)
- **Description:** Write the spec conventions, lengths, references, checks, levels, MISSING / `~` / CONFLICTS, `materials:` and `source:`, from 20SPierson `model/HANDOFF.md` (Spec conventions, Rebuild). Write the plan format from `model/plans/README.md`, updated to `survey` commands.

#### Task 2.2: Survey-mode contract, render and export notes

- **Type:** document
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: survey/docs/contract.md
  - Create: survey/docs/render.md
  - Create: survey/docs/exports.md
- **Context:** [requirements.md§Feature 3](requirements.md#feature-3-docs-split)
- **Description:** Write the geometry rule as the contract for survey mode and for agents editing a spec. Write up the Blender render notes (Metal kernel cache, close GUI Blender). Cover each output, the SH3D `dropOnTopElevation` finding and the 2D layout page idea.

#### Task 2.3: Link from README

- **Type:** document
- **Status:** completed
- **Dependencies:** [2.1, 2.2]
- **Files:**
  - Modify: survey/README.md
- **Context:** [requirements.md§Feature 3](requirements.md#feature-3-docs-split)
- **Description:** Link each doc from the README. Send 20SPierson the list of HANDOFF sections now covered, so it can point to them.

### Phase 3: Kernel Attributes and Tag Lock

**Status:** completed
**Dependencies:** none

#### Task 3.1: Attribute and tag types in the document

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/doc.rs
  - Modify: kernel/src/group.rs
  - Modify: kernel/src/topo.rs
  - Modify: kernel/src/heal.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `attributes` to Face, Definition and Instance, `locked` to Tag, `AttrTarget`, `set_attribute`, `new_tag`, `set_tag`, `set_tag_flags`, `is_locked_def` and `Error::Locked`/`Attribute`. Split faces inherit attributes through `OldRegion`.

#### Task 3.2: Lock checks on every edit

- **Type:** implement
- **Status:** completed
- **Dependencies:** [3.1]
- **Files:**
  - Modify: kernel/src/line.rs
  - Modify: kernel/src/pushpull.rs
  - Modify: kernel/src/edit.rs
  - Modify: kernel/src/group.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `add_line`, `push_pull`, `move_vertices`, `erase`, `erase_instance`, `make_group`, `explode` and `set_transform` return `Error::Locked` when they touch a locked definition or instance.

#### Task 3.3: Format read and write

- **Type:** implement
- **Status:** completed
- **Dependencies:** [3.1]
- **Files:**
  - Modify: kernel/src/format.rs
  - Create: kernel/examples/validate.rs
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Read and write `attributes` on definitions, instances and faces, sorted, rejecting non-scalar values with the path named. Read and write `locked` on tags. Add the `validate` example.

#### Task 3.4: Kernel tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [3.2, 3.3]
- **Files:**
  - Create: kernel/tests/attributes.rs
  - Modify: kernel/tests/format.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Test that attributes, including unknown namespaces, round-trip byte-stable after one save, that set and delete are undone and redone, that a split face keeps its attributes, that each locked edit is refused, and that a v1 file without attributes still loads.

#### Task 3.5: Format and architecture docs

- **Type:** document
- **Status:** completed
- **Dependencies:** [3.3]
- **Files:**
  - Modify: docs/file-format.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Document the attributes section and the tag `locked` key. Update the attributes slot in architecture from "planned" to its real shape.

### Phase 4: WASM API and Scene Colours

**Status:** completed
**Dependencies:** [Phase 3]

#### Task 4.1: WASM bindings

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `attributes`, `set_attribute`, `tags`, `new_tag`, `set_instance_tag`, `set_tag_flags`, `instance_props`, `materials`, `face_materials` and `definition_name`. (2026-10-27: `instance_props` also returns `locked`, and `is_locked_def` is bound, so the scene can mark locked draw items and tools can skip them without walking tags in TS. `face_materials` is per triangle of `buffers(def)`, matching `faceIds`. Opacity is applied per item from the lowest material opacity among its triangles, with a shared translucent material; per-face opacity within one item is not rendered.)

#### Task 4.2: Model wrapper

- **Type:** implement
- **Status:** completed
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add typed wrappers for the new calls. Writes bump `revision`.

#### Task 4.3: Tag visibility and material colours in the scene

- **Type:** implement
- **Status:** completed
- **Dependencies:** [4.2]
- **Files:**
  - Modify: app/src/view/scene.ts
  - Modify: app/src/view/viewport.ts
  - Modify: app/src/tools/pick.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Draw items carry their tag, material and lock. Hidden tags are skipped. Triangles take the face, instance or theme colour, with opacity. Locked items are not offered as hover targets for editing tools but still snap.

#### Task 4.4: Scene tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [4.3]
- **Files:**
  - Create: app/test/scene.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Test that hidden tags drop items, that colours resolve face before instance before theme, and that the lock flag reaches the draw item.

### Phase 5: Survey Writes .builder

**Status:** completed
**Dependencies:** [Phase 1, Phase 3]

#### Task 5.1: The .builder exporter

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: survey/src/builder_survey/export/builder.py
  - Modify: survey/src/builder_survey/build.py
- **Context:** [spec.md§Proposed](spec.md#proposed), [spec.md§Data Models](spec.md#data-models)
- **Description:** Write one group per element, with one child group per part. Prisms, cylinders and meshes become planar faces. Tags Existing, Demo and Proposed (the first two locked), the materials from the table and the `survey:*` attributes go on the definition. Output is deterministic.

#### Task 5.2: Exporter tests and kernel validation

- **Type:** test
- **Status:** completed
- **Dependencies:** [5.1]
- **Files:**
  - Create: survey/tests/test_builder_export.py
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Unit-test part → face conversion (prism, sloped top, cylinder, mesh) for planarity and winding. Build 20SPierson (scratch copy) base and test plan and run `validate` on both. Golden shows exactly the new `basement.builder` files. Send that list to 20SPierson.

#### Task 5.3: Document the export

- **Type:** document
- **Status:** completed
- **Dependencies:** [5.1]
- **Files:**
  - Modify: survey/docs/exports.md
  - Modify: survey/README.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Describe the `.builder` output, its groups, tags and attributes, and how to open it in Builder.

### Phase 6: Survey Mode in Builder

**Status:** completed
**Dependencies:** [Phase 4, Phase 5]

#### Task 6.1: Survey panel: tag strip and attribute view

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: app/src/survey/mode.ts
  - Modify: app/index.html
  - Modify: app/src/style.css
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `isSurveyModel`, a tag strip with visibility checkboxes and lock toggles (journaled), and a read-only panel listing the selection's instance, definition and face attributes by namespace.

#### Task 6.2: Wire survey mode into the app

- **Type:** implement
- **Status:** completed
- **Dependencies:** [6.1]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/src/tools/tool.ts
  - Modify: app/src/tools/select.ts
- **Context:** [spec.md§Proposed](spec.md#proposed)
- **Description:** On load, detect survey mode and make Proposed the active tag, so Make Group puts new groups on it. Turn `Locked` errors into a "Locked: Existing" message. Entering a locked group is refused. The panel updates when the selection changes.

#### Task 6.3: Survey mode tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [6.2]
- **Files:**
  - Create: app/test/survey.test.ts
  - Modify: app/test/toolhost.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** On a small survey-shaped model: move, push and erase on Existing are refused, a new group lands on Proposed, and hiding a tag removes its items.

#### Task 6.4: Features doc

- **Type:** document
- **Status:** completed
- **Dependencies:** [6.2]
- **Files:**
  - Modify: docs/features.md
- **Context:** [requirements.md§Feature 6](requirements.md#feature-6-survey-mode-in-builder)
- **Description:** Record the status of attributes, material colours, tag visibility and lock, and survey mode.

### Phase 7: Proposed to Plan Export

**Status:** completed
**Dependencies:** [Phase 6]

#### Task 7.1: Box detection and YAML writer

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: app/src/survey/plan-export.ts
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** `exportProposed` finds the axis-aligned box groups on Proposed (world transform applied) and writes `add: objects:` entries in feet-inches. Everything else goes in `skipped`, by name. (2026-10-27: written with Phase 6, because the survey panel's Export plan button and `App.exportPlan` import it; the Phase 6 commit carries 7.1–7.3 and Phase 7's commit carries 7.4. `at` and `size` are both written as feet-inches by one `ftin` (`2'6"`, not `30"` as the spec example shows); survey's `parse_length` reads either. Unnamed groups (`Group#N`) become `proposed_N`; the group's instance material name is used when set, else `proposed`.)

#### Task 7.2: Export command

- **Type:** implement
- **Status:** completed
- **Dependencies:** [7.1]
- **Files:**
  - Modify: app/src/survey/mode.ts
  - Modify: app/index.html
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** An "Export plan" button in the survey panel asks for a plan name and downloads `NAME.yaml`. A flash message lists anything skipped.

#### Task 7.3: Round-trip test

- **Type:** test
- **Status:** completed
- **Dependencies:** [7.1]
- **Files:**
  - Create: app/test/plan-export.test.ts
  - Create: survey/tests/fixtures/plan_export.yaml
  - Create: survey/tests/test_plan_roundtrip.py
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** In TS: a box, a rotated box and a non-box give one entry and two skipped, and the YAML equals the shared fixture. In Python: that same fixture builds through `apply_plan` + `build_objects` to the box's corner and size.

#### Task 7.4: Document the export

- **Type:** document
- **Status:** completed
- **Dependencies:** [7.2]
- **Files:**
  - Modify: survey/docs/plans.md
- **Context:** [spec.md§Proposed](spec.md#proposed)
- **Description:** Describe drawing in Builder, what exports and what is skipped, and where to put the file.

### Phase 8: Phone and Voice Capture

**Status:** completed
**Dependencies:** [Phase 1]

#### Task 8.1: HTTPS serving and v2 entries

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: survey/src/builder_survey/capture/serve.py
  - Modify: survey/src/builder_survey/cli.py
  - Modify: survey/src/builder_survey/project.py
- **Context:** [spec.md§Proposed](spec.md#proposed), [spec.md§Data Models](spec.md#data-models)
- **Description:** Add `--cert`/`--key` and `capture_tls`. Accept several photos plus an audio blob per submit. Write v2 `entry.json`. Read v2 checklist items and v1 entries.

#### Task 8.2: Phone-first page

- **Type:** implement
- **Status:** completed
- **Dependencies:** [8.1]
- **Files:**
  - Modify: survey/src/builder_survey/capture/index.html
- **Context:** [requirements.md§Feature 7](requirements.md#feature-7-phone--voice-capture)
- **Description:** A one-handed layout: camera input, a hold-to-record or toggle voice note through `MediaRecorder`, optional marks and insets, Save. No form fields. A banner on HTTP. The open questions list shows reference photos, and past entries show their transcripts.

#### Task 8.3: Transcription and entries command

- **Type:** implement
- **Status:** completed
- **Dependencies:** [8.1]
- **Files:**
  - Create: survey/src/builder_survey/capture/transcribe.py
  - Create: survey/src/builder_survey/capture/entries.py
  - Modify: survey/src/builder_survey/cli.py
  - Modify: survey/pyproject.toml
  - Modify: survey/uv.lock
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Run faster-whisper in a background thread after each save, writing `transcript_error` when the extra is not installed. Add `survey entries [--uncited]`. (2026-10-27: audio is decoded with PyAV in `transcribe.decode` and passed to the model as samples, because faster-whisper 1.2's `decode_audio` calls `av.open(metadata_errors=...)`, which PyAV 19 (what uv resolved) no longer accepts; this avoids pinning `av`. Cached models load with `local_files_only=True` first, so a Mac without internet still transcribes. The test project sets `transcribe_model: tiny.en` (75 MB) so the suite does not fetch the 480 MB default; the real transcription check was run by hand on a `say`-generated m4a: "Return pipe is 32 and a half inches to the top at the West Wall". `make_server(host=...)` was split from `serve()` so the test can bind 127.0.0.1 on a free port.)

#### Task 8.4: Capture tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [8.2, 8.3]
- **Files:**
  - Create: survey/tests/test_capture.py
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Start the server on a temp project and POST a v2 entry with a photo and a short real audio clip. Check the files and `entry.json`, the transcript when the extra is installed, that v1 entries still list, and the cited/uncited logic of `entries`.

#### Task 8.5: Capture docs

- **Type:** document
- **Status:** completed
- **Dependencies:** [8.3]
- **Files:**
  - Create: survey/docs/capture.md
  - Modify: survey/README.md
- **Context:** [requirements.md§Feature 7](requirements.md#feature-7-phone--voice-capture)
- **Description:** Cover the mkcert setup (Mac and iPhone root CA), `uv sync --extra transcribe`, the phone workflow, the entry layout, the v2 checklist, and the loop from entry to spec through `source:`.

### Phase 9: Project Docs and End-to-End Walkthrough

**Status:** pending
**Dependencies:** [Phase 2, Phase 7, Phase 8]

#### Task 9.1: Roadmap, README and handoff

- **Type:** document
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: docs/roadmap.md
  - Modify: docs/sprints.md
  - Modify: README.md
- **Context:** [requirements.md§Impact](requirements.md#impact)
- **Description:** Place survey mode relative to Milestone 3 (its minimal UI gets replaced by 3.2–3.4). Add `survey/` to the README with the build and open commands.

#### Task 9.2: End-to-end walkthrough

- **Type:** test
- **Status:** pending
- **Dependencies:** [9.1]
- **Files:**
  - Create: survey/docs/walkthrough.md
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Run the browser end to end on the real basement through `make start`: open, lock, tags, `~` colour, attributes, draw, export, build the plan. Record the commands and their outputs. The phone test is listed as waiting on Patrick.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.

## Plan Review

**Reviewed:** 2026-10-27

- [x] Requirements to Spec traced
- [x] Spec to Plan traced
- [x] Proposed ADRs checked against accepted
- [x] Checklist passed (1 warning accepted: `test.command` is unset in `.flux/config.yaml`; tests run by the commands in spec.md Validation Criteria)

**Plan Status:** Ready for implementation
