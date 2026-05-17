---
name: product-grill
description: Stress-test a product idea, PRD, requirement, backlog plan, or stakeholder proposal through a one-question-at-a-time interview. Use when the user wants more back-and-forth, asks to be challenged, says "grill me", wants to pressure-test requirements, or needs to sharpen product language before writing or revising an artifact. Challenges fuzzy terminology against `context/product-language.md`, existing requirements, PRDs, and repo context; captures durable product language and product decisions as they crystallize.
---

# Product Grill

## Purpose

Run a focused product interrogation before or during requirements work. The goal is not to produce a polished artifact immediately. The goal is to reach shared understanding, resolve the highest-risk ambiguities, and make the next writing or review step sharper.

This skill is inspired by Matt Pocock's `grill-with-docs` pattern, adapted for product requirements repositories:

- ask one question at a time
- answer what the repo can answer before asking the user
- provide a recommended answer with every question
- challenge fuzzy or conflicting terminology immediately
- capture durable product language and product decisions inline when they are resolved

## References

Read these before running a grilling session:

- **[references/product-language-format.md](references/product-language-format.md)** — Format and rules for `context/product-language.md`.
- **[references/product-decision-format.md](references/product-decision-format.md)** — Format and rules for `requirements/decisions/` records.

## When To Use

Use this skill when the user wants to:

- stress-test an idea before drafting a PRD
- challenge the assumptions in an existing PRD
- sharpen a vague requirement or stakeholder request
- decide whether a product shape is `MVP`, `MMP`, `MLP`, or `Enhancement`
- resolve terminology before writing backlog items
- identify missing user, operator, compliance, data, analytics, or rollout decisions
- create more back-and-forth instead of one-shot document generation

Do not use this as a replacement for `prd-reviewer` or `backlog-review`. Those review finished or draft artifacts. `product-grill` is a conversational thinking loop that should happen earlier, or while an artifact is still being shaped.

## Workflow

### 1. Load context before asking

Before the first question, read:

- `context/company-context.md`
- `context/team-context.md`
- `context/preferences.md`
- `context/product-language.md` if it exists
- any PRD, backlog item, research note, requirement file, meeting note, or stakeholder input the user points at
- relevant files under `requirements/` when the topic clearly belongs to a known requirement area
- `requirements/decisions/` if it exists and the topic may revisit prior product decisions

If a question can be answered from the repo, answer it from the repo instead of asking the user.

If the user has not supplied enough of a topic to begin, ask for the smallest useful brief:

- product idea or artifact to grill
- intended output after the grill, such as PRD, backlog, research plan, stakeholder note, or decision record
- known deadline or decision gate, if any

### 2. Build a private risk map

Before asking the first substantive question, identify the likely risk areas. Do not dump the full map to the user unless they ask. Use it to choose the next best question.

Look for:

- ambiguous actors, such as customer, user, member, operator, admin, approver, or owner
- fuzzy states, such as active, approved, submitted, completed, verified, failed, or closed
- unclear product phase, especially when `MVP` scope includes polish, automation, migration, or reporting
- untested assumptions about current behavior, substitutes, workarounds, or demand
- missing entry points, core journey steps, edge cases, and failure states
- internal tooling hidden inside a customer-facing requirement, or vice versa
- compliance, audit, data retention, permissions, analytics, or rollout gaps
- contradictions with existing requirements, product language, PRDs, backlog items, or product decisions

### 3. Ask one question at a time

Ask exactly one substantive question, then wait for the user's answer.

Every question must include:

- **Question** — the decision or ambiguity to resolve
- **Why it matters** — the downstream impact on requirements, backlog, research, compliance, rollout, or stakeholder alignment
- **My recommendation** — your recommended answer, based on repo context and product judgment
- **Artifact impact** — which artifact or section this would affect

Prefer the highest-leverage unresolved question, not the easiest question.

Do not provide a long questionnaire. Do not continue to the next question until the user responds.

### 4. Challenge language immediately

When the user uses a term that conflicts with `context/product-language.md`, existing requirements, or the current artifact, call it out before proceeding.

Use this pattern:

- quote the term or phrase
- state the conflict or ambiguity
- propose a canonical term or definition
- ask the user to confirm or correct it

Examples of product-language challenges:

