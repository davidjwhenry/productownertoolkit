---
name: backlog-writer
description: Generate structured product backlogs from PRDs and root requirements. Produces Epics and User Story titles in a gated, sign-off-driven workflow before writing full backlog items. Uses the repo's PRD guidance plus `requirements/platform-requirements/`, `requirements/customer-functional-requirements/`, and `requirements/internal-functional-requirements/` to ensure functional requirements are fully captured. Use when asked to write a backlog, create epics, generate user stories, or break a PRD into delivery-ready tickets.
---

# Backlog Writer

## References

Read these before generating any backlog:

- **[../prd-writer/SKILL.md](../prd-writer/SKILL.md)** - current PRD structure and drafting rules. Read this first.
- **[../prd-writer/references/prd-reference-guide.md](../prd-writer/references/prd-reference-guide.md)** - detailed PRD guidance. Pay particular attention to `Functional Requirements`, `Entry Points, Core Journey & Platform Fit`, and `Systems, Risks & Compliance`.
- **[references/example_epic.md](references/example_epic.md)** - canonical Epic format. Read before writing any Epic.
- **[references/example_user_story.md](references/example_user_story.md)** - canonical User Story format. Read before writing any User Story.

Use the `prd-writer` references as the source of truth for what a good requirement looks like. Backlog-writing should translate that requirement set into Epics and User Stories, not reinterpret the product from scratch.

## Source Of Truth

Backlogs should be grounded in these sources, in this order:

1. The parent PRD
2. The root `requirements/` folders, when present
3. `context/company-context.md`
4. Existing backlog numbering and nearby backlog patterns in `backlog/`

Treat the requirements folders like this:

- `requirements/platform-requirements/` - shared customer-facing platform capabilities such as login, password management, profile management
- `requirements/customer-functional-requirements/` - customer-facing feature requirements
- `requirements/internal-functional-requirements/` - internal tooling functional requirements, including internal-only platform-like capabilities

Decision rules:

- customer-facing features usually draw from the PRD plus `customer-functional-requirements/`, and may also need `platform-requirements/`
- internal tooling usually draws from the PRD plus `internal-functional-requirements/`
- `platform-requirements/` is still customer-facing unless the PRD explicitly says an internal flow reuses the same capability
- if a requirements folder exists but is empty, note that and proceed from the PRD rather than inventing missing requirements

## Output Location

All backlog files are written to `backlog/` at the repo root, grouped by Epic:

```text
backlog/
  EP-1-epic-title/
    EP-1-epic-title.md
    US-1.1-story-title.md
    US-1.2-story-title.md
  EP-2-epic-title/
    EP-2-epic-title.md
    US-2.1-story-title.md
```

Slugify titles for directory and file names: lowercase, hyphens, no special characters.

## Numbering Rules

Numbering is repo-wide and sequential, not per-feature or per-PRD.

- Epics: `EP-N`
- User Stories: `US-N.X`, where `N` is the parent Epic number and `X` starts at `1`
- never reuse or skip numbers
- never reset numbering for a new PRD

If `backlog/` does not exist, numbering starts at `EP-1`.

## Workflow

This skill operates in three phases with mandatory sign-off gates between each.

```text
Phase 1: Propose Epic structure      -> STOP for sign-off
Phase 2: Propose User Story titles   -> STOP for sign-off
Phase 3: Write full backlog items    -> write files
```

Do not proceed past a gate without explicit approval. `Looks good`, `approved`, or `go ahead` count as sign-off. Revisions reset that phase before re-presenting.

The flow is deliberate:

1. agree the Epic structure first
2. agree the User Story titles under each Epic second
3. only then write the detailed backlog items

Do not jump straight to full tickets.

## Pre-Work

Before Phase 1:

1. Read the parent PRD in full.
2. Read the `prd-writer` guidance listed above.
3. Read `context/company-context.md`.
4. Read the relevant root requirements for the product type.
5. Scan `backlog/` for the highest existing Epic and User Story numbers.
6. Build a lightweight traceability map from source requirements to likely backlog homes.

Capture at least:

- audience: customer-facing or internal
- `PRD Phase`
- `Document Status`
- whether delivery is `Notion-enabled` or `local-first`, plus any default tracking locations or Project IDs if present
- the full `Functional Requirements` list
- key journeys and entry points
- any explicit platform, permissions, compliance, analytics, or dependency requirements

## Phase 1 - Epic Structure Plan

Goal: agree what Epics exist and which source requirements each Epic covers.

Epic design rules:

