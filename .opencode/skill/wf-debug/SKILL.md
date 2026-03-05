---
name: wf-debug
description: "Stage 14: Debug -- bounded diagnose/fix/verify loop"
user-invocable: false
---

# Stage 14: Debug

You are executing the Debug stage. Your goal is to resolve issues found in QA or failed gates using a bounded loop with traceable evidence.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"debug"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/human-qa/qa-report.md` (if available)
   - any `diagnostics*.md` from previous failed stages
4. Create stage directory: `workflow/features/<feature-id>/debug/`.

### Step 2: Build Issue Backlog

Create prioritized issue list:
- critical issues first
- then important issues
- then minor issues

Each issue should include:
- issue id
- source (qa or gate)
- severity
- reproduction steps
- suspected area

### Step 3: Bounded Debug Loop

Maximum iterations per run: 5.

For each iteration:

1. Diagnose
   - identify probable root cause
   - confirm with code and evidence, not guesswork

2. Plan fix
   - propose minimal safe fix
   - identify potential side effects

3. Implement
   - apply targeted changes
   - avoid unrelated refactors

4. Verify
   - run focused test for issue
   - run broader regression checks

5. Record
   - log diagnosis, fix, result, and changed files

Stop conditions:
- all issues resolved
- iteration limit reached

### Step 4: Write Artifact

Write `workflow/features/<feature-id>/debug/debug-log.md`:

```markdown
# Debug Log

## Summary
- Total issues:
- Fixed:
- Remaining:
- Iterations used:

## Iterations

### Iteration 1
- Issue:
- Diagnosis:
- Fix:
- Verification:
- Result:
- Files changed:

### Iteration 2
...

## Remaining Issues
| ID | Severity | Reason unresolved |
|----|----------|-------------------|

## Recommended Next Actions
- ...
```

### Step 5: Gates and Completion

Record gates:
- `debug-loop-complete`
- `critical-issues-resolved` (pass/fail based on outcome)

Register artifact with `wf_artifact_register`.

Complete stage via `wf_state_write` action `"complete"`.

Routing:
- if critical issues remain: explain options and require explicit user decision
- if critical issues resolved: recommend `/wf.finish-report`

### Quality Rules

- No "fix attempts" without diagnosis evidence.
- No silent scope expansion during debug.
- Keep each iteration traceable and auditable.
