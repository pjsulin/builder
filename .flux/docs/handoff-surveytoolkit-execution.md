---
type: markdown
---
# Handoff: SurveyToolkit execution (2026-10-27)

Sprint `01_SurveyToolkit_Current` (`.flux/sprints/01_SurveyToolkit_Current/`). Read `requirements.md` Background, `kickoff.md`, `spec.md` (skip the Baseline), `plan.md`, then this file. Continue with `/execute`. Patrick wants all phases run without stopping; ask only on real decisions.

## Where it stands

`flux tasks` is the source of truth for statuses. Nothing is committed since `50dbb5e` (sprint moved to Current); the working tree has two phases in progress.

### Phase 1 (survey toolkit): done by hand in this session, untested

- **1.1 output stem / out dir (in_progress, code written):** `project.py` has `slug()`, `Project(root, out)`, `stem()`, `out_dir`, `output_stem`, and `measurements`/`photos`/`checklist` paths. `cli.py` has `--out` on build and render, and render passes `--out` to Blender. Every exporter writes `{stem}.*`, including the sh3d home name (`name='{stem}'`, single quotes kept so Home.xml is unchanged).
- **1.2 material table (in_progress, code written):** `materials.py` has `LIBRARY` (generic), `RECIPES`, `material_table(spec)`, `render_recipes(spec)` and `rgb(table, name)`. Every exporter takes `mats`. `build.py` has `check_materials()`. `mesh.json` has `stem`, `recipes` and element `kind`. In `blender_build.py`, the `RECIPES` dict and `make_real_materials(recipes)` are in place, the house entries are removed, the `.blend` is named from `stem`, and `OUT = opt.out`.
- **1.3 (pending):** `kind` is done. `source:` is not started. The plan has the exact call sites (dated note in Task 1.3).
- **1.4–1.6 (pending):** `golden.py --write`, the pytest dev group, `test_project.py`, the golden run on a scratch copy of 20SPierson, `survey render` on that copy (Blender is at `/Applications/Blender.app`), and the README.

**Not yet run:** any build. First do `uv run --project survey survey build --project <scratch copy of 20SPierson>` with `output_stem: basement` in its `survey.yaml` and the `materials:` snippet from spec.md Data Models in its `spec.yaml`.

**Expected golden differences:**
- `mesh.json`: new `stem`, `recipes` and `kind` keys, and the material order.
- `basement.rb` and `basement.dae`: the material table order changed, because the house materials now come after the library.
- Nothing else. Any other difference is a bug.

Send the 20SPierson conversation (ion task `feb0a13c-5096-4cb0-9419-1e3dd32bb385`, through `mcp__ion__send_message`) the `materials:` snippet, `output_stem: basement`, and the list of differences with their reasons.

### Phase 3 (kernel): done by a background agent from this session

A subagent was given tasks 3.1–3.5. It writes `kernel/` and `docs/` only, does not commit, and does not touch `.flux/`. Its changes are in the tree: `kernel/src/*.rs`, `kernel/examples/validate.rs`, `kernel/tests/attributes.rs`, and possibly `docs/file-format.md` and `docs/architecture.md`. Its status is in the "Phase 3 agent" section below. Review the changes against spec.md Interfaces (Kernel), run `cargo test --workspace`, check that kernel-wasm still builds, then set 3.x done and commit Phase 3 on its own (`feat(sprint-01): Phase 3 Kernel Attributes and Tag Lock`).

## Commit order

Phases 1 and 3 touch different files. Commit each when it is green: stage only that phase's files plus plan.md, after `flux tasks done` for its tasks and phase. Both commits carry `Ion-Task: 78b1c725-4386-4f2f-ad2b-669e531dc2f7` and the Co-Authored-By trailer.

## Before /close

`test.command` in `.flux/config.yaml` is unset, so close Gate 1 fails. Set it to run all three test suites:

```
cargo test --workspace && npm test && uv run --project survey pytest survey/tests
```

## Decisions made during execution (already recorded in plan.md / spec.md)

- `material_table` returns colours only, and `render_recipes` returns the Blender recipes (Task 1.2 note, spec Interfaces).
- `mesh.json` carries `stem` and `recipes`, because the Blender script can't import the project code.
- `source:` is passed explicitly at each `element()` call site, since Ctx paths are report labels (Task 1.3 note).

## Phase 3 agent

Still running when this was written. Its report goes to the session that started it, which appends it here.
