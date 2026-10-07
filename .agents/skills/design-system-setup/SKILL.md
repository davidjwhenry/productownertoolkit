---
name: design-system-setup
description: Compile or update the repository's immutable design profile from local pen.dev `.pen` files, CSS custom-property files, Design Tokens Format Module files, Markdown guidance, or optional Figma extraction. Use when the user supplies design source material, asks to version the design system, the playground reports no active profile, or the active profile is still the shipped sample and the repository may hold a real design system. Discovers design-system sources already in the repository when none are supplied. Proposes a source/precedence/theme plan, waits for approval, writes the next `vNNN` snapshot, validates it, and only then updates `ACTIVE`.
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
3. If the user supplied no source and `design-system/` holds nothing beyond the example pen, discover sources in the repository (see below) before proposing anything.
4. Classify every supplied or discovered file: `.pen` canvas, CSS custom-property file, Design Tokens Format Module (2025.10) JSON, Markdown guidance, or a Figma reference.

## Discovering Sources In The Repository

The profile is only as real as its sources. When none are supplied, look for a design system the repository already has instead of falling back to the example pen.

Search the whole repository. Skip `node_modules/`, build output (`dist/`, `build/`, `.next/`, `out/`), `prototype-playground/`, `.product-owner-toolkit/`, `design-system/profiles/`, and `examples/`.

| Look for | Typical locations | Becomes |
| --- | --- | --- |
| pen.dev canvases | any `*.pen` other than `example-design-system.pen` | `pen` source |
| CSS custom properties | `globals.css`, `tokens.css`, `theme.css`, `variables.css`; any stylesheet declaring `--*` under `:root`, a theme selector, or a Tailwind `@theme` block | `css` source |
| Design Tokens Format Module files | `*.tokens.json`, `tokens.json`, `tokens/` folders; JSON using `$value` and `$type` | `dtcg` source |
| Design guidance | `DESIGN.md`, brand, voice, or UI guideline Markdown | `markdown` source |
| Tokens defined in code | `tailwind.config.*`, theme objects (`theme.ts`, `createTheme`, `extendTheme`), Sass or Less variables, Style Dictionary input | transcribed to a `css` source |
| Component libraries | `components/ui/`, a `ui` or `design-system` package, shadcn `components.json`, Storybook `*.stories.*` | transcribed to a `markdown` source |
| Brand assets | logos, icon sets, and local font files referenced by the files above | assets |

Rules:

- A stylesheet with a handful of one-off variables is not a design system. Report it as a weak candidate rather than promoting it.
- The profile accepts only the five source kinds. For tokens defined in code, write a CSS custom-property file to `design-system/sources/<source-id>/tokens.css` that copies each literal value exactly, with a header comment naming the origin file. For a component library, write `design-system/sources/<source-id>/components.md` listing each component and the variants its code declares.
- Transcribe, never interpret. A value computed at runtime, derived by a function, or otherwise not readable as a literal stays absent and is listed in the report.
- Copy discovered files of a supported kind into `design-system/sources/<source-id>/` unchanged. The profile is a snapshot: tell the user to re-run this skill when the originals change.
- Treat discovered sources as explicitly supplied for precedence, once the user approves them at the proposal gate.
- If several candidates conflict (two token files, a legacy and a current theme), list them and ask which is canonical. Do not merge them silently.
- If nothing is found, say so and ask: "Do you have a design system you want to add as a folder that I can bring in as a reference?" If the user supplies a folder, inventory it the same way. If not, leave the active profile as it is and say that prototypes will keep using the sample system.

## Source Precedence

Order sources from lowest to highest precedence when merging:

1. the example pen as a fallback baseline
2. optional Figma extraction, when supplied and the MCP is reachable
3. existing canonical local sources already under `design-system/`
4. explicitly supplied current sources from this session

A failed optional Figma read produces a warning and continues only when required local sources suffice. A missing or hash-drifted source marked `required` stops the run before any snapshot is written; optional ones are omitted with a warning.

## Proposal Gate

Present a 3–5 bullet proposal covering: sources (with precedence order, and for each discovered source where it was found and whether it is copied or transcribed), themes and default theme, and the output version. Wait for explicit approval before copying external inputs or writing a new immutable version.

## Writing A Version

After approval:

1. Copy approved external and discovered local inputs into `design-system/sources/<source-id>/`, and write any approved transcriptions there; preserve existing sources in place.
2. Generate the next `vNNN` directory (`profile.json`, `tokens.css`, `components.json`, `assets.json`, plus `assets/` and `guidance/` only when files exist). Convert every source token to CSS custom properties, expand font stacks to local/system fallbacks, and convert numeric radii to pixels. Record each local source's SHA-256. Carry forward the previous version's `deviceChrome` and `layout` blocks unchanged unless the user is deliberately re-tuning device frames or the shell column rhythm — those values keep prototypes and the shell rendering consistent frames.
3. Refuse to overwrite an existing version directory; choose the next number instead.
4. Run `cd prototype-playground && npm run validate` and fix findings until the profile validates with zero errors.
5. Only after validation succeeds, write `design-system/profiles/ACTIVE` as exactly two LF-terminated lines: the `vNNN` directory name, then `sha256:<64 lowercase hex>` of the fingerprint defined in the reference.

## Report

Close with: the active version, included and excluded sources (with reasons), any values left out of a transcription, unresolved warnings, and a recommendation to run `prototype-builder` for prototype work.

## Maintenance

Keep the `.claude`, `.cursor`, and `.agents` copies aligned.
