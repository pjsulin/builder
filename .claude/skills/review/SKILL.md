---
name: review
description: "Check a sprint's docs, or an open ad-hoc, against each other, the code, the backlog and accepted ADRs before implementation"
---

# Review

Validate a planned sprint: requirements trace to spec, spec traces to plan, proposed ADRs do not conflict with accepted ones, and plan.md passes the checklist. An open ad-hoc gets the same checks on its smaller record, in the **Ad-hoc** lines. The last gate before implementation.

## When to Use

- After `/plan` has written spec.md and plan.md (sprint status Created)
- Before `flux sprint move <Name> Current`
- When a sprint feels off but you cannot say why
- On an open ad-hoc after `/plan-adhoc` wrote its Plan, before `/execute`

## Workflow

### Step 1: Load inputs

1. Sprint docs: `requirements.md`, `spec.md`, `plan.md`, `kickoff.md` if present
2. Proposed ADRs: the sprint directory's `decisions/*.md`
3. Accepted ADRs: `flux adr list`, then read each accepted one that touches the sprint's area
4. `references/review-checklist.md` in this skill
5. The backlog: `flux backlog list`

**Ad-hoc:** the ad-hoc file (`flux adhoc list` shows the one `open`), accepted ADRs, the checklist's Ad-hoc section, the backlog.

### Step 2: Requirements to Spec traceability

For each feature and success criterion in requirements.md:
- Is there a spec item (interface, data model, validation criterion) that delivers it?
- Are there spec items with no requirement origin? (scope creep or missing requirement)

Impact Backlog: every pending item in `flux backlog list` that touches the work's files or features is cited under Impact Backlog with closes, partly or out of scope; `flux backlog show` the candidates. An uncited related item is a warning.

Report requirements with no spec coverage, spec items with no requirement, and uncited backlog items.

**Ad-hoc:** every Criteria entry is a `- [ ]` checkbox; every criterion is served by some Plan task; Impact Backlog checked against `flux backlog list` as above.

### Step 3: Spec to Plan traceability

For each spec item:
- Is there a task in plan.md that implements it?
- Are there plan tasks with no spec basis? (undocumented work)
- Do file paths in plan match the Baseline in spec.md?

Every Create and Modify path in plan.md must be committable: run `git check-ignore -v <path>...` over them. Any output is a **blocking issue**, since the file would be silently untracked. Fix: add a task that edits `.gitignore` (a `!` rule), or move the file.

Report spec items with no task, tasks with no spec basis, path mismatches, ignored paths.

**Ad-hoc:** every task's Files are exact paths that exist (`git ls-files <path>`) or are created by an earlier task, and none is gitignored (`git check-ignore -v`, blocking as above). Every task names a file, so none restates a criterion. Check the Files against the code: `ast-grep run` call sites of each changed symbol are in some task's Files.

### Step 4: ADR check

For each proposed ADR in the sprint's `decisions/`:
- Read every accepted ADR. Does the proposal contradict one?
- A contradiction without `supersedes: <id>` in the proposal's frontmatter is a **blocking issue**. Fix: set `supersedes`, or change the proposal.

For the spec as a whole: does any interface or data model contradict an accepted ADR with no proposed ADR superseding it? Blocking issue.

**Ad-hoc:** the Plan contradicts no accepted ADR, and nothing in it needs a new or superseding ADR. Such a need is blocking: convert by close's "Converting an ad-hoc to a sprint" and continue from `/plan`.

### Step 5: Plan checklist

Run every check in `references/review-checklist.md` against plan.md. Record pass or fail with task locations.

**Ad-hoc:** the checklist's Ad-hoc section against the Plan.

### Step 6: Report and fix

```markdown
## Sprint Review: <Name>

**Reviewed:** <date>

### Traceability

| Link | Coverage | Gaps |
|------|----------|------|
| Requirements to Spec | X/Y | ... |
| Spec to Plan | X/Y | ... |

### ADRs

| Proposed | Conflicts with | Supersedes set | Result |
|----------|----------------|----------------|--------|

### Issues

#### [Category]: [Description]
- **Location:** Task N.M or document section
- **Problem:** ...
- **Fix:** ...

### Summary

| Check | Result |
|-------|--------|
| Structural compliance | Pass/Fail (N) |
| File operations | Pass/Fail (N) |
| Test coverage | Pass/Fail (N) |
| Documentation | Pass/Fail (N) |
| Dependency order | Pass/Fail (N) |
| Commit boundaries | Pass/Fail (N) |
| Completeness | Pass/Fail (N) |
| Scope | Pass/Fail (N) |

**Blocking issues:** N
**Warnings:** N
**Ready for implementation:** Yes | No: <reason>
```

If issues exist: present each with its fix, ask the user to confirm, apply, re-run the failed checks.

### Step 7: Mark plan as reviewed

After blocking issues are resolved, append to plan.md:

```markdown
## Plan Review

**Reviewed:** <date>

- [x] Requirements to Spec traced
- [x] Spec to Plan traced
- [x] Proposed ADRs checked against accepted
- [x] Checklist passed (N warnings accepted)

**Plan Status:** Ready for implementation
```

Then `flux sprint move <Name> Ready`, so `flux sprint list` shows the sprint as planned and reviewed.

**Ad-hoc:** no Plan Review section and no move; add a dated Log line `<date>: reviewed, N blocking and M warnings fixed`.

Report. Next step: for a sprint `flux sprint move <Name> Current`, then `/execute`; for an ad-hoc `/execute`.

## Key Principles

- Be adversarial: look for what is missing
- Trace forward and backward
- Flag, don't fix silently
- "Task 3.2 has no spec basis", not "some tasks lack spec coverage"
