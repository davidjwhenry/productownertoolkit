---
name: scan-first-design
description: Design, implement, or improve product interfaces around scannability, data, task hierarchy, and complete interaction states. Use for dashboards, tables, forms, settings, and other application screens, including focused UI reviews and design work on pen.dev `.pen` canvases.
---

# Scan-first design

Create interfaces where users can find the answer they came for, understand what matters, and act with confidence. Apply these principles to the requested scope; a small polish request does not require a full redesign.

Respect the existing product, design system, repository instructions, and user preferences. Inspect relevant design guidance and nearby screens before choosing components or changing tokens. Extend established patterns when they serve the task. Do not impose a new framework, paid service, or aesthetic.

## Toolkit setup

Read `{content}/context/company-context.md`, `{content}/context/team-context.md`, `{content}/context/preferences.md`, and relevant `{content}/context/product-language.md` before substantive work.

For prototypes, read the manifest and its pinned design profile, including any `guidance` files and component `usage` notes. For new prototypes, read `{content}/design-system/profiles/ACTIVE`. Distinguish the playground shell from the embedded product: shell colours, navigation, and device chrome are not automatically product design tokens.

Apply these principles within the requested scope and the prototype runtime's supported interactions. A component inventory does not establish rendering or behaviour: inspect the source and usage guidance. Record missing system decisions explicitly; do not invent canonical tokens or silently change the pinned profile. Profile changes go through `design-system-setup`; prototype changes follow `prototype-builder` and its existing approval gates.

## Start with the task and data

Identify the user's main question, the action that follows, and the information needed to decide. Infer these from available context; ask only when uncertainty would materially change the design. Choose an appropriate density for the task: marketing pages and operational dashboards need different treatment.

Let the data determine the representation. Tables support comparisons across consistent fields; timelines expose chronology; charts reveal meaningful trends; lists support scanning and action. Choose charts only when they answer a question better than raw values. Use realistic content, long labels, missing values, and relevant status variations to shape the layout.

Align comparable numbers by place value with consistent units and precision; use tabular numerals where useful. Use chips for meaningful bounded categories or statuses, not every field. Truncated text needs a practical way to reveal the full value. Maintain readability for inactive records.

## Make the screen easy to scan

- Establish deliberate alignment edges for labels, values, actions, and repeated rows. Use shared columns and baselines; avoid centring content that users must compare or scan repeatedly.
- Group by useful distinctions such as status, date, owner, or workflow stage. Keep related elements close and separate distinct groups. Diagnose undifferentiated content before adding more whitespace.
- Give the primary information and action clear relative emphasis. When everything is bold, colourful, or boxed, reduce competing emphasis before strengthening the target.
- Keep defaults calm; highlight changes, selection, urgency, or exceptions when they matter. Do not mute a default primary action that the user needs to find.
- Prefer recognisable visual cues when they reduce reading. Unfamiliar icons need labels or explanation. Preserve precise text when accuracy matters.
- Create structure with alignment, spacing, sections, and occasional separators. Add a card when the content needs a distinct grouping or surface; avoid nested borders and radii without a purpose.

## Apply a coherent visual system

Reuse existing tokens. Otherwise establish a restrained type scale, consistent spacing increments, semantic colours, and surface hierarchy. Use grids as aids to consistency and responsiveness, not as constraints that override the content.

Use typography suited to information density. One well-chosen font family often suffices. Tight tracking and compact line heights can suit large headings; judge the actual font and content rather than applying them to body text. Numbers such as a four-point spacing scale, 24px dashboard headings, or 2:1 horizontal-to-vertical button padding are heuristics, not requirements.

Assign colour a meaning and preserve it across components. Distinguish brand actions, selection, and status. Never rely on colour alone to communicate essential meaning. Build accessible text and surface combinations before adding decorative variations.

Use restrained shadows for elevation in light themes. In dark themes, distinguish surfaces with tonal changes and controlled borders; tune saturation and brightness separately rather than simply inverting colours. Check each supported theme independently.

