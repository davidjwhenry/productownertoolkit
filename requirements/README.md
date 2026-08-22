# Requirements

This folder stores canonical requirement libraries and their related working artefacts.

The top-level split is intentional because skills may read these folders directly when checking coverage or generating backlog outputs.

## Top-Level Structure

- `platform-requirements/` for shared customer-facing platform capabilities such as login, password reset, profile management, and similar cross-cutting journeys
- `customer-functional-requirements/` for customer-facing feature requirements
- `internal-functional-requirements/` for internal tooling functional requirements
- `decisions/` for lightweight product decision records that preserve durable, non-obvious, trade-off-based choices across artefacts

## Expected Layout Inside Each Requirement Area

Each requirement area or feature folder should follow the same structure where it makes sense:

- `research/` for source inputs, interviews, market scans, and synthesis inputs
- `notes/` for working thoughts, hypotheses, musings, and open questions
- `prd/` for the current PRD and major revisions
- `backlog/` for Epics, User Stories, and related delivery artefacts
- `prototypes/` for pen.dev (`.pen`) files, HTML mocks, wireframes, or other explorations
- `reports/` for executive reports, stakeholder summaries, and review outputs

Example:

```text
requirements/
  customer-functional-requirements/
    savings/
      research/
      notes/
      prd/
      backlog/
      prototypes/
      reports/
```

## Rules

- Keep the top-level classification stable because skills may depend on it.
- Use requirement-area folders underneath the top level to keep related work together.
- Treat `research/` and `notes/` as exploratory inputs, not canonical product decisions.
- Treat approved PRDs, backlog items, and reports as derived artefacts that should stay traceable to the source requirement area.
- Treat `decisions/` as cross-cutting product decision memory, not as a replacement for PRDs, backlog items, or research evidence.
- Create a product decision only when it is durable, non-obvious, and trade-off based.
- If a requirement area does not need every subfolder, omit the empty ones rather than creating noise.
