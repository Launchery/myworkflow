# OpenCode Agentic Workflow Specification

## Executive Summary
This specification defines a deterministic, slash-command-driven workflow for AI-assisted software development in OpenCode. It is designed for a solo developer who needs predictable outcomes, strong quality gates, and clear traceability from raw idea to final delivery report. The workflow combines selected patterns from CodeMachine, Superpowers, and Spec-Kit while keeping a lightweight custom core.

## Problem Statement
Current AI-assisted development is fragmented: context is lost between stages, repetitive manual work accumulates, quality checks are inconsistent, and decisions are hard to trace. Existing open-source systems provide strong partial solutions, but none covers the full required process end-to-end in OpenCode with strict human checkpoints and customizable manual skills.

## Success Criteria
- 100% of stage executions produce a stage report artifact and update workflow state.
- 100% of controlled transitions (spec/plan/tasks/tooling and all stage exits) require recorded HR outcome (approve/reject).

## User Personas
- Solo developer (primary): technical user, runs full lifecycle in OpenCode, needs control, transparency, and reproducibility.
- Local collaborator (optional): any local user can provide human approval decisions in V1.

## User Journey
1. User runs `/wf.discover` with a raw idea.
2. System executes discovery skill, records decisions, produces `project-concept.md`.
3. User runs `/wf.spike`; system validates key technical assumptions and writes `spike-report.md`.
4. User runs `/wf.arch`; system generates architecture artifacts and prompts HR decision.
5. User runs `/wf.spec`; system creates specification and prompts HR decision.
6. User runs `/wf.plan`; system creates implementation plan and prompts HR decision.
7. User runs `/wf.tasks`; system generates tasks and ABI passports, then prompts HR decision.
8. User runs `/wf.tooling`; system infers stack, runs evidence-based web research, synthesizes setup, executes capability checks, then prompts HR decision.
9. User runs `/wf.dispatch`; system dispatches approved tasks to subagents.
10. User runs `/wf.implement`; system executes SDD with TDD strategy and mandatory gates.
11. User runs `/wf.review`; system requests code review and optionally routes to HR.
12. User runs `/wf.finish-branch`; system finalizes development branch.
13. User runs `/wf.project-report`; system generates `Skill.md` and `human-qa-plan.md`.
14. User runs `/wf.human-qa`; system guides localhost smoke + critical-path QA and writes `qa-report.md`.
15. User runs `/wf.debug` if needed; system loops debug until gates and QA pass (bounded policy).
16. User runs `/wf.finish-report`; system generates a concise executive final report.

## Functional Requirements
### Must Have (P0)
- Slash command per stage: exactly one command for each of the 15 stages.
  - Acceptance criteria: invoking each `/wf.*` command runs only its intended stage and writes stage outputs to the feature folder.
- Full stage map support:
  - `/wf.discover`, `/wf.spike`, `/wf.arch`, `/wf.spec`, `/wf.plan`, `/wf.tasks`, `/wf.tooling`, `/wf.dispatch`, `/wf.implement`, `/wf.review`, `/wf.finish-branch`, `/wf.project-report`, `/wf.human-qa`, `/wf.debug`, `/wf.finish-report`.
  - Acceptance criteria: all commands are discoverable and documented in generated command index.
- Strict stage gating and HR checkpoints.
  - Acceptance criteria: transition is blocked until required gates pass and HR prompt is resolved for governed stages.
- Failure policy `Stop + Diagnose`.
  - Acceptance criteria: on gate failure or critical integration failure, execution halts, writes diagnostics, and suggests concrete remediation path.
- Hybrid artifact structure per feature and stage.
  - Acceptance criteria: artifacts stored under `workflow/features/<feature-id>/<stage-id>/*` with stable naming conventions.
- Minimal machine-readable workflow state.
  - Acceptance criteria: `workflow/state/workflow_state.json` always includes current stage, approval states, artifact paths, gate status, and timestamps.
- Git as source of version history for all artifacts.
  - Acceptance criteria: no mandatory internal revision system is required for stage artifacts.
- Skills system with manual customization.
  - Acceptance criteria: workflow resolves skills from global and repo-local locations; if skill names collide, user selects interactively.
- Task ABI passport for SDD execution.
  - Acceptance criteria: each executable task has YAML passport validated by schema; required fields include goal, inputs, outputs, allowed tools, gates, and DoD.
- Tooling mini-workflow in stage 7.
  - Acceptance criteria: stage 7 executes 7.1 stack inference, 7.2 web research, 7.3 setup synthesis, 7.4 capability check, 7.5 HR review in order.
- SDD + TDD execution model.
  - Acceptance criteria: implementation stage dispatches subagents by task passports and enforces test-first task flow where applicable.
- QA and debug governance.
  - Acceptance criteria: stage 13 executes smoke + critical-path localhost QA; stage 14 runs bounded debug loop policy and records each iteration.
- Service commands for control and recovery.
  - Acceptance criteria: `/wf.status`, `/wf.resume`, `/wf.gates`, `/wf.history`, `/wf.approve <stage>`, `/wf.reject <stage>` operate against state file and artifacts.

