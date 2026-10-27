# Flux

Flux keeps planning records next to the code and checks them against it at close. Everything lives in `.flux/`.

This file belongs to flux and `flux init --sync` overwrites it. Project instructions go in the root CLAUDE.md.

## Navigation

- `.flux/repomap.md` is imported at the end of this file. It is a map of the code's definitions, cut to `repomap.budget` tokens, written at the last close. Read it before opening files.
- `flux repomap --budget N` prints a larger map. `flux repomap <file>...` lists every definition in those files, unbudgeted.
- `ast-grep run -p '<pattern>'` finds call sites and definitions structurally. Prefer it to grep for code.

## Records

Three levels, picked by the planning the work needs: plain commit, ad-hoc, sprint. Start with the smallest that fits.

- **Sprint** `.flux/sprints/NN_Name/`: requirements, spec, plan, optional kickoff and design. Only when the work needs a new or superseding ADR or an architectural decision, has several approaches that need research or a design doc, or spans sessions or hand-offs where separate requirements, spec and plan are worth reviewing on their own. Rule of thumb: more than about a day of work. Statuses Research (facts to gather before planning), Created (being planned), Ready (reviewed), Current, Completed, Paused. One Current sprint per checkout. Numbered when moved to Current.
- **Ad-hoc** `.flux/adhoc/NNN-slug.md`: What, Why, Criteria, Plan, Impact, Log. For any change that needs a name, a reason and acceptance criteria, from a small fix to a mid-size feature with a new CLI option or module. Sections stay short for small work and grow in place for larger. The Plan is `### Task N:` blocks in plan.md's task format, written by `/plan-adhoc` right after `flux adhoc new`, once the code is read. If the work meets a sprint criterion, it converts. One open at a time: `flux adhoc new` refuses while another is open.
- **ADR** `.flux/decisions/<id>-slug.md` (ID is base36 milliseconds like backlog IDs, e.g. `mv9j0ndw`; older ADRs keep `0001`): Context, Decision, Consequences. Constraints on the code. `flux adr list` shows them. Proposed ADRs written during a sprint live in the sprint's `decisions/` until close accepts them.

**Plan** `.flux/plan.md`, always present: the repo's ordered steps, each with a status (not started, in progress, dispatched, waiting, done). `flux plan` prints them and the next step; `flux plan add "<title>"` and `flux plan set N <status>` change them (dispatched needs `--conversation`, waiting needs `--waiting`, done needs `--commit`). Read it first when resuming. `flux sprint new` and `flux adhoc new` take `--step N` to link the record to a step (`step:` in its frontmatter, `Record:` on the step); close sets that step done.

Trivial fixes need none of these: a plain conventional commit.

Backlog is one file per item in `.flux/backlog/`, named by a timestamp ID (`#mgq4k2z9`, base36 milliseconds; older items `#003`). `flux backlog list`, `flux backlog new "<title>"`, `flux backlog show #NNN`, `flux backlog archive #NNN`. A list number (`show 3`) is computed and not stored; cite items by ID.

## Skills

- `/kickoff` turns a conversation into a sprint with requirements and a kickoff note.
- `/plan` writes spec and plan, grounded on `flux repomap` and ast-grep output.
- `/plan-adhoc` grounds an open ad-hoc on the code and writes its What, Criteria, Plan tasks and Impact; converts it to a sprint when grounding shows a sprint criterion.
- `/review` checks a sprint's requirements, spec and plan, or an open ad-hoc, against each other, the code, the backlog and accepted ADRs.
- `/execute` works through the Current sprint's or the open ad-hoc's tasks, setting each Status with `flux tasks start|done`, then runs `/close`.
- `/close` runs the six gates on the Current sprint or the open ad-hoc, writes `close.md`, moves the record to Completed. It is the last step of the work, run as soon as the work is committed, without waiting to be asked.
- `/verify-docs` checks project doc claims against the code.
- `flux check [path]` reports every record that does not match its schema in `flux/schemas/` as `path:line: rule: message (expected: ...)`; fix the file from the message, then re-run. Report-only: no gate runs it.
- `/health` assesses the repository in seven areas (environment, entry points, test signal, CI coverage, docs, tidiness, dependencies), records findings with evidence in `.flux/health/`, proposes `test.command` and backlog items. It identifies problems; it does not fix them.

## Commits

- Sprint work: `feat(sprint-NN):`, `fix(sprint-NN):`, `docs(sprint-NN):`, `test(sprint-NN):`.
- Ad-hoc work: `fix(adhoc-NNN):` and the same types.
- A phase commit (or an ad-hoc task's commit) carries its task statuses, set with `flux tasks done`, in the same commit. `flux tasks` lists them.
- Anything else: plain conventional commit, `type: subject`.

@.flux/repomap.md
