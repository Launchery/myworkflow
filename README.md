# MyWorkflow: OpenCode Agentic Workflow

Deterministic, stage-driven workflow for AI-assisted development in OpenCode.

Project provides:
- 15 workflow stages (`/wf.discover` -> `/wf.finish-report`)
- 6 service commands (`/wf.status`, `/wf.resume`, `/wf.gates`, `/wf.history`, `/wf.approve`, `/wf.reject`)
- state persistence and stage gating
- artifact tracking per feature/stage
- stage-exit contract with mandatory HR outcome + approval for completion
- deterministic dispatch/runner runtime for stage 8/9 execution
- task passport schema validation before dispatch
- local/global skill collision resolver with interactive source selection

## What Is In This Repo

- `opencode.json` - slash command definitions
- `.opencode/plugin.ts` - plugin entry (tools + precommand gating hook)
- `.opencode/tools/*.ts` - workflow tools (state, gates, artifacts, HR, feature init, dispatch/runner, skill resolver)
- `.opencode/skill-resolver.ts` - local/global skill resolution with collision handling
- `.opencode/skill/wf-*/SKILL.md` - stage skills (15 stages)
- `workflow/state/workflow_state.json` - workflow state file
- `workflow/features/<feature-id>/<stage-id>/` - runtime artifacts
- `workflow/schemas/task-passport.schema.yaml` - task passport schema
- `workflow/command-index.md` - command index

## Quick Start

### One-liner setup

```bash
git clone https://github.com/Launchery/myworkflow.git && cd myworkflow && bash scripts/setup.sh
```

### Manual setup

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

### First workflow in 60 seconds

```text
1. /wf.discover      → define what you're building
2. /wf.arch          → pick the architecture approach  
3. /wf.implement     → write the code (stage 8/9 dispatch)
4. /wf.review        → human review gate
5. /wf.finish-report → summary and wrap-up
```

See [docs/examples/](docs/examples/) for full walkthroughs of common scenarios.

## Command Groups

Stage commands:
- `/wf.discover`, `/wf.spike`, `/wf.arch`, `/wf.spec`, `/wf.plan`, `/wf.tasks`, `/wf.tooling`, `/wf.dispatch`, `/wf.implement`, `/wf.review`, `/wf.finish-branch`, `/wf.project-report`, `/wf.human-qa`, `/wf.debug`, `/wf.finish-report`

Service commands:
- `/wf.status`, `/wf.resume`, `/wf.gates`, `/wf.history`, `/wf.approve <stage>`, `/wf.reject <stage>`
- `/wf.report-export <feature-id> [--format markdown|html] [--output <path>]`

See full list in `workflow/command-index.md`.

## Governed Stages (HR Approval Required)

- `/wf.arch`
- `/wf.spec`
- `/wf.plan`
- `/wf.tasks`
- `/wf.tooling`

All stages now require a recorded HR outcome before stage completion. Governed stages above additionally enforce HR approval as a transition checkpoint.

## Detailed Run Instructions

Read `docs/RUNNING.md` for a complete setup and execution guide, including troubleshooting.

For detailed command-by-command behavior and safe skill editing process, read `docs/COMMANDS_SKILLS.md`.

## Workflow Examples

Practical examples now live in `docs/examples/`:

- `greenfield-cli-tool.md`
- `bugfix-regression.md`
- `refactor-command-router.md`
- `multi-contributor-handoff.md`

Start with `docs/examples/README.md` to choose the closest scenario.

## Custom Stages (v2.0)

Extend the built-in 15 stages with project-specific steps.

### Define a custom stage

```text
wf_custom_stage_define({
  id: "security-review",
  name: "Security Review",
  description: "Review code for security vulnerabilities before merging",
  after: ["review"],
  governed: true,
  skills: ["wf-security-review"],
  artifacts: ["security-report"]
})
```

This creates a new `/wf.security-review` command that:
- Runs after the built-in `review` stage
- Requires HR approval (governed)
- Expects a `wf-security-review` skill and produces a `security-report` artifact

### List custom stages

```text
wf_custom_stage_list()
```

### Remove a custom stage

```text
wf_custom_stage_remove({ id: "security-review" })
```

### Configuration

Custom stages are stored in `workflow/custom-stages.json`. Example:

```json
{
  "version": "1.0",
  "stages": [
    {
      "id": "security-review",
      "name": "Security Review",
      "description": "Review code for security vulnerabilities",
      "after": ["review"],
      "governed": true,
      "skills": [],
      "artifacts": ["security-report"]
    }
  ]
}
```

### Positioning

By default, custom stages are placed after their last `after` dependency. Use `position` for explicit ordering:

- `"position": "before:review"` — insert before the `review` stage
- `"position": "after:implement"` — insert right after `implement`

### Stage Templates

8 pre-built templates for common workflow extensions:

| Template | Category | Stages | Description |
|----------|----------|--------|-------------|
| `security-gate` | security | 1 | Security review after code review |
| `perf-benchmark` | testing | 1 | Performance benchmarking |
| `accessibility-check` | quality | 1 | WCAG 2.1 accessibility audit |
| `staging-deploy` | deployment | 2 | Staging deploy + verification |
| `compliance-check` | compliance | 1 | GDPR/HIPAA/SOC2 review |
| `docs-generation` | documentation | 1 | Auto-generate docs from code |
| `integration-test` | testing | 1 | Integration & E2E testing |
| `release-prep` | deployment | 1 | Version bump + release notes |

```text
wf_template_list({ category: "security" })
wf_template_apply({ template_id: "security-gate" })
```
