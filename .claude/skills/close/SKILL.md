---
name: close
description: "Close the Current sprint or an open ad-hoc through six fail-stop gates and write the audit trail"
---

# Close

Make a sprint or ad-hoc project truth: proposed ADRs become accepted, project docs are updated, acceptance criteria are recorded as met, the baseline repomap is regenerated. Commands supply mechanical facts; this skill makes the judgments and stops on the first failed gate.

Close is the last step of a record's work, not a separate decision: run it as soon as the work is committed. Ask the user only when a gate needs their judgment.

Each gate is pass or fail. A fail stops with the gate name and the specific failure. No gate is skippable by flag. Aborting leaves the record open with whatever commits were made; rerunning resumes from the first gate that fails.

## Which record

- Sprint: `flux sprint list --status Current`. Exactly one, or stop.
- Ad-hoc: `flux adhoc list` shows exactly one `open` (`flux adhoc new` refuses a second). Ad-hoc close uses the reduced gates marked **Ad-hoc** below.

Read the record's `start:` commit from its frontmatter (`requirements.md` for sprints, the ad-hoc file itself). Everything below diffs against that commit.

**The record's commits.** Its scope is `sprint-NN` or `adhoc-NNN`; its commits are the ones in `<start>..HEAD` whose subject carries `(<scope>):`, plus any listed under `commits:` in its frontmatter (a record written after its work was committed, whose commits lack the scope). Other commits in the range belong to other work streams: other ad-hocs, other sessions, plain commits. `git log --oneline <start>..HEAD --invert-grep -F --grep='(<scope>):'` lists them. When none of them changes code or docs, the range holds only this record's work.

## Gate 1: Preflight

- `git status --porcelain` is empty. Otherwise stop: commit or stash first.
- Run `flux test`. A non-zero exit is a fail; quote its output. It runs `test.command` (unset is a fail: run `/health` to set it) and, when `test.junit` is set, passes when every failing test ID is in `.flux/health/baseline.yaml`, naming any new one. Without `test.junit`, the command's exit code decides. Never cut `test.command` down to make the gate pass. If `flux test` warns that the run changed tracked files, restore them with `git checkout -- <path>`; they are test side effects, not the record's work.

**Ad-hoc:** same.

## Gate 2: Interface

Run `flux repomap --diff <start> --record <scope>`, adding `--commit <sha>` for each `commits:` entry. Entries other work streams made are listed under `## Outside record` with the commit that made them; confirm each one belongs to another stream (read its commit), and classify one that is really this record's like any other entry. Read the sprint's `spec.md` Interfaces and Data Models. Classify every diff entry and every spec entry:

| Classification | Action |
|---|---|
| In spec, matches | None |
| In spec, differs | Update `spec.md` with the actual signature and a one-line reason |
| Not in spec | Drift to remove, or a legitimate addition to record in `spec.md` under `## Added during implementation`. Test functions and private helpers are recorded in one line each; a new public interface is questioned and the user asked |
| In spec, absent from diff, and the diff can show it | Not built. Build it now, or `flux backlog new "<item>" --description "From sprint NN: <why>"` and record the item number. Silent omission is a fail |
| In spec, below diff resolution | Verify with `ast-grep run` or by reading the code, and cite `file:line` as evidence. Missing is Not built, as above |

The diff shows definitions (functions, classes, methods, module constants) with signatures running from decorators to the body, so click options and trailing parameters count, plus annotated Python class fields as `Class.field`. Below its resolution: behaviour, config keys, fields in other languages, CLI options not declared as decorators, anything inside a body.

Gate passes when every entry has a classification and its action is done. Write the table to `close.md` (see Record below).

**Ad-hoc:** run the diff with `--record adhoc-NNN` and record added, changed and removed public symbols (not `_`-prefixed, not test code) under the ad-hoc file's Impact as `- Interface:` lines, each one checked against What. When no entry is public, still write one line with the counts so the record shows the gate ran: `- Interface: none (flux repomap --diff <start>: 0 added, 0 changed, 0 removed)` for an empty diff, or `- Interface: none public (flux repomap --diff <start>: N added, M changed, K removed; <private and test names>)`. A symbol What does not account for is drift to remove or a line added to What. Public symbols do not force conversion; only the sprint criteria in Converting below do.

