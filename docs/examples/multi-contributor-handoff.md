# Example: Multi-Contributor Handoff

## Scenario

One person owns the workflow direction, while another person or agent executes implementation-heavy stages.

Example outcome:
- clean separation of ownership;
- explicit approvals;
- less ambiguity during handoffs.

## Recommended Path

```text
/wf.discover
/wf.arch
/wf.spec
/wf.plan
/wf.tasks
/wf.dispatch
/wf.implement
/wf.review
/wf.project-report
/wf.human-qa
/wf.finish-report
```

## Why This Path

- The owner can front-load intent and constraints.
- The implementer receives bounded work through dispatch + task passports.
- Review and QA become shared checkpoints instead of assumptions.

## Suggested Role Split

- Owner: discover, arch, spec, plan approvals
- Implementer: dispatch, implement, first-pass review notes
- Owner: approve/reject, QA, finish report

## Key Artifacts

- approved scope;
- task passports with explicit boundaries;
- handoff note for implementer;
- review summary with open questions;
- final owner sign-off.

## Good Fit

- Human + coding-agent collaboration
- Maintainer + contributor workflows
- Multi-stage execution with approval gates
