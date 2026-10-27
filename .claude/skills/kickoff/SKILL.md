---
name: kickoff
description: "Capture conversation context into a sprint kickoff document and create the sprint"
---

# Kickoff

Scan the current conversation for decisions, scope, and technical direction, then create a sprint with a kickoff.md that captures everything needed to begin planning.

## When to Use

- After a conversation has established what needs to be built
- When the user says "let's do this" or "create a sprint for this"
- To transition from freeform discussion to structured sprint planning

A sprint is for work that needs a new or superseding ADR or an architectural decision, has several approaches that need research or a design doc, or spans sessions or hand-offs (roughly more than a day). If none applies, say so and propose `flux adhoc new "<title>"` with What, Why and Criteria instead; proceed with a sprint only if the user still wants one.

## Prerequisites

- Conversation contains enough context to identify: what the work is, why it's needed, and the general approach
- `.flux/` directory exists (`flux init` has been run)

## Workflow

### Step 1: Scan conversation context

Read back through the conversation and extract:

- **Decisions:** Key decisions made, with rationale for each. Look for "let's go with X", "we should use Y", explicit choices between alternatives.
- **Scope:** What's in scope (explicitly agreed) and what's out of scope (explicitly excluded or deferred). Look for "we won't do X yet", "that's for later", "focus on Y".
- **Technical approach:** Architecture direction, patterns to follow, technology choices, integration points.
- **Open questions:** Unresolved items mentioned but not settled. Look for "we need to figure out", "not sure about", "TBD".
- **References:** Files, docs, artifacts, URLs, or code paths mentioned in conversation.
- **Constraints:** Dependencies on other systems, time constraints, compatibility requirements, performance targets.
- **Background:** What prompted this work: the problem being solved or opportunity being pursued.
- **Backlog:** Run `flux backlog list` and `flux backlog show #ID` for every item related to the work. Each related item goes under requirements.md Impact Backlog marked closes, partly or out of scope; name the ones to pull in when presenting the summary.

Present a summary to the user before proceeding. Ask for corrections or additions.

### Step 2: Derive sprint name

From the conversation topic, derive a CamelCase sprint name that describes the work:
- Use 1-3 words, CamelCase, letters and digits only, no spaces or underscores
- Should be recognizable at a glance
- Examples: `AuthRefactor`, `RepomapDiff`, `CloseSkill`

Confirm the name with the user.

### Step 3: Create sprint

Run `flux sprint new <Name>`. If an open question blocks planning (facts still to research, or answers owed by someone else), run `flux sprint new <Name> --research` instead: the kickoff's Open Questions are the research to do, and the sprint moves to Created with `flux sprint move <Name> Created` once they are answered.

For work already committed, the sprint is recorded after the fact: at the move to Current, run `flux sprint move <Name> Current --start <first commit's parent>`, and list its commits under `commits:` in requirements.md frontmatter when their subjects lack the `(sprint-NN):` scope.

This creates `.flux/sprints/<Name>_Created/` (or `<Name>_Research/`) with requirements.md, spec.md, plan.md from the templates and an empty `decisions/`.

### Step 4: Write kickoff.md

Copy `.flux/defaults/templates/sprints/kickoff.md` into the sprint directory as `kickoff.md`, replace `{name}` with the sprint name and `{date}` with today's date, and fill each section from Step 1:

- **Context:** what prompted this work: the problem, opportunity, or need. 2-4 sentences.
- **Decisions:** key decisions made during conversation, each as `- **<Decision>:** <Rationale>`.
- **Scope:** a list under **In scope:** and one under **Out of scope:**, each out-of-scope item with why it is deferred.
- **Technical Approach:** agreed approach, architecture direction, patterns to follow. Decisions only, not descriptions of existing systems.
- **Open Questions:** unresolved items to address during planning, each answerable through research or design work.
- **References:** files, docs, artifacts, code paths referenced in conversation.

Replace every `[...]` placeholder. Keep the headings as the template has them: `flux check` reports a missing or unlisted section against `flux/schemas/kickoff.yaml`.

Apply the 5-minute read test: if the kickoff document takes more than 5 minutes to read, it's too long. Focus on decisions, not descriptions.

### Step 5: Transition

Report to user:
- Sprint created: `<Name>_Created` or `<Name>_Research`
- Kickoff captured at: `.flux/sprints/<Name>_<Status>/kickoff.md`
- For a Research sprint: the open questions to answer before `flux sprint move <Name> Created`
- Next step: fill in requirements.md (Background from the kickoff's Background and the user's own statement, a Why line per feature, Summary, Goals, Features, Success Criteria, Impact, Scope) from the kickoff, then run `/plan`.

## Output

- Sprint directory created with kickoff.md
- User informed of next steps
