---
name: health
description: "Assess a repository's health in seven language-neutral areas and report problems with evidence; identifies, does not fix"
---

# Health

Find the systemic problems in a repository that cause side effects nobody can trace: an environment that cannot be rebuilt, entry points that hang, test results that cannot be trusted, CI that skips suites, docs that drifted, clutter, drifted dependencies. The skill identifies problems and records them with evidence. It does not fix them; fixes are separate records, picked up from the backlog.

It works on any repository in any language. Every check is a property any repository can have or lack. Knowledge of particular tools appears only in the Hints section at the end, and no check depends on a hint. When a property cannot be checked in this repository, it is reported as not checked, with the reason. It is never guessed.

The skill is interactive where the user knows more than the repository says: which of two commands is the real one, whether a target may be run, which findings become backlog items.

## When to Use

- Before the first record in a repository, right after `flux init`
- When flux warns that `test.command` is unset
- When work keeps hitting problems that seem unrelated
- Again after fixes, to see what was resolved

## Output

In `paths.health` (default `.flux/health/`):
- `report.md`: the readable report
- `findings.yaml`: the findings as data, read by the next run
- `targets.yaml`: every entry point found, where it is defined, whether CI runs it, and what happened when it ran
- `baseline.yaml`: the known failing tests, written by `flux test --record`

## Workflow

### Step 1: Discover

Read the repository, not memory of similar ones:
- `git ls-files` for the tracked tree
- Files whose job is to define commands: task runners, build files, script sections of manifests
- CI pipeline definitions
- Dependency manifests and lockfiles
- The docs that tell a person how to install, test and run: README, contributing guides, `docs/`

List every target: its name, kind (install, test, typecheck, lint, build, run), the exact command, and where it is defined (`file:line`). When two targets could be the canonical one for a kind, or the docs and the build files disagree, ask the user which is meant and record the answer in the report.

If `findings.yaml` exists, read it: this run is compared with it in Step 5.

### Step 2: Fresh copy

`git worktree add --detach <tmp>/flux-health HEAD`, in a temporary directory outside the repository. Every command in Steps 3 and 4 runs there, never in the user's checkout and never in the current shell's activated environment. Run the documented install first, exactly as the docs or install target state it.

### Step 3: Run the targets

Run each install, test, typecheck, lint and build target in the fresh copy:
- with `CI=true` in the environment
- with stdin closed (`< /dev/null`)
- with a time limit of `test.timeout` seconds (default 900)
- writing JUnit XML under `.flux/results/` where the runner can

Record each result in `targets.yaml`: `ran` (exit 0), `failed` (tests or checks failed), `setup-error` (it could not start: missing module, bad import, missing tool), `hung` (hit the time limit), `missing` (the kind has no target).

When a target wraps its runner (a task-runner target calling the real test command) and passes no JUnit flag through, set the flag through the runner's environment variable where one exists; otherwise also run the underlying command the target calls, with its JUnit flag, and record both commands.

When a target is a `setup-error`, the tests behind it are unseen. Keep that result: it is the finding. Then run the underlying runner once more in the project's own environment, installed with the extras the manifest declares for tests and told to continue past collection errors, to get the real test signal. Record the second command and its result beside the first. The second run is allowed and expected; without it the test-signal area has nothing to read.

Do not run targets that deploy, publish, start long-lived servers or reach outside services. Ask the user before running any target whose effect is unclear. A run target is checked for existence and documentation only.

### Step 4: Check the areas

Each property has an ID used in finding IDs. A finding needs evidence: a `file:line`, or a command and a line of its output. No evidence, no finding.

**environment**
- `fresh-install`: the documented install followed by the test targets works in the fresh copy.
- `project-env`: targets run the project's own environment, not whatever interpreter or tool is first on PATH. Evidence: the target line and the environment it resolves to.

