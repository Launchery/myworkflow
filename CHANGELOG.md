# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-06

### Added
- **Custom stage definitions** — define project-specific workflow stages beyond the built-in 15
  - `wf_custom_stage_define` — add custom stages with preconditions, governance, skills, artifacts
  - `wf_custom_stage_list` — list all custom stages
  - `wf_custom_stage_remove` — remove a custom stage
  - Custom stages support `position` hints (`before:X` / `after:X`) for pipeline ordering
  - Dynamic slash commands: `/wf.<custom-id>` for each custom stage
  - Custom stage config persisted in `workflow/custom-stages.json`
- **Stage templates library** — 8 pre-built templates for common extensions
  - `wf_template_list` — browse templates by category
  - `wf_template_apply` — apply a template (security gate, perf benchmark, staging deploy, etc.)
  - Categories: quality, security, deployment, documentation, testing, compliance
  - Templates: security-review, perf-benchmark, a11y-audit, staging-deploy, compliance-check, docs-generation, integration-test, release-prep
- **Workflow report exporter** — export feature reports as Markdown or HTML
  - Stage timeline with status icons and duration
  - Gate issue summary
  - Artifact listing with stage attribution
  - HTML output with styled template

## [1.1.0] - 2026-04-06

### Added
- One-liner setup script (`scripts/setup.sh`)
- Improved quickstart with "First workflow in 60 seconds" guide
- Workflow examples for greenfield, bugfix, refactor, and multi-contributor handoff scenarios
- Example index in `docs/examples/README.md`

## [1.0.0] - 2026-04-04

### Added
- 15 workflow stages: discover → spike → arch → spec → plan → tasks → tooling → dispatch → implement → review → finish-branch → project-report → human-qa → debug → finish-report
- 6 service commands: status, resume, gates, history, approve, reject
- Stage gating with mandatory HR outcome recording
- Governed stages with enforced HR approval (arch, spec, plan, tasks, tooling)
- Deterministic dispatch/runner runtime for stages 8/9
- Task passport schema validation before dispatch
- Local/global skill collision resolver with interactive source selection
- Artifact tracking per feature and stage
- State persistence across sessions
- OpenCode plugin with tools and precommand gating hook
- Slash command definitions (opencode.json)
- Stage skills with SKILL.md for each workflow stage
- Documentation: RUNNING.md, COMMANDS_SKILLS.md
