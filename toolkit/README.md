# Toolkit source

This folder is the single source for everything the toolkit distributes.

| Path | Purpose |
| --- | --- |
| `skills/<skill-name>/` | Canonical skills, one level deep. Edit skills here. |
| `catalogue.json` | Capabilities, their skills, and the managed and seed files each one installs. Validated by `catalogue.schema.json`. |

The agent folders `.claude/skills/`, `.cursor/skills/`, and `.agents/skills/` are mirrors of `skills/`. Don't edit them directly; they will be generated and checked in CI. Until the generator lands, copy changes across with:

```sh
for m in .claude/skills .cursor/skills .agents/skills; do rsync -a --delete --exclude .DS_Store toolkit/skills/ "$m/"; done
```

Ownership in the catalogue:

- **managed** files belong to the toolkit. The installer checksums them and updates replace them.
- **seed** files belong to the user. The installer creates them once and never touches them again.
- **runtime** is a toolkit-managed application folder; paths listed under `unmanaged` (such as `node_modules/`) are ignored.