Size icons in relation to nearby type and their optical weight while preserving adequate interaction targets. For text over images, test contrast across the actual image; use a localized gradient or other treatment when it preserves readability and useful image detail.

## Design the working interface

Keep frequent and important actions visible. Reveal secondary actions through contextual menus, popovers, drawers, or other suitable controls when that reduces clutter without harming discovery. Do not hide useful functionality merely to repair an awkward composition. Preserve context when possible, but use a dedicated page for tasks that need space, navigation, or sustained work.

Account for the states relevant to the requested interaction:

- Controls: default, hover, keyboard focus, pressed or selected, disabled with an understandable reason, and pending when an action takes time.
- Data: loading, empty, filtered to no results, success, partial content, error, and a practical recovery path where applicable.
- Forms: labels and guidance, focus, validation, submission progress, errors, and completion feedback.
- Contextual UI: opening and closing, dismissal, keyboard behaviour, focus handling, accessible names, and return to the originating task.

Confirm meaningful actions such as copying, saving, or changing a value. Use motion to clarify continuity or feedback; respect reduced-motion preferences. Tooltips supplement understanding and must not be the only route to essential information. Hover-revealed actions also need keyboard and touch access.

For onboarding, introduce useful actions in context and sequence guidance around progress. Avoid explaining the entire product before the user can do anything.

## Verify the result

Match verification to scope. For implementation, inspect the rendered UI and exercise affected flows with the available tools; do not infer visual quality from code alone. For a design artifact or review, evaluate the actual artifact and identify unverified behaviour explicitly.

Use concrete tasks: Can the user find the relevant record, recognise an exception, compare values, and locate the next action? Check realistic long and empty content, supported viewport widths, keyboard access, contrast, focus visibility, and affected themes. Verify pending, failure, and completion behaviour when relevant. Fix problems found before reporting completion.

Finish with a concise account of what changed, why it helps the task, and what was verified. In a review, tie recommendations to a specific user difficulty and suggest a concrete correction; separate usability failures from stylistic preferences.

## Working in pen.dev

Use pen.dev (formerly Pencil) when the requested deliverable is a design canvas rather than code: a screen exploration, a state specification, or a visual reference stakeholders can react to. Its MCP server may still be listed as `pencil`. If the tools are unavailable, follow `{toolkit}/mcp-config/pen-dev.md` for setup; do not change unrelated agent configuration. pen.dev helps explore and specify, but it is never required to implement or prototype a screen.

- Open or create the target `.pen` file in the editor, then call `get_app_state` to confirm the active file, selection, and document structure. There is no tool to open documents. Keep prototype explorations under the prototype's `companions/` folder.
- Call `get_guidelines` before design operations, then inspect the existing canvas with a shallow `execute` `Get` and read deeper with narrower JavaScript filters. Use `execute` `GetVariables` to read tokens. Start from the pinned profile's raw `.pen` source, such as `{content}/design-system/example-design-system.pen`, and reuse its components, variables, and patterns.
- Build editable canvas content incrementally, one visual group at a time, with `execute` `Insert`, `Copy`, `Update`, `Replace`, and `Move`. Give frames and layers meaningful names, and bind fills, type, and spacing to variables rather than raw values.
- Variables alone are invisible. When creating or extending a token system with `execute` `SetVariables`, also build a visible swatch, type, and spacing reference wired to those variables. Token changes to the design system itself go through `design-system-setup`.
- Represent relevant interaction states as clearly named variants or frames. Distinguish visual specifications from implemented behaviour.
- Run `execute` `TakeScreenshot` after meaningful changes and correct clipping, alignment, contrast, and unresolved variable values. Fit frame height to content when appropriate.
- When done, report the `.pen` file path and what each frame shows. Use `execute` `Export` only when the user asks for an image, PDF, or HTML copy.
