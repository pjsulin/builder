---
adr: "mvr2ooxl"
title: "Survey code lives in the builder repo"
status: proposed
supersedes: null
superseded_by: null
created: 2026-10-27
---
# Survey code lives in the builder repo

## Context

The survey compiler (spec language, generators, exporters, Blender renderer, capture app) was written inside 20SPierson for one house. It is generic apart from a few names and materials. It is moving toward writing `.builder` files and toward a survey mode inside Builder's app. The other places it could live are a third repository or staying in 20SPierson. Patrick decided on 2026-10-27, and the code moved with its history in 18486df.

## Decision

The survey toolkit lives in the builder repository under `survey/` as the uv project `builder-survey`, and house projects depend on it, by path (`../builder/survey`, editable) until `builder-survey` 0.1.0 and by version after that.

## Consequences

- The `.builder` exporter and the file format change in the same commit. A format change that breaks survey shows up in builder's own checks.
- Builder holds Python next to Rust and TypeScript. Python tooling is uv only (`uv run`, `uv sync`), never a global pip.
- House data (spec, plans, measurements, photos, committed outputs, golden reference) stays in the project repo. Survey's golden check runs from the project, against the project's reference.
- Changing survey's outputs on purpose means updating that reference in the project repo, with the reason for each difference.
- Until 0.1.0, a house project follows builder's working tree, so a breaking change in `survey/` breaks the house build at once.
