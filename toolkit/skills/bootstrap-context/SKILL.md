---
name: bootstrap-context
description: Capture company-specific setup details for this toolkit and write them into the canonical context files. Use after cloning or installing the toolkit, when setting up the toolkit for a new company, when replacing `{Company XYZ}` placeholders, or when the user asks to configure the repo for their organisation. Covers company defaults, Notion-vs-local workflow decisions, team context, current business goals, and, when the prototyping capability is installed, finding the repository's own design system so prototypes stop defaulting to the sample one.
---

# Bootstrap Context

Use this skill for the initial setup pass after cloning or installing the toolkit.

Only write the context files named below; the design profile is written by `design-system-setup` through its own approval gate, never directly by this skill. Skill files, their references, and the examples are toolkit-managed: an installed toolkit replaces them on update, so edits there would be lost or block the update. Skills read company details from `{content}/context/company-context.md` instead, and `{Company XYZ}` in their templates stands for the company named there.

## Workflow

1. Read `{content}/context/company-context.md` first.
2. Confirm whether the user actively uses Notion in this workflow before asking any Notion-specific setup questions.
3. Ask the user for the missing company defaults, team context, and current business context.
4. Normalize the answers into concise, reusable values.
5. Update `{content}/context/company-context.md` as the source of truth.
6. Verify `{content}/context/preferences.md` exists. If it is missing, create it from the standard template with empty placeholder sections. Do not pre-populate preferences during bootstrap — they are learned from usage.
7. Update `{content}/context/team-context.md` with the team context and `{content}/context/product-language.md` with any product terms the user supplies.
8. Record whether the workflow is `Notion-enabled` or `local-first` in `{content}/context/company-context.md`. Skills read this value, so do not edit skills to remove Notion assumptions.
9. If `.product-owner-toolkit/installation.json` exists, set `configuration.status` to `complete` and `configuration.completedAt` to the current ISO 8601 timestamp, but only after every context write above has succeeded. Change no other field in that file.
10. If the prototyping capability is installed, set up the design system (see below).
11. Stop after the initial setup pass. Do not try to rewrite the entire repo.

## Design System

Run this step only when `{content}/design-system/` and the `design-system-setup` skill are both present. Skip it silently otherwise. It comes after the context files are written, so an abandoned design-system proposal never leaves the company context half-configured.

The toolkit ships a sample design profile. Until a real one replaces it, every prototype renders in the sample system.

1. Read `{content}/design-system/profiles/ACTIVE` and the pinned `profile.json`. If its sources already go beyond `example-design-system.pen`, a real design system is in place: report the active version and move on.
2. Otherwise, look for a design system in the repository, following **Discovering Sources In The Repository** in the `design-system-setup` skill: pen.dev files, CSS custom properties, Design Tokens Format Module files, design guidance in Markdown, tokens defined in code such as a Tailwind or theme configuration, and component libraries.
3. If candidates are found, list them with their paths and what each would contribute (tokens, components, assets, guidance), then continue into `design-system-setup` to compile them. Its proposal gate still applies: nothing is copied or written until the user approves the plan.
4. If nothing is found, ask: "Do you have a design system you want to add as a folder that I can bring in as a reference?" If the user points to a folder, run `design-system-setup` on it.
5. If the user has none, or would rather do it later, keep the sample profile. Say plainly that prototypes will use the sample system for now, and that running `design-system-setup` at any time replaces it.

Do not invent tokens, colours, or components to fill a gap, and do not treat the sample profile as the company's design system in any context file.

## Questions To Ask

Ask for these company defaults:
- author name
- company name
- one-sentence company description
- product surfaces: any combination of `Web`, `Mobile`, and `Internal tooling` (ask as a multi-select, since many companies ship on more than one)
- operating geographies
- licensing, using the fixed script in **Licensing Questions** below
- data protection regimes, using the fixed script in **Data Protection Questions** below
- standard tech stack
- default audience assumptions
- common integration points

### Licensing Questions

Ask these exactly as written, in this order, every time. Do not reword them, add or remove options, or merge them into another question.

1. **"What level of financial-services licensing does the company hold?"** Single choice, with exactly these three options in this order:
   - `Unlicensed`
   - `Full bank licence`
   - `Non-bank FI`
2. Only if the answer is `Full bank licence` or `Non-bank FI`: **"In what jurisdiction is the licence held?"** Free text.
3. Only if the answer is `Non-bank FI`: **"What type of licence does the company hold?"** Free text.

Rules:

- Offer no default, example, or suggested answer for any of the three: no pre-selected level, no named country or regulator, no sample licence type. Do not infer the jurisdiction from the operating geographies or anything else in the conversation.
- Questions 2 and 3 are free-text inputs, never a list of choices.
- If the user is `Unlicensed`, skip questions 2 and 3 and record both as `None`.
- Record the answers verbatim.

### Data Protection Questions

Ask this exactly as written, every time. Do not reword it or add, remove, rename, or reorder options.

1. **"Which data protection regimes apply to the company?"** Multiple choice, with exactly these six options in this order:
   - `EU GDPR`
   - `UK GDPR`
   - `USA Onshore`
   - `UAE PDPL`
   - `Other`
   - `None`
2. Only if `Other` is selected: **"Which other data protection regimes apply?"** Free text.

Rules:

- Pre-select nothing. Do not infer regimes from the operating geographies, the licence jurisdiction, or anything else in the conversation.
- `None` stands alone. If the user selects it with another option, ask which they meant.
- Record each selected option verbatim, one per bullet, replacing `Other` with what the user typed. If the answer is `None`, record `None`.

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

Use `AskQuestion` for structured choices where useful, with multi-select enabled for questions that can have more than one answer, such as product surfaces. Keep the rest concise and practical. Do not ask the entire checklist in one giant block if the conversation would be clearer in two short rounds.

Ask the questions in the order listed. Never pre-fill or suggest an answer from a guess about the company, such as a country, a regulator, an industry, or a type of bank; placeholders and examples stay neutral.

## Update Rules

- Treat `{content}/context/company-context.md` as the canonical file.
- Prefer updating clearly labeled fields and bullets over freeform rewriting.
- Do not replace example competitors, metrics, or product assumptions unless the user explicitly asks.
- If the user does not know a value, leave a clear placeholder rather than inventing one.
- If Notion is used, store the tracking locations, Project IDs, and any custom sync fields in `{content}/context/company-context.md` instead of scattering them across multiple setup docs.
- Never edit skill files, `{toolkit}/mcp-config/`, `{toolkit}/conventions/`, or `{content}/examples/`.

## Output Expectations

After updating files:
- summarize what was captured
- mention any fields still left as placeholders
- mention whether the repo is now configured as `Notion-enabled` or `local-first`
- confirm that `{content}/context/preferences.md` is present and ready for use
- when the prototyping capability is installed, state which design system prototypes will use: the newly compiled profile and its sources, an existing real profile, or the sample system
- point the user to `{content}/context/company-context.md` for future edits and explain that `{content}/context/preferences.md` will accumulate preferences from future working sessions
