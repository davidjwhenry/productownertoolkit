# Prototype Contract

The feature-local layout and manifest rules the playground validator enforces. The schemas in `prototype-playground/schemas/` are the authority; this reference restates them for authoring.

## Layout

```text
requirements/<classification>/<feature>/prototypes/<prototype-id>/
  prototype.json
  variants/
    <variant-id>.html
  companions/                           # optional `.pen` or other source artefacts
  handoff/                              # generated only after review
```

Example fixtures use the equivalent `examples/<feature>/prototypes/<prototype-id>/` layout. The classification directory is one of `platform-requirements`, `customer-functional-requirements`, or `internal-functional-requirements`. The feature and prototype directory names must be kebab-case and the manifest `id` must equal its prototype directory name; each variant entry must be named `variants/<variant-id>.html`. The PRD must live in the same feature's `prd/` directory; companions in `companions/`.

## `prototype.json`

Requires:

- `schemaVersion: 1`, kebab-case `id`, `title`, `summary`, and positive integer `revision`
- `source.prd` (repository-root-relative Markdown path) and non-empty `source.requirementIds[]` traced to the PRD
- `designSystem: {id, version, fingerprint}` pinning the profile used to build; the fingerprint is `sha256:` plus 64 lowercase hex and must match the immutable version
- `brief: {primaryUser, job, journey, decision}` — who the experience serves, the progress they seek, the journey prototyped, and what the variants must learn
- `variants[]` with unique kebab-case `id`, `label`, non-empty `hypothesis`, non-empty `tradeOffs[]`, and one declarative HTML `entry`
- `surfaces[]` containing one or both of `desktop` and `ios`
- `scenarios[]` with unique kebab-case `id`, `label`, `description`, and `requirementIds[]`
- `defaults: {variant, surface, scenario, theme}` where every value resolves to a declared variant, surface, scenario, or pinned-profile theme
- non-empty `prototypeOnly[]` limitations
- optional `companions[]` with `kind` and repository-root-relative `path`

The two-variant default is skill policy, not a schema restriction: manifests may contain one or more variants.

## Bounds

IDs kebab-case, at most 64 characters. Labels and titles at most 160 characters. Requirement IDs at most 128. Free text at most 8 KiB and never ASCII control characters, U+2028, or U+2029. At most 8 variants, 32 scenarios, 256 requirement IDs, 64 limitations, and 32 companions. Variant HTML at most 10 MiB.

## Self-Contained HTML

Every entry is a full document — doctype, `<html lang>`, exactly one non-empty `<title>`, viewport metadata, semantic HTML — with inline CSS, inline SVG, and `data:` assets only. Forbidden everywhere: executable `<script>`, inline event handlers, `javascript:` URLs, `<base>`, `<meta http-equiv>`, `iframe`/`frame`/`portal`, `object`/`embed`, form `action`/`target`/`formaction`, CSS `@import`, and any nested browsing or navigation input. `href` is permitted only as a same-document fragment. Resource URLs are permitted only as `data:` on image, media, or font attributes, or as `data:` in CSS `url()`.

## Validation Outcomes

`cd prototype-playground && npm run validate` reports:

- `PROTOTYPE_SCHEMA_INVALID` — schema violations, path-derived identity mismatch, unresolvable defaults, cross-field disagreements
- `PROTOTYPE_ID_DUPLICATE` — a duplicated prototype id invalidates every duplicate
- `SOURCE_NOT_FOUND` — missing PRD, entry, or companion
- `PATH_NOT_AUTHORISED` — path escape, symlink, cross-feature PRD, or entry outside its `variants/`
- `ENTRY_NOT_SELF_CONTAINED` — forbidden element, URL, or declarative-graph violation
- `PROFILE_FINGERPRINT_MISMATCH` / `PROFILE_SCHEMA_INVALID` — pinning disagreements
- `FILE_TOO_LARGE` — variant HTML over 10 MiB

Opening a raw variant without the host presents its first screen statically; the generated hand-off is the supported standalone interactive artefact.
