# pen.dev MCP

Formerly known as `Pencil` — same product, new name. Docs still live at `docs.pencil.dev`.

## Why add it

Use `pen.dev` when words are not enough and you want a quick prototype, flow, or visual artefact inside the same workspace. It is an agent-driven design canvas built around MCP, with `.pen` files that live in the repo alongside code.

## Recommendation

Recommended for most users. It pairs well with PRD writing and stakeholder communication even before the repo has more explicit prototype workflows.

## When you will use it

- turning a spec into something tangible
- exploring UI or flow ideas quickly
- creating artefacts stakeholders can react to

## Setup

pen.dev is the odd one out here: the official flow is extension-led rather than a published hand-written `mcp.json` block.

1. Install the `pen.dev` extension in Cursor (or VS Code — search for "pen.dev" in Extensions).
2. Complete activation with your email.
3. Log in to the Claude Code CLI (`claude`, then browser authentication) — this is required for the AI and MCP features to work.
4. Open a `.pen` file and confirm the pen.dev icon appears in the editor.
5. Check Cursor `Settings -> Tools & MCP` to confirm the server is connected. It may still be listed as `pencil` — that is expected.
6. Download the pen.dev desktop app as well if your setup expects it.

Beyond Cursor, the docs list Claude Code, Claude Desktop, VS Code, Windsurf, Codex CLI, Antigravity, and OpenCode CLI as supported clients.

## `mcp.json` extract

No official `mcp.json` snippet is currently published in pen.dev's docs. The MCP server runs locally and registers itself automatically whenever pen.dev is running, so prefer the extension flow above rather than a guessed manual server entry.

## MCP tool surface

The update consolidated the old granular tools (`get_editor_state`, `batch_get`, `get_screenshot`, `batch_design`, `export_html`) into a smaller surface:

- `get_app_state` — current editor context: active file, selection, and document structure
- `get_guidelines` — built-in design guides and style archetypes
- `execute` — the workhorse: operations include `Get` (read nodes with plain JavaScript filters), `Insert`, `Copy`, `Update`, `Replace`, `Move`, `Delete`, `GetVariables`/`SetVariables`, `TakeScreenshot`, `Export` (PNG, JPEG, WEBP, PDF, and HTML), image generation, and themes

If an installed version still exposes the old tool names, the mapping above tells you which `execute` operation replaces each one.

## Notes

- The docs describe the MCP as managed for you once the extension and app are running.
- If pen.dev later publishes a stable manual Cursor config, add that here and replace this note.
