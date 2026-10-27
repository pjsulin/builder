---
name: plan
description: "Two-pass sprint planning grounded on the repomap: phase structure, then full spec.md and plan.md"
---

# Plan

Turn a sprint's requirements into spec.md and plan.md. Two passes with a user checkpoint between them, preceded by a grounding step so the spec is written against the code as it is, not as remembered.

## When to Use

- After requirements.md is filled in (and kickoff.md if `/kickoff` ran)
- Before `/review`
- Sprint status is Created. A Research sprint is not planned until its open questions are answered and it is moved to Created. To re-plan a Ready sprint, move it back to Created first

## Prerequisites

- Sprint exists: `flux sprint list --status Created`
- requirements.md has Background, Summary, Goals, Features, Success Criteria, Impact and Scope filled in

## Workflow

### Step 1: Identify the sprint

If the user names a sprint, use it. Otherwise run `flux sprint list --status Created`; if more than one, ask which.

### Step 2: Read sprint documents

Read, in order:

1. `kickoff.md` (if it exists): context, decisions, scope
2. `requirements.md`: Background first, then goals, features (each with its Why), success criteria, impact, scope

Background and kickoff.md say why the work exists. Every phase and task must serve that reason. When a feature reads two ways, choose the reading Background supports; when Background is empty or contradicts kickoff.md, stop and ask.

Read the backlog: `flux backlog list`, then `flux backlog show #ID` for every item related to the work. Each related item is cited under requirements.md Impact Backlog marked closes, partly or out of scope; add the ones missing and raise with the user any that should be pulled into scope.

Read `.flux/decisions/` and note every accepted ADR that touches the area. The spec must not contradict one without a proposed superseding ADR.

### Step 3: Ground on the code

Before writing anything:

1. Run `flux repomap <files...>` for the modules the sprint touches. A focused map is unbudgeted and lists every definition in the named files. If the touched area is unclear, run `flux repomap --budget 4000` first to find it.
2. For every existing symbol the sprint will change or remove, run `ast-grep run -p '<symbol>($$$)' --lang <lang>` (or the pattern that fits) to list call sites. Each call site is a file the plan must modify.
3. Paste the focused repomap output into spec.md under `## Baseline`. This is what `/close` Gate 2 compares against; it must be the real output, not a summary.

### Step 4: Pass 1, phase structure

From requirements.md and the baseline, identify the major logical work units:

- Each significant module, component, or feature is a candidate phase
- Group related work: creation of a module plus its tests plus its docs can be one phase, or split if large
- Order: foundation before features, features before integration, integration before polish

For each phase, present:

```markdown
### Phase N: <Name>

**Goal:** <One sentence>
**Dependencies:** none | [Phase M]

Tasks:
- <Task description> (type: implement)
- <Task description> (type: test)
- <Task description> (type: document)
```

Rules:
- Phase names are descriptive: "Core Parser", "CLI Integration", not "Phase 1", "Setup"
- Task types: implement, test, document, refactor, debug
- A test task for each implementation phase
- A document task wherever a user-facing or agent-facing change occurs, naming the doc file. `/close` Gate 4 checks these
- Phase dependencies form a DAG and flow forward
- A phase is one commit, so size it to be reviewed as one: aim for about 3-6 tasks. More is fine when the tasks are small or tightly coupled; split a phase that mixes unrelated work or would make a commit too large to review

Verify before presenting:
- [ ] Every feature and success criterion in requirements.md maps to at least one task
- [ ] Every call site found in Step 3 is covered by a modify task
- [ ] Every doc listed under Impact in requirements.md has a document task

Present the structure. Do not write plan.md yet. Report missing inputs and anything hard to map. Wait for approval.

### Step 5: Pass 2, spec.md and plan.md

**spec.md.** Fill in, keeping the template's sections:
- Summary
- Decisions: Cited (accepted ADRs the spec relies on) and Proposed (ADRs to write with `flux adr new "<title>" --sprint`; write them now, status proposed)
- Technical Specifications: Interfaces (signatures only), Data Models, Examples (call sites). Never function bodies.
- Validation Criteria: the commands that prove it works

**plan.md.** Expand each Pass 1 task:

```markdown
#### Task N.M: <Title>

- **Type:** implement | test | document | refactor | debug
- **Status:** pending
- **Dependencies:** none | [N.K] | [Phase N]
- **Files:**
  - Create: <exact path>
  - Modify: <exact path>
  - Modify: <another exact path>
  - Delete: <exact path>
- **Context:** [spec.md§Interfaces](spec.md#interfaces)
- **Description:** <one or two sentences>
```

Rules:
- File paths are exact, taken from the repomap and call-site search, never placeholders
- Dependencies reference real task IDs; create before import; tests depend on what they test
- One phase is one commit; its commit sets the phase and every task in it to completed. A task is a unit of work inside it
- New Python packages include `__init__.py`
- Context links point at real spec.md sections

### Step 6: Verify and report

Check plan.md against the template: Overview present, `## Tasks` > `### Phase N:` > `#### Task N.M:`, every field present, IDs sequential, all Status pending (in a sprint recorded after its work, committed phases are completed), ends with "Closed by `/close`".

Report: paths written, phase and task counts, proposed ADRs created, concerns. Next step: `/review`.

## Output

- spec.md with a real Baseline, and plan.md, in the sprint directory
- Proposed ADRs in the sprint's `decisions/` if any
