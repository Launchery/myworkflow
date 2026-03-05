---
name: wf-arch
description: "Stage 3: Architecture — design system architecture with HR approval gate"
user-invocable: false
---

# Stage 3: Architecture

You are executing the Architecture stage of the workflow. Your goal is to design the system architecture based on the project concept and spike findings, then get explicit human approval before the project proceeds to specification.

**This is a GOVERNED stage — HR (human review) approval is REQUIRED before completing.**

## Protocol

### Step 1: Initialize

1. Call `wf_state_read` to get current workflow state
2. Call `wf_state_write` with action `"start"` for stage `"arch"`
3. Read prior artifacts:
   - `workflow/features/<feature-id>/discover/project-concept.md`
   - `workflow/features/<feature-id>/spike/spike-report.md`
4. Create directory: `workflow/features/<feature-id>/arch/`

Verify both artifacts exist and are readable. If either is missing, STOP and report the error — do not proceed without prior stage outputs.

### Step 2: Analyze Inputs

Before designing, synthesize what you know:

1. **From project concept**: Extract requirements, constraints, user journey, data needs, security model
2. **From spike report**: Extract validated assumptions, rejected assumptions (with alternatives), new risks, performance data
3. **Identify constraints**: What MUST the architecture accommodate based on spike findings?
4. **Note open questions**: What wasn't fully resolved in the spike?

Present a brief synthesis to the user:
> "Based on discovery and spike results, here's what I'm working with:
> - Core requirements: [list]
> - Confirmed technical approach: [from spike]
> - Constraints from spike: [what we learned]
> - Open items to resolve in architecture: [list]
>
> Does this match your understanding?"

### Step 3: Design Architecture

Design the following sections. For each major decision, consider at least 2 alternatives and document why you chose one over another.

#### 3.1 System Overview

- **Component diagram** (described in text — list all major components and their relationships)
- **Component responsibilities**: What each component does and doesn't do (clear boundaries)
- **Component interactions**: How components communicate (sync/async, protocols, data formats)
- **Data flow**: End-to-end flow for the core user journey

Keep it as simple as possible. Every component must justify its existence.

#### 3.2 Data Architecture

- **Data model**: Entities, their attributes, relationships, and cardinality
- **Storage strategy**: Database type(s) and rationale. Consider:
  - Relational vs. document vs. key-value vs. graph
  - Single DB vs. polyglot persistence
  - Caching layer (if needed)
  - File/blob storage (if needed)
- **Data flow**: How data moves through the system — ingestion, processing, storage, retrieval, output
- **Data lifecycle**: Creation, updates, archival, deletion
- **Migration strategy**: How schema changes will be handled

#### 3.3 API Design (if applicable)

- **Endpoint structure**: RESTful paths, GraphQL schema, or RPC definitions
- **Naming conventions**: Consistent naming patterns
- **Request/response formats**: Payload structures for core operations
- **Pagination strategy**: For list endpoints
- **Error handling conventions**: Error response format, error codes, user-facing messages
- **Versioning strategy**: How the API will evolve
- **Rate limiting**: If needed

#### 3.4 Security Architecture

- **Authentication mechanism**: How users prove identity (JWT, sessions, OAuth, API keys, etc.)
- **Authorization model**: How permissions work (RBAC, ABAC, resource-based, etc.)
- **Data protection**:
  - Encryption at rest (what, how)
  - Encryption in transit (TLS, certificate management)
- **Input validation strategy**: Where and how inputs are validated
- **Secret management**: How secrets/keys are stored and accessed
- **Audit logging**: What actions are logged, retention policy
- **OWASP top 10**: Brief assessment of relevant risks

#### 3.5 Infrastructure & Deployment

- **Runtime environment**: Where the code runs (cloud provider, containers, serverless, bare metal)
- **Deployment strategy**: How code gets from repo to production (CI/CD pipeline, blue-green, canary, etc.)
- **Scaling approach**: Horizontal vs. vertical, auto-scaling triggers
- **Environment strategy**: Dev, staging, production — what differs between them
- **Monitoring and observability**:
  - Metrics to track
  - Logging strategy
  - Alerting rules
  - Distributed tracing (if applicable)
- **Backup and disaster recovery**: Backup frequency, RTO, RPO

#### 3.6 Error Handling & Resilience

- **Failure modes**: What can go wrong at each integration point
- **Retry strategy**: What's retried, with what backoff
- **Circuit breakers**: Where and when to stop trying
- **Graceful degradation**: What works when dependencies fail
- **Timeout strategy**: Timeout values for each external call

### Step 4: Architecture Decision Records

For each significant architectural decision, create an ADR. A "significant decision" is one where:
- Multiple viable alternatives exist
- The decision is hard to reverse
- The decision has broad impact on the system
- The spike findings constrained the options

