# Close: SurveyToolkit

- Start: e444aa9
- Close: the commit whose message is `close(sprint-01): SurveyToolkit`
- Tests: `flux test` at Gate 1 and Gate 6: `no JUnit configured; exit code rule: exit 0` (test.command set at close: `cargo test --workspace && npm test && uv run --project survey pytest survey/tests`; 12 Rust suites, 79 app tests, 27 survey tests)
- Other commits in the range (`git log e444aa9..HEAD --invert-grep --grep='(sprint-01):'`): 50dbb5e, c9f8522, 23c07c7, all flux/handoff docs, no code.

## Gate 2: Interface

`flux repomap --diff e444aa9 --record sprint-01`: 2 removed, 178 added, 13 changed, 0 outside record. Full list in the diff; every spec entry below.

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `Project.__init__(root, out)`, `Project.stem`, `slug`, `CONFIG_KEYS` (+ `capture_tls`, `transcribe_model`) | changed / added | In spec, matches | none; `measurements`/`photos`/`checklist` fields below resolution: project.py:48–50, `test_project_paths` |
| `LIBRARY`, `RECIPES`, `material_table`, `render_recipes`, `rgb(table, name, alpha)` | added / changed | In spec, matches | none |
| `MATERIALS` | removed | In spec (replaced by `LIBRARY`) | recorded under Added during implementation |
| `build(project_dir, plan, out)`, `write_ruby`, `write_dae`, `write_sh3d`, `write_mesh_json`, `write_previews`, `write_check_plan`, `check_materials`, `check_sources`, `write_builder` | changed / added | In spec, matches | none |
| `element(..., source=None)` | changed | In spec, matches | none |
| blender `RECIPES`, `make_real_materials(recipes)` | added / changed | In spec, matches | none; `--out` required: blender_build.py:588 |
| `serve(project, port, cert, key)`, `transcribe(entry_dir, model)`, `list_entries(project)` | changed / added | In spec, matches | none |
| CLI `build --out`, `render --out`, `capture --cert --key`, `entries --uncited`; `golden.py --write` | below resolution | In spec | verified: cli.py:17,21,37–38,43; golden.py:77 |
| `AttrValue`, `Attributes`, `AttrTarget`, `Document::attributes/set_attribute/new_tag/set_tag/set_tag_flags`, `is_locked_def` | added | In spec, matches | none |
| `Face/Definition/Instance.attributes`, `Tag.locked`, `Error::Locked/Attribute`, `OldRegion.attributes` | below resolution | In spec | verified: doc.rs:105,133,145,162; lib.rs:46–49; heal.rs:20 |
| Lock check at `add_line`, `push_pull`, `move_vertices`, `erase`, `erase_instance`, `make_group`, `explode`, `set_transform` | below resolution | In spec | verified by ast-grep: `check_def_unlocked` in line.rs, pushpull.rs, edit.rs ×2, group.rs; `check_instance_unlocked` in group.rs ×4 |
| `kernel/examples/validate.rs` | added | In spec, matches | none |
| wasm `attributes`, `set_attribute`, `tags`, `new_tag`, `set_instance_tag`, `set_tag_flags`, `materials`, `face_materials`, `definition_name` | added | In spec, matches | none |
| wasm `instance_props` | added | In spec, differs (`locked` field) | spec.md updated |
| wasm `is_locked_def`, Model `isLockedDef` | added | Not in spec: legitimate addition | spec.md updated |
| Model `attributes`, `setAttribute`, `tags`, `newTag`, `setInstanceTag`, `setTagFlags`, `materials`, `faceMaterials`, `definitionName`; types `AttrKind`, `Attributes`, `TagInfo`, `MaterialInfo` | added | In spec, matches | none |
| Model `instanceProps` | added | In spec, differs (returns `InstanceProps | null`) | spec.md updated |
| `DrawItem.tag/material/locked`, hidden-tag skip, colour resolution | below resolution | In spec | verified: scene.ts (DrawItem fields, `walk` skips `!t.visible`, `triColor`); `app/test/scene.test.ts` |
| `isSurveyModel`, `PlanExport` | added | In spec, matches | none |
| `SurveyPanel` constructor | added | In spec, differs (`(host: SurveyHost, container)`) | spec.md updated |
| `exportProposed(m, planName, date?)` | added | In spec, differs (`date`) | spec.md updated |
| private helpers, constants, tests, `walkthrough.mjs`, `make_server`, `entries()` (replaces `answers()`), `transcribe_file`, `decode`, `print_entries`, builder.py pieces, mode.ts helpers, `ftin`, `triColor`, `AttrValue`, `InstanceProps`, `RGBA` | added | Not in spec: supporting additions | recorded in spec.md § Added during implementation |

## Gate 3: ADRs

Accepted at close, moved to `.flux/decisions/` with their IDs; none supersedes another (`.flux/decisions/` was empty).

- mvr2ooxl Survey code lives in the builder repo: `survey/` is the uv project `builder-survey` (survey/pyproject.toml, uv.lock committed); 20SPierson depends on it by path (`/Users/psulin/repos/workspaces/20SPierson/pyproject.toml:16`, `path = "../builder/survey", editable = true`); Python runs through `uv run` only (Makefile test target, README).
- mvr2op7t Namespaced attributes in the builder format: `Attributes = BTreeMap<String, BTreeMap<String, AttrValue>>` (doc.rs:43), fields on Face/Definition/Instance (doc.rs:105,133,145); scalar-only check (doc.rs:65) and namespace `[a-z][a-z0-9_-]*` (doc.rs:57–61); version stays 1 and empty maps are not written (format.rs `skip_serializing_if = "BTreeMap::is_empty"`); split faces keep attributes (heal.rs:184, `split_face_keeps_its_attributes`); byte-stable (`attributes_and_locks_round_trip_byte_stable`).
- mvr2opid Tag lock enforced by the kernel: `Tag.locked` (doc.rs:162), `Error::Locked` returned from every entry point (ast-grep above; `every_edit_of_locked_geometry_is_refused`, `locks_reach_nested_groups_and_their_parents`); journaled (`set_tag_flags` through `set_tag_record`, undo test in `every_edit_of_locked_geometry_is_refused`); snapping still works (scene keeps locked items; pick filters only in Push/Pull, Move, Erase).

