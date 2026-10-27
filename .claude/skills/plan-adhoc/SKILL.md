---
name: plan-adhoc
description: "Ground an open ad-hoc on the code, then write its What, Criteria, Plan tasks and Impact"
---

# Plan ad-hoc

Write an ad-hoc's plan after reading the code it touches, so the files, callers and existing features are known before coding. Runs right after `flux adhoc new`. Decides whether the work stays an ad-hoc.

## When to Use

- After `flux adhoc new "<title>"`, before any code changes
- When an open ad-hoc's Plan still holds the template's `### Task 1: [Title]`

## Workflow

### Step 1: Read the record and the request

Open the ad-hoc file (`flux adhoc list` shows the one `open`). Note what the user asked for and why, in their words.

### Step 2: Ground on the code

Do each step and keep its output:

1. `flux repomap <files...>` for the modules the work touches; `flux repomap --budget 4000` first when the area is unclear.
2. For every existing symbol the work changes or removes: `ast-grep run -p '<symbol>($$$)' --lang <lang>`. Each call site is a file the Plan modifies.
3. Search for an existing feature that already does it, or half of it: `ast-grep run`, `git grep -n '<key term>'`, the README command list. Reuse beats a second path.
4. Config and settings that mention the touched code: `git grep -n '<name>' -- '*.yaml' '*.toml' '*.json' '*.md'`.
5. Backlog: `flux backlog list`, then `flux backlog show #ID` for every item that touches the work.
6. Accepted ADRs in the area: `flux adr list`, read each one that applies.

### Step 3: Decide the level

Stop and convert when grounding shows the work needs a new or superseding ADR or an architectural decision, has several approaches that need research or a design doc, or spans sessions or hand-offs. Tell the user why, convert by close's "Converting an ad-hoc to a sprint" section (it carries these Plan tasks into plan.md), then continue from `/plan`. Size alone is not a reason.

### Step 4: Write the record

- **What:** 2-5 sentences naming the change, grown from what grounding found.
- **Criteria:** checkboxes a reviewer can check with evidence; `Baseline: N. Target: M.` for a measurable change.
- **Plan:** one `### Task N: Title` per unit of work, numbered from 1, each with Type (implement | test | document | refactor | debug), Status pending, Dependencies (`none` or `[1]`), Files (one `Create:`, `Modify:` or `Delete:` exact path per nested line, from Step 2), Description. Every call site from Step 2 is in some task's Files. A test task for code changes; a document task for every doc under Impact. No task without a file.
- **Impact:** Docs, Interface, ADRs, and Backlog with each related item from Step 2 marked closes, partly or out of scope.
- **Log:** one dated line for anything grounding changed from the original request.

Replace the template's placeholders and run `flux check <file>`; fix every issue it reports.

### Step 5: Report

Show the Plan task list and the Files. Next step: `/review` on the ad-hoc, then `/execute`.
