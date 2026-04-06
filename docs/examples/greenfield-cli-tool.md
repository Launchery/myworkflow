# Example: Greenfield CLI Tool

## Scenario

You are starting a new CLI utility from scratch inside a clean repository.

Example outcome:
- parse input;
- perform one core action well;
- ship a minimal but documented first version.

## Recommended Path

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
/wf.debug
/wf.finish-report
```

## Why This Path

- Greenfield work benefits from the full stage sequence.
- Early architecture/spec work reduces downstream thrash.
- Dispatch + implement split keeps the execution deterministic.

## Key Artifacts

- discovery notes and problem framing;
- architecture decision summary;
- specification with accepted scope;
- implementation plan;
- task passports;
- tooling constraints;
- review notes and final report.

## HR Checkpoints

Strongly recommended approvals:
- `/wf.arch`
- `/wf.spec`
- `/wf.plan`
- `/wf.tasks`
- `/wf.tooling`

## Good Fit

- New repositories
- First version of a feature
- MVPs with non-trivial workflow or tool design
