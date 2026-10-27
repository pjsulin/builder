---
name: execute
description: "Work through the planned tasks of the Current sprint or an open ad-hoc, keeping task status in the record"
---

# Execute

Implement a reviewed plan task by task, with the record's statuses kept true as the work lands. `flux tasks` reads and writes every Status; never edit a Status line by hand.

## When to Use

- After `/review` on a sprint moved to Current, or on an ad-hoc planned by `/plan-adhoc`
- To resume work on a record part-done: `flux tasks` shows where it stands

## Step 1: Which record

1. The record the user named (`sprint-05`, `adhoc-020`).
2. Else the record this conversation is working on.
3. Else `flux tasks`: it picks the record the branch's last scoped commit names, else the single open one.
4. When it exits naming both a sprint and an ad-hoc, ask the user which.

Pass `--record <scope>` on every `flux tasks` call when both are open. Read the record before starting: a sprint's Background, kickoff.md, spec.md and plan.md; an ad-hoc's What, Why, Criteria and Plan.

## Step 2: The task loop

Repeat until `flux tasks next` prints `no task ready`:

1. `flux tasks next`. Take the first task it lists.
2. `flux tasks start <id>`.
3. Do the work: the task's Files and Description, the spec sections its Context links. Read each file before editing it.
4. Run the tests the task touches, then the project's `test.command` when the phase or record is done. A failure is fixed before going on.
5. `flux tasks done <id>`.

A task that cannot be done as planned is not silently changed:

- Edit the plan in place (Files, Description, a new task) and add a dated Log line saying what changed and why: the ad-hoc's `## Log`; in a sprint's plan.md, appended to the task's Description as `(YYYY-MM-DD: <change and why>)`, since plan.md has no Log.
- Work the plan does not cover is a new task, or `flux backlog new` when it is out of scope.
- A task abandoned for good: leave it pending and record the decision; close moves it to the backlog or fails.

## Step 3: Commits

**Sprint:** one commit per phase. When every task of phase N is done, run `flux tasks done N` (sets the phase) and commit the work with the status changes: `<type>(sprint-NN): Phase N <phase title>`, type `feat`, `fix`, `docs` or `test` by the phase's main work.

**Ad-hoc:** a commit per task or one for the record, scope `(adhoc-NNN):`, e.g. `fix(adhoc-020): <subject>`. Each commit carries the Status changes of the tasks it completes.

The scope in the subject is how `flux tasks` and close find the record's commits; never leave it off.

## Step 4: Hand off

When `flux tasks` exits 0 (every task and phase completed) and the tree is committed, run `/close`. Do not wait to be asked.

## Rules

- Statuses only through `flux tasks start|done`.
- A phase commit sets its phase and tasks completed in that same commit.
- Plan changes are a dated Log line plus the edit in place, never an unrecorded deviation.
