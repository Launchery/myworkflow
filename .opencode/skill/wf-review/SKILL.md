---
name: wf-review
description: "Stage 10: Review -- verify spec alignment and code quality"
user-invocable: false
---

# Stage 10: Review

You are executing the Review stage. Your goal is to verify that implementation matches approved requirements and meets code quality standards.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"review"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/spec/specification.md`
   - `workflow/features/<feature-id>/arch/architecture.md`
   - `workflow/features/<feature-id>/implement/*`
4. Create stage directory: `workflow/features/<feature-id>/review/`.

### Step 2: Collect Review Inputs

Gather:
- implementation diff summary
- list of touched files
- gate outcomes from implement stage
- test evidence

### Step 3: Review Dimensions

Evaluate across these dimensions:

1. Spec compliance
   - all P0 requirements implemented
   - acceptance criteria coverage
   - no unrequested scope creep

2. Architecture alignment
   - implementation follows approved ADR decisions
   - boundaries and interfaces remain consistent

3. Code quality
   - readability and naming quality
   - maintainability and complexity
   - duplication and dead code

4. Test quality
   - behavior-focused tests
   - edge case coverage
   - reliability of assertions

5. Security and operational safety
   - input validation
   - secrets handling
   - obvious vulnerability patterns

### Step 4: Write Artifact

Write `workflow/features/<feature-id>/review/review-report.md`:

```markdown
# Review Report

## Overall Assessment
- Status: approved | approved-with-notes | changes-requested

## Spec Compliance
| Requirement | Status | Notes |
|-------------|--------|-------|

## Architecture Alignment
| Area | Status | Notes |
|------|--------|-------|

## Findings

### Critical
- ...

### Important
- ...

### Minor
- ...

## Files Reviewed
| File | Result | Notes |
|------|--------|-------|

## Recommendation
- proceed | fix-before-proceeding
```

### Step 5: Optional HR Escalation

If critical issues are found, escalate to user decision:
- proceed anyway
- block and return for fixes

Record decision using `wf_hr_record` if escalation is needed.

### Step 6: Gates and Completion

Record gates:
- `review-complete`
- `no-critical-findings` (or fail if critical issues remain)

Register artifact with `wf_artifact_register`.

If review is acceptable:
1. Call `wf_state_write` with action `"complete"`.
2. Tell user: "Review complete. Next: run `/wf.finish-branch`."

If blocked:
- mark stage failed and explain remediation path.

### Quality Rules

- Review code, not just summaries.
- Separate critical findings from style preferences.
- Keep findings actionable with file references.
