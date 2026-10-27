---
adr: "mvr2op7t"
title: "Namespaced attributes in the builder format"
status: accepted
supersedes: null
superseded_by: null
created: 2026-10-27
---
# Namespaced attributes in the builder format

## Context

`docs/architecture.md` reserves attributes on definitions, instances and faces for classification, curves, dynamic components and plugin data. Survey needs them now to carry each element's provenance into Builder: its kind, whether a value is approximate (`~`), and the measurement entry it came from. The format's compatibility rules already say readers ignore unknown keys.

## Decision

Definitions, instances and faces carry an optional `attributes` object, keyed by namespace and then by key (`{"survey": {"kind": "wall", "approx": true}}`), whose values are JSON strings, numbers or booleans. It is an additive change to format version 1, and the kernel stores it as part of each record so the journal undoes it like any other write.

## Consequences

- Version 1 readers that predate attributes still open these files; they drop the attributes on save.
- Unknown namespaces round-trip unchanged. Namespaces are lowercase identifiers (`[a-z][a-z0-9_-]*`) and keys are non-empty strings.
- There are no nested values or arrays. A plugin that needs structure stores a JSON string, which keeps the value model small and the UI generic.
- Faces split by an edit keep the attributes of the face they came from, as they already keep its materials.
- Output is ordered (sorted namespaces and keys), so saving the same model gives the same bytes.
