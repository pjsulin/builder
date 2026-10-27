# The survey contract

The rule survey mode in Builder, and any agent editing a spec, must keep: geometry comes from the person measuring, never from reasoning.

## The rule

1. Every number in `spec.yaml` is one the person measuring supplied: a measurement, or their stated guess. No position, offset, thickness, adjacency or height is filled in by reasoning from a drawing, a photo, a room size, or what "must" be there.
2. Unknown is `MISSING`. The element is skipped and listed in `report.md`. A gap in the model is correct output.
3. A stated guess is `~value`. It builds marked as a placeholder (orange, dashed, listed in `report.md`) and stays marked until it is measured.
4. Two numbers that disagree are reported as a CONFLICT and both are kept. Nothing is averaged, nudged or chosen. The first value places; the rest are checks. Resolving a conflict means asking the person measuring, then changing the spec to what they say.
5. Every fact the person states is entered, as a placing value if it is the first on that axis, otherwise as a check (a list-valued edge, a list-valued pipe coordinate). Facts are not dropped because they disagree.
6. A number is restated back before it is entered when there is any doubt about what it spans: which face, whether the frame or the ledge is included, which wall. Most errors are misreadings of what a number measures, not of the number.
7. Hand drawings supply only the numbers written on them. Their proportions are not geometry.

## For an agent editing a spec

- Translate what the person says into spec entries, citing the measurement entry with `source:` where there is one. Do not add entries they did not describe.
- Name things by where they are. Do not invent labels.
- After a change, read `report.md` and `check_plan.png` and say what moved and which checks changed. Explain in terms of the drawing, not chains of references.
- When the build stops on a malformed value, fix the syntax; when it reports a CONFLICT, do not.

## For survey mode in Builder

- A survey element carries its phase, its placeholder flag and its `source`; the editor shows them and does not clear them by moving things.
- The spec is the source of truth and the model is derived from it. Builder edits that change geometry are written back as spec numbers the person agreed to, or not at all.
- The build (`survey build`) is the only thing that places geometry. Anything that places a piece by hand, like the 2D layout page, produces proposals the person reviews, which enter the spec through a plan.

Checks, severities and the effect of each marker on every output file are in [spec-format.md](spec-format.md) and [exports.md](exports.md).
