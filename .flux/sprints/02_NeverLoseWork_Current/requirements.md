---
created: 2026-10-28
sprint: NeverLoseWork
start: dd1c760
started: '2026-10-28'
step: '1'
---

# Requirements: NeverLoseWork

## Background

Today nothing is saved until the user clicks Save, which downloads a `.builder` file (`app/src/app.ts` `save()`); a closed tab loses everything. The app runs only from a local Rust and Node toolchain, so no one can try it from a link. `docs/roadmap.md` puts this first because "data loss or geometry the user can't fix ends trust faster than any missing tool." Patrick's statement (2026-10-28): plan Milestone 1 sprints 1.1, 1.2, 1.3 and 2.1 as flux sprints so Claude Code cloud sessions can execute them; everything must run with cargo and npm, leaving only the cross-browser and offline check to him.

## Summary

The open model autosaves to browser storage as a short ring of versions, the app offers to restore after a crash or closed tab, the header shows the file name and unsaved state, and a hosted build at a public URL works offline after the first visit.

## Goals

### Primary Goal

A model survives a closed tab, a crash or a reload, with no action by the user.

### Secondary Goals

- Anyone can use the app from a link without a toolchain.
- Autosave costs nothing visible: no stutter in drag or push/pull previews on the stress model.

## Features

### Feature 1: Autosave with versions

**What:** After each committed change, debounced a few seconds after the last edit, the model's JSON is written to IndexedDB as a version labeled with the time and the last operation name; a fixed number of versions is kept within a byte budget.
**Why:** The closed-tab data loss in Background.
**Details:** `Model.toJson()` is the whole model; the journal already names each operation (`undo()` returns it). Writes run on a timer, never per pointer move. Ring size and byte budget set at plan time from the stress model's JSON size (kickoff proposes 10 versions or 50 MB).
**Integration:** A new `app/src/store/` module; the model's commit points (`commit`, `undo`, `redo`, not `revision`, which previews also bump) schedule a write. Loading a model resets the ring's file name.

### Feature 2: Restore and version browser

**What:** On start, when the last session ended with unsaved changes, the app offers to restore the last autosave; a dialog lists older versions (time, operation) and opens one.
**Why:** Autosave is useless if the user can't get the model back.
**Details:** Restored models start with fresh undo history. Opening a version replaces the current model after the usual discard confirmation.
**Integration:** Plain DOM in the existing header/dialog style; uses `loadModel`.

### Feature 3: File name and unsaved indicator

**What:** The header shows the current file name and a marker when `revision != savedRevision`.
**Why:** Users need to know whether what they see is on disk.
**Integration:** `App.fileName` and `savedRevision` already exist; the indicator updates in `refresh`.

### Feature 4: Hosted build

**What:** A GitHub Actions job deploys `dist/` to GitHub Pages from `main` after the CI test job passes.
**Why:** "People can use it from a link, with no Rust or Node toolchain" (roadmap 1.6).
**Details:** `vite.config.ts` already uses `base: "./"`. Hosting choice confirmed at plan time (kickoff proposes Pages; the repo is public).
**Integration:** `.github/workflows/ci.yml` gains a deploy job; README gets the URL.

### Feature 5: Offline support

**What:** A service worker precaches the built app so it loads and works with no network after the first visit.
**Why:** Roadmap 1.6; the app has no server, so offline is only caching.
**Details:** Plugin or hand-written worker decided at plan time; the build stays deterministic.
**Integration:** Vite build output; registered from `main.ts`.

## Success Criteria

### For Feature 1

- [ ] A headless test (fake IndexedDB) shows a committed change produces one version after the debounce, labeled with the operation name, and the ring never exceeds its count or byte budget.
- [ ] A measured test shows no `toJson` or store write happens during a preview (per pointer move), only after commit plus debounce.

### For Feature 2

- [ ] Killing the browser mid-model and reopening offers the model as of the last change, and restoring it gives an empty undo stack (headless test for the store and restore logic; browser check by Patrick).
- [ ] Older versions can be listed and opened.

### For Feature 3

- [ ] Header shows the file name and an unsaved marker that clears on Save and on load.

### For Feature 4

- [ ] A push to `main` deploys to the public URL; README links it.

### For Feature 5

- [ ] After one visit, the hosted URL loads with the network disabled on Chrome, Firefox and Safari (Patrick's check); the service worker precache list covers every file in `dist/`.

## Impact

Read each item before planning. Close Gates 4 and 5 read this section.

### Docs

- `README.md` — hosted URL, autosave and restore in the status/usage sections
- `docs/features.md` — autosave, versions, hosted build rows marked built
- `docs/architecture.md` — storage module and service worker
- `docs/roadmap.md` — 1.1 and 1.6 status

### ADRs

- None cited; none superseded. A short ADR for the hosting choice if planning picks something other than GitHub Pages.

### Backlog

- #mvr7ne51 out of scope (phone capture test, survey toolkit)

## Scope

### In Scope

**Must Have:** Features 1–3, 5.
**Should Have:** Feature 4 (needs the Pages setting enabled on the repo, which Patrick does once).

### Out of Scope

- Persisting undo history across sessions.
- Cloud sync or accounts.
- Format changes: autosave stores the existing JSON.

### Open Questions

All settled in spec.md §Decisions: GitHub Pages; 10 versions / 50 MB; hand-written worker filled by an inline Vite plugin; the headless stand-in for the offline check is `scripts/check-precache.mjs` in CI, the cross-browser load stays Patrick's.
