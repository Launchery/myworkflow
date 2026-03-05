---
name: wf-dispatch
description: "Stage 8: Dispatch -- map passports into execution waves"
user-invocable: false
---

# Stage 8: Dispatch

You are executing the Dispatch stage. Your goal is to transform task passports into an execution strategy for subagents with controlled parallelism and conflict safety.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"dispatch"`.
3. Read artifacts:
   - all `workflow/features/<feature-id>/tasks/*.yaml`
   - `workflow/features/<feature-id>/tasks/index.md`
   - `workflow/features/<feature-id>/tooling/setup.md`
4. Create stage directory: `workflow/features/<feature-id>/dispatch/`.

### Step 2: Build Dependency Graph

For each passport:
- extract dependencies from declared inputs and requirement links
- infer task ordering constraints
- detect cycles

If cycles exist:
- STOP and report cycle details
- suggest minimum changes to break cycle
- do not proceed until resolved

### Step 3: File Conflict Analysis

Determine write collisions:
- tasks that modify the same output path cannot run in parallel
- tasks that touch shared critical files should be serialized

Create conflict map:
- file path -> tasks touching that path

### Step 4: Wave Planning

Create execution waves:
- Wave N may run in parallel internally only when safe
- Next wave starts only after previous wave completion and gate checks

Prioritization:
- execute high-risk and foundational tasks early
- defer cosmetic or low-impact tasks

### Step 5: Risk Grading

Assign each task risk grade:
- LOW: isolated and straightforward
- MEDIUM: shared modules or moderate complexity
- HIGH: architecture-sensitive, integration-heavy, or irreversible

Add mitigation notes for HIGH risk tasks.

### Step 6: Write Artifact

Write `workflow/features/<feature-id>/dispatch/dispatch-plan.md`:

```markdown
# Dispatch Plan

## Summary
- Total tasks:
- Total waves:
- Max parallelism:

## Dependency Graph
- task-001 -> task-003
- task-002 -> task-004

## File Conflict Map
| File | Tasks | Policy |
|------|-------|--------|

## Execution Waves

### Wave 1
| Task ID | Goal | Risk | Mode |
|---------|------|------|------|

### Wave 2
...

## Failure Policy
If any task in a wave fails:
1. Stop starting new tasks in that wave.
2. Collect diagnostics.
3. Fix failed task.
4. Re-run failed task and any affected tasks.
```

### Step 7: Gates

Record gates:

1. `dependency-analysis`
   - PASS if no unresolved cycles and ordering is coherent.

2. `conflict-analysis`
   - PASS if write conflicts are identified and handled.

3. `wave-feasibility`
   - PASS if each wave has clear execution policy.

### Step 8: Register and Complete

1. Call `wf_dispatch_build` to generate deterministic runtime plan artifacts.
2. Register `dispatch-plan.md` and generated artifacts with `wf_artifact_register`.
3. Call `wf_state_write` with action `"complete"` for stage `"dispatch"`.
4. Tell user: "Dispatch plan ready. Next: run `/wf.implement`."

### Quality Rules

- Never ignore file write conflicts.
- Never schedule tasks in parallel if dependency is uncertain.
- Keep wave definitions explicit and deterministic.