## Gate 3: ADRs

1. For each proposed ADR in the sprint's `decisions/`: read every accepted ADR in `.flux/decisions/`. A conflict without `supersedes: <id>` in the proposal's frontmatter is a fail; write the superseding line now with the user, or stop.
2. Check the implementation against every accepted and every proposed ADR. For an ADR with an attached ast-grep rule (a `rule:` block or a `.yml` beside it) run `ast-grep scan`; for the rest, read the ADR and inspect with `ast-grep run`. Each ADR gets one line in `close.md`: rule result, or the evidence.
3. Move each proposed ADR to `.flux/decisions/` keeping its ID. Set `status: accepted`. For each ADR it supersedes, set that ADR's `status: superseded` and `superseded_by: <id>`. Leave `decisions/README` in the sprint with one line listing the accepted IDs.

**Ad-hoc:** step 2 against accepted ADRs only. Any need for a new or superseding ADR means stop and convert.

## Gate 4: Project docs

1. Every task in `plan.md` with Type document: confirm the file changed since `start` (`git diff --stat <start> -- <file>`) and the change matches the task. Missing is a fail.
2. Run `/verify-docs` on every project doc listed under Impact in `requirements.md`, plus the root README.md. Pass it each doc's changed line ranges, from `git diff -U0 <start> -- <doc> | grep '^@@'` (the `+start,count` side is current-file numbering).
   - When other work streams changed the same doc, take the record's changed lines from `git blame -s -l <start>..HEAD -- <doc>` instead: the lines whose commit is one of the record's.
   - In scope: entries that fall in changed lines, or that name a symbol from the Gate 2 diff. A code block or list item is one unit, in scope if any line of it changed. In a table the unit is the changed row, read with the header; other rows are not in scope. A section-wide claim that a changed line only sits inside is not in scope.
   - File the out-of-scope entries first, before applying any fix, as one `flux backlog new "Doc drift in <docs>" --details "<entries>"` whose details say `Line numbers are at commit <HEAD>`. Record its number in `close.md`.
   - Code defects verify-docs turns up (help text that contradicts the code, a bug the change made reachable) are not doc drift: file each as its own `flux backlog new`, also before any fix and with the same commit line.
   - Then fix the in-scope entries. The close repairs what the record touched, not the repo's older debt.
3. For every symbol the Gate 2 diff listed as changed or removed: `git grep -n '<symbol>' -- '*.md'`. Any doc still describing the old shape is updated.

**Ad-hoc:** steps 2 and 3 only, over the docs listed under the ad-hoc's Impact. The root README is included only when Impact lists it.

## Gate 5: Requirements and backlog

0. Run `flux tasks --record <scope>` and quote its output. It lists every phase and task of plan.md with its Status and exits 1 when any is not completed. Each task or phase not completed is either moved to the backlog with `flux backlog new "<task title>" --description "From sprint NN task N.M: <why not done>"`, its item number written beside the task's Description, or is a fail. Do not set a Status to completed for work that was not done.
1. Each Success Criteria checkbox in `requirements.md`: a box the implementer already ticked keeps its tick only if its evidence holds at HEAD; otherwise untick it and treat it as unticked. Mark each unticked box `[x]` with evidence appended (test name, command output line, or the Gate 2 entry), or move it to the backlog with `flux backlog new` and note the item number beside the unchecked box. An unmarked criterion is a fail.
2. For each backlog item listed under Impact: `flux backlog show #NNN` and compare its Details against the Out of Scope section of `requirements.md` and the criteria moved to the backlog in step 1. Anything the item asked for that the sprint did not deliver goes into `flux backlog new` citing `#NNN`. Then `flux backlog archive #NNN --sprint NN --commit <HEAD>`, where HEAD is the last commit whose subject carries the record's prefix (`<type>(sprint-NN):` or `<type>(adhoc-NNN):`), found with `git log -1 --format=%h --grep='(sprint-NN):'` (or `(adhoc-NNN):`); backlog, config and chore commits do not count, and the close commit does not exist yet. Archiving drops the Details entry, so this is the only trace of the remainder. When a remainder item is filed, repoint every `backlog: "#NNN"` link to the archived item in `.flux/health/baseline.yaml` and `.flux/health/findings.yaml` at the remainder's number.
3. Items created in Gates 2 and 5 are already appended; list their numbers in `close.md`.

