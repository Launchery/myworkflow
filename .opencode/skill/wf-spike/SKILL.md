---
name: wf-spike
description: "Stage 2: Spike — validate key technical assumptions and produce spike-report.md"
user-invocable: false
---

# Stage 2: Spike

You are executing the Spike stage of the workflow. Your goal is to validate key technical assumptions and risks identified during discovery, producing a spike report with evidence-backed conclusions.

**Every assumption is guilty until proven innocent.** Don't assume things will work — verify them.

## Protocol

### Step 1: Initialize

1. Call `wf_state_read` to get current workflow state
2. Call `wf_state_write` with action `"start"` for stage `"spike"`
3. Read the project concept from `workflow/features/<feature-id>/discover/project-concept.md`
4. Create directory: `workflow/features/<feature-id>/spike/`

### Step 2: Identify Technical Risks

Analyze the project concept systematically. Extract and categorize risks into five areas:

#### 2.1 Critical Assumptions
Things that MUST be true for the project to work. Examples:
- "The external API supports the operations we need"
- "This library exists and is maintained"
- "The data volume fits in the chosen storage"
- "The chosen framework supports our auth model"

#### 2.2 Unknown Technologies
Tools, frameworks, or platforms the project needs but haven't been proven in this context:
- New language/framework the team hasn't used
- Unfamiliar cloud services or APIs
- Novel architectural patterns

#### 2.3 Integration Risks
External systems that might not work as expected:
- Third-party API limitations (rate limits, missing endpoints, auth complexity)
- Data format mismatches between systems
- Version compatibility between dependencies
- Network/latency constraints

#### 2.4 Performance Concerns
Areas where performance could be a blocker:
- Data processing volume exceeding expectations
- Real-time requirements vs. actual achievable latency
- Memory/storage constraints
- Concurrent user load

#### 2.5 Complexity Hotspots
Areas where complexity could spiral out of control:
- State management with many edge cases
- Complex business rules or validation logic
- Multi-system coordination / distributed transactions
- Migration or backward compatibility requirements

### Step 3: Prioritize Risks

Present all identified risks to the user in a structured table:

```
| # | Risk | Category | Priority | Rationale |
|---|------|----------|----------|-----------|
| 1 | ... | Integration | HIGH | Could kill the project |
| 2 | ... | Performance | MEDIUM | Could cause significant rework |
| 3 | ... | Technology | LOW | Minor impact if wrong |
```

Priority definitions:
- **HIGH**: Must validate before proceeding. Failure here could kill the project or require fundamental redesign.
- **MEDIUM**: Should validate. Failure would cause significant rework but project could survive.
- **LOW**: Nice to validate. Failure would cause minor adjustments.

Ask the user:
- "Do you see any risks I missed?"
- "Do you agree with the prioritization?"
- "Any risks you want me to skip or add?"

Adjust based on feedback.

### Step 4: Conduct Spike Experiments

For each **HIGH** and **MEDIUM** risk (in priority order):

#### 4.1 Formulate Hypothesis
State it clearly:
> "We believe [X] because [Y]. We will validate by [Z]. Success looks like [criteria]. Failure looks like [criteria]."

#### 4.2 Design Minimal Experiment
Choose the lightest possible validation:
- **API/Integration check**: Use WebFetch to hit the API, check docs, verify endpoints exist
- **Library validation**: Check package exists, is maintained, has needed features, check version compatibility
- **Performance estimate**: Back-of-envelope calculation, or write a minimal benchmark
- **Prototype code**: Write the MINIMAL code that proves/disproves the assumption (10-30 lines max)
- **Documentation review**: Read official docs to confirm capability claims
- **Version/compatibility check**: Run version checks, dependency resolution

#### 4.3 Execute Experiment
- Use WebFetch for API docs, technology research, compatibility checks
- Use Bash to run version checks, install test packages, run minimal scripts
- Write throwaway prototype code ONLY if needed (keep in `workflow/features/<feature-id>/spike/experiments/`)
- Time-box: spend no more than **5-10 minutes per experiment**

#### 4.4 Record Result
For each experiment, document:
- **Hypothesis**: What we tested
- **Approach**: What we did
- **Result**: Confirmed / Rejected / Partially Confirmed
- **Evidence**: Specific output, docs quote, or code result
- **Implications**: What this means for the architecture

#### 4.5 Handle Failures
If an experiment REJECTS a hypothesis:
1. Don't panic — this is the whole point of spiking
2. Identify alternatives immediately
3. If an alternative exists, test it (quick follow-up spike)
4. If no alternative exists, flag as a project risk
5. Discuss with the user: "This assumption failed. Here are our options..."

### Step 5: Discovery of New Risks

During experiments, watch for NEW risks that weren't in the original concept:
- Unexpected API limitations discovered during testing
- Version conflicts between dependencies
- Missing features in chosen libraries
- Performance characteristics worse than expected
- Security concerns not previously identified

Document all new findings — they feed into the architecture stage.

### Step 6: Synthesize Findings

Write `spike-report.md` to `workflow/features/<feature-id>/spike/spike-report.md`:

```markdown
# Spike Report

## Summary
[2-3 sentences: overall assessment. Are we good to proceed? Any fundamental changes needed?]

## Overall Recommendation
[One of: Proceed | Proceed with Caution | Significant Redesign Needed | Stop]

## Risks Analyzed

| # | Risk | Priority | Hypothesis | Result | Impact |
|---|------|----------|-----------|--------|--------|
| 1 | ... | HIGH | ... | Confirmed | None — proceed as planned |
| 2 | ... | HIGH | ... | Rejected | Must use alternative approach |
| 3 | ... | MEDIUM | ... | Confirmed | None |

## Validated Assumptions
[List of things we confirmed work, with evidence summaries]

## Rejected Assumptions
[List of things that didn't work, what we'll do instead, and why the alternative is viable]

## New Risks Discovered
[Anything found during spikes that wasn't in the original concept]

## Skipped Risks
[LOW priority risks not spiked, with rationale for skipping]

## Experiments Conducted

### Experiment 1: [Name]
- **Hypothesis**: [What we believed and why]
- **Approach**: [What we did to test]
- **Result**: [Confirmed/Rejected/Partial]
- **Evidence**: [Specific output, quotes, measurements]
- **Implications**: [What this means for the project]

### Experiment 2: [Name]
...

## Impact on Architecture
[How spike findings should influence architectural decisions. Specific constraints or requirements discovered.]

## Open Items
[Anything that couldn't be fully validated and needs monitoring during implementation]
```

### Step 7: Register and Complete

1. Call `wf_artifact_register` with:
   - artifact: `spike-report.md`
   - path: `workflow/features/<feature-id>/spike/spike-report.md`
   - type: `spike-report`
2. If any experiment code was written, call `wf_artifact_register` for experiments directory
3. Call `wf_gate_record` with gate `"spike-validation"`:
   - `"passed"` if all HIGH risks are confirmed or have viable alternatives
   - `"failed"` if any HIGH risk is rejected with no alternative
4. Call `wf_state_write` with action `"complete"` for stage `"spike"`
5. Tell the user: **"Spike complete. Technical assumptions have been validated. Next: invoke the Architecture stage to design the system."**

If the gate FAILS (unresolvable HIGH risk):
- Explain clearly what failed and why
- Present options: redesign the approach, descope the feature, or abandon
- If the user wants to redesign, call `wf_state_write` with action `"fail"` for stage `"spike"` and recommend returning to Discovery with new constraints
