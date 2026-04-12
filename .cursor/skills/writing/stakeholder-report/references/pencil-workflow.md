# Pencil Workflow

Use this workflow when creating a new stakeholder report in Pencil or when inspecting an existing `.pen` artefact before HTML export.

## Startup Sequence

1. Open the target document with `open_document`.
2. Immediately call `get_editor_state(include_schema: true)`.
3. If you need to inspect structure, start with `batch_get` on top-level nodes before reading deeper sections.

## New Report Flow

1. Open `design-system/example-design-system.pen`.
2. Use `batch_get` to inspect reusable components, palette, and typography.
3. Decide the output path:
   - Prefer `[feature]/reports/` for feature work.
   - Prefer `examples/[name]/reports/` for examples.
4. Create a new `.pen` file with `open_document('new')`.
5. Build one frame per page by default:
   - Print-first reports: `794 × 1123 px` A4 frames
   - Browser-first dashboards: wider frames are acceptable
6. Apply the design system consistently across type, fills, borders, and spacing.

## Existing `.pen` Inspection Flow

1. Open the supplied `.pen` file.
2. Use `batch_get` on the main frame or top-level nodes.
3. Read incrementally:
   - top-level sections first
   - then target sections with meaningful names
   - then specific cards, labels, or text groups only if needed
4. Use `get_screenshot` on the main frame before HTML export to confirm the visual layout and hierarchy.

## Reading Strategy

- Prefer a shallow first read (`readDepth` around `1` or `2`) to map the structure.
- Use `resolveVariables: true` when you need final colours and type values.
- Use `resolveInstances: true` when reusable components hide the real child structure.
- Avoid reading the whole document deeply unless the report is very small.

## Translation Guidance

- Recreate the report semantically in HTML where possible.
- Preserve section hierarchy, card grouping, ordering, and text content.
- For icons, emoji, or small decorative graphics that do not export cleanly, use simple HTML fallbacks that preserve the intended meaning.
