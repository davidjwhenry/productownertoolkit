# Profile Contract

The exact storage, source, precedence, and version rules the design profile and its validator enforce. The playground (`prototype-playground/`) is the authority; this reference restates the contract for authoring.

## Storage Layout

```text
design-system/
  example-design-system.pen             # preserved example raw source
  sources/<source-id>/                  # copied external local inputs
  profiles/
    ACTIVE                               # exactly two LF-terminated lines
    v001/
      profile.json
      tokens.css
      components.json
      assets.json
      assets/                            # present only when files exist
      guidance/                          # present only when normalised guidance exists
```

- Every `vNNN/` directory is immutable once committed. Fixes mean a new version, not edits.
- Never create empty `assets/` or `guidance/` directories.
- `ACTIVE` contains exactly `vNNN\nsha256:<64 lowercase hex>\n` — the version directory, then the fingerprint.

## `profile.json`

Requires `schemaVersion: 1`, `id` (stable kebab-case; the shipped profile uses `default`), `version` matching the containing `vNNN` directory, `name`, `sources`, `themes`, `defaultTheme`, and version-relative `runtimeCss`, `componentCatalogue`, and `assetCatalogue` paths. Optional `guidance` lists version-relative paths.

Two optional blocks pin the playground chrome:

- `deviceChrome` — the device frame geometry for both surfaces (`desktop: {titleBarHeight, outerRadius}`, `ios: {bezel, outerRadius, island, homeIndicator, safeArea}`), in pixels. When present, the shell's preview frames and safe areas render from these values; when absent, the contract presets apply (desktop 1440 × 900 behind a 42 px title bar; iOS 393 × 852 in a 12 px bezel, 54 px outer radius, 59/34 px safe areas). Record it whenever the profile's device targets differ from the presets.
- `layout` — the shell column rhythm (`railWidth`, `flowWidth`, `notesWidth`, `stageMaxWidth`). The active profile's values drive the playground's column widths; the shipped values are `228`, `260`, `292`, and `660` (Gallery direction). Record it whenever the shell layout is deliberately re-tuned.

Each source has a unique kebab-case `id`, a `kind` of `pen`, `css`, `dtcg`, `markdown`, or `figma`, `roles` drawn from `tokens`, `components`, `assets`, and `guidance`, and a `required` flag. Local sources carry a repository-root-relative `path` plus the SHA-256 of their raw bytes. Figma sources carry an HTTPS `uri` and a recorded source/version key instead — never both forms.

Sources are ordered from lowest to highest precedence. The merge order used by this skill: example fallback, optional Figma extraction, existing canonical local sources, explicitly supplied current sources.

`themes` lists one or more unique `{id, label}` pairs; `defaultTheme` must name one of them.
## `tokens.css`

Default values live under `:root, [data-design-theme="<default>"]` and each other theme under `[data-design-theme="<theme-id>"]`. Preserve semantic CSS names such as `--background`, `--foreground`, `--primary`, `--border`, and the status colours. Convert numeric radii to pixel values. Expand font families to local/system fallback stacks — no `@import`, no `url()`, no remote fonts.

## `components.json` and `assets.json`

Both use `schemaVersion: 1`. Components carry `id`, `name`, `variants[]`, `sourceIds[]`, and optional `usage`; preserve slash-delimited source names such as `Button/Default` by grouping on the first segment. Assets carry `id`, `kind` (`image`, `icon`, or `font`), version-relative `path`, `mediaType`, `sourceIds[]`, and optional font metadata. Empty catalogues are valid; missing referenced files are not.

## Fingerprint

Sort every regular file under the version directory lexically by POSIX relative path and feed SHA-256 with `path + NUL + raw bytes + NUL` per file. `ACTIVE` records that fingerprint and sits outside the digest. The pointer, the directory name, `profile.json`'s `version`, and the recomputed fingerprint must all agree.

## Limits

IDs are kebab-case, at most 64 characters. Paths at most 1,024 characters. Schema/catalogue JSON and `tokens.css` at most 1 MiB; guidance files 5 MiB; generated assets 25 MiB; at most 1,000 files and 100 MiB per version; local raw sources at most 100 MiB each and 250 MiB total. At most 32 sources and 16 themes.

## Validation Outcomes

`cd prototype-playground && npm run validate` must pass with zero errors before `ACTIVE` is written. The validator reports:

- `PROFILE_POINTER_INVALID` — missing `ACTIVE`, wrong grammar, or directory/version disagreement
- `PROFILE_SCHEMA_INVALID` — schema violations, duplicate source/component/asset IDs, undeclared default theme
- `PROFILE_FINGERPRINT_MISMATCH` — immutable bytes changed after `ACTIVE` was written
- `PROFILE_TOO_LARGE` / `FILE_TOO_LARGE` — size or count limits exceeded
- `SOURCE_NOT_FOUND` — referenced runtime, asset, or guidance file missing
- `PATH_NOT_AUTHORISED` — path escape, symlink, or special file inside the profile
- `SOURCE_DRIFT` (warning) — a raw local source is missing or hash-drifted; the immutable profile remains usable
