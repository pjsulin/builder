---
type: markdown
---
# Handoff: survey/ refactor (2026-10-27)

Read first: `CLAUDE.md` (freeze + geometry rule), `.flux/docs/extract-to-builder.html`, `survey/README.md`.

## State
Branch `refactor-model-pipeline-into-survey-package`, 10 commits after `9327fa1`, working tree clean.
The pipeline is the `builder-survey` package in `survey/` (command `survey`: `build`, `render`, `capture`, each with `--project DIR`).
Golden master (base + synthetic plan `survey/tests/plans/testplan.yaml`): 0 differences, except the first comment line of `basement.rb`.
Frozen data untouched; the only spec edit is `name:`. House settings are in `survey.yaml`.
Not committed: the golden outputs themselves (built from the original code, kept in the session scratch dir). To recreate, check out `9327fa1`, run `uv run python model/build.py` and `--plan` with the test plan copied to `model/plans/`, copy `model/out/` (without renders) to `GOLDEN/base` and `out/plans/testplan` to `GOLDEN/testplan`, and replace line 1 of each `basement.rb` with the new header.

## Not verified
- `survey render` (Blender): there is no Blender in the container. Only compiled and the command line checked.
- Flaky build: about 1 in 100 builds failed once in the matplotlib 3D preview ("Axis limits cannot be NaN or Inf"); original code was 0/40. `golden.py` retries once.

## Where commands run
- Container (dsm, Linux): edit, `uv run survey build`, golden check, capture server test.
- Mac host: Blender (`/Applications/Blender.app`), the Builder repo (`/Users/psulin/repos/workspaces/builder`). Not visible from the container.
- `/worktrees/<branch>` is a bind mount of `<repo parent>/20SPierson-worktrees/<branch>` on the Mac (dsm, 2026-10-27), so the branch is on the Mac without a pull.
- dsm now prints host and container OS in the prompt (dsm branch `dsm-tell-agents-in-containers-where-they-run`, containers need `dsm container --new`). It does not yet print host paths.

## Next
1. Patrick, on the Mac, in the worktree folder: `uv sync` then `uv run survey render --project .` (no `--render`) to confirm `basement.blend` builds. Optionally `uv run survey build --project .` to refresh `model/out/`.
2. Merge the branch.
3. New conversation with Builder mounted: map Builder's milestones/sprints against `extract-to-builder.html` (the roadmap was not available in this container), then the move into `builder/survey` with history (doc step 1), switch the path dependency to `../builder/survey`, lift the freeze.
4. Follow-ups: `kind` in `mesh.json`; spec `materials:` section for the house materials (walnut, iron, landscape_block, boiler_green, sauna_wood, wh_jacket; Blender-side worn grey paint, stucco); configurable out dir; capture redesign (phone + voice, doc step 4a); docs split (doc step 3); decide on `survey/uv.lock`.
5. Left alone because frozen: `model/plans/README.md` still shows the old commands; header comments in `measure/checklist.yaml` and `model/spec.yaml`; committed `model/out/` (its `basement.rb` has the old header).
