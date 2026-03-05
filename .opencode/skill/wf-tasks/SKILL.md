---
name: wf-tasks
description: "Stage 6: Tasks -- generate ABI task passports (HR approval required)"
user-invocable: false
---

# Stage 6: Tasks

You are executing the Tasks stage. Your goal is to transform the approved implementation plan into machine-readable task passports for subagent execution.

This is a GOVERNED stage. HR approval is required before moving to `/wf.tooling`.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"tasks"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/plan/implementation-plan.md`
   - `workflow/features/<feature-id>/spec/specification.md`
   - `workflow/schemas/task-passport.schema.yaml`
4. Create stage directory: `workflow/features/<feature-id>/tasks/`.

If plan approval is missing, STOP and request plan approval first.

### Step 2: Passport Generation Rules

Create one YAML passport per plan task.

Required fields:
- `task_id`
- `goal`
- `inputs`
- `outputs`
- `allowed_tools`
- `gates`
- `dod`
- `owner_agent`

Formatting rules:
- `task_id` is lowercase, hyphen-separated, stable.
- Include all required input paths.
- Include all output paths and output type (`create`, `modify`, `test`).
- Gate commands must be runnable, not abstract.
- DoD criteria must be observable and verifiable.

### Step 3: Build Passports

For each task, produce this shape:

```yaml
task_id: "task-001-example"
goal: "Implement concrete behavior for FR-001"
inputs:
  - path: "path/to/input"
    description: "Why this file is needed"
outputs:
  - path: "path/to/output"
    type: "modify"
allowed_tools:
  - tool_name: "Read"
  - tool_name: "Write"
  - tool_name: "Edit"
  - tool_name: "Glob"
  - tool_name: "Grep"
  - tool_name: "Bash"
gates:
  - name: "tests-pass"
    check: "bun test"
  - name: "typecheck"
    check: "bunx tsc --noEmit"
dod:
  - criterion: "All new tests pass"
  - criterion: "Requirement FR-001 satisfied"
owner_agent: "general"
```

Use tighter allowed tools when possible. Do not grant unnecessary tool access.

### Step 4: Validate Passports

Validate every generated passport against schema and logic checks.

Validation checklist:
- Required fields exist.
- No unknown top-level fields.
- Input paths are sensible and available.
- Output paths are explicit and non-empty.
- Gates are meaningful for task scope.
- DoD criteria map to requirement IDs.

If a passport fails validation, fix it before continuing.

### Step 5: Write Artifacts

Write files under:
- `workflow/features/<feature-id>/tasks/task-XXX-<slug>.yaml`

Also write index file:
- `workflow/features/<feature-id>/tasks/index.md`

`index.md` structure:

```markdown
# Task Passport Index

| # | Task ID | Goal | Dependencies | Parallel Group |
|---|---------|------|--------------|----------------|
| 1 | task-001-... | ... | none | 1 |

## Notes
- Total passports:
- Schema validation:
- Coverage status:
```

### Step 6: Gates

Record gates via `wf_gate_record`:

1. `passport-schema-validation`
   - PASS if all passports satisfy schema.

2. `passport-coverage`
   - PASS if every implementation plan task has exactly one passport.

3. `passport-traceability`
   - PASS if passports map to FR/NFR and DoD is clear.

### Step 7: Register Artifacts

Call `wf_artifact_register` for:
- every generated passport file
- `workflow/features/<feature-id>/tasks/index.md`

### Step 8: HR Checkpoint (Mandatory)

Present:
- total passports
- sample passport shape
- validation result
- any assumptions made

Ask:

"Do you approve these task passports?"
- Approve
- Reject (request changes)

If approved:
1. Call `wf_hr_record` with decision `"approved"` for stage `"tasks"`.
2. Call `wf_state_write` with action `"complete"` for stage `"tasks"`.
3. Tell user: "Task passports approved. Next: run `/wf.tooling`."

If rejected:
1. Collect concrete feedback.
2. Regenerate affected passports.
3. Re-validate.
4. Re-present for approval.

Do not complete stage until approved.

### Quality Rules

- Never use placeholder paths in final passports.
- Never emit empty `gates` or empty `dod`.
- Never mix multiple independent goals in one passport.
- Keep passports deterministic and reusable.
