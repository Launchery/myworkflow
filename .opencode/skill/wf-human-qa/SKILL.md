---
name: wf-human-qa
description: "Stage 13: Human QA -- guided localhost smoke and critical-path testing"
user-invocable: false
---

# Stage 13: Human QA

You are executing the Human QA stage. Your goal is to guide a human tester through structured manual verification and produce a complete QA report.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"human-qa"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/project-report/human-qa-plan.md`
4. Create stage directory: `workflow/features/<feature-id>/human-qa/`.

### Step 2: Readiness Confirmation

Before starting tests, confirm with user:
- application is running
- test data/credentials are available
- test environment matches expected setup

If prerequisites are not met, pause and provide corrective steps.

### Step 3: Execute Smoke Tests

For each smoke test:
1. Provide steps exactly as written.
2. Ask for result: PASS, FAIL, or SKIP.
3. If FAIL, collect:
   - observed behavior
   - expected behavior
   - reproduction steps

If multiple smoke tests fail, offer user option to continue or stop early.

### Step 4: Execute Critical Path Tests

For each critical path case:
- guide user step by step
- capture outcome and notes
- capture any inconsistencies or flaky behavior

### Step 5: Execute Edge Cases

Run edge-case scenarios from QA plan.
Capture failures with enough detail for debugging handoff.

### Step 6: Write QA Report

Write `workflow/features/<feature-id>/human-qa/qa-report.md`:

```markdown
# QA Report

## Session Info
- Date:
- Tester:
- Environment:

## Summary
| Category | Total | Pass | Fail | Skip |
|----------|-------|------|------|------|

## Smoke Tests
| ID | Result | Notes |
|----|--------|-------|

## Critical Path Tests
| ID | Result | Notes |
|----|--------|-------|

## Edge Cases
| ID | Result | Notes |
|----|--------|-------|

## Issues Found
### Critical
- ...

### Non-Critical
- ...

## Recommendation
- proceed-to-finish-report | proceed-to-debug
```

### Step 7: Gates and Completion

Record gates:
- `qa-smoke`
- `qa-critical-path`

Register artifact with `wf_artifact_register`.

Complete stage via `wf_state_write` action `"complete"`.

Routing:
- if critical issues exist: recommend `/wf.debug`
- if no critical issues: recommend `/wf.finish-report`

### Quality Rules

- Do not infer pass/fail without explicit tester response.
- Capture reproducible details for failures.
- Keep report structured for direct debug consumption.
