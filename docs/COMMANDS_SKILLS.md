# Workflow Commands and Skill Editing Guide

This document explains:
1) what each `/wf.*` command does,
2) which artifacts it produces,
3) how to edit command behavior safely.

## How Command Execution Works

For every workflow command the runtime pipeline is:

1. User runs `/wf.*`.
2. Command template is read from `opencode.json` (`command` section).
3. Plugin hook in `.opencode/plugin.ts` (`command.execute.before`) checks preconditions and injects context.
4. Stage skill (`.opencode/skill/wf-*/SKILL.md`) executes workflow logic.
5. Tools in `.opencode/tools/*.ts` update state, gates, approvals, and artifact metadata.
6. State is persisted to `workflow/state/workflow_state.json`.

## Stage Commands (15)

### 1) `/wf.discover`
- Purpose: discovery interview from raw idea to concept.
- Main output: `workflow/features/<feature-id>/discover/project-concept.md`.
- Typical next step: `/wf.spike`.
- HR approval required: No.

### 2) `/wf.spike`
- Purpose: validate key technical assumptions and risks.
- Main output: `workflow/features/<feature-id>/spike/spike-report.md`.
- Typical next step: `/wf.arch`.
- HR approval required: No.

### 3) `/wf.arch`
- Purpose: create architecture and decision records.
- Main outputs:
  - `workflow/features/<feature-id>/arch/architecture.md`
  - `workflow/features/<feature-id>/arch/decisions.md`
- Typical next step: `/wf.spec`.
- HR approval required: Yes (governed stage).

### 4) `/wf.spec`
- Purpose: produce detailed, testable specification.
- Main output: `workflow/features/<feature-id>/spec/specification.md`.
- Typical next step: `/wf.plan`.
- HR approval required: Yes (governed stage).

### 5) `/wf.plan`
- Purpose: convert specification into implementation plan with task breakdown.
- Main output: `workflow/features/<feature-id>/plan/implementation-plan.md`.
- Typical next step: `/wf.tasks`.
- HR approval required: Yes (governed stage).

### 6) `/wf.tasks`
- Purpose: generate executable task passports (YAML ABI contracts).
- Main outputs:
  - `workflow/features/<feature-id>/tasks/task-*.yaml`
  - `workflow/features/<feature-id>/tasks/index.md`
- Typical next step: `/wf.tooling`.
- HR approval required: Yes (governed stage).

### 7) `/wf.tooling`
- Purpose: infer stack, research choices, synthesize setup, run capability checks.
- Main outputs:
  - `workflow/features/<feature-id>/tooling/tooling-report.md`
  - `workflow/features/<feature-id>/tooling/setup.md`
- Typical next step: `/wf.dispatch`.
- HR approval required: Yes (governed stage).

### 8) `/wf.dispatch`
- Purpose: build dependency/conflict aware execution waves for task passports.
- Main output: `workflow/features/<feature-id>/dispatch/dispatch-plan.md`.
- Typical next step: `/wf.implement`.
- HR approval required: No.

### 9) `/wf.implement`
- Purpose: execute tasks via subagents using SDD + TDD discipline.
- Main outputs:
  - implementation artifacts under feature stage folders,
  - optional diagnostics in `workflow/features/<feature-id>/implement/diagnostics-*.md`.
- Typical next step: `/wf.review`.
- HR approval required: No.

### 10) `/wf.review`
- Purpose: verify spec compliance and code quality.
- Main output: `workflow/features/<feature-id>/review/review-report.md`.
- Typical next step: `/wf.finish-branch`.
- HR approval required: Optional escalation only.

### 11) `/wf.finish-branch`
- Purpose: merge-readiness checks, branch finalization metadata.
- Main output: `workflow/features/<feature-id>/finish-branch/branch-metadata.md`.
- Typical next step: `/wf.project-report`.
- HR approval required: No.

### 12) `/wf.project-report`
- Purpose: generate reusable implementation report and human QA plan.
- Main outputs:
  - `workflow/features/<feature-id>/project-report/skill-report.md`
  - `workflow/features/<feature-id>/project-report/human-qa-plan.md`
- Typical next step: `/wf.human-qa`.
- HR approval required: No.