**Ad-hoc:** step 0 over the ad-hoc's Plan tasks (`flux tasks --record adhoc-NNN`; a record created before 2026-10-18 without Plan tasks prints `0 tasks, 0 completed`), backlog items cited `From ad-hoc NNN task N`. Step 1 over the ad-hoc's Criteria. HEAD means the same as in sprint step 2. A box with `Baseline: N. Target: M.` gets `After (<HEAD sha>): K.` appended, measured now; K missing M is a fail or a backlog item. Step 2 for backlog items under Impact, comparing against What, archived with `--adhoc NNN --commit <HEAD>`.

## Gate 6: Baseline repomap and archive

1. Run `flux test` once more, after the doc fixes. A non-zero exit is a fail. When it reports `fixed` above 0, run `flux test --record` so the baseline drops the fixed IDs (it can only shrink here, since new is 0), and commit `baseline.yaml` with the close.
2. `flux repomap --save`. `unchanged` is expected when the changed definitions rank outside the `repomap.budget` token budget; it does not mean nothing changed.
3. Sprint: `flux sprint move <Name> Completed --closing`. Ad-hoc: set `status: closed` in the ad-hoc file's frontmatter.
4. A record with `step: "N"` in its frontmatter (requirements.md or the ad-hoc): `flux plan set N done --commit <HEAD>`, HEAD being the last work commit as in Gate 5. A `step:` naming no step in `.flux/plan.md` fails the close.
5. Commit everything, `.flux/plan.md` included: `close(sprint-NN): <title>` or `close(adhoc-NNN): <title>`.

### Isolated mode

If the sprint ran on a branch: Gate 1 additionally rebases the branch onto main. After Gate 6, on the host checkout: `git merge --no-ff <branch>` with the title and accepted ADR IDs as the message. If the merge conflicts on `.flux/repomap.md`, regenerate it; never hand-merge a repomap. If numbers collide with records merged to main meanwhile, renumber the record from the highest on main plus one before the merge. ADR IDs are timestamps and never collide; `flux adr list` fails on a duplicate left by an older numbered ADR, and the fix is to rename one file and its references.

## Converting an ad-hoc to a sprint

Convert when the work turns out to need a new or superseding ADR or an architectural decision, has several approaches that need research or a design doc, or spans sessions or hand-offs where separate requirements, spec and plan are worth reviewing on their own. Size of diff and new public symbols alone are not reasons.

`flux sprint new <Name>`, then `flux sprint move <Name> Current --start <the ad-hoc's start>` (pause or close the Current sprint first). Move the ad-hoc's What and Why into requirements.md and its Criteria into Success Criteria. Move its Plan tasks into plan.md as `### Phase 1: <title>` with the tasks renumbered `1.1`, `1.2`, ... (fields and Status kept, dependencies `[N]` rewritten `[1.N]`), so `/plan` starts from the code the ad-hoc already read. Set the ad-hoc `status: converted`. Continue from `/plan`.

## Record

Write `.flux/sprints/<sprint>/close.md`:

```markdown
# Close: <Name>

- Start: <start sha>
- Close: the commit whose message is `close(sprint-NN): <title>` (its sha cannot be written before it exists)
- Tests: `flux test` at Gate 1 and Gate 6: known N, new 0, fixed K (or `exit code rule: exit 0 in Ns` without `test.junit`)

## Gate 2: Interface

| Symbol | Diff | Classification | Action |
|---|---|---|---|

## Gate 3: ADRs

- <id> <title>: <rule result or evidence>

## Gate 5: Criteria

`flux tasks --record sprint-NN`: N tasks, N completed (exit 0), or the tasks moved to the backlog with their numbers.

| Criterion | Evidence |
|---|---|

Backlog archived: #NNN, ... Backlog created: #NNN, ...
```

For an ad-hoc, criteria evidence goes beside each Criteria box, interface lines under Impact, and the rest (tests, the `flux tasks` summary line, ADR lines, backlog numbers) into the Log as one dated close entry.

## What close does not do

No loops, no history rewriting, no coverage or lint gates, no push, no PR, no worktree removal. Undo is `git revert <start>..HEAD`, leaving out any `flux init --sync` commit inside the range.
