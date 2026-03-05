---
name: wf-finish-branch
description: "Stage 11: Finish Branch -- finalize development branch and merge readiness"
user-invocable: false
---

# Stage 11: Finish Branch

You are executing the Finish Branch stage. Your goal is to confirm branch readiness, perform safe cleanup, and prepare integration artifacts.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"finish-branch"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/review/review-report.md`
4. Create stage directory: `workflow/features/<feature-id>/finish-branch/`.

### Step 2: Readiness Checks

Run checks and capture outcomes:
- clean working tree
- tests passing
- type checks passing
- lint/format checks passing (if configured)
- no obvious secret leakage

If any critical check fails, STOP and report remediation.

### Step 3: Branch Strategy

Provide merge strategy options:
- squash and merge
- rebase and merge
- merge commit
- keep as-is

Apply only non-destructive actions unless user explicitly asks otherwise.

### Step 4: Optional PR Preparation

If `gh` is available and user wants PR flow:
- prepare PR title and summary from artifacts
- include scope, verification, and risks
- capture PR URL when created

### Step 5: Write Artifact

Write `workflow/features/<feature-id>/finish-branch/branch-metadata.md`:

```markdown
# Branch Metadata

## Branch Context
- Branch:
- Base:
- Commit count:
- Changed files:

## Readiness Checks
| Check | Status | Notes |
|-------|--------|-------|

## Merge Strategy
- Selected strategy:
- Rationale:

## PR Metadata
- PR URL:
- Status:

## Follow-ups
- ...
```

### Step 6: Gates and Completion

Record gates:
- `pre-merge-checks`
- `branch-readiness`

Register artifact with `wf_artifact_register`.

If ready:
1. Call `wf_state_write` with action `"complete"`.
2. Tell user: "Branch finalization complete. Next: run `/wf.project-report`."

If not ready:
- mark failure with diagnostics and stop transition.

### Quality Rules

- Do not force-push unless explicitly requested.
- Do not amend or rewrite history unless user asks.
- Keep branch actions reversible by default.
