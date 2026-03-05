# MyWorkflow: OpenCode Agentic Workflow

Deterministic, stage-driven workflow for AI-assisted development in OpenCode.

Project provides:
- 15 workflow stages (`/wf.discover` -> `/wf.finish-report`)
- 6 service commands (`/wf.status`, `/wf.resume`, `/wf.gates`, `/wf.history`, `/wf.approve`, `/wf.reject`)
- state persistence and stage gating
- artifact tracking per feature/stage
- HR approval checkpoints for governed stages

## What Is In This Repo

- `opencode.json` - slash command definitions
- `.opencode/plugin.ts` - plugin entry (tools + precommand gating hook)
- `.opencode/tools/*.ts` - workflow tools (state, gates, artifacts, HR, feature init)
- `.opencode/skill/wf-*/SKILL.md` - stage skills (15 stages)
- `workflow/state/workflow_state.json` - workflow state file
- `workflow/features/<feature-id>/<stage-id>/` - runtime artifacts
- `workflow/schemas/task-passport.schema.yaml` - task passport schema
- `workflow/command-index.md` - command index

## Quick Start

1) Install prerequisites:
- OpenCode CLI (with plugin/skill support)
- Node.js 18+
- Bun 1.0+ (required for test runner)

2) Install plugin dependencies:

```bash
cd .opencode
bun install
```

3) Verify local setup:

```bash
bunx tsc --noEmit
bun test
```

4) Return to repository root and open OpenCode in this project.

5) Start workflow from stage 1:

```text
/wf.discover
```

Then continue through stages in order.

## Command Groups

Stage commands:
- `/wf.discover`, `/wf.spike`, `/wf.arch`, `/wf.spec`, `/wf.plan`, `/wf.tasks`, `/wf.tooling`, `/wf.dispatch`, `/wf.implement`, `/wf.review`, `/wf.finish-branch`, `/wf.project-report`, `/wf.human-qa`, `/wf.debug`, `/wf.finish-report`

Service commands:
- `/wf.status`, `/wf.resume`, `/wf.gates`, `/wf.history`, `/wf.approve <stage>`, `/wf.reject <stage>`

See full list in `workflow/command-index.md`.

## Governed Stages (HR Approval Required)

- `/wf.arch`
- `/wf.spec`
- `/wf.plan`
- `/wf.tasks`
- `/wf.tooling`

## Detailed Run Instructions

Read `docs/RUNNING.md` for a complete setup and execution guide, including troubleshooting.
