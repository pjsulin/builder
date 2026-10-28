# Implementation Plan: IntersectAndHarden

## Overview

Intersect Faces (with model and with selection) as a kernel method writing into the open context only, piercing lines that cut faces, a model check in the kernel and the `validate` example, a seeded randomized kernel test in CI with a shrinker, wasm and toolbar exposure of intersect and check, a downloadable problem report from the app's failed operations, and the shed walkthrough. Eight phases, one commit each. Phases 1–7 are verifiable with `cargo test --workspace` and `npm test`; Phase 8 is a document repeated by Patrick in the browser and depends on the NeverLoseWork and MovesThatStick sprints being merged.

Call sites that the changed behaviour reaches (from `ast-grep`): `insert_segment` at `kernel/src/line.rs:17` and `kernel/src/pushpull.rs:212`; `heal_around` at `line.rs:18`; `heal` at `line.rs:171`, `pushpull.rs:239`, `pushpull.rs:261`, `edit.rs:104`; `face_region_contains` at `heal.rs:141`, `heal.rs:169`, `pushpull.rs:254`, `pushpull.rs:280`; `interior_point` at `heal.rs:160` (defined at `heal.rs:440`). No signature changes, so these files are covered by regression tests rather than edits, except where a task lists them.

## Tasks

### Phase 1: Plane Intersection Math

**Status:** completed
**Dependencies:** none

#### Task 1.1: Intersection tolerance

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/tol.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `INTERSECT_SIN = 1e-2` with its doc comment explaining the bound (a `PLANE`-sized error moves the line by at most `PLANE / INTERSECT_SIN`).

#### Task 1.2: Plane::intersect and 3D bounds helpers

- **Type:** implement
- **Status:** completed
- **Dependencies:** [1.1]
- **Files:**
  - Modify: kernel/src/math.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `Plane::intersect(&self, &Plane) -> Option<(V3, V3)>` (point closest to the origin, unit direction, `None` under `INTERSECT_SIN`), `bbox(impl Iterator<Item = V3>) -> Option<(V3, V3)>` and `bbox_overlap_3d`.

#### Task 1.3: Unit tests for plane intersection

- **Type:** test
- **Status:** completed
- **Dependencies:** [1.2]
- **Files:**
  - Modify: kernel/src/math.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** `#[cfg(test)]` cases: parallel planes give `None`; planes 0.5° apart give `None`; perpendicular planes give a point on both planes within `PLANE` and a unit direction; `bbox_overlap_3d` touching within `LENGTH` counts as overlap.

#### Task 1.4: Tolerance section

