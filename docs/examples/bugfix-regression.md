# Example: Bugfix Regression Workflow

## Scenario

A previously working command or flow is now broken after a recent change.

Example outcome:
- reproduce the issue;
- isolate the cause;
- implement the smallest safe fix;
- verify no new breakage was introduced.

## Recommended Path

```text
/wf.discover
/wf.spike
/wf.spec
/wf.plan
/wf.tasks
/wf.dispatch
/wf.implement
/wf.review
/wf.human-qa
/wf.debug
/wf.finish-report
```

## Why This Path

- Regression work needs clarity more than breadth.
- Architecture may be skipped if the fix does not change structure.
- Debug remains explicit because bugfixes often loop after review.

## Key Artifacts

- reproduction steps;
- expected vs actual behavior;
- root-cause note;
- narrow fix plan;
- verification checklist;
- regression test idea or manual test script.

## HR Checkpoints

Recommended when risk is medium/high:
- `/wf.spec`
- `/wf.plan`
- `/wf.tasks`

## Good Fit

- Broken commands
- Failed integrations
- Post-release regressions
