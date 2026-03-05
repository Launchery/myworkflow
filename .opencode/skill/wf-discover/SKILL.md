---
name: wf-discover
description: "Stage 1: Discovery — deep interview to produce project-concept.md"
user-invocable: false
---

# Stage 1: Discovery

You are executing the Discovery stage of the workflow. Your goal is to deeply understand the user's idea and produce a comprehensive project concept document.

**Don't ask obvious questions. Don't accept surface answers. Don't assume knowledge.**

Your job is to:
1. Deeply understand what the user *actually* wants (not what they say)
2. Detect knowledge gaps and educate when needed
3. Surface hidden assumptions and tradeoffs
4. Research when uncertainty exists
5. Only write the concept when you have complete understanding

## Protocol

### Step 1: Initialize

1. Call `wf_state_read` to check current workflow state
2. If no active feature exists, ask the user for a project title and call `wf_feature_init`
3. Call `wf_state_write` with action `"start"` for stage `"discover"`
4. Create the stage directory: `workflow/features/<feature-id>/discover/`

### Step 2: Deep Discovery Interview

Conduct a thorough discovery interview following this process:

#### Phase 1: Initial Orientation (2-3 questions max)

Start broad to understand the shape of the idea:
- "In one sentence, what problem are you trying to solve?"
- "Who will use this? (End users, developers, internal team, etc.)"
- "Is this a new thing or improving something existing?"

Based on answers, determine the **PROJECT TYPE**:
- **Backend service/API** -> Focus: data, scaling, integrations
- **Frontend/Web app** -> Focus: UX, state, responsiveness
- **CLI tool** -> Focus: ergonomics, composability, output formats
- **Full-stack app** -> Focus: all of above
- **Script/Automation** -> Focus: triggers, reliability, idempotency
- **Library/SDK** -> Focus: API design, docs, versioning

#### Phase 2: Category-by-Category Deep Dive

Work through relevant categories IN ORDER. For each category:

1. **Ask 2-4 questions** (one at a time)
2. **Detect uncertainty** — if user seems unsure, offer research
3. **Educate when needed** — don't let them make uninformed decisions
4. **Track decisions** — maintain your internal state of what's been resolved

**Category A: Problem & Goals**
- What's the current pain point? How do people solve it today?
- What does success look like? How will you measure it?
- Who are the stakeholders beyond end users?
- What happens if this doesn't get built?

Knowledge gap signals: User can't articulate the problem clearly, or describes a solution instead of a problem.

**Category B: User Experience & Journey**
- Walk me through: a user opens this for the first time. What do they see? What do they do?
- What's the core action? (The one thing users MUST be able to do)
- What errors can happen? What should users see when things go wrong?
- How technical are your users? (Power users vs. novices)

Knowledge gap signals: User hasn't thought through the actual flow, or describes features instead of journeys.

**Category C: Data & State**
- What information needs to be stored? Temporarily or permanently?
- Where does data come from? Where does it go?
- Who owns the data? Are there privacy/compliance concerns?
- What happens to existing data if requirements change?

Knowledge gap signals: User says "just a database" without understanding schema implications.

**Category D: Technical Landscape**
- What existing systems does this need to work with?
- Are there technology constraints? (Language, framework, platform)
- What's the deployment environment? (Cloud, on-prem, edge)
- What's the team's technical expertise?

Research triggers:
- "I've heard X is good" -> Research X vs alternatives
- "We use Y but I'm not sure if..." -> Research Y capabilities
- Technology mismatch detected -> Research correct approaches

**Category E: Scale & Performance**
- How many users/requests do you expect? (Now vs. future)
- What response times are acceptable?
- What happens during traffic spikes?
- Is this read-heavy, write-heavy, or balanced?

Knowledge gap signals: User says "millions of users" without understanding infrastructure implications.

**Category F: Integrations & Dependencies**
- What external services does this need to talk to?
- What APIs need to be consumed? Created?
- Are there third-party dependencies? What's the fallback if they fail?
- What authentication/authorization is needed for integrations?

Knowledge gap signals: User assumes integrations are simple without understanding rate limits, auth, failure modes.

**Category G: Security & Access Control**
- Who should be able to do what?
- What data is sensitive? PII? Financial? Health?
- Are there compliance requirements? (GDPR, HIPAA, SOC2)
- How do users authenticate?

Knowledge gap signals: User says "just basic login" without understanding security implications.

**Category H: Deployment & Operations**
- How will this be deployed? By whom?
- What monitoring/alerting is needed?
- How do you handle updates? Rollbacks?
- What's your disaster recovery plan?

Knowledge gap signals: User hasn't thought about ops, or assumes "it just runs".

#### Phase 3: Research Loops

When you detect uncertainty or knowledge gaps:

1. Offer to research: "You mentioned wanting real-time updates. There are several approaches with different tradeoffs. Would you like me to research this before we continue?"
2. If user agrees, use WebFetch to gather relevant information
3. Summarize findings in plain language
4. Return with INFORMED follow-up questions

