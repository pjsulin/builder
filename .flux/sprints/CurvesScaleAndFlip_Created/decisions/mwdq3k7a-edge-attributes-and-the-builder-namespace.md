---
adr: "mwdq3k7a"
title: "Edge attributes and the builder namespace"
status: proposed
supersedes: null
superseded_by: null
created: 2026-11-05
---
# Edge attributes and the builder namespace

## Context

ADR `mvr2op7t` gives definitions, instances and faces an `attributes` object of namespaces keyed to scalar values, additive in format version 1. Edges have none. Sprint 2.4 needs two pieces of edge data the kernel itself owns: which segments make up a curve (so a circle selects, erases, measures and offsets as one) and whether an edge is soft (not drawn, faces shaded smooth across it). `docs/architecture.md` § 2 reserved "an edge attribute grouping segments" for curves; the 2.3 kickoff decided both pieces land as one format change. The file writes edges as bare `[a, b]` pairs, and the format's compatibility rule is that readers ignore unknown keys.

## Decision

Edges carry `attributes` under the same rules as `mvr2op7t`: namespaces `[a-z][a-z0-9_-]*`, non-empty keys, scalar values, journaled with the edge record. In the file, `edges` stays an array of `[a, b]` pairs and each definition may carry `edge_attributes`, a list of `{ "edge": i, "attributes": {...} }` sorted by edge index, written only when some edge has attributes.

The `builder` namespace is reserved for keys the kernel reads and writes itself. Its first keys are `curve` (a number, unique within the definition, shared by the segments of one curve) and `soft` (`true` on an edge that is not drawn and across which faces shade smooth). A plugin or survey namespace never uses `builder`.

## Consequences

- A file with no edge attributes is byte-identical to one written before this ADR; readers that predate it open files with `edge_attributes` and drop them on save, as `mvr2op7t` already allows.
- `split_edge` gives both halves the edge's attributes; an edge that already exists keeps its own when drawn over. The kernel, not the app, keeps `builder` keys true: a curve bent by a partial transform loses `builder.curve`, a push/pull that makes a cylinder sets `builder.soft` on its side edges.
- `validate` and `check` can assert invariants over `builder` keys (a curve is one chain in one definition) because the kernel owns them; other namespaces stay opaque.
- A separate "smooth" flag is not introduced; one `soft` flag means both until styles (5.6) need the split, at which point a `smooth` key can be added under the same namespace without a format change.