- **Type:** document
- **Status:** completed
- **Dependencies:** [1.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Add `INTERSECT_SIN` to the tolerance list in "Tolerance and robustness" with the reason near-parallel pairs are skipped rather than intersected.

### Phase 2: Intersect Faces

**Status:** completed
**Dependencies:** [Phase 1]

#### Task 2.1: 3D point-in-face helper

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/heal.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `Document::face_contains_point(&self, &Face, V3) -> bool` next to `face_region_contains` (heal.rs:141), projecting into the face's basis and reusing `face_region_contains`.

#### Task 2.2: intersect module

- **Type:** implement
- **Status:** completed
- **Dependencies:** [2.1]
- **Files:**
  - Create: kernel/src/intersect.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `IntersectWith`, `Cut`, `Document::intersection_cuts` (candidate faces of `ctx` plus instance faces transformed into `ctx` coordinates recursively, pairs by `bbox_overlap_3d` and `Plane::intersect`, line clipped to both face regions) and `Document::intersect_faces` (`check_def_unlocked(ctx)` first, `insert_segment` per cut, one `heal_around` over all drawn edges). Export from `lib.rs` (`pub mod intersect; pub use intersect::{Cut, IntersectWith};`).

#### Task 2.3: Intersect tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [2.2]
- **Files:**
  - Create: kernel/tests/intersect.rs
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** Gable roof planes grouped over a 120 x 96 x 96 box intersected with the walls gives roof–wall edges; the gable wall part above the roof is a separate face that pushes and erases; selection-only cuts only the selected pair; a locked context returns `Error::Locked`; a near-parallel pair draws nothing; `validate` after every step.

#### Task 2.4: Intersection in the architecture doc

- **Type:** document
- **Status:** completed
- **Dependencies:** [2.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add Intersect Faces to "Sticky geometry: the operations" (candidate pairs, clipping, write-into-context-only rule). The "does not cut" line under "Status and known limits" is Phase 3's (Task 3.3).

### Phase 3: Piercing Lines

**Status:** completed
**Dependencies:** [Phase 2]

#### Task 3.1: Piercing cuts in insert_segment

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: kernel/src/line.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** After the edge-crossing step in `insert_segment`, test the segment against each face of `ctx` whose bounding box it touches: when the endpoints are on opposite sides of the plane and the projected hit point is inside the face (`face_contains_point`), add `vertex_at(ctx, plane.project(hit))` to `cuts`. Signature unchanged; `add_line` (line.rs:17) and `integrate_edges` (pushpull.rs:212) inherit it.

#### Task 3.2: Piercing and push/pull regression tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [3.1]
- **Files:**
  - Modify: kernel/tests/lines.rs
  - Modify: kernel/tests/pushpull.rs
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** lines.rs: a vertical line through a horizontal face is split into two edges with one vertex on the face plane; two piercings joined by an in-plane line split the face; an endpoint resting on the face is a touch, not a piercing. pushpull.rs: a box pulled through a loose face still settles with every existing test passing and `validate` clean. (2026-10-28: a line between two interior piercing points is a spike and never splits a face, so the in-plane line in the test runs across the face through both piercing vertices and is cut at them; the spec's Phase 3 contract was read the same way.)

#### Task 3.3: Piercing in the architecture doc

- **Type:** document
- **Status:** completed
- **Dependencies:** [3.1]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Remove the "A line that pierces a face ... does not cut it" limit under "Status and known limits" (docs/architecture.md:279) and describe the piercing cut in `insert_segment` under "Sticky geometry: the operations".

### Phase 4: Model Check

**Status:** pending
**Dependencies:** none

#### Task 4.1: check module

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Create: kernel/src/check.rs
  - Modify: kernel/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `FindingKind`, `Finding` (with `Display` and `to_json`), and `check(&Document) -> Vec<Finding>` for overlapping edges (collinear within `LENGTH`, overlap longer than `LENGTH`, same owner), non-planar faces (`plane.dist` beyond `PLANE`), faceless edges and duplicate vertices (same owner, closer than `LENGTH`). Add `pub mod check;` to lib.rs.

#### Task 4.2: validate example prints findings

- **Type:** implement
- **Status:** pending
- **Dependencies:** [4.1]
- **Files:**
  - Modify: kernel/examples/validate.rs
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** After a successful load, run `check`, print each finding on its own line after the counts line and exit 1 when any finding exists.

#### Task 4.3: check tests and fixtures

- **Type:** test
- **Status:** pending
- **Dependencies:** [4.1, 4.2]
- **Files:**
  - Create: kernel/tests/check.rs
  - Create: kernel/tests/fixtures/bad.builder
  - Create: kernel/tests/fixtures/clean.builder
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** Build a box, push a vertex off its plane and add a vertex within `LENGTH` of another through the raw setters, assert the two findings with their ids; a clean box gives an empty list; write both documents' `to_json` to the fixtures and test that `Document::from_json(fixture)` followed by `check` reproduces the findings (the fixtures are what the validate example is run on in the Validation Criteria).

#### Task 4.4: README and architecture doc for the model check

- **Type:** document
- **Status:** pending
- **Dependencies:** [4.2]
- **Files:**
  - Modify: README.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria), [spec.md§Interfaces](spec.md#interfaces)
- **Description:** README: add the `cargo run -p builder-kernel --example validate -- FILE` row to the command table in "Run it" with the four finding kinds and the exit code. architecture.md: a "Model check" paragraph under "Build, test and run" naming `check::check`, the four `FindingKind`s and their tolerances (requirements Impact lists model check for this doc).

### Phase 5: Randomized Kernel Test

**Status:** pending
**Dependencies:** [Phase 2, Phase 3]

#### Task 5.1: Fuzz harness with shrinker

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Create: kernel/tests/fuzz.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Inline xorshift64* `Rng`, geometric `Op` enum, `apply` (targets resolved by `face_containing` / nearest edge midpoint, missing targets skipped, kernel errors tolerated), `generate` with the ~300-edge erase bias, `run` with `validate` after each op (panics caught with `std::panic::catch_unwind`), ddmin `shrink`, and `render_test` printing a pasteable test body.

#### Task 5.2: CI and long fuzz tests

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.1]
- **Files:**
  - Modify: kernel/tests/fuzz.rs
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** `random_operations_keep_invariants` at seed `0x5eed_2026` and 2,000 steps, asserting under 60 s and printing seed, step and the shrunk test body on failure; `#[ignore] random_operations_long` at 50,000 steps with the seed from `BUILDER_FUZZ_SEED`. Measure the CI budget: time `cargo test -p builder-kernel --test fuzz random_operations_keep_invariants` in a debug build (CI's `cargo test --workspace` is debug) and record the wall time in the Phase 5 commit message; if it exceeds 30 s, lower the step count until it is under 30 s so the 60 s assertion has headroom on CI runners, and update spec.md's step count to match. Run the long test once during the sprint and fix or record what it finds.

#### Task 5.3: Regression tests for bugs found

- **Type:** test
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Create: kernel/tests/fuzz_regressions.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** One test per bug the fuzz runs found during the sprint, each the `render_test` output with the seed in a comment, plus the fixes they need in the kernel (listed in the commit). With no bug found, the file holds the CI seed's first 20 ops as the format's smoke test.

#### Task 5.4: Tests section in the architecture doc

- **Type:** document
- **Status:** pending
- **Dependencies:** [5.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** In "Build, test and run", describe the fuzz test (seed, steps, the `--ignored` long run, `BUILDER_FUZZ_SEED`, how a failure prints a shrunk test body and where it goes).

### Phase 6: Wasm and App Commands

**Status:** pending
**Dependencies:** [Phase 2, Phase 4]

#### Task 6.1: Wasm exports

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: kernel-wasm/src/lib.rs
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `intersectFaces(ctx, faces, instances, withModel) -> Vec<u32>` mapping `with_model` to `IntersectWith`, and `checkModel() -> String` returning the JSON array of `Finding::to_json`.

#### Task 6.2: Model wrappers

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.1]
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Finding` interface, `Model.intersectFaces` (through `changed`) and `Model.checkModel` (parsing the JSON).

#### Task 6.3: Toolbar commands

- **Type:** implement
- **Status:** pending
- **Dependencies:** [6.2]
- **Files:**
  - Modify: app/index.html
  - Modify: app/src/app.ts
  - Modify: app/src/style.css
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Buttons `intersectModelBtn`, `intersectSelBtn`, `checkBtn` and the `findings` dialog in index.html; `intersect(withModel)` wrapping `model.intersectFaces` in `transact("Intersect Faces")` on the selection's faces and instances, `checkModel()` flashing "Model check: clean" or filling the dialog, bindings in `bindUi`, enabling in `updateButtons`; minimal dialog styling.

#### Task 6.4: App tests for intersect and check

- **Type:** test
- **Status:** pending
- **Dependencies:** [6.2]
- **Files:**
  - Create: app/test/intersect.test.ts
  - Create: app/test/check.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Through `newModel()`: two crossing rectangles intersected with the model add edges and `checkModel()` stays empty; a model built with `Model.fromJson` of the bad fixture's text reports its findings with the expected kinds.

#### Task 6.5: Features and README rows

- **Type:** document
- **Status:** pending
- **Dependencies:** [6.3]
- **Files:**
  - Modify: docs/features.md
  - Modify: README.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** features.md "Intersect Faces" row becomes "Built now: with model and with selection, writes into the open context; with context is Later"; README "Keys" or toolbar description lists the three buttons and what Check model reports.

### Phase 7: Report a Problem

**Status:** pending
**Dependencies:** [Phase 6]

#### Task 7.1: Transaction journal on Model

- **Type:** implement
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `journal: string[]` ring of the last 50 transaction names, pushed in `begin` (which `transact` calls), so every tool's commit is recorded.

#### Task 7.2: Report builder and offer

- **Type:** implement
- **Status:** pending
- **Dependencies:** [7.1]
- **Files:**
  - Create: app/src/report.ts
  - Modify: app/src/app.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `buildReport(model, fileName, error)` and `reportFileName`; `App.offerReport(e)` flashing the error then, on confirm, downloading the JSON with the `save()` Blob pattern; called from the catch sites in `eraseSelection`, `makeGroup`, `explode`, `open` and the new `intersect` command.

#### Task 7.3: Report builder test

- **Type:** test
- **Status:** pending
- **Dependencies:** [7.2]
- **Files:**
  - Create: app/test/report.test.ts
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** Headless: after two transactions the report's `operations` lists their names in order, `model` parses back with `Model.fromJson`, `error` carries the message, and `reportFileName("shed.builder")` is `shed-report.json`; the ring drops the oldest name after 50.

#### Task 7.4: README report section

- **Type:** document
- **Status:** pending
- **Dependencies:** [7.2]
- **Files:**
  - Modify: README.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** A "Report a problem" paragraph: when it is offered, what the file contains (model JSON and the last operation names, not replayable operations), and where to send it.

### Phase 8: Shed Walkthrough

**Status:** pending
**Dependencies:** [Phase 7]

#### Task 8.1: Walkthrough document

- **Type:** document
- **Status:** pending
- **Dependencies:** none
- **Files:**
  - Create: docs/walkthrough-shed.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Steps and results for the 10' x 8' shed: box, ridge lifted with Move, gable roof planes drawn and grouped, Intersect with model from the walls' context, door and window cut with Push/Pull, Check model clean, close the tab and recover. Requires NeverLoseWork (recover) and MovesThatStick (ridge weld) merged into the branch before it is executed; if either is missing from the branch (`git log --grep 'sprint-' --oneline` shows no NeverLoseWork or MovesThatStick close), the executing session writes the document with those steps marked "pending: needs <sprint>", says so in the Phase 8 commit message, and does not block; close records the gap and Patrick runs the steps after the merge.

#### Task 8.2: Roadmap status

- **Type:** document
- **Status:** pending
- **Dependencies:** [8.1]
- **Files:**
  - Modify: docs/roadmap.md
  - Modify: README.md
- **Context:** [spec.md§Summary](spec.md#summary)
- **Description:** Mark 1.3 and 1.5 done in the Milestone 1 table and link the walkthrough from the README "Docs" list.

## Task Format

- **Type:** implement | test | document | refactor | debug
- **Status:** pending | in_progress | completed | failed
- **Dependencies:** Task IDs `[1.1, 1.2]`, Phase IDs `[Phase 1]`, or `none`
- **Context:** Markdown links into sprint docs, e.g. `[spec.md§Section](spec.md#section)`

Document tasks make doc updates visible to close Gate 4.

## Completion

Closed by `/close`.

## Plan Review

**Reviewed:** 2026-10-28

- [x] Requirements to Spec traced
- [x] Spec to Plan traced
- [x] Proposed ADRs checked against accepted
- [x] Checklist passed (0 warnings accepted; 5 fixed in place)

**Plan Status:** Ready for implementation
