---
adr: "mvr2opid"
title: "Tag lock enforced by the kernel"
status: proposed
supersedes: null
superseded_by: null
created: 2026-10-27
---
# Tag lock enforced by the kernel

## Context

Survey mode shows measured existing conditions that must not be moved, pushed or erased by accident, while the person draws proposed work on top. Locking could live in each UI tool, but every tool and every future plugin would then have to remember to check it, and one that forgot could silently change surveyed geometry.

## Decision

A tag has a `locked` flag (in the kernel and the `.builder` format, default false), and the kernel refuses any edit that would change an instance on a locked tag or the geometry inside its definition, returning `Error::Locked`.

## Consequences

- Every tool gets the protection for free. The UI only has to turn the error into a message and leave locked items out of hover highlights.
- Locking and unlocking a tag are journaled writes, so they can be undone.
- A locked tag protects the definitions of its instances. A component placed both on a locked tag and on an unlocked one is locked everywhere. Survey makes only groups, so this does not come up there.
- Snapping and inference to locked geometry still work: it is read-only, not invisible.
