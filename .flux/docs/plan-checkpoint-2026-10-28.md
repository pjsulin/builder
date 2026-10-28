---
type: markdown
---
# Plan checkpoint: sprints 1.1, 1.2, 1.3, 2.1

Pass 1 of `/plan` for the four Created sprints, 2026-10-28. Each sprint's spec.md now holds its real `flux repomap` Baseline. Decide the items under **Calls needed**, then Pass 2 writes spec.md and plan.md.

## Calls needed

1. **CopyAndArrays, group copies (blocking):** requirements.md says `copy_instance` shares the definition; the kickoff says copies are new groups, not components. In this kernel they conflict: `world_transform(def)` (`kernel/src/group.rs`) takes a definition's first instance ("true for groups") and `App.setContext` uses it to enter a group, so a second instance would open at the wrong transform and editing one joist would edit all. **Recommendation:** `copy_instance` deep-copies the group's definition (the `explode` vmap pattern) and clones the instance record; shared definitions wait for components (3.1). Success criterion becomes "copied group has its own definition with equal geometry".
2. **NeverLoseWork hosting:** GitHub Pages (`https://pjsulin.github.io/builder/`), deploy job in ci.yml, no new secrets. One manual step for you: Settings > Pages > Source = GitHub Actions.
3. **MovesThatStick `soft` flag:** defer to styles (5.3). `Edge` has no flag field and the file writes edges as `[u32; 2]`; the additive shape would be a per-definition `soft_edges` list, an ADR and wasm exposure with nothing rendering it. Fold edges are ordinary edges this sprint.
4. **IntersectAndHarden context menu:** the app has no context menu today (only `contextmenu` preventDefault). Phase 6 adds a minimal one for the select tool, or Intersect goes on toolbar buttons only. Recommendation: buttons only this sprint; context menu when more commands need it.

## Settled by evidence (no call needed unless you disagree)

