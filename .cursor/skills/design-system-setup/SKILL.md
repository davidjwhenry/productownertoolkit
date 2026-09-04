---
name: design-system-setup
description: Compile or update the repository's immutable design profile from local pen.dev `.pen` files, CSS custom-property files, Design Tokens Format Module files, Markdown guidance, or optional Figma extraction. Use when the user supplies design source material, asks to version the design system, or the playground reports no active profile. Proposes a source/precedence/theme plan, waits for approval, writes the next `vNNN` snapshot, validates it, and only then updates `ACTIVE`.
---

# Design System Setup

Create the next immutable design-profile version from real source material. The generated profile is read-only output: never edit a committed `vNNN/` directory, and never build prototypes from this skill.

- read context, inventory sources, resolve conflicts, and get approval before writing anything
- use local files first; Figma only when the user supplies it and the Figma MCP is available
- surface every token and component conflict instead of silently winning
- stop before profile creation on a missing required source, an unresolved conflict, an unsupported token value, or an unapproved overwrite
- never fabricate brand tokens, components, or assets; unknown values stay absent and explicitly reported

## References

Read before proposing a version:

- **[references/profile-contract.md](references/profile-contract.md)** — storage layout, source/precedence rules, fingerprint and `ACTIVE` grammar, validation failures

## Start Here

1. Read `context/company-context.md`, `context/preferences.md`, and, when present, `context/product-language.md`.
2. Inventory `design-system/`: the raw sources under `design-system/sources/` (if any), the existing `example-design-system.pen`, and every committed `profiles/vNNN/` plus `profiles/ACTIVE`.
3. Classify every file the user supplied: `.pen` canvas, CSS custom-property file, Design Tokens Format Module (2025.10) JSON, Markdown guidance, or a Figma reference.

## Source Precedence

Order sources from lowest to highest precedence when merging:

1. the example pen as a fallback baseline
2. optional Figma extraction, when supplied and the MCP is reachable
3. existing canonical local sources already under `design-system/`
4. explicitly supplied current sources from this session

A failed optional Figma read produces a warning and continues only when required local sources suffice. A missing or hash-drifted source marked `required` stops the run before any snapshot is written; optional ones are omitted with a warning.

## Proposal Gate

Present a 3–5 bullet proposal covering: sources (with precedence order), themes and default theme, and the output version. Wait for explicit approval before copying external inputs or writing a new immutable version.

## Writing A Version

After approval:

1. Copy approved external local inputs into `design-system/sources/<source-id>/`; preserve existing sources in place.
2. Generate the next `vNNN` directory (`profile.json`, `tokens.css`, `components.json`, `assets.json`, plus `assets/` and `guidance/` only when files exist). Convert every source token to CSS custom properties, expand font stacks to local/system fallbacks, and convert numeric radii to pixels. Record each local source's SHA-256.
3. Refuse to overwrite an existing version directory; choose the next number instead.
4. Run `cd prototype-playground && npm run validate` and fix findings until the profile validates with zero errors.
5. Only after validation succeeds, write `design-system/profiles/ACTIVE` as exactly two LF-terminated lines: the `vNNN` directory name, then `sha256:<64 lowercase hex>` of the fingerprint defined in the reference.

## Report

Close with: the active version, included and excluded sources (with reasons), unresolved warnings, and a recommendation to run `prototype-builder` for prototype work.

## Maintenance

Keep the `.claude`, `.cursor`, and `.agents` copies aligned.
