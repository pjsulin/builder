# Close: CopyAndArrays

- Start: 480b033
- Close: the commit whose message is `close(sprint-05): CopyAndArrays`
- Tests: `flux test` at Gate 1 and Gate 6: exit code rule, exit 0 in 4.5s at Gate 1 and exit 0 at Gate 6 (no `test.junit`)

## Gate 2: Interface

`flux repomap --diff 480b033 --record sprint-05`: 31 added, 2 changed, 0 removed, 0 outside the record. The record is numbered 05 because 04 is IntersectAndHarden, closed on its own branch (PR #4) and not yet merged when this sprint started.

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `edit.rs` `Copied`, `copy_geometry` | added | In spec, matches (`Copied` lists the ids alive after integration; spec example amended from 6 to 5, then the test shows 1: a flush copy merges into one box) | spec.md notes (2026-10-28) |
| `group.rs` `copy_instance`, `copy_definition` | added | In spec, matches | none |
| `lib.rs` `pub use edit::Copied` | below resolution | In spec | `kernel/src/lib.rs:33` |
| `examples/bench.rs` copy cases | below resolution (inside `main`) | In spec | `kernel/examples/bench.rs:56`–75, prints `copy instance ×50` and `copy geometry ×50` |
| `kernel-wasm` `copy_geometry`, `copy_instance` | added | In spec, matches | none |
| `model.ts` `copyGeometry`, `copyInstance` | added | In spec, matches | none |
| `units.ts` `ArraySpec`, `parseArray` | added | In spec, matches | none |
| `tool.ts` `ToolPointer.copy` | below resolution (TS field) | In spec | `app/src/tools/tool.ts:18` |
| `tool.ts` `Tool.modifier?` | added | In spec, matches | none |
| `app.ts` `copyKey` | added | In spec, matches | none |
| `app.ts` `pointer`, `keydown`, keyup listener, `hintChanged`, auto-focus regex | below resolution | In spec | `app/src/app.ts:31`, `:151`, `:590`, `:705`–708, `:736`–739, `:752` |
| `move.ts` `LastCopy`, `cursor` getter, `modifier`, `array` | added | In spec, matches | none |
| `move.ts` `Moving.copy`, `Moving.selection`, `lastCopy`, `hint`, `vcb`, `commit` | below resolution | In spec | `app/src/tools/move.ts:7`–18, `:56`–72, `:175`–177, `:252`–260 |
| `move.ts` `Selected`, `makeCopies`, `copyIsLastStep`, `pendingCopy`, `start(..., copy)` | added / changed | Not in spec: private helpers | Recorded under spec.md § Added during implementation |
| `toolhost.ts` `at(p, opts)`, `copyClick` | changed / added | In spec, matches | none |
| `tools.test.ts` `grouped`, `joist`, `copyAlongRed`, `box`; `copy.rs` tests | added | Not in spec: tests | Recorded one per line under § Added during implementation |

## Gate 3: ADRs

No proposed ADRs (the sprint has no `decisions/`); none of the accepted ADRs carries an ast-grep rule.

- mvr2ooxl Survey code lives in the builder repo: not touched; nothing under `survey/` changed.
- mvr2op7t Namespaced attributes in the builder format: copies clone `Attributes` unchanged for faces, definitions and instances (`kernel/src/edit.rs` `copy_geometry` `with_face`, `kernel/src/group.rs` `copy_definition` and `copy_instance`); `kernel/tests/copy.rs::a_copied_group_gets_its_own_equal_definition` asserts the `survey` namespace on the copied face, instance and definition. No format change.
- mvr2opid Tag lock enforced by the kernel: `copy_geometry` calls `check_def_unlocked(ctx)` first (`kernel/src/edit.rs:30`); `copy_instance` calls `check_instance_unlocked(inst)` then `check_def_unlocked(parent)` (`kernel/src/group.rs:144`–145); `kernel/tests/copy.rs::locked_geometry_is_not_copied` covers a locked instance, an unlocked instance inside a locked group and a locked definition; the app refuses before any preview (`MoveTool.down`) and the headless test "refuses to copy a locked group" sees the toast.

## Gate 4: Project docs

Document tasks 1.5, 4.4, 5.3: `docs/architecture.md` (+copy paragraph and the tag-lock entry list), `docs/features.md` (move/copy row), `README.md` (Tools line, copy-and-arrays bullet, keys row), `docs/roadmap.md` (2.1 done) all changed since 480b033 and match their tasks. `/verify-docs` over the changed lines plus the README: bench numbers as printed (10.5 ms, 560 ms), entry points named exist, cursor text `copy` (`MoveTool.cursor`), the joist counts and spellings match the tests and `parseArray`, the Mac key is `altKey` in `copyKey`. No out-of-scope entries found in the changed lines. Changed symbols `start` (private) and `at` (test host) appear in no project doc.

## Gate 5: Criteria

`flux tasks --record sprint-05`: 18 tasks, 18 completed (exit 0).

| Criterion | Evidence |
|---|---|
| F1 kernel copy tests: weld, own definition, validate, undo | [x] `kernel/tests/copy.rs`, six tests |
| F2 copy modifier leaves the original, copies at the offset | [x] "Move with the copy modifier" tests; `copyKey` |
| F3 joist 16" then `9x`: ten at 16" centres, one undo | [x] "makes ten joists at 16 inch centres from one copy and 9x, as one undo step" |
| F3 `/9` across 12' end to end | [x] "spreads ten joists end to end with /9 across 12 feet" |
| F4 50-instance array under 100 ms (debug) | [x] `fifty_instance_copies_commit_quickly`; bench 10.5 ms release |
| All: browser check of the joist example | [ ] **waiting on Patrick's browser run** |

Backlog under Impact: #mvr7ne51 (phone capture test) is cited as out of scope, not as work this sprint delivers; left open, not archived.

Backlog archived: none. Backlog created: none.

Waiting on Patrick after the merge: in the browser, draw a 2x8 joist, group it, Move with Option (Mac) or Ctrl held, type `16"`, then `9x`; Undo, copy it 12' and type `/9`. The cursor reads `copy` while copying and the hint names the array syntax.
