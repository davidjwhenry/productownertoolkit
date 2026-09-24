# Prototype Contract

The feature-local layout and manifest rules the playground validator enforces. The schemas in `prototype-playground/schemas/` are the authority; this reference restates them for authoring.

## Layout

```text
requirements/<classification>/<feature>/prototypes/<prototype-id>/
  prototype.json
  variants/
    <variant-id>.html
  companions/                           # design-notes.json + optional `.pen` artefacts
  amendments.json                       # writeable review state (playground-owned)
  handoff/                              # generated only after review
```

Example fixtures use the equivalent `examples/<feature>/prototypes/<prototype-id>/` layout. The classification directory is one of `platform-requirements`, `customer-functional-requirements`, or `internal-functional-requirements`. The feature and prototype directory names must be kebab-case and the manifest `id` must equal its prototype directory name; each variant entry must be named `variants/<variant-id>.html`. The PRD must live in the same feature's `prd/` directory; companions in `companions/`.

## `prototype.json`

Requires:

- `schemaVersion: 1`, kebab-case `id`, `title`, `summary`, and positive integer `revision`
- `source.prd` (repository-root-relative Markdown path) and non-empty `source.requirementIds[]` traced to the PRD
- `designSystem: {id, version, fingerprint}` pinning the profile used to build; the fingerprint is `sha256:` plus 64 lowercase hex and must match the immutable version
- `brief: {primaryUser, job, journey, decision}` — who the experience serves, the progress they seek, the journey prototyped, and the decision statement the variants argue about (capture it from `product-grill` when it crystallised there)
- `variants[]` with unique kebab-case `id`, `label`, non-empty `hypothesis`, non-empty `tradeOffs[]`, one declarative HTML `entry`, and optional `screens[]`
- `surfaces[]` containing one or both of `desktop` and `ios`
- `scenarios[]` with unique kebab-case `id`, `label`, `description`, and `requirementIds[]`
- `defaults: {variant, surface, scenario, theme}` where every value resolves to a declared variant, surface, scenario, or pinned-profile theme
- non-empty `prototypeOnly[]` limitations
- optional `companions[]` with `kind` and repository-root-relative `path`

The two-variant default is skill policy, not a schema restriction: manifests may contain one or more variants.

## Screens

When a variant declares `screens`, the set must mirror the entry's `data-prototype-screen` ids exactly (every declared screen exists in the HTML; every HTML screen is declared). Each entry:

- `id` — the HTML screen id; declare the same id in sibling variants wherever the screens are equivalent so variant switches retain position
- `label`, `order` (unique per scenario), `scenarioId` — a declared scenario; a screen used by several scenarios is declared once per scenario (the pair `scenarioId` + `id` is unique)
- `prdRefs: [{ section, requirementIds }]` — dotted PRD section numbers that must resolve to the PRD's numbered headings; requirement IDs must be declared by `source.requirementIds` or a scenario
- `branch: true` — marks unhappy-path screens in the sub-menu
- `fixture: { values?, checked?, validation? }` — the state a direct jump hydrates: control `values` by `name` (radio groups take the option value), checkbox/radio `checked`, and `validation` messages by `data-prototype-validation-for` target. Every referenced control and validation target must exist in the entry HTML

## Companions

- `kind: "design-notes"` → `companions/design-notes.json` — `{ schemaVersion, notes: [{ id, section, label, quote, requirementIds }] }`. Quotes are verbatim PRD passages (job, trust, rules, scope); sections must resolve against the PRD. 3–5 notes, at most 12.
- Other kinds (`.pen` exploration artefacts) remain allowed; only `design-notes` is interpreted.

## Amendments

`amendments.json` beside the manifest is playground-owned write state: `{ schemaVersion, amendments: [{ id, screenId, requirementId, title, note, selection: { variantId, surfaceId, scenarioId, themeId, screenId }, author, date, status: open|resolved|dismissed }] }`. Screen and requirement references are validated; invalid entries are dropped with warnings, never fatal. The dev server writes it via the shell's amendment panel; skills and humans may edit it directly with the same validation applying.

## PRD Requirements

The feature PRD must use numbered headings (`## 5.1. Automated Funding`) for every section the prototype references; § refs, the Open-PRD link, and the design notes resolve against them. A PRD frontmatter `notion_url` enables the hosted Open PRD link.

## Bounds

IDs kebab-case, at most 64 characters. Labels and titles at most 160 characters. Requirement IDs at most 128. Free text at most 8 KiB and never ASCII control characters, U+2028, or U+2029. At most 8 variants, 256 screen declarations per variant, 32 scenarios, 256 requirement IDs, 64 limitations, and 32 companions; at most 12 design notes and 128 amendments. Variant HTML at most 10 MiB.

## Self-Contained HTML

Every entry is a full document — doctype, `<html lang>`, exactly one non-empty `<title>`, viewport metadata, semantic HTML — with inline CSS, inline SVG, and `data:` assets only. Forbidden everywhere: executable `<script>`, inline event handlers, `javascript:` URLs, `<base>`, `<meta http-equiv>`, `iframe`/`frame`/`portal`, `object`/`embed`, form `action`/`target`/`formaction`, CSS `@import`, and any nested browsing or navigation input. `href` is permitted only as a same-document fragment. Resource URLs are permitted only as `data:` on image, media, or font attributes, or as `data:` in CSS `url()`.

## Validation Outcomes

`cd prototype-playground && npm run validate` reports:

- `PROTOTYPE_SCHEMA_INVALID` — schema violations, path-derived identity mismatch, unresolvable defaults, cross-field disagreements
- `PROTOTYPE_ID_DUPLICATE` — a duplicated prototype id invalidates every duplicate
- `SOURCE_NOT_FOUND` — missing PRD, entry, or companion
- `PATH_NOT_AUTHORISED` — path escape, symlink, cross-feature PRD, or entry outside its `variants/`
- `ENTRY_NOT_SELF_CONTAINED` — forbidden element, URL, or declarative-graph violation
- `SCREEN_NOT_IN_ENTRY` / `SCREEN_UNDECLARED` — declared screens and the entry's screen set disagree
- `PRD_SECTION_UNRESOLVED` — a § reference matching no numbered PRD heading
- `SCREEN_REF_UNKNOWN` / `NOTE_REF_UNKNOWN` / `AMENDMENT_REF_UNKNOWN` — requirement IDs the manifest does not declare
- `FIXTURE_CONTROL_UNKNOWN` / `FIXTURE_VALIDATION_TARGET_UNKNOWN` — fixtures referencing controls or validation targets absent from the entry
- `PROFILE_FINGERPRINT_MISMATCH` / `PROFILE_SCHEMA_INVALID` — pinning disagreements
- `FILE_TOO_LARGE` — variant HTML over 10 MiB

Warnings (never fatal): `DESIGN_NOTES_INVALID`, `NOTE_SECTION_UNRESOLVED`, `AMENDMENTS_INVALID`, `AMENDMENT_SCREEN_UNKNOWN`, `PRD_SECTION_MAP_EMPTY`.

Opening a raw variant without the host presents its first screen statically; the generated hand-off is the supported standalone interactive artefact.
