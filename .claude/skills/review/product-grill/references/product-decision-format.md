# Product Decision Format

Product decision records live in `requirements/decisions/`. They capture durable product choices that future PRDs, backlog items, and stakeholder discussions should not accidentally reopen.

They are deliberately lightweight. The goal is to preserve context, not create governance theater.

## When To Create One

Create a product decision record only when all three are true:

1. **Durable** — the decision is likely to shape more than one artifact, sprint, launch, or stakeholder conversation.
2. **Non-obvious** — a future reader may reasonably ask why this path was chosen.
3. **Trade-off based** — credible alternatives existed and the team chose one for specific reasons.

Good examples:

- choosing self-serve as the primary journey and operator-assist as fallback
- deciding that a capability belongs in platform requirements rather than a feature-specific PRD
- choosing not to support a tempting edge case in the first release
- setting a rollout gate because of compliance, operational, or trust risk
- defining ownership boundaries between customer-facing and internal tooling surfaces

Poor examples:

- a one-off copy choice
- a temporary assumption that still needs research
- a standard PRD requirement
- a decision with no meaningful alternative
- a personal writing preference

## Location And Numbering

Decision records live at:

`requirements/decisions/`

Use sequential numbering:

- `0001-short-slug.md`
- `0002-short-slug.md`
- `0003-short-slug.md`

Before creating a record, scan the folder for the highest existing number and increment by one.

## Template

Use this format:

```markdown
---
title: [Short decision title]
type: product-decision
status: accepted
date: YYYY-MM-DD
source_skill: product-grill
---

# [Short decision title]

## Decision

[1–3 sentences stating the decision clearly.]

## Context

[Why this decision came up, including the product area, artifact, stakeholder pressure, or ambiguity it resolves.]

## Considered Options

- **[Option A]:** [Short note]
- **[Option B]:** [Short note]
- **[Option C, if relevant]:** [Short note]

## Rationale

[Why the chosen option wins for this product context. Mention user value, operational fit, compliance, delivery cost, or stakeholder alignment where relevant.]

## Consequences

- [What this enables]
- [What this rules out or defers]
- [What future PRDs or backlog items must respect]

## Related Artifacts

- [Link to PRD, requirement area, backlog item, research note, or meeting note if available]
```

## Status Values

Use one of:

- `proposed` — likely direction, but not yet accepted by the relevant decision-maker
- `accepted` — current source of truth
- `superseded` — replaced by a later decision record
- `deprecated` — no longer recommended, but not directly replaced

If a decision is superseded, add a link to the newer decision in the old record.

## Writing Rules

- Keep it short. Most records should fit on one screen.
- State the decision plainly before giving context.
- Include rejected options only when remembering them will prevent future churn.
- Avoid implementation details unless the product decision depends on them.
- Use American spelling and serial commas.
- Use `backticks` for states, event names, endpoints, and code-like identifiers.
- Use **bold** for UI labels or named product surfaces.
