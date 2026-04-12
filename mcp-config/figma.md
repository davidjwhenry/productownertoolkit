# Figma Dev Mode MCP

## Why add it

Use `Figma` to bring design context into the repo when you are writing PRDs, reviewing flows, or checking whether a proposed experience matches the intended design.

## Recommendation

Recommended if you work closely with design. It is not yet wired into many explicit repo workflows, but it is worth connecting now if design context matters in your day-to-day work.

## When you will use it

- reading design intent while drafting requirements
- checking flows against existing designs
- preparing for future design-aware workflows in this repo

## Setup

Figma has two valid setup modes in Cursor.

### Option 1: Remote server

This is Figma's recommended setup and does not require the desktop app.

Add this to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

1. Save the file and restart Cursor.
2. Authenticate through the Figma OAuth flow when prompted.
3. Confirm you can access the files or teams you need.

### Option 2: Desktop app local server

Use this if you specifically want the local desktop-backed MCP server.

1. Install the Figma desktop app.
2. In the desktop app, enable `Dev Mode MCP Server` in Preferences.
3. Add this to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "figma-desktop": {
      "url": "http://127.0.0.1:3845/mcp"
    }
  }
}
```

4. Restart Cursor.
5. Authenticate when prompted.
6. Keep it available as an optional but useful context source.

## Notes

- Use the remote server by default unless you specifically want the desktop app flow.
- The local desktop server runs on `http://127.0.0.1:3845/mcp`.
- Figma also offers a Cursor plugin install path.