**entry-points**
- `target-exists`: install, test, typecheck, lint and build each have a target. Report each missing kind.
- `exits-on-own`: every target exits by itself under Step 3's conditions. A hang is a finding naming the target.
- `exits-without-ci`: every test target also exits by itself as a person would run it: `CI` unset, in a pseudo-terminal, under a limit of twice the time the target took in Step 3 plus 60 seconds (at most `test.timeout`), so a watch mode is caught in minutes rather than at the full timeout. A target that exits only because `CI` is set or stdin is closed starts a watch mode for people and agents; name the target and the command it runs.
- `single-definition`: no target is defined twice in the same file or across files.
- `tool-warnings`: invoking the build or task tool prints no warnings of its own (as opposed to the output of the commands it runs).

**test-signal**
- `failure-kinds`: failures are sorted by reading the output: setup or import errors, hangs, and assertion failures. A setup error hides every test behind it, so it is its own finding, not part of a failure count.
- `typecheck-separate`: a typecheck target exists apart from the build, so type errors are seen without building.
- `baseline`: known failures are recorded (Step 6). A failing suite with no baseline is a finding.

**ci-coverage**
- `local-in-ci`: every local test, typecheck and lint target is run by some CI job. Match by reading the pipeline files: the job's commands, or the targets they call. A local suite no job runs is a finding naming the target and the pipeline files read.

**docs**
- `doc-drift`: run `/verify-docs` on the README and on each doc anywhere in the tree (including READMEs in test and source directories) that describes install, test, run or operating steps (commands, endpoints, log locations, diagrams of how requests flow). Cite its drift entries as findings. The follow-up for these findings is `/verify-docs`. List every other doc under not checked by path, so the unchecked part is visible rather than silently skipped.

**tidiness**
- `tracked-ignored`: no tracked file matches the repository's own ignore rules. Evidence: `git ls-files -ci --exclude-standard`.
- `tracked-generated`: no generated output is tracked: reports, build output, caches, files with a generated-by header. Evidence: the path and the line or header that shows it is generated.
- `leftover-dir`: no directory is left from a retired tool or unused code. Evidence: nothing in code, build files, CI or docs refers to it (the search command and its empty result), plus its share of tracked files and its last commit date.
- `unexplained-root-file`: every root file is explained by a doc or read by a tool. Evidence: the search that found no reference.

**dependencies**
- `lock-in-sync`: the lockfile matches the manifest, checked with the ecosystem's own check command.
- `declared-unused` and `used-undeclared`: checked only when the repository already has a tool that reports them. Otherwise not checked, with that reason.

A property that does not apply (no CI at all, no lockfile) is a finding only when its absence is itself the problem (no CI while tests exist is `local-in-ci`). Otherwise list it under not checked with the reason.

### Step 5: Compare with the previous run

A finding's ID is `<area>/<property>/<location>`, where location is the path or target name without line numbers, so it survives edits: `tidiness/tracked-ignored/src-tauri/Cargo.lock`, `entry-points/exits-on-own/test-frontend`.

Against the previous `findings.yaml`:
- resolved: an ID there that this run did not find
- still open: in both; keep its `backlog` link and set `status: open`
- new: only in this run; `status: new`

### Step 6: Test gate

Propose `test.command` and `test.junit` from the test targets that ran:
- every test runner in one command, joined with `;` rather than `&&`, so each runs even when an earlier one fails
- each runner writes JUnit XML to its own file under `.flux/results/`, and `test.junit` lists one pattern per runner
- a runner that cannot write JUnit leaves `test.junit` empty for the whole command, and the exit-code rule applies

Show the proposal and ask the user. On acceptance, write it to `.flux/config.yaml`, run `flux test --record`, and fill each baseline entry's `backlog` field when a backlog item covers it.

`flux test` runs in the user's checkout, because close runs it there. If it warns that the run changed tracked files, restore them (`git checkout -- <path>`) before committing, and record the tracked test output as a `tidiness/tracked-generated` finding.

### Step 7: Write the report

Write `findings.yaml`, `targets.yaml` and `report.md` in the formats below. Commit the four files together as a plain commit, `docs: Record repo health`, unless a record is open, in which case use its scope.

`findings.yaml`:

