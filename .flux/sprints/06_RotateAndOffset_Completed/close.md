# Close: RotateAndOffset

- Start: 4f22f3b
- Close: the commit whose message is `close(sprint-06): RotateAndOffset`
- Tests: `flux test`'s command (`cargo test --workspace && npm test && uv run --project survey pytest survey/tests`) at Gate 1 and Gate 6: exit code rule, exit 0 at both (kernel suites all ok, fuzz 23-25 s; 174 app tests; 27 survey tests). The `flux` CLI was not installable in this session, so each gate's command was run by hand and its facts recorded here; the task statuses in plan.md were written in the format `flux tasks` writes.

## Gate 2: Interface

Definition diff of the touched modules between 4f22f3b and HEAD (a definition grep in the repomap's format, since `flux repomap --diff` could not run): 48 added, 1 changed (`fold_for_move`), 0 removed, 0 outside the record (`git log 4f22f3b..HEAD --invert-grep` over the scope is empty).

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `math.rs` `mat_rotation`, `mat_apply_dir`, `mat_is_finite` | added | In spec, matches | none |
| `edit.rs` `transform_vertices`, `transform_and_integrate`, `copy_geometry_transformed` | added | In spec, matches | none |
| `edit.rs` `fold_for_move(verts, m)` | changed | In spec, matches; also checks holes (Phase 3 fuzz finding) | spec.md § Added during implementation |
| `edit.rs` `move_vertices`, `move_and_integrate`, `copy_geometry` | below resolution (bodies now wrap the transform forms) | In spec | `kernel/src/edit.rs:25`, `:103`, `:148` |
| `group.rs` `copy_instance_transformed`; `copy_instance` wrapper | added / below resolution | In spec, matches | `kernel/src/group.rs:165` |
| `lib.rs` `pub mod offset`, `Error::SelfIntersecting` (Display "that offset would cross itself") | added | In spec, matches | none |
| `offset.rs` `offset_loop`, `Document::offset_face`, `Document::offset_edges` | added | In spec, matches | none |
| `offset.rs` `mitre`, `area2`, `segments_meet`, `check_distance`, `lift`, `chain_of`, `draw_loops` | added | Not in spec: private helpers | Recorded under § Added during implementation |
| `heal.rs` `heal_moved`, `heal_impl`, `Region.only_fresh`; `line.rs` `heal_around_moved`, `heal_planes` | added | Not in spec: the moved-ring fix (crate-private) | Recorded under § Added during implementation |
| `fuzz.rs` `Op::Rotate`, `Op::Offset`, weights `[12, 20, 15, 8, 6, 8, 3, 5, 4, 3, 4, 4]` | added / below resolution | In spec, matches | `kernel/tests/common/fuzz.rs:246` |
| `kernel-wasm` `transformVertices`, `transformAndIntegrate`, `copyGeometryTransformed`, `copyInstanceTransformed`, `offsetFace`, `offsetEdges` | added | In spec, matches | none |
| `kernel-wasm` `matrix`, `id_list` | added | Not in spec: private helpers | Recorded |
| `model.ts` the six wrappers | added | In spec, matches | none |
| `math.ts` `rotation` | added | In spec, matches | none |
| `units.ts` `parseAngle`, `formatAngle` | added | In spec, matches | none |
| `tool.ts` `Overlay.protractor` | added | In spec, matches | none |
| `rotate.ts` `RotateTool` (`id`, `cursor` getter, `hint`, `vcbLabel`, `busy`, `modifier`, `deactivate`, `move`, `down`, `up`, `key`, `vcb`) | added | In spec, matches | none |
| `rotate.ts` `Rotating`, `Selected`, `LastCopy`, private methods | added | Not in spec: private | Recorded, with the two behaviours that differ from Move |
| `offset.ts` `OffsetTool` (`id`, `cursor`, `hint`, `vcbLabel`, `busy`, `deactivate`, `move`, `down`, `up`, `key`, `vcb`) | added | In spec, matches | none |
| `offset.ts` `Offsetting`, `Target`, private methods, `newell` | added | Not in spec: private | Recorded |
| `app.ts` `tools.rotate`, `tools.offset`, keys `q`, `f`; `protractorSegments` | below resolution / added | In spec (the `"protractor"` layer); the function is the drawing | `app/src/app.ts:86`-87, `:855`, `:897`; recorded |
| `index.html` Rotate (Q) and Offset (F) buttons | below resolution | In spec | `app/index.html:44`-45 |
| Tests and test helpers | added | Not in spec: tests | Recorded one per line |

## Gate 3: ADRs

No proposed ADRs (the sprint has no `decisions/`); none of the accepted ADRs carries an ast-grep rule.

- mvr2ooxl Survey code lives in the builder repo: not touched; `git diff --stat 4f22f3b..HEAD -- survey` is empty.
- mvr2op7t Namespaced attributes in the builder format: `copy_geometry_transformed` clones face attributes (`kernel/src/edit.rs` `with_face`) and `copy_instance_transformed` clones the instance record and deep-copies the definition with its attributes (`kernel/src/group.rs`); the offset's split faces come from `heal`, which refills old regions with the old face's materials and attributes. No format change.
- mvr2opid Tag lock enforced by the kernel: `transform_vertices` checks every vertex's owner, `transform_and_integrate` the one definition, `copy_geometry_transformed` the context, `copy_instance_transformed` the instance and its parent, `offset_face` the face's owner, `offset_edges` the context, all before writing; `kernel/tests/rotate.rs::a_locked_definition_is_not_rotated` and `kernel/tests/offset.rs::a_locked_definition_is_not_offset` cover them; the tools refuse a locked selection before previewing (`RotateTool.down`, `OffsetTool.down`) and the headless tests see the toast.

## Gate 4: Project docs

Document tasks 1.5, 2.4, 3.3, 5.5, 6.3, 7.4, 8.1, 8.2: `docs/architecture.md` (§ 2 transform and offset paragraphs, errors, tag-lock list, § 6 overlay, § 9 fuzz rule, § 10 status and limits, § 11 row), `docs/features.md` (Rotate and Offset rows), `README.md` (Tools line, Rotate and Offset bullets, copy-and-arrays bullet, Keys rows, docs list), `docs/roadmap.md` (row 2.2 done, 2.3-2.7 renumbered, test-project line), `docs/sprints.md` (§ 2.2 resolutions), `docs/walkthrough-deck.md` (new) all changed since 4f22f3b and match their tasks. The changed lines were verified against the code: the fuzz time (25 s measured), every entry point named in the tag-lock list exists, the keys Q and F are in `app.ts` `keys`, the cursor text `copy` and the hint text `6x` are `RotateTool`'s, the README's `4"` wall and `3"` trim match the Offset tests, the walkthrough's counts are the replay's assertions and its 3' 7 5/16" is 72" × sin 37°. No out-of-scope entries in the changed lines, so no doc-drift item was filed. The only changed symbol, `fold_for_move`, appears in `docs/architecture.md` without a signature and the paragraph was rewritten this sprint; nothing removed.

## Gate 5: Criteria

Task statuses (plan.md, every Status written as `flux tasks` writes it): 31 tasks, 31 completed; 8 phases, 8 completed.

| Criterion | Evidence |
|---|---|
| F1 kernel rotate tests, move and copy unchanged | [x] `kernel/tests/rotate.rs` six tests; `move.rs`, `copy.rs` pass through the wrappers |
| F1 `mat_rotation` unit tests | [x] `math::tests`, two tests |
| F2 kernel offset tests | [x] `kernel/tests/offset.rs` eight tests |
| F2 `offset_loop` unit tests | [x] `offset::tests` five tests |
| F3 stringer typed 37, retype 30, one undo | [x] `rotate.test.ts` |
| F3 sweep 22° → 15°, endpoint exact | [x] `rotate.test.ts` |
| F3 protractor plane rules | [x] `rotate.test.ts` |
| F3 top tilted 10° stays 6 faces, Esc, locked | [x] `rotate.test.ts` |
| F4 rotate-copy, 5x, /6, "Copy something first" | [x] `rotate.test.ts`, five tests |
| F5 wall inward 4", Push/Pull the ring, retype 6" | [x] `offset.test.ts` |
| F5 window outward 3", minus flips | [x] `offset.test.ts` |
| F5 L chain 2", L face too far | [x] `offset.test.ts` |
| F6 fuzz generates both ops under a minute | [x] 25 s; 10 Rotate and 17 Offset ops at the CI seed |
| F6 docs per Impact, walkthrough-deck.md | [x] Gate 4; "Deck walkthrough" test |
| All: browser check by Patrick | [ ] **waiting on Patrick's browser run** |

Backlog under Impact: #mvscxby4 (doc drift in architecture § 10) is delivered by Task 5.5, archived with sprint 06 at 8508d66; #mvr7ne51 (phone capture test) is cited as out of scope, left open.

Backlog archived: #mvscxby4. Backlog created: none.

## Gate 6

`flux repomap --save` could not run (no `flux` in this session): `.flux/repomap.md` still carries `commit: e41a3ad`. The next session with the CLI runs `flux repomap --save` and commits it. Sprint moved to `06_RotateAndOffset_Completed`; `.flux/plan.md` step 5 set done at 8508d66.

Waiting on Patrick after the merge: in the hosted build, the deck walkthrough's steps 11 and 12: a stringer pitched to `37` with the red lock, and the railing built flat with Offset `1 1/2"` and `/5`, stood up with Rotate `90` about green and moved onto the rim; the perf line should read `140 faces` at the end and Check model `clean`.