- create Epics from coherent delivery slices, not implementation layers
- use the PRD's `Functional Requirements` as the backbone
- pull in relevant root requirements when they materially shape delivery
- keep platform capability work explicit when it is needed
- keep internal tooling Epics separate from customer-facing Epics unless the PRD intentionally combines them
- do not bury shared capabilities like login, password reset, profile management, permissions, or audit under a random feature Epic if they are meaningful scope

Present the plan in this format:

```markdown
## Epic Structure Plan

| # | Epic | Covers | Source Requirements | Notes |
|---|---|---|---|---|
| EP-N | [Epic title] | [Capability slice] | [PRD FRs, platform/customer/internal requirements] | [One-line rationale] |
| EP-N+1 | [Epic title] | [Capability slice] | [Requirement refs] | [One-line rationale] |

Proposed total: X Epics, ~Y User Stories

Open questions:
- [question if any]

**Awaiting your sign-off.** Reply to approve, request changes, or split/merge Epics.
```

Do not write files in Phase 1.

## Phase 2 - User Story Title Plan

Goal: agree the complete story title set under each Epic before writing detailed backlog items.

Story title rules:

- titles sit under an approved Epic
- every meaningful source requirement should appear in at least one story title
- titles should express a user or operator outcome, not an engineering task
- split titles when permissions, states, personas, or journeys materially differ
- do not hide platform or internal capability requirements only inside acceptance criteria

Present all Epic story lists in one message using this format:

```markdown
## EP-N: [Epic Title]

| ID | User Story Title | Priority | Covers | Notes |
|----|---|---|---|---|
| US-N.1 | As a [persona], I want to [action], so that [outcome] | P0 | [FR refs] | |
| US-N.2 | As a [persona], I want to [action], so that [outcome] | P1 | [FR refs] | |

**Awaiting your sign-off.** Add, remove, merge, split, or reprioritize stories before I write the tickets.
```

Do not write files in Phase 2.

## Phase 3 - Write Full Backlog Items

Goal: write the approved backlog to the repo.

After Phase 2 sign-off:

1. Read `references/example_epic.md` and `references/example_user_story.md` if they are not already in context.
2. Create `backlog/` if it does not exist.
3. For each Epic, create its directory and write:
   - the Epic file: `EP-N-slug.md`
   - one User Story file per approved story: `US-N.X-slug.md`
4. In the Epic file, link each User Story in the User Stories table using a relative markdown link.
5. Make sure the written files preserve traceability back to the PRD and relevant root requirements.
6. After writing, report the backlog summary and recommend running `backlog-review` against the backlog just created.

Use the example files as the structure baseline. Do not silently invent new sections unless the user asks.

## Functional Requirement Capture Rules

The backlog must capture functional requirements faithfully.

At minimum:

- each PRD functional requirement should map to an Epic and at least one User Story
- platform requirements needed for a customer-facing feature should appear in the backlog explicitly
- internal tooling requirements should not be represented as customer stories unless the audience is actually external
- if a requirement is foundational but not user-visible, represent it in the Epic scope and in the relevant User Story detail where it affects delivery
- if a requirement exists in root requirements but not in the PRD, flag it for confirmation rather than silently dropping it
- if the PRD and root requirements conflict, ask the user to resolve the mismatch before writing detailed tickets

## Writing Standards

- mirror the persona, product surface, and company name from `context/company-context.md`
- respect the delivery workflow in `context/company-context.md`; do not imply Notion syncing or Notion-only tracking when the repo is configured as local-first
- acceptance criteria use Given / When / Then
- priorities: `P0` = must-have for the Epic to ship, `P1` = should-have, `P2` = nice-to-have
- keep story titles outcome-led, not task-led
- keep acceptance criteria specific and testable
- surface meaningful dependencies, permissions, analytics, audit, error handling, and state handling when the source material makes them relevant
- leave `Figma Link` and `Tracking` placeholders as `[to be inserted]` unless the user supplies values
- use American spelling and serial commas
- use `backticks` for event names, endpoints, states, and code-like identifiers
- use bold for UI elements and screens
- do not invent scope not present in the PRD or relevant root requirements
- if a gap blocks faithful writing, mark it as `[clarify with team]`

## Final Chat Output

After writing files, report:

```markdown
## Backlog Written

**EP-N: [Epic Title]** -> `backlog/EP-N-slug/`
- US-N.1: [Story title]
- US-N.2: [Story title]

**EP-N+1: [Epic Title]** -> `backlog/EP-N+1-slug/`
- US-N+1.1: [Story title]

## Coverage Notes

- [Any source requirements deliberately left for clarification]
- [Any requirement folder that was empty or not used]

## Recommended Next Step

Run `backlog-review` against the backlog just written and the parent PRD.
```
