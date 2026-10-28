# Implementation Plan: NeverLoseWork

## Overview

Four phases, one commit each: an IndexedDB autosave ring (`app/src/store/autosave.ts`) with fake-indexeddb tests; a debounced `Autosaver` driven by the model's commit points (`Model.onCommit`, never `revision`); restore prompt, version dialog and file name / unsaved marker in the header; and the hosted build (hand-written `app/sw.js` filled by an inline Vite plugin, `scripts/check-precache.mjs` in CI, and a GitHub Pages deploy job on `main`). Every task is verified with `npm run typecheck`, `npm test`, `npx vite build` and `node scripts/check-precache.mjs`; the cross-browser offline load is Patrick's manual check after the deploy. Interfaces are in [spec.md§Interfaces](spec.md#interfaces).

## Tasks

### Phase 1: Autosave Store

**Status:** completed
**Dependencies:** none

#### Task 1.1: Add fake-indexeddb

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: package.json
  - Modify: package-lock.json
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `npm install --save-dev fake-indexeddb@^6.0.0` (the only new dependency this sprint) and add the `check:precache` script entry so Phase 4 does not touch package.json again.

#### Task 1.2: AutosaveStore ring

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: app/src/store/autosave.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Data Models](spec.md#data-models)
- **Description:** `AutosaveStore` over IndexedDB database `builder` with stores `versions` (autoIncrement) and `meta` (`dirty`); `put` appends then trims to `MAX_VERSIONS` / `MAX_BYTES` without dropping the newest; `list`, `get`, `latest`, `dirty`, `setDirty`, `clear`. The `IDBFactory` is a constructor argument so tests inject fake-indexeddb. (2026-10-28: the constructor also takes an optional `limits` argument, `{ versions?, bytes? }`, so Task 1.3's byte-budget test runs with small strings instead of 50 MB of JSON; spec.md § Interfaces amended to match.)

#### Task 1.3: Store tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [1.1, 1.2]
- **Files:**
  - Create: app/test/autosave.test.ts
- **Context:** [spec.md§Examples](spec.md#examples), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** With `new IDBFactory()` per test: 12 puts leave 10 versions with the two oldest gone; puts over `MAX_BYTES` (use a store constructed with a small budget or large json strings) drop the oldest until under budget and keep the newest; `latest()` is the last put; `dirty` round-trips; `list()` is newest first and carries no `json`.

#### Task 1.4: Document the store

- **Type:** document
- **Status:** completed
- **Dependencies:** [1.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Add a "Storage" subsection after "Transactions and undo" in §3: one IndexedDB database, the ring limits and why (stress model JSON 1,014,815 bytes, so 50 MB holds about 50 stress saves or 10 of anything), and that a version is the whole `toJson()` string, not journal deltas.

### Phase 2: Autosave Scheduling

**Status:** completed
**Dependencies:** [Phase 1]

#### Task 2.1: Model commit hook

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: app/src/kernel/model.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Add `lastOperation` (set in `begin`) and `onCommit?: (operation: string) => void`, called from `commit()` when it returns true and from `undo()`/`redo()` with `Undo <name>` / `Redo <name>` when a name comes back. `abort()` and `changed()` are untouched so previews never fire it.

#### Task 2.2: Autosaver

- **Type:** implement
- **Status:** completed
- **Dependencies:** [2.1]
- **Files:**
  - Create: app/src/store/autosaver.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `Autosaver` with injectable store, clock and timer: `attach(model, fileName, dirty)` sets `model.onCommit`, cancels a pending write and sets the dirty flag (no special case for the constructor's load: main.ts reads the restore candidate first, Task 3.3); `schedule` restarts the 3 s debounce; the timer callback is the only caller of `toJson()` and writes `{time, fileName, operation, json}` then `setDirty(true)`; `flush` and `markClean` as specified; write errors go to `onError`, never thrown into the tool.

#### Task 2.3: Wire the App

- **Type:** implement
- **Status:** completed
- **Dependencies:** [2.2]
- **Files:**
  - Modify: app/src/app.ts
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** Add the `store` and `autosaver` fields, with `constructor(store = new AutosaveStore())` so main.ts can hand in the store it read the restore candidate from; `loadModel` gains `opts?: { saved?: boolean }`, sets `savedRevision` to `-1` when `saved` is false and calls `autosaver.attach(model, name, !saved)` (covers the constructor, `open`, and the `newBtn`/`sampleBtn`/`stressBtn` call sites at app.ts:589-594 unchanged); `save()` calls `autosaver.markClean()` after setting `savedRevision`.

#### Task 2.4: Scheduling tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [2.2, 2.3]
- **Files:**
  - Modify: app/test/autosave.test.ts
- **Context:** [spec.md§Examples](spec.md#examples)
- **Description:** With a hand-rolled fake timer and `vi.spyOn(model, "toJson")` on `buildStressTest()` (after `newModel()` loads the kernel): 50 `abort/begin/pushPull` preview steps call `toJson` zero times and put nothing; `commit()` then 2,999 ms still nothing; at 3,000 ms one version labeled `Push/Pull` with `fileName` `stress.builder`; `undo()` after the debounce yields a version labeled `Undo Push/Pull`; `markClean()` cancels a pending write and clears dirty; `attach` to a new model stops writes for the old one. Assert the one `toJson()` on the stress model takes under 100 ms.

#### Task 2.5: Document scheduling

- **Type:** document
- **Status:** completed
- **Dependencies:** [2.2]
- **Files:**
  - Modify: docs/architecture.md
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** In the Storage subsection, state the hook (`Model.onCommit` from `commit`/`undo`/`redo`, not `revision`, because `changed()` bumps `revision` per preview), the 3 s debounce, and that `toJson()` (12 ms on the stress model) runs only on the timer. (2026-10-28, close: a cold first `toJson()` on the stress model measured 30 ms in Node; the doc states both numbers.)

### Phase 3: Restore, Versions and Header

**Status:** completed
**Dependencies:** [Phase 2]

#### Task 3.1: Header and dialog markup

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Modify: app/index.html
  - Modify: app/src/style.css
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** Add `#fileName` and `#unsaved` to `.brand`, the `Versions` button to `.actions`, and `<dialog id="versions">` with `#versionList` and `#versionsClose` after `.app`; style them in the existing header/button idiom (`.file`, `.unsaved` muted text, `dialog` using `--panel`/`--line`, rows as flex with the Open `.btn`).

#### Task 3.2: Header state in App

- **Type:** implement
- **Status:** completed
- **Dependencies:** [3.1]
- **Files:**
  - Modify: app/src/app.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `updateHeader()` sets `#fileName` text and toggles `#unsaved` on `revision !== savedRevision`; called from `refresh()` on the non-preview path and from `save()`. The `beforeunload` guard (app.ts:620) and `confirmDiscard` (app.ts:313) keep using `savedRevision`, which is `-1` for restored models so they count as unsaved.

#### Task 3.3: Restore on start

- **Type:** implement
- **Status:** completed
- **Dependencies:** [3.2]
- **Files:**
  - Modify: app/src/app.ts
  - Modify: app/src/main.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `App.offerRestore(candidate)`: `undefined` returns false; else `confirm("Restore <fileName> autosaved <time> after <operation>?")`; on yes `loadModel(Model.fromJson(v.json), v.fileName, { saved: false })` and flash; on no `store.setDirty(false)`. `main.ts` creates the `AutosaveStore`, reads `candidate = (await store.dirty()) ? await store.latest() : undefined` **before** `new App(store)` (the constructor's sample load calls `attach(..., false)`, which clears the flag), then awaits `app.offerRestore(candidate)`.

#### Task 3.4: Versions dialog

- **Type:** implement
- **Status:** completed
- **Dependencies:** [3.3]
- **Files:**
  - Modify: app/src/app.ts
- **Context:** [spec.md§Data Models](spec.md#data-models)
- **Description:** `showVersions()` fills `#versionList` from `store.list()` (time, operation, fileName, KB, Open button) and calls `showModal()`; Open runs `confirmDiscard()` then `get(id)` and `loadModel(..., { saved: false })`, then closes; bind `versionsBtn` and `versionsClose` in `bindUi`. An empty ring shows one "No autosaves yet" row.

#### Task 3.5: Restore logic tests

- **Type:** test
- **Status:** completed
- **Dependencies:** [3.3]
- **Files:**
  - Modify: app/test/autosave.test.ts
- **Context:** [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** Headless path of the restore: after a commit and debounce on a shed built with `buildSample()`'s operations, `store.dirty()` is true, `Model.fromJson((await store.latest())!.json)` has `canUndo() === false`, `stats()` equal to the source model and `toJson()` byte-equal to the stored json; `markClean()` then `dirty()` is false so no restore would be offered. Start-up order (spec §Examples): after the debounced write, read the candidate as main.ts does, then `attach(newModel(), "sample.builder", false)` as the constructor's load; the candidate is still defined and `dirty()` is now false, so the sample load does not suppress the offer.

#### Task 3.6: README autosave and restore

- **Type:** document
- **Status:** completed
- **Dependencies:** [3.4]
- **Files:**
  - Modify: README.md
- **Context:** [spec.md§Summary](spec.md#summary)
- **Description:** Status bullet for autosave (3 s after each change, last 10 versions in the browser, restore prompt on start, Versions button); a line in "Run it" that the header shows the file name and an `unsaved` marker until Save.

### Phase 4: Hosted Build and Offline

**Status:** completed
**Dependencies:** [Phase 3]

#### Task 4.1: Service worker and precache plugin

- **Type:** implement
- **Status:** completed
- **Dependencies:** none
- **Files:**
  - Create: app/sw.js
  - Modify: vite.config.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** Hand-written `app/sw.js` (install: `addAll(PRECACHE)`; activate: drop other `builder-*` caches; fetch: cache-first for same-origin GET, navigations fall back to `./index.html`). The inline `precachePlugin()` in `vite.config.ts` (`apply: "build"`, `enforce: "post"`, `generateBundle`) emits `sw.js` with `__PRECACHE__` replaced by the sorted bundle paths and `__CACHE_VERSION__` by a content hash, so the output is deterministic and covers `index.html`, the JS chunks, CSS and `kernel_bg.wasm`.

#### Task 4.2: Register the worker

- **Type:** implement
- **Status:** completed
- **Dependencies:** [4.1]
- **Files:**
  - Modify: app/src/main.ts
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** `navigator.serviceWorker.register("./sw.js")` guarded by `import.meta.env.PROD` and feature detection, so `vite` dev and the Node tests never register one.

#### Task 4.3: Precache check script and CI step

- **Type:** test
- **Status:** completed
- **Dependencies:** [4.1]
- **Files:**
  - Create: scripts/check-precache.mjs
  - Modify: .github/workflows/ci.yml
- **Context:** [spec.md§Interfaces](spec.md#interfaces), [spec.md§Validation Criteria](spec.md#validation-criteria)
- **Description:** The script parses the `PRECACHE` array out of `dist/sw.js`, walks `dist/` (excluding `sw.js`), prints `missing:`/`extra:` lines and exits 1 on any difference; CI runs it right after `npx vite build`. This is the headless stand-in for the offline check: every built file is in the precache list.

#### Task 4.4: Pages deploy job

- **Type:** implement
- **Status:** completed
- **Dependencies:** [4.3]
- **Files:**
  - Modify: .github/workflows/ci.yml
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** In `test`, upload `dist/` with `actions/upload-pages-artifact@v3` on pushes to `main`; add `deploy` with `needs: test`, the same `if`, `pages: write` + `id-token: write` permissions, the `github-pages` environment and `actions/deploy-pages@v4`. No secrets. Patrick enables Settings > Pages > Source = GitHub Actions once.

#### Task 4.5: Hosting and offline docs

- **Type:** document
- **Status:** completed
- **Dependencies:** [4.4]
- **Files:**
  - Modify: README.md
  - Modify: docs/features.md
  - Modify: docs/roadmap.md
  - Modify: docs/architecture.md
- **Context:** [spec.md§Summary](spec.md#summary)
- **Description:** README: hosted URL https://pjsulin.github.io/builder/ at the top of "Run it" and a note that it works offline after the first visit. features.md: "Autosave and recovery", "Runs in the browser with no install" and "Works offline (installable PWA)" rows marked "Built now." with the mechanism. roadmap.md: 1.1 and 1.6 marked done in the Milestone 1 table. architecture.md: service worker and precache plugin in the Storage subsection, and the `check-precache` and Pages deploy lines in §9.

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
- [x] Checklist passed (1 warning accepted)

**Plan Status:** Ready for implementation