Example research loop:
```
User: "I want real-time updates"
You: [Research WebSockets vs SSE vs Polling vs WebRTC]
You: "I researched real-time options. Here's what I found:
     - WebSockets: Best for bidirectional, but requires sticky sessions
     - SSE: Simpler, unidirectional, works with load balancers
     - Polling: Easiest but wasteful and not truly real-time

     Given your scale expectations of 10k users, SSE would likely work well.
     But I have a follow-up: Do users need to SEND real-time data, or just receive it?"
```

#### Phase 4: Conflict Resolution

When you discover conflicts or impossible requirements:

1. Surface the conflict explicitly: "I noticed a potential conflict: You want [X] but also [Y]. These typically don't work together because [reason]."
2. Present options with trade-offs
3. Get user's prioritization decision

Common conflicts to watch for:
- "Simple AND feature-rich"
- "Real-time AND cheap infrastructure"
- "Highly secure AND frictionless UX"
- "Flexible AND performant"
- "Fast to build AND future-proof"

#### Phase 5: Completeness Check

Before writing the concept, verify you have answers for:

```
Problem Definition:
- [ ] Clear problem statement
- [ ] Success metrics defined
- [ ] Stakeholders identified

User Experience:
- [ ] User journey mapped
- [ ] Core actions defined
- [ ] Error states handled
- [ ] Edge cases considered

Technical Design:
- [ ] Data model understood
- [ ] Integrations specified
- [ ] Scale requirements clear
- [ ] Security model defined
- [ ] Deployment approach chosen

Decisions Made:
- [ ] All tradeoffs explicitly chosen
- [ ] No "TBD" items remaining
- [ ] User confirmed understanding
```

If anything is missing, GO BACK and ask more questions. Do NOT proceed with gaps.

**Interview Rules:**
- Ask ONE question at a time
- Prefer multiple-choice when possible (always include "I'm not sure" / "Research this" options)
- Minimum 10-15 questions across categories for any real project
- At least 2 questions per relevant category
- At least 1 research loop for non-trivial projects
- Always do the completeness check before writing

**Handling Different User Types:**

| User Type | Approach |
|-----------|----------|
| Technical | Skip basic education, focus on tradeoffs and assumptions |
| Non-technical | Use analogies, offer more research, don't overwhelm |
| In a hurry | Prioritize core UX + data model, note gaps as risks |

**Detecting Knowledge Gaps:**

| Signal | What to do |
|--------|------------|
| "I think..." or "Maybe..." | Probe deeper, offer research |
| "That sounds good" (to your suggestion) | Verify they understand implications |
| "Just simple/basic X" | Challenge — define what simple means |
| Technology buzzwords without context | Ask what they think it does |
| Conflicting requirements | Surface the conflict explicitly |
| "Whatever is standard" | Explain there's no universal standard |
| Long pauses / short answers | They might be overwhelmed — simplify |

### Step 3: Generate Project Concept

After the completeness check passes:

1. **Summarize understanding** and confirm with user:
   ```
   "Before I write the concept document, let me confirm my understanding:

   You're building [X] for [users] to solve [problem].
   The core experience is [journey].
   Key decisions:
   - [Decision 1 with rationale]
   - [Decision 2 with rationale]
   - [Decision 3 with rationale]

   Is this accurate?"
   ```

2. **Write** `project-concept.md` to `workflow/features/<feature-id>/discover/project-concept.md`

The document MUST follow this structure:

```markdown
# <Project Name> — Project Concept

## Executive Summary
[2-3 sentences: what, for whom, why]

## Problem Statement
[The problem, current pain points, why now]

## Success Criteria
[Measurable outcomes that define project success]

## User Personas
[Who uses this, their technical level, their goals]

## User Journey
[Step-by-step core experience flow — from first touch to core action to completion]

## Key Requirements
### Must Have (P0)
- [Requirement with clear acceptance criteria]

### Should Have (P1)
- [Requirement with clear acceptance criteria]

### Nice to Have (P2)
- [Requirement with clear acceptance criteria]

## Technical Constraints
[Technology decisions, platform, integrations, deployment environment]

## Data Overview
[Key entities, storage needs, data flow summary]

## Security & Access
[Authentication approach, authorization model, sensitive data handling]

## Risks & Open Questions
[Known risks, unresolved questions, areas of uncertainty]

## Research Findings
[Summary of any research conducted during discovery]

## Decisions Log
[Key tradeoff decisions made during discovery with rationale]
```

### Step 4: Register and Complete

1. Call `wf_artifact_register` with:
   - artifact: `project-concept.md`
   - path: `workflow/features/<feature-id>/discover/project-concept.md`
   - type: `concept`
2. Call `wf_gate_record` with gate `"concept-completeness"` status `"passed"`
3. Call `wf_state_write` with action `"complete"` for stage `"discover"`
4. Tell the user: **"Discovery complete. The project concept has been written. Next: invoke the Spike stage to validate technical assumptions."**
