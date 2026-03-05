# OpenCode Agentic Workflow — Design Document

## Summary

A deterministic, slash-command-driven workflow system for AI-assisted software development in OpenCode. Built as a lightweight TS plugin + rich markdown skills architecture for a solo developer who needs predictable outcomes, quality gates, and traceability from idea to delivery.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Skills + Config Commands + TS Plugin | Skills easy to edit, plugin small and testable, SDK supports this well |
| Scope | Full — all 15 stages + 6 service commands | Complete lifecycle coverage from spec |
| discovery-interview | Adapt into wf-discover skill | Reuse domain logic, add workflow state integration |
| Superpowers patterns | Inline needed logic into workflow skills | Self-contained skills, no external dependency |
| HR checkpoints | In-session via questions + state recording | Natural flow, recorded decisions |
| Test runner | Bun built-in | Already using Bun as package manager |

## Architecture

### Overview

```
User -> /wf.<stage> command -> opencode.json routes to skill
                                    |
                        command.execute.before hook
                        (plugin checks preconditions,
                         injects state context)
                                    |
                        Skill executes with LLM
                        (uses custom tools for
                         state, gates, artifacts, HR)
                                    |
                        Skill completes, state updated
```

### Components

1. **TS Plugin** (`.opencode/plugin.ts`): ~300-500 lines. Registers custom tools and command hook.
2. **Skills** (`.opencode/skill/wf-*/SKILL.md`): 15 markdown files with stage-specific instructions.
3. **Config** (`opencode.json`): 21 slash command definitions.
4. **State** (`workflow/state/workflow_state.json`): Single JSON file for all workflow state.
5. **Artifacts** (`workflow/features/<id>/<stage>/*`): Stage outputs organized by feature and stage.
6. **Schemas** (`workflow/schemas/task-passport.schema.yaml`): Validation schema for task passports.

### File Layout

```
MyWorkflow/
├── .opencode/
│   ├── package.json
│   ├── plugin.ts
│   ├── skill/
│   │   ├── wf-discover/SKILL.md
│   │   ├── wf-spike/SKILL.md
│   │   ├── wf-arch/SKILL.md
│   │   ├── wf-spec/SKILL.md
│   │   ├── wf-plan/SKILL.md
│   │   ├── wf-tasks/SKILL.md
│   │   ├── wf-tooling/SKILL.md
│   │   ├── wf-dispatch/SKILL.md
│   │   ├── wf-implement/SKILL.md
│   │   ├── wf-review/SKILL.md
│   │   ├── wf-finish-branch/SKILL.md
│   │   ├── wf-project-report/SKILL.md
│   │   ├── wf-human-qa/SKILL.md
│   │   ├── wf-debug/SKILL.md
│   │   └── wf-finish-report/SKILL.md
│   └── node_modules/
├── opencode.json
├── workflow/
│   ├── state/
│   │   └── workflow_state.json
│   ├── features/
│   │   └── <feature-id>/
│   │       └── <stage>/
│   └── schemas/
│       └── task-passport.schema.yaml
├── docs/plans/
└── thoughts/shared/specs/
```

## Data Model

### workflow_state.json

```json
{
  "version": "1.0",
  "active_feature": "<feature-id> | null",
  "features": {
    "<feature-id>": {
      "feature_id": "string",
      "title": "string",
      "created_at": "ISO8601",
      "status": "in_progress | completed | failed | cancelled",
      "current_stage": "stage-id",
      "stages": {
        "<stage-id>": {
          "stage_id": "string",
          "command": "/wf.<stage>",
          "started_at": "ISO8601",
          "finished_at": "ISO8601 | null",
          "result": "completed | failed | in_progress | skipped",
          "diagnostics_path": "string | null",
          "artifacts": [
            {
              "artifact_type": "string",
              "path": "string",
              "checksum": "sha256:...",
              "generated_at": "ISO8601"
            }
          ],
          "gates": [
            {
              "gate_name": "string",
              "status": "passed | failed | skipped",
              "evidence_path": "string | null",
              "timestamp": "ISO8601"
            }
          ],
          "approval": {
            "decision": "approved | rejected | pending | not_required",
            "reviewer": "string",
            "timestamp": "ISO8601",
            "notes": "string"
          }
        }
      }
    }
  }
}
```

### Stage Transition Map

```
discover -> spike -> arch -> spec -> plan -> tasks -> tooling -> dispatch -> implement -> review -> finish-branch -> project-report -> human-qa -> debug -> finish-report
```

**Governed transitions (HR approval required before proceeding):**
- arch, spec, plan, tasks, tooling

**Preconditions:**

| Stage | Requires |
|-------|----------|
| discover | nothing (entry point) |
| spike | discover.completed |
| arch | spike.completed |
| spec | arch.completed + arch.approved |
| plan | spec.completed + spec.approved |
| tasks | plan.completed + plan.approved |
| tooling | tasks.completed + tasks.approved |
| dispatch | tooling.completed + tooling.approved |
| implement | dispatch.completed |
| review | implement.completed |
| finish-branch | review.completed |
| project-report | finish-branch.completed |
| human-qa | project-report.completed |
| debug | human-qa.completed (if issues found) |
| finish-report | human-qa.completed (if no issues) OR debug.completed |

### Task Passport Schema (YAML)

```yaml
task_id: string
goal: string
inputs:
  - path: string
    description: string
outputs:
  - path: string
    type: string
allowed_tools:
  - tool_name: string
gates:
  - name: string
    check: string
dod:
  - criterion: string
owner_agent: string
```

## Plugin Design

### Custom Tools

