# Detailed Project Run Guide

This guide explains how to launch and use the workflow end-to-end.

## 1. Prerequisites

Required:
- OpenCode CLI (supports local `opencode.json`, plugin hooks, and skills)
- Node.js 18+
- Bun 1.0+
- Git

Optional:
- GitHub CLI (`gh`) for PR/repo workflows

Check tools:

```bash
node --version
bun --version
git --version
gh --version
```

## 2. Initial Setup

From repository root:

```bash
cd .opencode
bun install
```

If you do not have Bun yet, install it and rerun `bun install`.

## 3. Verification Before First Run

Run static/type and test checks:

```bash
cd .opencode
bunx tsc --noEmit
bun test
```

Expected:
- TypeScript check exits with code 0
- Tests are green

## 4. Project Runtime Structure

At runtime, workflow writes data to:

- State file:
  - `workflow/state/workflow_state.json`

- Per-feature artifacts:
  - `workflow/features/<feature-id>/<stage-id>/...`

Core config files:
- `opencode.json` - command templates
- `.opencode/plugin.ts` - precommand checks + tool registration

## 5. Start OpenCode and Run Workflow

Open OpenCode in repository root and run:

```text
/wf.discover
```

Recommended normal flow:

```text
/wf.discover
/wf.spike
/wf.arch
/wf.spec
/wf.plan
/wf.tasks
/wf.tooling
/wf.dispatch
/wf.implement
/wf.review
/wf.finish-branch
/wf.project-report
/wf.human-qa
/wf.debug           (only if needed)
/wf.finish-report
```

## 6. HR Checkpoints

Governed stages require approval before moving forward:
- `arch`
- `spec`
- `plan`
- `tasks`
- `tooling`

Approval can happen inside stage flow (preferred), and service commands are available if needed:

```text
/wf.approve <stage>
/wf.reject <stage>
```

Examples:
- `/wf.approve spec`
- `/wf.reject wf.plan`

Stage parsing supports common forms (`spec`, `wf.spec`, `/wf.spec`).

## 7. Service Commands (Control Plane)

Use during execution:

- `/wf.status` - show active feature, stage, and next step
- `/wf.gates` - show gate outcomes
- `/wf.history` - show feature run history
- `/wf.resume` - continue after interruption/failure

## 8. Typical First Feature Run

1. Run `/wf.discover` and provide your raw idea.
2. Continue to `/wf.spike` for technical validation.
3. Approve architecture/spec/plan/tasks/tooling when prompted.
4. Let implementation run via dispatch + task passports.
5. Complete review, QA, optional debug, and final report.

Artifacts for each stage appear under the feature directory.

## 9. Troubleshooting

### "No active feature"

Cause:
- State has no `active_feature` yet.

Fix:
- Start from `/wf.discover`, which initializes a feature.
- Or manually initialize through workflow tool flow.

### "Preconditions not met"

Cause:
- You skipped a required prior stage or missing approval.

Fix:
- Run `/wf.status` and `/wf.gates`.
- Complete/approve the required stage.

### Stage id errors on approve/reject

Use one of:
- `spec`
- `wf.spec`
- `/wf.spec`

### Tests not running

Cause:
- Bun missing.

Fix:
- Install Bun and rerun:

```bash
cd .opencode
bun test
```

## 10. Local Development Loop

When changing plugin or tools:

```bash
cd .opencode
bunx tsc --noEmit
bun test
```

When changing command templates/skills:
- Re-open OpenCode session if command cache is stale.
- Re-run from stage entry point.

## 11. Where To Look For Outputs

- Full command map: `workflow/command-index.md`
- Workflow state: `workflow/state/workflow_state.json`
- Stage outputs: `workflow/features/<feature-id>/...`
- Planning docs: `docs/plans/`

## 12. Optional GitHub Flow

If you want GitHub operations from CLI:

```bash
gh auth login
```

Then use normal git/gh workflows for branch, push, and PR creation.
