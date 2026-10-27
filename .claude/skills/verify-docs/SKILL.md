---
name: verify-docs
description: "Verify documentation claims against actual code with evidence-based citations"
---

# Verify Documentation

Validate that documentation accurately reflects the codebase. Used standalone and by `/close` Gate 4.

## Workflow

1. **Identify documentation files** to verify:
   - Files named by the user or by the calling skill
   - Otherwise README.md, `.flux/CLAUDE.md`, root CLAUDE.md, and `docs/`

2. **For each documentation file**, extract claims:
   - Feature descriptions ("supports X", "provides Y")
   - Code references ("located in src/...", "defined in ...")
   - CLI commands, flags and their described behaviour
   - Configuration keys and examples
   - API descriptions and code examples

3. **Verify each claim** against the codebase:
   - Referenced files exist: `ls` or `git ls-files`
   - Described functions, classes and CLI commands exist: `flux repomap <file>` for the file, `ast-grep run -p '<pattern>'` for the definition
   - Code examples are syntactically valid and call real signatures
   - Configuration options are real keys in the defaults file
   - Command examples produce the described output when cheap to run

4. **Report findings** with evidence:
   - For each claim, cite the exact file:line where evidence was found
   - Flag claims that could not be verified
   - Flag stale references (files moved or renamed, signatures changed)

## Output Format

```
## Verification Report: <file>

### Verified
- [claim] — verified at path:line

### Unverified
- [claim] — no evidence found, suggested action

### Stale
- [claim] — reference outdated, current location or signature is ...
```

When called from `/close`, every Unverified and Stale entry must be fixed in the doc before the gate passes.
