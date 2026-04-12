---
name: backlog-review
description: Review an engineering backlog produced by `backlog-writing` or an equivalent backlog against its parent PRD plus root requirements. Checks epic structure first, then user story title coverage, then full backlog item quality and traceability. Use when asked to review a backlog, assess epics or user stories, check backlog coverage against a PRD, or confirm that functional requirements are fully captured before delivery.
---

# Backlog Review

## References

Read these before starting the review:

- **[../../writing/prd-writer/SKILL.md](../../writing/prd-writer/SKILL.md)** - current PRD structure and review expectations. Read this first.
- **[../../writing/prd-writer/references/prd-reference-guide.md](../../writing/prd-writer/references/prd-reference-guide.md)** - detailed PRD guidance. Pay particular attention to `Functional Requirements`, `Entry Points, Core Journey & Platform Fit`, and `Systems, Risks & Compliance`.
- **[../../writing/backlog-writing/SKILL.md](../../writing/backlog-writing/SKILL.md)** - the intended backlog generation flow and backlog file structure.
- **[../../writing/backlog-writing/references/example_epic.md](../../writing/backlog-writing/references/example_epic.md)** - expected Epic format.
- **[../../writing/backlog-writing/references/example_user_story.md](../../writing/backlog-writing/references/example_user_story.md)** - expected User Story format.

Use these files as the quality bar even if the backlog being reviewed was written manually.

## Source Of Truth

Review the backlog against all relevant sources, in this order:

1. The parent PRD
2. The backlog files being reviewed
3. `context/company-context.md`
4. The root `requirements/` folders, when present

Treat the requirements folders like this:

- `requirements/platform-requirements/` - shared customer-facing platform capabilities such as login, password management, profile management
- `requirements/customer-functional-requirements/` - customer-facing feature requirements
- `requirements/internal-functional-requirements/` - internal tooling functional requirements, including internal-only platform-like capabilities such as internal login

Important distinctions:

- `platform-requirements/` is still customer-facing
- internal tooling should not inherit customer-facing platform assumptions unless the PRD explicitly says so
- if a requirement folder exists but is empty, call that out and review with the sources available rather than inventing missing inputs

## Review Principle

Follow a user-led review order. Do not start by nitpicking acceptance criteria.

Review in this sequence:

1. **Epic structure** - does the backlog break the problem into the right delivery slices?
2. **User story titles under each Epic** - does each Epic contain the right set of user-visible outcomes?
3. **Full backlog items** - do the detailed tickets faithfully implement the approved story titles and source requirements?

If the backlog is only partially developed, review only the phase that exists and be explicit about what could not yet be judged.

Default case: review the backlog that was just created by `backlog-writing` before treating it as ready for planning or delivery.

## Workflow

1. **Read the parent PRD in full**
   - identify `PRD Phase`, `Document Status`, audience, key journeys, and the full `Functional Requirements`
   - capture which requirements are P0 versus P1 if the PRD distinguishes them

2. **Read the PRD writer guidance**
   - use `prd-writer` as the standard for what a good PRD requirement looks like
   - review against the actual PRD structure the repo expects, not a generic backlog heuristic

3. **Read the backlog writer guidance and examples**
   - confirm the expected authoring flow is:
     - Epic structure proposed first
     - User story titles proposed under each Epic next
     - detailed backlog items written only after that
   - if the backlog skips this logic and the resulting structure is muddled, call it out

4. **Read `context/company-context.md`**
   - capture company defaults that change how the backlog should be interpreted, especially audience assumptions, compliance context, team priorities, and whether delivery is `Notion-enabled` or `local-first`

5. **Read the relevant root requirements**
   - for customer-facing work, check `customer-functional-requirements/` and also `platform-requirements/` when shared capabilities apply
   - for internal tooling, check `internal-functional-requirements/`
   - only pull in `platform-requirements/` for internal tooling if the PRD clearly reuses customer-facing platform capabilities

6. **Build a traceability map before judging quality**
   - map each PRD functional requirement to the Epic and User Story or stories that should implement it
   - map any relevant root requirement items the same way
   - identify `Covered`, `Partially Covered`, `Missing`, `Over-scoped`, and `Unclear` items

7. **Review the backlog in three passes**
   - Epic pass
   - User story title pass
   - full ticket quality pass

8. **Write the review**
   - lead with findings and required fixes
   - keep praise brief and specific
   - distinguish true blockers from improvement suggestions

