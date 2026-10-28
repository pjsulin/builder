# Close: NeverLoseWork

- Start: dd1c760
- Close: the commit whose message is `close(sprint-02): NeverLoseWork`
- Tests: `flux test` at Gate 1 and Gate 6: exit code rule, exit 0 (cargo test, npm test 8 files / 96 tests, survey pytest 27 passed)
- Branch: `sprint/never-lose-work` on top of `main` d388f6f plus one plain `style:` commit (dd1c760, `cargo fmt --all`; main's CI was red at "Kernel format and lint" before it). No other work stream in the range: `git log dd1c760..HEAD --invert-grep -F --grep='(sprint-02):'` is empty.

## Gate 2: Interface

`flux repomap --diff dd1c760 --record sprint-02`: 35 added, 2 changed, 0 removed, 0 outside the record.

| Symbol | Diff | Classification | Action |
|---|---|---|---|
| `autosave.ts` `MAX_VERSIONS`, `MAX_BYTES`, `DB_NAME`; `autosaver.ts` `DEBOUNCE_MS` | below resolution | In spec, matches | Verified at app/src/store/autosave.ts:6-8, app/src/store/autosaver.ts:9 |
| `autosave.ts` `Version`, `VersionInfo`, `AutosaveStore`, `put`, `list`, `get`, `latest`, `dirty`, `setDirty`, `clear` | added | In spec, matches | None |
| `AutosaveStore.constructor(name?, factory?, limits?)` | added | In spec, matches | spec.md § Interfaces amended in Phase 1 for the optional `limits` argument (Task 1.2 log line) |
| `autosave.ts` `RingLimits` | added | Not in spec: legitimate addition | Recorded under spec.md § Added during implementation (the named type of `limits`) |
| `autosave.ts` `request`, `complete`, `info`, `AutosaveStore.open` | added | Not in spec: private helpers | Recorded, one line |
| `autosaver.ts` `Autosaver`, `AutosaverOptions`, `constructor`, `attach`, `schedule`, `flush`, `markClean`, `pending` | added | In spec, matches | None |
| `autosaver.ts` `cancel`, `write` | added | Not in spec: private helpers | Recorded, one line |
| `model.ts` `lastOperation`, `onCommit`; `begin`/`commit`/`undo`/`redo` behaviour | below resolution | In spec, matches | Verified at app/src/kernel/model.ts:77, 80, 101, 106 and the Autosaver tests |
| `App.constructor(store = new AutosaveStore())` | changed | In spec, matches | None |
| `App.loadModel(model, name, opts: { saved?: boolean } = {})` | changed | In spec, matches | None |
| `App.offerRestore`, `App.showVersions`, `App.updateHeader` | added | In spec, matches | None |
| `App.openVersion` | added | Not in spec: private helper | Recorded, one line |
| `App.store`, `App.autosaver` fields; `save()` calling `markClean` and `updateHeader` | below resolution | In spec, matches | Verified at app/src/app.ts:56-57, 380-382 |
| `main.ts` start-up order and worker registration | below resolution | In spec, matches | Verified at app/src/main.ts:9-21, 29 |
| `app/sw.js` | below resolution (no definitions) | In spec, matches | Verified at app/sw.js:4-6, 8-32; offline reload in headless Chromium made no server requests |
| `vite.config.ts` `precachePlugin`, `generateBundle` | added | In spec, matches | None; two builds produce byte-identical `dist/sw.js` |
| `scripts/check-precache.mjs` (`walk`) | added | In spec, matches | `walk` recorded as the script's helper |
| `.github/workflows/ci.yml` precache step, upload and `deploy` job | below resolution | In spec, matches | Verified at .github/workflows/ci.yml:43-63 |
| `package.json` `fake-indexeddb`, `check:precache` | below resolution | In spec, matches | Verified at package.json:14, 24 |
| `app/test/autosave.test.ts` `FakeClock`, `advance` | added | Not in spec: test code | Recorded, one line |

## Gate 3: ADRs

No proposed ADRs in this sprint (spec.md § Decisions: GitHub Pages as the kickoff proposed, so no hosting ADR).

- mvr2opid Tag lock enforced by the kernel: restore and version open go through `App.loadModel`, which derives `activeTag` from the model's tags (app/src/app.ts:211-212); no new kernel entry point, so the kernel's lock check is untouched.
- mvr2op7t Namespaced attributes in the builder format: no format change; a version is the unmodified `Model.toJson()` string (app/src/store/autosaver.ts `write`).
- mvr2ooxl Survey code lives in the builder repo: `survey/` untouched; its tests run in `flux test`.

## Gate 4: Project docs

Document tasks 1.4, 2.5, 3.6, 4.5: `git diff --stat dd1c760` shows README.md (+5/-2), docs/architecture.md (+12/-1), docs/features.md (3 rows), docs/roadmap.md (2 rows), each matching its task.

`/verify-docs` over the changed lines (README.md 16, 38-40, 48; docs/architecture.md 176-185, 281-282; docs/features.md 132, 178-179; docs/roadmap.md 19, 24):

### Verified
- Autosave 3 s after each change, last 10 versions: app/src/store/autosaver.ts:9, app/src/store/autosave.ts:6-7
- Restore prompt on start, Versions button: app/src/app.ts:225, 240, 668; app/index.html:18
- Header file name and `unsaved` marker until Save: app/src/app.ts:570, 380-382; app/index.html:13
- Hosted URL, deploy on push to `main` after `test`: .github/workflows/ci.yml:46, 50-52
- IndexedDB database `builder`, stores `versions` and `meta`, dirty flag: app/src/store/autosave.ts:8, 10-12, 70-73
- Stress model JSON 1,014,815 bytes: measured at close (1014815 bytes, `toJson()` 30 ms cold); the doc now gives 12 ms warm and 30 ms cold
- `onCommit` from `commit`/`undo`/`redo`, never `abort`; `changed()` bumps `revision`: app/src/kernel/model.ts:95-118
- Service worker: content-hash cache name, older `builder-*` caches dropped, navigations mapped to `index.html`, registered only in production: app/sw.js:4-6, 21, 30; app/src/main.ts:29
- Google Fonts stylesheet cross-origin and not precached: app/index.html:7-8, `dist/sw.js` PRECACHE
- `npm run check:precache` prints missing/extra and fails: package.json:14, scripts/check-precache.mjs:26-28
- features.md "no manifest yet, so not installable": no web manifest in app/ or vite.config.ts

### Unverified
- None.

### Stale
- None. Changed symbols (`App.constructor`, `App.loadModel`) are described only in the sprint records; no project doc names their old shape.

Out-of-scope drift: none seen in the changed units; no backlog item filed.

## Gate 5: Criteria

`flux tasks --record sprint-02`: 20 tasks, 20 completed (exit 0).

| Criterion | Evidence |
|---|---|
| F1 headless store and ring test | [x] app/test/autosave.test.ts: ring, byte budget and "writes once after commit plus the debounce" tests; npm test 96 passed |
| F1 no `toJson` or write during previews | [x] same test: 0 calls over 50 preview steps and at 2,999 ms, 1 at 3,000 ms, under 100 ms |
| F2 restore after a kill, empty undo stack | [ ] headless half done (restore tests; headless Chromium reload at close confirmed and restored with `canUndo() === false`); **waiting on Patrick's browser check** |
| F2 older versions listed and opened | [x] `App.showVersions` / `openVersion`; `list` test; dialog exercised in headless Chromium |
| F3 header file name and unsaved marker | [x] `App.updateHeader`; headless Chromium: hidden after load, shown after an edit and after a restore |
| F4 push to `main` deploys; README links it | [ ] README links the URL; deploy job in CI; **waiting on the merge to `main` and the first deploy run** (Pages source = GitHub Actions is set) |
| F5 offline on Chrome, Firefox, Safari; precache covers `dist/` | [ ] precache half done (`check-precache` exits 0, runs in CI; offline reload in headless Chromium made no server requests); **waiting on Patrick's cross-browser check** |

Backlog under Impact: #mvr7ne51 (phone capture test) is cited as out of scope, not as work this sprint delivers; left open, not archived.

Backlog archived: none. Backlog created: none.

## Not done by this session

- Patrick: open https://pjsulin.github.io/builder/ after the merge on Chrome, Firefox and Safari; draw, kill the tab, reopen and accept the restore; disable the network and reload.
- The deploy job runs on the merge to `main`; check the Pages URL after it.
