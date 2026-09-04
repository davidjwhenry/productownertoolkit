# Product Owner Toolkit

This is a markdown-first, local-first toolkit for Product Owners and PMs. It uses AI-assisted skills for PRD writing, backlog generation, review, research, meeting distillation, and stakeholder reporting.

## Context Files

Before any substantive drafting, reviewing, or presenting work, read:

1. `context/company-context.md` — company defaults, stack, compliance, delivery workflow
2. `context/team-context.md` — team members, stakeholder dynamics, working styles
3. `context/preferences.md` — learned user preferences from previous sessions
4. `context/product-language.md` — canonical product and domain language, if relevant to the artefact

Apply preferences from `context/preferences.md` to output unless the user gives an explicit instruction that overrides them for the current task.

## Preference Memory

This toolkit maintains a lightweight preference memory across sessions via `context/preferences.md`.

### Reading preferences

Every skill that produces user-facing output should read `context/preferences.md` during its setup or research phase and respect any relevant entries.

### Writing preferences

At the end of a session, if a clear, reusable preference was observed (the user corrected tone, asked for more or less detail, changed a naming convention, expressed a formatting preference, or redirected a workflow step), propose an update to `context/preferences.md`.

Rules for proposing preference updates:

- Confirm with the user before writing. Never write silently.
- Only record durable patterns, not one-off task instructions.
- If a new preference conflicts with an existing entry, propose replacing the old one.
- Keep entries concise: one bullet per preference.
- Place entries under the most relevant heading in the file.

## Repo Structure

| Path | Purpose |
|---|---|
| `context/` | Canonical working context — company, team, preferences, product language |
| `requirements/` | Requirement libraries by type (platform, customer, internal), plus cross-cutting product decisions |
| `backlog/` | Generated backlog items grouped by Epic |
| `testing/` | UAT test-case library — one JSON file per feature area under `testing/uat/test_cases/` |
| `examples/` | Worked examples |
| `personal/` | Personal notes, to-dos, reports |
| `design-system/` | Brand tokens, voice/tone, UI patterns; immutable design profiles under `design-system/profiles/` with the `ACTIVE` pointer |
| `prototype-playground/` | Local, read-only web app that discovers, validates, previews, compares, and packages declarative repository prototypes; run `npm run validate` from here after generating prototypes |
| `.agents/skills/` | Codex-discoverable copies of the repo skills (`design-system-setup`, `prototype-builder`, `product-grill`) |

## Writing Standards

- British spelling, serial commas
- Use `backticks` for event names, states, endpoints, and code-like identifiers
- Use **bold** for UI elements and emphasis
- Lead with what to do, then why
- Avoid "we" for product behavior — use the company name or "the app"
