---
type: markdown
---
# Cloud hand-off: sprints 1.1, 1.2, 1.3, 2.1

Four reviewed sprints sit in `.flux/sprints/*_Ready/` on `main` (`3e4debd`). Each is executed by its own Claude Code cloud session, one sprint per clone, one PR per sprint. Paste the generic brief plus the sprint line into the session.

## Order

| Session | Sprint | Start | Waits on |
|---|---|---|---|
| A | NeverLoseWork (1.1) | now | nothing; Pages source is already set to GitHub Actions |
| B | MovesThatStick (1.2) | now | nothing |
| C | IntersectAndHarden (1.3) | now | Phase 8 only: A and B merged; Phases 1–7 run without them |
| D | CopyAndArrays (2.1) | after B merges | Phase 3 (array parser) can start now; Phases 1, 2, 4, 5 need `integrate_moved` from B |

A, B and C touch different files except `kernel/src/line.rs` (B calls `insert_segment`; C changes it) and `app/src/app.ts` (A: header and restore; C: buttons and report). Rebase on `main` before opening the PR; conflicts are small.

## Generic brief (paste as the first message)

```
Clone https://github.com/pjsulin/builder.git (branch main) and work in a branch named sprint/<slug>.

Setup, from CI (.github/workflows/ci.yml):
  rustup target add wasm32-unknown-unknown
  cargo install wasm-bindgen-cli --version 0.2.129   (or taiki-e/install-action's binary)
  npm ci
  uv sync --project survey                           (flux's test.command runs the survey tests at close)
  uv tool install git+https://github.com/pjsulin/flux.git   (the `flux` CLI; private repo, the session's
                                                     GitHub credentials must have read access)
Verify the baseline is green before any change:
  cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings
  flux test            (= cargo test --workspace && npm test && uv run --project survey pytest survey/tests)
  npm run build:kernel && npm run typecheck

Read in this order: CLAUDE.md (imports .flux/CLAUDE.md and .flux/repomap.md), .flux/plan.md, then the sprint's
kickoff.md, requirements.md, spec.md (its Baseline is the repomap the close gate diffs against) and plan.md.
Accepted ADRs in .flux/decisions/ are constraints; mvr2opid (tag lock enforced by the kernel) applies to every
new kernel entry point.

Then:
  flux sprint move <Name> Current
  run execute        (the /execute skill: works the plan's phases in order, `flux tasks start|done` per task,
                      one commit per phase as feat(sprint-NN):/test(sprint-NN):/docs(sprint-NN):, task statuses
                      in the same commit)
  run close          (the /close skill: six gates, close.md, record moved to Completed)
Push the branch and open a PR against main titled "<Name> (sprint 1.x)" with the close.md summary as the body.

Rules that apply to all code here (from ~/.claude/CLAUDE.md and the repo):
- No mocks, stubs, placeholders or fallbacks. Implement the real thing or fail with a clear error. The only
  allowed test double is fake-indexeddb in NeverLoseWork, which spec.md names explicitly.
- Kernel changes come with kernel tests that call validate() from kernel/tests/common/mod.rs; tool changes
  with headless tests in app/test/ (vitest, environment node, real wasm kernel via app/test/helpers.ts).
- Match the surrounding code's style and comment density. Icons only for red X and green check in docs.
- CI must stay green: fmt, clippy -D warnings, cargo test, wasm build, typecheck, npm test.
- If a plan task turns out to be wrong against the code, amend spec.md/plan.md in the same commit and say so
  in the commit body; do not silently diverge. If a decision in spec.md § Decisions is blocked, stop and
  report rather than choosing differently.
- Tasks marked as Patrick's manual check (browser, offline, iPhone) are not yours: leave the criterion
  unchecked and name it in close.md as waiting on him.
```

## Sprint lines

**A: NeverLoseWork**
```
Sprint: NeverLoseWork, branch sprint/never-lose-work. Phase 4's deploy job targets GitHub Pages
(https://pjsulin.github.io/builder/); the Pages source is already set to GitHub Actions. The deploy job
must `needs: test` and run only on push to main, so your PR's CI run exercises the build and
scripts/check-precache.mjs but not the deploy. Do not add any dependency other than fake-indexeddb.
Autosave hooks Model commit points (commit/undo/redo), never revision.
```

**B: MovesThatStick**
```
Sprint: MovesThatStick, branch sprint/moves-that-stick. Kernel-only until Phase 4. Name the shared step
exactly `integrate_moved(def, edges)` as spec.md § Interfaces says: the CopyAndArrays sprint calls it by
that name. Fold edges are ordinary edges; no soft flag, no format change. Rule for the fold diagonal is the
larger-dot rule in spec.md § Decisions (hinge between the moved vertex's neighbours).
```

**C: IntersectAndHarden**
```
Sprint: IntersectAndHarden, branch sprint/intersect-and-harden. No new crate dependency: the fuzz test's
RNG is an inline xorshift64* as kernel/examples/bench.rs does. Measure the 2,000-step CI fuzz run in a debug
build and keep it under 60 s with the headroom rule in Task 5.2. Toolbar buttons only, no context menu.
Phase 8 (shed walkthrough) depends on NeverLoseWork and MovesThatStick being merged to main; if they are
not when you get there, follow Task 8.1's procedure and close with that criterion marked waiting.
```

**D: CopyAndArrays**
```
Sprint: CopyAndArrays, branch sprint/copy-and-arrays. Prerequisite: main contains MovesThatStick
(`Document::integrate_moved` in kernel/src/edit.rs). If it does not, do Phase 3 only, push, and stop with a
note. Group copies deep-copy the definition (spec.md § Decisions); copy_instance checks the source instance
lock and the parent definition lock. Arrays require a prior copy and refuse when model.revision changed since
it. Mac copy key is Option (altKey).
```

## When a PR arrives

1. CI green; the PR body is the close.md summary with Gate 5 criteria and anything "waiting on Patrick".
2. Merge to main. For A: the deploy job runs on that push; check https://pjsulin.github.io/builder/.
3. Manual checks, by sprint: A offline load on Chrome, Firefox, Safari; C the shed walkthrough; D the joist `9x` and `/9` in the browser.
4. `flux plan` on main shows the step done (close sets it).
