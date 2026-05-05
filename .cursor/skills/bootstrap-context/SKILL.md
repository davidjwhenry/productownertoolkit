---
name: bootstrap-context
description: Capture company-specific setup details for this toolkit and write them into the canonical context file and starter docs. Use after cloning the repo, when setting up the toolkit for a new company, when replacing `{Company XYZ}` placeholders, or when the user asks to configure the repo for their organisation. Covers company defaults, Notion-vs-local workflow decisions, team context, and current business goals.
---

# Bootstrap Context

Use this skill for the initial post-clone setup pass.

## Workflow

1. Read `context/company-context.md` first.
2. Confirm whether the user actively uses Notion in this workflow before asking any Notion-specific setup questions.
3. Ask the user for the missing company defaults, team context, and current business context.
4. Normalize the answers into concise, reusable values.
5. Update `context/company-context.md` as the source of truth.
6. Verify `context/preferences.md` exists. If it is missing, create it from the standard template with empty placeholder sections. Do not pre-populate preferences during bootstrap — they are learned from usage.
7. Update the obvious starter placeholders in key docs:
   - `examples/prd-reference-guide.md`
   - `examples/example-prd-internal-tool.md`
   - `examples/example-prd-customer-facing.md`
   - `README.md` only when setup instructions need to reflect the configured context
7. If the user does not use Notion, remove or soften Notion-as-default assumptions in the starter docs and relevant skills that would otherwise imply a sync step is standard.
8. Stop after the initial setup pass. Do not try to rewrite the entire repo.

## Questions To Ask

Ask for these company defaults:
- author name
- company name
- one-sentence company description
- primary product surface: `Web`, `Mobile`, `Internal tooling`, or `Mixed`
- operating geographies
- whether the company is in financial services
- if yes, licenses held
- if yes, regulators
- applicable data protection regimes
- standard tech stack
- default audience assumptions
- common integration points

Ask this workflow branch next:
- whether they use Notion for PRDs, Epics, Stories, or related artefacts
- if yes:
  - where PRDs are tracked
  - where Epics are tracked
  - where Stories are tracked
  - any default Notion Project IDs by workstream or product area
  - whether there are any custom Notion fields they always want passed during sync
  - if yes, what those fields are, which database each applies to, and where the value should come from
- if no:
  - where PRDs, Epics, and Stories should live instead
  - whether the repo should stay fully local-first by default

Ask for team context:
- key team members
- titles or roles
- anything each person especially cares about, such as delivery speed, compliance, customer impact, analytics, polish, or platform consistency

Ask for current business context:
- org goals for the next period
- team goals for the next period
- known constraints, sensitivities, or stakeholder pressures
- anything else likely to shape PRDs, backlog trade-offs, or review standards

Use `AskQuestion` for structured choices where useful. Keep the rest concise and practical. Do not ask the entire checklist in one giant block if the conversation would be clearer in two short rounds.

## Update Rules

- Treat `context/company-context.md` as the canonical file.
- Prefer updating clearly labeled fields and bullets over freeform rewriting.
- Replace `{Company XYZ}` only in starter documents where it is clearly a placeholder.
- Do not replace example competitors, metrics, or product assumptions unless the user explicitly asks.
- If the user does not know a value, leave a clear placeholder rather than inventing one.
- If Notion is not used, update touched docs so they describe Notion as optional rather than assumed.
- If Notion is used, store the tracking locations, Project IDs, and any custom sync fields in `context/company-context.md` instead of scattering them across multiple setup docs.
- When touching skills, prefer small edits that teach them to read `context/company-context.md` rather than hardcoding one team's workflow.

## Output Expectations

After updating files:
- summarize what was captured
- mention any fields still left as placeholders
- mention whether the repo is now configured as `Notion-enabled` or `local-first`
- confirm that `context/preferences.md` is present and ready for use
- point the user to `context/company-context.md` for future edits and explain that `context/preferences.md` will accumulate preferences from future working sessions