## What Good Looks Like

### 1. Epic Structure

The Epic layer should:

- group related functional requirements into coherent delivery slices
- reflect the product shape described in the PRD
- separate shared platform work from feature-specific work where that distinction matters
- keep internal tooling work separate from customer-facing work unless the PRD intentionally combines them
- avoid dumping unrelated requirements into one broad Epic
- avoid creating Epics that are really implementation tasks rather than user or business outcomes

Flag these issues:

- a PRD requirement has no natural Epic home
- one Epic mixes multiple unrelated jobs-to-be-done
- platform capability work is hidden inside a feature Epic when it should be made explicit
- internal-only capability work is incorrectly treated as customer-facing platform scope

### 2. User Story Title Coverage

The User Story title layer should:

- sit cleanly underneath each Epic
- cover every meaningful requirement from the PRD and relevant requirements folders
- stay outcome-led, not task-led
- make the main user, action, and outcome clear from the title
- expose important scope splits before detailed ticket writing

Flag these issues:

- a functional requirement only appears implicitly in acceptance criteria and not in any story title
- story titles are technical tasks rather than user outcomes
- multiple titles overlap heavily or duplicate scope
- stories are too broad to estimate or too narrow to express a meaningful outcome
- important platform or internal capability coverage is missing from the title set

### 3. Full Backlog Item Quality

At the detailed ticket layer, check that:

- the description matches the PRD intent and the approved story title
- acceptance criteria are specific, testable, and use Given / When / Then
- dependencies, integrations, and compliance implications are surfaced when the PRD makes them relevant
- analytics, audit, permissions, error handling, and state handling are covered where they materially affect delivery
- placeholders remain placeholders when the source material does not yet provide the answer
- tickets do not invent scope beyond the PRD or relevant requirements
- tracking or handoff assumptions do not conflict with `context/company-context.md`

Flag these issues:

- acceptance criteria contradict the PRD
- a ticket adds new product scope without justification
- the backlog misses key edge cases that are explicit in the PRD
- platform or internal capability requirements are missing from implementation-ready tickets
- the backlog is technically tidy but does not actually satisfy the source requirement

## Functional Requirement Traceability

Always include a traceability view in the review. Use this shape:

```markdown
## Traceability Matrix

| Source Requirement | Source | Expected Backlog Home | Coverage | Notes |
|---|---|---|---|---|
| FR-1 | PRD | EP-3 / US-3.1 | Covered | Clear match |
| FR-2 | PRD | EP-4 / US-4.2 | Partially Covered | Missing admin edge case |
| Login requirement | platform-requirements | EP-2 / US-2.3 | Missing | No backlog item for password reset |
```

Use `Source` values such as:

- `PRD`
- `platform-requirements`
- `customer-functional-requirements`
- `internal-functional-requirements`

If the PRD and root requirements disagree, call out the mismatch explicitly rather than choosing one silently.

## Output Format

Produce either a chat review or a markdown review file, depending on what the user asked for. Use this structure:

```markdown
# Backlog Review: [Feature or backlog name]

**Parent PRD:** [file or link]
**Review date:** [today]
**Audience:** [customer-facing / internal / mixed]
**Sources checked:** [PRD, backlog files, requirements folders reviewed]
**Overall verdict:** GO / REWORK

## Critical Findings

1. [Highest-severity issue]
2. [Next issue]

## Epic Structure Review

**Verdict:** GO / REWORK

- [finding]

## User Story Title Coverage Review

**Verdict:** GO / REWORK

- [finding]

## Detailed Backlog Item Review

**Verdict:** GO / REWORK

- [finding]

## Traceability Matrix

[insert matrix]

## Required Fixes Before Delivery

1. [fix]
2. [fix]

## Strengths To Preserve

- [brief]
```

## Verdict Guidance

- **GO** - the backlog is coherent, traceable, and ready for the next stage being assessed
- **REWORK** - one or more issues should be fixed before trusting the backlog for planning or delivery

Use `REWORK` when:

- source requirements are missing from the backlog
- Epic structure hides important scope problems
- story titles do not reflect the real requirement set
- ticket detail contradicts or expands beyond the PRD

## Delivery Notes

- If the user asked for a review, lead with findings, not summary
- order findings by severity
- cite missing coverage at the requirement level, not only at the file level
- if the backlog is incomplete because the requirements folders are empty or the PRD is thin, say so plainly
- recommend fixing structure before rewriting ticket detail when both are broken
