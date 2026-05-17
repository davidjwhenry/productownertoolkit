---
name: prd-reviewer
description: Review a PRD (Product Requirements Document) from two expert lenses — GTM Lead and Engineering Lead — and produce a structured markdown review with a Go/No-Go verdict per lens plus actionable improvement recommendations. Use when asked to review, critique, or assess a PRD, product spec, or requirements document. Also appropriate for draft PRDs — frame findings as questions and risks rather than blockers. Triggers on phrases like "review this PRD", "give me feedback on this spec", "run the prd-reviewer", or when a PRD file is provided for assessment.
---

# PRD Reviewer

## Overview

Review the provided PRD from two expert perspectives. Each reviewer produces an independent assessment with a binary Go / No-Go verdict and specific, actionable recommendations.

Calibrate the review on two axes before judging quality:
- **Document status** — `Draft`, `In review`, `Approved`
- **PRD phase** — `MVP`, `MMP`, `MLP`, `Enhancement`, or `Unknown`

- **GTM Lead** — commercial value, PMF evidence, success criteria, platform fit, product story
- **Engineering Lead** — functional requirements quality, technical feasibility, stack reuse, non-functional requirements

Read the full persona details before conducting each review:
- GTM Lead criteria: `references/gtm-lead.md`
- Engineering Lead criteria: `references/engineering-lead.md`

## Workflow

1. **Read the PRD** in full before beginning any review. Note both the document status (`Draft`, `In review`, `Approved`) and the PRD phase (`MVP`, `MMP`, `MLP`, `Enhancement`, or `Unknown`).
2. **Read `context/company-context.md`** to calibrate the review against the company's stack, compliance context, target audience, business goals, team context, and delivery workflow defaults.
3. **Read `context/team-context.md`** for durable stakeholder or decision dynamics that affect review posture.
4. **Read `context/preferences.md`** — apply any relevant entries to review tone, finding format, detail level, and how recommendations are framed.
5. **Read `context/product-language.md`** and flag terminology drift, overloaded actors, unclear states, or conflicting canonical language.
6. **Read `requirements/decisions/`** and flag any PRD claim that contradicts an accepted product decision or should explicitly supersede one.
7. **Read both persona reference files** to load the full lens before writing either review.
8. **Conduct each review independently** — do not let one lens bleed into the other.
9. **Produce a single output file** in the format below.

## Review Calibration

Use status to decide how findings are framed, and phase to decide how much depth is required.

### Proportionality rules

- **MVP** — keep the review lean. Prioritise core user problem, smallest viable scope, main journey, measurable success, and major technical or commercial risks.
- **MMP** — expect stronger rollout logic, supporting journeys, clearer commercial framing, and broader implementation readiness.
- **MLP** — expect explicit quality, trust, usability, differentiation, and polish criteria. Missing quality expectations can be a real gap.
- **Enhancement** — review the delta from the current product. Focus on what changes, what it touches, regressions, migration risk, and what must not break.
- **Unknown** — call out the missing phase and review against the minimum bar for scoping readiness, without inventing a stricter standard.

### Review gate

State the gate your verdict applies to:
- `Discovery` — enough signal to explore and answer open questions
- `Scoping` — enough clarity to estimate and sequence delivery
- `Delivery` — enough specificity and safeguards to build with confidence

## Draft Status Guidance

When the document status is `Draft` or the document is clearly incomplete:
- Frame Engineering findings as "questions to resolve before scoping" rather than hard blockers
- GTM No-Go verdicts still apply — a draft should still have a PMF rationale and commercial link even if requirements aren't fully formed
- Call out missing sections explicitly rather than inferring their absence is intentional
- Judge completeness relative to the phase. A lean `MVP` draft should not be penalised for missing `MLP`-level polish detail.
- If the PRD assumes a delivery surface or operating model that conflicts with `context/company-context.md` such as a Notion-only workflow in a local-first setup, call that out explicitly.
- If the PRD uses terminology that conflicts with `context/product-language.md`, call it out as a requirements risk, not just a wording issue.
- If the PRD contradicts an accepted product decision, recommend either updating the PRD or creating a superseding decision record before delivery planning.

## Output Format

Produce a single markdown file. Use this exact structure:

```markdown
# PRD Review: [PRD Title]

**Document version:** [from PRD]  
**Document status:** [from PRD]  
**PRD phase:** [from PRD]  
**Review gate:** [Discovery / Scoping / Delivery]  
**Review date:** [today's date]

---

## GTM Lead Review

**Verdict: GO / NO-GO**

> [1–2 sentence summary of the overall GTM assessment and the primary reason for the verdict]

**Calibration note:** [How the verdict was calibrated to the document status and PRD phase]

### Findings

#### [Finding title]
**Signal:** [What's present, weak, or missing]  
**Why it matters:** [GTM impact]  
**Recommendation:** [Specific, actionable improvement]
**Traceability:** [Relevant PRD section, product-language term, or product decision if applicable]

[Repeat for each finding. Include both strengths worth preserving and gaps to fix.]

---

## Engineering Lead Review

**Verdict: GO / NO-GO**

> [1–2 sentence summary of the overall engineering assessment and the primary reason for the verdict]

**Calibration note:** [How the verdict was calibrated to the document status and PRD phase]

### Findings

#### [Finding title]
**Signal:** [What's present, unclear, or missing]  
**Why it matters:** [Engineering risk or friction]  
**Recommendation:** [Specific, actionable improvement]
**Traceability:** [Relevant PRD section, product-language term, or product decision if applicable]

[Repeat for each finding.]

---

## Implementation Priorities

A consolidated list of the highest-leverage improvements across both reviews, ranked by impact:

1. [Most critical item] — [which lens raised it]
2. [Next item] — [which lens]
...
```

## Verdict guidance

- **GO**: The PRD can proceed through the stated review gate. Recommendations are improvements, not blockers.
- **NO-GO**: One or more issues must be resolved before this PRD can pass the stated review gate. State the specific condition that would flip it to a GO.

A NO-GO from one lens does not require a NO-GO from the other — each verdict is independent.

Only treat a gap as a blocker if it is required for the current phase and document status, or if the omission would create significant downstream risk or rework.

## Output delivery

Save the review as a `.md` file in the same directory as the PRD, named `[prd-filename]-review.md`. Then summarise the two verdicts and the top 3 priorities in the chat.

## Preference Observation

At the end of the session, if the user redirected review tone, asked for different finding formats, adjusted severity thresholds, or expressed a repeatable review preference:

- Propose adding it to `context/preferences.md` under the most relevant heading
- Confirm with the user before writing — never write silently
- Only record durable patterns, not one-off task instructions