### 13) `/wf.human-qa`
- Purpose: guide manual smoke and critical-path validation.
- Main output: `workflow/features/<feature-id>/human-qa/qa-report.md`.
- Typical next step: `/wf.finish-report` or `/wf.debug` if issues found.
- HR approval required: No.

### 14) `/wf.debug`
- Purpose: bounded diagnose/fix/verify loop for unresolved issues.
- Main output: `workflow/features/<feature-id>/debug/debug-log.md`.
- Typical next step: `/wf.finish-report`.
- HR approval required: No.

### 15) `/wf.finish-report`
- Purpose: generate executive final report and close feature status.
- Main output: `workflow/features/<feature-id>/finish-report/final-report.md`.
- Typical next step: workflow complete.
- HR approval required: No.

## Service Commands (6)

### `/wf.status`
- Purpose: current feature + stage summary.
- Reads: `workflow/state/workflow_state.json`.

### `/wf.resume`
- Purpose: resume from last `failed` or `in_progress` stage.
- Reads: state + stage artifacts.

### `/wf.gates`
- Purpose: show gate pass/fail status by stage.
- Reads: state gate records.

### `/wf.history`
- Purpose: show feature run history.
- Reads: all feature records in state.

### `/wf.approve <stage>`
- Purpose: manual approval for a stage.
- Uses: `wf_hr_record` tool.
- Supported stage forms: `spec`, `wf.spec`, `/wf.spec`.

### `/wf.reject <stage>`
- Purpose: manual rejection for a stage.
- Uses: `wf_hr_record` tool.
- Supported stage forms: `spec`, `wf.spec`, `/wf.spec`.

## How to Edit a Command Skill Safely

There are two layers to every command:

1) Command routing/template (`opencode.json`)  
2) Actual stage logic (`.opencode/skill/wf-*/SKILL.md`)

### A. Edit Behavior of Existing Stage Command

Example: change `/wf.spec` behavior.

1. Edit skill file:
   - `.opencode/skill/wf-spec/SKILL.md`

2. If needed, update command text shown to model:
   - `opencode.json` -> `command.wf.spec.template`
   - `opencode.json` -> `command.wf.spec.description`

3. Keep frontmatter consistent:
   - `name: wf-spec`
   - `user-invocable: false`

4. Run verification:

```bash
cd .opencode
bunx tsc --noEmit
bun test
```

### B. Add New Stage Command (or Rename Stage)

If you add/rename a stage, update all of these:

1. `opencode.json`
   - add command entry under `command`.

2. `.opencode/plugin.ts`
   - update `COMMAND_TO_STAGE` map.

3. `.opencode/types.ts`
   - update `StageId`
   - update `STAGE_ORDER`
   - update `STAGE_PRECONDITIONS`
   - optionally update `GOVERNED_STAGES`

4. Add/update skill file:
   - `.opencode/skill/wf-<stage>/SKILL.md`

5. Update docs:
   - `workflow/command-index.md`
   - `docs/RUNNING.md` (if user-facing flow changed)

6. Re-run checks:

```bash
cd .opencode
bunx tsc --noEmit
bun test
```

### C. Add or Edit Service Command

Usually update only:
- `opencode.json`
- optional docs (`workflow/command-index.md`, this guide)

Plugin code update is only needed if service command requires new tool logic.

## Files You Usually Touch

- Command definitions: `opencode.json`
- Stage mapping and prechecks: `.opencode/plugin.ts`
- Stage model/preconditions: `.opencode/types.ts`
- Runtime tool behavior: `.opencode/tools/*.ts`
- Skill instructions: `.opencode/skill/wf-*/SKILL.md`
- State bootstrap: `workflow/state/workflow_state.json`
- Command docs: `workflow/command-index.md`

## Common Mistakes

- Using `commands` instead of `command` key in `opencode.json`.
- Renaming stage in skill file but not in `StageId`/`COMMAND_TO_STAGE`.
- Changing stage flow without updating preconditions.
- Forgetting to run `bunx tsc --noEmit` and `bun test`.

## Quick Validation Checklist

Before commit:

- [ ] command exists in `opencode.json`
- [ ] skill file exists and frontmatter is correct
- [ ] stage id is valid in `.opencode/types.ts`
- [ ] plugin stage map includes command
- [ ] docs updated (`workflow/command-index.md` and/or this guide)
- [ ] typecheck and tests passed
