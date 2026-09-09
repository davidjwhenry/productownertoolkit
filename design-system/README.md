# Design System

This folder stores reusable brand and UI reference material that drafting and reporting workflows can reuse, plus the compiled design profiles the prototype playground renders against.

## Put Here

- Brand tokens
- Voice and tone guidance
- UI patterns or component references
- pen.dev (`.pen`) files or other design artefacts used as examples

## Raw sources versus immutable profiles

The folder has two distinct layers:

- **Raw sources** stay as authored: `example-design-system.pen` (an example source, preserved in place) and any inputs copied under `design-system/sources/<source-id>/` by the `design-system-setup` skill. Edit these freely; they are inputs, not outputs.
- **Immutable profiles** live under `design-system/profiles/`. Each `vNNN/` directory (`profile.json`, `tokens.css`, `components.json`, `assets.json`, plus `assets/` and `guidance/` when files exist) is a generated snapshot that prototypes pin by fingerprint. Never edit a committed `vNNN/`; fixes mean a new version.

`design-system/profiles/ACTIVE` points at the version the playground treats as current. It is exactly two LF-terminated lines: the `vNNN` directory name, then `sha256:<64 lowercase hex>` — the fingerprint of every file in that version, sorted by path and fed to SHA-256 as `path + NUL + bytes + NUL` per file. The `design-system-setup` skill writes a new version and updates `ACTIVE` only after `cd prototype-playground && npm run validate` passes with zero errors.

## Rules

- Keep source-of-truth design references here, not inside `examples/` (if it still exists).
- Prefer reusable system guidance over one-off screen mocks.
- If a file is only illustrative, label it clearly as an example; `example-design-system.pen` is the example source for the shipped `default@v001` profile.
- Keep this folder focused on assets and guidance that can support multiple artefacts.
- Never edit `design-system/profiles/<vNNN>/` in place or rewrite `ACTIVE` by hand; use `design-system-setup`.
