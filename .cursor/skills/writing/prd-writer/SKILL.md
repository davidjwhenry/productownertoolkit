---
name: prd-writer
description: Write and refine stage-aware Product Requirement Documents (PRDs) for customer-facing features and internal tools. Use when asked to draft, write, create, or improve a PRD, product spec, or product requirements document. Uses `PRD Phase` for product maturity (`MVP`, `MMP`, `MLP`, `Enhancement`) and `Document Status` for document maturity (`Ideating`, `Reviewing`, `Building`, `In Production`). Follows a Jobs-to-be-Done-first approach with a consistent 8-section structure, built-in optionality rules, and repo-aware drafting to ensure the PRD connects to the actual product landscape.
---

# PRD Writer

## References

Read these files before writing or substantially editing any PRD:

- **[references/prd-reference-guide.md](references/prd-reference-guide.md)** — Full structural guide: section-by-section instructions, phase guidance, formatting rules, and the review checklist. Read this first.
- **[references/example-prd-customer-facing.md](references/example-prd-customer-facing.md)** — Worked MMP example: Savings Pots and Round-Ups.
- **[references/example-prd-internal-tool.md](references/example-prd-internal-tool.md)** — Worked MVP example: Support Operations Triage Console.

## Workflow

### 1. Gather context before writing

Before drafting, collect:

- **Feature name and brief description** — what is being built
- **PRD Phase** — MVP, MMP, MLP, or Enhancement (ask if unclear)
- **Document Status** — Ideating, Reviewing, Building, or In Production (ask if unclear)
- **Audience** — customer-facing or internal tool
- **Lineage** — new PRD, extends earlier PRD, replaces earlier PRD, or depends on earlier PRD
- **AI relevance** — whether AI is materially part of the product behavior, risk profile, or quality bar
- **Any known constraints** — deadlines, dependencies, out-of-scope items
- **Known rabbit holes** — tempting expansions already discussed or explicitly out of scope

Also gather the JTBD basics before writing:

- **Main job** — what the user is trying to achieve
- **Current approach** — how they get it done today
- **Current friction** — what is slow, fragile, manual, or frustrating
- **Desired progress** — what better looks like

If the user has not specified both `PRD Phase` and `Document Status`, ask before proceeding. They change which sections are needed and how complete the draft should be.

### 2. Research the repo

Before writing, inspect the repo for context that shapes platform fit:

- Check `context/company-context.md` for company name, tech stack, compliance requirements, default audience assumptions, team context, current business goals, and delivery workflow defaults — use these throughout the PRD
- Read `context/preferences.md` for learned user preferences — apply any relevant entries to tone, structure, level of detail, naming conventions, and formatting throughout the draft
- Scan existing PRDs in the repo to understand adjacent products, naming conventions, and recurring integration surfaces
- Identify likely entry points and where the new feature fits in the existing product landscape
- Identify the current workaround, substitute behavior, or adjacent surfaces users are already relying on
- Check whether this looks like a new capability or an extension of an existing one
- When multiple plausible homes exist for a feature, ask the user to confirm before writing
- If `context/company-context.md` says Notion is not part of the working flow, do not imply a Notion handoff, Notion page structure, or Notion-specific operating assumption in the PRD

This avoids PRDs that are internally coherent but disconnected from the actual product.

### 3. Draft the PRD

Use the 8-section structure from the reference guide:

1. `TL;DR` — 4–6 bullets, stakeholder-ready
2. `Product Shape` — `PRD Phase`, lineage, posture, adjacent surfaces, entry point hypothesis, and optional assumptions to test
3. `Strategic Context` — JTBD table first, then why this phase now, then one optional combined market / competitive / substitute subsection
4. `Goals & Rabbit Holes` — goals table + rabbit holes table; keep rabbit holes concrete and specific
5. `Functional Requirements` — organized by feature area, prioritized P0/P1, testable language
6. `Entry Points, Core Journey & Platform Fit` — entry points, core journey table, platform fit, optional Mermaid diagram
7. `Success Metrics & Gates` — 3–6 metrics tied to the job outcome, continuation gate only if the phase needs one
8. `Systems, Risks & Compliance` — integrations, compliance, and what could block delivery

