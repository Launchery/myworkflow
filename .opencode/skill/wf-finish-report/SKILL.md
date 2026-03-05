---
name: wf-finish-report
description: "Stage 15: Finish Report -- executive final summary"
user-invocable: false
---

# Stage 15: Finish Report

You are executing the final workflow stage. Your goal is to generate an executive report that summarizes outcomes, quality, timing, and follow-up recommendations.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"finish-report"`.
3. Read all stage artifacts for the active feature.
4. Create stage directory: `workflow/features/<feature-id>/finish-report/`.

### Step 2: Aggregate Metrics

From state and artifacts calculate:
- total stage count completed
- per-stage duration
- gate pass/fail totals
- approvals and rejections
- debug iterations (if any)

### Step 3: Write Final Report

Write `workflow/features/<feature-id>/finish-report/final-report.md`:

```markdown
# Final Report

## Executive Summary
- ...

## Objective and Outcome
- Feature objective:
- Delivery status:

## What Was Built
- ...

## Architecture and Key Decisions
| Decision | Outcome | Notes |
|----------|---------|-------|

## Quality Results
| Area | Result | Evidence |
|------|--------|----------|

## QA and Debug Summary
- ...

## Stage Performance
| Stage | Duration | Gates | Approval |
|-------|----------|-------|----------|

## Known Limitations
- ...

## Recommendations
1. ...
2. ...
```

### Step 4: Register and Close

1. Register artifact via `wf_artifact_register`.
2. Record gate `final-report-complete`.
3. Call `wf_state_write` with action `"set_feature_status"` and feature status `"completed"`.
4. Call `wf_state_write` with action `"complete"` for stage `"finish-report"`.
5. Tell user where to find final report.

### Quality Rules

- Keep report factual and evidence-based.
- Include unresolved risks explicitly.
- Ensure metrics match workflow_state timestamps.