- **Autosave ring:** 10 versions, 50 MB. Stress model `toJson()` measured at 1,014,815 bytes, 12 ms; shed 859 bytes. Debounce 3 s. Autosave hooks the commit points (`commit`/`undo`/`redo`), not `revision`, because `Model.changed()` bumps revision on every preview edit.
- **Service worker:** hand-written `sw.js` with a precache list emitted by a small inline Vite plugin; no `vite-plugin-pwa` (pulls workbox and five deps). Only new devDependency: `fake-indexeddb`.
- **Offline check in CI:** `scripts/check-precache.mjs` compares `dist/` to the precache list; the real offline load stays your manual check (no Playwright).
- **Fold diagonal:** the diagonal whose two triangles' normals stay closest to the original plane at post-move positions; for the box corner that leaves one triangle in the old plane. Preview (`move_vertices`) keeps a bent face unrefreshed instead of erroring; commit (`move_and_integrate`) folds.
- **Weld context and tolerance:** integrate in the moved vertices' own definition (`Vertex.owner`), reject mixed-owner sets; reuse `tol::LENGTH` (1e-3").
- **Intersection arithmetic:** no robust predicates; add `tol::INTERSECT_SIN` (~1e-2) so near-parallel pairs are skipped (with `ANGLE=1e-9` a 1e-3 plane error would move the line ~22"). Edges are inserted into `ctx` only (SketchUp's rule; repeat inside the group to cut the other side).
- **Fuzz:** inline xorshift64* (`rand` is not a dependency; `bench.rs` already inlines an LCG), 2,000 steps in CI, 50,000 `--ignored`, ops recorded by geometry (point + normal) so a ~40-line ddmin shrinker prints a test body.
- **Report a problem:** the journal stores only transaction names, so the report is model JSON plus the last operation names, not replayable ops.
- **Arrays:** require a copy first (`last.dir` keeps only a unit direction; `lastCopy` keeps the offset). Accept `5x`, `x5`, `5*`, `*5`, `/5`, `5/`; `parseLength` returns NaN for all of them. Mac copy key is Option (`altKey`): Ctrl is undo/redo/save/open and Ctrl-click arrives as button 2 (orbit).

## Phase structures

### NeverLoseWork

| Phase | Goal | Depends |
|---|---|---|
| 1 Autosave Store | `app/src/store/autosave.ts` IndexedDB ring (count, bytes, dirty flag); `fake-indexeddb` tests; architecture doc | none |
| 2 Autosave Scheduling | `Model.lastOperation` from `begin()`; `Autosaver` with injectable timer called from commit points; test: 0 `toJson` during previews, 1 after commit + debounce | 1 |
| 3 Restore, Versions, Header | `#fileName` + unsaved marker; `offerRestore()` from `main.ts`; `<dialog>` version list; README | 2 |
| 4 Hosted Build and Offline | `sw.js` + inline Vite plugin, registered in `main.ts`; `deploy` job needing `test` on `main`; `check-precache.mjs`; README URL, features, roadmap, architecture | 3 |

### MovesThatStick

| Phase | Goal | Depends |
|---|---|---|
| 1 Shareable Settle | `integrate_edges`, `cancel_against_opposite`, `remove_coincident_faces` to `pub(crate)`; extract `settle_faces` from `settle`; pushpull tests as regression gate | none |
| 2 Integrate After Move | `Document::move_and_integrate(verts, offset)`: owner check, move, integrate + heal, settle; wasm + `Model.moveAndIntegrate`; tests: ridge stays closed, box onto box, instance never sticks, undo byte-equal | 1 |
| 3 Fold Instead of Reject | `fold_for_move`: triangulate would-be non-planar faces at post-move positions, diagonals via `add_edge`; preview keeps bent faces; corner test, rewrite the `..._fails_because_faces_would_bend` test | 2 |
| 4 Move Tool and Docs | `commit()` aborts preview, begins, `moveAndIntegrate` + `setTransform`, commits; headless fold and weld tests; architecture, features, roadmap | 3 |

Call sites covered: `move_vertices` (wasm lib.rs:142, model.ts:142, move.ts:77, tests/edit.rs, samples.ts:20 unaffected); settle helpers are private to pushpull.rs today.

### IntersectAndHarden

| Phase | Goal | Depends |
|---|---|---|
| 1 Plane Intersection Math | `Plane::intersect`, face bbox helper, `tol::INTERSECT_SIN`; unit tests; tolerance doc | none |
| 2 Intersect Faces | `kernel/src/intersect.rs` `intersect_faces(ctx, faces, with)`; `kernel/tests/intersect.rs` gable roof vs walls, push/erase after, selection-only | 1 |
| 3 Piercing Lines | `insert_segment` splits at piercing points (also exercised by `pushpull.rs:212`); line and pushpull regression tests | 2 |
| 4 Model Check | `kernel/src/check.rs` findings; `validate.rs` prints and exits 1; fixture test; README | none |
| 5 Randomized Kernel Test | `kernel/tests/fuzz.rs` xorshift, geometric `Op`, bounded generator, ddmin; CI 2,000 steps, `#[ignore]` 50,000; regressions file; architecture | 2, 3 |
| 6 Wasm and App Commands | `intersectFaces`, `checkModel` over wasm; buttons (context menu per call 4); findings via `flash`/dialog; features, README | 2, 4 |
| 7 Report a Problem | `app/src/report.ts` ring of transaction names, `buildReport`; offered from the four `catch` sites via the `save()` Blob pattern; test; README | 6 |
| 8 Shed Walkthrough | `docs/walkthrough-shed.md`; roadmap 1.3/1.5 | 7, plus NeverLoseWork and MovesThatStick merged |

### CopyAndArrays

| Phase | Goal | Depends |
|---|---|---|
| 1 Kernel Copy Operations | `copy_geometry(ctx, faces, edges, offset)` with vmap + MovesThatStick integrate; `copy_instance(inst, offset)` deep copy (call 1); bench case; `kernel/tests/copy.rs` incl. lock refusal and timed 50-instance array; architecture | MovesThatStick |
| 2 Wasm and Model Wrappers | `copy_geometry` (JSON `{faces, edges}`), `copy_instance`; `Model.copyGeometry/copyInstance`; undo-as-one-step test | 1 |
| 3 Array Parser | `units.ts` `parseArray` before `parseLength`; keydown auto-focus regex gains `x*`; units tests | none |
| 4 Copy Modifier in Move | `ToolPointer.copy`, `Tool.modifier?()`, keydown hook before the modifier guard; `MoveTool` copy flag, cursor, hint, commit via copy ops, `lastCopy`; toolhost helper; tests; features, README | 2 |
| 5 Linear Arrays | `vcb` tries `parseArray`; `array()` undoes the last Copy and replays N in one transaction; "Copy something first" otherwise; tests for `9x`, `/9`, retype `5x`; README, roadmap | 3, 4 |

## Execution order and cloud hand-off

1.1 and 1.2 are independent and can run in parallel cloud sessions on separate branches. 1.3 Phase 8 and all of 2.1 need 1.2 merged (2.1 Phase 1 calls `move_and_integrate`); 1.3 Phases 1–7 can start alongside 1.2. flux allows one Current sprint per checkout, so each cloud session works in its own clone or worktree.