## Gate 4: Project docs

Document tasks (1.6, 2.1–2.3, 3.5, 5.3, 6.4, 7.4, 8.5, 9.1, 9.2): every file changed since start (`git diff --stat e444aa9`): survey/README.md +96/−20, survey/docs/{spec-format 227, plans 78, contract 28, render 54, exports 71, capture 123, walkthrough 98}, docs/file-format.md +28, docs/architecture.md +8/−6, docs/features.md +15/−4, docs/roadmap.md +2, docs/sprints.md +2, README.md +18/−1.

`/verify-docs` over the Impact docs and root README, changed ranges only: the two verifier agents were cut off by a network outage, so the check was done inline. Builder docs (file-format Attributes section and `locked` row; architecture document model, attributes and tag-lock bullets, limits line; features tags/Entity Info/materials rows and the Survey mode table; roadmap survey-mode paragraph; README status, survey section, layout, make test): every claim verified against doc.rs (check_attribute texts, fields), format.rs (`skip_serializing_if`, path-named errors, `locked` serialized), edit.rs/pushpull.rs (`a.attributes == b.attributes`, attribute copying), the ast-grep count of lock checks, lib.rs Display text, mode.ts/app.ts (`Locked: <tag>`, active tag at root), scene.ts/viewport.ts (colour order), the survey tests and the walkthrough run. Survey docs (seven new files and survey/README ranges): every quoted message checked against the code (`plan 'NAME': no file`, `Can't read length`, `write_sh3d: a <kind> part goes below the floor datum`, `<element>: no realistic material for`, `materials.<name>...` validation, `unknown material`), severity thresholds 2"/6" (checks.py:7), `--check` colours (materials.py:35–36), `--quick` 16 samples (blender_build.py:660), render options against the docstring, `capture_tls`/`transcribe_model` keys (project.py:33), entry.json v2 keys and `void` (serve.py), v1 handling (index.html `entryHtml`), `dropOnTopElevation='-1'` rule (sh3d.py:104–107), spec top-level keys against `spec.get(...)` in the generators. One Stale entry fixed: survey/README's unknown-material example lacked the message's `(add it to the spec's materials:)` tail. No out-of-scope drift found in the ranges' neighbourhood, so no doc-drift backlog item

Gate 4.3: `git grep` over `*.md` for the removed/changed shapes (`MATERIALS`, `rgb(name`, `write_sh3d(out, elements`, `write_dae(out_dir, model_name`, `answers()`) finds nothing outside `.flux/`.

## Gate 5: Criteria

`flux tasks --record sprint-01`: 36 tasks, 36 completed (exit 0).

| Criterion | Evidence |
|---|---|
| F1 ADR accepted | `.flux/decisions/mvr2ooxl-*.md`, status accepted |
| F2 no house names; names from `name:` | `grep -rniE "pierson|basement" survey/src` empty; `Project.stem`, `test_stem_defaults_to_slugged_name` |
| F2 `kind` on every mesh.json element | export/mesh.py; scratch build: 8 kinds over 133 elements |
| F2 house materials in the spec, builds and renders use them | `LIBRARY` without them; scratch build + Blender render with the spec recipes |
| F2 out dir settable | `test_out_dir_precedence`; `--out` |
| F2 golden 0 or reference updated with reasons | difference list with reasons sent to 20SPierson (Phases 1 and 5); scratch `--write` then 0 differ |
| F3 survey/docs complete | seven docs; examples built while writing |
| F3 20SPierson docs point to survey/docs | not met here: backlog #mvr7ndvo (20SPierson's edit) |
| F4 round-trip incl. unknown namespaces | `attributes_and_locks_round_trip_byte_stable` |
| F4 undo/redo | `set_and_delete_are_undone_and_redone` |
| F4 file-format doc, old files load | docs/file-format.md § Attributes; `files_without_attributes_still_load_and_write_none` |
| F5 .builder loads, base and plan | validate: 559/558 and 622/621 ok |
| F5 one group per element with tag, materials, attrs | `test_file_shape` |
| F6 opens, tags hide/show | walkthrough §§ 2, 5; `hides a tag's items and journals the flags` |
| F6 Existing not editable, drawing lands on Proposed | survey.test.ts (3 tests); walkthrough §§ 4, 6 |
| F6 attributes shown, `~` marked | walkthrough § 3, img/survey-mode.png |
| F6 box exports and builds in place; skipped listed | walkthrough §§ 7–8; `test_exported_plan_builds_the_box`; plan-export.test.ts |
| F7 iPhone under 30 s | waiting on Patrick: backlog #mvr7ne51 |
| F7 entry folder contents | `test_v2_entry_with_photo_and_audio`; spoken m4a transcribed |
| F7 old entries list | `test_v1_items_and_entries_still_list` |
| F7 Patrick changes the model | waiting on Patrick: backlog #mvr7ne51 |

Backlog archived: none (Impact listed none). Backlog created: #mvr7ndvo, #mvr7ne51.
