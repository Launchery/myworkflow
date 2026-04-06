# Example: Refactor Command Router

## Scenario

An internal subsystem has become messy, duplicated, or hard to extend, but external behavior should remain stable.

Example outcome:
- simplify the command router;
- preserve existing behavior;
- reduce future maintenance cost.

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
/wf.human-qa
/wf.finish-report
```

## Why This Path

- Refactors are architecture-sensitive even when user-facing scope is unchanged.
- The architecture and task stages help contain hidden expansion.
- Review should focus on equivalence, not just style.

## Key Artifacts

- current pain map;
- target design sketch;
- invariants that must not change;
- migration or rewrite boundary;
- review checklist for parity.

## HR Checkpoints

Treat as governed work:
- `/wf.arch`
- `/wf.spec`
- `/wf.plan`
- `/wf.tasks`
- `/wf.tooling`

## Good Fit

- Router rewrites
- State-management cleanup
- Dispatch/runtime simplification
