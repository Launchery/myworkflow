---
name: wf-plan
description: "Stage 5: Plan -- implementation plan with bite-sized tasks (HR approval required)"
user-invocable: false
---

# Stage 5: Plan

You are executing the Plan stage of the workflow. Your goal is to produce an executable implementation plan with ordered, testable, bite-sized tasks.

This is a GOVERNED stage. HR approval is required before moving to `/wf.tasks`.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read` to load current workflow state.
2. Call `wf_state_write` with action `"start"` for stage `"plan"`.
3. Read prior artifacts:
   - `workflow/features/<feature-id>/spec/specification.md`
   - `workflow/features/<feature-id>/arch/architecture.md`
   - `workflow/features/<feature-id>/arch/decisions.md`
4. Create stage directory: `workflow/features/<feature-id>/plan/`.

If the specification is not approved, STOP and request approval before continuing.

### Step 2: Planning Constraints

Build plan rules before writing tasks:
- DRY: avoid duplicate work across tasks.
- YAGNI: implement only what specification requires.
- TDD-first where applicable.
- Frequent commits per meaningful task boundary.
- Each task should be independently reviewable.

### Step 3: Decompose Requirements

Map specification requirements into tasks.

For each task define:
- Task ID and name
- Goal (single outcome)
- Requirement coverage (`FR-*`, `NFR-*`)
- Dependencies (other tasks)
- Estimated effort (small, medium, large)
- Target files (create/modify/test)

Task sizing guidance:
- Prefer 15-30 minute tasks.
- Split any task that combines unrelated changes.
- Keep one responsibility per task.

### Step 4: Define Execution Order

Create phased order:

1. Foundation
   - project setup, types, core plumbing

2. Core capability
   - all P0 flows

3. Extended capability
   - P1 features and non-critical enhancements

4. Polish and hardening
   - P2 features, edge cases, docs refinement

For each phase, call out which tasks can run in parallel and why.

### Step 5: TDD Step Template

Every coding task should follow this sequence unless clearly not applicable:

1. Write a failing test.
2. Run the test to confirm failure.
3. Implement minimal code to pass.
4. Re-run tests and keep green.
5. Refactor safely.
6. Commit with clear message.

If TDD is not applicable for a task, explicitly justify why.

### Step 6: Write Artifact

Write `workflow/features/<feature-id>/plan/implementation-plan.md` with this structure:

```markdown
# Implementation Plan

## Overview
- Total tasks:
- Estimated total duration:
- Parallel groups:

## Assumptions
- [List assumptions used for planning]

## Phase Plan

### Phase 1 Foundation
### Task 001: <name>
- Goal:
- Covers:
- Dependencies:
- Files:
  - Create:
  - Modify:
  - Test:
- Steps:
  1) Write failing test
  2) Run test
  3) Implement minimum change
  4) Run tests
  5) Commit
- Definition of Done:
  - [ ] ...

### Phase 2 Core Capability
...

### Phase 3 Extended Capability
...

### Phase 4 Polish and Hardening
...

## Dependency Graph (Text)
- Task 003 depends on Task 001
- Task 004 depends on Task 002

## Parallelization Notes
- Group A: Task 005, Task 006
- Group B: Task 007 only (shared file conflict)

## Risk Register
| Risk | Related tasks | Mitigation |
|------|---------------|------------|
| ... | ... | ... |
```

### Step 7: Gates

Record gates via `wf_gate_record`:

1. `plan-coverage`
   - PASS if all P0/P1 requirements map to at least one task.

2. `task-actionability`
   - PASS if each task has explicit files, steps, and DoD.

3. `dependency-consistency`
   - PASS if ordering and dependency notes are non-contradictory.

### Step 8: Register Artifact

Call `wf_artifact_register`:
- artifact type: `implementation-plan`
- path: `workflow/features/<feature-id>/plan/implementation-plan.md`

### Step 9: HR Checkpoint (Mandatory)

Present summary:
- number of phases
- total task count
- parallel groups
- highest-risk tasks

Ask:

"Do you approve this implementation plan?"
- Approve
- Reject (request changes)

If approved:
1. Call `wf_hr_record` with decision `"approved"` for stage `"plan"`.
2. Call `wf_state_write` with action `"complete"` for stage `"plan"`.
3. Tell user: "Plan approved. Next: run `/wf.tasks`."

If rejected:
1. Collect required changes.
2. Update plan.
3. Re-run gates.
4. Re-present for approval.

Do not complete the stage until approved.

### Quality Rules

- Do not create vague tasks like "implement feature".
- Do not omit test strategy for code tasks.
- Do not schedule dependent tasks in parallel.
- Keep tasks small enough for safe subagent execution.
