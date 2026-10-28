# Sprint Kickoff: NeverLoseWork

**Captured from conversation:** 2026-10-28

## Context

Nothing is saved until the user clicks Save (`app.ts` `save()` downloads a `.builder` blob); a closed tab loses the whole model. The app only runs from a local toolchain (`make start`), so nobody can try it from a link. This is Milestone 1 sprint 1.1 in `docs/sprints.md`, first of four sprints planned on 2026-10-28 (1.1, 1.2, 1.3, 2.1), with execution handed to a Claude Code cloud session.

## Decisions

- **Four sprints planned up front, executed in the cloud:** Patrick wants 1.1–1.3 and 2.1 written as flux sprints now so cloud sessions can run them; the plan must be runnable with cargo and npm only, with the cross-browser and offline check the one step left to Patrick.
- **Hosting on GitHub Pages:** the repo is public (`pjsulin/builder`), CI already builds `dist/` on ubuntu, and `vite.config.ts` has `base: "./"`, so a Pages deploy job from `main` costs nothing new. Proposed here; confirm or switch to Cloudflare Pages during planning.
- **Autosave is the model, not the undo history:** the "done when" says undo history starts fresh after a restore; `Model.toJson()` is already the whole model, so a version is one JSON string.

## Scope

**In scope:**

- Autosave of the open model to IndexedDB after each change, debounced a few seconds after the last edit, off the hot path of drag and push/pull previews.
- Keep the last few autosaves as versions labeled with time and the last operation name (`Model.undo()` already returns the operation name, so the journal knows it).
- On start, offer to restore when the last session ended with unsaved changes; a way to browse and open older versions.
- File name and an unsaved-changes indicator in the header (`fileName` and `savedRevision` exist in `App`).
- GitHub Actions deploy of `dist/` to GitHub Pages from `main`.
- Service worker so the app loads and works offline after the first visit.
- Headless tests for the autosave store and version ring (fake IndexedDB in vitest), and the stress-model stutter check as a measured test.

**Out of scope:**

- Saving undo history across sessions: the sprint text says undo starts fresh; keeping the journal is a later refinement.
- Cloud sync or accounts: hosting is static only.
- Changes to the `.builder` format: autosave stores the existing JSON.
- The 1.2 and 1.3 kernel work, planned as their own sprints.

## Technical Approach

- A small `app/src/store/` module around IndexedDB: one database, a versions object store keyed by timestamp, with a fixed ring size and a byte budget; the App subscribes to model changes and schedules a debounced write.
- Writes are serialized off the preview path: `toJson()` runs only on the debounced timer, never per pointer-move, and the write is awaited outside the render loop.
- Restore prompt and version browser as plain DOM in the existing header/dialog style, not a framework.
- Service worker generated at build time (Vite PWA plugin or a hand-written worker precaching the `dist/` manifest); CI's existing `npm run build:kernel` + Vite build produces it.
- Pages deploy as a second CI job gated on the test job, using `actions/deploy-pages`.

## Open Questions

- GitHub Pages vs Cloudflare Pages: Pages proposed; decide at plan time.
- Version count and storage budget: propose 10 versions or 50 MB, whichever first; check the stress model's JSON size to set the numbers.
- Whether autosave also records the undo journal: no for this sprint (see Decisions); note if the journal size makes it cheap later.
- Vite PWA plugin vs hand-written service worker: pick by what keeps `npm run build` deterministic and the dependency list short.
- How a cloud session verifies "works offline" without a browser: a Playwright or headless-Chrome check in CI, or leave it to Patrick's manual check.

## References

- `docs/sprints.md` § Sprint 1.1, `docs/roadmap.md` items 1.1 and 1.6
- `app/src/app.ts`: `save()`, `open()`, `loadModel()`, `savedRevision`, `beforeunload` handler, stress button
- `app/src/kernel/model.ts`: `toJson`, `fromJson`, `undo()` returning the operation name, `revision`
- `vite.config.ts` (`base: "./"`, `outDir: ../dist`), `.github/workflows/ci.yml`
- `docs/architecture.md` § performance (stress model timings)
