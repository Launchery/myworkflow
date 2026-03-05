---
name: wf-project-report
description: "Stage 12: Project Report -- generate reusable knowledge and human QA plan"
user-invocable: false
---

# Stage 12: Project Report

You are executing the Project Report stage. Your goal is to produce two artifacts:
1) reusable implementation insights, and
2) a clear manual QA plan for the next stage.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"project-report"`.
3. Read all relevant artifacts from completed stages.
4. Create stage directory: `workflow/features/<feature-id>/project-report/`.

### Step 2: Generate Skill Report

Write `skill-report.md` capturing:
- what was built
- architecture and process patterns that worked
- decisions that created friction
- reusable techniques for future workflows
- stage timing and bottlenecks

Use this structure:

```markdown
# Skill Report

## Outcome Summary
- ...

## Patterns That Worked
- ...

## Patterns to Avoid
- ...

## Decision Retrospective
| Decision | Outcome | Recommendation |
|----------|---------|----------------|

## Reusable Assets
- ...

## Process Improvements
- ...
```

### Step 3: Generate Human QA Plan

Write `human-qa-plan.md` with:
- prerequisites
- smoke tests
- critical-path tests
- edge cases
- pass/fail criteria per case

Use this structure:

```markdown
# Human QA Plan

## Prerequisites
- ...

## Smoke Tests
### ST-01 <name>
Steps:
1. ...
Expected:

## Critical Path Tests
### CP-01 <name>
Scenario:
Steps:
1. ...
Expected:

## Edge Cases
| ID | Scenario | Expected |
|----|----------|----------|

## Exit Criteria
- ...
```

### Step 4: Gates and Registration

Record gates:
- `project-report-complete`
- `qa-plan-complete`

Register both artifacts using `wf_artifact_register`.

### Step 5: Complete Stage

1. Call `wf_state_write` with action `"complete"` for stage `"project-report"`.
2. Tell user: "Project report and QA plan are ready. Next: run `/wf.human-qa`."

### Quality Rules

- QA plan must be executable by a human without hidden context.
- Keep reports concise but evidence-backed.
- Ensure tests in QA plan cover core user value path.
