# HTML Export

Use this guide when turning a stakeholder report `.pen` file into a clean HTML artefact.

## Export Goal

Generate a self-contained HTML file that preserves the report's meaning and visual hierarchy:

- title and metadata
- section ordering
- card layout and grouping
- key colours and spacing
- decision gates, metrics, risks, and narrative content

## Preferred Approach

Prefer semantic reconstruction over image export.

- Rebuild the design as HTML sections, cards, lists, and headings.
- Carry over the real copy from the `.pen` file.
- Use CSS for borders, fills, spacing, shadows, and badges.
- Do not flatten the report into a screenshot unless the user explicitly wants that.

## Layout Choice

Choose the output format based on the source artefact:

- Print-first report: use an A4 page template with `@page { size: A4; }`
- Browser-first dashboard: use a responsive screen layout that still prints acceptably if needed

## HTML Requirements

- Single self-contained `.html` file
- Inline CSS
- No external dependencies
- Accessible structure where practical (`main`, `section`, headings, lists, progressbar labels)
- Print-safe colours and spacing for report-style outputs

## Practical Workflow

1. Inspect the `.pen` structure with `execute` `Get`.
2. Capture a screenshot of the main report frame with `execute` `TakeScreenshot`.
3. Reconstruct the main sections in HTML.
4. Translate visual tokens:
   - pills and badges -> inline-flex spans
   - cards -> bordered containers with radius and shadow
   - metric blocks -> title/value/supporting copy
   - gates or decision banners -> high-contrast sections
5. For icons or emojis that do not map cleanly, use text fallbacks rather than blocking the export.

## Verification Checklist

Before finishing:

1. Compare the HTML against the screenshot and structure read from pen.dev.
2. Confirm the main sections and card groups are present.
3. Confirm all important text content was carried over.
4. Check that colours, spacing, and hierarchy are reasonably faithful.
5. Run `ReadLints` on the new HTML file.
6. Tell the user where the file was written and whether it is print-first or browser-first.
