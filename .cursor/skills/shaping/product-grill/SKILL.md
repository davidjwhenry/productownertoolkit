---
name: product-grill
description: Stress-test a product idea, PRD, requirement, backlog plan, or stakeholder proposal before writing. Use when the user wants back-and-forth, asks to be challenged, says "grill me", or the brief has fuzzy actors, states, scope, assumptions, terminology, or trade-offs. Ask one question at a time, recommend an answer, check repo context before asking, and capture durable product language or product decisions as they crystallize.
---

# Product Grill

Interview the user one question at a time before product thinking hardens into a PRD or backlog. This is a shaping skill, not a review report or document generator.

- ask one question, then wait
- answer from the repo before asking the user
- recommend an answer with each question
- challenge fuzzy or conflicting language immediately
- capture durable language and decisions only when they settle
- do not write a PRD, backlog, or review unless the user asks to leave the grill

## References

Read only when needed:

- **[references/product-language-format.md](references/product-language-format.md)** — updating terms
- **[references/product-decision-format.md](references/product-decision-format.md)** — recording decisions

## Start Here

Before the first substantive question, read:

- `context/company-context.md`
- `context/team-context.md`
- `context/preferences.md`
- `context/product-language.md`, if present
- relevant `requirements/` files and `requirements/decisions/`, if present
- any PRD, backlog, research, note, transcript, or stakeholder input the user provides

If the repo answers a question, use the repo answer. If the brief is too thin, ask only for the smallest useful brief: idea, intended output, and decision deadline.

## The Loop

Privately identify the riskiest unresolved ambiguity, then ask exactly one question. Each question must include:

- **Question:** the ambiguity or decision to resolve
- **Why it matters:** downstream impact on requirements, backlog, research, compliance, rollout, or stakeholders
- **My recommendation:** your proposed answer and rationale
- **Artefact impact:** what this changes or unlocks

Then stop and wait.

Prefer decision-forcing questions over broad brainstorming prompts. Do not dump a questionnaire.

## What To Challenge

Prioritize ambiguities that change scope, interpretation, or delivery:

- actors: `customer`, `user`, `member`, `operator`, `admin`, `approver`, `owner`
- states: `active`, `submitted`, `approved`, `verified`, `completed`, `failed`, `closed`
- product shape: `MVP`, `MMP`, `MLP`, `Enhancement`
- hidden journeys: self-serve vs. assisted, customer-facing vs. internal, happy path vs. failure path
- product boundaries: platform vs. feature, customer feature vs. internal tooling
- obligations: compliance, audit, permissions, analytics, retention, rollout gates
- contradictions with product language, requirements, PRDs, backlog, or accepted decisions

When language is fuzzy, name the ambiguity and propose a canonical term. When a boundary is unclear, use a concrete scenario to force precision.

## Capture Rules

Update repo memory only when the point is durable.

Update `context/product-language.md` when a resolved term will recur across PRDs, backlog, reviews, or stakeholder discussions. Do not use it for one-off wording, speculative assumptions, or implementation detail.

Offer a product decision record in `requirements/decisions/` only when the decision is all three:

1. **Durable** — it shapes more than one artefact, sprint, launch, or stakeholder conversation
2. **Non-obvious** — a future reader may ask why this path was chosen
3. **Trade-off based** — credible alternatives existed

Do not create decision records silently. Most answers should stay in the current PRD, backlog, note, or chat summary instead.

## Stop Conditions

When the user is ready to stop, summarize:

- decisions resolved
- questions still open
- product-language updates made or proposed
- product decision records made or proposed
- recommended next skill or action

Recommend one next step: `desktop-research`, `prd-writer`, update an existing PRD, `backlog-writing`, `prd-reviewer`, `backlog-review`, or pause for a decision-maker.

## Style

Be direct, not combative. Lead with what to resolve and why. Follow repo writing standards.

## Maintenance

Keep the `.cursor` and `.claude` copies aligned.
