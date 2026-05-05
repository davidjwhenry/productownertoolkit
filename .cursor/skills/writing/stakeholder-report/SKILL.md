---
name: stakeholder-report
description: Create polished, visually designed stakeholder reports as print-ready HTML artefacts. Use when the user wants to generate an executive report, status update, product summary, sprint review, dashboard, or any stakeholder-facing document. Supports both full report creation in Pencil and direct HTML export from an existing `.pen` file.
---

# Stakeholder Report

Use this skill for two common workflows:

1. **Create a new stakeholder report** — gather context, design in Pencil, review, then export to HTML.
2. **Export an existing `.pen` report to HTML** — inspect the supplied design, verify it visually, extract its structure, and recreate it as clean HTML.

## Phase 0: Load Preferences

- Read `context/preferences.md` — apply any relevant entries to report tone, visual style, density, page format, and stakeholder communication preferences.

## Phase 1: Context Gathering

If the user's prompt already answers a question, skip it. Gather missing context by asking the most critical questions first — avoid asking everything at once.

### Required context

1. **Subject** — What is this report about?
   - If the prompt references files or a feature folder, read those now (`requirements/`, `examples/`, `personal/notes/`) to extract key facts before asking the user.
   - If no context files are named, ask: *"What should this report cover? Point me to any relevant files, or describe the topic."*

2. **Audience** — Who will read this, and what do they care most about?
   - Probe for role (exec, engineering lead, customer, board) and the one or two things they want to walk away knowing.

3. **Format** — How many pages, and how dense?
   - Default: **single A4 page**, concise.
   - Offer: one-pager / two-pager / multi-page deck. Ask if unclear.

### Confirm before proceeding

Summarise your understanding in 3–5 bullet points and ask the user to confirm or correct before moving to design.

---

## Phase 2: Design in Pencil

See [references/pencil-workflow.md](references/pencil-workflow.md) for the full step-by-step Pencil workflow.

### Summary

1. If the user supplied a `.pen` file and asked for HTML, skip new design creation and move to the **Existing `.pen` shortcut** below.
2. Otherwise, open `design-system/example-design-system.pen` with `open_document`.
3. Immediately call `get_editor_state(include_schema: true)` before any read or write work.
4. Use `batch_get` to extract the colour palette, typography, and reusable component styles from the design system.
5. Determine the output path:
   - Prefer `[feature-folder]/reports/` (for example `requirements/savings/reports/`)
   - For examples, prefer `examples/[name]/reports/`
   - If the user points at an existing `.pen` file directly, it is acceptable to export the HTML alongside that file
6. Create a new `.pen` file at that path using `open_document('new')`, then rename/save it.
7. Build the design:
   - Default: one frame per A4 page (`794 × 1123 px`)
   - For dashboards or wide review artefacts, a wider canvas is acceptable if the user wants browser-first output rather than print-first output
8. Populate the report with the actual content: title, key metrics, narrative sections, charts, tables, gates, decisions, risks, and next steps as needed.

### Existing `.pen` shortcut

Use this path when the user asks for HTML from an already-designed `.pen` file.

1. Open the supplied `.pen` file with `open_document`.
2. Call `get_editor_state(include_schema: true)` immediately.
3. Use `batch_get` to inspect top-level nodes first.
4. Read deeper only where needed:
   - first top-level frames
   - then specific sections
   - then individual cards or text groups if structure is still unclear
5. Use `get_screenshot` on the main report frame to verify visual intent before rebuilding it in HTML.
6. Prefer **semantic reconstruction** in HTML:
   - recreate the layout as sections, cards, lists, headers, and metadata badges
   - carry over the real text content, hierarchy, colours, spacing, and grouping
   - do **not** default to flattening the design into a single image unless the user explicitly wants an image-based export
7. If icons, emoji, or complex vector details do not translate cleanly, use a simple HTML fallback that preserves meaning and hierarchy.

---

## Phase 3: Review & Refine

After completing the initial design:

1. Use `get_screenshot` to capture the canvas and show it to the user.
2. Ask: *"Here's the initial design — what would you like to adjust? (layout, content, colours, hierarchy, wording)"*
3. Iterate until the user confirms they are satisfied.

Do not proceed to HTML export until the user explicitly approves the design.

---

## Phase 4: HTML Export

See [references/html-export.md](references/html-export.md) for the A4 HTML template and export guidance.

### Summary

1. Use `batch_get` to extract the final layout, text content, colours, and structure from the `.pen` file.
2. Generate a single self-contained `.html` file:
   - for reports created in this workflow, use the same directory as the `.pen` file
   - for direct exports, place the HTML alongside the source `.pen` unless the user asks for another location
3. The HTML must:
   - Use the A4 print template (`210 mm × 297 mm` per page via `@page` CSS) when the artefact is print-first
   - Allow browser-first layouts when the source `.pen` is clearly a dashboard or wide screen artefact
   - Be fully self-contained (inline CSS, base64 images — no external dependencies)
   - Render correctly in a browser and print cleanly to PDF when applicable
4. Before finishing, verify:
   - the key sections from the `.pen` appear in the HTML
   - the text content was carried over accurately
   - colours, spacing, and card hierarchy are close to the source
   - `ReadLints` reports no issues in the new HTML file
5. Tell the user the file path and how to open or print it.

---

## File Conventions

| Artefact | Path |
|---|---|
| Design | `[feature]/reports/[slug].pen` |
| HTML export | `[feature]/reports/[slug].html` |
| Design system reference | `design-system/example-design-system.pen` |

If the user supplies an existing `.pen` file directly, place the HTML export alongside that file unless asked otherwise.

## Preference Observation

At the end of the session, if the user corrected report tone, adjusted layout density, changed how metrics or risks are presented, or expressed a repeatable preference:

- Propose adding it to `context/preferences.md` under the most relevant heading
- Confirm with the user before writing — never write silently
- Only record durable patterns, not one-off task instructions

Keep `.cursor` and `.claude` copies of this skill and its reference files in sync.
