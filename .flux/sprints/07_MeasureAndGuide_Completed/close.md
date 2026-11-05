# Close: MeasureAndGuide

- Start: e025cc7
- Close: the commit whose message is `close(sprint-07): MeasureAndGuide`
- Tests: `flux test`'s command (`cargo test --workspace && npm test && uv run --project survey pytest survey/tests`) at Gate 1 and Gate 6: exit code rule, exit 0 at both (every kernel suite ok, fuzz 27 s; 203 app tests in 15 files; 27 survey tests). The same run also passed `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `npm run build:kernel`, `npm run typecheck`, `npx vite build` and `node scripts/check-precache.mjs`, the CI sequence. The `flux` CLI was not installable in this session (the install was denied), so each gate's command was run by hand and its facts recorded here; the sprint move, the task statuses in plan.md and the plan step were written in the format flux writes, as sprint 06's close did.

## Gate 2: Interface

Definition diff of the touched modules between e025cc7 and HEAD (a definition grep in the repomap's format, since `flux repomap --diff` could not run): 0 outside the record (`git log e025cc7..HEAD --invert-grep -F --grep='(sprint-07):'` is empty).

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `doc.rs` `GuideId`, `GuideShape`, `Guide`, `Change::Guide`, `Change::GuidesVisible`, `Document.guides`, `guides_visible`, `set_guide`/`guide` (setter! pair), `next_guide`, `guides_in`, `guides_visible()`, `set_guides_visible` | added | In spec, matches | none |
| `guide.rs` `add_guide_line`, `add_guide_point`, `erase_guides`, `erase_all_guides`; `lib.rs` `pub mod guide` | added | In spec, matches (`add_guide_*` also return `Error::Missing("definition")` for an unknown context, a check the spec's lock check implies) | none |
| `check.rs` `FindingKind::BadGuide` (`bad_guide`), `Finding.guides` | added | In spec / not in spec: the id field | spec.md § Added during implementation |
| `common/mod.rs` `validate` guide assertions | below resolution | In spec | `kernel/tests/common/mod.rs:178`-183 |
| `common/fuzz.rs` `Op::Guide { point, normal, distance }`, `Op::EraseGuide`, weights `[i64; 14]`, `render_op` arms | added / below resolution | In spec, matches (`EraseGuide` picks the lowest live id) | `kernel/tests/common/fuzz.rs:103`, `:252`; recorded |
| `format.rs` `File.guides`, `File.guides_visible`, `FileGuide::{Line, Point}`, `default_true` | added / below resolution | In spec, matches; `default_true` private | `kernel/src/format.rs:28`-45; recorded |
| `kernel-wasm` `add_guide_line`, `add_guide_point`, `erase_guides`, `erase_all_guides`, `guides`, `guides_visible`, `set_guides_visible` | added | In spec, matches | none |
| `model.ts` `EntityKind` `"guide"`, `GuideRecord`, `Finding.kind` `"bad_guide"`, `Finding.guides`, `addGuideLine`, `addGuidePoint`, `eraseGuides`, `eraseAllGuides`, `guides`, `guidesVisible`, `setGuidesVisible`, `exists` for guides | added / changed | In spec, matches | none |
| `model.ts` `guideOwner` | added | Not in spec: public, needed by `exists` and `survey/mode.ts` | Recorded; the user is asked at merge time whether it stays public (it is small and read-only) |
| `scene.ts` `WorldGuide`, `SceneIndex.guides()`, `defGuides`, `guideScreenDistance` | added | In spec / not in spec: the field and the shared helper | Recorded |
| `viewport.ts` `setGuides(guides, visible)`, `mat.guides` | added | In spec, matches | none |
| `pick.ts` `pickEntity` returns guides; `pickGuide`, `POINT_PX` | changed / added | In spec (order: edge, guide, face; plan.md Task 4.2 note) / private | Recorded |
| `erase.ts`, `select.ts`, `move.ts`, `rotate.ts`, `survey/mode.ts` guide handling | below resolution | In spec | `erase.ts:49`-53, `select.ts:84`-87, `move.ts:97`, `:142`, `rotate.ts:160`, `:245`, `survey/mode.ts:36` |
| `engine.ts` `InferenceKind` six kinds, `EdgeLock`, `Inference.guide`, `cycleEdgeLock`, `edgeLock`, `referencedEdge`, `reset`, `clicked` | added | In spec, matches | none |
| `engine.ts` ranking | below resolution | In spec, differs: from-point below On Edge and On Guide | spec.md ranking line amended with the reason (Task 5.2 note) |
| `engine.ts` `edgeDir`, `intersectionSnap`, `edgeCue`, `fromPointCue`, `guideSnap`, `isPointSnap`, `crossing`, `EdgeRef`, `CROSS_TOL` | added | Not in spec: private | Recorded |
| `units.ts` `parseAngle` slope | below resolution | In spec, matches | `app/src/units.ts:121`-127 |
| `measure.ts` `TapeMeasureTool` (`id`, `cursor` getter, `hint`, `vcbLabel`, `busy`, `modifier`, `deactivate`, `move`, `down`, `up`, `key`, `vcb`) | added | In spec, matches; the state record gained `plane`, `planes`, `ignore` (Task 6.1 note) | spec.md § Added |
| `protractor.ts` `ProtractorTool` (`id`, `cursor`, `hint`, `vcbLabel`, `busy`, `deactivate`, `move`, `down`, `up`, `key`, `vcb`) | added | In spec, matches | none |
| `rotate.ts` `protractorNormal`, `protractorRadius` (exported) | added | In spec (Task 7.2's shared helper) | none |
| `app.ts` `tools.measure`, `tools.protractor`, key `t`, `ArrowDown` cycle, `reset` on `setTool` and Esc, `clicked` on pointerdown, `guidesBtn`, `deleteGuidesBtn`, `entityGeometry` for guides, `drawOverlay` → `setGuides`, `drawGuide` magenta; `toggleGuides`, `deleteGuides`, `cursorStyle`, `MAGENTA`, `MARKER_CLASS` entries | below resolution / added | In spec / private | `app/src/app.ts:97`-98, `:226`, `:343`-357, `:733`, `:905`-913, `:930`; recorded |
| `index.html` Tape (T) and Protractor buttons, Delete guides, Hide guides; `style.css` cursors and marker styles | below resolution | In spec | `app/index.html:28`, `:31`, `:46`-47 |
| Tests and test helpers | added | Not in spec: tests | Recorded one per line |

Spec entries absent from the diff: none. `Selection.ids("guide")` and `Selection.prune` work unchanged, as the spec says (`tools.test.ts` "Model guides").

## Gate 3: ADRs

No proposed ADRs (the sprint's `decisions/` is empty); none of the accepted ADRs carries an ast-grep rule.

- mvr2ooxl Survey code lives in the builder repo: not touched; `git diff --stat e025cc7..HEAD -- survey` is empty.
- mvr2op7t Namespaced attributes in the builder format: guides are their own top-level `guides` key and `guides_visible` flag, not attributes (`kernel/src/format.rs` `File`), additive under the compatibility rules (`docs/file-format.md` § Guides); no attribute namespace was added.
- mvr2opid Tag lock enforced by the kernel: `add_guide_line` and `add_guide_point` call `check_def_unlocked(ctx)`, `erase_guides` checks every owner before writing anything, `erase_all_guides` skips locked owners (`kernel/src/guide.rs`); `kernel/tests/guides.rs::a_locked_owner_refuses` and `::erase_all_is_one_entry_and_leaves_locked_owners_guides` cover them; the tools refuse a locked context before previewing (`TapeMeasureTool.down`, `ProtractorTool.down`) and `measure.test.ts` sees the toast.
- mw27k22l Survey record is the source of truth: not touched.

## Gate 4: Project docs

Document tasks 1.5, 2.3, 5.5, 6.4, 7.5, 8.2, 8.3: `docs/architecture.md` (§ 2 guides paragraph, § 3 arena and journal, tag-lock list, § 4 keys, § 6 ranking, memories and locks, § 9 fuzz list and `BadGuide`, § 10 status and limits), `docs/file-format.md` (§ Top level rows, new § Guides), `docs/features.md` (Tape Measure, Protractor and Rotate rows), `README.md` (inference bullet, Tools line, Tape Measure and Protractor bullets, Keys rows, Delete and toolbar paragraph), `docs/roadmap.md` (row 2.3 done, row 2.5 delivered with it), `docs/sprints.md` (§ 2.3 resolutions), `docs/walkthrough-deck.md` (steps 7-9 and the renumbering, Results, Known gaps) all changed since e025cc7 and match their tasks. The changed lines were verified against the code: the key T is in `app.ts` `keys`; the `+` cursor is `--cursor-measure` and the Ctrl tap `TapeMeasureTool.modifier`; the labels `On Guide`, `Guide Point`, `Intersection`, `Parallel to Edge`, `Perpendicular to Edge`, `From Point` are the engine's; the 15°/1° steps are `TICK` and `FINE` in `protractor.ts`; `3:12` is `parseAngle`'s; `guides` is written sorted by id and `guides_visible` only when false (`format.rs`); the error paths `guides[1].dir` and `guides[0].definition` are the reader's; the fuzz op list and 27 s are measured; every entry point named in the tag-lock list exists; the walkthrough's counts are the replay's assertions and its `(4', 4', 0)` corner the footprint assertion. One in-scope fix applied: the Check model button's title (`app/index.html`) now names bad guides as the README does. No out-of-scope entries in the changed lines, so no doc-drift item was filed. No symbol was changed or removed in shape, so step 3 found nothing to update.

## Gate 5: Criteria

Task statuses (plan.md, every Status written as `flux tasks` writes it): 32 tasks, 32 completed; 8 phases, 8 completed.

| Criterion | Evidence |
|---|---|
| F1 kernel guide tests | [x] `kernel/tests/guides.rs`, six tests |
| F1 file round trip, no keys, guide in a group | [x] `kernel/tests/format.rs`, three tests and `fixtures/guides.builder` |
| F2 guide line 4', retype 3' one undo | [x] `measure.test.ts` |
| F2 guide point 2' from an endpoint | [x] `measure.test.ts` |
| F2 measure-only, revision unchanged | [x] `measure.test.ts` |
| F2 locked context toast | [x] `measure.test.ts` |
| F3 typed 37, `3:12`, 22° near centre → 15° | [x] `protractor.test.ts`, `units.test.ts` |
| F3 plane follows the face, arrow keys lock | [x] `protractor.test.ts` |
| F4 parallel, perpendicular, Down cycle, Shift | [x] `inference.test.ts` |
| F4 intersection, guide point, on guide, from-point | [x] `inference.test.ts` |
| F4 post footprint at a guide intersection by snapping | [x] `offset.test.ts` "Deck walkthrough" |
| F5 hidden saved, Delete Guides one step, Erase | [x] `format.rs`, `tools.test.ts` |
| F5 fuzz under a minute | [x] 27 s; 17 Guide and 34 EraseGuide ops at the CI seed |
| F5 docs per Impact, walkthrough replays | [x] Gate 4; "Deck walkthrough" test |
| F5 browser check by Patrick | [ ] **waiting on Patrick's browser run** |

Backlog under Impact: #mvr7ne51 (phone capture test) out of scope, left open; #mw27k22m (clearance check) and #mw27k22n (demo marking) are Milestone 3 survey work the sprint did not touch, left open. Nothing to archive.

Backlog archived: none. Backlog created: none.

## Gate 6

`flux repomap --save` could not run (no `flux` in this session): `.flux/repomap.md` still carries `commit: e41a3ad`. The next session with the CLI runs `flux repomap --save` and commits it. Sprint moved to `07_MeasureAndGuide_Completed`; `.flux/plan.md` step 6 set done at 7837733.

Waiting on Patrick after the merge: in the hosted build, the deck walkthrough's steps 7-9: Tape Measure (T) from the rim's front and left bottom edges, `4'` each, the dashed guides across the deck, `Intersection` where they cross, the 4 × 4 drawn there with no position typed; then Protractor from the toolbar for a `3:12` guide on the ground; Hide guides and Delete guides from the toolbar; the perf line should read `146 faces` at the end and Check model `clean`.
