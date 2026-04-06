# Workflow Examples

Concrete walkthroughs for common `myworkflow` usage patterns.

Use these examples to understand:
- which stages to run in practice;
- where HR approval matters;
- what artifacts should exist before dispatch or review;
- how different project shapes change the path through the workflow.

## Included Examples

1. [Greenfield CLI tool](./greenfield-cli-tool.md)
   - Full path through all 15 stages
   - Best for new repos or net-new features

2. [Bugfix regression workflow](./bugfix-regression.md)
   - Short path focused on diagnosis, guardrails, and verification
   - Best for production issues or broken flows

3. [Refactor command router](./refactor-command-router.md)
   - Architecture-heavy path with stronger design checkpoints
   - Best for internal rewrites without changing external behavior

4. [Multi-contributor handoff](./multi-contributor-handoff.md)
   - Workflow adapted for owner ↔ implementer coordination
   - Best for shared execution with explicit approval boundaries

## How to Use These Examples

1. Pick the scenario closest to your task.
2. Copy the stage sequence and artifact checklist.
3. Adjust scope, risk level, and approval points for your repo.
4. Treat the examples as templates, not rigid scripts.
