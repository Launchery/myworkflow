---
name: wf-spec
description: "Stage 4: Specification -- detailed spec with acceptance criteria (HR approval required)"
user-invocable: false
---

# Stage 4: Specification

You are executing the Specification stage of the workflow. Your goal is to convert discovery, spike, and architecture outputs into a detailed, testable specification that can drive planning and implementation.

This is a GOVERNED stage. HR (human review) approval is required before moving to the next stage.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read` to get current workflow state.
2. Call `wf_state_write` with action `"start"` for stage `"spec"`.
3. Read prior artifacts:
   - `workflow/features/<feature-id>/discover/project-concept.md`
   - `workflow/features/<feature-id>/spike/spike-report.md`
   - `workflow/features/<feature-id>/arch/architecture.md`
   - `workflow/features/<feature-id>/arch/decisions.md`
4. Create stage directory: `workflow/features/<feature-id>/spec/`.

If required upstream artifacts are missing, STOP and explain exactly what is missing.

### Step 2: Synthesize Inputs

Before writing the spec, summarize what is fixed versus still flexible.

Create a short synthesis for the user:
- Confirmed constraints from spike.
- Architecture decisions that are now binding.
- Core outcomes from discovery.
- Open design choices still allowed at implementation time.

Ask for confirmation before writing the final specification structure.

### Step 3: Draft Functional Requirements

Define requirements as explicit, testable units.

For each requirement include:
- ID: `FR-XXX`
- Priority: `P0`, `P1`, or `P2`
- Description: what the system must do
- Acceptance Criteria: concrete checks in Given/When/Then style
- Dependencies: other FR IDs if applicable

Rules:
- Every P0 requirement must be necessary for first usable release.
- Avoid vague terms like "fast" or "user-friendly" without measurable criteria.
- If a requirement cannot be tested, rewrite it.

### Step 4: Draft Non-Functional Requirements

Define NFRs as measurable targets.

For each NFR include:
- ID: `NFR-XXX`
- Category: performance, reliability, security, scalability, observability, usability
- Target metric: numeric or binary target
- Verification method: how it will be validated

Examples of acceptable NFR wording:
- "95th percentile API latency <= 300ms for read endpoints under baseline load."
- "All secrets are read from environment variables; none are hardcoded in repository files."

### Step 5: Define Data, API, Errors, and Security

Include dedicated sections:

1. Data Model
   - entities, key fields, relationships, and constraints
   - ownership and lifecycle of critical data

2. API Contracts (if applicable)
   - endpoints or operations
   - request/response shapes
   - error codes and behavior

3. Error Handling
   - error categories and expected system behavior
   - user-facing message strategy
   - recoverable vs non-recoverable flows

4. Security Requirements
   - authentication and authorization model
   - sensitive data controls
   - audit and logging expectations

### Step 6: Write Artifact

Write `workflow/features/<feature-id>/spec/specification.md` with this structure:

```markdown
# <Project Name> Specification

## Scope and Context
[Short summary linking concept, spike, and architecture]

## Functional Requirements

### P0 Must Have
#### FR-001: <name>
- Description:
- Acceptance Criteria:
  - Given ..., When ..., Then ...
- Dependencies:

### P1 Should Have
...

### P2 Nice to Have
...

## Non-Functional Requirements
#### NFR-001: <name>
- Category:
- Target:
- Verification:

## Data Model
[Entities and relationships]

## API Contracts
[If applicable]

## Error Handling
[Expected error behavior]

## Security Requirements
[AuthN, AuthZ, secret and data handling]

## Out of Scope
[Explicitly excluded items]

## Traceability
| Source | Requirement IDs |
|--------|-----------------|
| discovery | ... |
| spike | ... |
| architecture decisions | ... |
```

### Step 7: Gates

Run and record these stage gates:

1. `spec-completeness`
   - PASS if all required sections are present and non-empty.

2. `acceptance-criteria-quality`
   - PASS if every FR has testable acceptance criteria.

3. `architecture-alignment`
   - PASS if no FR/NFR contradicts approved architecture decisions.

Record each via `wf_gate_record`.

### Step 8: Register Artifact

Call `wf_artifact_register`:
- artifact type: `specification`
- path: `workflow/features/<feature-id>/spec/specification.md`

### Step 9: HR Checkpoint (Mandatory)

Present a concise summary to the user:
- total FR count by priority
- total NFR count by category
- major constraints and tradeoffs
- any unresolved items

Ask explicitly:

"Do you approve this specification?"
- Approve
- Reject (with required changes)

If approved:
1. Call `wf_hr_record` with decision `"approved"` for stage `"spec"`.
2. Call `wf_state_write` with action `"complete"` for stage `"spec"`.
3. Tell user: "Specification approved. Next: run `/wf.plan`."

If rejected:
1. Ask for concrete revision points.
2. Update specification artifact.
3. Re-run gates.
4. Re-present for approval.
5. Do not complete stage until approved.

### Quality Rules

- Do not proceed with ambiguous requirements.
- Do not invent architecture outside approved ADR decisions.
- Keep language implementation-ready, not aspirational.
- Favor explicit constraints over generic statements.