- `customer` vs. `user` vs. `member`
- `case` vs. `ticket` vs. `request`
- `approved` vs. `submitted` vs. `verified`
- `notification` vs. `task` vs. `audit event`
- `launch` vs. `rollout` vs. `general availability`

### 5. Stress-test with scenarios

When a relationship, state, permission, or journey is unclear, invent a concrete scenario that probes the boundary.

Good scenarios include:

- first-time user vs. returning user
- customer-facing path vs. operator-assisted path
- happy path vs. partial failure
- one actor starts and another actor completes
- data changes after approval
- user loses eligibility mid-flow
- duplicate, stale, withdrawn, or expired request
- feature disabled during rollout
- regulated or audited action

Ask the scenario as the next single question when it is the best way to resolve the ambiguity.

### 6. Capture resolved product language inline

When a durable term is resolved, update `context/product-language.md` during the session.

Create `context/product-language.md` if it does not exist and there is a real term to capture. Do not create or update it for one-off wording, speculative ideas, or general product terms.

Use **[references/product-language-format.md](references/product-language-format.md)**.

`context/product-language.md` is for shared language only. It is not a PRD, scratch pad, decision log, research note, or backlog substitute.

Before writing a new term, confirm that it is durable enough to reuse across future PRDs, backlog items, reviews, or stakeholder discussions. If the user has not clearly confirmed the wording, ask before writing.

### 7. Offer product decision records sparingly

Offer to create a product decision record only when all three are true:

1. **Durable** — the decision is likely to shape more than one artifact, sprint, launch, or stakeholder conversation
2. **Non-obvious** — a future reader may reasonably ask why this path was chosen
3. **Trade-off based** — there were credible alternatives and the team chose one for specific reasons

Create product decisions in `requirements/decisions/` using **[references/product-decision-format.md](references/product-decision-format.md)**.

Do not create a decision record for every answer. Most answers should feed the current PRD, backlog, or notes instead.

### 8. Route outputs to the next skill

When the user is ready to stop, summarize:

- resolved decisions
- unresolved questions
- product-language updates made or proposed
- product decision records made or proposed
- recommended next step

Recommend one clear next step:

- run `desktop-research` if evidence is too thin
- run `prd-writer` if product shape is clear enough to draft
- update an existing PRD if the grill changed scope, assumptions, or terminology
- run `backlog-writing` if requirements are stable enough to break down
- run `prd-reviewer` or `backlog-review` if the artifact is ready for formal review
- pause if a decision-maker or external constraint is needed before proceeding

## Question Format

Use this exact format for each substantive question:

```markdown
## Product Grill Question

**Question:** [One question only]

**Why it matters:** [Downstream impact]

**My recommendation:** [Recommended answer and rationale]

**Artifact impact:** [Affected artifact, section, requirement area, backlog slice, or decision record]
```

## Capture Rules

### Capture in `context/product-language.md` when

- the term is likely to recur across product work
- the term affects interpretation of requirements or acceptance criteria
- the term disambiguates actors, states, objects, journeys, or product surfaces
- the term replaces an ambiguous or overloaded phrase

### Capture in `requirements/decisions/` when

- the decision is durable, non-obvious, and trade-off based
- the decision affects scope, product boundaries, rollout posture, compliance posture, or ownership
- the decision would prevent future re-litigation or accidental reversal

### Capture in the current artifact instead when

- the point is specific to one PRD, Epic, User Story, report, or meeting
- the answer is an assumption to test, not a resolved decision
- the wording is useful for the current draft but not durable product language

### Propose a preference update when

At the end of the session, if the user corrected tone, detail level, grilling intensity, question format, terminology style, or workflow in a reusable way:

- propose adding it to `context/preferences.md`
- confirm with the user before writing
- never write preferences silently

## Writing Standards

- Lead with what to resolve, then why it matters
- Use `backticks` for event names, states, endpoints, and code-like identifiers
- Use **bold** for UI elements and emphasis
- Use American spelling and serial commas
- Avoid "we" for product behavior — use the company name, "the app", or the team name
- Be direct, but not combative
- Prefer decision-forcing questions over broad brainstorming prompts
- If the product context is genuinely unknown, say so and ask; do not invent certainty

## Maintenance

Keep the `.cursor` and `.claude` copies of this skill aligned.
