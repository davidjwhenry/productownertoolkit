# Product Owner Toolkit

This file is the single instruction surface for Codex, Cursor, and Claude Code. Keep repository-wide agent instructions here rather than in a `CLAUDE.md`.

This is a markdown-first, local-first toolkit for Product Owners and PMs. It uses AI-assisted skills for PRD writing, backlog generation, review, research, meeting distillation, and stakeholder reporting.

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

<!-- productownertoolkit:begin -->
### Product Owner Toolkit

Before substantive drafting, reviewing, or presenting work, read:

1. `context/company-context.md` — company defaults, stack, compliance, delivery workflow
2. `context/team-context.md` — team members, stakeholder dynamics, working styles
3. `context/preferences.md` — learned preferences; apply them unless the user overrides them for the current task
4. `context/product-language.md` — canonical product and domain language, if relevant to the artefact

When a clear, reusable preference emerges in a session, propose an update to `context/preferences.md`. Never write it without the user's confirmation.

| Path | Purpose |
| --- | --- |
| `context/` | Company, team, preferences, and product-language context. Read before substantive drafting, reviewing, or presenting work. |
| `requirements/` | Requirement libraries by type (platform, customer, internal), feature folders, and product decisions in `requirements/decisions/`. |
| `backlog/` | Generated Epics and User Stories, grouped by Epic. |
| `testing/uat/test_cases/` | UAT test-case library, one JSON file per feature area. |
| `personal/` | Personal notes, to-dos, and reports. |
| `mcp-config/` | Setup guidance for the MCP servers the skills can use. |
| `conventions/` | Shared conventions such as markdown front matter. |
| `design-system/` | Design sources and immutable design profiles; `design-system/profiles/ACTIVE` pins the current profile. |
| `prototype-playground/` | Local app that validates, previews, and packages prototypes. Run `npm run validate` there after generating prototypes. |
| `examples/` | Worked examples: a PRD, prototypes, and an executive report. |

Skills: `bootstrap-context`, `product-grill`, `desktop-research`, `prd-writer`, `backlog-writing`, `prd-reviewer`, `backlog-review`, `meeting-distillation`, `stakeholder-report`, `weekly-review`, `uat-writer`, `design-system-setup`, `prototype-builder`, `prototype-reviewer`, `notion-sync`, `notion-drift`, and `skill-creator` (in `.claude/skills/` and `.agents/skills/`). Run `bootstrap-context` first to configure company context.
<!-- productownertoolkit:end -->

Toolkit development files in this repository:

| Path | Purpose |
|---|---|
| `toolkit/` | Canonical skill source (`toolkit/skills/`), the capability catalogue (`toolkit/catalogue.json`), and the template for the managed block above. Edit skills here, never in the agent mirrors |
| `.claude/skills/`, `.agents/skills/` | Generated agent mirrors of `toolkit/skills/` (Claude Code reads the first, Codex the second, Cursor both). Run `npm run generate` after changing `toolkit/`; CI fails when they drift |
| `cli/`, `scripts/` | Installer source and repository generators |
| `adapters/` | Alternative local-first setups |

## Writing Standards

- British spelling, serial commas
- Use `backticks` for event names, states, endpoints, and code-like identifiers
- Use **bold** for UI elements and emphasis
- Lead with what to do, then why
- Avoid "we" for product behavior — use the company name or "the app"
