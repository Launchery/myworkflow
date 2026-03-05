---
name: wf-implement
description: "Stage 9: Implement -- execute task passports with SDD + TDD"
user-invocable: false
---

# Stage 9: Implement

You are executing the Implement stage. Your goal is to deliver the approved task passports by dispatching subagents, enforcing TDD discipline, and recording gate evidence.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"implement"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/dispatch/dispatch-plan.md`
   - all passports in `workflow/features/<feature-id>/tasks/*.yaml`
   - `workflow/features/<feature-id>/tooling/setup.md`
4. Create stage directory: `workflow/features/<feature-id>/implement/`.

### Step 2: Readiness Check

Before dispatching work:
- verify setup prerequisites from `setup.md`
- verify target branch/worktree safety
- verify unresolved failures from previous stages do not exist

Record gate `implementation-readiness`.

### Step 3: Execute by Wave

Follow `dispatch-plan.md` wave order exactly.

Use deterministic runtime runner tools:
- `wf_runner_init` to initialize runner state from generated dispatch plan
- `wf_runner_next` to claim next runnable tasks in deterministic order
- `wf_runner_mark` to mark each claimed task as completed/failed/skipped
- `wf_runner_status` to inspect progress and wave state

For each task:
1. Read full passport.
2. Dispatch subagent with full task payload (do not ask subagent to open plan file blindly).
3. Require TDD loop where applicable:
   - write failing test
   - verify fail
   - implement minimal fix
   - verify pass
   - refactor safely
4. Collect subagent report and changed files.

For parallel waves:
- run only tasks explicitly marked safe for parallelism
- prevent simultaneous writes to same files

### Step 4: Gate Verification Per Task

After each task execution:
- run each gate command from task passport using `wf_gate_run`
- record any manual/non-command gate only via `wf_gate_record`
- map gate evidence to task id in notes

If a task fails gate checks:
- stop scheduling new tasks in current wave
- enter Stop + Diagnose policy

### Step 5: Stop + Diagnose Policy

On failure:
1. Write diagnostics file:
   - `workflow/features/<feature-id>/implement/diagnostics-<task-id>.md`
2. Include:
   - attempted work summary
   - failing gate and raw error
   - suspected root cause
   - concrete remediation options
3. Call `wf_state_write` action `"fail"` with diagnostics path.
4. Tell user how to recover (`/wf.debug` or targeted re-run).

Do not continue waves while unresolved failure remains.

### Step 6: Integration Verification

After all tasks pass:
- run full test suite
- run type checks
- run lint checks (if configured)
- ensure no broken imports or missing files

Record gates:
- `all-tasks-complete`
- `integration-tests`
- `type-safety`

### Step 7: Artifact Registration

Register implementation-level artifacts as needed:
- diagnostics logs
- summary reports
- generated outputs from task execution

Use `wf_artifact_register` for each material output.

### Step 8: Completion

If all required tasks and gates pass:
1. Call `wf_state_write` with action `"complete"` for stage `"implement"`.
2. Tell user: "Implementation complete. Next: run `/wf.review`."

### Recommended Subagent Prompt Skeleton

Use this structure for each dispatched task:

```text
You are implementing task <task-id>.

Task Passport:
<paste full YAML>

Rules:
1) Ask clarifying questions before coding if anything is ambiguous.
2) Follow TDD where applicable.
3) Keep changes scoped to task goal.
4) Run required gates and report evidence.

Report format:
- implemented scope
- tests run and results
- files changed
- gate outcomes
- open risks
```

### Quality Rules

- Never skip a declared gate.
- Never continue after failed critical gate.
- Never overbuild beyond passport goal.
- Preserve traceability from passport -> implementation -> gate evidence.
