# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
