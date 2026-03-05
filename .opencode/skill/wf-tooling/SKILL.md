---
name: wf-tooling
description: "Stage 7: Tooling -- stack inference, research, setup synthesis, capability checks (HR approval required)"
user-invocable: false
---

# Stage 7: Tooling

You are executing the Tooling stage. Your goal is to make environment and stack decisions evidence-based and executable.

This is a GOVERNED stage. HR approval is required before moving to `/wf.dispatch`.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read`.
2. Call `wf_state_write` with action `"start"` for stage `"tooling"`.
3. Read artifacts:
   - `workflow/features/<feature-id>/spec/specification.md`
   - `workflow/features/<feature-id>/plan/implementation-plan.md`
   - `workflow/features/<feature-id>/arch/architecture.md`
4. Create stage directory: `workflow/features/<feature-id>/tooling/`.

### Step 2: 7.1 Stack Inference

Infer required stack from spec and plan.

Produce explicit lists:
- language/runtime
- package manager
- test tooling
- type checking and linting
- build tooling
- infrastructure dependencies

Call `wf_gate_record` for gate `stack-inference`:
- PASS if required tools are clearly identified.

### Step 3: 7.2 Web Research

Run focused research for each key technology using evidence-first method.

For each technology collect:
- current stable version
- setup guidance
- common pitfalls
- compatibility constraints

Use web tools only when needed. Keep findings concise and source-backed.

Call `wf_gate_record` for gate `web-research`:
- PASS if all major stack items are researched.

### Step 4: 7.3 Setup Synthesis

Translate findings into deterministic setup instructions.

Define:
- install commands
- configuration files needed
- minimal project bootstrap sequence
- required environment variables
- fallback notes when tool is missing locally

Call `wf_gate_record` for gate `setup-synthesis`:
- PASS if setup steps are complete and runnable.

### Step 5: 7.4 Capability Check

Verify local environment capabilities.

Checks to run (adapt to environment):
- runtime availability and versions
- package manager availability
- git availability
- type checker and test runner availability

If a tool is missing:
- record as issue
- provide exact remediation steps

Call `wf_gate_record` for gate `capability-check`:
- PASS if environment can execute plan tasks, or clear remediation is provided.

### Step 6: 7.5 Write Artifacts

Write two artifacts:

1. `workflow/features/<feature-id>/tooling/tooling-report.md`
2. `workflow/features/<feature-id>/tooling/setup.md`

`tooling-report.md` structure:

```markdown
# Tooling Report

## Inferred Stack
| Area | Choice | Notes |
|------|--------|-------|

## Research Findings
| Technology | Version | Key findings | Risks |
|------------|---------|--------------|------|

## Capability Check
| Check | Result | Evidence | Action |
|-------|--------|----------|--------|

## Decision Summary
- ...
```

`setup.md` structure:

```markdown
# Setup Guide

## Prerequisites
- ...

## Install Steps
1. ...

## Verification Steps
1. ...

## Troubleshooting
- ...
```

### Step 7: Register and Gate

Call `wf_artifact_register` for both artifacts.

Optional additional gate:
- `setup-verification` PASS if setup instructions were validated locally.

### Step 8: HR Checkpoint (Mandatory)

Present:
- inferred stack
- major research-backed decisions
- environment readiness
- known setup risks

Ask:

"Do you approve this tooling baseline?"
- Approve
- Reject (request changes)

If approved:
1. Call `wf_hr_record` with decision `"approved"` for stage `"tooling"`.
2. Call `wf_state_write` with action `"complete"` for stage `"tooling"`.
3. Tell user: "Tooling approved. Next: run `/wf.dispatch`."

If rejected:
1. Capture requested changes.
2. Update artifacts.
3. Re-run affected gates.
4. Re-present for approval.

Do not complete stage until approved.

### Quality Rules

- No unpinned major dependencies without rationale.
- No setup steps that rely on hidden assumptions.
- Keep setup deterministic and reproducible.
