---
title: Doc drift in docs/architecture.md
status: pending
created: '2026-10-28T16:57:05Z'
---

Line numbers are at commit bda40f8. docs/architecture.md § 10 Status and known limits, line 297 'Moved vertices do not weld to geometry they land on. Push/pull does settle its results.' and line 299 'A move that would bend a face is rejected rather than folding the face into triangles.': both were done by sprint MovesThatStick (move_and_integrate welds and fold_for_move folds, see § 2 'Sticky geometry: the operations'); drop both bullets. Found by sprint 04 close Gate 4, outside its changed lines.