```yaml
commit: <HEAD short sha>
date: <YYYY-MM-DD>
findings:
  - id: tidiness/tracked-ignored/src-tauri/Cargo.lock
    area: tidiness
    property: tracked-ignored
    evidence: "git ls-files -ci --exclude-standard: src-tauri/Cargo.lock"
    fix: "git rm --cached src-tauri/Cargo.lock"
    backlog: null        # "#NNN" once an item covers it
    status: new          # new | open
not_checked:
  - property: dependencies/declared-unused
    reason: "no tool in the repository reports unused dependencies"
```

`targets.yaml`:

```yaml
commit: <HEAD short sha>
targets:
  - name: test-backend
    kind: test
    command: make test-backend
    source: Makefile:120
    ci: null             # "<pipeline file>:<job>" or null
    junit: .flux/results/backend.xml   # or null
    result: ran          # ran | failed | setup-error | hung | missing
```

`report.md`: a header with the date, HEAD and the previous run's commit; one section per area with its findings (ID, evidence, suggested fix, backlog link or untracked); Not checked, with reasons; Compared with previous run (resolved, new, still open); the test gate proposal and the baseline summary (`known: N`).

### Step 8: Findings to the backlog

Group the untracked findings by area. For each, propose one backlog item: `flux backlog new "<area>: <problem>" --description "<fix, one line>" --details "<id>\n<evidence>\n<fix>"`. Findings with one cause (38 tracked files matching one ignore rule) are one item. Ask the user to accept or skip each proposal. With no answer, create nothing: the findings stay untracked in the report, and the Step 9 summary lists them so the user can accept them later. Create the accepted ones, and write their numbers into `findings.yaml` and `report.md`, then amend the report commit or make a second one.

### Step 9: Clean up

`git worktree remove --force <tmp>/flux-health`. Report to the user: counts per area, new and resolved since the last run, backlog items created, and the test gate state.

## Hints

Ecosystem knowledge that helps locate things and read output. Not checks: a check must be a property from Step 4.

- Command definitions: `Makefile`, `justfile`, `Taskfile.yml`, `package.json` scripts, `pyproject.toml` (`[project.scripts]`, `[tool.*]`), `Cargo.toml`, `go.mod`.
- CI: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `azure-pipelines.yml`.
- `make` prints `warning: overriding recipe for target` for a target defined twice; any `make -n <target>` shows it.
- Python: `uv.lock` means commands run through `uv run`, and `uv sync` skips optional test extras unless `--extra`/`--all-extras` is passed. pytest writes JUnit with `--junitxml=<file>` and stops at the first collection error unless `--continue-on-collection-errors` is passed; a collection error is a setup error. `uv lock --check` checks the lockfile.
- JavaScript: vitest and jest enter watch mode when stdin is a terminal and `CI` is unset; a `test` script that runs plain `vitest` exits under `CI=true` but watches for a person, which `exits-without-ci` catches. `vitest run` does not watch. vitest writes JUnit with `--reporter=junit --outputFile=<file>`, jest with the `jest-junit` reporter. vitest writes an import failure as `<failure>`, not `<error>`. `npm ci` fails when `package-lock.json` is out of sync; pnpm and yarn have `--frozen-lockfile`. `tsc --noEmit` is a typecheck without a build.
- Rust: `cargo test` has no JUnit output without a helper; the exit-code rule applies. `cargo metadata --locked` fails on a stale `Cargo.lock`.
- Go: `go test` JUnit comes from `go-junit-report` or `gotestsum --junitfile`. `go mod tidy -diff` shows drift.
- Pseudo-terminal for `exits-without-ci`: `script -q /dev/null <command>` (macOS), `script -qec "<command>" /dev/null` (Linux); run it under the time limit with `env -u CI`.
- JUnit through a wrapper: pytest reads extra flags from `PYTEST_ADDOPTS` (`PYTEST_ADDOPTS="--junitxml=.flux/results/backend.xml"`); vitest and jest have no such variable, so run `npx vitest run --reporter=junit --outputFile=<file>` or the jest command directly.
- Time limit where `timeout` is missing (macOS): `perl -e 'alarm shift; exec @ARGV or die "exec: $!\n"' <seconds> <command>`. Without `or die`, a command that does not exist exits 0 and looks like a pass. A hang exits 142 (SIGALRM).
- Unused dependencies, when installed: deptry (Python), knip or depcheck (JavaScript), cargo-machete (Rust).