Structure rules:

- Keep `Assumptions To Test` inside `Product Shape`, not as a standalone section
- Keep market, competitive, and substitute analysis inside one optional subsection of `Strategic Context`
- Do not add `Epics Breakdown`; backlog creation should flow from `Functional Requirements`
- Do not add optional sections unless they change a decision

Add optional AI sections (`AI Role, Guardrails & Failure Modes` and `AI Evaluation & Rollout`) only when AI is customer-facing, operator-facing, or materially changes product risk, quality expectations, or rollout confidence.

### 4. Apply phase discipline

| `PRD Phase` | Key emphasis |
| --- | --- |
| `MVP` | Lean scope; P0-heavy requirements; one main journey; key risks only |
| `MMP` | Business context; rollout gates; fuller supporting journeys |
| `MLP` | UX quality; emotional moments; polish criteria alongside requirements |
| `Enhancement` | Delta focus; what changes, what it touches, what must not regress |

`Document Status` changes how complete the draft should be:

| `Document Status` | Drafting behavior |
| --- | --- |
| `Ideating` | Stay short. Open questions and rough edges are acceptable. Do not fake certainty. |
| `Reviewing` | Make the document critique-ready. Core decisions and trade-offs should be explicit. |
| `Building` | Be concrete enough for active implementation, dependencies, and rollout planning. |
| `In Production` | Reflect shipped reality, current learnings, and follow-on opportunities rather than just pre-launch intent. |

Cut sections that do not change scope or sequencing for the current `PRD Phase` or `Document Status`.

### 5. Apply JTBD discipline

Keep the document anchored to the user objective, not the mechanism.

- Prefer the job the user is trying to make progress on
- Describe the current workaround or substitute behavior
- Avoid framing the mechanism itself as the goal unless the mechanism is the real product decision

Good:
- `save for a future life event`
- `get a case to the right owner quickly`

Weak:
- `turn on round-ups`
- `apply routing rules`

Use the same JTBD lens in:

- problem framing
- market and substitute context
- success metrics
- AI behavior descriptions, if AI is involved

### 6. Apply writing standards

- Lead with what to do, then why
- Use headings that say something specific, not generic labels
- Use `backticks` for event names, states, endpoints, and code-like identifiers
- Use **bold** for UI elements and emphasis
- Use tables for multi-attribute comparisons; bullets for short lists
- American spelling, serial commas
- Avoid "we" for product behavior — use the company name, "the app", or the team name
- Avoid "easy", "simple", or vague time language like "quickly"

### 7. Review before finishing

Run through the checklist in `references/prd-reference-guide.md` before marking a PRD ready. Key checks:

- TL;DR is brief and useful, not a mini-PRD
- Header uses the right `Document Status`
- `Product Shape` includes the right `PRD Phase`, lineage, and platform fit
- Problem framing describes the job, current workaround, and desired progress
- `Assumptions To Test` live under `Product Shape` if they are needed
- Market, competitive, and substitute material stays inside one optional `Strategic Context` subsection
- Rabbit holes are specific temptations, not generic boilerplate
- Functional requirements are prioritized and use testable language
- Diagram is included only if it improves clarity
- Success metrics reflect job outcomes, not just feature adoption
- AI sections appear only if AI is materially part of the product behavior, operator workflow, or risk profile

### 8. Observe and propose preference updates

At the end of the session, if the user corrected tone, restructured sections, changed naming conventions, adjusted detail level, or expressed a repeatable preference:

- Propose adding it to `context/preferences.md` under the most relevant heading
- Confirm with the user before writing — never write silently
- Only record durable patterns, not one-off task instructions
- If the new preference conflicts with an existing entry, propose replacing the old one