### Should Have (P1)
- Dual-channel update model for upstream templates/skills (`stable` and `update`).
  - Acceptance criteria: runtime uses pinned stable set by default; update channel can pull latest and run capability checks before promotion.
- Adaptive subagent concurrency.
  - Acceptance criteria: dispatcher can vary parallelism by task risk and file conflict profile.
- Optional GitHub integration (`gh`) for review and PR workflows.
  - Acceptance criteria: if configured, review and branch-finalization stages can publish PR metadata.

### Nice to Have (P2)
- Optional CI mirror of local gates.
  - Acceptance criteria: same gate definitions can run in CI without changing task passports.
- Visual architecture diagrams generation from architecture artifacts.
  - Acceptance criteria: stage 3 can render diagrams from structured architecture source.
- Metrics dashboard for stage performance trends.
  - Acceptance criteria: reads run logs and outputs summary trends without changing core workflow semantics.

## Technical Architecture
### Data Model
- `FeatureRun`
  - Fields: `feature_id`, `title`, `created_at`, `status`, `current_stage`.
- `StageExecution`
  - Fields: `stage_id`, `command`, `started_at`, `finished_at`, `result`, `diagnostics_path`.
- `ArtifactRecord`
  - Fields: `stage_id`, `artifact_type`, `path`, `checksum`, `generated_at`.
- `ApprovalRecord`
  - Fields: `stage_id`, `decision`, `reviewer`, `timestamp`, `notes`.
- `GateResult`
  - Fields: `stage_id`, `gate_name`, `status`, `evidence_path`, `timestamp`.
- `TaskPassport`
  - Fields: `task_id`, `goal`, `inputs`, `outputs`, `allowed_tools`, `gates`, `dod`, `owner_agent`.

### System Components
- Slash Command Router: resolves `/wf.*` commands to stage handlers.
- Stage Orchestrator (thin TS runtime): executes stage lifecycle, writes state, enforces transition rules.
- Skill Resolver: loads global and local skills, supports interactive conflict resolution.
- Artifact Manager: standardizes artifact paths and metadata.
- Gate Engine: runs required checks per stage and blocks transitions on failure.
- HR Prompt Manager: handles interactive approvals and rejection reasons.
- Research Adapter: executes web research when required by stage logic.
- SDD Dispatcher: assigns ABI-defined tasks to subagents with adaptive parallelism.
- QA/Debug Orchestrator: runs human QA flow and bounded debug loops.
- Reporting Engine: produces stage reports, project report, and final executive report.

### Integrations
- OpenCode slash commands and skill system (primary runtime environment).
- Local Git for version tracking and rollback support.
- GitHub CLI (`gh`) for optional review/PR integration.
- Web research providers for evidence-first decisions in tooling and architecture phases.
- Local test and quality tools (language-specific runners, linters, format/lint checks).

### Security Model
- Local-first execution; no mandatory external SaaS dependency.
- External credentials handled via environment variables by default, with interactive fallback when needed.
- Secret scanning is mandatory before commit/finalization gates.
- Risky/destructive operations use `warn then allow` policy with explicit user confirmation and logged decision.
- No formal compliance framework in V1; apply practical best practices only.

## Non-Functional Requirements
- Performance: stage command acknowledges and begins execution feedback within 15 seconds in normal local conditions.
- Scalability: supports current load (1-3 full runs/day) with headroom to 10 runs/day without architectural changes.
- Reliability: interruption-safe execution via persisted state and artifacts; `/wf.resume` continues from the last valid checkpoint.
- Security: local-first data handling, pre-commit secret checks, explicit confirmation for risky operations.

## Out of Scope
- Enterprise-grade multi-tenant access control and formal RBAC.
- Mandatory cloud orchestration service.
- Full compliance automation (GDPR/SOC2/HIPAA workflows).
- Replacing Git as the source of truth for artifact history.
- Fully autonomous stage progression without human checkpoints.

## Open Questions for Implementation
- No blocking discovery questions remain.
- Non-blocking implementation choices to finalize during build:
  - Exact schema validation library for YAML task passports.
  - Exact diagnostics payload format for failed gate evidence.
  - Optional visualization format for architecture diagrams.

## Appendix: Research Findings
- Spec-Kit contributes a mature slash-command and artifact-template pattern (`specify/plan/tasks/implement`) that maps well to deterministic stage outputs.
- Superpowers contributes high-value skill methodology for brainstorming, planning, subagent-driven development, TDD discipline, and code review checkpoints.
- CodeMachine contributes orchestration concepts such as controller-driven execution, pause/resume, and long-running workflow state handling.
- Upstream volatility exists, including large release-to-release architectural shifts (notably in workflow runtime internals and OpenCode integration patterns).
- Decision derived from findings:
  - Build a lightweight custom core runtime for OpenCode.
  - Reuse patterns and templates from OSS sources without hard coupling to their internal runtimes.
  - Adopt dual-channel update policy: `stable` pinned defaults plus `update` channel with capability checks before promotion.