ADR format:

```markdown
## ADR-N: [Title]

**Status:** Proposed
**Context:** [Why this decision is needed — what problem or constraint drives it]
**Decision:** [What we decided and why this option wins]
**Alternatives Considered:**
- [Alternative 1]: [Description] — Rejected because [reason]
- [Alternative 2]: [Description] — Rejected because [reason]
**Consequences:**
- Positive: [What we gain]
- Negative: [What we lose or accept as tradeoff]
- Risks: [What could go wrong with this decision]
**Spike Evidence:** [Reference to spike experiment that informed this, if any]
```

Aim for 3-8 ADRs for a typical project. More is fine for complex systems.

### Step 5: Write Artifacts

Write TWO files to `workflow/features/<feature-id>/arch/`:

**File 1: `architecture.md`**
Contains all sections from Step 3:
- System Overview
- Data Architecture
- API Design
- Security Architecture
- Infrastructure & Deployment
- Error Handling & Resilience

**File 2: `decisions.md`**
Contains all ADRs from Step 4, collected in one file with a table of contents:
```markdown
# Architecture Decision Records

## Index
| ADR | Title | Status |
|-----|-------|--------|
| ADR-1 | ... | Proposed |
| ADR-2 | ... | Proposed |

## Decisions

### ADR-1: [Title]
...

### ADR-2: [Title]
...
```

### Step 6: Gates

Run gate checks to verify quality:

1. Call `wf_gate_record` with gate `"architecture-completeness"`:
   - Verify ALL sections from Step 3 are addressed (even if some say "N/A — not applicable because...")
   - Every requirement from the concept must map to an architectural decision
   - Status: `"passed"` if complete, `"failed"` if gaps exist

2. Call `wf_gate_record` with gate `"spike-alignment"`:
   - Verify the architecture respects ALL spike findings
   - Rejected assumptions must NOT appear as architectural choices
   - Validated assumptions should be reflected in the design
   - New risks from spike must be addressed
   - Status: `"passed"` if aligned, `"failed"` if contradictions exist

3. Call `wf_artifact_register` for both `architecture.md` and `decisions.md`

If any gate FAILS, fix the issue before proceeding to HR checkpoint. Do not present incomplete or misaligned architecture for review.

### Step 7: HR Checkpoint (Human Review)

**This step is mandatory. Architecture cannot complete without explicit human approval.**

Present the architecture to the user for review:

1. **Summary presentation** — Don't dump the whole doc. Instead, present:
   ```
   "Here's the architecture I've designed:

   **Components**: [Brief list of major components and their roles]

   **Key Decisions**:
   1. [ADR-1 title]: [One-line summary of decision and why]
   2. [ADR-2 title]: [One-line summary of decision and why]
   3. [ADR-3 title]: [One-line summary of decision and why]

   **Trade-offs accepted**:
   - [Trade-off 1 and its rationale]
   - [Trade-off 2 and its rationale]

   **Risks to monitor**:
   - [Risk 1]
   - [Risk 2]

   The full architecture document is at: workflow/features/<feature-id>/arch/architecture.md
   The decision records are at: workflow/features/<feature-id>/arch/decisions.md

   **Do you approve this architecture?**
   - Approve: proceed to specification
   - Reject: tell me what to change"
   ```

2. **Handle response**:

   **If APPROVED:**
   - Call `wf_hr_record` with decision `"approved"`, stage `"arch"`
   - Call `wf_state_write` with action `"complete"` for stage `"arch"`
   - Tell the user: **"Architecture approved and locked. Next: invoke the Specification stage to create the detailed spec."**

   **If REJECTED:**
   - Ask for specific feedback: "What needs to change? Please be specific about which decisions or sections you disagree with."
   - Revise the relevant sections of `architecture.md` and/or `decisions.md`
   - Update affected ADRs (change status to "Superseded" for old decision, create new ADR)
   - Re-run gates (Step 6)
   - Re-present for approval (repeat Step 7)
   - There is no limit on revision cycles — keep going until approved

   **If PARTIALLY APPROVED:**
   - Treat as rejection — get specific feedback and revise
   - Do not proceed with known objections

### Important Notes

- **Simplicity over cleverness**: Prefer boring, proven architectures. Every layer of abstraction must earn its place.
- **Spike findings are hard constraints**: If the spike proved something doesn't work, the architecture MUST NOT rely on it.
- **Trace requirements**: Every P0 requirement from the concept must be clearly supported by the architecture. If a requirement can't be supported, flag it.
- **No premature optimization**: Design for current scale with a clear path to future scale. Don't build for 10M users on day one.
- **Security by default**: Security is not a feature to add later. Bake it into the architecture from the start.
- **Document the WHY**: Decisions without rationale are useless. Always explain why, not just what.
