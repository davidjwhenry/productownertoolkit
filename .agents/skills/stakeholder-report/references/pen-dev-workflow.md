# pen.dev Workflow

Use this workflow when creating a new stakeholder report in pen.dev (formerly Pencil) or when inspecting an existing `.pen` artefact before HTML export.

## Tool surface

The pen.dev update consolidated the MCP tools. Everything runs through three tools, and the MCP server may still appear as `pencil` in client MCP lists:

- `get_app_state` — active file, selection, and document structure
- `get_guidelines` — built-in design guides and style archetypes
- `execute` — all reads and writes: `Get` (with plain JavaScript filters), `Insert`, `Copy`, `Update`, `Replace`, `Move`, `Delete`, `GetVariables`/`SetVariables`, `TakeScreenshot`, and `Export`

There is no `open_document` tool any more — open or create the `.pen` file in the editor, then work on the active document.

## Startup Sequence

1. Open the target `.pen` file in the editor (or create it, for a new report).
2. Immediately call `get_app_state` to confirm the active file and get the document structure.
3. If you need to inspect deeper structure, start with a shallow `execute` `Get` on top-level nodes before reading deeper sections.

## New Report Flow

1. Open `design-system/example-design-system.pen`.
2. Use `execute` `Get` and `GetVariables` to inspect reusable components, palette, and typography.
3. Decide the output path:
   - Prefer `[feature]/reports/` for feature work.
   - Prefer `examples/[name]/reports/` for examples.
4. Create a new `.pen` file at that path in the editor.
5. Build one frame per page by default using `execute` `Insert` and related operations:
   - Print-first reports: `794 × 1123 px` A4 frames
   - Browser-first dashboards: wider frames are acceptable
6. Apply the design system consistently across type, fills, borders, and spacing — `execute` `SetVariables` can sync tokens where appropriate.

## Existing `.pen` Inspection Flow

1. Open the supplied `.pen` file in the editor.
2. Call `get_app_state` to confirm the active file and map the top-level structure.
3. Use `execute` `Get` on the main frame or top-level nodes.
4. Read incrementally with progressively narrower JavaScript filters:
   - top-level sections first
   - then target sections with meaningful names
   - then specific cards, labels, or text groups only if needed
5. Use `execute` `TakeScreenshot` on the main frame before HTML export to confirm the visual layout and hierarchy.

## Reading Strategy

- Start shallow: map the structure with a broad `Get` before requesting full detail on any subtree.
- Use `execute` `GetVariables` when you need final colours and type values.
- Avoid reading the whole document deeply unless the report is very small.

## Translation Guidance

- Recreate the report semantically in HTML where possible.
- Preserve section hierarchy, card grouping, ordering, and text content.
- For icons, emoji, or small decorative graphics that do not export cleanly, use simple HTML fallbacks that preserve the intended meaning.
