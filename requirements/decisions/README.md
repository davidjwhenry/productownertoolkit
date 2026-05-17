# Product Decisions

This folder stores lightweight product decision records created when a durable, non-obvious, trade-off-based choice needs to be preserved across PRDs, requirements, backlog items, and stakeholder discussions.

Use this folder to stop important decisions being reopened or accidentally reversed as artifacts evolve.

## When To Add A Decision

Create a decision record only when all three are true:

1. **Durable** — the decision is likely to shape more than one artifact, sprint, launch, or stakeholder conversation.
2. **Non-obvious** — a future reader may reasonably ask why this path was chosen.
3. **Trade-off based** — credible alternatives existed and the team chose one for specific reasons.

Do not create a record for every PRD assumption, copy choice, meeting note, or standard requirement.

## Numbering

Use sequential filenames:

- `0001-short-slug.md`
- `0002-short-slug.md`
- `0003-short-slug.md`

Before creating a new record, scan this folder for the highest existing number and increment by one.

## Template

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

[Why the chosen option wins for this product context.]

## Consequences

- [What this enables]
- [What this rules out or defers]
- [What future PRDs or backlog items must respect]

## Related Artifacts

- [Link to PRD, requirement area, backlog item, research note, or meeting note if available]
```

## Status Values

- `proposed` — likely direction, but not yet accepted by the relevant decision-maker
- `accepted` — current source of truth
- `superseded` — replaced by a later decision record
- `deprecated` — no longer recommended, but not directly replaced
