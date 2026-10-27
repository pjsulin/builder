# Plan Review Checklist

Run each check against plan.md. Report pass/fail with specific issue locations.

## Structural Compliance

- [ ] Sections exist: `## Overview`, `## Tasks`, `## Completion` ending "Closed by `/close`"
- [ ] Heading hierarchy: `## Tasks` > `### Phase N: Name` > `#### Task N.M: Title`
- [ ] Every task has all fields: Type, Status, Dependencies, Files, Context, Description
- [ ] Task IDs are sequential (1.1, 1.2, ... 2.1, 2.2, ...)
- [ ] All Status fields are `pending`, except in a sprint recorded after its work (started with `--start`), where committed phases are `completed`

## File Operations

- [ ] No file created in multiple tasks
- [ ] No file deleted then referenced by a later task
- [ ] No file both created and modified in the same task
- [ ] No Create or Modify path is gitignored (`git check-ignore -v`)
- [ ] Every new Python package directory has `__init__.py` planned
- [ ] All imports reference files that exist or are created by earlier tasks

## Test Coverage

- [ ] Every Create/Modify of a source file has a corresponding test file Create/Modify
- [ ] No test references code from a task that hasn't completed yet
- [ ] Test tasks depend on their corresponding implementation tasks

## Documentation

- [ ] New modules have documentation tasks
- [ ] New CLI commands have README or reference doc updates planned
- [ ] Every doc listed under Impact in requirements.md has a document task
- [ ] Changes to agent guidance plan a `.flux/CLAUDE.md` or root CLAUDE.md update

## Dependency Order

- [ ] No phase uses code from a later phase
- [ ] Within each phase, tasks are ordered logically (create before modify, code before tests)
- [ ] No circular dependencies between tasks
- [ ] Phase dependencies form a DAG

## Commit Boundaries

- [ ] Each phase forms a cohesive unit of work, committed as one commit
- [ ] Each phase's listed tests pass after the phase commit
- [ ] Unrelated changes are in separate phases

## Completeness

- [ ] Every feature and success criterion from requirements.md maps to at least one task
- [ ] requirements.md has a Background, and every feature has a Why that traces to it
- [ ] No phase or task works against the reason given in Background or kickoff.md
- [ ] Every spec item from spec.md maps to at least one task
- [ ] Every call site in the spec Baseline for a changed symbol is covered by a modify task
- [ ] No Context field references a nonexistent sprint doc section
- [ ] New dependencies added to pyproject.toml if needed
- [ ] Configuration changes planned if needed

## Scope

- [ ] Each phase is small enough to review as one commit (about 3-6 tasks; more only when they are small or tightly coupled)
- [ ] Total task count is realistic for the sprint scope
- [ ] Dependencies don't create an unnecessarily long critical path

## Ad-hoc

Run against an open ad-hoc's Plan instead of the sections above.

- [ ] Plan has `### Task N: Title` subsections numbered 1, 2, ... with Type, Status, Dependencies, Files, Description
- [ ] All Status fields are `pending`, except tasks already committed in an ad-hoc recorded after its work
- [ ] Every Files path is exact and exists or is created by an earlier task; none is gitignored (`git check-ignore -v`)
- [ ] Every task names at least one file; no task only restates a criterion
- [ ] Every call site of a changed symbol (`ast-grep run`) is in some task's Files
- [ ] A test task for code changes; a document task for every doc under Impact Docs
- [ ] Dependencies reference earlier task IDs; no cycles
- [ ] Criteria are `- [ ]` checkboxes, each served by a task
- [ ] Impact Backlog cites every related pending item in `flux backlog list`
- [ ] No need for a new or superseding ADR, several approaches, or multi-session work (else convert)
