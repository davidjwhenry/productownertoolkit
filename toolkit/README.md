# Toolkit source

This folder is the single source for everything the toolkit distributes.

| Path | Purpose |
| --- | --- |
| `skills/<skill-name>/` | Canonical skills, one level deep. Edit skills here. |
| `catalogue.json` | Capabilities, their skills, and the managed and seed files each one installs. Validated by `catalogue.schema.json`. |
| `support/agents-block.md` | Template for the managed Product Owner Toolkit block in `AGENTS.md`. |

The agent folders `.claude/skills/`, `.cursor/skills/`, and `.agents/skills/` and the managed block in the root `AGENTS.md` are generated. Don't edit them directly. After changing anything in `toolkit/`, run:

```sh
npm install        # once
npm run generate   # rewrite the mirrors and the AGENTS.md block
npm run check      # what CI runs: catalogue, path placeholders, and drift
```

## Path placeholders

Write toolkit paths in skills with a placeholder instead of a root-level path:

| Placeholder | Standalone clone | Installed default |
| --- | --- | --- |
| `{content}/context/…` | `context/…` | `product/context/…` |
| `{toolkit}/mcp-config/…` | `mcp-config/…` | `.product-owner-toolkit/guides/mcp-config/…` |

`{content}` covers `context/`, `requirements/`, `backlog/`, `testing/`, `examples/`, `design-system/`, and `personal/`; `{toolkit}` covers `mcp-config/` and `conventions/`. `prototype-playground/` is at the repository root in both layouts, so it needs no placeholder. `npm run check` fails on a root-level path that should use a placeholder.

Ownership in the catalogue:

- **managed** files belong to the toolkit. The installer checksums them and updates replace them.
- **seed** files belong to the user. The installer creates them once and never touches them again.
- **runtime** is a toolkit-managed application folder; paths listed under `unmanaged` (such as `node_modules/`) are ignored.