| Tool | Purpose | Args |
|------|---------|------|
| `wf_state_read` | Read current workflow state | `feature_id?: string` |
| `wf_state_write` | Update workflow state | `feature_id, stage_id, updates` |
| `wf_gate_check` | Check stage preconditions | `target_stage` |
| `wf_gate_record` | Record gate check result | `feature_id, stage_id, gate_name, status, evidence_path?` |
| `wf_artifact_register` | Register a produced artifact | `feature_id, stage_id, artifact_type, path` |
| `wf_hr_record` | Record HR decision | `feature_id, stage_id, decision, notes?` |
| `wf_feature_init` | Create new feature run | `title` |

### Command Hook (command.execute.before)

For all `/wf.*` commands:
1. Read current state
2. Check if target stage preconditions are met
3. If blocked: inject error message, prevent execution
4. If allowed: inject current state context as additional prompt parts

## Skills Design

### Common Pattern

Each skill follows this structure:

```markdown
---
name: wf-<stage>
description: <stage description>
user-invocable: false
---

# Stage N: <Stage Name>

## Prerequisites
[Call wf_state_read, verify preconditions]

## Instructions
[Stage-specific domain logic]

## Artifacts
[What to produce, call wf_artifact_register]

## Gates
[Quality checks, call wf_gate_record]

## HR Checkpoint (if governed)
[Present summary, ask for approval, call wf_hr_record]

## Completion
[Call wf_state_write, report results]
```

### 15 Skills Overview

| # | Skill | Produces | HR | Key Logic |
|---|-------|----------|-----|-----------|
| 1 | wf-discover | project-concept.md | No | Deep interview, research loops, conflict resolution, completeness check. Adapted from discovery-interview |
| 2 | wf-spike | spike-report.md | No | Formulate hypotheses, run spike experiments, document findings and risks |
| 3 | wf-arch | architecture.md, decisions.md | Yes | Design architecture, components, data flow, security. ADR for key decisions |
| 4 | wf-spec | specification.md | Yes | Detailed specification with acceptance criteria per requirement |
| 5 | wf-plan | implementation-plan.md | Yes | Step-by-step implementation plan with tasks, dependencies, priorities |
| 6 | wf-tasks | tasks/*.yaml (passports) | Yes | Generate ABI task passports. Validate against schema |
| 7 | wf-tooling | tooling-report.md, setup.md | Yes | 5-step mini-workflow: stack inference -> web research -> synthesis -> capability check -> HR review |
| 8 | wf-dispatch | dispatch-plan.md | No | Analyze task passports, determine parallelism, file conflicts, form dispatch plan |
| 9 | wf-implement | per-task outputs | No | SDD+TDD: dispatch subagents by task passports, test-first, mandatory gates |
| 10 | wf-review | review-report.md | Optional | Code review: structural analysis, consistency, test coverage |
| 11 | wf-finish-branch | branch metadata | No | Branch finalization: cleanup, squash/rebase, PR prep |
| 12 | wf-project-report | skill-report.md, human-qa-plan.md | No | Generate Skill.md and human QA plan |
| 13 | wf-human-qa | qa-report.md | No | Guide human through smoke + critical-path QA on localhost |
| 14 | wf-debug | debug-log.md | No | Bounded debug loop: diagnose -> fix -> verify. Max 5 iterations |
| 15 | wf-finish-report | final-report.md | No | Executive summary: what was built, decisions, metrics, lessons learned |

### Tooling Mini-Workflow (Stage 7)

1. **7.1 Stack Inference** — analyze spec and plan, infer technology stack
2. **7.2 Web Research** — evidence-based research on chosen technologies
3. **7.3 Setup Synthesis** — synthesize setup instructions from research
4. **7.4 Capability Check** — verify dependencies installed, toolchain works
5. **7.5 HR Review** — present tooling decisions for approval

### Implement Stage (Stage 9) — SDD + TDD

1. Read dispatch plan and task passports
2. For each task (or parallel task group):
   - Launch subagent via Task tool
   - Subagent receives task passport as context
   - Subagent follows TDD: write failing test -> implement -> pass -> commit
   - Record results on completion
3. Verify gates per task
4. On gate failure: Stop + Diagnose policy

## Error Handling

### Stop + Diagnose Policy

On gate failure or critical error:
1. **Halt** — skill stops execution
2. **Diagnose** — write to `workflow/features/<id>/<stage>/diagnostics.md`:
   - What was attempted
   - Which gate/check failed
   - Error output
   - Concrete remediation suggestions
3. **State update** — `wf_state_write` with `result: "failed"`, `diagnostics_path`
4. **User notification** — explain what went wrong and what can be done

### Debug Loop Policy (Stage 14)

- Max iterations: 5 (configurable)
- Each iteration: diagnose -> propose fix -> implement -> verify
- After max iterations with remaining issues: stop, write full debug log, suggest alternatives

### Resume Policy (/wf.resume)

- Read state, find last stage with `result: "failed"` or `result: "in_progress"`
- Restore context from artifacts and state
- Continue from interruption point

## Security

- Pre-commit secret scan via gate check before finalization
- Destructive operations: explicit user confirmation required, logged
- Environment secrets via `.env`, never committed
- No mandatory external SaaS dependency

## Testing Strategy

- **Plugin unit tests**: state read/write, gate validation, artifact registration as pure functions
- **Integration tests**: mock slash commands, verify transitions
- **Manual smoke tests**: run several stages on a real project
- **Test runner**: Bun built-in test runner

## Service Commands

| Command | Purpose |
|---------|---------|
| `/wf.status` | Show current workflow state summary |
| `/wf.resume` | Resume from last failed/in-progress stage |
| `/wf.gates` | Show gate status for current feature |
| `/wf.history` | Show feature run history |
| `/wf.approve <stage>` | Manually approve a stage |
| `/wf.reject <stage>` | Manually reject a stage with reason |
